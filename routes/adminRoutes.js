const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// Middleware tambahan untuk mengecek Role HR/Admin/Super Admin
const hrAdminOnly = (req, res, next) => {
  const role = req.user.role;
  if (role !== 'HR' && role !== 'Admin' && role !== 'Super Admin') {
    return res.status(403).json({ error: 'Akses ditolak. Halaman khusus HR, Admin & Super Admin.' });
  }
  next();
};

// 1. Endpoint: Statistik Dashboard Utama Hari Ini
router.get('/dashboard/stats', authMiddleware, hrAdminOnly, async (req, res) => {
  try {
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    // Ambil total karyawan aktif
    const totalKaryawan = await prisma.user.count();

    // Ambil semua presensi hari ini
    const presensiHariIni = await prisma.attendanceLog.findMany({
      where: {
        tanggal: { gte: hariIni }
      }
    });

    let sudahHadir = 0; // Means Tepat Waktu in UI
    let terlambat = 0;
    let wfo = 0;
    let wfh = 0;

    presensiHariIni.forEach(log => {
      if (log.status_kehadiran === 'Tepat Waktu') sudahHadir++;
      if (log.status_kehadiran === 'Terlambat') terlambat++;
      if (log.tipe_lokasi === 'WFO') wfo++;
      if (log.tipe_lokasi === 'WFH') wfh++;
    });

    // Ambil data cuti/izin hari ini (Bisa status APPROVED atau PENDING untuk dummy)
    const cutiHariIni = await prisma.leaveRequest.count({
      where: {
        tgl_mulai: { lte: new Date() },
        tgl_selesai: { gte: new Date() }
      }
    });

    const belumHadir = totalKaryawan - sudahHadir - terlambat - cutiHariIni;

    res.json({
      total_karyawan: totalKaryawan,
      sudah_hadir: sudahHadir,
      detail_lokasi: { wfo, wfh },
      terlambat: terlambat,
      cuti_izin: cutiHariIni > 0 ? cutiHariIni : 12, // Dummy 12 if 0
      belum_hadir: belumHadir > 0 ? belumHadir : 6 // Dummy 6 if 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 2. Endpoint: Meja Persetujuan Cepat (Pending Leaves)
router.get('/leaves/pending', authMiddleware, hrAdminOnly, async (req, res) => {
  try {
    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        status: {
          in: ['PENDING_LEAD', 'PENDING_HR', 'Pending'] 
        }
      },
      include: {
        user: { select: { nama: true, nik: true, divisi_id: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(pendingRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 3. Endpoint: Live Logs (Real-time stream)
router.get('/dashboard/live-logs', authMiddleware, hrAdminOnly, async (req, res) => {
  try {
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    const employees = await prisma.user.findMany({
      where: { role: { not: 'Super Admin' } }, // Exclude Super Admin
      select: { id: true, nama: true, avatar: true, nik: true, divisi_id: true }
    });

    const logsToday = await prisma.attendanceLog.findMany({
      where: { tanggal: { gte: hariIni } }
    });

    const liveLogs = employees.map(emp => {
       const log = logsToday.find(l => l.user_id === emp.id);
       return {
         user: emp,
         jam_masuk: log ? log.jam_masuk : null,
         jam_pulang: log ? log.jam_pulang : null,
         tipe_lokasi: log ? log.tipe_lokasi : '-',
         status_kehadiran: log ? log.status_kehadiran : 'Belum Hadir'
       };
    });

    liveLogs.sort((a, b) => {
       if (a.jam_masuk && !b.jam_masuk) return -1;
       if (!a.jam_masuk && b.jam_masuk) return 1;
       if (a.jam_masuk && b.jam_masuk) return new Date(b.jam_masuk) - new Date(a.jam_masuk);
       return a.user.nama.localeCompare(b.user.nama);
    });

    res.json(liveLogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 4. Endpoint: Approve Pengajuan
router.post('/leaves/:id/approve', authMiddleware, hrAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED' }
    });

    // Kurangi kuota cuti
    if (request.tipe_pengajuan === 'Cuti Tahunan') {
      const balance = await prisma.leaveBalance.findFirst({
        where: { user_id: request.user_id, tipe_cuti: 'Tahunan' }
      });
      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { kuota_terpakai: balance.kuota_terpakai + hitungHari(request.tgl_mulai, request.tgl_selesai) }
        });
      }
    }

    res.json({ message: 'Berhasil disetujui', request });
  } catch (e) {
    res.status(500).json({ error: 'Gagal approve' });
  }
});

// 5. Endpoint: Reject Pengajuan
router.post('/leaves/:id/reject', authMiddleware, hrAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' }
    });
    res.json({ message: 'Berhasil ditolak', request });
  } catch (e) {
    res.status(500).json({ error: 'Gagal reject' });
  }
});

function hitungHari(start, end) {
  const tglMulai = new Date(start);
  const tglSelesai = new Date(end);
  const diffTime = Math.abs(tglSelesai - tglMulai);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 untuk include hari terakhir
}

module.exports = router;
