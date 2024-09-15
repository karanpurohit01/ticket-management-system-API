const bcrypt = require('bcryptjs');
const { pool } = require('../models/db');

exports.registerUser = async (req, res) => {
  const { name, email, type, password } = req.body;

  if (!['customer', 'admin'].includes(type)) {
    return res.status(400).json({ message: 'Invalid user type' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, type, password) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, type, hashedPassword]
    );
    const user = result.rows[0];
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
};
