import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, XCircle } from 'lucide-react';

interface SearchableStockItemSelectProps {
  items: string[]; // The list of canonical names
  value: string; // The selected name
  onChange: (value: string) => void;
  label: string;
}

const SearchableStockItemSelect: React.FC<SearchableStockItemSelectProps> = ({ items, value, onChange, label }) => {
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
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, items]);

  const handleSelect = (itemName: string) => {
    onChange(itemName);
    setIsOpen(false);
    setSearchTerm('');
  };
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={(e) => {
              setSearchTerm(e.target.value);
              if(!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar insumo..."
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
          {filteredItems.length > 0 ? (
            <ul>
              {filteredItems.map(item => (
                <li
                  key={item}
                  onClick={() => handleSelect(item)}
                  className="px-4 py-2 text-sm text-white hover:bg-brand cursor-pointer"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">No se encontraron insumos.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableStockItemSelect;
