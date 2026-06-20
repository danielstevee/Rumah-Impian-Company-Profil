const express = require('express');
const router = express.Router();
const db = require('../database');

// GET semua rumah (dengan filter)
router.get('/', (req, res) => {
    const { type, location, min_price, max_price } = req.query;
    let sql = 'SELECT * FROM houses WHERE 1=1';
    const params = [];

    if (type) {
        sql += ' AND type = ?';
        params.push(type);
    }
    if (location) {
        sql += ' AND location LIKE ?';
        params.push(`%${location}%`);
    }
    if (min_price) {
        sql += ' AND price >= ?';
        params.push(min_price);
    }
    if (max_price) {
        sql += ' AND price <= ?';
        params.push(max_price);
    }

    sql += ' ORDER BY created_at DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

// GET detail rumah
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM houses WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'House not found' });
        res.json({ success: true, data: row });
    });
});

module.exports = router;