const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// -----------------------------
// GET /availability/:spotId
// Public – Fetch all availability for a spot
// -----------------------------
router.get('/:spotId', (req, res) => {
  const spotId = req.params.spotId;

  try {
    const stmt = db.prepare(`
      SELECT date, isAvailable
      FROM availability
      WHERE campingSpotId = ?
    `);
    const availability = stmt.all(spotId);
    
    // Ensure isAvailable is always returned as number (0 or 1)
    res.json(
      availability.map(a => ({
        ...a,
        isAvailable: Number(a.isAvailable)
      }))
    );
  } catch (err) {
    console.error('❌ Failed to fetch availability:', err.message);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});


// -----------------------------
// POST /availability/:spotId
// Protected – Let owner set availability for a spot
// -----------------------------
router.post('/:spotId', auth, (req, res) => {
  const spotId = req.params.spotId;
  const ownerId = req.user.id;
  const { dates } = req.body; // Expect: [{ date: '2025-07-01', isAvailable: true }, ...]

  if (!req.user.isOwner) {
    return res.status(403).json({ error: 'Only owners can set availability' });
  }

  if (!Array.isArray(dates)) {
    return res.status(400).json({ error: 'Dates must be an array' });
  }

  try {
    // Check spot belongs to the current owner
    const spot = db.prepare('SELECT * FROM camping_spots WHERE id = ? AND ownerId = ?').get(spotId, ownerId);
    if (!spot) {
      return res.status(403).json({ error: 'You do not own this spot' });
    }

    const insert = db.prepare(`
      INSERT INTO availability (campingSpotId, date, isAvailable)
      VALUES (?, ?, ?)
      ON CONFLICT(campingSpotId, date) DO UPDATE SET isAvailable = excluded.isAvailable
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        insert.run(spotId, entry.date, entry.isAvailable ? 1 : 0);
      }
    });

    transaction(dates);

    res.json({ message: 'Availability updated' });
  } catch (err) {
    console.error('❌ Failed to update availability:', err.message);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

module.exports = router;
