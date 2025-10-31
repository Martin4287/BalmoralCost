import React from 'react';
import type { Withdrawal } from '../types';
import { formatCurrency } from '../lib/helpers';

interface PrintableWithdrawalsProps {
    withdrawals: Withdrawal[];
}

const PrintableWithdrawals: React.FC<PrintableWithdrawalsProps> = ({ withdrawals }) => {
    return (
        <div className="bg-white text-slate-800 p-8 font-sans" style={{ width: '210mm' }}>
            <header className="border-b-4 border-slate-500 pb-4 mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900">Historial de Retiro de Mercadería</h1>
                <p className="text-sm text-slate-500 mt-2">Reporte generado el {new Date().toLocaleDateString('es-AR')}</p>
            </header>

            <main className="space-y-8">
                {withdrawals.map(withdrawal => (
                    <section key={withdrawal.id} className="border border-slate-300 rounded-lg p-4 break-inside-avoid">
                        <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Retiro ID: <span className="font-mono text-slate-600">{withdrawal.id.substring(0, 8)}</span></h2>
                                <p className="text-sm text-slate-600"><strong>Fecha:</strong> {new Date(withdrawal.date).toLocaleString('es-AR')}</p>
                                <p className="text-sm text-slate-600"><strong>Retirado por:</strong> {withdrawal.person}</p>
                                {withdrawal.person === 'Otros' && withdrawal.observations && (
                                     <p className="text-sm text-slate-600"><strong>Observaciones:</strong> {withdrawal.observations}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-600">Costo Total del Retiro</p>
                                <p className="text-xl font-bold text-red-600">{formatCurrency(withdrawal.totalWithdrawalCost)}</p>
                            </div>
                        </div>

                        <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="p-2 text-left font-bold text-slate-600">Insumo</th>
                                    <th className="p-2 text-right font-bold text-slate-600">Cantidad</th>
                                    <th className="p-2 text-right font-bold text-slate-600">Costo Unitario</th>
                                    <th className="p-2 text-right font-bold text-slate-600">Costo Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawal.items.map((item, index) => (
                                    <tr key={index} className="border-b border-slate-200">
                                        <td className="p-2 text-slate-800">{item.ingredientName}</td>
                                        <td className="p-2 text-right font-mono text-slate-800">{item.quantity} {item.unit}</td>
                                        <td className="p-2 text-right font-mono text-slate-800">{formatCurrency(item.costPerUnit)}</td>
                                        <td className="p-2 text-right font-mono text-slate-800">{formatCurrency(item.totalCost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                ))}
            </main>
        </div>
    );
};

export default PrintableWithdrawals;