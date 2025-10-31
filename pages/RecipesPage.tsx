import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, Edit, Trash2, Leaf, Package, UtensilsCrossed, ChevronLeft, Save, Info, History, Eye, Printer, Copy, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getRecipes, saveRecipes, getIngredients, getRecipeHistory, saveRecipeHistory, getGlobalWasteRate } from '../services/db';
import { calculateRecipeCost } from '../services/calculation';
import type { Recipe, Ingredient, RecipeIngredient, SubRecipeItem, RecipeHistoryEntry } from '../types';
import { generateId, formatCurrency, getCategoryColorClassDark } from '../lib/helpers';
import { RECIPE_CATEGORIES, UNITS_OF_MEASURE, VAT_RATE } from '../lib/constants';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchableIngredientSelect from '../components/SearchableIngredientSelect';
import SearchableRecipeSelect from '../components/SearchableRecipeSelect';
import PrintableRecipe from '../components/PrintableRecipe';


// --- Cost Analysis Component ---
const CostAnalysisCard: React.FC<{ recipe: Recipe; costPerServing: number }> = ({ recipe, costPerServing }) => {
    const costWithVAT = costPerServing * (1 + VAT_RATE);
    const profit = recipe.salePrice - costWithVAT;
    const margin = recipe.salePrice > 0 ? (profit / recipe.salePrice) * 100 : 0;

    return (
        <Card className="sticky top-8">
            <h3 className="text-xl font-bold text-brand mb-4">Análisis de Costos</h3>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Costo por Porción</span> <span className="font-semibold">{formatCurrency(costPerServing)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Costo c/IVA ({VAT_RATE * 100}%)</span> <span className="font-semibold">{formatCurrency(costWithVAT)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Precio de Venta</span> <span className="font-semibold">{formatCurrency(recipe.salePrice)}</span></div>
                <hr className="border-accent"/>
                <div className="flex justify-between text-base"><span className="text-gray-300 font-bold">Ganancia</span> <span className="font-bold">{formatCurrency(profit)}</span></div>
                <div className="flex justify-between text-base">
                    <span className="text-gray-300 font-bold">Margen</span> 
                    <span className={`font-bold text-lg ${margin < 30 ? 'text-red-500' : 'text-green-400'}`}>
                        {margin.toFixed(1)}%
                    </span>
                </div>
            </div>
        </Card>
    );
};

// --- Read-only Recipe Detail for History View ---
const ReadOnlyRecipeDetail: React.FC<{
    recipe: Recipe;
    allIngredients: Ingredient[];
    allRecipes: Recipe[];
    onBack: () => void;
    timestamp?: string;
}> = ({ recipe, allIngredients, allRecipes, onBack, timestamp }) => {
    const costPerServing = useMemo(() => calculateRecipeCost(recipe, allIngredients, allRecipes), [recipe, allIngredients, allRecipes]);
    const colors = getCategoryColorClassDark(recipe.category);
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <Button variant="secondary" onClick={onBack}>
                    <ChevronLeft size={18} className="mr-2"/> Volver a la lista
                </Button>
                {timestamp && (
                    <div className="text-sm text-gray-400">
                        Versión guardada el: <span className="font-semibold text-brand">{new Date(timestamp).toLocaleString('es-AR')}</span>
                    </div>
                )}
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <div className={`text-sm font-semibold ${colors.text}`}>{recipe.category}</div>
                        <h2 className="text-2xl font-bold text-white mt-1">{recipe.name}</h2>
                         {recipe.imageUrl && <img src={recipe.imageUrl} alt={recipe.name} className="mt-4 rounded-lg max-h-60 w-full object-cover"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                           <p><strong className="text-gray-400">Precio de Venta:</strong> {formatCurrency(recipe.salePrice)}</p>
                           <p><strong className="text-gray-400">Rendimiento:</strong> {recipe.yield} porciones</p>
                        </div>
                         {recipe.notes && (
                            <div className="mt-4">
                                <h3 className="font-semibold text-gray-300 mb-1">Notas de Preparación</h3>
                                <p className="text-gray-400 whitespace-pre-wrap bg-primary/50 p-3 rounded-md">{recipe.notes}</p>
                            </div>
                        )}
                    </Card>
                    <Card>
                         <h2 className="text-2xl font-bold text-brand mb-4 flex items-center"><Leaf className="mr-3"/>Insumos</h2>
                         <div className="space-y-2">
                             {recipe.ingredients.map((item, index) => {
                                const ingredient = allIngredients.find(ing => ing.id === item.ingredientId);
                                let ingredientCost = 0;
                                if (ingredient && item.quantity > 0) {
                                    const costBeforeWaste = ingredient.costPerUnit * item.quantity;
                                    const wasteFactor = 1 - ((item.wastePercentage || 0) / 100);
                                    if (wasteFactor > 0) {
                                        ingredientCost = costBeforeWaste / wasteFactor;
                                    }
                                }
                                return (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-accent p-2 rounded-md text-sm">
                                        <div className="col-span-4 font-semibold">{ingredient ? `${ingredient.name} (${new Date(ingredient.purchaseDate || '').toLocaleDateString('es-AR')})` : <span className="text-red-400">Insumo no encontrado</span>}</div>
                                        <div className="col-span-2">{item.quantity} {item.unit}</div>
                                        <div className="col-span-2">Merma: {item.wastePercentage || 0}%</div>
                                        <div className="col-span-4 text-right font-mono">{formatCurrency(ingredientCost)}</div>
                                    </div>
                                );
                            })}
                         </div>
                    </Card>
                     {recipe.subRecipes.length > 0 && (
                        <Card>
                            <h2 className="text-2xl font-bold text-brand mb-4 flex items-center"><Package className="mr-3"/>Sub-Recetas / Preparaciones</h2>
                            <div className="space-y-2">
                                {recipe.subRecipes.map((item, index) => {
                                    const subRecipe = allRecipes.find(r => r.id === item.recipeId);
                                    let subRecipeLineCost = 0;
                                    const isDirectCost = item.directCost !== undefined && !isNaN(item.directCost);
                                    if (subRecipe) {
                                        const costPerPortion = isDirectCost
                                            ? item.directCost!
                                            : calculateRecipeCost(subRecipe, allIngredients, allRecipes);
                                        subRecipeLineCost = costPerPortion * item.quantity;
                                    }
                                    return (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-center bg-accent p-2 rounded-md text-sm">
                                            <div className="col-span-5 font-semibold">{subRecipe ? subRecipe.name : <span className="text-red-400">Receta no encontrada</span>}</div>
                                            <div className="col-span-2">{item.quantity} porc.</div>
                                            <div className="col-span-2">
                                                {isDirectCost ? (
                                                    <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded text-xs">Costo Directo</span>
                                                ) : (
                                                    <span className="bg-gray-800/50 text-gray-400 px-2 py-1 rounded text-xs">Calculado</span>
                                                )}
                                            </div>
                                            <div className="col-span-3 text-right font-mono">{formatCurrency(subRecipeLineCost)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </div>
                 <div className="lg:col-span-1">
                   <CostAnalysisCard recipe={recipe} costPerServing={costPerServing} />
                </div>
            </div>
        </div>
    );
};


// --- Recipe History Page ---
const RecipeHistoryPage: React.FC<{
    onCancel: () => void;
    allRecipes: Recipe[];
    allIngredients: Ingredient[];
}> = ({ onCancel, allRecipes, allIngredients }) => {
    const [history, setHistory] = useState<RecipeHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<RecipeHistoryEntry | null>(null);

    useEffect(() => {
        const loadHistory = async () => {
            const historyData = await getRecipeHistory();
            // Sort by date, newest first
            historyData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setHistory(historyData);
            setLoading(false);
        };
        loadHistory();
    }, []);

    if (loading) return <div>Cargando historial...</div>;

    if (selectedEntry) {
        return <ReadOnlyRecipeDetail 
            recipe={selectedEntry.recipeData}
            allIngredients={allIngredients}
            allRecipes={allRecipes}
            onBack={() => setSelectedEntry(null)}
            timestamp={selectedEntry.timestamp}
        />
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-white">Historial de Cambios</h1>
                <Button variant="secondary" onClick={onCancel}>
                    <ChevronLeft size={18} className="mr-2"/> Volver a Recetas
                </Button>
            </div>
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-accent">
                            <tr>
                                <th className="p-3">Receta</th>
                                <th className="p-3">Fecha de Modificación</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? history.map(entry => {
                                const originalRecipe = allRecipes.find(r => r.id === entry.recipeId);
                                const recipeName = originalRecipe ? originalRecipe.name : `Receta Eliminada (ID: ${entry.recipeId.substring(0, 5)})`;
                                return (
                                <tr key={entry.id} className="border-b border-accent hover:bg-accent">
                                    <td className="p-3 font-semibold">{recipeName}</td>
                                    <td className="p-3 text-gray-400">{new Date(entry.timestamp).toLocaleString('es-AR')}</td>
                                    <td className="p-3 text-right">
                                        <Button variant="secondary" onClick={() => setSelectedEntry(entry)}>
                                            <Eye size={16} className="mr-2"/> Ver Versión
                                        </Button>
                                    </td>
                                </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={3} className="text-center p-6 text-gray-400">
                                        No hay historial de cambios guardado.
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

interface RecipeErrors {
    name?: string;
    category?: string;
    yield?: string;
    salePrice?: string;
    ingredients?: { [index: number]: Partial<Record<keyof RecipeIngredient, string>> };
    subRecipes?: { [index: number]: Partial<Record<keyof SubRecipeItem, string>> };
}


// --- Recipe Detail/Form Page ---
const RecipeDetailPage: React.FC<{
  initialRecipe: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onCopy: (recipe: Recipe) => void;
  allIngredients: Ingredient[];
  allRecipes: Recipe[];
  setIsFormDirty: (isDirty: boolean) => void;
  lastModified?: string;
  globalWasteRate: number;
}> = ({ initialRecipe, onSave, onCancel, onDelete, onCopy, allIngredients, allRecipes, setIsFormDirty, lastModified, globalWasteRate }) => {
    const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
    const [initialStateJSON, setInitialStateJSON] = useState('');
    const [errors, setErrors] = useState<RecipeErrors>({});
    const [imageError, setImageError] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const sortedIngredients = useMemo(() => {
        return [...allIngredients].sort((a, b) => {
            if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
            // Names are the same, sort by date descending (newest first)
            if (a.purchaseDate && b.purchaseDate) {
                return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
            }
            if (a.purchaseDate) return -1; // a has date, b doesn't, a comes first
            if (b.purchaseDate) return 1;  // b has date, a doesn't, b comes first
            return 0;
        });
    }, [allIngredients]);

    // Sync local state with parent prop and reset dirty state tracker
    useEffect(() => {
        setRecipe(initialRecipe);
        setInitialStateJSON(JSON.stringify(initialRecipe));
        setErrors({}); // Clear errors when recipe changes
    }, [initialRecipe]);

    useEffect(() => {
        setImageError(false);
    }, [recipe.imageUrl]);

    const isDirty = useMemo(() => {
        if (!initialStateJSON) return false;
        return JSON.stringify(recipe) !== initialStateJSON;
    }, [recipe, initialStateJSON]);


    useEffect(() => {
        setIsFormDirty(isDirty);

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
           if (isDirty) {
             e.preventDefault();
             e.returnValue = 'Tiene cambios sin guardar. ¿Está seguro de que desea salir?';
           }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setIsFormDirty(false);
        };

    }, [isDirty, setIsFormDirty]);

    const costPerServing = useMemo(() => calculateRecipeCost(recipe, allIngredients, allRecipes), [recipe, allIngredients, allRecipes]);

    const handleRecipeChange = (field: keyof Recipe, value: any) => {
        setRecipe(prev => ({ ...prev, [field]: value }));
    };

    const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: any) => {
        const newIngredients = [...recipe.ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setRecipe({ ...recipe, ingredients: newIngredients });
    };

    const addIngredient = () => {
        setRecipe(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { ingredientId: '', quantity: 0, unit: 'g', wastePercentage: globalWasteRate }],
        }));
    };

    const removeIngredient = (index: number) => {
        setRecipe(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
    };
    
    const handleSubRecipeChange = (index: number, field: keyof SubRecipeItem, value: any) => {
        const newSubRecipes = [...recipe.subRecipes];
        newSubRecipes[index] = { ...newSubRecipes[index], [field]: value };
        setRecipe({ ...recipe, subRecipes: newSubRecipes });
    };

    const addSubRecipe = () => {
        setRecipe(prev => ({
            ...prev,
            subRecipes: [...prev.subRecipes, { recipeId: '', quantity: 1 }],
        }));
    };

    const removeSubRecipe = (index: number) => {
        setRecipe(prev => ({ ...prev, subRecipes: prev.subRecipes.filter((_, i) => i !== index) }));
    };

    const validate = (): boolean => {
        const newErrors: RecipeErrors = { ingredients: {}, subRecipes: {} };

        if (!recipe.name.trim()) newErrors.name = 'El nombre es requerido.';
        if (!recipe.category || recipe.category === 'Sin Analizar') newErrors.category = 'Seleccione una categoría válida.';
        if (!recipe.yield || recipe.yield <= 0) newErrors.yield = 'El rendimiento debe ser un número positivo.';
        if (recipe.salePrice < 0) newErrors.salePrice = 'El precio no puede ser negativo.';

        recipe.ingredients.forEach((ing, index) => {
            const ingErrors: Partial<Record<keyof RecipeIngredient, string>> = {};
            if (!ing.ingredientId) ingErrors.ingredientId = 'Requerido.';
            if (!ing.quantity || ing.quantity <= 0) ingErrors.quantity = 'Debe ser > 0.';
            if (ing.wastePercentage !== undefined && (ing.wastePercentage < 0 || ing.wastePercentage > 100)) ingErrors.wastePercentage = '0-100.';
            if (Object.keys(ingErrors).length > 0) {
                if (!newErrors.ingredients) newErrors.ingredients = {};
                newErrors.ingredients[index] = ingErrors;
            }
        });

        recipe.subRecipes.forEach((sub, index) => {
            const subErrors: Partial<Record<keyof SubRecipeItem, string>> = {};
            if (!sub.recipeId) subErrors.recipeId = 'Requerido.';
            if (!sub.quantity || sub.quantity <= 0) subErrors.quantity = 'Debe ser > 0.';
            if (sub.directCost !== undefined && sub.directCost < 0) subErrors.directCost = 'Debe ser >= 0.';
            if (Object.keys(subErrors).length > 0) {
                if (!newErrors.subRecipes) newErrors.subRecipes = {};
                newErrors.subRecipes[index] = subErrors;
            }
        });

        setErrors(newErrors);

        return !newErrors.name && !newErrors.yield && !newErrors.salePrice && !newErrors.category &&
            Object.values(newErrors.ingredients || {}).every(e => Object.keys(e).length === 0) &&
            Object.values(newErrors.subRecipes || {}).every(e => Object.keys(e).length === 0);
    };


    const handleSubmit = async () => {
        if (!validate()) {
            return;
        }
        await onSave(recipe);
    };

    const handleCancel = () => {
        if (isDirty) {
            if (window.confirm('Tiene cambios sin guardar. ¿Está seguro de que desea salir? Los cambios se perderán.')) {
                onCancel();
            }
        } else {
            onCancel();
        }
    };
    
    const handleCancelChanges = () => {
        if (window.confirm('¿Está seguro de que desea deshacer todos los cambios? Esta acción no se puede revertir.')) {
            setRecipe(initialRecipe);
        }
    };

    const handlePrint = async () => {
        const printableElement = document.querySelector('.printable-area');
        if (!printableElement || isPrinting) return;

        setIsPrinting(true);
        // The printable area is styled with display: none. We need to make it visible for capture.
        // A common trick is to clone it, position it off-screen, capture, then remove.
        const clone = printableElement.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '0px';
        // Set a defined width to help the layout engine render consistently
        clone.style.width = '210mm'; 
        
        document.body.appendChild(clone);
        
        try {
            const canvas = await html2canvas(clone, {
                scale: 2, // Improves text clarity
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            document.body.removeChild(clone); // Clean up immediately after capture

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Ficha_Tecnica_${recipe.name.replace(/ /g, '_')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF. Si la receta incluye una imagen de internet, asegúrese de que sea públicamente accesible.");
        } finally {
            if (document.body.contains(clone)) {
                document.body.removeChild(clone); // Ensure cleanup on error
            }
            setIsPrinting(false);
        }
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                 <Button variant="secondary" onClick={handleCancel}>
                    <ChevronLeft size={18} className="mr-2"/> Volver a Recetas
                </Button>
                <div className="flex gap-2 flex-wrap justify-end">
                    <Button variant="secondary" onClick={handlePrint} disabled={isPrinting}>
                        <Printer size={16} className="mr-2"/> Exportar
                    </Button>
                    <Button variant="secondary" onClick={() => onCopy(recipe)}>
                        <Copy size={16} className="mr-2"/> Copiar
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(recipe.id)}>
                        <Trash2 size={16} className="mr-2"/> Eliminar
                    </Button>
                    <Button variant="secondary" onClick={handleCancelChanges} disabled={!isDirty}>
                        <RotateCcw size={16} className="mr-2"/> Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isDirty}>
                        <Save size={16} className="mr-2"/> Guardar
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <h2 className="text-2xl font-bold text-brand mb-4">Detalles de la Receta</h2>
                        <div className="space-y-4">
                             <Input label="Nombre de la Receta" id="name" value={recipe.name} onChange={e => handleRecipeChange('name', e.target.value)} className="text-lg" error={errors.name} />
                             <Input label="URL de la Imagen (Opcional)" id="imageUrl" placeholder="https://ejemplo.com/imagen.jpg" value={recipe.imageUrl || ''} onChange={e => handleRecipeChange('imageUrl', e.target.value)} />
                             
                             {recipe.imageUrl && !imageError && (
                                <img
                                    src={recipe.imageUrl}
                                    alt="Vista previa"
                                    className="mt-2 rounded-lg max-h-40 object-cover"
                                    onError={() => setImageError(true)}
                                />
                            )}
                            {imageError && (
                                <div className="mt-2 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm text-center">
                                    No se pudo cargar la imagen. Verifique que la URL sea correcta y públicamente accesible.
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select label="Categoría" id="category" value={recipe.category} onChange={e => handleRecipeChange('category', e.target.value)} error={errors.category}>
                                    {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                                <Input label="Precio de Venta (PVP)" id="salePrice" type="number" step="0.01" value={recipe.salePrice} onChange={e => handleRecipeChange('salePrice', parseFloat(e.target.value) || 0)} error={errors.salePrice} />
                                <Input label="Rendimiento (Porciones)" id="yield" type="number" min="1" value={recipe.yield} onChange={e => handleRecipeChange('yield', parseInt(e.target.value) || 1)} error={errors.yield} />
                            </div>
                             <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-gray-400 mb-1">Notas de Preparación</label>
                                <textarea id="notes" value={recipe.notes || ''} onChange={e => handleRecipeChange('notes', e.target.value)} rows={4}
                                    className="w-full bg-accent px-3 py-2 rounded-md border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                             </div>
                        </div>
                    </Card>
                    <Card>
                         <h2 className="text-2xl font-bold text-brand mb-4 flex items-center"><Leaf className="mr-3"/>Insumos</h2>
                         <div className="space-y-2">
                            {recipe.ingredients.map((item, index) => {
                                const ingredient = allIngredients.find(ing => ing.id === item.ingredientId);
                                let ingredientCost = 0;
                                if (ingredient && item.quantity > 0) {
                                    const costBeforeWaste = ingredient.costPerUnit * item.quantity;
                                    const wasteFactor = 1 - ((item.wastePercentage || 0) / 100);
                                    if (wasteFactor > 0) {
                                        ingredientCost = costBeforeWaste / wasteFactor;
                                    }
                                }
                                const ingErrors = errors.ingredients?.[index] || {};

                                return (
                                <div key={index} className="grid grid-cols-12 gap-2 items-start bg-accent p-2 rounded-md">
                                    <div className="col-span-3">
                                        <SearchableIngredientSelect
                                            ingredients={sortedIngredients}
                                            value={item.ingredientId}
                                            onChange={(selectedId) => handleIngredientChange(index, 'ingredientId', selectedId)}
                                            error={ingErrors.ingredientId}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input label="Cantidad" id={`ing-qty-${index}`} type="number" step="0.01" value={item.quantity} onChange={e => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)} error={ingErrors.quantity} />
                                    </div>
                                    <div className="col-span-2">
                                        <Select label="Unidad" id={`ing-unit-${index}`} value={item.unit} onChange={e => handleIngredientChange(index, 'unit', e.target.value)}>
                                            {UNITS_OF_MEASURE.map(u => <option key={u} value={u}>{u}</option>)}
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <Input label="Merma %" id={`ing-waste-${index}`} type="number" value={item.wastePercentage || 0} onChange={e => handleIngredientChange(index, 'wastePercentage', parseFloat(e.target.value) || 0)} error={ingErrors.wastePercentage} />
                                    </div>
                                    <div className="col-span-2 flex flex-col items-end">
                                         <div className="w-full">
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Costo</label>
                                            <div className="w-full bg-primary/50 px-3 py-2 rounded-md border border-gray-600 text-white h-[42px] flex items-center font-mono justify-end">
                                                {formatCurrency(ingredientCost)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-1 flex items-end justify-end h-full pb-1">
                                        <Button type="button" variant="danger" onClick={() => removeIngredient(index)}><Trash2 size={16}/></Button>
                                    </div>
                                </div>
                                );
                            })}
                         </div>
                         <Button type="button" variant="secondary" onClick={addIngredient} className="mt-4"><PlusCircle size={16} className="mr-2"/>Añadir Insumo</Button>
                    </Card>
                    <Card>
                        <h2 className="text-2xl font-bold text-brand mb-4 flex items-center"><Package className="mr-3"/>Sub-Recetas / Preparaciones</h2>
                        <div className="space-y-2">
                            {recipe.subRecipes.map((item, index) => {
                                const subRecipe = allRecipes.find(r => r.id === item.recipeId);
                                let subRecipeLineCost = 0;
                                if (subRecipe) {
                                    const costPerPortion = (item.directCost !== undefined && !isNaN(item.directCost))
                                        ? item.directCost
                                        : calculateRecipeCost(subRecipe, allIngredients, allRecipes);
                                    subRecipeLineCost = costPerPortion * item.quantity;
                                }
                                const subErrors = errors.subRecipes?.[index] || {};

                                return (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-start bg-accent p-2 rounded-md">
                                        <div className="col-span-4">
                                            <SearchableRecipeSelect
                                                recipes={allRecipes}
                                                value={item.recipeId}
                                                onChange={(selectedId) => handleSubRecipeChange(index, 'recipeId', selectedId)}
                                                currentRecipeId={recipe.id}
                                                error={subErrors.recipeId}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Input label="Cantidad" id={`sub-qty-${index}`} type="number" step="0.01" value={item.quantity} onChange={e => handleSubRecipeChange(index, 'quantity', parseFloat(e.target.value) || 0)} error={subErrors.quantity} />
                                        </div>
                                        <div className="col-span-3">
                                            <Input label="Costo Directo (Opcional)" id={`sub-cost-${index}`} type="number" step="0.01" value={item.directCost ?? ''} placeholder="Calcular auto." onChange={e => handleSubRecipeChange(index, 'directCost', e.target.value === '' ? undefined : parseFloat(e.target.value))} error={subErrors.directCost} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Costo</label>
                                            <div className="w-full bg-primary/50 px-3 py-2 rounded-md border border-gray-600 text-white h-[42px] flex items-center font-mono justify-end">
                                                {formatCurrency(subRecipeLineCost)}
                                            </div>
                                        </div>
                                        <div className="col-span-1 flex items-end justify-end h-full pb-1">
                                            <Button type="button" variant="danger" onClick={() => removeSubRecipe(index)}><Trash2 size={16}/></Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <Button type="button" variant="secondary" onClick={addSubRecipe} className="mt-4"><PlusCircle size={16} className="mr-2"/>Añadir Sub-Receta</Button>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                   <CostAnalysisCard recipe={recipe} costPerServing={costPerServing} />
                </div>
            </div>
             <div className="printable-area">
                <PrintableRecipe 
                    recipe={recipe} 
                    allIngredients={allIngredients} 
                    allRecipes={allRecipes} 
                    lastModified={lastModified}
                />
            </div>
        </div>
    );
};

// --- Recipe Card for the Grid View ---
const RecipeCard: React.FC<{ recipe: Recipe; allIngredients: Ingredient[]; allRecipes: Recipe[]; onSelect: (recipe: Recipe) => void }> = ({ recipe, allIngredients, allRecipes, onSelect }) => {
    const costPerServing = calculateRecipeCost(recipe, allIngredients, allRecipes);
    const costWithVAT = costPerServing * (1 + VAT_RATE);
    const profit = recipe.salePrice - costWithVAT;
    const margin = recipe.salePrice > 0 ? (profit / recipe.salePrice) * 100 : 0;
    const colors = getCategoryColorClassDark(recipe.category);
    
    return (
        <div onClick={() => onSelect(recipe)} className={`rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between border ${colors.border} ${colors.bg}`}>
            <div className="p-5 flex-grow">
                <p className={`text-sm font-semibold ${colors.text}`}>{recipe.category}</p>
                <h3 className="font-bold text-xl text-white mt-1">{recipe.name}</h3>
            </div>
            <div className="bg-primary/50 p-4 rounded-b-lg border-t ${colors.border} space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Costo/Porción</span>
                    <span className="font-semibold text-gray-200">{formatCurrency(costPerServing)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">PVP</span>
                    <span className="font-semibold text-gray-200">{formatCurrency(recipe.salePrice)}</span>
                </div>
                <hr className="border-accent" />
                <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-300">Margen</span>
                    <span className={`font-bold text-xl ${margin < 30 ? 'text-red-500' : 'text-green-400'}`}>
                        {margin.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
};


// --- Main Page Component ---
const RecipesPage: React.FC<{ 
    setIsFormDirty: (isDirty: boolean) => void;
    initialRecipe?: Recipe | null;
    clearInitialRecipe?: () => void;
}> = ({ setIsFormDirty, initialRecipe, clearInitialRecipe }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [recipeHistory, setRecipeHistory] = useState<RecipeHistoryEntry[]>([]);
    const [view, setView] = useState<'list' | 'detail' | 'history'>('list');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [globalWasteRate, setGlobalWasteRate] = useState(0);

    const handleSelectRecipe = useCallback((recipe: Recipe) => {
        setSelectedRecipe(recipe);
        setView('detail');
    }, []);

    useEffect(() => {
        if (initialRecipe) {
            handleSelectRecipe(initialRecipe);
            if (clearInitialRecipe) {
                clearInitialRecipe();
            }
        }
    }, [initialRecipe, clearInitialRecipe, handleSelectRecipe]);

    const loadData = useCallback(async () => {
        const [loadedRecipes, loadedIngredients, loadedHistory, loadedWasteRate] = await Promise.all([
            getRecipes(), 
            getIngredients(),
            getRecipeHistory(),
            getGlobalWasteRate(),
        ]);
        setRecipes(loadedRecipes);
        setIngredients(loadedIngredients);
        setRecipeHistory(loadedHistory);
        setGlobalWasteRate(loadedWasteRate);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async (recipeToSave: Recipe) => {
        const originalRecipe = recipes.find(r => r.id === recipeToSave.id);
        
        if (originalRecipe && JSON.stringify(originalRecipe) !== JSON.stringify(recipeToSave)) {
            const historyEntry: RecipeHistoryEntry = {
                id: generateId(),
                recipeId: originalRecipe.id,
                timestamp: new Date().toISOString(),
                recipeData: originalRecipe,
            };
            const currentHistory = await getRecipeHistory();
            const newHistory = [...currentHistory, historyEntry];
            await saveRecipeHistory(newHistory);
            setRecipeHistory(newHistory); // Update state locally
        }

        const isNew = !originalRecipe;
        const newRecipes = isNew
            ? [...recipes, recipeToSave]
            : recipes.map(r => (r.id === recipeToSave.id ? recipeToSave : r));
        
        await saveRecipes(newRecipes);
        setRecipes(newRecipes);
        
        // Keep the user on the detail page after saving to see the updated analysis
        // The form's state will be updated via a useEffect hook listening to the `initialRecipe` prop.
        setSelectedRecipe(recipeToSave);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta receta? Esta acción no se puede deshacer.')) {
            const newRecipes = recipes.filter(r => r.id !== id);
            await saveRecipes(newRecipes);
            setRecipes(newRecipes);
            setView('list');
            setSelectedRecipe(null);
        }
    };
    
    const handleCopy = async (recipeToCopy: Recipe) => {
        const newRecipe: Recipe = {
            ...JSON.parse(JSON.stringify(recipeToCopy)), // Deep copy
            id: generateId(),
            name: `${recipeToCopy.name} (Copia)`
        };
    
        const newRecipes = [...recipes, newRecipe];
        await saveRecipes(newRecipes);
        setRecipes(newRecipes);
        setSelectedRecipe(newRecipe);
    };

    const handleAddNew = () => {
        const newRecipe: Recipe = {
            id: generateId(),
            name: 'Nueva Receta',
            category: 'Sin Analizar',
            yield: 1,
            salePrice: 0,
            ingredients: [],
            subRecipes: [],
            notes: ''
        };
        setSelectedRecipe(newRecipe);
        setView('detail');
    };

    const stats = useMemo(() => {
        if (!recipes || recipes.length === 0) {
            return { total: 0, unprocessed: 0, processed: 0 };
        }
        const total = recipes.length;
        const unprocessed = recipes.filter(r => r.category === 'Sin Analizar').length;
        const processed = total - unprocessed;
        return { total, unprocessed, processed };
    }, [recipes]);


    const filteredRecetas = useMemo(() => {
        return recipes
            .filter(receta => {
                const searchTermMatch = receta.name.toLowerCase().includes(searchTerm.toLowerCase());
                const categoryMatch = selectedCategory === 'all' || receta.category === selectedCategory;
                return searchTermMatch && categoryMatch;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [recipes, searchTerm, selectedCategory]);

    if (view === 'detail' && selectedRecipe) {
        const lastModified = recipeHistory
            .filter(h => h.recipeId === selectedRecipe.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            [0]?.timestamp;

        return <RecipeDetailPage 
            initialRecipe={selectedRecipe}
            onSave={handleSave}
            onCancel={() => { setView('list'); setSelectedRecipe(null); }}
            onDelete={handleDelete}
            onCopy={handleCopy}
            allIngredients={ingredients}
            allRecipes={recipes}
            setIsFormDirty={setIsFormDirty}
            lastModified={lastModified}
            globalWasteRate={globalWasteRate}
        />
    }

    if (view === 'history') {
        return <RecipeHistoryPage 
            onCancel={() => setView('list')}
            allRecipes={recipes}
            allIngredients={ingredients}
        />;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-white">Gestión de Recetas</h1>
                <div className="flex gap-4">
                     <Button variant="secondary" onClick={() => setView('history')}><History className="mr-2"/>Historial de Cambios</Button>
                    <Button onClick={handleAddNew}><PlusCircle className="mr-2"/>Nueva Receta</Button>
                </div>
            </div>

            {stats.total > 0 && (
                <Card className="mb-6 bg-accent/50 border border-gray-700">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center">
                            <Info size={20} className="text-brand mr-3" />
                            <p className="text-lg text-gray-300">
                                <span className="font-bold text-brand">{stats.processed}</span> de <span className="font-bold text-white">{stats.total}</span> recetas analizadas.
                            </p>
                        </div>
                        <div className="flex items-center text-sm text-gray-400">
                            <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: '#4a5568'}}></div>
                            <span>{stats.unprocessed} recetas pendientes (Sin Analizar)</span>
                        </div>
                    </div>
                </Card>
            )}

             <Card className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="md:col-span-2">
                        <Input label="Buscar por nombre..." id="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                     <div>
                        <Select label="Filtrar por categoría" id="categoryFilter" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                            <option value="all">Todas las categorías</option>
                            {RECIPE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </Select>
                    </div>
                </div>
            </Card>

            {filteredRecetas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredRecetas.map(recipe => (
                       <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            allIngredients={ingredients}
                            allRecipes={recipes}
                            onSelect={handleSelectRecipe}
                       />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-10">
                    <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                    <h3 className="text-xl font-semibold">No se encontraron recetas</h3>
                    <p className="text-gray-400 mt-2">Pruebe ajustando la búsqueda o añadiendo una nueva receta.</p>
                </Card>
            )}
        </div>
    );
};

export default RecipesPage;