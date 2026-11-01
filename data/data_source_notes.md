# Data Source Notes (hasil inspeksi file asli)

## A. AI4I 2020 (Uploaded Dataset) - `data/raw/ai4i2020.csv`
- 10.000 baris, 14 kolom, tanpa nilai kosong, tanpa duplikat, `UDI` unik. Machine failure 3,39% (339 baris).
- Mode kegagalan (jumlah flag): TWF 46, HDF 115, PWF 95, OSF 98, RNF 19. Tipe: L 6.000 / M 2.997 / H 1.003.
- TIDAK memiliki plant, timestamp, shift, tenaga kerja, output, atau inspeksi kualitas.
- `Product ID` adalah ID produk (kualitas L/M/H + nomor seri), bukan terbukti ID mesin fisik.
- `sim_date`, `sim_plant_id`, `sim_line_id` adalah atribut demonstrasi yang DIBANGKITKAN (bukan bagian dari file asli).

## B. WFS Behaviors & Records (Uploaded Dataset) - `data/raw/wfs_behaviors_and_records_*.csv`
- 411.948 baris, 42 kolom, 687 individu, 25 tim (24 tim + 'unassigned'), 3 shift. Encoding **Windows-1252** (bukan UTF-8).
- Periode: 2021-01-01 s/d 2022-06-30 (format tanggal m/d/yyyy).
- Tidak ada kamus data di dalam file yang diunggah. Akhiran `_h` kemungkinan berarti nilai "hidden/referensi" (di luar pengetahuan supervisor), tetapi ini **belum diverifikasi** terhadap dokumentasi Kaggle; karena itu perbandingan recorded vs `_h` tidak dipakai di dashboard.
- Baris `Presence` dan `Efficacy` (masing-masing ~191 ribu) adalah catatan harian, bukan kejadian perilaku. Kejadian perilaku = Absence, Sacrifice, Teamwork, Feat, Idea, Lapse, Slip, Disruption, Sabotage, Onboarding, Resignation, Termination.
- Setiap tim hanya berada di satu shift; rata-rata ~20 orang/tim (min 20 dalam agregat bulanan).
- **Dihapus dari semua output:** nama, usia, jenis kelamin, kesehatan, atribut kepribadian/kemampuan subjektif, catatan teks supervisor, ID supervisor.
- ID individu dipseudonimkan (SHA-256) hanya untuk menghitung orang berbeda; tidak ada tabel individu yang dipublikasikan.
- Agregasi bulanan (shift x jenis event; tim x kategori event) dengan penekanan sel bila < 5 orang berbeda (`suppressed=True`).
- Kategori event (Positive contribution, Conduct/quality lapse, Absence, Workforce change) adalah pengelompokan buatan proyek ini.
- Hanya peran Laborer pada tim/shift yang ditetapkan yang dianalisis.

## C. Simulated Dataset - `data/synthetic/`
- Seed tetap 20240601. Periode 2021-07-01 s/d 2022-06-30 (hari kerja), 4 plant, 12 lini, 3 shift.
- Pemetaan 24 tim WFS ke 4 plant adalah atribut simulasi (2 tim per shift per plant); headcount per plant-shift berasal dari jumlah orang WFS (~40).
- Pola yang disuntikkan secara sengaja (ilustratif): Plant C: downtime, absensi, overtime, dan turnover meningkat pada kuartal terakhir; Plant D: lonjakan defect sementara.
- Identitas: good_units = inspected - scrap; defect = rework + scrap; FPY = first_pass / inspected.
- Tidak ada hubungan kausal nyata antara WFS, AI4I, dan data sintetis.
