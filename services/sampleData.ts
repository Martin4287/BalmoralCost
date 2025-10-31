import { generateId } from '../lib/helpers';
import type { Ingredient, Recipe, ProductSale, ProductPrice } from '../types';
import { saveIngredients, saveRecipes, saveProductSales, saveProductPrices } from './db';

// --- INGREDIENTS ---
const createIngredient = (name: string, unit: Ingredient['unit'], costPerUnit: number, purchaseQuantity: number, purchaseDate: string, supplier: string, canonicalName?: string): Ingredient => ({ id: generateId(), name, unit, costPerUnit, purchaseQuantity, purchaseDate, supplier, canonicalName });

export const sampleIngredients: Ingredient[] = [
    createIngredient('Harina 0000', 'kg', 300, 25, new Date('2024-07-01').toISOString(), 'Distribuidora ABC', 'Harina de Trigo'),
    createIngredient('Harina de Trigo 0000', 'kg', 320, 25, new Date('2024-08-01').toISOString(), 'Distribuidora ABC', 'Harina de Trigo'),
    createIngredient('Levadura Fresca', 'g', 20, 500, new Date('2024-07-10').toISOString(), 'Distribuidora ABC', 'Levadura'),
    createIngredient('Sal Fina', 'kg', 200, 10, new Date('2024-07-01').toISOString(), 'Distribuidora ABC', 'Sal'),
    createIngredient('Azúcar Blanca', 'kg', 400, 10, new Date('2024-07-01').toISOString(), 'Distribuidora ABC', 'Azúcar'),
    createIngredient('Aceite de Oliva Extra Virgen', 'l', 3000, 5, new Date('2024-07-15').toISOString(), 'Olivares Cuyo', 'Aceite de Oliva'),
    createIngredient('Tomate Perita en lata', 'kg', 550, 20, new Date('2024-07-28').toISOString(), 'Mercado Central', 'Tomate Perita'),
    createIngredient('Tomate Perita fresco', 'kg', 600, 20, new Date('2024-08-05').toISOString(), 'Mercado Central', 'Tomate Perita'),
    createIngredient('Ajo', 'unidad', 50, 30, new Date('2024-08-01').toISOString(), 'Mercado Central'),
    createIngredient('Queso Mozzarella', 'kg', 2500, 15, new Date('2024-07-25').toISOString(), 'Lácteos del Sur'),
    createIngredient('Albahaca Fresca', 'g', 15, 250, new Date('2024-08-03').toISOString(), 'Quinta Fresca'),
    createIngredient('Pechuga de Pollo', 'kg', 2800, 10, new Date('2024-08-02').toISOString(), 'Avícola San Juan'),
    createIngredient('Lechuga Romana', 'unidad', 400, 24, new Date('2024-08-04').toISOString(), 'Quinta Fresca'),
    createIngredient('Pan de Molde', 'kg', 1200, 5, new Date('2024-08-01').toISOString(), 'Panificadora El Trigo'),
    createIngredient('Anchoas', 'kg', 8000, 1, new Date('2024-06-15').toISOString(), 'Del Mar S.A.'),
    createIngredient('Queso Parmesano', 'kg', 6000, 4, new Date('2024-07-25').toISOString(), 'Lácteos del Sur'),
    createIngredient('Huevo', 'unidad', 100, 180, new Date('2024-08-01').toISOString(), 'Granja La Feliz'),
    createIngredient('Carne para Milanesa (Nalga)', 'kg', 5000, 10, new Date('2024-08-02').toISOString(), 'Frigorífico Las Pampas'),
    createIngredient('Pan Rallado', 'kg', 800, 5, new Date('2024-07-20').toISOString(), 'Panificadora El Trigo'),
    createIngredient('Papa', 'kg', 400, 30, new Date('2024-08-01').toISOString(), 'Mercado Central'),
    createIngredient('Aceite para Freir', 'l', 1500, 20, new Date('2024-07-15').toISOString(), 'Distribuidora ABC'),
    createIngredient('Lomo', 'kg', 7000, 8, new Date('2024-08-02').toISOString(), 'Frigorífico Las Pampas'),
    createIngredient('Pan de Hamburguesa', 'unidad', 250, 100, new Date('2024-08-03').toISOString(), 'Panificadora El Trigo'),
    createIngredient('Panceta', 'kg', 4500, 5, new Date('2024-07-30').toISOString(), 'Frigorífico Las Pampas'),
    createIngredient('Queso Cheddar', 'kg', 3800, 5, new Date('2024-07-25').toISOString(), 'Lácteos del Sur'),
];

