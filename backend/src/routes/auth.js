const express = require('express');
const router = express.Router();

// TODO: POST /api/auth/register – hash password and create new user in MongoDB
router.post('/register', async (req, res) => {
  res.status(501).json({ message: 'Registration not yet implemented' });
});

// TODO: POST /api/auth/login – validate credentials and return session/token
router.post('/login', async (req, res) => {
  res.status(501).json({ message: 'Login not yet implemented' });
});

module.exports = router;
