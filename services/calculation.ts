import type { Recipe, Ingredient, ProductSale, ProductPrice, DashboardData, StockData, StockMovement, RecipeIngredient, SubRecipeItem, SalesForceItem, Withdrawal, MenuData, LowStockSettings, LowStockItem } from '../types';
import { VAT_RATE } from '../lib/constants';

// --- Recipe Cost Calculation ---

// A more intelligent cache that invalidates itself when underlying data changes.
const costCalculationCache = {
    costs: new Map<string, number>(),
    // We store references to the data arrays. If the array reference changes,
    // we assume the data is new and the cache is stale. This is efficient
    // and works well with React's state management (which creates new arrays on updates).
    ingredientsRef: null as Ingredient[] | null,
    recipesRef: null as Recipe[] | null,
};

/**
 * Ensures the cache is valid for the given data sources.
 * If the data sources (ingredients or recipes arrays) have changed since the 
 * last calculation, the cache is cleared.
 * @param allIngredients The current list of all available ingredients.
 * @param allRecipes The current list of all available recipes.
 */
const validateCostCache = (allIngredients: Ingredient[], allRecipes: Recipe[]) => {
    if (costCalculationCache.ingredientsRef !== allIngredients || costCalculationCache.recipesRef !== allRecipes) {
        costCalculationCache.costs.clear();
        costCalculationCache.ingredientsRef = allIngredients;
        costCalculationCache.recipesRef = allRecipes;
    }
};

/**
 * Calculates the cost per serving of a given recipe.
 * This function is memoized using a self-invalidating cache. The cache is cleared
 * automatically if the `allIngredients` or `allRecipes` arrays change.
 * Handles nested sub-recipes and ingredient costs.
 * @param recipe The recipe to calculate the cost for.
 * @param allIngredients A list of all available ingredients.
 * @param allRecipes A list of all available recipes (for sub-recipe lookups).
 * @returns The cost per serving.
 */
export const calculateRecipeCost = (
    recipe: Recipe,
    allIngredients: Ingredient[],
    allRecipes: Recipe[],
): number => {
    // First, ensure the cache is valid for the current data.
    validateCostCache(allIngredients, allRecipes);
    
    const recipeCostCache = costCalculationCache.costs;

    // Check cache first to prevent redundant calculations and circular dependencies
    if (recipeCostCache.has(recipe.id)) {
        return recipeCostCache.get(recipe.id)!;
    }

    let totalCost = 0;

    // 1. Calculate cost from direct ingredients
    recipe.ingredients.forEach((item: RecipeIngredient) => {
        // Find the specific purchase record for the ingredient
        const ingredient = allIngredients.find(ing => ing.id === item.ingredientId);
        if (ingredient && item.quantity > 0) {
            const costBeforeWaste = ingredient.costPerUnit * item.quantity;
            // Account for waste (merma)
            const wasteFactor = 1 - ((item.wastePercentage || 0) / 100);
            if (wasteFactor > 0) {
                totalCost += costBeforeWaste / wasteFactor;
            }
        }
    });

    // 2. Calculate cost from sub-recipes
    recipe.subRecipes.forEach((item: SubRecipeItem) => {
        // If a direct cost is specified, use it.
        const isDirectCost = item.directCost !== undefined && !isNaN(item.directCost);
        if (isDirectCost) {
            totalCost += item.directCost! * item.quantity;
        } else {
            // Otherwise, find the sub-recipe and calculate its cost recursively
            const subRecipe = allRecipes.find(r => r.id === item.recipeId);
            if (subRecipe) {
                // IMPORTANT: Put a temporary value in the cache to break circular dependencies.
                recipeCostCache.set(recipe.id, 0); // Temporary value
                const subRecipeCostPerServing = calculateRecipeCost(subRecipe, allIngredients, allRecipes);
                totalCost += subRecipeCostPerServing * item.quantity;
            }
        }
    });

    const costPerServing = recipe.yield > 0 ? totalCost / recipe.yield : 0;
    
    // Update cache with the final calculated value
    recipeCostCache.set(recipe.id, costPerServing);

    return costPerServing;
};


