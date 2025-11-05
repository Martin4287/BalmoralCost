import React, { useEffect, useState } from 'react';
import { BarChart, Bar, ScatterChart, Scatter, ReferenceLine, Label, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRecipes, getIngredients, getProductSales, getProductPrices, getInternalConsumptions, getMenuData, getLowStockSettings, getWithdrawals } from '../services/db';
import { calculateDashboardData } from '../services/calculation';
import type { DashboardData } from '../types';
import { formatCurrency } from '../lib/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { loadSampleData } from '../services/sampleData';
import { TrendingUp, DollarSign, Zap, AlertTriangle, Rocket, BrainCircuit, UtensilsCrossed, ClipboardList, Warehouse } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const value = payload[0].value;
        const name = payload[0].name;
        let formattedValue;

        if (name === 'Margen Bruto') {
            formattedValue = `${value.toFixed(2)}%`;
        } else if (name === 'Fuerza de Venta (Rentabilidad Total)') {
            formattedValue = formatCurrency(value);
        } else { // Catches 'Cantidad Vendida'
            formattedValue = value;
        }

        return (
            <div className="bg-primary p-2 border border-accent rounded-md shadow-lg text-white">
                <p className="font-bold">{label}</p>
                <p className="text-brand">{`${name}: ${formattedValue}`}</p>
            </div>
        );
    }
    return null;
};

const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-primary p-2 border border-accent rounded-md shadow-lg text-white text-sm">
                <p className="font-bold text-base mb-1">{data.name}</p>
                <p className="text-gray-300"><span className="font-semibold text-brand">Popularidad:</span> {data.popularity} uds.</p>
                <p className="text-gray-300"><span className="font-semibold text-brand">Rentabilidad:</span> {formatCurrency(data.profitability)}</p>
                <p className="text-gray-300"><span className="font-semibold text-brand">Margen:</span> {data.margin.toFixed(1)}%</p>
                <p className="font-bold mt-2" style={{ color: payload[0].color }}>{data.quadrant}</p>
            </div>
        );
    }
    return null;
};


