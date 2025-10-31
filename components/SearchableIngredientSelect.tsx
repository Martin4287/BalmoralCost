import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Ingredient } from '../types';
import { formatCurrency } from '../lib/helpers';
import { ChevronDown, XCircle } from 'lucide-react';

interface SearchableIngredientSelectProps {
  ingredients: Ingredient[];
  value: string; // The selected ingredient ID
  onChange: (value: string) => void;
  error?: string;
}

const SearchableIngredientSelect: React.FC<SearchableIngredientSelectProps> = ({ ingredients, value, onChange, error }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedIngredient = useMemo(() => ingredients.find(ing => ing.id === value), [ingredients, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);
  
  const filteredIngredients = useMemo(() => {
    if (!searchTerm) return ingredients;
    const lowercasedTerm = searchTerm.toLowerCase();
    return ingredients.filter(ing => 
      ing.name.toLowerCase().includes(lowercasedTerm) ||
      (ing.canonicalName && ing.canonicalName.toLowerCase().includes(lowercasedTerm))
    );
  }, [searchTerm, ingredients]);

  const handleSelect = (ingredientId: string) => {
    onChange(ingredientId);
    setIsOpen(false);
    setSearchTerm('');
  };
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
  }
  
  const errorClasses = "border-red-500 focus:ring-red-500";
  const normalClasses = "border-gray-600 focus:ring-brand";

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-400 mb-1">Insumo</label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedIngredient?.name || '')}
          onChange={(e) => {
              setSearchTerm(e.target.value);
              if(!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={!isOpen && selectedIngredient 
            ? `(${new Date(selectedIngredient.purchaseDate || '').toLocaleDateString('es-AR')})` 
            : 'Buscar y seleccionar compra...'}
          className={`w-full bg-accent px-3 py-2 rounded-md border text-white focus:outline-none focus:ring-2 pr-10 ${error ? errorClasses : normalClasses}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {selectedIngredient && !isOpen ? (
                <button type="button" onClick={handleClear} className="text-gray-500 hover:text-white">
                    <XCircle size={16} />
                </button>
            ) : (
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-secondary border border-accent rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredIngredients.length > 0 ? (
            <ul>
              {filteredIngredients.map(ing => (
                <li
                  key={ing.id}
                  onClick={() => handleSelect(ing.id)}
                  className="px-4 py-2 text-sm text-white hover:bg-brand cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{ing.name}</p>
                     {ing.canonicalName && ing.canonicalName !== ing.name && (
                        <p className="text-xs text-brand italic">Unificado: {ing.canonicalName}</p>
                    )}
                    <p className="text-xs text-gray-400">{ing.supplier || 'Sin proveedor'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{formatCurrency(ing.costPerUnit)} / {ing.unit}</p>
                    <p className="text-xs text-gray-400">{new Date(ing.purchaseDate || '').toLocaleDateString('es-AR')}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">No se encontraron insumos.</div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default SearchableIngredientSelect;