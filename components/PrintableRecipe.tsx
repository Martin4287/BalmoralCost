import React from 'react';
import type { Recipe, Ingredient, SubRecipeItem, RecipeIngredient } from '../types';
import { calculateRecipeCost } from '../services/calculation';
import { formatCurrency } from '../lib/helpers';

interface PrintableRecipeProps {
    recipe: Recipe;
    allIngredients: Ingredient[];
    allRecipes: Recipe[];
    lastModified?: string;
}

const PrintableRecipe: React.FC<PrintableRecipeProps> = ({ recipe, allIngredients, allRecipes, lastModified }) => {
    const costPerServing = calculateRecipeCost(recipe, allIngredients, allRecipes);

    // Using a more professional, high-contrast color scheme for printing
    return (
        <div className="bg-white text-slate-800 p-8 font-sans" style={{ width: '210mm' }}>
            {/* Header Section */}
            <header className="border-b-4 border-teal-500 pb-4 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-base font-bold text-teal-600 tracking-wider">{recipe.category.toUpperCase()}</div>
                        <h1 className="text-4xl font-extrabold text-slate-900 mt-1">{recipe.name}</h1>
                        {lastModified && (
                            <p className="text-xs text-slate-500 mt-2">
                                Última modificación: {new Date(lastModified).toLocaleString('es-AR')}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                        <div className="bg-slate-100 p-3 rounded-lg">
                            <p className="text-base"><strong className="font-semibold text-slate-600">Rendimiento:</strong> <span className="font-bold text-slate-800">{recipe.yield} porciones</span></p>
                            <p className="text-base mt-1"><strong className="font-semibold text-slate-600">Costo/Porción:</strong> <span className="font-bold text-slate-800">{formatCurrency(costPerServing)}</span></p>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                <div className="grid grid-cols-3 gap-8">
                    {/* Main Content: Ingredients & Sub-Recipes */}
                    <div className={recipe.notes ? 'col-span-2' : 'col-span-3'}>
                        {/* Ingredients Section */}
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-teal-700 border-b-2 border-teal-200 pb-2 mb-4">Insumos</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b-2 border-slate-300 bg-slate-200">
                                        <th className="text-left p-3 font-bold text-slate-600">Insumo</th>
                                        <th className="text-right p-3 font-bold text-slate-600">Cantidad</th>
                                        <th className="text-left p-3 font-bold text-slate-600">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recipe.ingredients.map((item: RecipeIngredient, index) => {
                                        const ingredient = allIngredients.find(i => i.id === item.ingredientId);
                                        return (
                                            <tr key={index} className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                <td className="p-3 font-medium text-slate-700">{ingredient?.name || <span className="text-red-600">No encontrado</span>}</td>
                                                <td className="text-right p-3 font-mono text-slate-800">{item.quantity}</td>
                                                <td className="p-3 text-slate-600">{item.unit}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </section>

                        {/* Sub-Recipes Section */}
                         {recipe.subRecipes.length > 0 && (
                             <section>
                                <h2 className="text-2xl font-bold text-teal-700 border-b-2 border-teal-200 pb-2 mb-4">Sub-Recetas</h2>
                                 <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-300 bg-slate-200">
                                            <th className="text-left p-3 font-bold text-slate-600">Receta</th>
                                            <th className="text-right p-3 font-bold text-slate-600">Cantidad</th>
                                            <th className="text-left p-3 font-bold text-slate-600">Unidad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recipe.subRecipes.map((item: SubRecipeItem, index) => {
                                            const subRecipe = allRecipes.find(r => r.id === item.recipeId);
                                            return (
                                                <tr key={index} className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                    <td className="p-3 font-medium text-slate-700">{subRecipe?.name || <span className="text-red-600">No encontrado</span>}</td>
                                                    <td className="text-right p-3 font-mono text-slate-800">{item.quantity}</td>
                                                    <td className="p-3 text-slate-600">porción</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                             </section>
                        )}
                    </div>
                    
                    {/* Notes Section */}
                    {recipe.notes && (
                        <div className="col-span-1">
                            <aside className="bg-teal-50 p-4 rounded-lg border-l-4 border-teal-400 h-full">
                                <h2 className="text-xl font-bold text-teal-800 mb-3">Notas de Preparación</h2>
                                <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{recipe.notes}</p>
                            </aside>
                        </div>
                    )}
                </div>

                {/* Image Section */}
                {recipe.imageUrl && (
                    <div className="mt-10 pt-6 border-t-2 border-slate-200 text-center">
                        <h2 className="text-xl font-bold text-teal-700 mb-4">Foto de Referencia</h2>
                        <img 
                            src={recipe.imageUrl} 
                            alt={`Foto de ${recipe.name}`}
                            className="max-w-md max-h-80 mx-auto object-cover border-4 border-white rounded-lg shadow-lg"
                        />
                    </div>
                )}
            </main>
            
            {/* Footer Section */}
             <footer className="text-center text-xs text-slate-400 mt-12 pt-4 border-t border-slate-200">
                Ficha Técnica generada por BalmoralCost el {new Date().toLocaleDateString('es-AR')}
            </footer>
        </div>
    );
};

export default PrintableRecipe;