const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { hitungJarakMeters } = require('../utils/geo');

const prisma = new PrismaClient();

// Konfigurasi Kantor Pusat (Bisa ditaruh di .env nantinya)
const KANTOR_LAT = -6.2088;   // Contoh latitude Jakarta Sudirman
const KANTOR_LNG = 106.8456;  // Contoh longitude Jakarta Sudirman
const RADIUS_MAKSIMAL = 100;  // Radius maksimal 100 meter untuk WFO
const JAM_MASUK_SHIFT = '08:30:00'; // Jadwal shift reguler

// Endpoint: Clock In
router.post('/clock-in', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, tipe_lokasi, user_id: reqUserId, foto, catatan, time_in, late_tol } = req.body;
    const user_id = reqUserId ? parseInt(reqUserId) : req.user.id;

    if (!tipe_lokasi) {
      return res.status(400).json({ error: 'tipe_lokasi (WFO/WFH) wajib diisi.' });
    }

    // 1. Cek apakah hari ini sudah melakukan Clock In
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0); // Set ke awal hari

    const presensiHariIni = await prisma.attendanceLog.findFirst({
      where: {
        user_id: user_id,
        tanggal: {
          gte: hariIni,
        }
      }
    });

    if (presensiHariIni) {
      return res.status(400).json({ error: 'Anda sudah mencatat kehadiran masuk hari ini.' });
    }

    // 2. Validasi Geolocation jika WFO
    let is_valid = true;
    let pesan_lokasi = 'Lokasi valid.';
    if (tipe_lokasi === 'WFO') {
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Koordinat lat dan lng wajib untuk WFO.' });
      }
      const jarak = hitungJarakMeters(lat, lng, KANTOR_LAT, KANTOR_LNG);
      if (jarak > RADIUS_MAKSIMAL) {
        is_valid = false;
        pesan_lokasi = `Anda berada di luar radius kantor (${Math.round(jarak)} meter dari kantor).`;
      }
    }

    // 3. Kalkulasi Keterlambatan
    const sekarang = new Date();
    const jamSekarang = sekarang.getHours() * 60 + sekarang.getMinutes(); // Dalam satuan menit
    const targetTimeIn = time_in || '08:30';
    const tolMins = late_tol ? parseInt(late_tol) : 0;
    const [jamShift, menitShift] = targetTimeIn.split(':').map(Number);
    const batasMasuk = jamShift * 60 + menitShift + tolMins;
    
    let status_kehadiran = 'Tepat Waktu';
    if (jamSekarang > batasMasuk) {
      status_kehadiran = 'Terlambat';
    }

    // 4. Simpan ke Database
    const koordinat_masuk = lat && lng ? `${lat},${lng}` : null;
    
    const newLog = await prisma.attendanceLog.create({
      data: {
        user_id,
        tanggal: sekarang,
        jam_masuk: sekarang,
        tipe_lokasi,
        koordinat_masuk,
        foto_bukti_masuk: foto || null,
        status_kehadiran,
        is_valid,
        catatan: catatan || null,
      }
    });

    res.status(201).json({
      message: 'Berhasil melakukan Clock In.',
      pesan_lokasi,
      status: status_kehadiran,
      data: newLog
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});


// Endpoint: Clock Out
router.post('/clock-out', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, user_id: reqUserId, catatan } = req.body;
    const user_id = reqUserId ? parseInt(reqUserId) : req.user.id;

    // Cari absen masuk hari ini
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    const presensiHariIni = await prisma.attendanceLog.findFirst({
      where: {
        user_id: user_id,
        tanggal: {
          gte: hariIni,
        }
      }
    });

    if (!presensiHariIni) {
      return res.status(400).json({ error: 'Anda belum melakukan Clock In hari ini.' });
    }

    if (presensiHariIni.jam_pulang) {
      return res.status(400).json({ error: 'Anda sudah melakukan Clock Out hari ini.' });
    }

    // Update jam pulang
    const sekarang = new Date();
    const koordinat_pulang = lat && lng ? `${lat},${lng}` : null;

    const updatedLog = await prisma.attendanceLog.update({
      where: { id: presensiHariIni.id },
      data: {
        jam_pulang: sekarang,
        koordinat_pulang
      }
    });

    res.json({
      message: 'Berhasil melakukan Clock Out.',
      data: updatedLog
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// Endpoint: Cek Status Kehadiran Hari Ini
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    const presensiHariIni = await prisma.attendanceLog.findFirst({
      where: {
        user_id: user_id,
        tanggal: {
          gte: hariIni,
        }
      }
    });

    if (!presensiHariIni) {
      return res.json({ status: 'BELUM_HADIR', data: null });
    }

    res.json({
      status: presensiHariIni.jam_pulang ? 'SELESAI' : 'SEDANG_BEKERJA',
      data: presensiHariIni
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// Endpoint: Summary Dashboard (KPI & Log 7 Hari)
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const user_id = req.query.user_id ? parseInt(req.query.user_id) : req.user.id;
    
    // Ambil log presensi 30 hari terakhir
    const logs = await prisma.attendanceLog.findMany({
      where: { user_id },
      orderBy: { tanggal: 'desc' },
      take: 30
    });

    let hadirTepatWaktu = 0;
    let terlambat = 0;
    let totalJamKerja = 0; // dalam jam

    logs.forEach(log => {
      if (log.status_kehadiran === 'Tepat Waktu') hadirTepatWaktu++;
      if (log.status_kehadiran === 'Terlambat') terlambat++;
      if (log.jam_masuk && log.jam_pulang) {
        const msDiff = new Date(log.jam_pulang) - new Date(log.jam_masuk);
        totalJamKerja += msDiff / (1000 * 60 * 60);
      }
    });

    const cutiApproved = await prisma.leaveRequest.count({
      where: { user_id, status: 'APPROVED' }
    });
    
    const quota = req.query.quota ? parseInt(req.query.quota) : 12;

    res.json({
      hadir_tepat_waktu: hadirTepatWaktu,
      terlambat: terlambat,
      sisa_cuti: quota - cutiApproved,
      total_jam_kerja: Math.round(totalJamKerja)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil summary' });
  }
});

// Endpoint: History Presensi
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const user_id = req.query.user_id ? parseInt(req.query.user_id) : req.user.id;
    const isAll = req.query.all === 'true';

    const whereClause = isAll ? {} : { user_id };

    const history = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: { user: { select: { nama: true, avatar: true, nik: true } } },
      orderBy: { tanggal: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;

// Endpoint: Tambah Catatan Manual
router.post('/add-note', authMiddleware, async (req, res) => {
  try {
    const { catatan, user_id: reqUserId } = req.body;
    const user_id = reqUserId ? parseInt(reqUserId) : req.user.id;

    if (!catatan || catatan.trim() === '') {
       return res.status(400).json({ error: 'Catatan tidak boleh kosong.' });
    }

    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    const presensiHariIni = await prisma.attendanceLog.findFirst({
      where: { user_id: user_id, tanggal: { gte: hariIni } }
    });

    if (!presensiHariIni) {
      return res.status(400).json({ error: 'Anda belum Clock In hari ini. Silakan Clock In terlebih dahulu untuk menambah catatan.' });
    }

    const existingCatatan = presensiHariIni.catatan || '';
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newCatatan = existingCatatan ? existingCatatan + ' | ' + timeStr + ': ' + catatan : timeStr + ': ' + catatan;

    const updated = await prisma.attendanceLog.update({
      where: { id: presensiHariIni.id },
      data: { catatan: newCatatan }
    });

    res.json({ message: 'Catatan berhasil ditambahkan.', catatan: newCatatan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});
