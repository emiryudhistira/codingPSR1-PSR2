import { addCalendarDays, renderPackaging, validateProducts } from './date-engine.js';

const $ = (id) => document.getElementById(id);
const productSelect = $('product');
const variantSelect = $('variant');
const flavorSelect = $('flavor');
const dateLabel = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const fullDateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
let products = [];
let currentCoding = '';
let currentCartonCoding = '';
let currentMinute = '';
const selectedPlant = new URLSearchParams(window.location.search).get('plant');
$('plant-label').textContent = selectedPlant || 'Pilih plant';
let toastTimer;

function options(select, placeholder, items = []) {
  select.replaceChildren(new Option(placeholder, ''), ...items.map((item) => new Option(item.name, item.id)));
}

function selectedDestination() {
  return products.find((item) => item.id === productSelect.value)?.variants.find((item) => item.id === variantSelect.value);
}

function updateFlavorOptions() {
  const destination = selectedDestination();
  const needsFlavor = Boolean(destination?.carton_template?.includes('VARIAN'));
  $('flavor-field').hidden = !needsFlavor;
  const available = destination?.flavor_options || [];
  options(flavorSelect, available.length ? 'Pilih varian' : 'Varian belum tersedia', needsFlavor ? available : []);
  flavorSelect.disabled = !needsFlavor || !available.length;
}

function fitCartonText() {
  const output = $('carton-output');
  if ($('carton-filled').hidden || !output.textContent) return;
  output.style.fontSize = '';
  const maxSize = parseFloat(getComputedStyle(output).fontSize);
  if (!output.clientWidth || !Number.isFinite(maxSize)) return;
  if (output.scrollWidth <= output.clientWidth) return;
  let low = 1;
  let high = maxSize;
  while (high - low > 0.05) {
    const size = (low + high) / 2;
    output.style.fontSize = `${size}px`;
    if (output.scrollWidth <= output.clientWidth) low = size;
    else high = size;
  }
  output.style.fontSize = `${low}px`;
}

function renderCarton(today, product, destination) {
  const template = destination?.carton_template;
  const flavor = destination?.flavor_options?.find((item) => item.id === flavorSelect.value);
  const needsFlavor = Boolean(template?.includes('VARIAN'));
  const ready = Boolean(template && (!needsFlavor || flavor));
  currentCartonCoding = '';
  $('copy-carton').disabled = !ready;
  $('carton-empty').hidden = ready;
  $('carton-filled').hidden = !ready;
  $('carton-master-details').hidden = !template;
  $('carton-master-template').textContent = template || '';
  $('carton-inkjet').classList.toggle('has-result', ready);
  $('carton-status').classList.toggle('ready', ready);
  $('carton-status').textContent = ready ? 'Hasil tersedia' : destination ? !template ? 'Belum tersedia' : 'Pilih varian' : 'Menunggu pilihan';
  $('carton-empty-title').textContent = destination ? !template ? 'Format karton belum tersedia' : 'Pilih varian produk' : 'Siap untuk verifikasi';
  $('carton-empty-note').textContent = destination ? !template ? 'Belum ada master karton untuk produk dan tujuan ini.' : destination.flavor_options?.length ? 'Pilih varian untuk menampilkan tulisan karton yang sesuai.' : 'Master varian belum tersedia untuk produk dan tujuan ini.' : 'Pilih produk, tujuan, dan varian untuk melihat koding karton.';
  $('carton-expiry').textContent = destination ? dateLabel.format(addCalendarDays(today, destination.shelf_life_days)) : '—';
  $('carton-note').textContent = ready ? 'ED sama dengan kemasan primer.' : destination && template ? 'Lengkapi pilihan varian untuk koding karton.' : 'Lengkapi pilihan untuk melihat hasil.';
  $('carton-format-label').textContent = ready ? `${template.split('\n').length} BARIS` : '—';
  $('carton-output').textContent = '';
  $('carton-product').textContent = '';
  if (!ready) return;
  currentCartonCoding = renderPackaging(template, today, destination.shelf_life_days, flavor?.code);
  $('carton-output').textContent = currentCartonCoding;
  $('carton-product').textContent = `${selectedPlant} / ${product.name} / ${destination.name}${flavor ? ' / ' + flavor.name : ''}`;
  fitCartonText();
}

