'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require a valid JWT (requireAuth) AND isAdmin === true (requireAdmin).
const guard = [requireAuth, requireAdmin];

// GET /api/admin/users
// Returns every user in the database, excluding passwordHash.
// Used by the admin panel to render the user management table.
router.get('/users', guard, async (req, res) => {
  try {
    const users = await User.find({})
      .select('firstName lastName email isAdmin createdAt')
      .sort({ createdAt: 1 })
      .lean();

    res.json(users);
  } catch (err) {
    console.error('[admin] GET /users error:', err.message);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// DELETE /api/admin/users/:id
// Permanently deletes a user account.
// Admins cannot delete their own account through this endpoint.
router.delete('/users/:id', guard, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('[admin] DELETE /users/:id error:', err.message);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// PATCH /api/admin/users/:id/role
// Sets or clears the isAdmin flag on a target user.
// Body: { isAdmin: boolean }
// Admins cannot remove their own admin status through this endpoint.
router.patch('/users/:id/role', guard, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ message: 'isAdmin must be a boolean.' });
    }

    if (id === req.userId && isAdmin === false) {
      return res.status(400).json({ message: 'You cannot remove your own admin status.' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isAdmin } },
      { new: true, select: 'firstName lastName email isAdmin createdAt' },
    ).lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json(user);
  } catch (err) {
    console.error('[admin] PATCH /users/:id/role error:', err.message);
    res.status(500).json({ message: 'Failed to update user role.' });
  }
});

module.exports = router;
