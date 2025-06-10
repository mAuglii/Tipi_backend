const bcrypt = require('bcrypt');
const express = require('express');
const db = require('../db'); // Access to SQLite DB
const auth = require('../middleware/auth'); // JWT middleware

const router = express.Router(); // Create router instance

// -----------------------------
// GET /users/me
// Protected route – Get logged-in user's profile
// -----------------------------
router.get('/me', auth, (req, res) => {
  const userId = req.user.id;

  try {
    const stmt = db.prepare(`
      SELECT id, name, email, isOwner
      FROM users
      WHERE id = ?
    `);
    const user = stmt.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// -----------------------------
// PUT /users/me
// Protected route – Update user's name and email and password
// -----------------------------
router.put('/me', auth, async (req, res) => {
  const userId = req.user.id;
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    let stmt;
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10); // hash the new password
      stmt = db.prepare(`
        UPDATE users
        SET name = ?, email = ?, password = ?
        WHERE id = ?
      `);
      stmt.run(name, email, hashedPassword, userId);
    } else {
      stmt = db.prepare(`
        UPDATE users
        SET name = ?, email = ?
        WHERE id = ?
      `);
      stmt.run(name, email, userId);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DELETE /users/me – Delete your own account
router.delete('/me', auth, (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Delete bookings made by this user
    db.prepare('DELETE FROM bookings WHERE userId = ?').run(userId);

    // 2. Find camping spots owned by this user
    const spots = db.prepare('SELECT id FROM camping_spots WHERE ownerId = ?').all(userId);

    // 3. For each owned spot, delete related bookings
    const deleteBookingsForSpot = db.prepare('DELETE FROM bookings WHERE campingSpotId = ?');
    for (const spot of spots) {
      deleteBookingsForSpot.run(spot.id);
    }

    // 4. Delete owned spots
    db.prepare('DELETE FROM camping_spots WHERE ownerId = ?').run(userId);

    // 5. Finally, delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'Your account and related data have been deleted' });
  } catch (err) {
    console.error('❌ Failed to delete user:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});





module.exports = router; // Export router
