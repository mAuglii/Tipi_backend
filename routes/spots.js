const express = require('express');
const path = require('path');
const db = require('../db');
const auth = require('../middleware/auth');

const multer = require('multer');
const router = express.Router();

// -----------------------------
// Multer setup for image uploads
// -----------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // Unique filename based on timestamp
  }
});

const upload = multer({ storage: storage });

// -----------------------------
// POST /spots
// Protected route – Create a camping spot with image and address info
// -----------------------------
router.post('/', auth, upload.single('image'), (req, res) => {
  const { title, description, location, price, address, postalCode, city, country } = req.body;
  const ownerId = req.user.id;

  // Check if user is an owner
  if (!req.user.isOwner) {
    return res.status(403).json({ error: 'Only owners can create spots' });
  }

  // Optional: get image URL if file was uploaded
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const stmt = db.prepare(`
      INSERT INTO camping_spots (
        title, description, location, price, ownerId,
        address, postalCode, city, country, imageUrl
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title, description, location, price, ownerId,
      address, postalCode, city, country, imageUrl
    );

    res.status(201).json({ message: 'Spot created', id: result.lastInsertRowid });
  } catch (err) {
    console.error('❌ Spot creation error:', err.message);
    res.status(500).json({ error: 'Failed to create spot' });
  }
});

// -----------------------------
// GET /spots
// Public route – Fetch all spots with filters and average rating only
// -----------------------------
router.get('/', (req, res) => {
  const { location, minPrice, maxPrice, startDate, endDate } = req.query;

  let query = `
    SELECT *
    FROM camping_spots
    WHERE 1 = 1
  `;
  const params = [];

  // Filter: location
  if (location) {
    query += ` AND LOWER(location) LIKE ?`;
    params.push(`%${location.toLowerCase()}%`);
  }

  // Filter: price range
  if (minPrice) {
    query += ` AND price >= ?`;
    params.push(minPrice);
  }
  if (maxPrice) {
    query += ` AND price <= ?`;
    params.push(maxPrice);
  }

  // Filter: availability
  if (startDate && endDate) {
    query += `
      AND id NOT IN (
        SELECT campingSpotId
        FROM bookings
        WHERE (
          ? < endDate AND ? > startDate
        )
      )
    `;
    params.push(startDate, endDate);
  }

  try {
    const stmt = db.prepare(query);
    const spots = stmt.all(...params);
    res.json(spots);
  } catch (err) {
    console.error('❌ Spot fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load spots' });
  }
});


// -----------------------------
// GET /spots/:id
// Public route – Get a specific camping spot by ID
// -----------------------------
router.get('/:id', (req, res) => {
  const id = req.params.id;

  try {
    const stmt = db.prepare('SELECT * FROM camping_spots WHERE id = ?');
    const spot = stmt.get(id);

    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    res.json(spot);
  } catch (err) {
    console.error('❌ Spot lookup error:', err.message);
    res.status(500).json({ error: 'Error fetching spot' });
  }
});

// -----------------------------
// PUT /spots/:id
// Protected route – Update a spot (owner only)
// -----------------------------
router.put('/:id', auth, upload.single('image'), (req, res) => {
  const spotId = req.params.id;
  const ownerId = req.user.id;

  // Extract updated fields from body
  const {
    title,
    description,
    location,
    price,
    address,
    postalCode,
    city,
    country
  } = req.body;

  // Check if user is an owner
  if (!req.user.isOwner) {
    return res.status(403).json({ error: 'Only owners can edit spots' });
  }

  // Check if the spot exists and belongs to this owner
  const existing = db.prepare(`SELECT * FROM camping_spots WHERE id = ? AND ownerId = ?`).get(spotId, ownerId);
  if (!existing) {
    return res.status(404).json({ error: 'Spot not found or unauthorized' });
  }

  // If a new image is uploaded, use it; otherwise keep existing image
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.imageUrl;

  try {
    const stmt = db.prepare(`
      UPDATE camping_spots
      SET title = ?, description = ?, location = ?, price = ?,
          address = ?, postalCode = ?, city = ?, country = ?, imageUrl = ?
      WHERE id = ? AND ownerId = ?
    `);

    stmt.run(
      title || existing.title,
      description || existing.description,
      location || existing.location,
      price || existing.price,
      address || existing.address,
      postalCode || existing.postalCode,
      city || existing.city,
      country || existing.country,
      imageUrl,
      spotId,
      ownerId
    );

    res.json({ message: 'Spot updated successfully' });
  } catch (err) {
    console.error('❌ Spot update error:', err.message);
    res.status(500).json({ error: 'Failed to update spot' });
  }
});


// -----------------------------
// GET /owner/spots
// Protected route – Get spots owned by the logged-in user
// -----------------------------
router.get('/owner/spots', auth, (req, res) => {
  const ownerId = req.user.id;

  // Check if user is really an owner
  if (!req.user.isOwner) {
    return res.status(403).json({ error: 'Only owners can view their spots' });
  }

  try {
    const stmt = db.prepare(`
      SELECT *
      FROM camping_spots
      WHERE ownerId = ?
    `);
    const spots = stmt.all(ownerId);
    res.json(spots);
  } catch (err) {
    console.error('❌ Failed to load owner spots:', err.message);
    res.status(500).json({ error: 'Failed to fetch owner spots' });
  }
});


// -----------------------------
// DELETE /spots/:id
// Protected route – Delete a camping spot (owner only)
// -----------------------------
router.delete('/:id', auth, (req, res) => {
  const spotId = req.params.id;
  const ownerId = req.user.id;

  if (!req.user.isOwner) {
    return res.status(403).json({ error: 'Only owners can delete spots' });
  }

  const existing = db
    .prepare('SELECT * FROM camping_spots WHERE id = ? AND ownerId = ?')
    .get(spotId, ownerId);

  if (!existing) {
    return res.status(404).json({ error: 'Spot not found or unauthorized' });
  }

  try {
    // 🔥 Delete all bookings for this spot first
    db.prepare('DELETE FROM bookings WHERE campingSpotId = ?').run(spotId);

    // Then delete the spot
    db.prepare('DELETE FROM camping_spots WHERE id = ?').run(spotId);

    res.json({ message: 'Spot deleted successfully' });
  } catch (err) {
    console.error('❌ Delete spot error:', err.message);
    res.status(500).json({ error: 'Failed to delete spot' });
  }
});





module.exports = router;
