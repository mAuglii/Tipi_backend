// middleware/auth.js

// Load the jsonwebtoken package to handle JWT tokens
const jwt = require('jsonwebtoken');

// Secret key used to sign and verify tokens (using .env file)
const SECRET = process.env.JWT_SECRET;


// Middleware function to protect routes by verifying JWT
function auth(req, res, next) {
  // Extract the token from the Authorization header (format: Bearer <token>)
  const token = req.headers.authorization?.split(' ')[1];

  // If no token is present, reject the request
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify the token and decode it
    const decoded = jwt.verify(token, SECRET);

    // Attach the user data (from token) to the request object
    req.user = decoded;

    // Proceed to the next middleware or route
    next();
  } catch (err) {
    // If token is invalid or expired, reject the request
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Export the middleware so it can be used in your routes
module.exports = auth;
