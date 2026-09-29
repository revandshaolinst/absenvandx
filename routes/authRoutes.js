const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');

// Endpoint: Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password harus diisi.' });
    }

    // Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    // Cek kecocokan password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    // Generate JWT Token (payload: id, role, divisi)
    const token = jwt.sign(
      { id: user.id, role: user.role, divisi_id: user.divisi_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Token berlaku 24 jam
    );

    // Kirim response sukses beserta token dan profil singkat
    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// Endpoint: Get Profil Sendiri (Mewajibkan Token)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user didapatkan dari authMiddleware setelah token diverifikasi
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        id: true, 
        nik: true, 
        nama: true, 
        email: true, 
        role: true, 
        divisi_id: true, 
        manager_id: true 
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
