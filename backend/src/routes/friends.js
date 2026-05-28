const express = require('express');
const User = require('../models/User');
const UserSeasonStats = require('../models/UserSeasonStats');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/friends — list accepted friends + pending incoming requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friends', 'firstName lastName email avatar')
      .populate('friendRequests.from', 'firstName lastName email avatar')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      friends:        user.friends        || [],
      friendRequests: user.friendRequests || [],
    });
  } catch {
    res.status(500).json({ message: 'Failed to load friends.' });
  }
});

// GET /api/friends/search?q= — search users by name/email
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const me = await User.findById(req.userId).select('friends friendRequests blockedUsers').lean();
    if (!me) return res.status(404).json({ message: 'User not found.' });

    // IDs that have blocked me
    const blockedMeUsers = await User.find({ blockedUsers: req.userId }).select('_id').lean();
    const blockedMeIds = blockedMeUsers.map((u) => u._id.toString());

    const myBlockedIds = (me.blockedUsers || []).map((id) => id.toString());
    const friendIds    = (me.friends || []).map((id) => id.toString());
    const pendingIds   = (me.friendRequests || []).map((r) => r.from.toString());

    const regex = new RegExp(q, 'i');
    const results = await User.find({
      _id:   { $ne: req.userId },
      $or:   [{ firstName: regex }, { lastName: regex }, { email: regex }],
    })
      .select('firstName lastName email avatar')
      .limit(10)
      .lean();

    // Annotate and filter out blocked users
    const annotated = results
      .filter((u) => !myBlockedIds.includes(u._id.toString()) && !blockedMeIds.includes(u._id.toString()))
      .map((u) => {
        const id = u._id.toString();
        let status = 'none';
        if (friendIds.includes(id))  status = 'friend';
        else if (pendingIds.includes(id)) status = 'pending';
        return { ...u, status };
      });

    res.json(annotated);
  } catch {
    res.status(500).json({ message: 'Search failed.' });
  }
});

// GET /api/friends/leaderboard?sortBy= — friends + self ranked by a stat
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const allowed = ['avgPoints', 'avgAssists', 'avgRebounds', 'avgFg3m'];
    const sortBy = allowed.includes(req.query.sortBy) ? req.query.sortBy : 'avgPoints';

    const me = await User.findById(req.userId).select('friends').lean();
    if (!me) return res.status(404).json({ message: 'User not found.' });

    const ids = [...(me.friends || []), req.userId];

    const [statsDocs, users] = await Promise.all([
      UserSeasonStats.find({ userId: { $in: ids } }).lean(),
      User.find({ _id: { $in: ids } }).select('firstName lastName avatar').lean(),
    ]);

    const userMap = {};
    for (const u of users) userMap[u._id.toString()] = u;

    const entries = statsDocs.map((s) => {
      const u = userMap[s.userId.toString()] || {};
      return {
        userId:     s.userId.toString(),
        firstName:  u.firstName  || '',
        lastName:   u.lastName   || '',
        avatar:     u.avatar     || null,
        gamesPlayed: s.gamesPlayed,
        avgPoints:   s.avgPoints,
        avgAssists:  s.avgAssists,
        avgRebounds: s.avgRebounds,
        avgFg3m:     s.avgFg3m,
      };
    });

    // Also include users with no stats doc (0 games)
    for (const id of ids) {
      const sid = id.toString();
      if (!entries.find((e) => e.userId === sid)) {
        const u = userMap[sid] || {};
        entries.push({
          userId: sid, firstName: u.firstName || '', lastName: u.lastName || '',
          avatar: u.avatar || null, gamesPlayed: 0, avgPoints: 0,
          avgAssists: 0, avgRebounds: 0, avgFg3m: 0,
        });
      }
    }

    entries.sort((a, b) => b[sortBy] - a[sortBy]);
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));

    res.json(ranked);
  } catch {
    res.status(500).json({ message: 'Failed to load leaderboard.' });
  }
});

