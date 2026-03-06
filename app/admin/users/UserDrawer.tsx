"use client";

import React, { useEffect, useState } from 'react';
import PermissionsGrid from './PermissionsGrid';

export default function UserDrawer({ user, onClose }: { user: any, onClose: ()=>void }) {
  const [details, setDetails] = useState<any>(user);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/users/${user.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetails(json.item);
      }
    }
    load();
  }, [user.id]);

  if (!details) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end">
      <div className="w-140 bg-white h-full p-6 overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{details.name}</h2>
          <button onClick={onClose} className="text-gray-600">Fechar</button>
        </div>

        <div className="mb-4">
          <p><strong>Email:</strong> {details.email}</p>
          <p><strong>Role:</strong> {details.role}</p>
          <p><strong>Empresas:</strong> {(details.companyIds || []).join(', ')}</p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Permissões</h3>
          <PermissionsGrid userId={details.id} role={details.role} />
        </div>
      </div>
    </div>
  );
}
