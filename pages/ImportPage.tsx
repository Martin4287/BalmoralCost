import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveProductPrices, saveProductSales, saveInternalConsumptions, getIngredients, getRecipes, getProductPrices, getProductSales, getInternalConsumptions, getRecipeHistory, getInventoryCounts, getMenuData, getMenuMappings, getGlobalWasteRate, getWithdrawals, getLowStockSettings } from '../services/db';
import type { ProductPrice, ProductSale } from '../types';
import { generateId } from '../lib/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FileUp, FileDown, AlertTriangle } from 'lucide-react';

const ImportPage: React.FC = () => {
    const [priceFile, setPriceFile] = useState<File | null>(null);
    const [salesFile, setSalesFile] = useState<File | null>(null);
    const [consumptionsFile, setConsumptionsFile] = useState<File | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setter(e.target.files[0]);
            setFeedback(null);
        }
    };

    const processFile = <T,>(file: File, expectedHeaders: string[], rowProcessor: (row: any) => T | null): Promise<T[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                    if (json.length === 0) {
                        return reject(new Error('El archivo está vacío.'));
                    }
                    
                    const headers = Object.keys(json[0]);
                    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
                    if (missingHeaders.length > 0) {
                        return reject(new Error(`Faltan las siguientes columnas requeridas: ${missingHeaders.join(', ')}`));
                    }
                    
                    const processedData = json.map(rowProcessor).filter((item): item is T => item !== null);
                    resolve(processedData);

                } catch (error) {
                    reject(new Error('Error al procesar el archivo. Asegúrese de que sea un formato válido.'));
                }
            };
            reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleImportPrices = async () => {
        if (!priceFile) return;
        setFeedback(null);
        try {
            const prices = await processFile<ProductPrice>(
                priceFile,
                ['NOMBRE', 'PVP'],
                (row) => ({
                    name: row['NOMBRE'],
                    salePrice: parseFloat(row['PVP']),
                    // Optional fields from one of the reports
                    rubro: row['RUBRO'],
                    codigo: row['CODIGO'],
                    grupoA: row['GRUPO A'],
                    grupoB: row['GRUPO B'],
                })
            );
            await saveProductPrices(prices);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${prices.length} registros de precios.` });
            setPriceFile(null);
        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error al importar precios: ${error.message}` });
        }
    };

    const handleImportSales = async () => {
        if (!salesFile) return;
        setFeedback(null);
        try {
            const sales = await processFile<ProductSale>(
                salesFile,
                ['FECHA', 'NOMBRE', 'CANTIDAD'],
                (row) => ({
                    id: generateId(),
                    date: new Date((row['FECHA'] - (25567 + 2)) * 86400 * 1000).toISOString(), // Excel date to JS date
                    name: row['NOMBRE'],
                    quantity: parseInt(row['CANTIDAD'], 10),
                })
            );
            await saveProductSales(sales);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${sales.length} registros de ventas.` });
            setSalesFile(null);
        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error al importar ventas: ${error.message}` });
        }
    };
    
    const handleImportConsumptions = async () => {
        if (!consumptionsFile) return;
        setFeedback(null);
        try {
            // This can reuse the ProductSale type and structure
            const consumptions = await processFile<ProductSale>(
                consumptionsFile,
                ['FECHA', 'NOMBRE', 'CANTIDAD', 'MESA'],
                (row) => ({
                    id: generateId(),
                    date: new Date((row['FECHA'] - (25567 + 2)) * 86400 * 1000).toISOString(),
                    name: row['NOMBRE'],
                    quantity: parseInt(row['CANTIDAD'], 10),
                    tableType: row['MESA'],
                })
            );
            await saveInternalConsumptions(consumptions);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${consumptions.length} registros de consumo interno.` });
            setConsumptionsFile(null);
        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error al importar consumos internos: ${error.message}` });
        }
    };
    
     const handleExportData = async () => {
        try {
            const allData = {
                ingredients: await getIngredients(),
                recipes: await getRecipes(),
                productPrices: await getProductPrices(),
                productSales: await getProductSales(),
                internalConsumptions: await getInternalConsumptions(),
                recipeHistory: await getRecipeHistory(),
                inventoryCounts: await getInventoryCounts(),
                menuData: await getMenuData(),
                menuMappings: await getMenuMappings(),
                globalWasteRate: await getGlobalWasteRate(),
                withdrawals: await getWithdrawals(),
                lowStockSettings: await getLowStockSettings(),
            };
            const jsonString = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `balmoralcost_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setFeedback({ type: 'success', message: '¡Copia de seguridad exportada con éxito!' });
        } catch (error) {
            console.error("Error exporting data:", error);
            setFeedback({ type: 'error', message: 'Hubo un error al exportar la copia de seguridad.' });
        }
    };


    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-8">Importar y Exportar Datos</h1>

            {feedback && (
                <Card className={`mb-6 ${feedback.type === 'error' ? 'border-l-4 border-red-500 bg-red-900/30' : 'border-l-4 border-green-500 bg-green-900/30'}`}>
                    <p className={feedback.type === 'error' ? 'text-red-300' : 'text-green-300'}>{feedback.message}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- IMPORT SECTION --- */}
                <Card>
                    <h2 className="text-2xl font-bold mb-4 flex items-center"><FileUp className="mr-3 text-brand"/>Importar Datos desde Excel</h2>
                    <div className="space-y-6">
                        {/* Prices Import */}
                        <div className="p-4 border border-accent rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200">1. Importar Precios de Venta</h3>
                            <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">NOMBRE</code>, <code className="bg-primary px-1 rounded">PVP</code>. Opcionales: <code className="bg-primary px-1 rounded">RUBRO</code>, <code className="bg-primary px-1 rounded">CODIGO</code>, etc.</p>
                            <div className="flex items-center gap-4 mt-3">
                                <input type="file" accept=".xlsx" onChange={handleFileChange(setPriceFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                <Button onClick={handleImportPrices} disabled={!priceFile}>Importar Precios</Button>
                            </div>
                        </div>

                        {/* Sales Import */}
                        <div className="p-4 border border-accent rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200">2. Importar Ventas</h3>
                            <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">FECHA</code>, <code className="bg-primary px-1 rounded">NOMBRE</code>, <code className="bg-primary px-1 rounded">CANTIDAD</code>. La fecha debe estar en formato de fecha de Excel.</p>
                             <div className="flex items-center gap-4 mt-3">
                                <input type="file" accept=".xlsx" onChange={handleFileChange(setSalesFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                <Button onClick={handleImportSales} disabled={!salesFile}>Importar Ventas</Button>
                            </div>
                        </div>
                        
                        {/* Internal Consumptions Import */}
                        <div className="p-4 border border-accent rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200">3. Importar Consumos Internos / Pérdidas</h3>
                            <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">FECHA</code>, <code className="bg-primary px-1 rounded">NOMBRE</code>, <code className="bg-primary px-1 rounded">CANTIDAD</code>, <code className="bg-primary px-1 rounded">MESA</code>.</p>
                             <div className="flex items-center gap-4 mt-3">
                                <input type="file" accept=".xlsx" onChange={handleFileChange(setConsumptionsFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                <Button onClick={handleImportConsumptions} disabled={!consumptionsFile}>Importar Consumos</Button>
                            </div>
                        </div>

                    </div>
                </Card>

                {/* --- EXPORT SECTION --- */}
                <Card>
                    <h2 className="text-2xl font-bold mb-4 flex items-center"><FileDown className="mr-3 text-brand"/>Exportar Datos</h2>
                     <div className="p-4 border border-accent rounded-lg">
                        <h3 className="font-semibold text-lg text-gray-200">Copia de Seguridad Completa</h3>
                        <p className="text-sm text-gray-400 mt-1 mb-4">
                            Exporte todos sus datos (ingredientes, recetas, ventas, etc.) a un único archivo JSON.
                            Este archivo puede ser utilizado para restaurar sus datos o migrarlos.
                        </p>
                        <Button onClick={handleExportData}>
                            <FileDown className="mr-2" size={18}/>
                            Exportar Copia de Seguridad
                        </Button>
                    </div>

                    <div className="mt-6 p-4 border-t border-accent">
                         <h3 className="font-semibold text-lg text-yellow-300 flex items-center"><AlertTriangle className="mr-2"/>¡Importante!</h3>
                         <p className="text-sm text-gray-400 mt-2">
                             La importación de datos <strong className="text-yellow-400">sobrescribirá</strong> cualquier dato existente del mismo tipo. Por ejemplo, al importar un nuevo archivo de precios, todos los precios anteriores serán reemplazados. Se recomienda hacer una copia de seguridad antes de importar datos nuevos.
                         </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ImportPage;
