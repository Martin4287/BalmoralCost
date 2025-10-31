export type UnitOfMeasure = "g" | "kg" | "ml" | "l" | "unidad" | "cda" | "cdita" | "taza" | "pizca" | "porción";

export interface Ingredient {
  id: string;
  name: string; // Name from invoice, e.g., "Harina de Trigo 0000"
  canonicalName?: string; // Unified name, e.g., "Harina de Trigo"
  supplier?: string;
  purchaseDate?: string;
  purchaseQuantity: number;
  unit: UnitOfMeasure;
  costPerUnit: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: UnitOfMeasure;
  wastePercentage?: number;
}

export interface SubRecipeItem {
    recipeId: string;
    quantity: number;
    directCost?: number; // Optional override for calculated cost
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  yield: number; // in portions
  salePrice: number;
  ingredients: RecipeIngredient[];
  subRecipes: SubRecipeItem[];
  notes?: string;
  imageUrl?: string;
}

export interface ProductPrice {
    name: string;
    salePrice: number; // This will hold the primary price, e.g., from 'SALON'
    otherPrices?: Record<string, number>; // For 'DELIVERY', etc.
    rubro?: string;
    codigo?: string;
    grupoA?: string;
    grupoB?: string;
}

export interface ProductSale {
    id: string;
    date: string;
    name: string;
    quantity: number;
    tableType?: string; // e.g., 'INVITACION', 'CONSUMO PERSONAL'
}

export interface RecipeHistoryEntry {
    id: string;
    recipeId: string;
    timestamp: string;
    recipeData: Recipe;
}

// For Dashboard
export interface TopSellingItem {
    name: string;
    quantity: number;
}

export interface MostProfitableItem {
    name: string;
    margin: number;
}

export interface SalesForceItem {
    name: string;
    force: number;
}

export interface MenuEngineeringItem {
    name: string;
    profitability: number;
    popularity: number;
    quadrant: 'Estrella' | 'Puzzle' | 'Caballo de Batalla' | 'Perro';
    margin: number;
}

export interface MenuEngineeringData {
    items: MenuEngineeringItem[];
    avgPopularity: number;
    avgProfitability: number;
}

export interface LowStockItem {
    name: string;
    balance: number;
    threshold: number;
    unit: string;
}

export interface DashboardData {
    topSelling: TopSellingItem[];
    mostProfitable: MostProfitableItem[];
    salesForce: SalesForceItem[];
    menuEngineering: MenuEngineeringData;
    cubiertosSale?: ProductSale;
    internalConsumptionsSummary: ProductSale[];
    lowStockItems: LowStockItem[];
}

// For Stock Page
export interface StockMovement {
    date: string;
    type: 'Compra' | 'Consumo' | 'Consumo Interno' | 'Retiro';
    description: string;
    debit: number; // Entrada
    credit: number; // Salida
    balance: number;
}

export interface StockData {
    ingredientName: string; // canonicalName or name
    unit: string;
    finalBalance: number;
    movements: StockMovement[];
}

// For Physical Inventory Page (New)
export interface InventoryCountItem {
    ingredientName: string;
    unit: UnitOfMeasure;
    theoreticalQty: number;
    physicalQty: number;
    varianceQty: number;
    costOfVariance: number;
}

export interface InventoryCount {
    id: string;
    date: string;
    items: InventoryCountItem[];
}

// For Carta Page
export interface MenuItem {
  id: string;
  name: string;
  price: number;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export type MenuData = MenuSection[];
export type MenuRecipeMappings = Record<string, string>; // { [menuItemId: string]: recipeId }

// For Withdrawals Page
export interface WithdrawalItem {
    ingredientId: string; // The specific purchase ID
    ingredientName: string; // The canonical name
    quantity: number;
    unit: UnitOfMeasure;
    costPerUnit: number;
    totalCost: number;
}

export interface Withdrawal {
    id: string;
    date: string;
    person: 'Patricio' | 'Mariano' | 'Martin' | 'Otros';
    observations?: string;
    items: WithdrawalItem[];
    totalWithdrawalCost: number;
}

// For Low Stock Settings
export type LowStockSettings = Record<string, number>; // { [canonicalIngredientName: string]: threshold }