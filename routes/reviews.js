const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// -----------------------------
// GET /reviews/:spotId
// Public – Get all reviews for a spot + average rating
// -----------------------------
router.get('/:spotId', (req, res) => {
  const spotId = req.params.spotId;

  try {
    // Get all reviews for the spot
    const reviews = db.prepare(`
      SELECT r.rating, r.comment, r.createdAt, u.name AS reviewer
      FROM reviews r
      JOIN users u ON r.userId = u.id
      WHERE r.campingSpotId = ?
      ORDER BY r.createdAt DESC
    `).all(spotId);

    // Get average rating
    const avg = db.prepare(`
      SELECT AVG(rating) AS averageRating
      FROM reviews
      WHERE campingSpotId = ?
    `).get(spotId);

    res.json({
      averageRating: avg.averageRating || 0,
      reviews
    });
  } catch (err) {
    console.error('❌ Failed to fetch reviews:', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


// -----------------------------
// POST /reviews/:spotId
// Protected – Submit or update a review
// -----------------------------
router.post('/:spotId', auth, (req, res) => {
  const userId = req.user.id;
  const spotId = req.params.spotId;
  const { rating, comment } = req.body;

  // Basic validation
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // Check if review already exists
    const existing = db.prepare(`
      SELECT id FROM reviews
      WHERE userId = ? AND campingSpotId = ?
    `).get(userId, spotId);

    if (existing) {
      // If exists → update it
      db.prepare(`
        UPDATE reviews
        SET rating = ?, comment = ?, createdAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(rating, comment || '', existing.id);

      return res.json({ message: 'Review updated' });
    } else {
      // Else → insert new
      db.prepare(`
        INSERT INTO reviews (userId, campingSpotId, rating, comment)
        VALUES (?, ?, ?, ?)
      `).run(userId, spotId, rating, comment || '');

      return res.status(201).json({ message: 'Review submitted' });
    }
  } catch (err) {
    console.error('❌ Failed to submit/update review:', err.message);
    res.status(500).json({ error: 'Failed to submit or update review' });
  }
});



module.exports = router;
