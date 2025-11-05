import React, { useState, useEffect, useMemo } from 'react';
import { getRecipes, getIngredients, getProductSales, getProductPrices } from '../services/db';
import { calculateRecipeCost } from '../services/calculation';
import type { Recipe, Ingredient, ProductSale, ProductPrice } from '../types';
import { formatCurrency } from '../lib/helpers';
import { VAT_RATE } from '../lib/constants';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SearchableProductSelect from '../components/SearchableProductSelect';
import { BarChart3, AlertTriangle, SearchX, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Define and export the DetailedSale type needed by SearchableProductSelect
export interface DetailedSale {
    date: string;
    name: string;
    quantity: number;
    salePrice: number;
    costPerServing: number;
    costWithVAT: number;
    profitPerUnit: number;
    totalProfit: number;
    margin: number;
    category: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-primary p-2 border border-accent rounded-md shadow-lg text-white">
                <p className="font-bold">{label}</p>
                <p className="text-brand">{`${payload[0].name}: ${formatCurrency(payload[0].value)}`}</p>
            </div>
        );
    }
    return null;
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: keyof DetailedSale;
  sortConfig: { key: keyof DetailedSale; direction: string } | null;
  onRequestSort: (key: keyof DetailedSale) => void;
  className?: string;
}> = ({ label, sortKey, sortConfig, onRequestSort, className }) => {
  const isSorted = sortConfig?.key === sortKey;
  const icon = isSorted ? (sortConfig?.direction === 'ascending' ? <ChevronUp size={16} className="text-brand"/> : <ChevronDown size={16} className="text-brand"/>) : <ChevronUp size={16} className="text-transparent group-hover:text-gray-500"/>;

  return (
    <th className={`p-3 group ${className}`} onClick={() => onRequestSort(sortKey)} style={{cursor: 'pointer'}}>
      <div className="flex items-center gap-2">
        {label}
        {icon}
      </div>
    </th>
  );
};


const SalesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [salesData, setSalesData] = useState<DetailedSale[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<DetailedSale | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof DetailedSale, direction: 'ascending' | 'descending' }>({ key: 'totalProfit', direction: 'descending' });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [recipes, ingredients, sales, prices] = await Promise.all([
                    getRecipes(),
                    getIngredients(),
                    getProductSales(),
                    getProductPrices(),
                ]);

                if (recipes.length === 0 || ingredients.length === 0 || sales.length === 0) {
                    setSalesData([]);
                    return;
                }

                // Create a map of recipe names to their calculated data
                const recipeDataMap = new Map<string, { cost: number; price: number; recipe: Recipe }>();
                recipes.forEach(recipe => {
                    const costPerServing = calculateRecipeCost(recipe, ingredients, recipes);
                    const priceRecord = prices.find(p => p.name === recipe.name);
                    const salePrice = priceRecord ? priceRecord.salePrice : recipe.salePrice;
                    recipeDataMap.set(recipe.name, { cost: costPerServing, price: salePrice, recipe });
                });

                const regularSales = sales.filter(s => !s.name.toLowerCase().includes('cubierto'));

                const processedSales = regularSales
                    .map(sale => {
                        const recipeData = recipeDataMap.get(sale.name);
                        if (!recipeData) return null;

                        const costWithVAT = recipeData.cost * (1 + VAT_RATE);
                        const profitPerUnit = recipeData.price - costWithVAT;
                        const totalProfit = profitPerUnit * sale.quantity;
                        const margin = recipeData.price > 0 ? (profitPerUnit / recipeData.price) * 100 : 0;

                        return {
                            date: sale.date,
                            name: sale.name,
                            quantity: sale.quantity,
                            salePrice: recipeData.price,
                            costPerServing: recipeData.cost,
                            costWithVAT,
                            profitPerUnit,
                            totalProfit,
                            margin,
                            category: recipeData.recipe.category
                        };
                    })
                    .filter((item): item is DetailedSale => item !== null);
                
                setSalesData(processedSales);

            } catch (error) {
                console.error("Error loading sales data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 1. Filter sales by the selected date range
    const dateFilteredSales = useMemo(() => {
        if (!startDate || !endDate) {
            return salesData;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Make end date inclusive for the entire day

        return salesData.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= start && saleDate <= end;
        });
    }, [salesData, startDate, endDate]);
    
    // 2. Further filter by search term for summary cards and graph
    const finalDataForDisplay = useMemo(() => {
        if (!searchTerm) {
            return dateFilteredSales;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return dateFilteredSales.filter(sale =>
            sale.name.toLowerCase().includes(lowercasedTerm) ||
            sale.category.toLowerCase().includes(lowercasedTerm)
        );
    }, [dateFilteredSales, searchTerm]);
    
    // 3. Aggregate sales by product name for the main table view
    const aggregatedSales = useMemo(() => {
        if (!dateFilteredSales.length) return [];
        
        const salesMap = new Map<string, DetailedSale>();

        for (const sale of dateFilteredSales) {
            const existing = salesMap.get(sale.name);
            if (existing) {
                existing.quantity += sale.quantity;
                existing.totalProfit += sale.totalProfit;
            } else {
                salesMap.set(sale.name, { ...sale });
            }
        }
        return Array.from(salesMap.values());
    }, [dateFilteredSales]);


    // 4. Sort and filter the aggregated data for the table
    const sortedAndFilteredSales = useMemo(() => {
        let sortableItems = [...aggregatedSales];
        
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            sortableItems = sortableItems.filter(sale =>
                sale.name.toLowerCase().includes(lowercasedTerm) ||
                sale.category.toLowerCase().includes(lowercasedTerm)
            );
        }
        
        sortableItems.sort((a, b) => {
            const key = sortConfig.key;
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';

            if (typeof valA === 'number' && typeof valB === 'number') {
                 return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
            }

            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return sortableItems;
    }, [aggregatedSales, searchTerm, sortConfig]);

    // 5. Calculate summary stats based on the fully filtered data
    const summaryStats = useMemo(() => {
        const sourceData = finalDataForDisplay; // Use the fully filtered data
        const totalItemsSold = sourceData.reduce((sum: number, item) => sum + item.quantity, 0);
        const totalRevenue = sourceData.reduce((sum: number, item) => sum + (item.salePrice * item.quantity), 0);
        const totalCost = sourceData.reduce((sum: number, item) => sum + (item.costWithVAT * item.quantity), 0);
        const totalProfit = totalRevenue - totalCost;
        const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        
        return { totalItemsSold, totalRevenue, totalProfit, averageMargin };
    }, [finalDataForDisplay]);

    const requestSort = (key: keyof DetailedSale) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    if (loading) {
        return <div className="text-center p-10">Cargando datos de ventas...</div>;
    }

    if (salesData.length === 0) {
         return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Hay Datos de Ventas</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para ver el reporte de ventas, primero debe cargar insumos, recetas e importar un archivo de ventas.
                </p>
            </Card>
        );
    }
    
    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-white flex items-center"><BarChart3 className="mr-4"/>Análisis de Ventas</h1>
            
             <Card>
                <h2 className="text-xl font-bold mb-4">Filtros</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <Input label="Filtrar desde" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input label="Filtrar hasta" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <Input
                        label="Buscar por nombre o categoría..."
                        id="sales-search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </Card>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <h3 className="text-sm font-medium text-gray-400">Venta Total</h3>
                    <p className="text-3xl font-bold text-white mt-1">{formatCurrency(summaryStats.totalRevenue)}</p>
                </Card>
                <Card>
                    <h3 className="text-sm font-medium text-gray-400">Ganancia Total</h3>
                    <p className="text-3xl font-bold text-green-400 mt-1">{formatCurrency(summaryStats.totalProfit)}</p>
                </Card>
                 <Card>
                    <h3 className="text-sm font-medium text-gray-400">Margen Promedio</h3>
                    <p className="text-3xl font-bold text-white mt-1">{`${summaryStats.averageMargin.toFixed(1)}%`}</p>
                </Card>
                <Card>
                    <h3 className="text-sm font-medium text-gray-400">Productos Vendidos</h3>
                    <p className="text-3xl font-bold text-white mt-1">{summaryStats.totalItemsSold.toLocaleString('es-AR')}</p>
                </Card>
            </div>
            
            <Card>
                <h2 className="text-2xl font-bold mb-4">Análisis por Producto Individual</h2>
                 <SearchableProductSelect
                    label="Seleccione un producto para ver el detalle"
                    products={aggregatedSales}
                    value={selectedProduct}
                    onChange={setSelectedProduct}
                />
                {selectedProduct && (
                    <div className="mt-6 p-4 bg-accent rounded-lg grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                            <p className="text-sm text-gray-400">Cant. Vendida (período)</p>
                            <p className="text-lg font-bold">{selectedProduct.quantity.toLocaleString('es-AR')}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Precio Unitario</p>
                            <p className="text-lg font-bold">{formatCurrency(selectedProduct.salePrice)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-gray-400">Costo Unitario (c/IVA)</p>
                            <p className="text-lg font-bold">{formatCurrency(selectedProduct.costWithVAT)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Ganancia Unitaria</p>
                            <p className="text-lg font-bold text-green-400">{formatCurrency(selectedProduct.profitPerUnit)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-gray-400">Margen</p>
                            <p className="text-lg font-bold">{`${selectedProduct.margin.toFixed(1)}%`}</p>
                        </div>
                    </div>
                )}
            </Card>

            <Card>
                 <h2 className="text-2xl font-bold mb-4">Top 10 Categorías por Ganancia Total</h2>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={
                        Object.entries(
                            finalDataForDisplay.reduce((acc: Record<string, number>, sale) => {
                                acc[sale.category] = (acc[sale.category] || 0) + sale.totalProfit;
                                return acc;
                            }, {})
                        )
                        .map(([name, profit]) => ({ name, profit }))
                        .sort((a,b) => b.profit - a.profit)
                        .slice(0, 10)
                    }>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                        <XAxis dataKey="name" stroke="#a0aec0" />
                        <YAxis stroke="#a0aec0" tickFormatter={(tick) => formatCurrency(tick)} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4a556880' }} />
                        <Bar dataKey="profit" fill="#38b2ac" name="Ganancia Total" />
                    </BarChart>
                 </ResponsiveContainer>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4">Detalle de Ventas por Producto</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-accent">
                             <tr>
                                <SortableHeader label="Producto" sortKey="name" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Categoría" sortKey="category" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Cant. Vendida" sortKey="quantity" sortConfig={sortConfig} onRequestSort={requestSort} className="text-right" />
                                <SortableHeader label="Precio Venta" sortKey="salePrice" sortConfig={sortConfig} onRequestSort={requestSort} className="text-right" />
                                <SortableHeader label="Ganancia Total" sortKey="totalProfit" sortConfig={sortConfig} onRequestSort={requestSort} className="text-right" />
                                <SortableHeader label="Margen" sortKey="margin" sortConfig={sortConfig} onRequestSort={requestSort} className="text-right" />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredSales.length > 0 ? sortedAndFilteredSales.map(sale => (
                                <tr key={sale.name} className="border-b border-accent hover:bg-accent transition-colors">
                                    <td className="p-3 font-semibold">{sale.name}</td>
                                    <td className="p-3 text-gray-400">{sale.category}</td>
                                    <td className="p-3 text-right font-mono">{sale.quantity}</td>
                                    <td className="p-3 text-right font-mono">{formatCurrency(sale.salePrice)}</td>
                                    <td className="p-3 text-right font-mono text-green-400">{formatCurrency(sale.totalProfit)}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${sale.margin < 40 ? 'text-red-500' : 'text-green-400'}`}>{`${sale.margin.toFixed(1)}%`}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-400">
                                        <SearchX className="w-12 h-12 mx-auto mb-2 text-gray-500"/>
                                        {searchTerm ? (
                                            <span>No se encontraron productos para "<strong>{searchTerm}</strong>".</span>
                                        ) : (
                                            <span>No hay ventas en el período seleccionado.</span>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default SalesPage;
