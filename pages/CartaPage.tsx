import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { getRecipes, getIngredients, getMenuData, saveMenuData, getMenuMappings, saveMenuMappings } from '../services/db';
import { calculateRecipeCost } from '../services/calculation';
import type { Recipe, Ingredient, MenuData, MenuItem, MenuSection, MenuRecipeMappings } from '../types';
import { formatCurrency, generateId } from '../lib/helpers';
import { VAT_RATE } from '../lib/constants';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { BookText, ChefHat, AlertTriangle, Link as LinkIcon, XCircle, Download, Edit, Save, X, PlusCircle, Trash2 } from 'lucide-react';

// --- Default Data Structure for the Menu (used on first load) ---
const defaultMenuStructure: MenuData = [
    { title: "ENTRADAS", items: [
      { id: generateId(), name: "Tabla de Quesos y Fiambres", price: 16500 }, { id: generateId(), name: "Rabas", price: 19000 },
      { id: generateId(), name: "Gambas al Ajillo", price: 19000 }, { id: generateId(), name: "Langostinos Panados", price: 19500 },
      { id: generateId(), name: "Matambre Casero con Ensalada Rusa", price: 15500 }, { id: generateId(), name: "Tortilla de Papas", price: 12500 },
      { id: generateId(), name: "Empanadas de carne cortada a cuchillo (2 unidades)", price: 6500 }, { id: generateId(), name: "Sopa cremosa de calabaza", price: 9000 }
    ]},
    { title: "ENSALADAS", items: [
      { id: generateId(), name: "Caesar", price: 14900 }, { id: generateId(), name: "Ensalada Balmoral", price: 15900 },
      { id: generateId(), name: "Tres ingredientes a elección", price: 13900 }, { id: generateId(), name: "Cinco ingredientes a elección", price: 15900 }
    ]},
    { title: "PASTAS CASERAS", items: [
      { id: generateId(), name: "Sorrentinos de Jamón y Queso con Salsa Filetto", price: 19000 }, { id: generateId(), name: "Ravioles de Verdura con Crema", price: 19000 },
      { id: generateId(), name: "Tagliatelle con Boloñesa", price: 19000 }, { id: generateId(), name: "Lasagna Napolitana con Salsa Mixta", price: 19500 },
      { id: generateId(), name: "Ñoquis de Papa con Salsa Rosa", price: 18500 }, { id: generateId(), name: "Canelones de Verdura con Salsa Filetto", price: 19500 },
      { id: generateId(), name: "Ravioles de Osobuco con crema de vegetales", price: 19500 }
    ]},
    { title: "PLATOS PRINCIPALES", items: [
      { id: generateId(), name: "Ojo de Bife con Papas fritas", price: 22000 }, { id: generateId(), name: "Bondiola de Cerdo al Verdeo con Papas Españolas", price: 20500 },
      { id: generateId(), name: "Pollo al Ajillo con Papas fritas", price: 20000 }, { id: generateId(), name: "Milanesa de Peceto Napolitana con Puré de Papas", price: 20000 },
      { id: generateId(), name: "Suprema de Pollo Napolitana con Puré de Papas", price: 19500 }, { id: generateId(), name: "Pesca del día con Boñato Asado", price: 20500 },
      { id: generateId(), name: "Arroz con Vegetales Salteados", price: 19200 }
    ]},
    { title: "NUESTRAS SUGERENCIAS", items: [
      { id: generateId(), name: "Milanesa con Fideos a la Crema", price: 21500 }, { id: generateId(), name: "Pollo a la Crema", price: 21800 },
      { id: generateId(), name: "Tournedó de Lomo", price: 23200 }, { id: generateId(), name: "Pesca del día Dos Reyes", price: 22000 },
      { id: generateId(), name: "Hamburguesa Casera", price: 19000 }, { id: generateId(), name: "Osobuco con Puré de Boniato", price: 22200 }
    ]},
    { title: "POSTRES", items: [
      { id: generateId(), name: "Flan con dulce de leche y crema", price: 5800 }, { id: generateId(), name: "Budin de pan", price: 5600 },
      { id: generateId(), name: "Peras al vino Borgoña", price: 5900 }, { id: generateId(), name: "Queso y Dulce", price: 5500 },
      { id: generateId(), name: "Panqueques con dulce de leche", price: 5700 }, { id: generateId(), name: "Variedad de Helados", price: 4500 },
      { id: generateId(), name: "Ensalada de Fruta", price: 4900 }, { id: generateId(), name: "Bombón Suizo", price: 4900 },
      { id: generateId(), name: "Almendrado", price: 4900 }, { id: generateId(), name: "Mousse de chocolate", price: 5500 }, { id: generateId(), name: "Affogato", price: 5200 }
    ]},
    { title: "SANDWICHES", items: [
      { id: generateId(), name: "Ciabatta Jamón Cocido y Queso", price: 10800 }, { id: generateId(), name: "Ciabatta Jamón Crudo y Queso", price: 12500 },
      { id: generateId(), name: "Tostado de Jamón y Queso", price: 8800 }
    ]},
    { title: "VINOS TINTOS", items: [
      { id: generateId(), name: "MEG Blend", price: 49000 }, { id: generateId(), name: "The President's Blend", price: 41500 },
      { id: generateId(), name: "Pequeñas Producciones Malbec", price: 39000 }, { id: generateId(), name: "Pequeñas Producciones Cabernet Franc", price: 39000 },
      { id: generateId(), name: "Escorihuela Gran Reserva Malbec", price: 25000 }, { id: generateId(), name: "Escorihuela Gascón Malbec", price: 16500 },
      { id: generateId(), name: "Escorihuela Gascón Cabernet Franc", price: 16500 }, { id: generateId(), name: "DV Catena Cabernet - Malbec", price: 25000 },
      { id: generateId(), name: "Saint Felicien Malbec", price: 23000 }, { id: generateId(), name: "Saint Felicien Pinot Noir", price: 23500 },
      { id: generateId(), name: "Fond de Cave Reserva Malbec", price: 17500 }, { id: generateId(), name: "Fond de Cave Reserva Cabernet-Franc", price: 17500 },
      { id: generateId(), name: "Medalla Malbec", price: 25000 }, { id: generateId(), name: "Gran Medalla Malbec", price: 51500 },
      { id: generateId(), name: "Costa & Pampa Pinot Noir", price: 28000 }, { id: generateId(), name: "La Mascota Malbec", price: 25000 }, { id: generateId(), name: "Gran Mascota Malbec", price: 28000 }
    ]},
    { title: "VINOS BLANCOS Y ROSADOS", items: [
      { id: generateId(), name: "Escorihuela Gran Reserva Chardonnay", price: 25000 }, { id: generateId(), name: "Escorihuela Gascón Chardonnay", price: 16500 },
      { id: generateId(), name: "Familia Gascón Chardonnay", price: 14500 }, { id: generateId(), name: "Familia Gascón Dulce Cosecha", price: 14500 },
      { id: generateId(), name: "Familia Gascón Rosé", price: 14500 }, { id: generateId(), name: "Saint Felicien Sauvignon Blanc", price: 23500 }
    ]},
    { title: "ESPUMANTES", items: [
      { id: generateId(), name: "Baron B Extra Brut", price: 42500 }, { id: generateId(), name: "Chandon Extra Brut", price: 28500 },
      { id: generateId(), name: "Escorihuela Gascón Extra Brut", price: 24500 }
    ]}
];

