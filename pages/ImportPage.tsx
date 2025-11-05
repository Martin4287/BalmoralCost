import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
    saveProductPrices, saveProductSales, saveInternalConsumptions, getIngredients, 
    getRecipes, getProductPrices, getProductSales, getInternalConsumptions, 
    getRecipeHistory, getInventoryCounts, getMenuData, getMenuMappings, 
    getGlobalWasteRate, getWithdrawals, getLowStockSettings, saveIngredients, 
    saveRecipes, saveRecipeHistory, saveInventoryCounts, saveMenuData, 
    saveMenuMappings, saveGlobalWasteRate, saveWithdrawals, saveLowStockSettings 
} from '../services/db';
import type { ProductPrice, ProductSale, Ingredient, UnitOfMeasure } from '../types';
import { generateId } from '../lib/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { FileUp, FileDown, AlertTriangle, UploadCloud } from 'lucide-react';

const ImportPage: React.FC = () => {
    const [priceFile, setPriceFile] = useState<File | null>(null);
    const [salesFile, setSalesFile] = useState<File | null>(null);
    const [consumptionsFile, setConsumptionsFile] = useState<File | null>(null);
    const [purchasesFile, setPurchasesFile] = useState<File | null>(null);
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [salesDate, setSalesDate] = useState<string>(new Date().toISOString().split('T')[0]);

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
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
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

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // Use header: 1 to get array of arrays for robust header parsing
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (rows.length < 2) {
                    throw new Error('El archivo está vacío o no tiene filas de datos.');
                }

                const originalHeaders: string[] = rows[0].map(h => String(h));
                const trimmedHeaders: string[] = originalHeaders.map(h => h.trim());
                
                const findHeaderIndex = (possibleNames: (string | RegExp)[]) => {
                    for (const name of possibleNames) {
                        const foundIndex = trimmedHeaders.findIndex((h, i) => {
                            if (typeof name === 'string') {
                                return h.toLowerCase() === name.toLowerCase();
                            }
                            // For regex, test against the original, untrimmed header
                            return name.test(originalHeaders[i]);
                        });
                        if (foundIndex !== -1) return foundIndex;
                    }
                    return -1;
                };
                
                const salonHeaderRegex = /SALON\s*IVA:S\s*Inhab:N/;

                const rubroIndex = findHeaderIndex(['Rubro']);
                const descIndex = findHeaderIndex(['Descripcion', 'Descripción']);
                const codigoIndex = findHeaderIndex(['Código', 'Codigo']);
                const grupoAIndex = findHeaderIndex(['Grupo A']);
                const grupoBIndex = findHeaderIndex(['Grupo B']);
                const salonIndex = findHeaderIndex([salonHeaderRegex]);
                
                const missing = [];
                if (rubroIndex === -1) missing.push('Rubro');
                if (descIndex === -1) missing.push('Descripcion/Descripción');
                if (codigoIndex === -1) missing.push('Código/Codigo');
                if (salonIndex === -1) missing.push('Columna de precios (SALON...)');

                if (missing.length > 0) {
                    throw new Error(`Faltan las siguientes columnas o no coinciden: ${missing.join(', ')}`);
                }

                const dataRows = rows.slice(1);
                
                const prices: ProductPrice[] = dataRows.map((row): ProductPrice | null => {
                    const salePriceVal = row[salonIndex];
                    const salePrice = typeof salePriceVal === 'string' 
                        ? parseFloat(salePriceVal.replace(',', '.')) 
                        : parseFloat(salePriceVal);
                    
                    if (!row[descIndex] || isNaN(salePrice)) {
                        return null;
                    }
                    return {
                        name: String(row[descIndex]),
                        salePrice: salePrice,
                        rubro: String(row[rubroIndex]),
                        codigo: String(row[codigoIndex]),
                        grupoA: grupoAIndex !== -1 ? String(row[grupoAIndex]) : undefined,
                        grupoB: grupoBIndex !== -1 ? String(row[grupoBIndex]) : undefined,
                    };
                }).filter((item): item is ProductPrice => item !== null);

                if (prices.length === 0 && dataRows.length > 0) {
                    throw new Error("No se pudo procesar ninguna fila. Verifique el formato de los datos, especialmente los precios.");
                }

                await saveProductPrices(prices);
                setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${prices.length} registros de precios.` });
                setPriceFile(null);

            } catch (error: any) {
                setFeedback({ type: 'error', message: `Error al importar precios: ${error.message}` });
            }
        };

        reader.onerror = () => {
            setFeedback({ type: 'error', message: 'No se pudo leer el archivo. Verifique que no esté dañado o bloqueado.' });
        };
        
        reader.readAsArrayBuffer(priceFile);
    };

    const handleImportSales = async () => {
        if (!salesFile) return;
        setFeedback(null);
        try {
            const sales = await processFile<ProductSale>(
                salesFile,
                ['DESCRIPCION', 'CANTIDAD'],
                (row) => ({
                    id: generateId(),
                    date: new Date(salesDate).toISOString(),
                    name: row['DESCRIPCION'],
                    quantity: parseInt(row['CANTIDAD'], 10),
                })
            );
            await saveProductSales(sales);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${sales.length} registros de ventas para la fecha ${new Date(salesDate).toLocaleDateString('es-AR')}.` });
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
                ['FECHA_APERTURA', 'PRODUCTO', 'CANTIDAD', 'TIPO_MESA'],
                (row) => {
                    const dateValue = row['FECHA_APERTURA'];
                    let dateStr: string;

                    if (dateValue instanceof Date) {
                        dateStr = dateValue.toISOString();
                    } else if (typeof dateValue === 'number') {
                        // Fallback for Excel numeric dates if cellDates:true fails
                        dateStr = new Date((dateValue - 25569) * 86400 * 1000).toISOString();
                    } else if (typeof dateValue === 'string') {
                        // Attempt to parse string dates
                        dateStr = new Date(dateValue).toISOString();
                    } else {
                        // If date is invalid, skip the row
                        console.warn('Invalid date format for row:', row);
                        return null;
                    }
                    
                    return {
                        id: generateId(),
                        date: dateStr,
                        name: row['PRODUCTO'],
                        quantity: parseInt(row['CANTIDAD'], 10),
                        tableType: row['TIPO_MESA'],
                    }
                }
            );
            await saveInternalConsumptions(consumptions);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${consumptions.length} registros de consumo interno.` });
            setConsumptionsFile(null);
        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error al importar consumos internos: ${error.message}` });
        }
    };

     const handleImportPurchases = async () => {
        if (!purchasesFile) return;
        setFeedback(null);
        try {
            const existingIngredients = await getIngredients();
            const nameToCanonicalMap = new Map<string, string>();
            existingIngredients.forEach(ing => {
                if(ing.canonicalName) {
                    nameToCanonicalMap.set(ing.name.toLowerCase(), ing.canonicalName);
                }
            });

            const newIngredients = await processFile<Ingredient>(
                purchasesFile,
                ['Producto', 'Proveedor', 'Fecha de Factura', 'Cantidad', 'Unidad', 'Precio Unitario'],
                (row): Ingredient | null => {
                    const name = row['Producto'];
                    const quantity = parseFloat(row['Cantidad']);
                    const cost = parseFloat(row['Precio Unitario']);

                    if (!name || isNaN(quantity) || isNaN(cost) || quantity <= 0 || cost <= 0) {
                        return null; // Skip invalid rows
                    }

                    const unitStr = String(row['Unidad'] || 'unidad').toLowerCase();
                    let unit: UnitOfMeasure;
                    if (unitStr.startsWith('kg') || unitStr.startsWith('kilo')) unit = 'kg';
                    else if (unitStr.startsWith('g')) unit = 'g';
                    else if (unitStr.startsWith('l')) unit = 'l';
                    else if (unitStr.startsWith('ml')) unit = 'ml';
                    else unit = 'unidad';

                    const dateValue = row['Fecha de Factura'];
                    let dateStr: string;
                    if (dateValue instanceof Date) {
                        dateStr = dateValue.toISOString();
                    } else {
                        dateStr = new Date().toISOString(); // Default to now if date is invalid
                    }

                    return {
                        id: generateId(),
                        name: name,
                        supplier: row['Proveedor'] || 'N/A',
                        purchaseDate: dateStr,
                        purchaseQuantity: quantity,
                        unit: unit,
                        costPerUnit: cost,
                        // Automatically assign existing canonical name if found
                        canonicalName: nameToCanonicalMap.get(name.toLowerCase()) || undefined,
                    };
                }
            );
            await saveIngredients([...existingIngredients, ...newIngredients]);
            setFeedback({ type: 'success', message: `¡Éxito! Se importaron ${newIngredients.length} nuevos registros de compra.` });
            setPurchasesFile(null);
        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error al importar compras: ${error.message}` });
        }
    };
    
    const handleExportData = async () => {
        try {
            setFeedback(null);
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

    const handleImportBackup = async () => {
        if (!backupFile) return;
        setFeedback(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);

                // Basic validation to check if it's a valid backup file
                const requiredKeys = ['ingredients', 'recipes', 'productPrices', 'productSales', 'internalConsumptions', 'recipeHistory', 'inventoryCounts', 'menuData', 'menuMappings', 'globalWasteRate', 'withdrawals', 'lowStockSettings'];
                const missingKeys = requiredKeys.filter(key => !(key in data));
                if (missingKeys.length > 0) {
                    throw new Error(`Archivo de backup inválido o corrupto. Faltan datos para: ${missingKeys.join(', ')}`);
                }

                // Save all data, overwriting existing data
                await Promise.all([
                    saveIngredients(data.ingredients || []),
                    saveRecipes(data.recipes || []),
                    saveProductPrices(data.productPrices || []),
                    saveProductSales(data.productSales || []),
                    saveInternalConsumptions(data.internalConsumptions || []),
                    saveRecipeHistory(data.recipeHistory || []),
                    saveInventoryCounts(data.inventoryCounts || []),
                    saveMenuData(data.menuData || null),
                    saveMenuMappings(data.menuMappings || {}),
                    saveGlobalWasteRate(data.globalWasteRate || 0),
                    saveWithdrawals(data.withdrawals || []),
                    saveLowStockSettings(data.lowStockSettings || {})
                ]);
                
                alert('¡Copia de seguridad importada con éxito! La aplicación se recargará para aplicar los cambios.');
                window.location.reload();

            } catch (error: any) {
                setFeedback({ type: 'error', message: `Error al importar la copia de seguridad: ${error.message}` });
            }
        };
        reader.onerror = () => setFeedback({ type: 'error', message: 'No se pudo leer el archivo.' });
        reader.readAsText(backupFile);
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
                <div className="space-y-8">
                    <Card>
                        <h2 className="text-2xl font-bold mb-4 flex items-center"><FileUp className="mr-3 text-brand"/>Importar Datos desde Excel</h2>
                        <div className="space-y-6">
                            {/* Prices Import */}
                            <div className="p-4 border border-accent rounded-lg">
                                <h3 className="font-semibold text-lg text-gray-200">1. Importar Precios de Venta</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    Suba un archivo .xlsx con las columnas requeridas: 
                                    <code className="bg-primary px-1 rounded mx-1">Rubro</code>, 
                                    <code className="bg-primary px-1 rounded mx-1">Descripcion</code>, 
                                    <code className="bg-primary px-1 rounded mx-1">Código</code>, 
                                    y una columna de precio con el encabezado multi-línea exacto:
                                    <pre className="inline-block bg-primary px-2 py-1 rounded mx-1 text-xs my-1">{'SALON\nIVA:S\nInhab:N'}</pre>.
                                    Opcionales: <code className="bg-primary px-1 rounded mx-1">Grupo A</code>, <code className="bg-primary px-1 rounded mx-1">Grupo B</code>.
                                </p>
                                <div className="flex items-center gap-4 mt-3">
                                    <input type="file" accept=".xlsx" onChange={handleFileChange(setPriceFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                    <Button onClick={handleImportPrices} disabled={!priceFile}>Importar Precios</Button>
                                </div>
                            </div>

                            {/* Sales Import */}
                            <div className="p-4 border border-accent rounded-lg">
                                <h3 className="font-semibold text-lg text-gray-200">2. Importar Ventas</h3>
                                <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">DESCRIPCION</code>, <code className="bg-primary px-1 rounded">CANTIDAD</code>. Seleccione la fecha correspondiente al reporte.</p>
                                <div className="flex items-center gap-4 mt-3">
                                    <input type="file" accept=".xlsx" onChange={handleFileChange(setSalesFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                    <div className="flex-shrink-0">
                                       <Input label="Fecha del Reporte" type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} />
                                    </div>
                                    <Button onClick={handleImportSales} disabled={!salesFile}>Importar Ventas</Button>
                                </div>
                            </div>
                            
                            {/* Internal Consumptions Import */}
                            <div className="p-4 border border-accent rounded-lg">
                                <h3 className="font-semibold text-lg text-gray-200">3. Importar Consumos Internos / Pérdidas</h3>
                                <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">FECHA_APERTURA</code>, <code className="bg-primary px-1 rounded">PRODUCTO</code>, <code className="bg-primary px-1 rounded">CANTIDAD</code>, <code className="bg-primary px-1 rounded">TIPO_MESA</code>.</p>
                                <div className="flex items-center gap-4 mt-3">
                                    <input type="file" accept=".xlsx" onChange={handleFileChange(setConsumptionsFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                    <Button onClick={handleImportConsumptions} disabled={!consumptionsFile}>Importar Consumos</Button>
                                </div>
                            </div>
                            
                            {/* Purchases Import */}
                            <div className="p-4 border border-accent rounded-lg">
                                <h3 className="font-semibold text-lg text-gray-200">4. Importar Compras de Insumos</h3>
                                <p className="text-sm text-gray-400 mt-1">Suba un archivo .xlsx con las columnas: <code className="bg-primary px-1 rounded">Producto</code>, <code className="bg-primary px-1 rounded">Proveedor</code>, <code className="bg-primary px-1 rounded">Fecha de Factura</code>, <code className="bg-primary px-1 rounded">Cantidad</code>, <code className="bg-primary px-1 rounded">Unidad</code>, <code className="bg-primary px-1 rounded">Precio Unitario</code>.</p>
                                <div className="flex items-center gap-4 mt-3">
                                    <input type="file" accept=".xlsx" onChange={handleFileChange(setPurchasesFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                    <Button onClick={handleImportPurchases} disabled={!purchasesFile}>Importar Compras</Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
                {/* --- BACKUP SECTION --- */}
                 <div className="space-y-8">
                    <Card>
                        <h2 className="text-2xl font-bold mb-4 flex items-center"><UploadCloud className="mr-3 text-brand"/>Copia de Seguridad (JSON)</h2>
                        
                        {/* Import from Backup */}
                        <div className="p-4 border border-accent rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200">Importar desde Copia de Seguridad</h3>
                            <p className="text-sm text-gray-400 mt-1">Restaure todos sus datos desde un archivo <code className="bg-primary px-1 rounded">.json</code> exportado previamente.</p>
                            <div className="mt-2 p-2 border border-yellow-500/50 bg-yellow-900/20 rounded-md text-yellow-300 text-xs flex items-center gap-2">
                                <AlertTriangle size={16}/>
                                <strong>Atención:</strong> Esta acción sobrescribirá todos los datos existentes en la aplicación.
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                                <input type="file" accept=".json" onChange={handleFileChange(setBackupFile)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-teal-600"/>
                                <Button onClick={handleImportBackup} disabled={!backupFile}>Importar Backup</Button>
                            </div>
                        </div>

                        {/* Export Backup */}
                        <div className="mt-6 p-4 border border-accent rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200">Exportar Copia de Seguridad Completa</h3>
                            <p className="text-sm text-gray-400 mt-1 mb-4">
                                Exporte todos sus datos (ingredientes, recetas, ventas, configuraciones, etc.) a un único archivo JSON.
                                Guarde este archivo en un lugar seguro.
                            </p>
                            <Button onClick={handleExportData}>
                                <FileDown className="mr-2" size={18}/>
                                Exportar Copia de Seguridad
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ImportPage;