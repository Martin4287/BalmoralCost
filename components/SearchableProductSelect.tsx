import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { DetailedSale } from '../pages/SalesPage';
import { ChevronDown, XCircle } from 'lucide-react';

interface SearchableProductSelectProps {
  products: DetailedSale[];
  value: DetailedSale | null;
  onChange: (value: DetailedSale | null) => void;
  label: string;
}

const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({ products, value, onChange, label }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, products]);

  const handleSelect = (product: DetailedSale) => {
    onChange(product);
    setIsOpen(false);
    setSearchTerm('');
  };
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchTerm('');
    setIsOpen(true);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : (value?.name || '')}
          onChange={(e) => {
              setSearchTerm(e.target.value);
              if(!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar un producto para analizar..."
          className="w-full bg-accent px-3 py-2 rounded-md border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-brand pr-10"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {value && !isOpen ? (
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
          {filteredProducts.length > 0 ? (
            <ul>
              {filteredProducts.map(product => (
                <li
                  key={product.name + product.category}
                  onClick={() => handleSelect(product)}
                  className="px-4 py-2 text-sm text-white hover:bg-brand cursor-pointer"
                >
                  {product.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">No se encontraron productos.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableProductSelect;
