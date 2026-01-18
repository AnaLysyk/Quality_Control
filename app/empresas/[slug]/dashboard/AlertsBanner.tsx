"use client";
import React from "react";

function Alert({ severity, children }: { severity: string; children: React.ReactNode }) {
  let color = "bg-blue-100 text-blue-800 border-blue-300";
  if (severity === "critical") color = "bg-red-100 text-red-800 border-red-300";
  if (severity === "warning") color = "bg-yellow-100 text-yellow-800 border-yellow-300";
  return (
    <div className={`border-l-4 p-3 mb-2 rounded ${color}`}>{children}</div>
  );
}

export default async function AlertsBanner({ slug }: { slug: string }) {
  const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/alerts`);
  const data = await res.json();
  if (!Array.isArray(data.alerts) || data.alerts.length === 0) return null;
  return (
    <div data-testid="alerts" className="mb-4">
      {data.alerts.map((a: any) => (
        <Alert key={a.type} severity={a.severity}>
          {a.message}
        </Alert>
      ))}
    </div>
  );
}
