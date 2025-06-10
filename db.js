// db.js
const Database = require('better-sqlite3');

// This will create or connect to camping.db
const db = new Database('camping.db');

// Optional: create tables if they don't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    isOwner BOOLEAN
  );

  CREATE TABLE IF NOT EXISTS camping_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    location TEXT,
    price REAL,
    ownerId INTEGER,
    FOREIGN KEY (ownerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    campingSpotId INTEGER,
    startDate TEXT,
    endDate TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (campingSpotId) REFERENCES camping_spots(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  campingSpotId INTEGER,
  rating INTEGER,
  comment TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (campingSpotId) REFERENCES camping_spots(id)
  );

  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campingSpotId INTEGER,
    date TEXT,
    isAvailable BOOLEAN,
    FOREIGN KEY (campingSpotId) REFERENCES camping_spots(id),
    UNIQUE (campingSpotId, date)
  );

`);

// Add extra columns safely (only if they don't already exist)
const alterColumns = [
  { name: 'address', type: 'TEXT' },
  { name: 'postalCode', type: 'TEXT' },
  { name: 'city', type: 'TEXT' },
  { name: 'country', type: 'TEXT' },
  { name: 'imageUrl', type: 'TEXT' }
];

alterColumns.forEach(col => {
  try {
    db.exec(`ALTER TABLE camping_spots ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Column '${col.name}' added`);
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log(`⚠️ Column '${col.name}' already exists`);
    } else {
      console.error(`❌ Error adding column '${col.name}':`, err.message);
    }
  }
});




module.exports = db;
