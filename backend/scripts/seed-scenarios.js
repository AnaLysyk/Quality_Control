const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'governance.json');

function write(obj) {
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
  console.log('Wrote', FILE);
}

const scenarios = {
  stable: {
    companies: [
      { id: 'GRM', name: 'Griaule', passRate: 92, runsOpen: 1, criticalDefects: 0, releasesActive: 2, trendPercent: 2, qualityGate: 'approved' },
      { id: 'SFQ', name: 'Smart', passRate: 88, runsOpen: 1, criticalDefects: 0, releasesActive: 1, trendPercent: 1, qualityGate: 'approved' }
    ],
    actions: []
  },
  mixed: {
    companies: [
      { id: 'GRM', name: 'Griaule', passRate: 68, runsOpen: 5, criticalDefects: 2, releasesActive: 3, trendPercent: -12, qualityGate: 'attention' },
      { id: 'CDS', name: 'CidadeSmart', passRate: 45, runsOpen: 10, criticalDefects: 4, releasesActive: 4, trendPercent: -22, qualityGate: 'failed' }
    ],
    actions: []
  },
  crisis: {
    companies: [
      { id: 'CDS', name: 'CidadeSmart', passRate: 28, runsOpen: 12, criticalDefects: 6, releasesActive: 5, trendPercent: -30, qualityGate: 'failed' }
    ],
    actions: []
  }
};

const arg = process.argv[2] || 'mixed';
if (!scenarios[arg]) {
  console.error('Unknown scenario:', arg);
  console.error('Available:', Object.keys(scenarios).join(', '));
  process.exit(1);
}

write(scenarios[arg]);