function render() {
  const today = new Date();
  currentMinute = `${today.toDateString()} ${today.getHours()}:${today.getMinutes()}`;
  $('today-label').textContent = fullDateLabel.format(today);
  const product = products.find((item) => item.id === productSelect.value);
  const variant = product?.variants.find((item) => item.id === variantSelect.value);
  renderCarton(today, product, variant);
  $('reset').disabled = !product;
  $('copy').disabled = !variant;
  $('empty-preview').hidden = Boolean(variant);
  $('filled-preview').hidden = !variant;
  $('master-details').hidden = !variant;
  $('inkjet').classList.toggle('has-result', Boolean(variant));
  $('result-status').textContent = variant ? '● Hasil tersedia' : 'Menunggu pilihan';
  $('result-status').classList.toggle('ready', Boolean(variant));
  $('production-date').textContent = variant ? dateLabel.format(today) : '—';
  $('result-note').textContent = variant ? '✓ Perhitungan tanggal selesai' : 'ⓘ Lengkapi pilihan untuk melihat hasil.';
  currentCoding = '';
  if (!variant) {
    $('format-label').textContent = '—';
    $('shelf-life').textContent = '— hari';
    $('expiry-date').textContent = '—';
    $('coding-output').textContent = '';
    $('output-product').textContent = '';
    $('master-template').textContent = '';
    return;
  }
  const expiry = addCalendarDays(today, variant.shelf_life_days);
  currentCoding = renderPackaging(variant.coding_template, today, variant.shelf_life_days);
  $('coding-output').textContent = currentCoding;
  $('output-product').textContent = `${selectedPlant} / ${product.name} / ${variant.name}`;
  $('format-label').textContent = `${currentCoding.split('\n').length} BARIS`;
  $('master-template').textContent = variant.coding_template;
  $('shelf-life').textContent = `${variant.shelf_life_days} hari`;
  $('expiry-date').textContent = dateLabel.format(expiry);
}

async function loadProducts() {
  productSelect.disabled = true;
  variantSelect.disabled = true;
  products = [];
  options(productSelect, 'Memuat master produk…');
  options(variantSelect, 'Pilih produk terlebih dahulu');
  updateFlavorOptions();
  $('data-error').hidden = true;
  render();
  try {
    const response = await fetch(new URL('./data/products.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Gagal memuat master data.');
    const allProducts = validateProducts(await response.json());
    products = allProducts.filter((p) => p.plant === selectedPlant);
    if (!products.length) { window.location.replace('./'); return; }
    options(productSelect, 'Pilih produk', products);
    productSelect.disabled = false;
  } catch (error) {
    options(productSelect, 'Master data tidak tersedia');
    $('data-error').hidden = false;
    $('data-error').querySelector('p').textContent = 'Periksa koneksi dan master data, lalu coba kembali.';
    console.error('Master data:', error.message);
  }
}

productSelect.addEventListener('change', () => {
  const product = products.find((item) => item.id === productSelect.value);
  options(variantSelect, product ? 'Pilih tujuan' : 'Pilih produk terlebih dahulu', product?.variants);
  variantSelect.disabled = !product;
  updateFlavorOptions();
  render();
});
variantSelect.addEventListener('change', () => { updateFlavorOptions(); render(); });
flavorSelect.addEventListener('change', render);
$('checker-form').addEventListener('submit', (event) => event.preventDefault());
$('checker-form').addEventListener('reset', (event) => {
  event.preventDefault();
  productSelect.value = '';
  options(variantSelect, 'Pilih produk terlebih dahulu');
  variantSelect.disabled = true;
  updateFlavorOptions();
  render();
});
async function copyOutput(carton = false) {
  render(); // Refresh first in case the device crossed midnight while idle.
  const text = carton ? currentCartonCoding : currentCoding;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $('toast').textContent = carton ? 'Koding karton berhasil disalin' : 'Coding berhasil disalin';
  } catch {
    $('toast').textContent = 'Tidak dapat menyalin otomatis. Pilih teks coding lalu salin secara manual.';
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($(carton ? 'carton-output' : 'coding-output'));
    selection.removeAllRanges();
    selection.addRange(range);
  }
  clearTimeout(toastTimer);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
$('copy').addEventListener('click', () => copyOutput());
$('copy-carton').addEventListener('click', () => copyOutput(true));
$('retry').addEventListener('click', loadProducts);
$('guide-button').addEventListener('click', () => $('guide-dialog').showModal());
$('close-guide').addEventListener('click', () => $('guide-dialog').close());
$('guide-dialog').addEventListener('click', (event) => { if (event.target === $('guide-dialog')) $('guide-dialog').close(); });
function refreshDay() {
  const now = new Date();
  if (`${now.toDateString()} ${now.getHours()}:${now.getMinutes()}` !== currentMinute) render();
}
setInterval(refreshDay, 1000);
document.addEventListener('visibilitychange', refreshDay);
window.addEventListener('focus', refreshDay);
window.addEventListener('resize', fitCartonText);
if (document.fonts) document.fonts.ready.then(fitCartonText);
if (window.ResizeObserver) {
  let previousWidth = 0;
  new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width;
    if (width !== previousWidth) { previousWidth = width; fitCartonText(); }
  }).observe($('carton-inkjet'));
}
loadProducts();
