const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Creates a signed JWT containing the user's ID.
// The secret and expiry are read from environment variables.
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
// Creates a new user account. Expects { firstName, lastName, email, password } in the request body.
// Returns a JWT and a sanitized user object (no passwordHash) on success.
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Reject the request early if any required field is missing
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  // Prevent duplicate accounts for the same email address
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  // Hash the password before storing it — plaintext is never saved
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, email, passwordHash });

  // Issue a token so the user is immediately logged in after registration
  const token = signToken(user._id);
  res.status(201).json({
    token,
    user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
  });
});

// POST /api/auth/login
// Authenticates an existing user. Expects { email, password } in the request body.
// Returns a JWT and a sanitized user object on success.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Reject the request early if any required field is missing
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  // Look up the user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Send message if no user with that email is found
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Compare the submitted password against the stored hash
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = signToken(user._id);
  res.status(200).json({
    token,
    user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
  });
});

module.exports = router;
