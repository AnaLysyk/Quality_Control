
"use client";
import { FiSearch } from "react-icons/fi";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function ClientSearchBar({ value, onChange }: Props) {
  // Sanitize and trim input, prevent accidental submit
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.replace(/\s+/g, ' ').trimStart());
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };
  return (
    <div className="mb-4 relative max-w-md" data-testid="client-search-bar">
      <FiSearch className="absolute left-3 top-3 text-gray-500 text-lg pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        placeholder="Buscar cliente pelo nome"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label="Buscar cliente pelo nome"
        className="form-control-user w-full rounded-xl bg-white border border-gray-200 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        data-testid="client-search-input"
      />
    </div>
  );
}
