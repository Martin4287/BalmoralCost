import type { Ingredient, Recipe, ProductPrice, ProductSale, RecipeHistoryEntry, InventoryCount, MenuData, MenuRecipeMappings, Withdrawal, LowStockSettings } from '../types';

const get = <T,>(key: string): T | null => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) as T : null;
};

const set = <T,>(key: string, value: T): void => {
    localStorage.setItem(key, JSON.stringify(value));
};

// Mock async API calls
const mockAsync = <T,>(data: T): Promise<T> => {
    return new Promise(resolve => setTimeout(() => resolve(data), 200));
}

// Ingredients
export const getIngredients = async (): Promise<Ingredient[]> => mockAsync(get<Ingredient[]>('ingredients') || []);
export const saveIngredients = async (ingredients: Ingredient[]): Promise<void> => mockAsync(set('ingredients', ingredients));

// Recipes
export const getRecipes = async (): Promise<Recipe[]> => mockAsync(get<Recipe[]>('recipes') || []);
export const saveRecipes = async (recipes: Recipe[]): Promise<void> => mockAsync(set('recipes', recipes));

// Product Prices
export const getProductPrices = async (): Promise<ProductPrice[]> => mockAsync(get<ProductPrice[]>('productPrices') || []);
export const saveProductPrices = async (prices: ProductPrice[]): Promise<void> => mockAsync(set('productPrices', prices));

// Product Sales
export const getProductSales = async (): Promise<ProductSale[]> => mockAsync(get<ProductSale[]>('productSales') || []);
export const saveProductSales = async (sales: ProductSale[]): Promise<void> => mockAsync(set('productSales', sales));

// Internal Consumptions
export const getInternalConsumptions = async (): Promise<ProductSale[]> => mockAsync(get<ProductSale[]>('internalConsumptions') || []);
export const saveInternalConsumptions = async (consumptions: ProductSale[]): Promise<void> => mockAsync(set('internalConsumptions', consumptions));

// Recipe History
export const getRecipeHistory = async (): Promise<RecipeHistoryEntry[]> => mockAsync(get<RecipeHistoryEntry[]>('recipeHistory') || []);
export const saveRecipeHistory = async (history: RecipeHistoryEntry[]): Promise<void> => mockAsync(set('recipeHistory', history));

// Physical Inventory Counts (New)
export const getInventoryCounts = async (): Promise<InventoryCount[]> => mockAsync(get<InventoryCount[]>('inventoryCounts') || []);
export const saveInventoryCounts = async (counts: InventoryCount[]): Promise<void> => mockAsync(set('inventoryCounts', counts));

// Menu Data
export const getMenuData = async (): Promise<MenuData | null> => mockAsync(get<MenuData>('menuData'));
export const saveMenuData = async (menu: MenuData): Promise<void> => mockAsync(set('menuData', menu));

// Menu Mappings
export const getMenuMappings = async (): Promise<MenuRecipeMappings> => mockAsync(get<MenuRecipeMappings>('menuMappings') || {});
export const saveMenuMappings = async (mappings: MenuRecipeMappings): Promise<void> => mockAsync(set('menuMappings', mappings));

// Global Waste Rate
export const getGlobalWasteRate = async (): Promise<number> => mockAsync(get<number>('globalWasteRate') || 0);
export const saveGlobalWasteRate = async (rate: number): Promise<void> => mockAsync(set('globalWasteRate', rate));

// Withdrawals
export const getWithdrawals = async (): Promise<Withdrawal[]> => mockAsync(get<Withdrawal[]>('withdrawals') || []);
export const saveWithdrawals = async (withdrawals: Withdrawal[]): Promise<void> => mockAsync(set('withdrawals', withdrawals));

// Low Stock Settings
export const getLowStockSettings = async (): Promise<LowStockSettings> => mockAsync(get<LowStockSettings>('lowStockSettings') || {});
export const saveLowStockSettings = async (settings: LowStockSettings): Promise<void> => mockAsync(set('lowStockSettings', settings));