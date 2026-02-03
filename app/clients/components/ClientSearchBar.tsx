"use client";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function ClientSearchBar({ value, onChange }: Props) {
  return (
    <div className="mb-4">
      <input
        type="text"
        placeholder="Buscar cliente pelo nome"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-control-user w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}
