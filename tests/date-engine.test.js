import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addCalendarDays, formatCoding, renderPackaging, resolveFlavorRule, validateProducts } from '../date-engine.js';
import { importProducts, importDatabase, parseCSV } from '../scripts/import-csv.js';

test('180 hari dari Oktober melewati batas tahun dengan benar', () => {
  assert.equal(formatCoding(addCalendarDays(new Date(2026, 9, 28), 180), 'DD/MM/YYYY'), '26/04/2027');
});
test('melewati Februari pada tahun kabisat dan tahun biasa', () => {
  assert.equal(formatCoding(addCalendarDays(new Date(2024, 1, 28), 1), 'DD/MM/YY'), '29/02/24');
  assert.equal(formatCoding(addCalendarDays(new Date(2024, 1, 28), 2), 'DD/MM/YY'), '01/03/24');
  assert.equal(formatCoding(addCalendarDays(new Date(2025, 1, 28), 1), 'DD/MM/YY'), '01/03/25');
});
test('menghitung hari kalender tanpa mengubah tanggal produksi', () => {
  const date = new Date(2026, 11, 31, 23, 59);
  assert.equal(formatCoding(addCalendarDays(date, 1), 'DD/MM/YYYY'), '01/01/2027');
  assert.equal(date.getDate(), 31);
  assert.equal(formatCoding(addCalendarDays(date, 0), 'DD/MM/YYYY'), '31/12/2026');
});
test('format angka dan nama bulan mengikuti aturan PRD', () => {
  const date = new Date(2027, 3, 6);
  assert.equal(formatCoding(date, 'DD/MM/YY'), '06/04/27');
  assert.equal(formatCoding(date, 'DD/MM/YYYY'), '06/04/2027');
  assert.equal(formatCoding(date, 'MMM DD YYYY'), 'APR 06 2027');
  assert.throws(() => formatCoding(date, 'UNKNOWN'));
});
test('master data aktual menghasilkan coding lokal dan ekspor', async () => {
  const data = validateProducts(JSON.parse(await readFile(new URL('../data/products.json', import.meta.url))));
  const amd = data.find((p) => p.plant === 'PSR1' && p.name === 'AMD 65');
  const today = new Date(2026, 9, 28, 8, 5);
  const local = amd.variants.find((v) => v.name === 'Lokal');
  const philippines = amd.variants.find((v) => v.name === 'Ekspor Philippines');
  assert.equal(renderPackaging(local.coding_template, today, local.shelf_life_days), '280627 A61A\n08:05 PSR');
  assert.equal(renderPackaging(philippines.coding_template, today, philippines.shelf_life_days), 'PR : 28 OCT 26\nEX : 28 JUN 27\nA61A 08:05 PSR');
});
test('menolak master data rusak agar tidak menampilkan coding keliru', () => {
  assert.throws(() => validateProducts([]));
  assert.throws(() => validateProducts([null]));
  const variant = { id: 'a', name: 'Lokal', prefix: 'EXP ', date_format: 'DD/MM/YY', shelf_life_days: -1 };
  assert.throws(() => validateProducts([{ id: 'p', name: 'Produk', variants: [variant] }]));
  assert.throws(() => addCalendarDays(new Date(), 1.5));
  assert.throws(() => addCalendarDays(new Date('invalid'), 1));
});

test('impor seluruh CSV sama dengan master JSON dan menggabungkan hanya duplikat identik', async () => {
  const files = await Promise.all(['Format.csv', 'Format Karton.csv', 'Format varian.csv'].map((name) => readFile(new URL('../data/' + name, import.meta.url), 'utf8')));
  const result = importDatabase(...files);
  const json = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url)));
  assert.deepEqual(result.products, json);
  assert.equal(result.sourceRows, 42);
  assert.equal(result.duplicates, 2);
  assert.equal(result.products.length, 6);
  assert.equal(result.products.reduce((n, p) => n + p.variants.length, 0), 32);
  assert.equal(result.cartonRows, 32);
  assert.equal(result.flavorRows, 19);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual([...new Set(json.map((p) => p.plant))], ['PSR1', 'PSR2']);
  for (const product of json) {
    for (const destination of product.variants) {
      const output = renderPackaging(destination.coding_template, new Date(2026, 9, 28, 8, 5), destination.shelf_life_days);
      assert.equal(output.split('\n').length, destination.coding_template.split('\n').length);
      assert.ok(!/DD|MM|YY|hh|mm/.test(output));
      assert.ok(destination.carton_template);
      assert.ok(destination.flavor_options.length);
    }
  }
});

test('karton China memisahkan tanggal PR dan EX dalam satu baris', () => {
  const date = new Date(2026, 9, 28, 8, 5);
  assert.equal(renderPackaging('PR : YYYYMMDD EX : YYYYMMDD AA VARIAN PSR CN', date, 243, 'BLU'), 'PR : 20261028 EX : 20270628 AA BLU PSR CN');
  assert.throws(() => renderPackaging('DDMMYY VARIAN PSR', date, 243));
  assert.equal(renderPackaging('DD MMM YY VARIAN 1234 A PSR MM', date, 365, 'MANGO'), '28 OCT 27 MANGO 1234 A PSR MM');
});

