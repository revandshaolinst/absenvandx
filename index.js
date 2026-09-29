const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public', { etag: false, lastModified: false, setHeaders: (res) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); } }));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/admin', adminRoutes);

// --- ROUTES DASAR ---

// Root Endpoint
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Endpoint: Mendapatkan daftar semua user (Untuk testing)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nik: true, nama: true, email: true, role: true, avatar: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/announcement', async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/broadcast', async (req, res) => {
  if (req.body.message) {
    try {
      await prisma.announcement.create({
        data: { message: req.body.message }
      });
      res.json({ success: true, message: 'Pengumuman diperbarui' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(400).json({ error: 'Message is required' });
  }
});

app.put('/api/admin/announcement/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.announcement.update({
      where: { id },
      data: { message: req.body.message }
    });
    res.json({ success: true, message: 'Pengumuman diperbarui', data: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/announcement/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.announcement.delete({ where: { id } });
    res.json({ success: true, message: 'Pengumuman dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint Dummy: Registrasi User Baru (Karena belum ada halaman register)
app.post('/api/users/register', async (req, res) => {
  try {
    const { nik, nama, email, password, role, divisi_id } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await prisma.user.create({
      data: {
        nik,
        nama,
        email,
        password_hash: hashedPassword,
        role: role || 'Employee', // Default to Employee if not provided\n        divisi_id: divisi_id || 1
      },
    });
    
    res.status(201).json({ message: 'User berhasil dibuat', user: { id: newUser.id, nama: newUser.nama } });
  } catch (error) {
    res.status(400).json({ error: 'Gagal membuat user. Email atau NIK mungkin sudah terdaftar.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.attendanceLog.deleteMany({ where: { user_id: id } });
    await prisma.leaveRequest.deleteMany({ where: { user_id: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nama, email, password, avatar } = req.body;
    const updateData = {};
    if (nama) updateData.nama = nama;
    if (email) updateData.email = email;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (password) {
      const bcrypt = require('bcryptjs');
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- JALANKAN SERVER ---
app.listen(port, () => {
  console.log(`[ SERVER ] Backend berjalan di http://localhost:${port}`);
});
