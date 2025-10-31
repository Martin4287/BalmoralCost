import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getRecipes, getIngredients, getProductSales, getInternalConsumptions, getWithdrawals, getLowStockSettings } from '../services/db';
import { calculateStockData } from '../services/calculation';
import type { StockData, Ingredient, LowStockSettings } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Warehouse, Download, AlertTriangle } from 'lucide-react';
import SearchableStockItemSelect from '../components/SearchableStockItemSelect';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


const StockTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload; // The full movement object
        return (
            <div className="bg-primary p-3 border border-accent rounded-md shadow-lg text-white text-sm">
                <p className="font-bold mb-1">Fecha: {new Date(data.date).toLocaleDateString('es-AR')}</p>
                <p className="text-gray-300"><strong>Tipo:</strong> {data.type}</p>
                <p className="text-gray-300"><strong>Descripción:</strong> {data.description}</p>
                <p className="font-semibold mt-2">Saldo: <span className="text-brand font-mono">{data.balance.toFixed(2)}</span></p>
            </div>
        );
    }
    return null;
};


const StockPage: React.FC = () => {
    const [stockData, setStockData] = useState<StockData[]>([]);
    const [selectedIngredientName, setSelectedIngredientName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [lowStockSettings, setLowStockSettings] = useState<LowStockSettings>({});
    const [lowStockFilterActive, setLowStockFilterActive] = useState(false);

    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [recipes, ingredientsData, sales, internalConsumptions, withdrawals, settings] = await Promise.all([
                    getRecipes(),
                    getIngredients(),
                    getProductSales(),
                    getInternalConsumptions(),
                    getWithdrawals(),
                    getLowStockSettings()
                ]);

                setAllIngredients(ingredientsData);
                setLowStockSettings(settings);
                
                if (recipes.length > 0 && ingredientsData.length > 0) {
                    const calculatedData = calculateStockData(recipes, ingredientsData, sales, internalConsumptions, withdrawals);
                    setStockData(calculatedData);
                    
                    const uniqueCanonicalNames = [...new Set(ingredientsData.map(i => i.canonicalName || i.name))].sort();
                    if (uniqueCanonicalNames.length > 0 && !selectedIngredientName) {
                        setSelectedIngredientName(uniqueCanonicalNames[0]);
                    }
                }
            } catch (error) {
                console.error("Error loading stock data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const selectedStockData = useMemo(() => {
        return stockData.find(d => d.ingredientName === selectedIngredientName);
    }, [stockData, selectedIngredientName]);

    const displayData = useMemo(() => {
        if (!selectedStockData) return null;
        
        if (!startDate || !endDate) {
            return {
                ...selectedStockData,
                periodStartBalance: 0,
                movements: selectedStockData.movements, // Show all movements if no date range
                netChange: 0,
            };
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Make end date inclusive

        const priorMovements = selectedStockData.movements.filter(m => new Date(m.date) < start);
        const periodStartBalance = priorMovements.reduce((bal, m) => bal + m.debit - m.credit, 0);

        const periodMovements = selectedStockData.movements.filter(m => {
            const moveDate = new Date(m.date);
            return moveDate >= start && moveDate < end;
        });

        let balance = periodStartBalance;
        const movementsWithRunningBalance = periodMovements.map(m => {
            balance += m.debit - m.credit;
            return { ...m, balance };
        });
        
        const periodEndBalance = balance;
        const netChange = periodEndBalance - periodStartBalance;


        return {
            ingredientName: selectedStockData.ingredientName,
            unit: selectedStockData.unit,
            finalBalance: periodEndBalance, // This is now the period end balance
            movements: movementsWithRunningBalance,
            periodStartBalance,
            netChange,
        };
    }, [selectedStockData, startDate, endDate]);

    const uniqueCanonicalNames = useMemo(() => {
        let items = [...new Set(allIngredients.map(i => i.canonicalName || i.name))];
        if (lowStockFilterActive) {
            items = items.filter(name => {
                const stockItem = stockData.find(s => s.ingredientName === name);
                const threshold = lowStockSettings[name];
                return stockItem && threshold !== undefined && stockItem.finalBalance <= threshold;
            });
        }
        return items.sort();
    }, [allIngredients, lowStockFilterActive, stockData, lowStockSettings]);
    
    useEffect(() => {
        if (uniqueCanonicalNames.length > 0) {
            if (!uniqueCanonicalNames.includes(selectedIngredientName)) {
                 setSelectedIngredientName(uniqueCanonicalNames[0]);
            }
        } else {
            setSelectedIngredientName('');
        }
    }, [uniqueCanonicalNames, selectedIngredientName]);

    const handleExport = () => {
        if (!displayData) return;
        
        const dataToExport: any[] = [];
        
        if (startDate && endDate) {
            dataToExport.push({
                'Fecha': '',
                'Tipo': '',
                'Descripción': `Saldo Anterior al ${new Date(startDate).toLocaleDateString('es-AR')}`,
                'Debe (Entrada)': '',
                'Haber (Salida)': '',
                'Saldo': displayData.periodStartBalance.toFixed(4)
            });
        }

        displayData.movements.forEach(m => {
             dataToExport.push({
                'Fecha': new Date(m.date).toLocaleDateString('es-AR'),
                'Tipo': m.type,
                'Descripción': m.description,
                'Debe (Entrada)': m.debit,
                'Haber (Salida)': m.credit.toFixed(4),
                'Saldo': m.balance.toFixed(4)
            });
        });
        
        if (startDate && endDate) {
            dataToExport.push({
                'Fecha': '',
                'Tipo': '',
                'Descripción': `Saldo Final al ${new Date(endDate).toLocaleDateString('es-AR')}`,
                'Debe (Entrada)': '',
                'Haber (Salida)': '',
                'Saldo': displayData.finalBalance.toFixed(4)
            });
        }
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos de Stock');
        XLSX.writeFile(workbook, `stock_${selectedIngredientName.replace(/ /g, '_')}.xlsx`);
    };

    if (loading) {
        return <div className="text-center p-10">Cargando datos de stock...</div>;
    }
    
    if (stockData.length === 0) {
        return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Datos Insuficientes para el Reporte de Stock</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para generar el reporte de movimientos de stock, necesita tener cargados insumos y recetas.
                </p>
            </Card>
        );
    }

    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-8 flex items-center">
                <Warehouse className="mr-4"/> Gestión de Stock
            </h1>

            <Card className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <SearchableStockItemSelect
                            label="Seleccione un Insumo para ver su movimiento"
                            items={uniqueCanonicalNames}
                            value={selectedIngredientName}
                            onChange={setSelectedIngredientName}
                        />
                    </div>
                    <div>
                        <Input label="Desde" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                     <div>
                        <Input label="Hasta" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                 <div className="mt-4 pt-4 border-t border-accent flex justify-between">
                    <Button 
                        onClick={() => setLowStockFilterActive(prev => !prev)}
                        className={`w-full sm:w-auto ${lowStockFilterActive ? 'bg-yellow-600 text-white hover:bg-yellow-700' : ''}`}
                    >
                        <AlertTriangle className="mr-2" />
                        {lowStockFilterActive ? 'Mostrar Todos' : 'Bajos de Stock'}
                    </Button>
                     <Button onClick={handleExport} disabled={!displayData || displayData.movements.length === 0} className="w-full sm:w-auto">
                        <Download className="mr-2" />
                        Exportar Vista Actual a Excel
                    </Button>
                </div>
            </Card>
            
            {displayData ? (
                <Card>
                    <div className="flex justify-between items-start mb-4 flex-wrap gap-4">
                        <h2 className="text-2xl font-bold text-brand">{displayData.ingredientName}</h2>
                        {startDate && endDate ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-right w-full sm:w-auto">
                                <div>
                                    <p className="text-gray-400 text-sm">Saldo Inicial <span className="hidden sm:inline">({new Date(startDate).toLocaleDateString('es-AR')})</span></p>
                                    <p className="text-2xl font-bold text-white">{displayData.periodStartBalance.toFixed(2)} <span className="text-lg text-gray-500">{displayData.unit}</span></p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm">Variación Neta</p>
                                    <p className={`text-2xl font-bold ${displayData.netChange > 0 ? 'text-green-400' : displayData.netChange < 0 ? 'text-red-400' : 'text-white'}`}>
                                        {displayData.netChange.toFixed(2)} <span className="text-lg text-gray-500">{displayData.unit}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm">Saldo Final <span className="hidden sm:inline">({new Date(endDate).toLocaleDateString('es-AR')})</span></p>
                                    <p className="text-3xl font-bold text-white">{displayData.finalBalance.toFixed(2)} <span className="text-lg text-gray-500">{displayData.unit}</span></p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-right">
                                <p className="text-gray-400 text-sm">Saldo Final Total</p>
                                <p className="text-3xl font-bold text-white">{displayData.finalBalance.toFixed(2)} <span className="text-xl text-gray-500">{displayData.unit}</span></p>
                            </div>
                        )}
                    </div>

                    {displayData.movements.length > 0 && (
                        <div className="h-80 mb-8 pt-4 border-t border-accent">
                            <h3 className="text-lg font-semibold text-gray-300 mb-4 text-center">Evolución del Saldo en el Período</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={displayData.movements}
                                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#a0aec0"
                                        tickFormatter={(dateStr) => new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                        minTickGap={20}
                                    />
                                    <YAxis stroke="#a0aec0" domain={['auto', 'auto']} />
                                    <Tooltip content={<StockTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="balance" name="Saldo" stroke="#38b2ac" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}


                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-accent">
                                <tr>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Tipo</th>
                                    <th className="p-3">Descripción</th>
                                    <th className="p-3 text-right text-green-400">Debe (Entrada)</th>
                                    <th className="p-3 text-right text-red-400">Haber (Salida)</th>
                                    <th className="p-3 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayData.movements.map((movement, index) => (
                                    <tr key={index} className="border-b border-accent hover:bg-accent">
                                        <td className="p-3 text-gray-400">{new Date(movement.date).toLocaleDateString('es-AR')}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                movement.type === 'Compra' ? 'bg-blue-900/50 text-blue-300' :
                                                movement.type === 'Consumo' ? 'bg-yellow-900/50 text-yellow-300' :
                                                movement.type === 'Retiro' ? 'bg-rose-900/50 text-rose-300' :
                                                'bg-purple-900/50 text-purple-300' // for Consumo Interno
                                            }`}>
                                                {movement.type}
                                            </span>
                                        </td>
                                        <td className="p-3">{movement.description}</td>
                                        <td className="p-3 text-right font-mono text-green-400">{movement.debit > 0 ? movement.debit.toFixed(2) : '-'}</td>
                                        <td className="p-3 text-right font-mono text-red-400">{movement.credit > 0 ? movement.credit.toFixed(4) : '-'}</td>
                                        <td className="p-3 text-right font-mono font-semibold">{movement.balance.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {startDate && endDate && displayData.movements.length > 0 && (
                                <tfoot className="border-t-2 border-accent">
                                    <tr>
                                        <td colSpan={5} className="p-3 font-bold text-right text-lg text-gray-300">Saldo Final al Período</td>
                                        <td className="p-3 text-right font-mono font-bold text-lg">{displayData.finalBalance.toFixed(4)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </Card>
            ) : (
                 uniqueCanonicalNames.length > 0 ? (
                    <Card className="text-center py-10">
                        <p className="text-gray-400">Por favor, seleccione un insumo para ver su reporte de movimientos.</p>
                    </Card>
                ) : (
                     <Card className="text-center py-10">
                         {lowStockFilterActive ? (
                            <p className="text-gray-400">No hay insumos por debajo del stock mínimo configurado.</p>
                         ) : (
                            <p className="text-gray-400">No hay insumos disponibles para analizar.</p>
                         )}
                    </Card>
                )
            )}

        </div>
    );
};

export default StockPage;