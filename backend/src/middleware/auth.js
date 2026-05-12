'use strict';

const jwt = require('jsonwebtoken');

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

module.exports = { requireAuth };
