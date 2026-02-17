import React, { useState } from 'react';

interface TestPlan {
  id: string;
  nome: string;
}

interface TestPlanListProps {
  isAdmin: boolean;
  isDev?: boolean;
}

const initialTestPlans: TestPlan[] = [
  { id: '1', nome: 'Plano de Teste 1' },
  { id: '2', nome: 'Plano de Teste 2' },
];

export default function TestPlanList({ isAdmin, isDev }: TestPlanListProps) {
  const [testPlans, setTestPlans] = useState<TestPlan[]>(initialTestPlans);

  const canDelete = isAdmin || isDev;

  const handleDelete = (id: string) => {
    setTestPlans(testPlans => testPlans.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {testPlans.map(testPlan => (
        <div key={testPlan.id} className="card-tc flex items-center justify-between px-4 py-2">
          <span>{testPlan.nome}</span>
          {canDelete && (
            <button
              className="btn-tc px-2 py-1 text-xs"
              onClick={() => handleDelete(testPlan.id)}
              title="Deletar plano de teste"
            >Deletar</button>
          )}
        </div>
      ))}
    </div>
  );
}
