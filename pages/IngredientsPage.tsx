import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getIngredients, saveIngredients, getGlobalWasteRate, saveGlobalWasteRate, getLowStockSettings, saveLowStockSettings } from '../services/db';
import type { Ingredient, LowStockSettings } from '../types';
import { generateId, formatCurrency } from '../lib/helpers';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { PlusCircle, Edit, Trash2, Database, SearchX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings, BellRing } from 'lucide-react';

const SortableHeader: React.FC<{
  label: string;
  sortKey: keyof Ingredient;
  sortConfig: { key: keyof Ingredient; direction: string } | null;
  onRequestSort: (key: keyof Ingredient) => void;
  className?: string;
}> = ({ label, sortKey, sortConfig, onRequestSort, className }) => {
  const isSorted = sortConfig?.key === sortKey;
  const icon = isSorted ? (sortConfig?.direction === 'ascending' ? <ChevronUp size={16} className="text-brand"/> : <ChevronDown size={16} className="text-brand"/>) : <ChevronUp size={16} className="text-transparent group-hover:text-gray-500"/>;

  return (
    <th className={`p-3 group ${className}`} onClick={() => onRequestSort(sortKey)} style={{cursor: 'pointer'}}>
      <div className="flex items-center gap-2">
        {label}
        {icon}
      </div>
    </th>
  );
};


