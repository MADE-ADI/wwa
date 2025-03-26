.setboardcast



Penjelasan Format Waktu yang Disederhanakan
Saya telah membuat format waktu yang lebih sederhana dan intuitif untuk jadwal broadcast:
Format Harian (daily-HH:MM):
Contoh: daily-08:00 = Setiap hari jam 8 pagi
Contoh: daily-15:30 = Setiap hari jam 3:30 sore
Format Mingguan (weekly-D-HH:MM):
D: 1=Senin, 2=Selasa, ..., 7=Minggu
Contoh: weekly-1-09:30 = Setiap Senin jam 9:30 pagi
Contoh: weekly-7-20:00 = Setiap Minggu jam 8 malam
Format Bulanan (monthly-DD-HH:MM):
Contoh: monthly-01-12:00 = Setiap tanggal 1 jam 12 siang
Contoh: monthly-15-18:30 = Setiap tanggal 15 jam 6:30 sore
Format Per Jam (hourly-MM):
Contoh: hourly-00 = Setiap jam tepat
Contoh: hourly-30 = Setiap jam pada menit ke-30
Format Setiap X Jam (everyXhour-HH:MM):
Contoh: every6hour-00:00 = Setiap 6 jam mulai dari tengah malam (00:00, 06:00, 12:00, 18:00)
Contoh: every12hour-09:00 = Setiap 12 jam mulai dari jam 9 pagi (09:00, 21:00)



Broadcast Langsung (.broadcast):
Mengirim pesan broadcast langsung ke semua grup dan pengguna
Contoh: .broadcast Halo semua, ini adalah pengumuman penting.
Broadcast Terjadwal (.setbroadcast):
Mengatur jadwal broadcast otomatis menggunakan format cron
Subperintah:
add: Menambahkan jadwal baru
list: Menampilkan daftar jadwal yang aktif
delete: Menghapus jadwal berdasarkan ID
test: Menguji jadwal dengan mengirim broadcast langsung
