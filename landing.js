import { validateProducts } from './date-engine.js';

async function loadPlants() {
  const list = document.getElementById('plant-list');
  const error = document.getElementById('data-error');
  error.hidden = true;
  list.textContent = 'Memuat daftar plant…';
  try {
    const response = await fetch(new URL('./data/products.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Master data tidak tersedia.');
    const products = validateProducts(await response.json());
    if (products.some((p) => typeof p.plant !== 'string' || !p.plant.trim())) throw new Error('Plant tidak valid.');
    const plants = [...new Set(products.map((p) => p.plant))];
    list.replaceChildren();
    plants.forEach((plant, index) => {
      const entries = products.filter((p) => p.plant === plant);
      const link = document.createElement('a');
      link.className = 'plant-card';
      link.href = `./checker.html?plant=${encodeURIComponent(plant)}`;
      const icon = document.createElement('span'); icon.className = 'plant-card-icon'; icon.textContent = '▦'; icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.className = 'small-label'; label.textContent = `LOKASI PRODUKSI ${String(index + 1).padStart(2, '0')}`;
      const title = document.createElement('h3'); title.textContent = plant;
      const names = document.createElement('p'); names.textContent = entries.map((p) => p.name).join(' · ');
      const bottom = document.createElement('div'); bottom.className = 'plant-card-bottom';
      const count = document.createElement('span'); count.textContent = `${entries.length} produk · ${entries.reduce((n, p) => n + p.variants.length, 0)} tujuan produk`;
      const action = document.createElement('strong'); action.textContent = 'Buka plant ↗';
      bottom.append(count, action); link.append(icon, label, title, names, bottom); list.append(link);
    });
    document.getElementById('plant-count').textContent = `${plants.length} PLANT TERSEDIA`;
  } catch (err) {
    list.replaceChildren();
    document.getElementById('plant-count').textContent = 'DATA TIDAK TERSEDIA';
    error.hidden = false;
    console.error('Master plant:', err.message);
  }
}
document.getElementById('retry').addEventListener('click', loadPlants);
loadPlants();
