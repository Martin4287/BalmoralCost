import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getIngredients, getRecipes, getProductSales, getInternalConsumptions, getInventoryCounts, saveInventoryCounts, getWithdrawals } from '../services/db';
import { calculateStockData } from '../services/calculation';
import { generateId, formatCurrency } from '../lib/helpers';
import type { StockData, Ingredient, InventoryCount, InventoryCountItem, UnitOfMeasure, ProductSale, Recipe, Withdrawal } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PrintableInventoryReport from '../components/PrintableInventoryReport';
import { ClipboardCheck, Save, AlertTriangle, History, Eye, ChevronLeft, SearchX, Edit, Trash2, X, FileText, FileSpreadsheet } from 'lucide-react';

const InventoryPage: React.FC = () => {
    const [view, setView] = useState<'current' | 'history'>('current');
    const [loading, setLoading] = useState(true);
    const [stockData, setStockData] = useState<StockData[]>([]);
    const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [inventoryHistory, setInventoryHistory] = useState<InventoryCount[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<InventoryCount | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
    
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [theoreticalStockStartDate, setTheoreticalStockStartDate] = useState('');
    const [theoreticalStockEndDate, setTheoreticalStockEndDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [allSales, setAllSales] = useState<ProductSale[]>([]);
    const [allInternalConsumptions, setAllInternalConsumptions] = useState<ProductSale[]>([]);
    const [allWithdrawals, setAllWithdrawals] = useState<Withdrawal[]>([]);

    const [inventoryForPDF, setInventoryForPDF] = useState<InventoryCount | null>(null);

    const fetchAllData = useCallback(async () => {
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
            setAllRecipes(recipes);
            setAllSales(sales);
            setAllInternalConsumptions(internalConsumptions);
            setAllWithdrawals(withdrawals);
            setInventoryHistory(history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error("Error loading inventory data:", error);
        } finally {
            setLoading(false);
        }
    }, []);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        if (loading) return;
        const calculatedData = calculateStockData(
            allRecipes, 
            allIngredients, 
            allSales, 
            allInternalConsumptions, 
            allWithdrawals, 
            theoreticalStockEndDate
        );
        setStockData(calculatedData);
    }, [allRecipes, allIngredients, allSales, allInternalConsumptions, allWithdrawals, theoreticalStockEndDate, loading]);


    const handleDownloadPDFReport = (inventory: InventoryCount) => {
        if (isExporting) return; // Prevent multiple clicks
        setInventoryForPDF(inventory);
    };

    const generatePdfAndCleanup = useCallback(async (element: HTMLElement) => {
        setIsExporting(true);
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            if (inventoryForPDF) { // Should always be true here
                pdf.save(`reporte_inventario_${new Date(inventoryForPDF.date).toISOString().split('T')[0]}.pdf`);
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF.");
        } finally {
            setIsExporting(false);
            setInventoryForPDF(null); // Cleanup to unmount the component
        }
    }, [inventoryForPDF]);

    const printableAreaRef = useCallback((node: HTMLDivElement | null) => {
        if (node !== null) {
            generatePdfAndCleanup(node);
        }
    }, [generatePdfAndCleanup]);


    const costPerUnitMap = useMemo(() => {
        const latestPurchases = new Map<string, Ingredient>();
        for (const ing of allIngredients) {
            const name = ing.canonicalName || ing.name;
            const existing = latestPurchases.get(name);
            if (!existing || new Date(ing.purchaseDate || 0) > new Date(existing.purchaseDate || 0)) {
                latestPurchases.set(name, ing);
            }
        }
        const map = new Map<string, { cost: number, unit: UnitOfMeasure }>();
        latestPurchases.forEach((ing, name) => {
            map.set(name, { cost: ing.costPerUnit, unit: ing.unit });
        });
        return map;
    }, [allIngredients]);
    
    const filteredStockData = useMemo(() => {
        if (!searchTerm) return stockData;
        const lowercasedTerm = searchTerm.toLowerCase();
        return stockData.filter(item =>
            item.ingredientName.toLowerCase().includes(lowercasedTerm)
        );
    }, [stockData, searchTerm]);

    const filteredInventoryHistory = useMemo(() => {
        if (!historyStartDate || !historyEndDate) return inventoryHistory;
        const start = new Date(historyStartDate);
        const end = new Date(historyEndDate);
        end.setDate(end.getDate() + 1);
        return inventoryHistory.filter(inv => {
            const invDate = new Date(inv.date);
            return invDate >= start && invDate < end;
        });
    }, [inventoryHistory, historyStartDate, historyEndDate]);

    const handleCountChange = (ingredientName: string, value: string) => {
        setPhysicalCounts(prev => ({ ...prev, [ingredientName]: value }));
    };
    
    const resetForm = () => {
        setPhysicalCounts({});
        setEditingInventoryId(null);
        setSearchTerm('');
        setTheoreticalStockEndDate(new Date().toISOString().split('T')[0]);
        setTheoreticalStockStartDate('');
    };

    const handleSaveInventory = async () => {
        setIsSaving(true);
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
        
        let updatedHistory;

        if (editingInventoryId) {
            updatedHistory = inventoryHistory.map(inv => inv.id === editingInventoryId ? { ...inv, date: new Date().toISOString(), calculationStartDate: theoreticalStockStartDate, calculationDate: theoreticalStockEndDate, items: inventoryItems } : inv);
        } else {
            const newInventory: InventoryCount = { id: generateId(), date: new Date().toISOString(), calculationStartDate: theoreticalStockStartDate, calculationDate: theoreticalStockEndDate, items: inventoryItems };
            updatedHistory = [newInventory, ...inventoryHistory];
        }
        
        await saveInventoryCounts(updatedHistory);
        setInventoryHistory(updatedHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        resetForm();
        setIsSaving(false);
        setView('history');
        const justSavedId = editingInventoryId || updatedHistory[0].id;
        setSelectedHistory(updatedHistory.find(i => i.id === justSavedId) || null);
    };
    
    const handleDownloadXLSXReport = (inventory: InventoryCount) => {
        const dataToExport = inventory.items.map(item => ({
            'Insumo': item.ingredientName,
            'Stock Teórico': item.theoreticalQty,
            'Unidad Teórica': item.unit,
            'Stock Físico': item.physicalQty,
            'Varianza (Unidades)': item.varianceQty,
            'Varianza (Costo)': item.costOfVariance,
        }));

        const worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(worksheet, [
            ["Reporte de Inventario"],
            ["Realizado el:", new Date(inventory.date).toLocaleString('es-AR')],
            ["Período de Cálculo:", `Desde ${inventory.calculationStartDate ? new Date(inventory.calculationStartDate).toLocaleDateString('es-AR') : 'Inicio'} hasta ${new Date(inventory.calculationDate).toLocaleDateString('es-AR')}`],
            [] // Empty row
        ], { origin: "A1" });
        XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: "A5", skipHeader: false });
        
        worksheet['!cols'] = [ { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 } ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Inventario');
        XLSX.writeFile(workbook, `reporte_inventario_${new Date(inventory.date).toISOString().split('T')[0]}.xlsx`);
    };
    

    const handleEditInventory = (inventoryToEdit: InventoryCount) => {
        setEditingInventoryId(inventoryToEdit.id);
        setTheoreticalStockEndDate(inventoryToEdit.calculationDate);
        setTheoreticalStockStartDate(inventoryToEdit.calculationStartDate || '');
        const counts = inventoryToEdit.items.reduce((acc, item) => {
            acc[item.ingredientName] = String(item.physicalQty);
            return acc;
        }, {} as Record<string, string>);
        setPhysicalCounts(counts);
        setView('current');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteInventory = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro de inventario? Esta acción es permanente.')) {
            const originalHistory = inventoryHistory;
            const updatedHistory = inventoryHistory.filter(inv => inv.id !== id);
            setInventoryHistory(updatedHistory);
            try {
                await saveInventoryCounts(updatedHistory);
            } catch (error) {
                console.error("Error al eliminar el inventario:", error);
                setInventoryHistory(originalHistory);
                alert("No se pudo eliminar el registro del inventario. La vista ha sido restaurada.");
            }
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
                    <Button onClick={() => { setView('current'); setSelectedHistory(null); resetForm(); }}><ChevronLeft className="mr-2"/> Realizar Nuevo Inventario</Button>
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
                            <h2 className="text-xl font-bold mb-4">Filtrar Historial de Inventarios</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Desde" type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} />
                                <Input label="Hasta" type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} />
                            </div>
                        </Card>
                        <Card>
                            {filteredInventoryHistory.length > 0 ? (
                                <ul className="space-y-3">
                                    {filteredInventoryHistory.map(inv => (
                                        <li key={inv.id} className="p-4 bg-accent rounded-lg flex justify-between items-center hover:bg-brand/20 transition-colors flex-wrap gap-2">
                                            <p className="font-semibold text-lg text-gray-200">
                                                Inventario del {new Date(inv.date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button variant="secondary" onClick={() => setSelectedHistory(inv)} title="Ver Detalle"><Eye/></Button>
                                                <Button variant="secondary" onClick={() => handleEditInventory(inv)} title="Editar"><Edit/></Button>
                                                <Button variant="secondary" onClick={() => handleDownloadPDFReport(inv)} title="Descargar PDF" disabled={isExporting}><FileText/></Button>
                                                <Button variant="secondary" onClick={() => handleDownloadXLSXReport(inv)} title="Descargar XLSX"><FileSpreadsheet/></Button>
                                                <Button variant="danger" onClick={() => handleDeleteInventory(inv.id)} title="Eliminar"><Trash2/></Button>
                                            </div>
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

    if (allIngredients.length === 0) {
        return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Datos Insuficientes</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para realizar un inventario, primero debe cargar insumos.
                </p>
            </Card>
        );
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-4xl font-bold text-white flex items-center">
                    <ClipboardCheck className="mr-4"/> {editingInventoryId ? 'Editando Inventario Físico' : 'Inventario Físico'}
                </h1>
                <div className="flex gap-4 flex-wrap">
                    <Button variant="secondary" onClick={() => { setView('history'); resetForm(); }}><History className="mr-2"/>Ver Historial</Button>
                    {editingInventoryId && (
                        <Button variant="secondary" onClick={() => { setView('history'); resetForm(); }}>
                           <X className="mr-2"/> Cancelar Edición
                        </Button>
                    )}
                    <Button onClick={handleSaveInventory} disabled={isSaving}>
                        <Save className="mr-2"/> {isSaving ? 'Guardando...' : (editingInventoryId ? 'Actualizar Inventario' : 'Guardar Inventario')}
                    </Button>
                </div>
            </div>

            <Card className="mb-6">
                <h2 className="text-xl font-bold text-brand mb-2">Fecha de Cálculo del Stock Teórico</h2>
                <p className="text-sm text-gray-400 mb-4">
                    Seleccione el rango de fechas para el cual se calculará el stock teórico. Esto afectará a la columna "Stock Teórico" en la tabla. El inventario se guardará con este rango de referencia.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                     <Input 
                        label="Desde"
                        type="date" 
                        value={theoreticalStockStartDate} 
                        onChange={e => setTheoreticalStockStartDate(e.target.value)} 
                    />
                    <Input 
                        label="Hasta" 
                        type="date" 
                        value={theoreticalStockEndDate} 
                        onChange={e => setTheoreticalStockEndDate(e.target.value)} 
                    />
                </div>
            </Card>
            
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
            
            {inventoryForPDF && (
                <div ref={printableAreaRef} className="printable-area">
                    <PrintableInventoryReport report={inventoryForPDF} />
                </div>
            )}
        </div>
    );
};

const InventoryReportTable: React.FC<{report: InventoryCount}> = ({ report }) => {
    const totalVarianceCost = report.items.reduce((acc, item) => acc + item.costOfVariance, 0);

    const formatDateForDisplay = (dateString: string | undefined): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
    };

    const calculationDateText = useMemo(() => {
        const endDateStr = formatDateForDisplay(report.calculationDate);
        if (report.calculationStartDate) {
            const startDateStr = formatDateForDisplay(report.calculationStartDate);
            return `Stock Teórico calculado con movimientos desde el ${startDateStr} hasta el ${endDateStr}`;
        }
        return `Stock Teórico calculado con movimientos hasta el: ${endDateStr}`;
    }, [report]);


    return (
        <div className="overflow-x-auto">
            <p className="text-sm text-gray-400 mb-4 text-center">
                <strong>{calculationDateText}</strong>
            </p>
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
                    {report.items.sort((a,b) => a.ingredientName.localeCompare(b.ingredientName)).map(item => (
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