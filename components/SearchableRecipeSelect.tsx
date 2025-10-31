import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Recipe } from '../types';
import { ChevronDown, XCircle } from 'lucide-react';
import { getCategoryColorClassDark } from '../lib/helpers';

interface SearchableRecipeSelectProps {
  recipes: Recipe[];
  value: string; // The selected recipe ID
  onChange: (value: string) => void;
  currentRecipeId: string; // ID of the recipe being edited, to exclude it
  error?: string;
}

const SearchableRecipeSelect: React.FC<SearchableRecipeSelectProps> = ({ recipes, value, onChange, currentRecipeId, error }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const availableRecipes = useMemo(() => recipes.filter(r => r.id !== currentRecipeId), [recipes, currentRecipeId]);
  const selectedRecipe = useMemo(() => availableRecipes.find(r => r.id === value), [availableRecipes, value]);

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
  
  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return availableRecipes;
    return availableRecipes.filter(r => 
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, availableRecipes]);

  const handleSelect = (recipeId: string) => {
    onChange(recipeId);
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
      <label className="block text-sm font-medium text-gray-400 mb-1">Sub-Receta</label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedRecipe?.name || '')}
          onChange={(e) => {
              setSearchTerm(e.target.value);
              if(!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar sub-receta..."
          className={`w-full bg-accent px-3 py-2 rounded-md border text-white focus:outline-none focus:ring-2 pr-10 ${error ? errorClasses : normalClasses}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {selectedRecipe && !isOpen ? (
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
          {filteredRecipes.length > 0 ? (
            <ul>
              {filteredRecipes.map(r => {
                const colors = getCategoryColorClassDark(r.category);
                return (
                    <li
                        key={r.id}
                        onClick={() => handleSelect(r.id)}
                        className="px-4 py-2 text-sm text-white hover:bg-brand cursor-pointer flex justify-between items-center"
                    >
                        <p className="font-semibold">{r.name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                            {r.category}
                        </span>
                    </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">No se encontraron recetas.</div>
          )}
        </div>
      )}
       {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default SearchableRecipeSelect;