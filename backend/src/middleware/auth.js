'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware that verifies the JWT supplied in the Authorization header.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * On success: attaches req.userId (string) and calls next().
 * On failure: responds with 401 and does not call next().
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/**
 * Express middleware that verifies the requesting user is an admin.
 * Must be used AFTER requireAuth (depends on req.userId being set).
 *
 * Looks up the user in MongoDB and checks User.isAdmin === true.
 * On success: calls next().
 * On failure: responds with 403.
 */
async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
  } catch {
    return res.status(500).json({ message: 'Could not verify admin status.' });
  }
}

module.exports = { requireAuth, requireAdmin };
