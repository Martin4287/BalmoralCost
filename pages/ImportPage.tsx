import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
// FIX: Add missing `getProductSales` import.
import { getIngredients, saveIngredients, getRecipes, saveRecipes, getProductSales, saveProductPrices, saveProductSales, getInternalConsumptions, saveInternalConsumptions, getInventoryCounts, saveInventoryCounts, saveMenuData, getWithdrawals } from '../services/db';
import type { Ingredient, Recipe, ProductPrice, ProductSale, RecipeIngredient, InventoryCount, InventoryCountItem, UnitOfMeasure, MenuData, MenuItem } from '../types';
import { generateId } from '../lib/helpers';
import { UploadCloud, FileText, CheckCircle, AlertCircle, ListOrdered, DownloadCloud, DatabaseBackup, Sparkles } from 'lucide-react';
import { calculateRecipeCost, calculateStockData } from '../services/calculation';
import { VAT_RATE } from '../lib/constants';
import { GoogleGenAI, Type } from "@google/genai";

type ImportStatus = 'idle' | 'success' | 'error';
interface FileImportResult {
    status: ImportStatus;
    message: string;
    details?: string;
}

// Define all possible price headers. The key is what we'll store, the value is the expected header text.
const priceColumnDefinitions = {
    'SALON': 'SALON\nIVA:S\nInhab:N',
    'DELIVERY': 'DELIVERY\nIVA:S\nInhab:N',
    'LISTA MAGISTRADOS': 'LISTA MAGISTRADOS\nIVA:S\nInhab:N',
    'SINDEFINIR': 'SINDEFINIR\nIVA:S\nInhab:S'
};

// --- Reusable File Input Component ---
const FileInput: React.FC<{
    id: string;
    file: File | null;
    onFileChange: (file: File | null) => void;
}> = ({ id, file, onFileChange }) => (
     <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
        <div className="space-y-1 text-center">
            <UploadCloud className="mx-auto h-12 w-12 text-gray-500" />
            <div className="flex text-sm text-gray-400">
                <label htmlFor={id} className="relative cursor-pointer bg-secondary rounded-md font-medium text-brand hover:text-teal-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-secondary focus-within:ring-brand px-1">
                    <span>Seleccione un archivo</span>
                    <input id={id} name={id} type="file" className="sr-only" accept=".xlsx" onChange={e => onFileChange(e.target.files ? e.target.files[0] : null)} />
                </label>
                <p className="pl-1">o arrástrelo aquí</p>
            </div>
            {file ? (
                <p className="text-xs text-gray-500 flex items-center justify-center mt-2">
                    <FileText size={14} className="mr-1" /> {file.name}
                </p>
            ) : (
                <p className="text-xs text-gray-500">Solo archivos XLSX</p>
            )}
        </div>
    </div>
);

// --- Reusable Result Message Component ---
const ResultMessage: React.FC<{ result: FileImportResult }> = ({ result }) => {
    if (result.status === 'idle') return null;
    const isSuccess = result.status === 'success';
    const Icon = isSuccess ? CheckCircle : AlertCircle;
    const color = isSuccess ? 'text-green-400' : 'text-red-400';

    return (
        <div className={`mt-4 p-3 rounded-md text-sm ${isSuccess ? 'bg-green-900/50' : 'bg-red-900/50'} ${color}`}>
            <div className="flex items-center">
                 <Icon className="mr-2 flex-shrink-0" size={18} />
                 <span className="font-semibold">{result.message}</span>
            </div>
            {result.details && <p className="mt-1 pl-7 text-xs">{result.details}</p>}
        </div>
    );
};

/**
 * Parses a number that could be in a Spanish locale format (e.g., "14.932,13")
 * or a standard format (e.g., "14932.13").
 * @param value The value from the XLSX file.
 * @returns The parsed number.
 */
const parseSpanishNumber = (value: any): number => {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value !== 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    const str = value.trim();

    const lastCommaIndex = str.lastIndexOf(',');
    const lastDotIndex = str.lastIndexOf('.');

    // Case: "14.932,13" - European/South American style where comma is the decimal separator.
    if (lastCommaIndex > lastDotIndex) {
        const cleanedStr = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanedStr) || 0;
    }
    
    // Case: "14,932.13" or "14932.13" - US/UK style or no separators, where dot is the decimal separator.
    if (lastDotIndex > lastCommaIndex) {
        const cleanedStr = str.replace(/,/g, '');
        return parseFloat(cleanedStr) || 0;
    }

    // Case: "14932" or simple strings without separators.
    return parseFloat(str) || 0;
};


