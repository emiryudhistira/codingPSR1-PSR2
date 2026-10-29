# Product Requirement Document (PRD)
## QC Expired Date (ED) Format Checker

---

## 1. Ringkasan Proyek (*Overview*)
**QC Expired Date (ED) Format Checker** adalah aplikasi web internal ringkas yang dirancang untuk membantu tim Quality Control (QC) dan operator produksi di pabrik dalam memverifikasi penulisan tanggal kedaluwarsa (*Expired Date*) serta format cetak mesin *inkjet* secara akurat dan *real-time* setiap harinya.

Aplikasi ini menggunakan kalkulasi tanggal otomatis berbasis hari berjalan (*current system date*) ditambah dengan umur simpan (*shelf life*) produk, sehingga menghilangkan risiko kesalahan hitung manual (*human error*) oleh operator.

---

## 2. Tujuan & Value Proposition (*Objectives*)
* **Eliminasi Human Error:** Mencegah kesalahan ketik atau salah hitung tanggal ED di mesin cetak *inkjet*.
* **Efisiensi Akses Data:** Mempercepat proses pencarian format *coding* resmi tanpa harus membuka dokumen kertas SOP/Master Specs.
* **Arsitektur Ringan & Portabel:** Menggunakan *Client-Side Data* (JSON) tanpa dependensi database, sehingga performa instan dan dapat diakses dari PC lab, tablet, maupun smartphone area produksi via jaringan LAN.

---

## 3. Pengguna Target (*Target Audience*)
* **Quality Control (QC) Inspector / Line Clearance:** Melakukan verifikasi kebenaran format cetak saat awal *shift*, ganti varian, atau *running test*.
* **Operator Mesin Coding / Packaging:** Memastikan teks yang di-input ke mesin *inkjet* sesuai dengan standar lokal maupun regulasi ekspor negara tujuan.

---

## 4. Alur Kerja Pengguna (*User Workflow*)

```
[ Awal: Landing Page ]
          │
          ▼
[ Step 1: Pilih Produk ] (Dropdown 1)
          │
          ▼
[ Step 2: Pilih Varian / Tujuan ] (Dropdown 2 - Terbuka setelah Step 1)
          │
          ▼
[ Step 3: Visualisasi Hasil ] (Format Mesin Inkjet + Info Shelf Life & Tanggal Produksi)
```

---

## 5. Spesifikasi Fitur (*Feature Requirements*)

### 5.1 Landing Page & Cascading Dropdown
* **Dropdown Produk (Kategori Utama):** Menampilkan daftar nama produk aktif.
* **Dropdown Detail Varian (Lokal / Koding Negara):** 
  * Secara *default* berstatus **Disabled** sampai produk utama dipilih.
  * Menampilkan opsi varian spesifik (contoh: *Lokal, Ekspor Filipina, Ekspor Malaysia*).

### 5.2 Dynamic Date Engine & Format Renderer
* Mengambil tanggal sistem hari ini (*Tgl Produksi*) secara otomatis.
* Menghitung tanggal kedaluwarsa: `ED = Tanggal Hari Ini + Shelf Life (Hari)`.
* Memformat string tanggal sesuai aturan cetak mesin (*Prefix + Date Pattern*), contoh:
  * `EXP 26/04/27`
  * `BB: APR 26 2027`
  * `USE BY 26/04/2027`

### 5.3 High-Contrast Display Panel
* Menampilkan hasil kalkulasi format *coding* dalam kotak bergaya terminal/mesin *inkjet* (latar gelap, teks hijau terang monospace) agar mudah dibaca di area produksi yang terang maupun gelap.
* Menampilkan metadata pendukung: Tanggal Produksi (Hari ini) dan Jumlah Hari *Shelf Life*.

---

## 6. Arsitektur Teknis & Tech Stack

| Komponen | Teknologi | Keterangan |
| --- | --- | --- |
| **Development Env** | Laragon / PHP Built-in Server | Web server lokal Windows |
| **Code Editor** | Visual Studio Code | Lingkungan pengembangan |
| **Frontend Framework**| HTML5 + Bootstrap 5 (CDN) | Antarmuka bersih, responsif, & tanpa build tool |
| **Logic & Engine** | Vanilla JavaScript (ES6) | Kalkulasi tanggal & *DOM Manipulation* |
| **Data Storage** | Native JSON (`products.json`) | Master data statis *read-only* |

---

## 7. Struktur Folder Proyek (VS Code)

```text
qc-ed-checker/
├── PRD.md               # Dokumen Spesifikasi Produk
├── index.html           # Antarmuka Utama (UI & Logic)
└── data/
    └── products.json    # Master Data Produk, Shelf Life, & Format Coding
```

---

## 8. Skema Master Data (`products.json`)

```json
[
  {
    "id": "prod-01",
    "name": "Cimory Squeeze",
    "variants": [
      {
        "id": "var-01-a",
        "name": "Lokal",
        "shelf_life_days": 180,
        "prefix": "EXP ",
        "date_format": "DD/MM/YY"
      },
      {
        "id": "var-01-b",
        "name": "Ekspor (Filipina)",
        "shelf_life_days": 180,
        "prefix": "BB: ",
        "date_format": "MMM DD YYYY"
      }
    ]
  }
]
```

---

## 9. Rencana Pengujian (*Testing Criteria*)

1. **Uji Validasi Cascading Dropdown:** 
   * Dropdown 2 harus kosong dan tidak bisa diklik sebelum Dropdown 1 dipilih.
   * Konten Dropdown 2 harus berganti sesuai dengan produk yang dipilih pada Dropdown 1.
2. **Uji Akurasi Tanggal:**
   * Pengujian perhitungan batas bulan dan tahun kabisat (contoh: menambahkan 180 hari dari bulan Oktober).
3. **Uji Responsivitas Tampilan:**
   * Tampilan harus presisi saat dibuka melalui layar smartphone/tablet operator maupun monitor PC desktop laboratorium.