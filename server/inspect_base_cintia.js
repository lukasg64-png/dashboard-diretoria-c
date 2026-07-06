const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const geoFilePath = "C:/Users/lucas.alves6/OneDrive - Farmácias São João/Documentos/ANTIGRAVITI/projeto C/BAse Cintia.xlsx";

try {
  const wb = XLSX.readFile(geoFilePath);
  console.log('Abas do arquivo:', wb.SheetNames);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log('Total de linhas na Base Cintia:', rows.length);
  if (rows.length > 0) {
    console.log('Colunas da primeira linha:', Object.keys(rows[0]));
    console.log('Primeiras 5 linhas da Base Cintia:');
    console.log(rows.slice(0, 5));
  }
} catch (e) {
  console.error(e);
}
