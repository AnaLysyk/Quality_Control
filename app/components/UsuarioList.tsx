import React, { useState } from 'react';

interface Usuario {
  id: string;
  nome: string;
}

interface UsuarioListProps {
  isAdmin: boolean;
  userId: string;
  isDev?: boolean;
}

const initialUsuarios: Usuario[] = [
  { id: '1', nome: 'Admin' },
  { id: '2', nome: 'Usuário Demo' },
];

export default function UsuarioList({ isAdmin, userId, isDev }: UsuarioListProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialUsuarios);

  const canDelete = (id: string) => {
    return isAdmin || isDev || id === userId;
  };

  const handleDelete = (id: string) => {
    setUsuarios(usuarios => usuarios.filter(u => u.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {usuarios.map(usuario => (
        <div key={usuario.id} className="card-tc flex items-center justify-between px-4 py-2">
          <span>{usuario.nome}</span>
          {canDelete(usuario.id) && (
            <button
              className="btn-tc px-2 py-1 text-xs"
              onClick={() => handleDelete(usuario.id)}
              title="Deletar usuário"
            >Deletar</button>
          )}
        </div>
      ))}
    </div>
  );
}