const IngredientsPage: React.FC<{ setIsFormDirty: (isDirty: boolean) => void; }> = ({ setIsFormDirty }) => {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [currentIngredient, setCurrentIngredient] = useState<Partial<Ingredient>>({});
    const [initialIngredientState, setInitialIngredientState] = useState<Partial<Ingredient>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [errors, setErrors] = useState<Partial<Record<keyof Ingredient, string>>>({});
    const [globalWasteRate, setGlobalWasteRate] = useState(0);
    const [lowStockSettings, setLowStockSettings] = useState<LowStockSettings>({});

    // --- New state for sorting and pagination ---
    const [sortConfig, setSortConfig] = useState<{ key: keyof Ingredient, direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);


    const isDirty = useMemo(() => {
        return JSON.stringify(currentIngredient) !== JSON.stringify(initialIngredientState);
    }, [currentIngredient, initialIngredientState]);

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

    const loadData = useCallback(async () => {
        const [loadedIngredients, loadedRate, loadedSettings] = await Promise.all([
            getIngredients(),
            getGlobalWasteRate(),
            getLowStockSettings(),
        ]);
        setIngredients(loadedIngredients);
        setGlobalWasteRate(loadedRate);
        setLowStockSettings(loadedSettings);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- Sorting and Filtering Logic ---
     const requestSort = (key: keyof Ingredient) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page on sort
    };

    const sortedAndFilteredIngredients = useMemo(() => {
        let sortableItems = [...ingredients];
        
        // Sort
        sortableItems.sort((a, b) => {
            const key = sortConfig.key;
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';

            if (key === 'costPerUnit' || key === 'purchaseQuantity') {
                 return sortConfig.direction === 'ascending' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
            }

            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        // Filter
        if (!searchTerm) {
            return sortableItems;
        }
        return sortableItems.filter(ing =>
            ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ing.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ing.canonicalName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [ingredients, searchTerm, sortConfig]);
    
    const uniqueCanonicalNames = useMemo(() => {
        return [...new Set(ingredients.map(i => i.canonicalName || i.name))].sort();
    }, [ingredients]);

    // --- Pagination Logic ---
    const paginatedIngredients = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedAndFilteredIngredients.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedAndFilteredIngredients, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedAndFilteredIngredients.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page on search
    }, [searchTerm]);


    const handleInputChange = (field: keyof Ingredient, value: string | number) => {
        setCurrentIngredient({ ...currentIngredient, [field]: value });
    };

    const handleGlobalWasteRateChange = async (value: string) => {
        const rate = parseInt(value, 10);
        if (!isNaN(rate) && rate >= 0 && rate <= 100) {
            setGlobalWasteRate(rate);
            await saveGlobalWasteRate(rate);
        } else if (value === '') {
            setGlobalWasteRate(0);
            await saveGlobalWasteRate(0);
        }
    };
    
    const handleLowStockSettingChange = async (name: string, value: string) => {
        const newSettings = { ...lowStockSettings, [name]: parseFloat(value) || 0 };
        setLowStockSettings(newSettings);
        await saveLowStockSettings(newSettings);
    };

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof Ingredient, string>> = {};
        const { name, unit, costPerUnit, purchaseQuantity } = currentIngredient;

        if (!name?.trim()) {
            newErrors.name = 'El nombre es requerido.';
        }
        if (!unit) {
            newErrors.unit = 'La unidad es requerida.';
        }
        if (costPerUnit === undefined || isNaN(costPerUnit) || costPerUnit <= 0) {
            newErrors.costPerUnit = 'El costo debe ser un número mayor a 0.';
        }
        if (purchaseQuantity === undefined || isNaN(purchaseQuantity) || purchaseQuantity <= 0) {
            newErrors.purchaseQuantity = 'La cantidad debe ser un número mayor a 0.';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) {
            return;
        }

        let updatedIngredients;
        if (isEditing && currentIngredient.id) {
            updatedIngredients = ingredients.map(ing => ing.id === currentIngredient.id ? (currentIngredient as Ingredient) : ing);
        } else {
            updatedIngredients = [...ingredients, { ...currentIngredient, id: generateId() } as Ingredient];
        }

        // If the saved ingredient has a name and a canonicalName has been set (even to blank),
        // apply this canonicalName to all other ingredients with the same invoice name.
        const { name, canonicalName } = currentIngredient;
        if (name && canonicalName !== undefined) {
            const lowerCaseName = name.toLowerCase();
            updatedIngredients = updatedIngredients.map(ing => {
                if (ing.name.toLowerCase() === lowerCaseName) {
                    return { ...ing, canonicalName: canonicalName || undefined };
                }
                return ing;
            });
        }

        await saveIngredients(updatedIngredients);
        setIngredients(updatedIngredients);
        resetForm();
    };

    const handleEdit = (ingredient: Ingredient) => {
        setCurrentIngredient(ingredient);
        setInitialIngredientState(ingredient);
        setIsEditing(true);
        setErrors({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro de compra?')) {
            const newIngredients = ingredients.filter(ing => ing.id !== id);
            await saveIngredients(newIngredients);
            setIngredients(newIngredients);
            if(currentIngredient.id === id) {
                resetForm();
            }
        }
    };

    const resetForm = () => {
        setCurrentIngredient({ purchaseQuantity: 1 }); // Default purchase quantity to 1
        setInitialIngredientState({ purchaseQuantity: 1 });
        setIsEditing(false);
        setErrors({});
    };
    
    useEffect(() => {
        resetForm(); // Set default on initial load
    }, []);


    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-8">Gestión de Compras de Insumos</h1>
            
             <Card className="mb-8">
                <h2 className="text-2xl font-bold text-brand mb-2 flex items-center"><BellRing className="mr-3"/>Configuración de Stock Mínimo</h2>
                <p className="text-sm text-gray-400 mb-4">
                    Establezca la cantidad mínima para cada insumo. Cuando el stock teórico caiga por debajo de este umbral, recibirá una alerta en el Dashboard.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 max-h-72 overflow-y-auto pr-2">
                    {uniqueCanonicalNames.map(name => (
                         <div key={name} className="flex items-center gap-3">
                            <label htmlFor={`low-stock-${name}`} className="flex-1 text-gray-300 truncate">{name}</label>
                            <Input
// FIX: The 'label' prop is required. Provide an empty string as other parts of the codebase do when an external label is used.
                                label=""
                                id={`low-stock-${name}`}
                                type="number"
                                value={lowStockSettings[name] || ''}
                                onBlur={(e) => handleLowStockSettingChange(name, e.target.value)}
                                onChange={(e) => setLowStockSettings(prev => ({...prev, [name]: parseFloat(e.target.value) || 0}))}
                                className="w-28"
                                placeholder="0"
                                min="0"
                            />
                         </div>
                    ))}
                </div>
            </Card>

            <Card className="mb-8">
                <h2 className="text-2xl font-bold text-brand mb-2 flex items-center"><Settings className="mr-3"/>Configuración Global de Merma</h2>
                <p className="text-sm text-gray-400 mb-4">
                    Esta tasa de merma se aplicará por defecto a cada nuevo insumo que añada a una receta. Puede sobrescribirla individualmente en la página de recetas.
                </p>
                <div className="max-w-xs">
                    <Input
                        label="Tasa de Merma Global por Defecto (%)"
                        id="globalWasteRate"
                        type="number"
                        value={globalWasteRate}
                        onChange={(e) => handleGlobalWasteRateChange(e.target.value)}
                        min="0"
                        max="100"
                        step="1"
                    />
                </div>
            </Card>

            <Card className="mb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-2xl font-bold text-brand">{isEditing ? 'Editar Registro de Compra' : 'Añadir Registro de Compra'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <Input
                            label="Nombre del Insumo (según factura)"
                            id="ingName"
                            type="text"
                            value={currentIngredient.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            error={errors.name}
                        />
                        <Input
                            label="Nombre Unificado (Opcional)"
                            id="ingCanonicalName"
                            type="text"
                            placeholder="Ej: Jamón Cocido"
                            value={currentIngredient.canonicalName || ''}
                            onChange={(e) => handleInputChange('canonicalName', e.target.value)}
                        />
                         <Input
                            label="Proveedor"
                            id="ingSupplier"
                            type="text"
                            value={currentIngredient.supplier || ''}
                            onChange={(e) => handleInputChange('supplier', e.target.value)}
                        />
                         <Input
                            label="Fecha de Compra"
                            id="ingPurchaseDate"
                            type="date"
                            value={currentIngredient.purchaseDate ? currentIngredient.purchaseDate.split('T')[0] : ''}
                            onChange={(e) => handleInputChange('purchaseDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                        />
                        <Input
                            label="Cantidad Comprada"
                            id="ingQty"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={currentIngredient.purchaseQuantity || ''}
                            onChange={(e) => handleInputChange('purchaseQuantity', parseFloat(e.target.value))}
                            error={errors.purchaseQuantity}
                        />
                         <Select
                            label="Unidad de Medida"
                            id="ingUnit"
                            value={currentIngredient.unit || ''}
                            onChange={(e) => handleInputChange('unit', e.target.value)}
                            error={errors.unit}
                        >
                            <option value="">Seleccione</option>
                            <option value="kg">Kilogramo (kg)</option>
                            <option value="g">Gramo (g)</option>
                            <option value="l">Litro (l)</option>
                            <option value="ml">Mililitro (ml)</option>
                            <option value="unidad">Unidad</option>
                        </Select>
                        <div className="md:col-span-3">
                             <Input
                                label="Costo por Unidad"
                                id="ingCost"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={currentIngredient.costPerUnit || ''}
                                onChange={(e) => handleInputChange('costPerUnit', parseFloat(e.target.value))}
                                error={errors.costPerUnit}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                        <Button type="submit">
                            <PlusCircle className="mr-2"/>
                            {isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
                        </Button>
                        {isEditing && <Button type="button" variant="secondary" onClick={resetForm}>Cancelar Edición</Button>}
                    </div>
                </form>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4">Lista de Compras ({sortedAndFilteredIngredients.length})</h2>
                 <div className="mb-4">
                    <Input
                        label="Buscar por nombre, unificado o proveedor..."
                        id="search-ingredient"
                        placeholder="Ej: Harina, Tomate, Distribuidora ABC..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-accent">
                            <tr>
                                <SortableHeader label="Nombre (Factura)" sortKey="name" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Nombre Unificado" sortKey="canonicalName" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Proveedor" sortKey="supplier" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Fecha Compra" sortKey="purchaseDate" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Cant. Comprada" sortKey="purchaseQuantity" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Unidad" sortKey="unit" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <SortableHeader label="Costo por Unidad" sortKey="costPerUnit" sortConfig={sortConfig} onRequestSort={requestSort} />
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedIngredients.length > 0 ? paginatedIngredients.map(ing => (
                                <tr key={ing.id} className={`border-b border-accent transition-colors duration-200 ${isEditing && currentIngredient.id === ing.id ? 'bg-brand/20' : 'hover:bg-accent'}`}>
                                    <td className="p-3 font-semibold">{ing.name}</td>
                                    <td className="p-3 text-gray-400 italic">{ing.canonicalName || '-'}</td>
                                    <td className="p-3">{ing.supplier || 'N/A'}</td>
                                    <td className="p-3">{ing.purchaseDate ? new Date(ing.purchaseDate).toLocaleDateString('es-AR') : 'N/A'}</td>
                                    <td className="p-3 font-mono text-right">{ing.purchaseQuantity.toLocaleString('es-AR')}</td>
                                    <td className="p-3">{ing.unit}</td>
                                    <td className="p-3 font-mono">{formatCurrency(ing.costPerUnit)}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="secondary" onClick={() => handleEdit(ing)}><Edit size={16}/></Button>
                                            <Button variant="danger" onClick={() => handleDelete(ing.id)}><Trash2 size={16}/></Button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="text-center p-6 text-gray-400">
                                       {searchTerm ? (
                                            <>
                                                <SearchX className="w-12 h-12 mx-auto mb-2"/>
                                                <span>No se encontraron insumos para "<strong>{searchTerm}</strong>".</span>
                                            </>
                                        ) : (
                                            <>
                                                <Database className="w-12 h-12 mx-auto mb-2"/>
                                                No hay registros de compra.
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                 {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-accent">
                        <Button
                            variant="secondary"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={16} className="mr-2"/> Anterior
                        </Button>
                        <span className="text-sm text-gray-400">
                            Página {currentPage} de {totalPages}
                        </span>
                        <Button
                            variant="secondary"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente <ChevronRight size={16} className="ml-2"/>
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default IngredientsPage;