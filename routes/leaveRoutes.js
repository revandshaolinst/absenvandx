const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// 1. Endpoint: Melihat Sisa Kuota Cuti Karyawan
router.get('/balances', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const tahunSekarang = new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: { 
        user_id: user_id,
        tahun: tahunSekarang
      }
    });

    res.json({ balances });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 2. Endpoint: Mengajukan Cuti Baru
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { tipe_pengajuan, tgl_mulai, tgl_selesai, alasan, dokumen_url } = req.body;

    if (!tipe_pengajuan || !tgl_mulai || !tgl_selesai || !alasan) {
      return res.status(400).json({ error: 'Harap lengkapi semua form.' });
    }

    // (Opsional) Validasi apakah sisa kuota cukup (Untuk 'Cuti Tahunan')
    // Disederhanakan untuk contoh
    // const jumlahHari = hitungHari(tgl_mulai, tgl_selesai);

    const newRequest = await prisma.leaveRequest.create({
      data: {
        user_id,
        tipe_pengajuan,
        tgl_mulai: new Date(tgl_mulai),
        tgl_selesai: new Date(tgl_selesai),
        alasan,
        dokumen_url,
        status: 'PENDING_LEAD' // Default awal masuk ke persetujuan Atasan
      }
    });

    res.status(201).json({
      message: 'Pengajuan berhasil dibuat. Menunggu persetujuan Lead/Manager.',
      data: newRequest
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 3. Endpoint: Melihat Riwayat Pengajuan Sendiri
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    const requests = await prisma.leaveRequest.findMany({
      where: { user_id },
      orderBy: { createdAt: 'desc' },
      include: {
        approvalLogs: true // Menarik riwayat persetujuan dari atasan/HR
      }
    });

    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 4. Endpoint: Approve Pengajuan (Oleh Lead / HRD)
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const leave_id = parseInt(req.params.id);
    const approver_id = req.user.id;
    const approver_role = req.user.role; // Lead, Manager, HR, Admin

    // Hanya Lead, Manager, dan HR yang boleh melakukan approve
    if (!['Lead', 'Manager', 'HR', 'Admin'].includes(approver_role)) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leave_id }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let statusBaru = leaveRequest.status;

    // State Machine Multi-level Approval
    if (leaveRequest.status === 'PENDING_LEAD' && (approver_role === 'Lead' || approver_role === 'Manager')) {
      statusBaru = 'PENDING_HR'; // Lanjut ke HR
    } else if (leaveRequest.status === 'PENDING_HR' && (approver_role === 'HR' || approver_role === 'Admin')) {
      statusBaru = 'APPROVED'; // Selesai
      
      // LOGIKA MEMOTONG SISA KUOTA CUTI
      const durasiMs = leaveRequest.tgl_selesai.getTime() - leaveRequest.tgl_mulai.getTime();
      const jumlahHariCuti = Math.ceil(durasiMs / (1000 * 60 * 60 * 24)) + 1;
      const tahunSekarang = new Date().getFullYear();

      // Cek apakah user sudah punya data saldo cuti untuk tahun ini
      const balance = await prisma.leaveBalance.findFirst({
        where: { user_id: leaveRequest.user_id, tahun: tahunSekarang, tipe_cuti: leaveRequest.tipe_pengajuan }
      });

      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { kuota_terpakai: balance.kuota_terpakai + jumlahHariCuti }
        });
      } else {
        // Jika belum ada data (misal karyawan baru), buatkan kuota standar 12 hari
        await prisma.leaveBalance.create({
          data: {
            user_id: leaveRequest.user_id,
            tahun: tahunSekarang,
            tipe_cuti: leaveRequest.tipe_pengajuan,
            kuota_total: 12,
            kuota_terpakai: jumlahHariCuti
          }
        });
      }
      
    } else if (leaveRequest.status === 'APPROVED') {
      return res.status(400).json({ error: 'Pengajuan ini sudah disetujui sebelumnya.' });
    } else {
      return res.status(403).json({ error: 'Anda tidak memiliki wewenang pada tahap ini.' });
    }

    // Update status pengajuan
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: leave_id },
      data: { status: statusBaru }
    });

    // Catat log persetujuan
    await prisma.approvalLog.create({
      data: {
        leave_request_id: leave_id,
        approver_id: approver_id,
        status_keputusan: 'APPROVED',
        catatan: req.body.catatan || ''
      }
    });

    res.json({
      message: `Persetujuan berhasil. Status saat ini: ${statusBaru}`,
      data: updatedRequest
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// 5. Endpoint: Reject Pengajuan (Oleh Lead / HRD)
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const leave_id = parseInt(req.params.id);
    const approver_id = req.user.id;
    const approver_role = req.user.role;

    if (!['Lead', 'Manager', 'HR', 'Admin'].includes(approver_role)) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    // Langsung set status menjadi REJECTED
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: leave_id },
      data: { status: 'REJECTED' }
    });

    await prisma.approvalLog.create({
      data: {
        leave_request_id: leave_id,
        approver_id: approver_id,
        status_keputusan: 'REJECTED',
        catatan: req.body.catatan || 'Ditolak oleh atasan/HR.'
      }
    });

    res.json({
      message: 'Pengajuan berhasil ditolak.',
      data: updatedRequest
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
