const jwt = require('jsonwebtoken');

// A JWT is a signed string. The payload only holds the user id.
// Anyone can READ it, but nobody can change it without knowing JWT_SECRET.
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = generateToken;