// Helper to get the ID of the most recent purchase for sample data creation
const getLatestPurchaseId = (name: string, allIngredients: Ingredient[]): string => {
    // This helper now finds based on canonical name if available, then falls back to name.
    const purchases = allIngredients.filter(i => (i.canonicalName || i.name) === name);
    if (!purchases || purchases.length === 0) {
        // Fallback for names that don't have a canonical name yet in the list
         const fallbackPurchases = allIngredients.filter(i => i.name === name);
         if (!fallbackPurchases || fallbackPurchases.length === 0) throw new Error(`Sample ingredient not found: ${name}`);
         fallbackPurchases.sort((a, b) => new Date(b.purchaseDate!).getTime() - new Date(a.purchaseDate!).getTime());
         return fallbackPurchases[0].id;
    }
    purchases.sort((a, b) => new Date(b.purchaseDate!).getTime() - new Date(a.purchaseDate!).getTime());
    return purchases[0].id;
};


// --- RECIPES ---
// First, create the sub-recipes that will be reused, so they have an ID.
const salsaDeTomateRecipe: Recipe = {
    id: generateId(),
    name: 'Salsa de Tomate para Pizza',
    category: 'Producción',
    yield: 10,
    salePrice: 0,
    ingredients: [
        { ingredientId: getLatestPurchaseId('Tomate Perita', sampleIngredients), quantity: 2, unit: 'kg', wastePercentage: 10 },
        { ingredientId: getLatestPurchaseId('Aceite de Oliva', sampleIngredients), quantity: 0.1, unit: 'l', wastePercentage: 0 },
        { ingredientId: getLatestPurchaseId('Ajo', sampleIngredients), quantity: 2, unit: 'unidad', wastePercentage: 20 },
        { ingredientId: getLatestPurchaseId('Sal', sampleIngredients), quantity: 0.02, unit: 'kg', wastePercentage: 0 },
    ],
    subRecipes: [],
    notes: 'Receta de ejemplo generada automáticamente.'
};

const polloGrilladoRecipe: Recipe = {
    id: generateId(),
    name: 'Pollo Grillado para Ensalada',
    category: 'Producción',
    yield: 5,
    salePrice: 0,
    ingredients: [
        { ingredientId: getLatestPurchaseId('Pechuga de Pollo', sampleIngredients), quantity: 1, unit: 'kg', wastePercentage: 25 },
        { ingredientId: getLatestPurchaseId('Sal', sampleIngredients), quantity: 0.01, unit: 'kg', wastePercentage: 0 },
    ],
    subRecipes: [],
    notes: 'Receta de ejemplo generada automáticamente.'
};

const papasFritasRecipe: Recipe = {
    id: generateId(),
    name: 'Papas Fritas (porción)',
    category: 'Guarnición',
    yield: 1,
    salePrice: 0,
    ingredients: [
        { ingredientId: getLatestPurchaseId('Papa', sampleIngredients), quantity: 0.3, unit: 'kg', wastePercentage: 20 },
        { ingredientId: getLatestPurchaseId('Aceite para Freir', sampleIngredients), quantity: 0.05, unit: 'l', wastePercentage: 0 },
        { ingredientId: getLatestPurchaseId('Sal', sampleIngredients), quantity: 0.005, unit: 'kg', wastePercentage: 0 },
    ],
    subRecipes: [],
    notes: 'Porción de guarnición de papas fritas.'
};

