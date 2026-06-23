const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const db = require('../database');

// Setup Midtrans
let snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// POST: Buat order + Snap Token
router.post('/create', async (req, res) => {
    try {
        const { house_id, customer_name, customer_email, customer_phone } = req.body;

        if (!house_id || !customer_name) {
            return res.status(400).json({ error: 'House ID dan nama wajib diisi' });
        }

        db.get('SELECT * FROM houses WHERE id = ? AND status = ?', 
            [house_id, 'available'], 
            async (err, house) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!house) return res.status(404).json({ error: 'Rumah tidak tersedia' });

                const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                
                const parameter = {
                    transaction_details: {
                        order_id: orderId,
                        gross_amount: house.price
                    },
                    customer_details: {
                        first_name: customer_name,
                        email: customer_email || 'customer@example.com',
                        phone: customer_phone || '08123456789'
                    },
                    item_details: [{
                        id: house.id,
                        price: house.price,
                        quantity: 1,
                        name: house.title.substring(0, 50)
                    }]
                };

                const transaction = await snap.createTransaction(parameter);
                
                db.run(`
                    INSERT INTO orders (order_id, house_id, customer_name, customer_email, customer_phone, amount, snap_token)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [orderId, house.id, customer_name, customer_email, customer_phone, house.price, transaction.token], 
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    res.json({
                        success: true,
                        data: {
                            order_id: orderId,
                            snap_token: transaction.token,
                            redirect_url: transaction.redirect_url,
                            house: house
                        }
                    });
                });
            }
        );
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Gagal membuat order' });
    }
});

// GET cek status order
router.get('/:orderId', (req, res) => {
    db.get(`
        SELECT o.*, h.title as house_title, h.location, h.image 
        FROM orders o 
        JOIN houses h ON o.house_id = h.id 
        WHERE o.order_id = ?
    `, [req.params.orderId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, data: row });
    });
});

module.exports = router;