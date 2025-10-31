import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getIngredients, getWithdrawals, saveWithdrawals } from '../services/db';
import type { Ingredient, Withdrawal, WithdrawalItem, UnitOfMeasure } from '../types';
import { generateId, formatCurrency } from '../lib/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchableStockItemSelect from '../components/SearchableStockItemSelect';
import PrintableWithdrawals from '../components/PrintableWithdrawals';
import { PackageMinus, PlusCircle, Trash2, Save, FileOutput, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const emptyFormState = {
    date: new Date().toISOString().split('T')[0],
    person: 'Patricio' as Withdrawal['person'],
    observations: '',
    items: [{ ingredientName: '', quantity: '1' }]
};

const WithdrawalPage: React.FC = () => {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [formState, setFormState] = useState(emptyFormState);
    const [expandedWithdrawal, setExpandedWithdrawal] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [ingredientsData, withdrawalsData] = await Promise.all([
                    getIngredients(),
                    getWithdrawals(),
                ]);
                setAllIngredients(ingredientsData);
                setWithdrawals(withdrawalsData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } catch (error) {
                console.error("Error fetching withdrawal data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const { costPerUnitMap, uniqueCanonicalNames } = useMemo(() => {
        const map = new Map<string, { cost: number, unit: UnitOfMeasure, id: string }>();
        const latestPurchases = new Map<string, Ingredient>();
        
        allIngredients.forEach(ing => {
            const name = ing.canonicalName || ing.name;
            const existing = latestPurchases.get(name);
            if (!existing || new Date(ing.purchaseDate || 0) > new Date(existing.purchaseDate || 0)) {
                latestPurchases.set(name, ing);
            }
        });
        
        latestPurchases.forEach((ing, name) => {
            map.set(name, { cost: ing.costPerUnit, unit: ing.unit, id: ing.id });
        });
        
        const names = [...new Set(allIngredients.map(i => i.canonicalName || i.name))].sort();
        
        return { costPerUnitMap: map, uniqueCanonicalNames: names };
    }, [allIngredients]);

    const handleFormChange = (field: keyof typeof formState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (index: number, field: 'ingredientName' | 'quantity', value: string) => {
        const newItems = [...formState.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormState(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setFormState(prev => ({ ...prev, items: [...prev.items, { ingredientName: '', quantity: '1' }] }));
    };

    const removeItem = (index: number) => {
        setFormState(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Validation
        if (!formState.date || !formState.person || formState.items.some(i => !i.ingredientName || !i.quantity || parseFloat(i.quantity) <= 0)) {
            alert("Por favor complete todos los campos requeridos. Cada artículo debe tener un insumo y una cantidad positiva.");
            setIsSaving(false);
            return;
        }

        const withdrawalItems: WithdrawalItem[] = formState.items.map(item => {
            const costInfo = costPerUnitMap.get(item.ingredientName);
            const quantity = parseFloat(item.quantity);
            const costPerUnit = costInfo?.cost || 0;
            return {
                ingredientId: costInfo?.id || '',
                ingredientName: item.ingredientName,
                quantity: quantity,
                unit: costInfo?.unit || 'unidad',
                costPerUnit: costPerUnit,
                totalCost: quantity * costPerUnit
            };
        });

        const newWithdrawal: Withdrawal = {
            id: generateId(),
            date: new Date(formState.date).toISOString(),
            person: formState.person,
            observations: formState.person === 'Otros' ? formState.observations : undefined,
            items: withdrawalItems,
            totalWithdrawalCost: withdrawalItems.reduce((acc, item) => acc + item.totalCost, 0)
        };

        const updatedWithdrawals = [newWithdrawal, ...withdrawals];
        await saveWithdrawals(updatedWithdrawals);
        setWithdrawals(updatedWithdrawals);
        setFormState(emptyFormState);
        setIsSaving(false);
    };

    const handleExport = async () => {
        const printableElement = document.querySelector('.printable-area');
        if (!printableElement || isExporting) return;

        setIsExporting(true);
        
        const clone = printableElement.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '0px';
        clone.style.width = '210mm';
        
        document.body.appendChild(clone);
        
        try {
            const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            document.body.removeChild(clone);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`retiro_mercaderia_historial.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF.");
            if (document.body.contains(clone)) document.body.removeChild(clone);
        } finally {
            setIsExporting(false);
        }
    };
    
    if (loading) {
        return <div className="text-center p-10">Cargando...</div>;
    }

    if (allIngredients.length === 0) {
        return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">No hay Insumos Cargados</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para poder registrar un retiro de mercadería, primero debe cargar insumos en la sección de "Insumos".
                </p>
            </Card>
        );
    }

    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-8 flex items-center"><PackageMinus className="mr-4"/>Retiro de Mercadería</h1>

            <Card className="mb-8">
                <h2 className="text-2xl font-bold text-brand mb-4">Registrar Nuevo Retiro</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Input label="Fecha del Retiro" type="date" value={formState.date} onChange={e => handleFormChange('date', e.target.value)} />
                    <Select label="Retirado por" value={formState.person} onChange={e => handleFormChange('person', e.target.value as Withdrawal['person'])}>
                        <option>Patricio</option>
                        <option>Mariano</option>
                        <option>Martin</option>
                        <option>Otros</option>
                    </Select>
                    {formState.person === 'Otros' && (
                         <Input label="Observaciones" value={formState.observations} onChange={e => handleFormChange('observations', e.target.value)} placeholder="Nombre, motivo, etc."/>
                    )}
                </div>

                <h3 className="text-xl font-semibold text-gray-300 mb-3 border-t border-accent pt-4">Artículos Retirados</h3>
                <div className="space-y-3">
                    {formState.items.map((item, index) => {
                         const costInfo = costPerUnitMap.get(item.ingredientName);
                         const quantity = parseFloat(item.quantity) || 0;
                         const totalCost = (costInfo?.cost || 0) * quantity;
                        return (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 bg-accent rounded-lg">
                                <div className="col-span-5">
                                    <SearchableStockItemSelect label="Insumo" items={uniqueCanonicalNames} value={item.ingredientName} onChange={val => handleItemChange(index, 'ingredientName', val)} />
                                </div>
                                <div className="col-span-2">
                                    <Input label="Cantidad" type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="0.01" step="0.01"/>
                                </div>
                                <div className="col-span-2">
                                     <label className="block text-sm font-medium text-gray-400 mb-1">Costo Unit.</label>
                                     <div className="w-full bg-primary/50 px-3 py-2 rounded-md h-[42px] flex items-center justify-end font-mono">
                                        {costInfo ? `${formatCurrency(costInfo.cost)} / ${costInfo.unit}`: '-'}
                                     </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Total</label>
                                     <div className="w-full bg-primary/50 px-3 py-2 rounded-md h-[42px] flex items-center justify-end font-mono">
                                        {formatCurrency(totalCost)}
                                     </div>
                                </div>
                                <div className="col-span-1">
                                    <Button variant="danger" onClick={() => removeItem(index)}><Trash2 size={16}/></Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="flex items-center justify-between mt-4">
                    <Button variant="secondary" onClick={addItem}><PlusCircle className="mr-2" size={16}/>Añadir Artículo</Button>
                    <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2" size={16}/>{isSaving ? 'Guardando...' : 'Guardar Retiro'}</Button>
                </div>
            </Card>

            <Card>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Historial de Retiros</h2>
                    <Button variant="secondary" onClick={handleExport} disabled={isExporting || withdrawals.length === 0}>
                        <FileOutput className="mr-2" size={16}/> {isExporting ? 'Exportando...' : 'Exportar a PDF'}
                    </Button>
                 </div>
                 <div className="space-y-3">
                    {withdrawals.length > 0 ? withdrawals.map(w => (
                        <div key={w.id} className="bg-accent rounded-lg">
                            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpandedWithdrawal(expandedWithdrawal === w.id ? null : w.id)}>
                                <div>
                                    <p className="font-semibold text-white">{new Date(w.date).toLocaleDateString('es-AR')} - Retirado por: <span className="text-brand">{w.person}</span></p>
                                    <p className="text-sm text-gray-400">{w.items.length} artículo(s)</p>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="text-sm text-gray-400">Costo Total</p>
                                        <p className="font-bold font-mono text-lg text-red-400">{formatCurrency(w.totalWithdrawalCost)}</p>
                                    </div>
                                    {expandedWithdrawal === w.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                </div>
                            </div>
                            {expandedWithdrawal === w.id && (
                                <div className="p-4 border-t border-primary">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-gray-400">
                                            <tr><th className="pb-2">Insumo</th><th className="pb-2 text-right">Cantidad</th><th className="pb-2 text-right">Costo Unit.</th><th className="pb-2 text-right">Costo Total</th></tr>
                                        </thead>
                                        <tbody>
                                            {w.items.map((item, i) => (
                                                <tr key={i} className="border-b border-primary/50 last:border-b-0">
                                                    <td className="py-2">{item.ingredientName}</td>
                                                    <td className="py-2 text-right font-mono">{item.quantity} {item.unit}</td>
                                                    <td className="py-2 text-right font-mono">{formatCurrency(item.costPerUnit)}</td>
                                                    <td className="py-2 text-right font-mono">{formatCurrency(item.totalCost)}</td>
                                                </tr>
                                            ))}
                                            {w.person === 'Otros' && w.observations && (
                                                <tr className="border-t-2 border-primary/80"><td colSpan={4} className="pt-3 text-gray-300 italic"><strong>Observaciones:</strong> {w.observations}</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )) : (
                        <p className="text-center text-gray-400 py-6">No hay retiros registrados.</p>
                    )}
                 </div>
            </Card>

            <div className="printable-area">
                <PrintableWithdrawals withdrawals={withdrawals} />
            </div>
        </div>
    );
};

export default WithdrawalPage;
