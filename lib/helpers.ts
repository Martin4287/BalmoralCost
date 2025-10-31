export const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
};

export const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || isNaN(amount)) {
        return '$0.00';
    }
    return amount.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    });
};

export const getCategoryColorClassDark = (category: string): { bg: string, text: string, border: string } => {
    const colorMap: { [key: string]: { bg: string, text: string, border: string } } = {
        'Plato Principal': { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700' },
        'Entrada': { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700' },
        'Postre': { bg: 'bg-rose-900/50', text: 'text-rose-300', border: 'border-rose-700' },
        'Ensalada': { bg: 'bg-lime-900/50', text: 'text-lime-300', border: 'border-lime-700' },
        'Pasta': { bg: 'bg-amber-900/50', text: 'text-amber-300', border: 'border-amber-700' },
        'Sandwich': { bg: 'bg-emerald-900/50', text: 'text-emerald-300', border: 'border-emerald-700' },
        'Guarnición': { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700' },
        'Salsas': { bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700' },
        'Producción': { bg: 'bg-purple-900/50', text: 'text-purple-300', border: 'border-purple-700' },
        'Cafetería': { bg: 'bg-stone-800/50', text: 'text-stone-300', border: 'border-stone-600' },
        'Bebida de venta': { bg: 'bg-cyan-900/50', text: 'text-cyan-300', border: 'border-cyan-700' },
        'Bebida con preparación': { bg: 'bg-teal-900/50', text: 'text-teal-300', border: 'border-teal-700' },
        'Sin Tacc': { bg: 'bg-indigo-900/50', text: 'text-indigo-300', border: 'border-indigo-700' },
        'Vinos': { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-700' },
        'Espumantes': { bg: 'bg-fuchsia-900/50', text: 'text-fuchsia-300', border: 'border-fuchsia-700' },
        'Sin Analizar': { bg: 'bg-gray-800/50', text: 'text-gray-400', border: 'border-gray-600' },
    };
    return colorMap[category] || { bg: 'bg-secondary', text: 'text-gray-300', border: 'border-accent' };
};