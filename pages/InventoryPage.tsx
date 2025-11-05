import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getIngredients, getRecipes, getProductSales, getInternalConsumptions, getInventoryCounts, saveInventoryCounts, getWithdrawals } from '../services/db';
import { calculateStockData } from '../services/calculation';
import { generateId, formatCurrency } from '../lib/helpers';
import type { StockData, Ingredient, InventoryCount, InventoryCountItem, UnitOfMeasure } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { ClipboardCheck, Save, AlertTriangle, History, Eye, ChevronLeft, Download, SearchX } from 'lucide-react';

const InventoryPage: React.FC = () => {
    const [view, setView] = useState<'current' | 'history'>('current');
    const [loading, setLoading] = useState(true);
    const [stockData, setStockData] = useState<StockData[]>([]);
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [inventoryHistory, setInventoryHistory] = useState<InventoryCount[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<InventoryCount | null>(null);
    const [searchTerm, setSearchTerm] = useState(''); // State for the search bar
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [recipes, ingredients, sales, internalConsumptions, history, withdrawals] = await Promise.all([
                    getRecipes(),
                    getIngredients(),
                    getProductSales(),
                    getInternalConsumptions(),
                    getInventoryCounts(),
                    getWithdrawals(),
                ]);
                
                setAllIngredients(ingredients);
                setInventoryHistory(history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

                if (recipes.length > 0 && ingredients.length > 0) {
                    const calculatedData = calculateStockData(recipes, ingredients, sales, internalConsumptions, withdrawals);
                    setStockData(calculatedData);
                }
            } catch (error) {
                console.error("Error loading inventory data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const costPerUnitMap = useMemo(() => {
        const latestPurchases = new Map<string, Ingredient>();
        // First, find the latest purchase for each canonical name
        for (const ing of allIngredients) {
            const name = ing.canonicalName || ing.name;
            const existing = latestPurchases.get(name);
            if (!existing || new Date(ing.purchaseDate || 0) > new Date(existing.purchaseDate || 0)) {
                latestPurchases.set(name, ing);
            }
        }
        // Then, create the final map with just the cost and unit
        const map = new Map<string, { cost: number, unit: UnitOfMeasure }>();
        latestPurchases.forEach((ing, name) => {
            map.set(name, { cost: ing.costPerUnit, unit: ing.unit });
        });
        return map;
    }, [allIngredients]);
    
    // Filter stock data based on search term
    const filteredStockData = useMemo(() => {
        if (!searchTerm) {
            return stockData;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return stockData.filter(item =>
            item.ingredientName.toLowerCase().includes(lowercasedTerm)
        );
    }, [stockData, searchTerm]);

    const filteredInventoryHistory = useMemo(() => {
        if (!startDate || !endDate) return inventoryHistory;

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Make end date inclusive

        return inventoryHistory.filter(inv => {
            const invDate = new Date(inv.date);
            return invDate >= start && invDate < end;
        });
    }, [inventoryHistory, startDate, endDate]);


    const handleCountChange = (ingredientName: string, value: string) => {
        setPhysicalCounts(prev => ({ ...prev, [ingredientName]: value }));
    };

    const handleSaveInventory = async () => {
        setIsSaving(true);
        // IMPORTANT: We iterate over the full `stockData` list, not the filtered one,
        // to ensure all items are included in the final inventory record.
        const inventoryItems: InventoryCountItem[] = stockData.map(item => {
            const theoreticalQty = item.finalBalance;
            const physicalQty = parseFloat(physicalCounts[item.ingredientName] || '0');
            const varianceQty = physicalQty - theoreticalQty;
            const costInfo = costPerUnitMap.get(item.ingredientName);
            const costOfVariance = costInfo ? varianceQty * costInfo.cost : 0;
            
            return {
                ingredientName: item.ingredientName,
                unit: (costInfo?.unit || 'unidad') as UnitOfMeasure,
                theoreticalQty,
                physicalQty,
                varianceQty,
                costOfVariance,
            };
        });
        
        const newInventory: InventoryCount = {
            id: generateId(),
            date: new Date().toISOString(),
            items: inventoryItems,
        };
        
        const updatedHistory = [...inventoryHistory, newInventory];
        await saveInventoryCounts(updatedHistory);
        setInventoryHistory(updatedHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setPhysicalCounts({});
        setIsSaving(false);
        setView('history');
        setSelectedHistory(newInventory);
    };
    
    const handleDownloadTemplate = () => {
        if (stockData.length === 0) {
            alert("No hay datos de stock para generar una plantilla.");
            return;
        }
        setIsDownloadingTemplate(true);
        try {
            const dataToExport = stockData.map(item => ({
                'Insumo': item.ingredientName,
                'Unidad': item.unit,
                'Stock Teórico': item.finalBalance,
                'Cantidad Física': '', // Empty column for user input
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            worksheet['!cols'] = [ { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 20 } ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Inventario');
            XLSX.writeFile(workbook, `plantilla_inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch(error) {
            console.error("Error downloading inventory template:", error);
            alert("Hubo un error al generar la plantilla.");
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    if (loading) {
        return <div className="text-center p-10">Cargando datos para inventario...</div>;
    }

    if (view === 'history') {
        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-bold text-white flex items-center"><History className="mr-4"/> Historial de Inventarios</h1>
                    <Button onClick={() => { setView('current'); setSelectedHistory(null); }}><ChevronLeft className="mr-2"/> Realizar Nuevo Inventario</Button>
                </div>
                {selectedHistory ? (
                    <Card>
                         <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-brand">Detalle del Inventario</h2>
                                <p className="text-gray-400">Realizado el: {new Date(selectedHistory.date).toLocaleString('es-AR')}</p>
                            </div>
                            <Button variant="secondary" onClick={() => setSelectedHistory(null)}><ChevronLeft className="mr-2"/> Volver al Historial</Button>
                        </div>
                        <InventoryReportTable report={selectedHistory} />
                    </Card>
                ) : (
                    <>
                        <Card className="mb-6">
                            <h2 className="text-xl font-bold mb-4">Filtrar Historial</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Desde" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <Input label="Hasta" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </Card>
                        <Card>
                            {filteredInventoryHistory.length > 0 ? (
                                <ul className="space-y-3">
                                    {filteredInventoryHistory.map(inv => (
                                        <li key={inv.id} className="p-4 bg-accent rounded-lg flex justify-between items-center hover:bg-brand/20 transition-colors">
                                            <p className="font-semibold text-lg text-gray-200">
                                                Inventario del {new Date(inv.date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <Button variant="secondary" onClick={() => setSelectedHistory(inv)}><Eye className="mr-2"/> Ver Detalle</Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-gray-400 py-6">No se encontraron registros de inventario para el período seleccionado.</p>
                            )}
                        </Card>
                    </>
                )}
            </div>
        );
    }

    if (stockData.length === 0) {
        return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Datos Insuficientes</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para realizar un inventario, primero debe cargar insumos, recetas e importar datos de ventas.
                </p>
            </Card>
        );
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-white flex items-center"><ClipboardCheck className="mr-4"/> Inventario Físico</h1>
                <div className="flex gap-4">
                    <Button variant="secondary" onClick={handleDownloadTemplate} disabled={isDownloadingTemplate}>
                        <Download className="mr-2"/> {isDownloadingTemplate ? 'Generando...' : 'Descargar Plantilla'}
                    </Button>
                    <Button variant="secondary" onClick={() => setView('history')}><History className="mr-2"/>Ver Historial</Button>
                    <Button onClick={handleSaveInventory} disabled={isSaving}>
                        <Save className="mr-2"/> {isSaving ? 'Guardando...' : 'Guardar Inventario'}
                    </Button>
                </div>
            </div>
            <Card>
                <div className="mb-6">
                    <Input
                        label="Buscar insumo para cargar rápidamente..."
                        id="inventory-search"
                        placeholder="Ej: Harina, Tomate Perita, Lomo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-accent">
                            <tr>
                                <th className="p-3">Insumo</th>
                                <th className="p-3 text-right">Stock Teórico</th>
                                <th className="p-3 text-center" style={{width: '150px'}}>Stock Físico</th>
                                <th className="p-3 text-right">Varianza (Unidades)</th>
                                <th className="p-3 text-right">Varianza (Costo)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStockData.map(item => {
                                const theoreticalQty = item.finalBalance;
                                const physicalQty = parseFloat(physicalCounts[item.ingredientName] || '0');
                                const varianceQty = physicalQty - theoreticalQty;
                                const costInfo = costPerUnitMap.get(item.ingredientName);
                                const costOfVariance = costInfo ? varianceQty * costInfo.cost : 0;

                                return (
                                <tr key={item.ingredientName} className="border-b border-accent hover:bg-accent">
                                    <td className="p-3 font-semibold">{item.ingredientName}</td>
                                    <td className="p-3 text-right font-mono">{theoreticalQty.toFixed(3)} {item.unit}</td>
                                    <td className="p-3">
                                        <Input 
                                            label=""
                                            id={`count-${item.ingredientName}`}
                                            type="number"
                                            value={physicalCounts[item.ingredientName] || ''}
                                            onChange={(e) => handleCountChange(item.ingredientName, e.target.value)}
                                            className="text-right"
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className={`p-3 text-right font-mono font-semibold ${varianceQty === 0 ? 'text-gray-400' : varianceQty > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {varianceQty.toFixed(3)} {item.unit}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-semibold ${costOfVariance === 0 ? 'text-gray-400' : costOfVariance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(costOfVariance)}
                                    </td>
                                </tr>
                                )
                            })}
                             {filteredStockData.length === 0 && searchTerm && (
                                <tr>
                                    <td colSpan={5} className="text-center p-8 text-gray-400">
                                        <SearchX className="w-12 h-12 mx-auto mb-2 text-gray-500"/>
                                        No se encontraron insumos para "<strong>{searchTerm}</strong>".
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


const InventoryReportTable: React.FC<{report: InventoryCount}> = ({ report }) => {
    const totalVarianceCost = report.items.reduce((acc, item) => acc + item.costOfVariance, 0);

    return (
        <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="border-b-2 border-accent">
                    <tr>
                        <th className="p-3">Insumo</th>
                        <th className="p-3 text-right">Stock Teórico</th>
                        <th className="p-3 text-right">Stock Físico</th>
                        <th className="p-3 text-right">Varianza (Unidades)</th>
                        <th className="p-3 text-right">Varianza (Costo)</th>
                    </tr>
                </thead>
                <tbody>
                    {report.items.map(item => (
                        <tr key={item.ingredientName} className="border-b border-accent">
                            <td className="p-3 font-semibold">{item.ingredientName}</td>
                            <td className="p-3 text-right font-mono">{item.theoreticalQty.toFixed(3)} {item.unit}</td>
                            <td className="p-3 text-right font-mono">{item.physicalQty.toFixed(3)} {item.unit}</td>
                            <td className={`p-3 text-right font-mono font-semibold ${item.varianceQty === 0 ? 'text-gray-400' : item.varianceQty > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {item.varianceQty.toFixed(3)} {item.unit}
                            </td>
                            <td className={`p-3 text-right font-mono font-semibold ${item.costOfVariance === 0 ? 'text-gray-400' : item.costOfVariance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(item.costOfVariance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-accent">
                    <tr>
                        <td colSpan={4} className="p-3 font-bold text-right text-lg">Total Varianza de Inventario:</td>
                        <td className={`p-3 text-right font-mono font-bold text-lg ${totalVarianceCost === 0 ? 'text-gray-200' : totalVarianceCost > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(totalVarianceCost)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

export default InventoryPage;