// --- Main Import/Export Logic ---
const ImportPage: React.FC = () => {
    const [isExportingIngredients, setIsExportingIngredients] = useState(false);
    const [isExportingRecipes, setIsExportingRecipes] = useState(false);
    const [isExportingInventory, setIsExportingInventory] = useState(false);
    const [isExportingStock, setIsExportingStock] = useState(false);
    
    // State for AI menu import
    const [menuFiles, setMenuFiles] = useState<File[]>([]);
    const [menuAIResult, setMenuAIResult] = useState<FileImportResult>({ status: 'idle', message: '' });
    const [isImportingMenuAI, setIsImportingMenuAI] = useState(false);
    
    const [salesImportDate, setSalesImportDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Generic file reader and parser
    const processXLSX = <T,>(file: File, sheetName: string | null, requiredHeaders: string[], rowParser: (row: any) => T | null): Promise<T[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const targetSheetName = sheetName ?? workbook.SheetNames[0];
                    if (!workbook.SheetNames.includes(targetSheetName)) {
                        return reject(new Error(`El archivo no contiene la pestaña requerida: "${targetSheetName}".`));
                    }
                    
                    const worksheet = workbook.Sheets[targetSheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                    if (jsonData.length === 0) {
                        return resolve([]);
                    }

                    // Normalize headers from the file for robust comparison
                    const fileHeaders = Object.keys(jsonData[0]);
                    const normalize = (h: string) => h.toString().trim().replace(/\s+/g, ' ');
                    const normalizedFileHeaders = fileHeaders.map(normalize);

                    const missingHeaders = requiredHeaders.filter(required => {
                        return !normalizedFileHeaders.includes(normalize(required));
                    });

                    if (missingHeaders.length > 0) {
                        return reject(new Error(`Faltan las siguientes columnas requeridas: ${missingHeaders.map(normalize).join(', ')}.`));
                    }
                    
                    // Remap JSON data to have normalized headers, so rowParser is simpler
                    const remappedData = jsonData.map(row => {
                        const newRow: {[key: string]: any} = {};
                        Object.keys(row).forEach(key => {
                            newRow[normalize(key)] = row[key];
                        });
                        return newRow;
                    });

                    const parsedData = remappedData.map(rowParser).filter((item): item is T => item !== null);
                    resolve(parsedData);

                } catch (error) {
                    reject(new Error("Error al leer o procesar el archivo XLSX."));
                }
            };
            reader.onerror = () => reject(new Error("Error al leer el archivo."));
            reader.readAsArrayBuffer(file);
        });
    };

    // State and handlers for each import type
    const createImportHandler = <T,>(
        title: string,
        requiredHeaders: string[],
        rowParser: (row: any) => T | null,
        dbSaver: (data: T[]) => Promise<any>,
        sheetName: string | null = null,
        postProcess?: (data: T[]) => Promise<{ message: string, details?: string }>
    ) => {
        const [file, setFile] = useState<File | null>(null);
        const [result, setResult] = useState<FileImportResult>({ status: 'idle', message: '' });
        const [isImporting, setIsImporting] = useState(false);

        const handleImport = async () => {
            if (!file) return;
            setIsImporting(true);
            setResult({ status: 'idle', message: '' });

            try {
                const parsedData = await processXLSX(file, sheetName, requiredHeaders, rowParser);
                
                // FIX: Pass title to createImportHandler to make it available here.
                if (parsedData.length > 0 || (title === "Importar Conteo de Inventario Físico" && parsedData)) { // Allow empty inventory file to zero out stock
                    if (postProcess) {
                        const postProcessResult = await postProcess(parsedData);
                        setResult({ status: 'success', ...postProcessResult });
                    } else {
                        await dbSaver(parsedData as any);
                        setResult({ status: 'success', message: 'Importación completada con éxito.', details: `Se importaron ${parsedData.length} registros.` });
                    }
                } else {
                    setResult({ status: 'error', message: 'No se encontraron datos válidos en el archivo.', details: 'Verifique que el archivo no esté vacío y que los datos cumplan el formato esperado.' });
                }
            } catch (error: any) {
                setResult({ status: 'error', message: 'Error en la importación.', details: error.message });
            } finally {
                setIsImporting(false);
            }
        };

        return { file, setFile, result, isImporting, handleImport };
    };

    const normalize = (h: string) => h.toString().trim().replace(/\s+/g, ' ');

    // Prices Import
    const pricesHandler = createImportHandler<ProductPrice>(
        'Precios de Venta',
        ['Descripcion', priceColumnDefinitions.SALON],
        (row) => { // row has normalized keys now
            const name = row[normalize('Descripcion')]?.toString().trim();
            const salePrice = parseSpanishNumber(row[normalize(priceColumnDefinitions.SALON)]);

            if (!name || isNaN(salePrice)) return null;

            const otherPrices: Record<string, number> = {};
            for (const [key, headerText] of Object.entries(priceColumnDefinitions)) {
                if (key === 'SALON') continue; // Already handled
                
                const normalizedHeader = normalize(headerText);
                if (row[normalizedHeader] !== undefined) {
                     const price = parseSpanishNumber(row[normalizedHeader]);
                     if (!isNaN(price)) {
                         otherPrices[key] = price;
                     }
                }
            }
            
            const codigo = row[normalize('Código')]?.toString().trim() || row[normalize('Codigo')]?.toString().trim();

            return { 
                name, 
                salePrice,
                otherPrices: Object.keys(otherPrices).length > 0 ? otherPrices : undefined,
                rubro: row[normalize('Rubro')]?.toString().trim(),
                codigo: codigo,
                grupoA: row[normalize('Grupo A')]?.toString().trim(),
                grupoB: row[normalize('Grupo B')]?.toString().trim(),
             };
        },
        saveProductPrices
    );

    // Sales Import
    const salesHandler = createImportHandler<Partial<ProductSale>>(
        'Cantidades Vendidas',
        ['DESCRIPCION', 'CANTIDAD'],
        (row) => {
            const name = row[normalize('DESCRIPCION')]?.toString().trim();
            const quantity = parseSpanishNumber(row[normalize('CANTIDAD')]);
            if (!name || isNaN(quantity)) return null;
            return { name, quantity };
        },
        async () => {}, // Handled by postProcess
        null,
        async (newSalesData) => {
            const existingSales = await getProductSales();
            const processedNewSales = newSalesData.map(sale => ({
                id: generateId(),
                date: new Date(salesImportDate).toISOString(),
                name: sale.name!,
                quantity: sale.quantity!,
            }));
            await saveProductSales([...existingSales, ...processedNewSales]);
            return {
                message: "Ventas importadas con éxito.",
                details: `${processedNewSales.length} nuevos registros de venta añadidos a la fecha ${new Date(salesImportDate).toLocaleDateString('es-AR')}.`
            };
        }
    );

    // Ingredients Import
    const ingredientsHandler = createImportHandler<Partial<Ingredient>>(
        'Insumos',
        ['Producto', 'Proveedor', 'Fecha de Factura', 'Cantidad', 'Unidad', 'Precio Unitario'],
        (row) => {
            const name = row[normalize('Producto')]?.toString().trim();
            const supplier = row[normalize('Proveedor')]?.toString().trim();
            
            let purchaseDate: string | undefined;
            const dateValue = row[normalize('Fecha de Factura')];
            if (dateValue) {
                if (typeof dateValue === 'number') {
                    purchaseDate = new Date(Date.UTC(0, 0, dateValue - 1)).toISOString();
                } else {
                    const parsed = new Date(dateValue);
                    if (!isNaN(parsed.getTime())) {
                        purchaseDate = parsed.toISOString();
                    }
                }
            }

            const unit = row[normalize('Unidad')]?.toString().trim().toLowerCase();
            const costPerUnit = parseSpanishNumber(row[normalize('Precio Unitario')]);
            const purchaseQuantity = parseSpanishNumber(row[normalize('Cantidad')]);
            const validUnits = ['kg', 'g', 'l', 'ml', 'unidad'];
            if (!name || !unit || !validUnits.includes(unit) || isNaN(costPerUnit) || isNaN(purchaseQuantity) || purchaseQuantity <= 0) return null;
            
            return { name, unit: unit as Ingredient['unit'], costPerUnit, purchaseQuantity, supplier, purchaseDate };
        },
        async () => {}, // DB saving is handled by postProcess
        null,
        async (newIngredientsData) => {
            const existingIngredients = await getIngredients();

            // Build mapping from existing ingredients
            const nameMappings = new Map<string, string>();
            existingIngredients.forEach(ing => {
                if (ing.name && ing.canonicalName) {
                    nameMappings.set(ing.name.toLowerCase(), ing.canonicalName);
                }
            });

            // Process new ingredients, applying existing mappings
            const processedNewIngredients = newIngredientsData.map(ing => {
                const canonicalName = ing.name ? nameMappings.get(ing.name.toLowerCase()) : undefined;
                return {
                    ...ing,
                    id: generateId(),
                    canonicalName: canonicalName
                } as Ingredient;
            });
        
            const allIngredients = [...existingIngredients, ...processedNewIngredients];
            await saveIngredients(allIngredients);
        
            return {
                message: "Insumos importados con éxito.",
                details: `${processedNewIngredients.length} nuevos registros de compra de insumos añadidos.`
            };
        }
    );
    
    // Recipes Import
    const recipesHandler = createImportHandler<any>(
        'Recetas',
        ['Nombre Receta', 'Categoría', 'Rendimiento', 'Precio Venta', 'Ingrediente', 'Cantidad', 'Unidad Medida'],
        (row) => row, // Parse as is, logic will be in postProcess
        async () => {},
        'Recetas',
        async (rows) => {
            const existingRecipes = await getRecipes();
            const existingIngredients = await getIngredients();
            const newRecipes: Recipe[] = [];
            const createdIngredients: Ingredient[] = [];
            const missingIngredientsNames = new Set<string>();
            
            const normalizedRows = rows.map(row => {
                 const newRow: {[key: string]: any} = {};
                 Object.keys(row).forEach(key => {
                     newRow[normalize(key)] = row[key];
                 });
                 return newRow;
            });

            const recipesData = new Map<string, any[]>();
            normalizedRows.forEach(row => {
                const name = row[normalize('Nombre Receta')]?.toString().trim();
                if (!name) return;
                if (!recipesData.has(name)) recipesData.set(name, []);
                recipesData.get(name)?.push(row);
            });

            for (const [name, ingredientsRows] of recipesData.entries()) {
                if (existingRecipes.some(r => r.name.toLowerCase() === name.toLowerCase())) continue;

                const firstRow = ingredientsRows[0];
                const newRecipe: Recipe = {
                    id: generateId(),
                    name,
                    category: firstRow[normalize('Categoría')]?.toString().trim() || 'Sin Analizar',
                    yield: parseInt(firstRow[normalize('Rendimiento')]) || 1,
                    salePrice: parseFloat(firstRow[normalize('Precio Venta')]) || 0,
                    notes: firstRow[normalize('Notas')]?.toString().trim() || '',
                    ingredients: [],
                    subRecipes: []
                };

                for (const ingRow of ingredientsRows) {
                    const ingName = ingRow[normalize('Ingrediente')]?.toString().trim();
                    if (!ingName) continue;

                    let ingredient = existingIngredients.find(i => i.name.toLowerCase() === ingName.toLowerCase()) || createdIngredients.find(i => i.name.toLowerCase() === ingName.toLowerCase());
                    if (!ingredient) {
                         const newIng: Ingredient = { 
                            id: generateId(), 
                            name: ingName, 
                            costPerUnit: 0, 
                            purchaseQuantity: 0,
                            unit: 'unidad',
                            purchaseDate: new Date().toISOString(),
                            supplier: 'Importado sin datos'
                        };
                        ingredient = newIng;
                        createdIngredients.push(ingredient);
                        missingIngredientsNames.add(ingName);
                    }
                    
                    const recipeIngredient: RecipeIngredient = {
                        ingredientId: ingredient.id,
                        quantity: parseFloat(ingRow[normalize('Cantidad')]) || 0,
                        unit: ingRow[normalize('Unidad Medida')]?.toString().trim() || 'unidad',
                        wastePercentage: parseFloat(ingRow[normalize('Merma (%)')]) || 0
                    };
                    newRecipe.ingredients.push(recipeIngredient);
                }
                newRecipes.push(newRecipe);
            }
            
            if (newRecipes.length > 0) {
                 await saveRecipes([...existingRecipes, ...newRecipes]);
            }
            if (createdIngredients.length > 0) {
                await saveIngredients([...existingIngredients, ...createdIngredients]);
            }

            let details = `${newRecipes.length} recetas nuevas creadas.`;
            if (missingIngredientsNames.size > 0) {
                details += ` ${missingIngredientsNames.size} insumos nuevos fueron creados con costo 0, por favor actualícelos.`;
            }

            return { message: "Recetas importadas con éxito.", details };
        }
    );

    // Control Tables Import
    const controlTablesHandler = createImportHandler<ProductSale>(
        'Mesas de Control',
        ['PRODUCTO', 'CANTIDAD', 'TIPO_MESA'],
        (row) => {
            const name = row[normalize('PRODUCTO')]?.toString().trim();
            const quantity = parseSpanishNumber(row[normalize('CANTIDAD')]);
            const tableType = row[normalize('TIPO_MESA')]?.toString().trim();
            if (!name || isNaN(quantity) || quantity <= 0) return null;
            return { name, quantity, tableType, id: generateId(), date: new Date().toISOString() };
        },
        async () => {}, // Handled by postProcess
        null,
        async (newConsumptions) => {
            const existingConsumptions = await getInternalConsumptions();
            await saveInternalConsumptions([...existingConsumptions, ...newConsumptions]);
            
            return {
                message: "Datos de Mesas de Control importados con éxito.",
                details: `${newConsumptions.length} registros procesados y añadidos al consumo interno.`
            };
        }
    );

    const inventoryHandler = createImportHandler<{ insumo: string, cantidadFisica: number }>(
        'Importar Conteo de Inventario Físico',
        ['Insumo', 'Cantidad Física'],
        (row) => {
            const name = row[normalize('Insumo')]?.toString().trim();
            const quantity = parseSpanishNumber(row[normalize('Cantidad Física')]);
            if (!name) return null; // Allow quantity 0, but not empty name
            return { insumo: name, cantidadFisica: quantity };
        },
        async () => {},
        null,
        async (importedCounts) => {
            const [recipes, allIngredients, sales, internalConsumptions, inventoryHistory, withdrawals] = await Promise.all([
                getRecipes(), getIngredients(), getProductSales(), getInternalConsumptions(), getInventoryCounts(), getWithdrawals()
            ]);

            if (recipes.length === 0 || allIngredients.length === 0) {
                throw new Error("Se requieren insumos y recetas para calcular el stock teórico antes de importar un inventario.");
            }

            // Create map of latest costs
            const costPerUnitMap = new Map<string, { cost: number, unit: UnitOfMeasure }>();
            const latestPurchases = new Map<string, Ingredient>();
            allIngredients.forEach(ing => {
                const name = ing.canonicalName || ing.name;
                const existing = latestPurchases.get(name);
                if (!existing || new Date(ing.purchaseDate || 0) > new Date(existing.purchaseDate || 0)) {
                    latestPurchases.set(name, ing);
                }
            });
            latestPurchases.forEach((ing, name) => {
                costPerUnitMap.set(name, { cost: ing.costPerUnit, unit: ing.unit });
            });
            
            // Create map of physical counts from file
            const physicalCountsMap = new Map<string, number>();
            importedCounts.forEach(item => physicalCountsMap.set(item.insumo, item.cantidadFisica));

            const stockData = calculateStockData(recipes, allIngredients, sales, internalConsumptions, withdrawals);

            const inventoryItems: InventoryCountItem[] = stockData.map(item => {
                const theoreticalQty = item.finalBalance;
                const physicalQty = physicalCountsMap.get(item.ingredientName) || 0;
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
            
            await saveInventoryCounts([...inventoryHistory, newInventory]);

            return {
                message: "Inventario importado y guardado con éxito.",
                details: `Se ha creado un nuevo registro de inventario con ${inventoryItems.length} insumos.`
            };
        }
    );

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    const handleMenuAIImport = async () => {
        if (menuFiles.length === 0) return;
        setIsImportingMenuAI(true);
        setMenuAIResult({ status: 'idle', message: '' });

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_API_KEY });

            const imageParts = await Promise.all(
                menuFiles.map(async (file) => {
                    const base64Data = await fileToBase64(file);
                    return {
                        inlineData: {
                            mimeType: file.type,
                            data: base64Data,
                        },
                    };
                })
            );

            const textPart = {
                text: `Analiza las siguientes imágenes de un menú de restaurante. Extrae todas las secciones (como 'ENTRADAS', 'PLATOS PRINCIPALES', 'VINOS'), y para cada sección, lista todos los productos con su nombre exacto y precio. Estructura la salida en el formato JSON especificado. Ignora menús ejecutivos, promociones, desayunos, meriendas, y menús sin gluten. Agrupa todos los vinos (tintos, blancos, etc.) en una sola sección 'VINOS'. Agrupa los espumantes en 'ESPUMANTES'. No incluyas descripciones de platos.`
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [textPart, ...imageParts] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        description: "La carta completa del restaurante, dividida en secciones.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: {
                                    type: Type.STRING,
                                    description: "El título de la sección del menú (ej: ENTRADAS)."
                                },
                                items: {
                                    type: Type.ARRAY,
                                    description: "La lista de platos o bebidas en esta sección.",
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: {
                                                type: Type.STRING,
                                                description: "El nombre del producto."
                                            },
                                            price: {
                                                type: Type.NUMBER,
                                                description: "El precio del producto."
                                            }
                                        },
                                        required: ["name", "price"]
                                    }
                                }
                            },
                            required: ["title", "items"]
                        }
                    }
                }
            });
            
            const jsonText = response.text.trim();
            let parsedMenu: MenuData = JSON.parse(jsonText);

            if (!parsedMenu || parsedMenu.length === 0) {
                throw new Error("La IA no pudo extraer datos válidos del menú. Intente con una imagen más clara.");
            }

            // BUG FIX: Add unique IDs to menu items imported via AI
            parsedMenu = parsedMenu.map(section => ({
                ...section,
                items: section.items.map(item => ({
                    ...item,
                    id: (item as any).id || generateId()
                }))
            }));

            await saveMenuData(parsedMenu);

            setMenuAIResult({
                status: 'success',
                message: 'La carta se importó y actualizó correctamente usando IA.',
                details: `Se importaron ${parsedMenu.length} secciones con un total de ${parsedMenu.reduce((acc, s) => acc + s.items.length, 0)} productos.`
            });
            setMenuFiles([]);

        } catch (error: any) {
            console.error("Error during AI menu import:", error);
            setMenuAIResult({ status: 'error', message: 'Error en la importación con IA.', details: error.message || "Ocurrió un error desconocido. Verifique la consola para más detalles." });
        } finally {
            setIsImportingMenuAI(false);
        }
    };


     // --- Export Handlers ---
    const handleExportIngredients = async () => {
        setIsExportingIngredients(true);
        try {
            const ingredients = await getIngredients();
            const dataToExport = ingredients.map(({ name, unit, costPerUnit, purchaseQuantity, supplier, purchaseDate }) => ({
                'Producto': name,
                'Proveedor': supplier || '',
                'Fecha de Factura': purchaseDate ? new Date(purchaseDate).toLocaleDateString('es-AR') : '',
                'Cantidad': purchaseQuantity,
                'Unidad': unit,
                'Precio Unitario': costPerUnit
            }));
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Insumos');
            XLSX.writeFile(workbook, 'backup_insumos.xlsx');
        } catch (error) {
            console.error("Error exporting ingredients:", error);
            alert("Hubo un error al exportar los insumos.");
        } finally {
            setIsExportingIngredients(false);
        }
    };

    const handleExportRecipes = async () => {
        setIsExportingRecipes(true);
        try {
            const [recipes, ingredients] = await Promise.all([getRecipes(), getIngredients()]);
            const dataToExport: any[] = [];

            recipes.forEach(recipe => {
                const costPerServing = calculateRecipeCost(recipe, ingredients, recipes);
                const totalRecipeCost = costPerServing * recipe.yield;
                const costWithVAT = costPerServing * (1 + VAT_RATE);
                const profit = recipe.salePrice - costWithVAT;
                const margin = recipe.salePrice > 0 ? (profit / recipe.salePrice) * 100 : 0;

                const commonData = {
                    'Nombre Receta': recipe.name,
                    'Categoría': recipe.category,
                    'Rendimiento': recipe.yield,
                    'Precio Venta': recipe.salePrice,
                    'Costo por Porción': costPerServing,
                    'Costo Total Receta': totalRecipeCost,
                    'Margen %': parseFloat(margin.toFixed(2)),
                    'Notas': recipe.notes || '',
                };

                if (recipe.ingredients.length === 0) {
                    dataToExport.push({
                        ...commonData,
                        'Ingrediente': '',
                        'Cantidad': '',
                        'Unidad Medida': '',
                        'Merma (%)': ''
                    });
                } else {
                    recipe.ingredients.forEach(ing => {
                        const ingredientDetails = ingredients.find(i => i.id === ing.ingredientId);
                        dataToExport.push({
                            ...commonData,
                            'Ingrediente': ingredientDetails ? ingredientDetails.name : 'ID NO ENCONTRADO',
                            'Cantidad': ing.quantity,
                            'Unidad Medida': ing.unit,
                            'Merma (%)': ing.wastePercentage || 0
                        });
                    });
                }
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Recetas');
            XLSX.writeFile(workbook, 'backup_recetas.xlsx');
        } catch (error) {
            console.error("Error exporting recipes:", error);
            alert("Hubo un error al exportar las recetas.");
        } finally {
            setIsExportingRecipes(false);
        }
    };
    
    const handleExportCurrentStock = async () => {
        setIsExportingStock(true);
        try {
            const [recipes, ingredients, sales, internalConsumptions, withdrawals] = await Promise.all([
                getRecipes(),
                getIngredients(),
                getProductSales(),
                getInternalConsumptions(),
                getWithdrawals()
            ]);

            if (recipes.length === 0 || ingredients.length === 0) {
                alert("No hay suficientes datos para calcular el stock actual. Por favor, cargue insumos y recetas.");
                return;
            }

            const stockData = calculateStockData(recipes, ingredients, sales, internalConsumptions, withdrawals);

            const dataToExport = stockData.map(item => ({
                'Insumo': item.ingredientName,
                'Unidad': item.unit,
                'Stock Teórico Final': item.finalBalance
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            worksheet['!cols'] = [ { wch: 40 }, { wch: 15 }, { wch: 20 } ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Teórico Actual');
            XLSX.writeFile(workbook, 'stock_teorico_actual.xlsx');
        } catch (error) {
            console.error("Error exporting current stock:", error);
            alert("Hubo un error al exportar el stock actual.");
        } finally {
            setIsExportingStock(false);
        }
    };

    const handleExportInventory = async () => {
        setIsExportingInventory(true);
        try {
            const inventoryHistory = await getInventoryCounts();
            if (inventoryHistory.length === 0) {
                alert("No hay historial de inventario para exportar.");
                return;
            }
            
            const dataToExport: any[] = [];
            inventoryHistory
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .forEach(record => {
                    record.items.forEach(item => {
                        dataToExport.push({
                            'Fecha Inventario': new Date(record.date).toLocaleString('es-AR'),
                            'ID Inventario': record.id,
                            'Insumo': item.ingredientName,
                            'Unidad': item.unit,
                            'Stock Teórico': item.theoreticalQty,
                            'Stock Físico': item.physicalQty,
                            'Varianza (Unidades)': item.varianceQty,
                            'Varianza (Costo)': item.costOfVariance,
                        });
                    });
                });
            
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            worksheet['!cols'] = [
                { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 10 },
                { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial Inventario');
            XLSX.writeFile(workbook, 'backup_inventario.xlsx');

        } catch (error) {
             console.error("Error exporting inventory:", error);
            alert("Hubo un error al exportar el historial de inventario.");
        } finally {
            setIsExportingInventory(false);
        }
    };


    // --- Import Card Component ---
    const ImportCard: React.FC<{
        title: string,
        description: string,
        headers: string[],
        handler: ReturnType<typeof createImportHandler<any>>
    }> = ({ title, description, headers, handler }) => (
         <Card>
            <h2 className="text-2xl font-bold text-brand mb-2">{title}</h2>
            <p className="text-sm text-gray-400 mb-2">{description}</p>
            <div className="text-xs text-gray-500 bg-primary p-2 rounded-md mb-4">
                <p className="font-bold mb-1 flex items-center"><ListOrdered size={14} className="mr-2"/>Encabezados Requeridos:</p>
                <code className="flex flex-wrap gap-x-3 gap-y-1">
                    {headers.map(h => <span key={h} className="bg-accent px-2 py-0.5 rounded text-left" style={{ whiteSpace: 'pre-wrap' }}>{h}</span>)}
                </code>
            </div>
            <FileInput id={`${title}-file`} file={handler.file} onFileChange={handler.setFile} />
            <Button onClick={handler.handleImport} disabled={!handler.file || handler.isImporting} className="mt-4 w-full">
                {handler.isImporting ? 'Importando...' : `Importar ${title}`}
            </Button>
            <ResultMessage result={handler.result} />
        </Card>
    );

    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-8">Importar y Exportar Datos</h1>
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <h2 className="text-2xl font-bold text-brand mb-2 flex items-center"><Sparkles className="mr-3"/>Importar Carta desde PDF/Imagen (con IA)</h2>
                        <p className="text-sm text-gray-400 mb-4">Sube una o más imágenes de tu menú (JPG, PNG). Nuestra IA analizará el contenido y estructurará la carta automáticamente. Esto reemplazará la carta actual.</p>
                        
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <UploadCloud className="mx-auto h-12 w-12 text-gray-500" />
                                <div className="flex text-sm text-gray-400">
                                    <label htmlFor="menu-ai-file" className="relative cursor-pointer bg-secondary rounded-md font-medium text-brand hover:text-teal-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-secondary focus-within:ring-brand px-1">
                                        <span>Seleccione imágenes</span>
                                        <input id="menu-ai-file" name="menu-ai-file" type="file" className="sr-only" accept="image/*" multiple onChange={e => setMenuFiles(Array.from(e.target.files || []))} />
                                    </label>
                                </div>
                                {menuFiles.length > 0 ? (
                                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                                        {menuFiles.map(f => <p key={f.name} className="flex items-center justify-center"><FileText size={14} className="mr-1" /> {f.name}</p>)}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">JPG, PNG. Puede seleccionar varias imágenes.</p>
                                )}
                            </div>
                        </div>
                        
                        <Button onClick={handleMenuAIImport} disabled={menuFiles.length === 0 || isImportingMenuAI} className="mt-4 w-full">
                            {isImportingMenuAI ? 'Analizando con IA...' : 'Importar Carta'}
                        </Button>
                        <ResultMessage result={menuAIResult} />
                    </Card>

                    <ImportCard title="Precios de Venta" description="Actualice los precios de venta de sus recetas." headers={['Descripcion', ...Object.values(priceColumnDefinitions), 'Rubro', 'Código', 'Grupo A', 'Grupo B']} handler={pricesHandler} />
                    
                    <Card>
                        <h2 className="text-2xl font-bold text-brand mb-2">Cantidades Vendidas</h2>
                        <p className="text-sm text-gray-400 mb-2">Cargue las ventas por producto para los reportes. Los nuevos registros se añadirán a los existentes.</p>
                        <div className="text-xs text-gray-500 bg-primary p-2 rounded-md mb-4">
                            <p className="font-bold mb-1 flex items-center"><ListOrdered size={14} className="mr-2"/>Encabezados Requeridos:</p>
                            <code className="flex flex-wrap gap-x-3 gap-y-1">
                                {['DESCRIPCION', 'CANTIDAD'].map(h => <span key={h} className="bg-accent px-2 py-0.5 rounded text-left">{h}</span>)}
                            </code>
                        </div>
                        <FileInput id="sales-file" file={salesHandler.file} onFileChange={salesHandler.setFile} />
                        <div className="mt-4">
                            <Input 
                                label="Asignar Fecha a la Importación"
                                type="date"
                                id="sales-date"
                                value={salesImportDate}
                                onChange={e => setSalesImportDate(e.target.value)}
                            />
                        </div>
                        <Button onClick={salesHandler.handleImport} disabled={!salesHandler.file || salesHandler.isImporting} className="mt-4 w-full">
                            {salesHandler.isImporting ? 'Importando...' : `Importar Cantidades Vendidas`}
                        </Button>
                        <ResultMessage result={salesHandler.result} />
                    </Card>

                    <ImportCard title="Insumos" description="Cargue o actualice su lista de insumos y costos. La relación con el 'Nombre Unificado' se gestiona desde la página de Insumos." headers={['Producto', 'Proveedor', 'Fecha de Factura', 'Cantidad', 'Unidad', 'Precio Unitario']} handler={ingredientsHandler} />
                    <ImportCard title="Recetas" description="Importe recetas completas desde el archivo del prototipo. La pestaña debe llamarse 'Recetas'." headers={['Nombre Receta', 'Categoría', 'Rendimiento', 'Precio Venta', 'Notas', 'Ingrediente', 'Cantidad', 'Unidad Medida', 'Merma (%)']} handler={recipesHandler} />
                    <ImportCard title="Mesas de Control" description="Cargue consumos internos, invitaciones o pérdidas. Estos datos se restarán del stock." headers={['PRODUCTO', 'CANTIDAD', 'TIPO_MESA']} handler={controlTablesHandler} />
                    <ImportCard title="Importar Conteo de Inventario Físico" description="Cargue un conteo físico para generar un nuevo registro de inventario y calcular varianzas." headers={['Insumo', 'Cantidad Física']} handler={inventoryHandler} />
                </div>
                 <Card>
                    <h2 className="text-2xl font-bold text-brand mb-2 flex items-center"><DatabaseBackup className="mr-3" />Exportar / Backup de Datos</h2>
                    <p className="text-sm text-gray-400 mb-4">Guarde una copia de seguridad de sus datos en formato XLSX. Estos archivos pueden ser utilizados para restaurar su información usando la funcionalidad de importación.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button variant="secondary" onClick={handleExportIngredients} disabled={isExportingIngredients} className="w-full sm:w-auto">
                            <DownloadCloud className="mr-2"/>
                            {isExportingIngredients ? 'Exportando...' : 'Exportar Insumos'}
                        </Button>
                        <Button variant="secondary" onClick={handleExportRecipes} disabled={isExportingRecipes} className="w-full sm:w-auto">
                             <DownloadCloud className="mr-2"/>
                            {isExportingRecipes ? 'Exportando...' : 'Exportar Recetas'}
                        </Button>
                        <Button variant="secondary" onClick={handleExportCurrentStock} disabled={isExportingStock} className="w-full sm:w-auto">
                            <DownloadCloud className="mr-2"/>
                            {isExportingStock ? 'Exportando...' : 'Exportar Stock Actual'}
                        </Button>
                        <Button variant="secondary" onClick={handleExportInventory} disabled={isExportingInventory} className="w-full sm:w-auto">
                             <DownloadCloud className="mr-2"/>
                            {isExportingInventory ? 'Exportando...' : 'Exportar Inventario'}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ImportPage;
