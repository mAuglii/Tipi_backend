const express = require('express');
const bcrypt = require('bcrypt'); // For hashing passwords
const jwt = require('jsonwebtoken'); // For creating tokens
const db = require('../db'); // Our SQLite database connection

const router = express.Router();
const SECRET = process.env.JWT_SECRET; // Jsn token stored in the .env

// -----------------------------
// POST /register
// Registers a new user
// -----------------------------
router.post('/register', async (req, res) => {
  const { name, email, password, isOwner } = req.body;

  try {
    // Hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare and run SQL INSERT statement
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password, isOwner)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(name, email, hashedPassword, isOwner ? 1 : 0);

    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    // If email already exists or any other DB error
    res.status(400).json({ error: 'Email already exists' });
  }
});

// -----------------------------
// POST /login
// Authenticates a user and returns a JWT token
// -----------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Look up the user by email
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get(email);

  // If user not found, return error
  if (!user) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  // Compare provided password with hashed password in DB
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  // If credentials match, create a JWT token
  const token = jwt.sign(
    { id: user.id, isOwner: user.isOwner },
    SECRET,
    { expiresIn: '2h' } // token valid for 2 hours
  );

  // Respond with the token and user data (excluding password)
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      isOwner: user.isOwner
    }
  });
});

// -----------------------------
// GET /profile
// Returns the currently logged-in user based on the token
// -----------------------------
const auth = require('../middleware/auth') // ⬅️ Add this if missing

router.get('/profile', auth, (req, res) => {
  const userId = req.user.id

  try {
    const stmt = db.prepare('SELECT id, name, email, isOwner FROM users WHERE id = ?')
    const user = stmt.get(userId)

    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})


module.exports = router; // Export the router so it can be used in app.js
