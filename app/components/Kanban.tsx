"use client";

import { KanbanData } from "@/types/kanban";

interface KanbanProps {
  data: KanbanData;
}

export default function Kanban({ data }: KanbanProps) {
  const columns: {
    key: keyof KanbanData;
    label: string;
    bgColor: string;
    borderColor: string;
  }[] = [
    { key: "pass", label: "Pass", bgColor: "bg-green-100", borderColor: "border-green-400" },
    { key: "fail", label: "Fail", bgColor: "bg-red-100", borderColor: "border-red-400" },
    { key: "blocked", label: "Blocked", bgColor: "bg-yellow-100", borderColor: "border-yellow-400" },
    { key: "notRun", label: "Not Run", bgColor: "bg-gray-100", borderColor: "border-gray-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-6 mt-6">
      {columns.map((column) => {
        const list = data[column.key];

        return (
          <div
            key={column.key}
            className={`${column.bgColor} border-2 ${column.borderColor} rounded-lg p-4`}
          >
            <h2 className="font-bold text-lg mb-4">
              {column.label} ({list.length})
            </h2>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {list.length === 0 && (
                <p className="text-gray-600 text-sm italic">Nenhum caso</p>
              )}

              {list.map((item, index) => (
                <div
                  key={item.id ?? `${column.key}-${index}`}
                  className="bg-white p-3 rounded border shadow-sm hover:shadow-md transition"
                >
                  <p className="font-semibold text-sm">{item.title}</p>

                  {item.bug && (
                    <p className="text-xs text-red-600 mt-1">Bug: {item.bug}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