const DashboardPage: React.FC<{ onNavigate: (page: 'stock' | 'ingredients') => void }> = ({ onNavigate }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPopulating, setIsPopulating] = useState(false);
    const [bcgSearchTerm, setBcgSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [recipes, ingredients, sales, prices, internalConsumptions, menuData, lowStockSettings, withdrawals] = await Promise.all([
                    getRecipes(),
                    getIngredients(),
                    getProductSales(),
                    getProductPrices(),
                    getInternalConsumptions(),
                    getMenuData(),
                    getLowStockSettings(),
                    getWithdrawals()
                ]);

                if (recipes.length === 0 || ingredients.length === 0 || (sales.length === 0 && internalConsumptions.length === 0)) {
                    setData(null);
                } else {
                    const dashboardData = calculateDashboardData(recipes, ingredients, sales, prices, internalConsumptions, menuData, lowStockSettings, withdrawals);
                    setData(dashboardData);
                }
            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleLoadSampleData = async () => {
        setIsPopulating(true);
        try {
            await loadSampleData();
            // Recargar la página para reflejar los nuevos datos en todos los componentes
            window.location.reload();
        } catch (error) {
            console.error("Failed to load sample data:", error);
            alert("Hubo un error al cargar los datos de ejemplo.");
            setIsPopulating(false);
        }
    };

    if (loading) {
        return <div className="text-center p-10">Cargando datos del dashboard...</div>;
    }

    if (!data) {
        return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Datos Insuficientes</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para ver el dashboard, primero debe cargar insumos, recetas e importar los archivos de ventas y precios.
                </p>
                <p className="text-gray-400 max-w-xl mx-auto mt-4 mb-6">
                    O puede cargar un conjunto de datos de ejemplo para explorar la aplicación.
                </p>
                <Button onClick={handleLoadSampleData} disabled={isPopulating}>
                    <Rocket className="mr-2" size={18} />
                    {isPopulating ? 'Cargando...' : 'Cargar Datos de Ejemplo'}
                </Button>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-white">Dashboard de Rendimiento</h1>
            
            {data.lowStockItems.length > 0 && (
                <Card className="border-l-4 border-yellow-400 bg-yellow-900/30">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="w-10 h-10 text-yellow-400" />
                        </div>
                        <div className="flex-grow">
                            <h2 className="text-2xl font-bold text-yellow-300">¡Atención! Insumos con Bajo Stock</h2>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-sm">
                                {data.lowStockItems.map(item => (
                                    <div key={item.name}>
                                        <span className="font-semibold text-white">{item.name}:</span>
                                        <span className="ml-2 font-mono text-red-400">{item.balance.toFixed(2)}</span>
                                        <span className="text-gray-400"> / {item.threshold} {item.unit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div className="flex-shrink-0 self-center">
                            <Button variant="secondary" onClick={() => onNavigate('stock')}>
                                <Warehouse className="mr-2" size={18} />
                                Ir a Stock
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {data.unmatchedSales.length > 0 && (
                <Card className="border-l-4 border-orange-400 bg-orange-900/30">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="w-10 h-10 text-orange-400" />
                        </div>
                        <div className="flex-grow">
                            <h2 className="text-2xl font-bold text-orange-300">Ventas No Analizadas</h2>
                            <p className="text-sm text-gray-400 mt-2 mb-3">
                                Los siguientes productos se vendieron pero no se encontraron en su lista de recetas con un nombre idéntico. No se incluirán en los análisis de rentabilidad. Verifique que los nombres coincidan entre su sistema de ventas y sus recetas en la aplicación.
                            </p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                                {data.unmatchedSales.map(item => (
                                    <div key={item.name} className="flex justify-between">
                                        <span className="font-semibold text-white truncate pr-4" title={item.name}>{item.name}</span>
                                        <span className="font-mono text-orange-300">{item.quantity} uds.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {data.cubiertosSale && data.cubiertosSale.quantity > 0 && (
                 <Card>
                    <h2 className="text-2xl font-bold mb-4 flex items-center"><UtensilsCrossed className="mr-3 text-brand"/>Cenas y Almuerzos</h2>
                    <div className="text-center">
                        <p className="text-5xl font-bold text-white">{data.cubiertosSale.quantity.toLocaleString('es-AR')}</p>
                        <p className="text-gray-400 mt-2">Total de servicios de cubiertos registrados.</p>
                    </div>
                </Card>
            )}

            {data.internalConsumptionsSummary && data.internalConsumptionsSummary.length > 0 && (
                <Card>
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold flex items-center"><ClipboardList className="mr-3 text-brand"/>Consumos Internos (Top 10 por Costo)</h2>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">Costo Total de Consumos</p>
                            <p className="text-xl font-bold text-red-400">{formatCurrency(data.totalInternalConsumptionsCost)}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {data.internalConsumptionsSummary.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 items-center text-sm bg-accent/50 p-2 rounded gap-2">
                                <div className="col-span-8 flex items-center gap-2">
                                    <span className="font-semibold text-gray-300 truncate" title={item.name}>{item.name} ({item.quantity.toLocaleString('es-AR')} uds.)</span>
                                    {item.tableType && (
                                        <span className="text-xs font-medium bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full whitespace-nowrap">{item.tableType}</span>
                                    )}
                                </div>
                                <div className="col-span-4 font-mono text-red-400 text-right">
                                    {formatCurrency(item.totalCost)}
                                </div>
                            </div>
                        ))}
                    </div>
                     <p className="text-xs text-gray-500 mt-3">Costo total de productos registrados como consumo interno, invitaciones o pérdidas.</p>
                </Card>
            )}
            
            <Card>
                <h2 className="text-2xl font-bold mb-4 flex items-center"><TrendingUp className="mr-3 text-brand"/>Top 10 Productos Más Vendidos</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.topSelling} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                        <XAxis dataKey="name" stroke="#a0aec0" />
                        <YAxis stroke="#a0aec0" />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4a556880' }} />
                        <Legend />
                        <Bar dataKey="quantity" fill="#38b2ac" name="Cantidad Vendida" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4 flex items-center"><DollarSign className="mr-3 text-brand"/>Top 10 Productos con Mayor Margen Bruto (%)</h2>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.mostProfitable} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                        <XAxis dataKey="name" stroke="#a0aec0" />
                        <YAxis stroke="#a0aec0" tickFormatter={(tick) => `${tick.toFixed(0)}%`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4a556880' }}/>
                        <Legend />
                        <Bar dataKey="margin" fill="#81e6d9" name="Margen Bruto" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4 flex items-center"><Zap className="mr-3 text-brand"/>Top 10 Productos con Mayor Fuerza de Venta</h2>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.salesForce} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                        <XAxis dataKey="name" stroke="#a0aec0" />
                        <YAxis stroke="#a0aec0" tickFormatter={(tick) => formatCurrency(tick)}/>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4a556880' }}/>
                        <Legend />
                        <Bar dataKey="force" fill="#4fd1c5" name="Fuerza de Venta (Rentabilidad Total)" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-2 flex items-center"><BrainCircuit className="mr-3 text-brand"/>Matriz de Ingeniería de Menú (BCG)</h2>
                <p className="text-sm text-gray-400 mb-4">Clasifica los platos de tu carta según su popularidad (cantidad vendida) y rentabilidad (ganancia unitaria) para tomar decisiones estratégicas.</p>
                <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                        <XAxis type="number" dataKey="popularity" name="Popularidad (Cant. Vendida)" stroke="#a0aec0" />
                        <YAxis type="number" dataKey="profitability" name="Rentabilidad (Ganancia)" stroke="#a0aec0" tickFormatter={(tick) => formatCurrency(tick)} width={80}/>
                        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }}/>

                        {data.menuEngineering.avgProfitability > 0 && 
                            <ReferenceLine y={data.menuEngineering.avgProfitability} stroke="white" strokeDasharray="4 4" >
                                <Label value="Rentabilidad Media" offset={10} position="insideTopLeft" fill="#a0aec0" fontSize={12} />
                            </ReferenceLine>
                        }
                        {data.menuEngineering.avgPopularity > 0 &&
                            <ReferenceLine x={data.menuEngineering.avgPopularity} stroke="white" strokeDasharray="4 4">
                                <Label value="Popularidad Media" angle={-90} offset={20} position="insideTopRight" fill="#a0aec0" fontSize={12} />
                            </ReferenceLine>
                        }

                        <Scatter name="Estrellas" data={data.menuEngineering.items.filter(i => i.quadrant === 'Estrella')} fill="#38b2ac" />
                        <Scatter name="Puzzles" data={data.menuEngineering.items.filter(i => i.quadrant === 'Puzzle')} fill="#ecc94b" />
                        <Scatter name="Caballos de Batalla" data={data.menuEngineering.items.filter(i => i.quadrant === 'Caballo de Batalla')} fill="#63b3ed" />
                        <Scatter name="Perros" data={data.menuEngineering.items.filter(i => i.quadrant === 'Perro')} fill="#f56565" />

                    </ScatterChart>
                </ResponsiveContainer>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs text-gray-400 border-t border-accent pt-4">
                    <div className="p-2 bg-accent rounded">
                        <h4 className="font-bold text-teal-400">Estrellas</h4>
                        <p>Alta rentabilidad y popularidad. ¡Mantenlos y promuévelos!</p>
                    </div>
                    <div className="p-2 bg-accent rounded">
                        <h4 className="font-bold text-yellow-400">Puzzles</h4>
                        <p>Alta rentabilidad, baja popularidad. ¿Necesitan más visibilidad?</p>
                    </div>
                    <div className="p-2 bg-accent rounded">
                        <h4 className="font-bold text-blue-400">Caballos de Batalla</h4>
                        <p>Baja rentabilidad, alta popularidad. Intenta hacerlos más rentables.</p>
                    </div>
                    <div className="p-2 bg-accent rounded">
                        <h4 className="font-bold text-red-400">Perros</h4>
                        <p>Baja rentabilidad y popularidad. Considera rediseñarlos o eliminarlos.</p>
                    </div>
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4 text-white">Datos Detallados de la Matriz</h2>
                <Input
                    label="Buscar producto en la matriz..."
                    id="bcg-search"
                    value={bcgSearchTerm}
                    onChange={e => setBcgSearchTerm(e.target.value)}
                    className="mb-4"
                />
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-accent sticky top-0 bg-secondary">
                            <tr>
                                <th className="p-3">Producto</th>
                                <th className="p-3 text-right">Popularidad (Ventas)</th>
                                <th className="p-3 text-right">Rentabilidad (Ganancia)</th>
                                <th className="p-3 text-right">Margen</th>
                                <th className="p-3">Clasificación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.menuEngineering.items
                                .filter(item => item.name.toLowerCase().includes(bcgSearchTerm.toLowerCase()))
                                .sort((a,b) => b.popularity - a.popularity)
                                .map(item => {
                                    let quadrantColor = '';
                                    switch (item.quadrant) {
                                        case 'Estrella': quadrantColor = 'text-teal-400'; break;
                                        case 'Puzzle': quadrantColor = 'text-yellow-400'; break;
                                        case 'Caballo de Batalla': quadrantColor = 'text-blue-400'; break;
                                        case 'Perro': quadrantColor = 'text-red-400'; break;
                                    }
                                    return (
                                        <tr key={item.name} className="border-b border-accent hover:bg-accent">
                                            <td className="p-3 font-semibold">{item.name}</td>
                                            <td className="p-3 text-right font-mono">{item.popularity}</td>
                                            <td className="p-3 text-right font-mono">{formatCurrency(item.profitability)}</td>
                                            <td className="p-3 text-right font-mono">{item.margin.toFixed(1)}%</td>
                                            <td className={`p-3 font-bold ${quadrantColor}`}>{item.quadrant}</td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
                </div>
            </Card>

        </div>
    );
};

export default DashboardPage;