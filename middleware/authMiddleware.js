const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Menyimpan data payload token (seperti id dan role) ke dalam request
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

module.exports = authMiddleware;
