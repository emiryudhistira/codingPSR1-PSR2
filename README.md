# Coding Format — PSR 1 dan PSR 2

Website statis untuk memeriksa koding kemasan primer dan karton berdasarkan plant, produk, tujuan, dan varian. Menggunakan HTML, CSS, Bootstrap CDN, dan JavaScript tanpa database atau instalasi dependency.

## Mencoba lokal

Jalankan dengan Node.js 22 atau lebih baru:

```sh
node scripts/serve.js
```

Buka http://127.0.0.1:4173. Pilih plant, produk, tujuan, lalu varian untuk menampilkan karton. Primer langsung tersedia setelah produk dan tujuan dipilih. Alternatif: task VS Code **Preview QC Coding**, Laragon, atau `php -S localhost:8000`. Membuka HTML melalui `file://` tidak mendukung pemuatan master JSON.

## Master data

Tiga file sumber disimpan di proyek:

- [Format.csv](./data/Format.csv): format primer dan umur simpan.
- [Format Karton.csv](./data/Format%20Karton.csv): format karton, dicocokkan melalui plant, produk, dan tujuan.
- [Format varian.csv](./data/Format%20varian.csv): nama varian dan teks cetak karton berdasarkan produk serta tujuan.

Data terkini memiliki 42 baris primer, 32 baris karton, dan 19 baris aturan varian. Dua duplikat primer identik (EM80 Somaliland) digabungkan: hasilnya 6 produk dan 32 kombinasi produk–tujuan di dua plant, semuanya memiliki format karton dan pilihan varian.

| Plant | Produk | Kombinasi produk–tujuan |
| --- | --- | --- |
| PSR1 | AMD 65, MM80 | 9 |
| PSR2 | SP40, EM80, SQ120, FRUTAS | 23 |

Nama produk di master varian dinormalisasi untuk perbedaan spasi, sehingga `AMD65` cocok dengan `AMD 65`. Daftar produk dipisahkan `;`. Aturan tujuan `All` berlaku umum; aturan tujuan spesifik menggantikannya untuk varian yang sama. Misalnya China memakai `BLU`, `ORI`, dan `STW`.

**EM80** memerlukan pilihan varian untuk menampilkan primer dan karton: Matcha memiliki umur simpan 182 hari, varian lainnya 243 hari. Data varian Original umum sudah memakai AMD65 sehingga cocok dengan AMD 65; koding Original untuk China tetap `ORI`, sedangkan tujuan umum menggunakan `ORIGINAL`.

Setelah ketiga CSV diperbarui, jalankan:

```sh
node scripts/import-csv.js
node --test
```

Importer menghasilkan [products.json](./data/products.json), yang digunakan kedua halaman, dan mencetak ketidaksesuaian data. Commit JSON dan semua CSV bersama; tes memastikan hasil impor sama dengan JSON yang dipublikasikan. Aturan primer khusus varian mengikuti baris `All` untuk tujuan yang sama. Format karton khusus kolom Varian selain `All` belum didukung.

## Aturan koding

- ED = tanggal lokal perangkat + umur simpan dalam hari kalender. **ED karton selalu menggunakan umur simpan primer untuk tujuan yang dipilih.**
- `PR :` memakai tanggal produksi; `EX :` dan tanggal tanpa awalan memakai ED. PR dan EX dapat berada pada baris yang sama.
- `D` / `DD`: hari; `M` / `MM`: bulan angka; `MMM`: singkatan bulan Inggris kapital.
- `Y` / `YYYY`: tahun empat digit; `YY`: tahun dua digit.
- `h` / `hh`: jam format 24 jam; `m` / `mm`: menit. Token dua karakter menambahkan nol di depan.
- `VARIAN` diganti dengan **Print Karton** untuk varian yang dipilih, tanpa mengubah primer.
- Kode tetap seperti `A61A`, `1234`, `H`, `PSR`, dan akhiran negara tetap literal. `MM` setelah `PSR` adalah kode Myanmar, bukan bulan.
- Jam diperbarui setiap menit, ketika kembali ke tab, dan sebelum menyalin. Kedua tombol salin mempertahankan spasi dan pemisah baris sumber. Jika clipboard tidak tersedia, teks dipilih untuk disalin manual.

Contoh AMD 65 China, Blueberry, produksi 28 Oktober 2026, umur simpan 243 hari:

```text
PR:20261028 EX:20270628 AA BLU PSR CN
```

## Deploy ke GitHub Pages

1. Upload seluruh proyek, termasuk [.github/workflows/deploy.yml](./.github/workflows/deploy.yml), ke branch `main`.
2. Buka **Settings → Pages → Source → GitHub Actions**.
3. Jalankan **Actions → Deploy to GitHub Pages → Run workflow**. Push berikutnya menjalankan tes dan deployment otomatis.
4. URL hasil tersedia di **Settings → Pages** atau environment **github-pages**, biasanya `https://USERNAME.github.io/REPOSITORY/`.

Semua aset dan tautan relatif mendukung repository Pages dan custom domain. File website, master JSON, dan semua CSV disertakan dalam deployment. GitHub Pages tidak otomatis menyediakan pembatasan akses internal.

## Verifikasi

```sh
node --test
```

Tes mencakup batas tahun/kabisat, semua data sumber, duplikat, tanggal PR/EX dalam satu baris, literal negara, ED lokal/ekspor, kode varian tujuan spesifik, dan kasus data yang belum cocok. Pemeriksaan browser mencakup filter plant/produk/tujuan/varian, reset, salin primer/karton, dan tampilan desktop/mobile. Font dan Bootstrap memakai CDN; tata letak dasar tetap tersedia lewat CSS lokal.
