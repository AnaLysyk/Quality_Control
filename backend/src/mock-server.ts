const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'governance.json');

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    const initial = {
      companies: [
        { id: 'GRM', name: 'Griaule', passRate: 68, runsOpen: 5, criticalDefects: 2, releasesActive: 3, trendPercent: -12, qualityGate: 'attention' },
        { id: 'SFQ', name: 'Smart', passRate: 85, runsOpen: 1, criticalDefects: 0, releasesActive: 1, trendPercent: 3, qualityGate: 'approved' },
        { id: 'PRT', name: 'PrintCo', passRate: 74, runsOpen: 4, criticalDefects: 1, releasesActive: 2, trendPercent: -6, qualityGate: 'attention' },
        { id: 'BKG', name: 'BookingInc', passRate: 92, runsOpen: 0, criticalDefects: 0, releasesActive: 2, trendPercent: 1, qualityGate: 'approved' },
        { id: 'CDS', name: 'CidadeSmart', passRate: 55, runsOpen: 8, criticalDefects: 3, releasesActive: 4, trendPercent: -18, qualityGate: 'failed' }
      ],
      actions: []
    };
    fs.writeFileSync(FILE, JSON.stringify(initial, null, 2));
  }
}

function readData() {
  ensureData();
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function writeData(obj: any) {
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

app.get('/governance/companies', (req, res) => {
  const d = readData();
  res.json({ success: true, data: d.companies });
});

app.get('/governance/summary', (req, res) => {
  const d = readData();
  const summary = {
    monitored: d.companies.length,
    inRisk: d.companies.filter((c: any) => c.passRate < 60).length,
    inAttention: d.companies.filter((c: any) => c.passRate >= 60 && c.passRate < 75).length,
    releasesActive: d.companies.reduce((s: number, c: any) => s + (c.releasesActive || 0), 0),
    runsOpen: d.companies.reduce((s: number, c: any) => s + (c.runsOpen || 0), 0),
    criticals: d.companies.reduce((s: number, c: any) => s + (c.criticalDefects || 0), 0),
  };
  res.json({ success: true, data: { summary, policy: { passRateMinimum: 75, maxCriticalsPerRelease: 1, maxRunsOpen: 5, minCasesPerRelease: 10 } } });
});

app.get('/governance/company/:id', (req, res) => {
  const id = String(req.params.id).toUpperCase();
  const d = readData();
  const c = d.companies.find((x: any) => x.id === id);
  if (!c) return res.status(404).json({ success: false, error: { message: 'Company not found' } });
  res.json({ success: true, data: c });
});

app.get('/governance/trends', (req, res) => {
  const company = String(req.query.company || 'GRM');
  const base = company === 'GRM' ? 75 : 85;
  const points = Array.from({ length: 8 }).map((_, i) => ({ date: new Date(Date.now() - (7 - i) * 24 * 3600 * 1000).toISOString().slice(0,10), passRate: Math.max(30, base + (i - 4) * (company === 'CDS' ? -2 : 1)) }));
  res.json({ success: true, data: points });
});

app.get('/governance/actions', (req, res) => {
  const d = readData();
  res.json({ success: true, data: d.actions });
});

app.post('/governance/actions', (req, res) => {
  const body = req.body;
  if (!body || !body.companyId) return res.status(400).json({ success: false, error: { message: 'companyId required' } });
  const d = readData();
  const a = { id: `act_${Date.now()}`, companyId: body.companyId, type: body.type || 'manual', note: body.note || '', createdAt: new Date().toISOString() };
  d.actions.push(a);
  writeData(d);
  res.status(201).json({ success: true, data: a });
});

const desiredPort = process.env.PORT ? Number(process.env.PORT) : 0; // 0 = random available port
const server = app.listen(desiredPort, () => {
  const addr = server.address();
  const actualPort = typeof addr === 'string' ? addr : (addr && (addr as any).port) || desiredPort;
  console.log(`Mock governance server listening on http://localhost:${actualPort}`);
});
