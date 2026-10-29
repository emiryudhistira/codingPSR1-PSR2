import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateProducts } from '../date-engine.js';

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted) quoted = false;
      else if (!field) quoted = true;
      else throw new Error('Tanda kutip CSV tidak valid.');
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Kolom CSV belum ditutup.');
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function importProducts(text) {
  const [headers, ...rows] = parseCSV(text);
  const expected = ['Plant', 'Produk', 'Tujuan', 'Varian', 'Format Koding', 'Expired date'];
  if (!headers || headers.length !== expected.length || expected.some((h, i) => headers[i].trim() !== h)) throw new Error('Header CSV tidak sesuai.');
  const products = [];
  let duplicates = 0;
  rows.forEach((row, index) => {
    if (row.length !== 6) throw new Error(`Jumlah kolom tidak valid pada data ${index + 1}.`);
    const [plant, name, destination, variant, rawTemplate, days] = row.map((cell) => cell.trim());
    if (!plant || !name || !destination || !rawTemplate || !/^\d+$/.test(days)) throw new Error(`Data ${index + 1} tidak lengkap.`);
    const template = rawTemplate.replace(/\r\n?/g, '\n');
    let product = products.find((p) => p.plant === plant && p.name === name);
    if (!product) { product = { id: `prod-${products.length + 1}`, plant, name, variants: [] }; products.push(product); }
    const existing = product.variants.find((v) => v.name === destination);
    if (existing) {
      if (existing.coding_template !== template || existing.shelf_life_days !== Number(days)) throw new Error(`Format berbeda untuk ${plant} / ${name} / ${destination}; perlu penentuan varian.`);
      duplicates++; return;
    }
    product.variants.push({ id: `${product.id}-dest-${product.variants.length + 1}`, name: destination, source_variant: variant, coding_template: template, shelf_life_days: Number(days) });
  });
  validateProducts(products);
  return { products, sourceRows: rows.length, duplicates };
}

const normalizedProduct = (name) => name.replace(/\s+/g, '').toUpperCase();

function table(text, expected) {
  const [header, ...rows] = parseCSV(text);
  if (!header || header.length !== expected.length || expected.some((h, i) => header[i].trim() !== h)) throw new Error('Header CSV pendukung tidak sesuai.');
  return rows.map((row, index) => {
    if (row.length !== expected.length || row.some((cell) => !cell.trim())) throw new Error(`Data pendukung ${index + 1} tidak lengkap.`);
    return row.map((cell) => cell.trim().replace(/\r\n?/g, '\n'));
  });
}

export function importDatabase(primaryCSV, cartonCSV, flavorCSV) {
  const result = importProducts(primaryCSV);
  const cartons = table(cartonCSV, ['Plant', 'Produk', 'Tujuan', 'Varian', 'Format Koding']);
  const flavors = table(flavorCSV, ['Varian', 'Print Karton', 'Produk', 'Tujuan']);
  const warnings = [];
  for (const [plant, name, destination, sourceVariant, template] of cartons) {
    const product = result.products.find((p) => p.plant === plant && normalizedProduct(p.name) === normalizedProduct(name));
    const target = product?.variants.find((v) => v.name === destination);
    if (!target) { warnings.push(`Karton tanpa primer: ${plant} / ${name} / ${destination}`); continue; }
    if (sourceVariant !== 'All') throw new Error(`Format karton khusus varian belum didukung: ${name} / ${destination}`);
    if (target.carton_template && target.carton_template !== template) throw new Error(`Format karton ganda berbeda: ${name} / ${destination}`);
    target.carton_template = template;
  }
  for (const [, , productList] of flavors) {
    for (const name of productList.split(';').map((p) => p.trim())) {
      if (!result.products.some((p) => normalizedProduct(p.name) === normalizedProduct(name))) {
        const warning = `Produk varian tanpa primer: ${name}`;
        if (!warnings.includes(warning)) warnings.push(warning);
      }
    }
  }
  for (const product of result.products) {
    for (const destination of product.variants) {
      const matches = flavors.filter(([, , productList, target]) => productList.split(';').some((p) => normalizedProduct(p) === normalizedProduct(product.name)) && (target === 'All' || target === destination.name));
      const byName = new Map();
      for (const specific of [false, true]) {
        for (const [name, code, , target] of matches) {
          if ((target !== 'All') !== specific) continue;
          const key = name.toLowerCase();
          const previous = byName.get(key);
          if (previous?.source_destination === target && previous.code !== code) throw new Error(`Kode varian bertentangan: ${product.name} / ${name} / ${target}`);
          byName.set(key, { id: key.replace(/\s+/g, '-'), name, code, source_destination: target });
        }
      }
      destination.flavor_options = [...byName.values()];
      if (!destination.carton_template) warnings.push(`Primer tanpa karton: ${product.plant} / ${product.name} / ${destination.name}`);
      if (destination.carton_template?.includes('VARIAN') && !destination.flavor_options.length) warnings.push(`Varian belum tersedia: ${product.name} / ${destination.name}`);
    }
  }
  validateProducts(result.products);
  return { ...result, cartonRows: cartons.length, flavorRows: flavors.length, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await Promise.all(['Format.csv', 'Format Karton.csv', 'Format varian.csv'].map((file) => readFile(new URL('../data/' + file, import.meta.url), 'utf8')));
  const result = importDatabase(...files);
  await writeFile(new URL('../data/products.json', import.meta.url), JSON.stringify(result.products, null, 2) + '\n');
  console.log(`Imported ${result.sourceRows} rows: ${result.products.length} products, ${result.products.reduce((n,p)=>n+p.variants.length,0)} destinations, ${result.duplicates} identical duplicate(s).`);
  console.log(`Carton: ${result.cartonRows} rows; flavors: ${result.flavorRows} rows.`);
  for (const warning of result.warnings) console.warn(warning);
}
