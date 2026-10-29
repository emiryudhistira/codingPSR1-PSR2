export const SUPPORTED_FORMATS = ['DD/MM/YY', 'DD/MM/YYYY', 'MMM DD YYYY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Calendar components avoid UTC conversion and daylight-saving hour arithmetic.
export function addCalendarDays(date, days) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !Number.isSafeInteger(days) || days < 0) {
    throw new Error('Tanggal atau umur simpan tidak valid.');
  }
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
  if (Number.isNaN(result.getTime())) throw new Error('Tanggal kedaluwarsa di luar rentang.');
  return result;
}

export function formatCoding(date, pattern) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  switch (pattern) {
    case 'DD/MM/YY': return `${dd}/${mm}/${yyyy.slice(-2)}`;
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'MMM DD YYYY': return `${MONTHS[date.getMonth()]} ${dd} ${yyyy}`;
    default: throw new Error(`Format tanggal tidak didukung: ${pattern}`);
  }
}

export function renderPackaging(template, productionDate, shelfLifeDays, flavorCode = '') {
  const expiry = addCalendarDays(productionDate, shelfLifeDays);
  if (/\bVARIAN\b/.test(template) && !flavorCode) throw new Error('Pilih varian untuk koding karton.');
  const pad = (value) => String(value).padStart(2, '0');
  return template.split('\n').map((line) => {
    let date = expiry;
    // PR and EX may share a single line (for example the China carton).
    return line.split(/(\b(?:PR|EX)\s*:)/gi).map((segment) => {
      if (/^PR\s*:$/i.test(segment)) { date = productionDate; return segment; }
      if (/^EX\s*:$/i.test(segment)) { date = expiry; return segment; }
      const tokens = {
      D: String(date.getDate()), DD: pad(date.getDate()),
      M: String(date.getMonth() + 1), MM: pad(date.getMonth() + 1), MMM: MONTHS[date.getMonth()],
      Y: String(date.getFullYear()), YY: String(date.getFullYear()).slice(-2), YYYY: String(date.getFullYear()),
      h: String(productionDate.getHours()), hh: pad(productionDate.getHours()),
      m: String(productionDate.getMinutes()), mm: pad(productionDate.getMinutes()),
    };
      const plantSuffix = segment.search(/\b(?:1PSR|PSR)\b/);
      return segment.replace(/[A-Za-z]+/g, (word, offset) => {
      if (word === 'VARIAN') return flavorCode;
      // Country suffixes after the plant are literal, including Myanmar's MM.
      if (plantSuffix !== -1 && offset >= plantSuffix) return word;
      // Only complete token sequences are dynamic; plant and machine codes stay literal.
      if (!/^(?:YYYY|YY|Y|MMM|MM|M|DD|D|hh|h|mm|m)+$/.test(word)) return word;
      return word.replace(/YYYY|YY|Y|MMM|MM|M|DD|D|hh|h|mm|m/g, (token) => tokens[token]);
      });
    }).join('');
  }).join('\n');
}

export function validateProducts(data) {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Master produk kosong.');
  const ids = new Set();
  for (const product of data) {
    if (!product || typeof product.id !== 'string' || !product.id.trim() || ids.has(product.id) || typeof product.name !== 'string' || !product.name.trim() || !Array.isArray(product.variants) || !product.variants.length) throw new Error('Master produk tidak valid.');
    ids.add(product.id);
    const variants = new Set();
    for (const variant of product.variants) {
      const validFormat = variant && (typeof variant.coding_template === 'string' && variant.coding_template.trim() || typeof variant.prefix === 'string' && SUPPORTED_FORMATS.includes(variant.date_format));
      if (!variant || typeof variant.id !== 'string' || !variant.id.trim() || variants.has(variant.id) || typeof variant.name !== 'string' || !variant.name.trim() || !Number.isSafeInteger(variant.shelf_life_days) || variant.shelf_life_days < 0 || !validFormat) throw new Error('Master varian tidak valid.');
      addCalendarDays(new Date(), variant.shelf_life_days);
      if (variant.carton_template !== undefined && (typeof variant.carton_template !== 'string' || !variant.carton_template.trim())) throw new Error('Format karton tidak valid.');
      if (variant.flavor_options !== undefined) {
        if (!Array.isArray(variant.flavor_options)) throw new Error('Master varian karton tidak valid.');
        const flavorIds = new Set();
        for (const flavor of variant.flavor_options) {
          if (!flavor || typeof flavor.id !== 'string' || !flavor.id || flavorIds.has(flavor.id) || typeof flavor.name !== 'string' || !flavor.name.trim() || typeof flavor.code !== 'string' || !flavor.code.trim()) throw new Error('Kode varian karton tidak valid.');
          flavorIds.add(flavor.id);
        }
      }
      variants.add(variant.id);
    }
  }
  return data;
}