// POST /api/friends/request — send a friend request
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'targetUserId is required.' });
    if (targetUserId === req.userId) return res.status(400).json({ message: 'Cannot friend yourself.' });

    const [me, target] = await Promise.all([
      User.findById(req.userId).select('friends friendRequests blockedUsers').lean(),
      User.findById(targetUserId).select('friends friendRequests blockedUsers').lean(),
    ]);

    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Check if target has blocked requester
    if ((target.blockedUsers || []).some((id) => id.toString() === req.userId)) {
      return res.status(403).json({ message: 'Cannot send request.' });
    }
    // Check if requester has blocked target
    if ((me.blockedUsers || []).some((id) => id.toString() === targetUserId)) {
      return res.status(403).json({ message: 'Cannot send request to a blocked user.' });
    }
    // Already friends
    if ((me.friends || []).some((id) => id.toString() === targetUserId)) {
      return res.status(409).json({ message: 'Already friends.' });
    }
    // Pending request already sent
    if ((target.friendRequests || []).some((r) => r.from.toString() === req.userId)) {
      return res.status(409).json({ message: 'Request already sent.' });
    }
    // They already sent us a request — auto-accept
    if ((me.friendRequests || []).some((r) => r.from.toString() === targetUserId)) {
      await Promise.all([
        User.findByIdAndUpdate(req.userId, {
          $pull:      { friendRequests: { from: targetUserId } },
          $addToSet:  { friends: targetUserId },
        }),
        User.findByIdAndUpdate(targetUserId, {
          $addToSet: { friends: req.userId },
        }),
      ]);
      return res.json({ message: 'Friend request accepted (mutual).' });
    }

    await User.findByIdAndUpdate(targetUserId, {
      $push: { friendRequests: { from: req.userId } },
    });

    res.status(201).json({ message: 'Friend request sent.' });
  } catch {
    res.status(500).json({ message: 'Failed to send request.' });
  }
});

// POST /api/friends/accept — accept a friend request
router.post('/accept', requireAuth, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    if (!fromUserId) return res.status(400).json({ message: 'fromUserId is required.' });

    const me = await User.findById(req.userId).select('friendRequests').lean();
    const hasRequest = (me.friendRequests || []).some((r) => r.from.toString() === fromUserId);
    if (!hasRequest) return res.status(404).json({ message: 'Friend request not found.' });

    await Promise.all([
      User.findByIdAndUpdate(req.userId, {
        $pull:     { friendRequests: { from: fromUserId } },
        $addToSet: { friends: fromUserId },
      }),
      User.findByIdAndUpdate(fromUserId, {
        $addToSet: { friends: req.userId },
      }),
    ]);

    res.json({ message: 'Friend request accepted.' });
  } catch {
    res.status(500).json({ message: 'Failed to accept request.' });
  }
});

// POST /api/friends/decline — decline a friend request
router.post('/decline', requireAuth, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    if (!fromUserId) return res.status(400).json({ message: 'fromUserId is required.' });

    await User.findByIdAndUpdate(req.userId, {
      $pull: { friendRequests: { from: fromUserId } },
    });

    res.json({ message: 'Friend request declined.' });
  } catch {
    res.status(500).json({ message: 'Failed to decline request.' });
  }
});

// POST /api/friends/block — block a user
router.post('/block', requireAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'targetUserId is required.' });

    await Promise.all([
      // Add to blocker's blockedUsers, remove from both friends[], remove pending requests
      User.findByIdAndUpdate(req.userId, {
        $addToSet: { blockedUsers: targetUserId },
        $pull:     { friends: targetUserId, friendRequests: { from: targetUserId } },
      }),
      // Remove from target's friends[], remove any requests they sent us
      User.findByIdAndUpdate(targetUserId, {
        $pull: { friends: req.userId, friendRequests: { from: req.userId } },
      }),
    ]);

    res.json({ message: 'User blocked.' });
  } catch {
    res.status(500).json({ message: 'Failed to block user.' });
  }
});

// DELETE /api/friends/block/:targetUserId — unblock a user
router.delete('/block/:targetUserId', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { blockedUsers: req.params.targetUserId },
    });
    res.json({ message: 'User unblocked.' });
  } catch {
    res.status(500).json({ message: 'Failed to unblock user.' });
  }
});

// DELETE /api/friends/:friendId — remove a friend
router.delete('/:friendId', requireAuth, async (req, res) => {
  try {
    await Promise.all([
      User.findByIdAndUpdate(req.userId, { $pull: { friends: req.params.friendId } }),
      User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.userId } }),
    ]);
    res.json({ message: 'Friend removed.' });
  } catch {
    res.status(500).json({ message: 'Failed to remove friend.' });
  }
});

module.exports = router;
