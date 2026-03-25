const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== env.adminUser || password !== env.adminPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, role: 'admin' }, env.jwtSecret, { expiresIn: '12h' });
  return res.json({ token });
});

module.exports = router;