// --- Dashboard Data Calculation ---

export const calculateDashboardData = (
    recipes: Recipe[],
    ingredients: Ingredient[],
    sales: ProductSale[],
    prices: ProductPrice[],
    internalConsumptions: ProductSale[],
    menuData: MenuData | null,
    lowStockSettings: LowStockSettings,
    withdrawals: Withdrawal[],
): DashboardData => {
    // Create a map of recipe names to their calculated data (cost, price, etc.)
    const recipeDataMap = new Map<string, { cost: number; price: number; recipe: Recipe }>();
    recipes.forEach(recipe => {
        const costPerServing = calculateRecipeCost(recipe, ingredients, recipes);
        const priceRecord = prices.find(p => p.name === recipe.name);
        const salePrice = priceRecord ? priceRecord.salePrice : recipe.salePrice;
        recipeDataMap.set(recipe.name, { cost: costPerServing, price: salePrice, recipe });
    });
    
    // 1. Separate "Cubiertos" from other sales for dedicated card
    const cubiertosAlmuerzo = sales.find(s => s.name.toLowerCase().includes('cubierto almuerzo'));
    const cubiertosCena = sales.find(s => s.name.toLowerCase().includes('cubierto cena'));
    // FIX: Add missing properties `id` and `date` to conform to the `ProductSale` type.
    const cubiertosSale: ProductSale = {
        id: 'cubiertos-summary',
        date: new Date().toISOString(),
        name: 'Cubiertos',
        quantity: (cubiertosAlmuerzo?.quantity || 0) + (cubiertosCena?.quantity || 0)
    };
    const regularSales = sales.filter(s => !s.name.toLowerCase().includes('cubierto'));

    // Process regular sales data
    const processedSales = regularSales
        .map(sale => {
            const recipeData = recipeDataMap.get(sale.name);
            if (!recipeData) return null;

            const costWithVAT = recipeData.cost * (1 + VAT_RATE);
            const profitPerUnit = recipeData.price - costWithVAT;
            const totalProfit = profitPerUnit * sale.quantity;
            const margin = recipeData.price > 0 ? (profitPerUnit / recipeData.price) * 100 : 0;

            return {
                name: sale.name,
                quantity: sale.quantity,
                profitPerUnit,
                totalProfit,
                margin,
                category: recipeData.recipe.category
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    // Top 10 Selling (now excludes cubiertos)
    const topSelling = [...processedSales].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    
    // Top 10 Most Profitable (by margin %, excluding 100% margins)
    const mostProfitable = [...processedSales]
        .filter(item => item.margin < 100)
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10);

    // Top 10 Sales Force (by total profit)
    const salesForce: SalesForceItem[] = [...processedSales]
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 10)
        .map(item => ({
            name: item.name,
            force: item.totalProfit
        }));
        
    // Create a Set of all item names from the official menu for efficient lookup
    const menuItemsNames = new Set(menuData?.flatMap(section => section.items.map(item => item.name)) ?? []);

    // Menu Engineering (BCG Matrix)
    const menuEngineeringSourceData = processedSales.filter(item => 
        item.category !== 'Sin Analizar' && 
        item.margin < 100 &&
        (menuItemsNames.size > 0 ? menuItemsNames.has(item.name) : true) // If menu exists, filter by it. Otherwise, use all sales.
    );

    const totalPopularity = menuEngineeringSourceData.reduce((sum, item) => sum + item.quantity, 0);
    const avgPopularity = totalPopularity > 0 ? totalPopularity / menuEngineeringSourceData.length : 0;
    const totalProfitability = menuEngineeringSourceData.reduce((sum, item) => sum + item.profitPerUnit, 0);
    const avgProfitability = menuEngineeringSourceData.length > 0 ? totalProfitability / menuEngineeringSourceData.length : 0;

    const menuEngineeringItems = menuEngineeringSourceData.map(item => {
        let quadrant: 'Estrella' | 'Puzzle' | 'Caballo de Batalla' | 'Perro';
        const highPopularity = item.quantity >= avgPopularity;
        const highProfitability = item.profitPerUnit >= avgProfitability;

        if (highPopularity && highProfitability) quadrant = 'Estrella';
        else if (!highPopularity && highProfitability) quadrant = 'Puzzle';
        else if (highPopularity && !highProfitability) quadrant = 'Caballo de Batalla';
        else quadrant = 'Perro';

        return {
            name: item.name,
            popularity: item.quantity,
            profitability: item.profitPerUnit,
            margin: item.margin,
            quadrant
        };
    });
    
    // Top 10 Internal Consumptions
    const internalConsumptionsSummary = [...internalConsumptions]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

    // Low Stock Items Calculation
    const stockData = calculateStockData(recipes, ingredients, sales, internalConsumptions, withdrawals);
    const lowStockItems: LowStockItem[] = [];
    stockData.forEach(item => {
        const threshold = lowStockSettings[item.ingredientName];
        if (threshold !== undefined && item.finalBalance <= threshold) {
            lowStockItems.push({
                name: item.ingredientName,
                balance: item.finalBalance,
                threshold: threshold,
                unit: item.unit,
            });
        }
    });

    return {
        topSelling,
        mostProfitable,
        salesForce,
        menuEngineering: {
            items: menuEngineeringItems,
            avgPopularity,
            avgProfitability
        },
        cubiertosSale,
        internalConsumptionsSummary,
        lowStockItems,
    };
};


// --- Stock Data Calculation ---

/**
 * Recursively calculates the ingredient breakdown for a single serving of a given recipe.
 * Handles nested sub-recipes and ingredient waste. Uses a cache to prevent re-calculation
 * and handle circular dependencies.
 * @param recipe The recipe to calculate.
 * @param allIngredients A list of all available ingredients.
 * @param allRecipes A list of all available recipes for sub-recipe lookups.
 * @param cache A Map to store the results for memoization.
 * @returns A Map where keys are canonical ingredient names and values are the quantity needed per serving.
 */
const getIngredientsForOnePortion = (
    recipe: Recipe,
    allIngredients: Ingredient[],
    allRecipes: Recipe[],
    cache: Map<string, Map<string, number>>
): Map<string, number> => {
    // Return from cache if already calculated
    if (cache.has(recipe.id)) {
        return cache.get(recipe.id)!;
    }

    // Temporarily set an empty map in the cache to break potential circular dependencies
    cache.set(recipe.id, new Map<string, number>());

    const totalIngredientsForYield = new Map<string, number>();

    // 1. Calculate direct ingredients for the total yield
    recipe.ingredients.forEach((item: RecipeIngredient) => {
        const ingredient = allIngredients.find(ing => ing.id === item.ingredientId);
        if (ingredient) {
            const canonicalName = ingredient.canonicalName || ingredient.name;
            const currentQty = totalIngredientsForYield.get(canonicalName) || 0;
            const wasteFactor = 1 - ((item.wastePercentage || 0) / 100);
            const consumedQty = wasteFactor > 0 ? item.quantity / wasteFactor : item.quantity;
            totalIngredientsForYield.set(canonicalName, currentQty + consumedQty);
        }
    });

    // 2. Recursively calculate ingredients from sub-recipes
    recipe.subRecipes.forEach((subItem: SubRecipeItem) => {
        const subRecipe = allRecipes.find(r => r.id === subItem.recipeId);
        if (subRecipe) {
            // Get the ingredient breakdown for ONE portion of the sub-recipe
            const subRecipeIngredientsPerPortion = getIngredientsForOnePortion(subRecipe, allIngredients, allRecipes, cache);

            // Add the scaled ingredients to the parent recipe's total
            subRecipeIngredientsPerPortion.forEach((qtyPerPortion, name) => {
                const scaledQty = qtyPerPortion * subItem.quantity;
                const currentQty = totalIngredientsForYield.get(name) || 0;
                totalIngredientsForYield.set(name, currentQty + scaledQty);
            });
        }
    });

    // 3. Scale the total ingredients down to a single portion based on the recipe's yield
    const perPortionMap = new Map<string, number>();
    if (recipe.yield > 0) {
        totalIngredientsForYield.forEach((totalQty, name) => {
            perPortionMap.set(name, totalQty / recipe.yield);
        });
    }

    // Update the cache with the final, correct result before returning
    cache.set(recipe.id, perPortionMap);
    return perPortionMap;
};


export const calculateStockData = (
    recipes: Recipe[],
    ingredients: Ingredient[],
    sales: ProductSale[],
    internalConsumptions: ProductSale[],
    withdrawals: Withdrawal[],
): StockData[] => {
    const stockMovements = new Map<string, StockMovement[]>();
    const consumptionCache = new Map<string, Map<string, number>>();

    // Step 1: Initialize with purchases (Debit)
    ingredients.forEach(ing => {
        const name = ing.canonicalName || ing.name;
        if (!stockMovements.has(name)) {
            stockMovements.set(name, []);
        }
        stockMovements.get(name)!.push({
            date: ing.purchaseDate || new Date().toISOString(),
            type: 'Compra',
            description: `Compra a ${ing.supplier || 'N/A'}`,
            debit: ing.purchaseQuantity,
            credit: 0,
            balance: 0 // Will be calculated later
        });
    });

    // Step 2: Calculate consumption from sales (Credit)
    sales.forEach(sale => {
        const recipe = recipes.find(r => r.name === sale.name);
        if (recipe) {
            const ingredientsPerPortion = getIngredientsForOnePortion(recipe, ingredients, recipes, consumptionCache);
            
            ingredientsPerPortion.forEach((consumedQtyPerPortion, ingName) => {
                 if (!stockMovements.has(ingName)) {
                    stockMovements.set(ingName, []);
                }
                stockMovements.get(ingName)!.push({
                    date: sale.date,
                    type: 'Consumo',
                    description: `Venta de ${sale.quantity}x "${sale.name}"`,
                    debit: 0,
                    credit: consumedQtyPerPortion * sale.quantity,
                    balance: 0
                });
            });
        }
    });
    
    // Step 3: Calculate consumption from internal/control tables (Credit)
    internalConsumptions.forEach(consumption => {
        const recipe = recipes.find(r => r.name === consumption.name);
        if (recipe) {
            const ingredientsPerPortion = getIngredientsForOnePortion(recipe, ingredients, recipes, consumptionCache);
            
            ingredientsPerPortion.forEach((consumedQtyPerPortion, ingName) => {
                 if (!stockMovements.has(ingName)) {
                    stockMovements.set(ingName, []);
                }
                stockMovements.get(ingName)!.push({
                    date: consumption.date,
                    type: 'Consumo Interno',
                    description: `Consumo interno de ${consumption.quantity}x "${consumption.name}"`,
                    debit: 0,
                    credit: consumedQtyPerPortion * consumption.quantity,
                    balance: 0
                });
            });
        }
    });

    // Step 4: Calculate withdrawals (Credit)
    withdrawals.forEach(withdrawal => {
        withdrawal.items.forEach(item => {
            const ingName = item.ingredientName;
            if (!stockMovements.has(ingName)) {
                stockMovements.set(ingName, []);
            }
            let description = `Retiro por ${withdrawal.person}`;
            if (withdrawal.observations) {
                description += ` (${withdrawal.observations})`;
            }
            stockMovements.get(ingName)!.push({
                date: withdrawal.date,
                type: 'Retiro',
                description: description,
                debit: 0,
                credit: item.quantity,
                balance: 0
            });
        });
    });


    // Step 5: Sort movements by date and calculate running balance for each ingredient
    const finalStockData: StockData[] = [];
    stockMovements.forEach((movements, name) => {
        movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let balance = 0;
        const calculatedMovements = movements.map(m => {
            balance = balance + m.debit - m.credit;
            return { ...m, balance };
        });

        // Find a representative unit for this canonical name
        const representativeIngredient = ingredients.find(i => (i.canonicalName || i.name) === name);

        finalStockData.push({
            ingredientName: name,
            unit: representativeIngredient?.unit || 'unidad',
            finalBalance: balance,
            movements: calculatedMovements
        });
    });

    return finalStockData.sort((a,b) => a.ingredientName.localeCompare(b.ingredientName));
};