const ensaladaRusaRecipe: Recipe = {
    id: generateId(),
    name: 'Ensalada Rusa (porción)',
    category: 'Guarnición',
    yield: 1,
    salePrice: 0,
    ingredients: [
        { ingredientId: getLatestPurchaseId('Papa', sampleIngredients), quantity: 0.15, unit: 'kg', wastePercentage: 20 },
        { ingredientId: getLatestPurchaseId('Huevo', sampleIngredients), quantity: 1, unit: 'unidad', wastePercentage: 5 },
    ],
    subRecipes: [],
    notes: 'Porción de ensalada rusa como guarnición.'
};


// Next, create the main dishes, referencing the sub-recipes by their new IDs.
let mainDishes: Recipe[] = [
    {
        id: generateId(), name: 'Pizza Margherita', category: 'Plato Principal', yield: 1, salePrice: 4500,
        ingredients: [
            { ingredientId: getLatestPurchaseId('Harina de Trigo', sampleIngredients), quantity: 0.25, unit: 'kg', wastePercentage: 2 },
            { ingredientId: getLatestPurchaseId('Levadura', sampleIngredients), quantity: 5, unit: 'g', wastePercentage: 0 },
            { ingredientId: getLatestPurchaseId('Queso Mozzarella', sampleIngredients), quantity: 0.2, unit: 'kg', wastePercentage: 5 },
            { ingredientId: getLatestPurchaseId('Albahaca Fresca', sampleIngredients), quantity: 10, unit: 'g', wastePercentage: 10 },
        ],
        subRecipes: [{ recipeId: salsaDeTomateRecipe.id, quantity: 0.1 }],
        notes: 'Receta de ejemplo generada automáticamente.'
    },
    {
        id: generateId(), name: 'Ensalada Caesar con Pollo', category: 'Ensalada', yield: 1, salePrice: 5500,
        ingredients: [
            { ingredientId: getLatestPurchaseId('Lechuga Romana', sampleIngredients), quantity: 1, unit: 'unidad', wastePercentage: 15 },
            { ingredientId: getLatestPurchaseId('Queso Parmesano', sampleIngredients), quantity: 0.05, unit: 'kg', wastePercentage: 0 },
        ],
        subRecipes: [{ recipeId: polloGrilladoRecipe.id, quantity: 0.2 }],
        notes: 'Receta de ejemplo generada automáticamente.'
    },
    {
        id: generateId(), name: 'Milanesa de Nalga con Papas Fritas', category: 'Plato Principal', yield: 1, salePrice: 6200,
        ingredients: [
            { ingredientId: getLatestPurchaseId('Carne para Milanesa (Nalga)', sampleIngredients), quantity: 0.2, unit: 'kg', wastePercentage: 5 },
            { ingredientId: getLatestPurchaseId('Huevo', sampleIngredients), quantity: 2, unit: 'unidad', wastePercentage: 5 },
            { ingredientId: getLatestPurchaseId('Pan Rallado', sampleIngredients), quantity: 0.1, unit: 'kg', wastePercentage: 10 },
        ],
        subRecipes: [{ recipeId: papasFritasRecipe.id, quantity: 1 }],
        notes: 'Receta de ejemplo generada automáticamente.'
    },
    {
        id: generateId(), name: 'Bife de Lomo Grille con Papas Fritas', category: 'Plato Principal', yield: 1, salePrice: 7500,
        ingredients: [
            { ingredientId: getLatestPurchaseId('Lomo', sampleIngredients), quantity: 0.25, unit: 'kg', wastePercentage: 15 },
        ],
        subRecipes: [{ recipeId: papasFritasRecipe.id, quantity: 1 }],
        notes: 'Bife de lomo grillado a punto, acompañado de papas fritas caseras.'
    },
    {
        id: generateId(), name: 'Hamburguesa Completa', category: 'Sandwich', yield: 1, salePrice: 5800,
        ingredients: [
            { ingredientId: getLatestPurchaseId('Lomo', sampleIngredients), quantity: 0.18, unit: 'kg', wastePercentage: 5 },
            { ingredientId: getLatestPurchaseId('Pan de Hamburguesa', sampleIngredients), quantity: 1, unit: 'unidad', wastePercentage: 0 },
            { ingredientId: getLatestPurchaseId('Panceta', sampleIngredients), quantity: 0.05, unit: 'kg', wastePercentage: 40 },
            { ingredientId: getLatestPurchaseId('Queso Cheddar', sampleIngredients), quantity: 0.04, unit: 'kg', wastePercentage: 0 },
            { ingredientId: getLatestPurchaseId('Huevo', sampleIngredients), quantity: 1, unit: 'unidad', wastePercentage: 5 },
        ],
        subRecipes: [],
        notes: 'Receta de ejemplo generada automáticamente.'
    },
    {
        id: generateId(), name: 'Matambre Casero con Ensalada Rusa', category: 'Entrada', yield: 1, salePrice: 15500,
        ingredients: [
             { ingredientId: getLatestPurchaseId('Carne para Milanesa (Nalga)', sampleIngredients), quantity: 0.2, unit: 'kg', wastePercentage: 10 },
        ],
        subRecipes: [{ recipeId: ensaladaRusaRecipe.id, quantity: 1 }],
        notes: 'Receta de ejemplo para el matambre.'
    },
    { id: generateId(), name: 'Agua sin Gas 500ml', category: 'Bebida de venta', yield: 1, salePrice: 1200, ingredients: [{ ingredientId: 'temp_directa', quantity: 1, unit: 'unidad', wastePercentage: 0 }], subRecipes: [] },
    { id: generateId(), name: 'Vino Malbec Copa', category: 'Vinos', yield: 1, salePrice: 2500, ingredients: [{ ingredientId: 'temp_directa', quantity: 1, unit: 'unidad', wastePercentage: 0 }], subRecipes: [] },
];

