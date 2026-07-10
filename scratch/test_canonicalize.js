const ABBREVIATION_MAP = {
  'baln': 'balneario', 'bal': 'balneario', 'floripa': 'florianopolis',
  'sta': 'santa', 'sto': 'santo', 'eng': 'engenheiro', 'mal': 'marechal',
  'dioni': 'dionisio', 'cnel': 'coronel', 'fco': 'francisco', 'franc': 'francisco',
  'gal': 'galeria', 'hosp': 'hospital', 'louren': 'lourenco', 'terez': 'terezinha',
  'ant': 'antonio', 's': 'sao',
};

const CITY_SUFFIX_MAP = {
  'sapucaia': 'sapucaia sul',
  'venancio': 'venancio aires',
  'rosario': 'rosario do sul',
  'cachoeira': 'cachoeira do sul',
  'sao lourenco do sul': 'sao lourenco', // Fix for SAO LOUREN DO SUL 1
  'sao lourenco oeste': 'sao lourenco do oeste',
  'sao francisco paula': 'sao francisco de paula',
  'sao sebastiao cai': 'sao sebastiao', // Fix for SAO SEBASTIAO CAI 1
  'sao pedro sul': 'sao pedro do sul',
  'julio castilhos': 'julio de castilhos',
  'quedas iguacu': 'quedas do iguacu',
  'cruzeiro oeste': 'cruzeiro do oeste',
  'sao miguel iguacu': 'sao miguel do iguacu',
  'encruzilhada sul': 'encruzilhada do sul',
  'cerro grande do sul': 'cerro grande', // Fix for CERRO GRANDE DO SUL 1
  'sao miguel oeste': 'sao miguel do oeste',
  'bela vista paraiso': 'bela vista do paraiso',
  'balneario arroio silva': 'balneario arroio do silva',
  'santa terezinha de itaipu': 'sta terezinha do itaipu', // Fix for STA TEREZ DE ITAIPU1
  'santo amaro': 'sto amaro imperatriz', // Fix for STO AMARO 1
};

const SPECIAL_VTEX_TO_CSV = {
  'farmacias sao joao delivery': 'porto alegre dark store',
  'pf matriz': 'pf matriz',
  'pf modelo': 'pf loja modelo',
  'pf uruguai': 'pf uruguai',
  'pf shopping bella': 'pf shopping',
  'pf general netto': 'pf general neto',
  'gruarapuava': 'guarapuava',
  'santo antonio missoes': 'santo antonio das missoes',
};

function canonicalize(normName) {
  let res = normName;
  if (SPECIAL_VTEX_TO_CSV[res] && SPECIAL_VTEX_TO_CSV[res] !== res) {
    return canonicalize(SPECIAL_VTEX_TO_CSV[res]);
  }

  res = res.replace(/([a-z])(\d)/g, '$1 $2');
  res = res.replace(/\b0+(\d+)\b/g, '$1');
  res = res.replace(/\s+(rs|pr|sc)\s*$/g, '');
  res = res.replace(/\s+(rs|pr|sc)\s+(\d)/g, ' $2');
  res = res
    .replace(/\s*-\s*(nova|shop|gal|hosp|merc|pr|sc|rs)\b/gi, '')
    .replace(/\b(nova|shop|gal|hosp|merc)\b/gi, '')
    .replace(/\bnv\b/g, '')
    .replace(/\bnov\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = res.split(' ');
  const expanded = words.map(w => ABBREVIATION_MAP[w] || w);
  res = expanded.join(' ');
  res = res.replace(/d\s+/g, 'd').replace(/d'/g, 'd');

  const numberMatch = res.match(/^(.+?)\s+(\d+)$/);
  if (numberMatch) {
    const baseName = numberMatch[1].trim();
    const num = numberMatch[2];
    if (CITY_SUFFIX_MAP[baseName]) {
      res = CITY_SUFFIX_MAP[baseName] + ' ' + num;
    }
  } else {
    if (CITY_SUFFIX_MAP[res]) {
      res = CITY_SUFFIX_MAP[res];
    }
  }

  // Also apply SPECIAL matching again to handle bases + numbers (like PF URUGUAI 1)
  const finalNumMatch = res.match(/^(.+?)\s+(\d+)$/);
  if (finalNumMatch) {
      const bName = finalNumMatch[1].trim();
      if (SPECIAL_VTEX_TO_CSV[bName] && SPECIAL_VTEX_TO_CSV[bName] !== bName) {
          res = SPECIAL_VTEX_TO_CSV[bName] + ' ' + finalNumMatch[2];
      }
  }

  if (SPECIAL_VTEX_TO_CSV[res] && SPECIAL_VTEX_TO_CSV[res] !== res) {
    return canonicalize(SPECIAL_VTEX_TO_CSV[res]);
  }

  return res.replace(/\s+/g, ' ').trim();
}

function normalizeStoreName(rawName) {
  if (!rawName) return '';
  return rawName.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tests = [
  "STO AMARO 2", "SAO FRANC PAULA 3", "SAO LOUREN DO SUL 1", "SAO SEBASTIAO CAI 1",
  "STO ANT MISSOES 1NOV", "STA TEREZ DE ITAIPU1", "PF", "CERRO GRANDE DO SUL1",
  "PF GENERAL NETTO 1", "PF URUGUAI 1", "XANGRI-LA 1"
];

tests.forEach(t => {
  const norm = normalizeStoreName(t);
  const can = canonicalize(norm);
  console.log(`Original: "${t}" -> Norm: "${norm}" -> Can: "${can}"`);
});
