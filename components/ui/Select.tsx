import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
  error?: string;
}

const Select: React.FC<SelectProps> = ({ label, id, children, error, ...props }) => {
  const errorClasses = "border-red-500 focus:ring-red-500";
  const normalClasses = "border-gray-600 focus:ring-brand";

  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>}
      <select
        id={id}
        className={`w-full bg-accent px-3 py-2 rounded-md border text-white focus:outline-none focus:ring-2 ${error ? errorClasses : normalClasses}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default Select;