// Combine all recipes into a single list.
export let sampleRecipes: Recipe[] = [
    salsaDeTomateRecipe,
    polloGrilladoRecipe,
    papasFritasRecipe,
    ensaladaRusaRecipe,
    ...mainDishes
];

// Dummy ingredient for direct-sale items like drinks.
const ventaDirectaIng = createIngredient('Venta Directa (Bebidas)', 'unidad', 0, 1, new Date().toISOString(), 'N/A', 'Venta Directa');
sampleIngredients.push(ventaDirectaIng);

// Replace placeholder ID with the real one.
sampleRecipes = sampleRecipes.map(recipe => {
    const newIngredients = recipe.ingredients.map(ing => {
        if (ing.ingredientId === 'temp_directa') return { ...ing, ingredientId: ventaDirectaIng.id };
        return ing;
    });
    return { ...recipe, ingredients: newIngredients };
});


// --- SALES & PRICES ---
export const sampleProductSales: ProductSale[] = [
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Milanesa de Nalga con Papas Fritas', quantity: 150 },
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Bife de Lomo Grille con Papas Fritas', quantity: 130 },
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Hamburguesa Completa', quantity: 125 },
    { id: generateId(), date: new Date('2024-08-04').toISOString(), name: 'Pizza Margherita', quantity: 110 },
    { id: generateId(), date: new Date('2024-08-04').toISOString(), name: 'Ensalada Caesar con Pollo', quantity: 80 },
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Matambre Casero con Ensalada Rusa', quantity: 65 },
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Agua sin Gas 500ml', quantity: 200 },
    { id: generateId(), date: new Date('2024-08-04').toISOString(), name: 'Vino Malbec Copa', quantity: 95 },
    { id: generateId(), date: new Date('2024-08-05').toISOString(), name: 'Cubierto Almuerzo', quantity: 350 },
    { id: generateId(), date: new Date('2024-08-04').toISOString(), name: 'Cubierto Cena', quantity: 250 },
];

export const sampleProductPrices: ProductPrice[] = sampleRecipes
    .filter(r => r.salePrice > 0)
    .map(r => ({ name: r.name, salePrice: r.salePrice }));

// --- MAIN LOADER FUNCTION ---
export const loadSampleData = async (): Promise<void> => {
    console.log("Loading sample data into localStorage...");
    await saveIngredients(sampleIngredients);
    await saveRecipes(sampleRecipes);
    await saveProductSales(sampleProductSales);
    await saveProductPrices(sampleProductPrices);
    console.log("Sample data loaded successfully.");
};