// --- Helper component for each menu item row ---
const MenuItemRow: React.FC<{
    item: MenuItem;
    recipes: Recipe[];
    ingredients: Ingredient[];
    mappedRecipeId: string | undefined;
    onMappingChange: (menuItemId: string, recipeId: string) => void;
    onNavigateToRecipe: (recipe: Recipe) => void;
}> = ({ item, recipes, ingredients, mappedRecipeId, onMappingChange, onNavigateToRecipe }) => {
    
    const foundRecipe = useMemo(() => {
        if (mappedRecipeId) return recipes.find(r => r.id === mappedRecipeId);
        return recipes.find(r => r.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    }, [mappedRecipeId, item.name, recipes]);

    const { margin } = useMemo(() => {
        if (!foundRecipe) return { margin: null };
        const costPerServing = calculateRecipeCost(foundRecipe, ingredients, recipes);
        const costWithVAT = costPerServing * (1 + VAT_RATE);
        const profit = item.price - costWithVAT;
        const margin = item.price > 0 ? (profit / item.price) * 100 : 0;
        return { margin };
    }, [foundRecipe, item.price, ingredients, recipes]);
    
    return (
        <tr className="border-b border-accent hover:bg-accent/50 transition-colors">
            <td className="p-3 font-semibold text-white">{item.name}</td>
            <td className="p-3 font-mono text-right">{formatCurrency(item.price)}</td>
            <td className="p-3 w-1/3">
                {foundRecipe ? (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300 italic truncate printable-full-text" title={foundRecipe.name}>
                            {foundRecipe.name}
                        </span>
                        <div className="non-printable-buttons flex items-center gap-2 flex-shrink-0 ml-2">
                            <button onClick={() => onNavigateToRecipe(foundRecipe)} className="text-brand hover:text-teal-300" title="Ver Receta">
                                <LinkIcon size={16} />
                            </button>
                            <button onClick={() => onMappingChange(item.id, '')} className="text-gray-500 hover:text-red-400" title="Desvincular Receta">
                                <XCircle size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="non-printable-select">
                            <Select label="" id={`map-${item.id}`} value="" onChange={(e) => onMappingChange(item.id, e.target.value)}>
                                <option value="">Asociar una receta...</option>
                                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </Select>
                        </div>
                        <div className="printable-only-text text-sm text-gray-500 italic">(Sin asociar)</div>
                    </>
                )}
            </td>
            <td className="p-3 font-mono text-right">
                {margin !== null ? (
                    <span className={`font-bold text-lg ${margin < 40 ? 'text-red-500' : 'text-green-400'}`}>
                        {margin.toFixed(1)}%
                    </span>
                ) : (
                    <span className="text-sm text-gray-500">-</span>
                )}
            </td>
        </tr>
    );
};


// --- Main Page Component ---
const CartaPage: React.FC<{ onNavigateToRecipe: (recipe: Recipe) => void }> = ({ onNavigateToRecipe }) => {
    const [loading, setLoading] = useState(true);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [mappings, setMappings] = useState<MenuRecipeMappings>({});
    const [menuData, setMenuData] = useState<MenuData | null>(null);
    const [isSavingPNG, setIsSavingPNG] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editableMenuData, setEditableMenuData] = useState<MenuData | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [loadedRecipes, loadedIngredients, loadedMenu, loadedMappings] = await Promise.all([
                    getRecipes(), 
                    getIngredients(),
                    getMenuData(),
                    getMenuMappings()
                ]);
                
                loadedRecipes.sort((a, b) => a.name.localeCompare(b.name));
                setRecipes(loadedRecipes);
                setIngredients(loadedIngredients);
                setMappings(loadedMappings);
                
                if (loadedMenu) {
                    setMenuData(loadedMenu);
                } else {
                    setMenuData(defaultMenuStructure);
                    await saveMenuData(defaultMenuStructure);
                }
            } catch (error) {
                console.error("Error loading data for carta:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleMappingChange = useCallback(async (menuItemId: string, recipeId: string) => {
        const newMappings = { ...mappings };
        if (recipeId) {
            newMappings[menuItemId] = recipeId;
        } else {
            delete newMappings[menuItemId];
        }
        setMappings(newMappings);
        await saveMenuMappings(newMappings);
    }, [mappings]);
    
    const handleEnterEditMode = () => {
        setEditableMenuData(JSON.parse(JSON.stringify(menuData))); // Deep copy for editing
        setIsEditMode(true);
    };

    const handleCancelEditMode = () => {
        setIsEditMode(false);
        setEditableMenuData(null);
    };

    const handleSaveMenu = async () => {
        if (!editableMenuData) return;
        await saveMenuData(editableMenuData);
        setMenuData(editableMenuData);
        setIsEditMode(false);
        setEditableMenuData(null);
    };

    const handleMenuChange = (sectionIndex: number, itemIndex: number, field: 'name' | 'price', value: string | number) => {
        if (!editableMenuData) return;
        const newMenuData = [...editableMenuData];
        const item = newMenuData[sectionIndex].items[itemIndex];
        (item[field] as any) = value;
        setEditableMenuData(newMenuData);
    };
    
    const handleSectionTitleChange = (sectionIndex: number, value: string) => {
        if (!editableMenuData) return;
        const newMenuData = [...editableMenuData];
        newMenuData[sectionIndex].title = value;
        setEditableMenuData(newMenuData);
    };

    const handleAddItem = (sectionIndex: number) => {
        if (!editableMenuData) return;
        const newMenuData = [...editableMenuData];
        newMenuData[sectionIndex].items.push({ id: generateId(), name: 'Nuevo Producto', price: 0 });
        setEditableMenuData(newMenuData);
    };

    const handleDeleteItem = (sectionIndex: number, itemIndex: number) => {
        if (!editableMenuData) return;
        if (!window.confirm("¿Está seguro de que desea eliminar este producto de la carta?")) return;
        const newMenuData = [...editableMenuData];
        newMenuData[sectionIndex].items.splice(itemIndex, 1);
        setEditableMenuData(newMenuData);
    };

     const handleAddSection = () => {
        if (!editableMenuData) return;
        const newMenuData = [...editableMenuData, { title: 'Nueva Sección', items: [] }];
        setEditableMenuData(newMenuData);
    };

    const handleDeleteSection = (sectionIndex: number) => {
        if (!editableMenuData) return;
        if (!window.confirm("¿Está seguro de que desea eliminar esta sección completa de la carta?")) return;
        const newMenuData = [...editableMenuData];
        newMenuData.splice(sectionIndex, 1);
        setEditableMenuData(newMenuData);
    };


    const handleSaveAsPNG = async () => {
        if (!menuRef.current || isSavingPNG) return;
        if (isEditMode) {
            alert("Por favor, guarde o cancele los cambios antes de exportar.");
            return;
        }

        setIsSavingPNG(true);
        menuRef.current.classList.add('preparing-png');

        try {
            const canvas = await html2canvas(menuRef.current, {
                backgroundColor: '#1a202c',
                scale: 2,
                useCORS: true,
            });
            const link = document.createElement('a');
            link.download = 'carta_restaurante_rentabilidad.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Error generating PNG:", error);
            alert("Hubo un error al guardar la imagen de la carta.");
        } finally {
            if (menuRef.current) menuRef.current.classList.remove('preparing-png');
            setIsSavingPNG(false);
        }
    };
    
    const currentData = isEditMode ? editableMenuData : menuData;

    if (loading || !currentData) {
        return <div className="text-center p-10">Cargando carta y recetas...</div>;
    }

    if (recipes.length === 0 && !isEditMode) {
         return (
            <Card className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">No hay recetas cargadas</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                    Para poder vincular la carta, primero debe crear algunas recetas en la sección correspondiente.
                </p>
            </Card>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <h1 className="text-4xl font-bold text-white flex items-center">
                    <BookText className="mr-4"/> Carta y Rentabilidad
                </h1>
                <div className="flex items-center gap-4">
                    {isEditMode ? (
                        <>
                            <Button variant="secondary" onClick={handleCancelEditMode}><X className="mr-2" /> Cancelar</Button>
                            <Button onClick={handleSaveMenu}><Save className="mr-2" /> Guardar Cambios</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={handleEnterEditMode}><Edit className="mr-2" /> Editar Carta</Button>
                            <Button onClick={handleSaveAsPNG} disabled={isSavingPNG}>
                                <Download className="mr-2" />
                                {isSavingPNG ? 'Guardando...' : 'Guardar como PNG'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <div ref={menuRef}>
                <div className="space-y-8">
                    {currentData.map((section, sectionIndex) => (
                        <Card key={sectionIndex}>
                            <div className="flex justify-between items-center mb-4">
                                {isEditMode ? (
                                    <Input 
                                        label=""
                                        value={section.title}
                                        onChange={(e) => handleSectionTitleChange(sectionIndex, e.target.value)}
                                        className="text-2xl font-bold text-brand !p-2 !bg-accent"
                                    />
                                ) : (
                                    <h2 className="text-2xl font-bold text-brand flex items-center">
                                       <ChefHat className="mr-3" /> {section.title}
                                    </h2>
                                )}
                                {isEditMode && (
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteSection(sectionIndex)}><Trash2 size={16} /></Button>
                                )}
                            </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b-2 border-accent">
                                        <tr>
                                            <th className="p-3">Producto</th>
                                            <th className="p-3 text-right">Precio</th>
                                            {!isEditMode && <th className="p-3">Receta Asociada</th>}
                                            {!isEditMode && <th className="p-3 text-right">Margen</th>}
                                            {isEditMode && <th className="p-3 text-right">Acciones</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.items.map((item, itemIndex) => 
                                            isEditMode ? (
                                                <tr key={item.id} className="border-b border-accent">
                                                    <td className="p-2"><Input label="" value={item.name} onChange={e => handleMenuChange(sectionIndex, itemIndex, 'name', e.target.value)} /></td>
                                                    <td className="p-2 w-40"><Input label="" type="number" value={item.price} onChange={e => handleMenuChange(sectionIndex, itemIndex, 'price', parseFloat(e.target.value) || 0)} /></td>
                                                    <td className="p-2 text-right">
                                                        <Button variant="danger" size="sm" onClick={() => handleDeleteItem(sectionIndex, itemIndex)}><Trash2 size={16}/></Button>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <MenuItemRow 
                                                    key={item.id}
                                                    item={item}
                                                    recipes={recipes}
                                                    ingredients={ingredients}
                                                    mappedRecipeId={mappings[item.id]}
                                                    onMappingChange={handleMappingChange}
                                                    onNavigateToRecipe={onNavigateToRecipe}
                                                />
                                            )
                                        )}
                                    </tbody>
                                </table>
                                {isEditMode && (
                                    <Button variant="secondary" className="mt-4" onClick={() => handleAddItem(sectionIndex)}><PlusCircle size={16} className="mr-2" />Añadir Producto</Button>
                                )}
                            </div>
                        </Card>
                    ))}
                    {isEditMode && (
                        <Button onClick={handleAddSection} className="w-full"><PlusCircle size={18} className="mr-2"/>Añadir Nueva Sección</Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CartaPage;