test('format China terbaru dan Original umum mengikuti master yang diperbarui', async () => {
  const data = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url)));
  const amd = data.find((p) => p.name === 'AMD 65');
  const china = amd.variants.find((d) => d.name === 'Ekspor China');
  const local = amd.variants.find((d) => d.name === 'Lokal');
  assert.equal(china.flavor_options.find((f) => f.name === 'Blueberry').code, 'BLU');
  assert.equal(china.flavor_options.find((f) => f.name === 'Strawberry').code, 'STW');
  assert.equal(china.flavor_options.find((f) => f.name === 'Original').code, 'ORI');
  assert.equal(local.flavor_options.find((f) => f.name === 'Blueberry').code, 'BLUEBERRY');
  assert.equal(local.flavor_options.find((f) => f.name === 'Original').code, 'ORIGINAL');
  assert.equal(china.carton_template, 'PR:YYYYMMDD EX:YYYYMMDD AA VARIAN PSR CN');
  assert.equal(renderPackaging(china.carton_template, new Date(2026, 9, 28, 8, 5), china.shelf_life_days, 'ORI'), 'PR:20261028 EX:20270628 AA ORI PSR CN');
});

test('EM80 Vietnam memiliki primer dan karton dengan ED yang sama', async () => {
  const data = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url)));
  const vietnam = data.find((p) => p.plant === 'PSR2' && p.name === 'EM80').variants.find((d) => d.name === 'Ekspor Vietnam');
  const today = new Date(2026, 9, 28, 8, 5);
  assert.equal(vietnam.shelf_life_days, 243);
  assert.equal(renderPackaging(vietnam.coding_template, today, vietnam.shelf_life_days), '280627 7AA\n08:05 PSR');
  assert.equal(renderPackaging(vietnam.carton_template, today, vietnam.shelf_life_days, vietnam.flavor_options.find((f) => f.name === 'Chocolate').code), '280627 CHOCOLATE 08:05 A PSR VN');
});

test('semua tujuan EM80 memakai umur simpan sesuai varian untuk primer dan karton', async () => {
  const data = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url)));
  const em80 = data.find((p) => p.name === 'EM80');
  const today = new Date(2026, 9, 28, 8, 5);
  for (const destination of em80.variants) {
    for (const flavor of destination.flavor_options) {
      const rule = resolveFlavorRule(destination, flavor);
      assert.equal(rule.shelf_life_days, flavor.name === 'Matcha' ? 182 : 243);
      const carton = renderPackaging(destination.carton_template, today, rule.shelf_life_days, flavor.code);
      assert.ok(carton.includes('08:05'));
    }
  }
  const local = em80.variants.find((d) => d.name === 'Lokal');
  const matcha = local.flavor_options.find((f) => f.name === 'Matcha');
  const rule = resolveFlavorRule(local, matcha);
  assert.equal(renderPackaging(rule.coding_template, today, rule.shelf_life_days), '280427 7AA\n08:05 PSR');
  assert.equal(renderPackaging(local.carton_template, today, rule.shelf_life_days, matcha.code), '280427 MATCHA 08:05 A PSR');
});

test('ED karton FRUTAS mengikuti primer yang berbeda antara lokal dan ekspor', async () => {
  const data = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url)));
  const frutas = data.find((p) => p.name === 'FRUTAS');
  const local = frutas.variants.find((d) => d.name === 'Lokal');
  const exported = frutas.variants.find((d) => d.name === 'Ekspor Myanmar');
  const today = new Date(2026, 9, 28, 8, 5);
  assert.equal(local.shelf_life_days, 182);
  assert.equal(exported.shelf_life_days, 365);
  assert.equal(renderPackaging(local.carton_template, today, local.shelf_life_days, 'GRAPE'), '280427 GRAPE 08:05 A PSR');
  assert.equal(renderPackaging(exported.carton_template, today, exported.shelf_life_days, 'MANGO'), '28 OCT 27 MANGO 08:05 A PSR MM');
});

test('renderer mempertahankan susunan, literal, PR, EX, dan huruf besar/kecil token', () => {
  const today = new Date(2024, 1, 28, 7, 3);
  assert.equal(renderPackaging('PR : YYYY MM DD\nEX : DDMMYYYY\n9AA hh:mm 1PSR', today, 1), 'PR : 2024 02 28\nEX : 29022024\n9AA 07:03 1PSR');
  assert.equal(renderPackaging('D/M/Y h:m LITERAL MALAYSIA A61A', today, 1), '29/2/2024 7:3 LITERAL MALAYSIA A61A');
  assert.equal(renderPackaging('EX : DD MM YY\nA61A hh:mm PSR', today, 2), 'EX : 01 03 24\nA61A 07:03 PSR');
});

test('parser mendukung BOM, CRLF, newline terkutip, koma, dan kutip ganda', () => {
  assert.deepEqual(parseCSV('\uFEFFa,b\r\n"x,y","line1\r\nline2 ""test"""\r\n'), [['a','b'],['x,y','line1\r\nline2 "test"']]);
  assert.throws(() => parseCSV('a,"open'));
  const header = 'Plant,Produk,Tujuan,Varian,Format Koding,Expired date\n';
  assert.throws(() => importProducts(header + 'PSR1,X,Lokal,All,DDMMYY,-1'));
  assert.throws(() => importProducts(header + 'PSR1,X,Lokal,All,DDMMYY,1\nPSR1,X,Lokal,All,DDMMYY,2'));
});
