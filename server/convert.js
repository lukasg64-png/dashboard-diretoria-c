const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = path.join(__dirname, '..', 'base Dashboard.xlsx');
const csvPath = path.join(__dirname, '..', 'base_dashboard.csv');

console.log('Reading Excel file:', xlsxPath);
const wb = XLSX.readFile(xlsxPath, {
  dense: true,
  cellDates: false,
  cellNF: false,
  cellText: false,
  cellStyles: false
});

const sheetName = wb.SheetNames.includes('BASE DASHBOARD') ? 'BASE DASHBOARD' : wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
console.log('Writing CSV file:', csvPath);

const stream = fs.createWriteStream(csvPath, 'utf8');

// Helper to escape CSV values
function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

const maxRow = ws.length || 0;
for (let r = 0; r < maxRow; r++) {
  const row = ws[r];
  if (!row) {
    stream.write('\n');
    continue;
  }
  const cells = [];
  const maxCol = row.length || 0;
  for (let c = 0; c < maxCol; c++) {
    const cell = row[c];
    cells.push(escapeCSV(cell && cell.v != null ? cell.v : ''));
  }
  stream.write(cells.join(';') + '\n');
}

stream.end();
console.log('Finished converting Excel to CSV!');
