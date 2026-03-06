const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
(async () => {
  try {
    const p = path.join(process.cwd(), 'data', 'support-suportes.json');
    if (!fs.existsSync(p)) {
      console.error('missing', p);
      process.exit(1);
    }
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw || '{}');
    const counter = Number(j.counter || 0) + 1;
    const code = 'SP-' + String(counter).padStart(6, '0');
    const now = new Date().toISOString();
    const item = {
      id: crypto.randomUUID(),
      code,
      title: 'Teste via agente',
      description: 'Criado por script para persistir suporte',
      status: 'backlog',
      type: 'tarefa',
      priority: 'medium',
      tags: [],
      createdAt: now,
      updatedAt: now,
      createdBy: 'script-agent',
      createdByName: null,
      createdByEmail: null,
      companySlug: null,
      companyId: null,
      assignedToUserId: null,
      updatedBy: null,
      timeline: [],
    };
    j.items = [item].concat(Array.isArray(j.items) ? j.items : []);
    j.counter = counter;
    fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
    console.log('created', item.id);
    console.log(JSON.stringify(item, null, 2));
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
