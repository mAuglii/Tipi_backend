const express = require('express');
const db = require('../db'); // Import SQLite database
const auth = require('../middleware/auth'); // JWT middleware to protect routes

const router = express.Router(); // Create a router instance

// -----------------------------
// POST /bookings
// Protected route – Book a camping spot (only on available dates)
// -----------------------------
router.post('/', auth, (req, res) => {
  const { campingSpotId, startDate, endDate } = req.body;
  const userId = req.user.id;

  if (!campingSpotId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing booking fields' });
  }

  try {
    // 🚫 Extra Check: Has this user already booked this spot?
    const existingBookingStmt = db.prepare(`
      SELECT 1
      FROM bookings
      WHERE userId = ? AND campingSpotId = ?
    `);
    const existingBooking = existingBookingStmt.get(userId, campingSpotId);

    if (existingBooking) {
      return res.status(400).json({
        error: 'You have already booked this camping spot.'
      });
    }

    // Step 1: Get all unavailable or missing availability dates in the range
    const checkStmt = db.prepare(`
      SELECT date
      FROM availability
      WHERE campingSpotId = ?
        AND date >= ? AND date <= ?
        AND isAvailable != 1
    `);
    const blockedDates = checkStmt.all(campingSpotId, startDate, endDate);

    if (blockedDates.length > 0) {
      return res.status(400).json({
        error: 'Some dates are unavailable for booking',
        blockedDates: blockedDates.map(d => d.date)
      });
    }

    // Step 2: Check if the spot is already booked in the same range
    const conflictStmt = db.prepare(`
      SELECT id FROM bookings
      WHERE campingSpotId = ?
        AND NOT (endDate < ? OR startDate > ?)
    `);
    const conflict = conflictStmt.get(campingSpotId, startDate, endDate);

    if (conflict) {
      return res.status(400).json({
        error: 'This spot is already booked during the selected dates.'
      });
    }

    // Step 3: All checks passed → Insert booking
    const insertStmt = db.prepare(`
      INSERT INTO bookings (userId, campingSpotId, startDate, endDate)
      VALUES (?, ?, ?, ?)
    `);
    const result = insertStmt.run(userId, campingSpotId, startDate, endDate);

    res.status(201).json({
      message: 'Booking created',
      bookingId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('❌ Booking error:', err.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});



// -----------------------------
// GET /bookings
// Protected route – Fetches all bookings made by the logged-in user
// -----------------------------
router.get('/', auth, (req, res) => {
  const userId = req.user.id; // Get user ID from JWT

  try {
    // Fetch all bookings and related spot info for current user
    const stmt = db.prepare(`
      SELECT bookings.id, camping_spots.title, camping_spots.location,
             bookings.startDate, bookings.endDate
      FROM bookings
      JOIN camping_spots ON bookings.campingSpotId = camping_spots.id
      WHERE bookings.userId = ?
    `);

    const bookings = stmt.all(userId); // Get all rows
    res.json(bookings); // Return result
  } catch (err) {
    console.error('❌ Booking fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// -----------------------------
// GET /bookings/:spotId
// Public – Get all bookings for a spot
// -----------------------------
router.get('/:spotId', (req, res) => {
  const spotId = req.params.spotId;

  try {
    const stmt = db.prepare(`
      SELECT startDate, endDate
      FROM bookings
      WHERE campingSpotId = ?
    `);
    const bookings = stmt.all(spotId);
    res.json(bookings);
  } catch (err) {
    console.error('❌ Failed to fetch spot bookings:', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// DELETE /bookings/:id
// Protected route – Deletes a specific booking owned by the logged-in user
router.delete('/:id', auth, (req, res) => {
  const userId = req.user.id;
  const bookingId = req.params.id;

  // Check if the booking belongs to the user
  const existing = db
    .prepare('SELECT * FROM bookings WHERE id = ? AND userId = ?')
    .get(bookingId, userId);

  if (!existing) {
    return res.status(404).json({ error: 'Booking not found or unauthorized' });
  }

  try {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('❌ Booking deletion error:', err.message);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});



module.exports = router; // Export the router so it can be mounted in app.js
