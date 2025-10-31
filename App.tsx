import React, { useState } from 'react';
import { LayoutDashboard, Utensils, Carrot, FileUp, FileDown, BarChart3, Package, Bell, UserCircle, ClipboardCheck, BookText, PackageMinus } from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import RecipesPage from './pages/RecipesPage';
import IngredientsPage from './pages/IngredientsPage';
import ImportPage from './pages/ImportPage';
import StockPage from './pages/StockPage';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import CartaPage from './pages/CartaPage';
import WithdrawalPage from './pages/WithdrawalPage';
import type { Recipe } from './types';


type Page = 'dashboard' | 'recipes' | 'ingredients' | 'stock' | 'sales' | 'import' | 'inventory' | 'carta' | 'withdrawal';

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [recipeToNavigate, setRecipeToNavigate] = useState<Recipe | null>(null);

    const handleNavClick = (page: Page) => {
        if (isFormDirty) {
            if (window.confirm('Tiene cambios sin guardar. ¿Está seguro de que desea salir? Los cambios se perderán.')) {
                setCurrentPage(page);
                setIsFormDirty(false);
            }
        } else {
            setCurrentPage(page);
        }
    };
    
    const handleNavigateToRecipe = (recipe: Recipe) => {
        setRecipeToNavigate(recipe);
        handleNavClick('recipes');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage onNavigate={handleNavClick} />;
            case 'recipes':
                return <RecipesPage setIsFormDirty={setIsFormDirty} initialRecipe={recipeToNavigate} clearInitialRecipe={() => setRecipeToNavigate(null)} />;
            case 'ingredients':
                return <IngredientsPage setIsFormDirty={setIsFormDirty} />;
            case 'stock':
                return <StockPage />;
            case 'sales':
                return <SalesPage />;
            case 'import':
                return <ImportPage />;
            case 'inventory':
                return <InventoryPage />;
            case 'carta':
                return <CartaPage onNavigateToRecipe={handleNavigateToRecipe} />;
            case 'withdrawal':
                return <WithdrawalPage />;
            default:
                return <DashboardPage onNavigate={handleNavClick} />;
        }
    };

    const NavItem: React.FC<{ page: Page; icon: React.ReactNode; label: string }> = ({ page, icon, label }) => (
        <button
            onClick={() => handleNavClick(page)}
            className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                currentPage === page
                    ? 'bg-brand text-white shadow-lg'
                    : 'text-gray-300 hover:bg-accent hover:text-white'
            }`}
        >
            {icon}
            <span className="ml-3">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-primary text-gray-200 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-secondary flex-shrink-0 p-4 flex flex-col justify-between border-r border-accent">
                <div>
                    <div className="flex items-center mb-8">
                        <Package size={32} className="text-brand" />
                        <h1 className="text-2xl font-bold ml-2 text-white">Balmoral<span className="text-brand">Cost</span></h1>
                    </div>
                    <nav className="space-y-2">
                        <NavItem page="dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
                        <NavItem page="recipes" icon={<Utensils size={20} />} label="Recetas" />
                        <NavItem page="carta" icon={<BookText size={20} />} label="Carta de Restaurante" />
                        <NavItem page="ingredients" icon={<Carrot size={20} />} label="Insumos" />
                        <NavItem page="stock" icon={<FileDown size={20} />} label="Stock" />
                        <NavItem page="withdrawal" icon={<PackageMinus size={20} />} label="Retiro de Mercadería" />
                        <NavItem page="sales" icon={<BarChart3 size={20} />} label="Ventas" />
                        <NavItem page="inventory" icon={<ClipboardCheck size={20} />} label="Inventario" />
                        <NavItem page="import" icon={<FileUp size={20} />} label="Importar/Exportar" />
                    </nav>
                </div>
                <div className="text-center text-xs text-gray-500">
                    <p>&copy; 2024 BalmoralCost</p>
                    <p>Herramienta de gestión.</p>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="flex items-center justify-end h-16 px-8 bg-secondary border-b border-accent">
                    <div className="flex items-center gap-6">
                        <button className="text-gray-400 hover:text-white"><Bell size={20} /></button>
                        <button className="flex items-center gap-2 text-gray-300 hover:text-white">
                            <UserCircle size={24} />
                            <span>Admin</span>
                        </button>
                    </div>
                </header>
                <main className="flex-1 p-8 overflow-y-auto bg-primary">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default App;