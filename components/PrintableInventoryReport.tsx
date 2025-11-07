import React from 'react';
import type { InventoryCount } from '../types';
import { formatCurrency } from '../lib/helpers';

interface PrintableInventoryReportProps {
    report: InventoryCount;
}

const PrintableInventoryReport: React.FC<PrintableInventoryReportProps> = ({ report }) => {
    const totalVarianceCost = report.items.reduce((acc, item) => acc + item.costOfVariance, 0);

    const formatDateForDisplay = (dateString: string | undefined): string => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        // Adjust for timezone offset to prevent date from shifting
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-AR');
    };

    const calculationDateText = `Cálculo teórico del ${formatDateForDisplay(report.calculationStartDate)} al ${formatDateForDisplay(report.calculationDate)}`;

    return (
        <div className="bg-white text-slate-800 p-8 font-sans" style={{ width: '210mm' }}>
            <header className="border-b-4 border-slate-500 pb-4 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900">Reporte de Inventario Físico</h1>
                        <p className="text-sm text-slate-500 mt-2">
                            <strong>Realizado el:</strong> {new Date(report.date).toLocaleString('es-AR')}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            <strong>Período de Referencia:</strong> {calculationDateText}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 text-2xl font-bold text-slate-700">
                        Balmoral<span className="text-teal-600">Cost</span>
                    </div>
                </div>
            </header>

            <main>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b-2 border-slate-300 bg-slate-200">
                            <th className="text-left p-3 font-bold text-slate-600 w-2/6">Insumo</th>
                            <th className="text-right p-3 font-bold text-slate-600">Stock Teórico</th>
                            <th className="text-right p-3 font-bold text-slate-600">Stock Físico</th>
                            <th className="text-right p-3 font-bold text-slate-600">Varianza (Unidades)</th>
                            <th className="text-right p-3 font-bold text-slate-600">Varianza (Costo)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.items.sort((a,b) => a.ingredientName.localeCompare(b.ingredientName)).map((item, index) => (
                            <tr key={item.ingredientName} className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                <td className="p-2 font-medium text-slate-700">{item.ingredientName}</td>
                                <td className="text-right p-2 font-mono text-slate-800">{item.theoreticalQty.toFixed(3)} {item.unit}</td>
                                <td className="text-right p-2 font-mono text-slate-800">{item.physicalQty.toFixed(3)} {item.unit}</td>
                                <td className={`text-right p-2 font-mono font-semibold ${item.varianceQty === 0 ? 'text-slate-800' : item.varianceQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.varianceQty.toFixed(3)} {item.unit}
                                </td>
                                <td className={`text-right p-2 font-mono font-semibold ${item.costOfVariance === 0 ? 'text-slate-800' : item.costOfVariance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(item.costOfVariance)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-4 border-slate-300 bg-slate-200">
                            <td colSpan={4} className="p-3 font-bold text-right text-lg text-slate-700">Total Varianza de Inventario:</td>
                            <td className={`p-3 text-right font-mono font-bold text-lg ${totalVarianceCost === 0 ? 'text-slate-800' : totalVarianceCost > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(totalVarianceCost)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </main>
             <footer className="text-center text-xs text-slate-400 mt-12 pt-4 border-t border-slate-200">
                Reporte generado por BalmoralCost el {new Date().toLocaleDateString('es-AR')}
            </footer>
        </div>
    );
};

export default PrintableInventoryReport;
