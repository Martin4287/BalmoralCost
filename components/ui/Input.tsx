import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, id, error, ...props }) => {
  const errorClasses = "border-red-500 focus:ring-red-500";
  const normalClasses = "border-gray-600 focus:ring-brand";

  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>}
      <input
        id={id}
        className={`w-full bg-accent px-3 py-2 rounded-md border text-white focus:outline-none focus:ring-2 ${error ? errorClasses : normalClasses}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default Input;