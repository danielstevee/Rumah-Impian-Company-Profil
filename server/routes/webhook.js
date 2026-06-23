const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');

router.post('/', (req, res) => {
    try {
        const notification = req.body;
        console.log('📩 Webhook received:', notification);

        const serverKey = process.env.MIDTRANS_SERVER_KEY;
        const { order_id, status_code, gross_amount, signature_key } = notification;
        
        const expectedSignature = crypto
            .createHash('sha512')
            .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
            .digest('hex');

        if (signature_key !== expectedSignature) {
            console.error('❌ Invalid signature');
            return res.status(403).json({ error: 'Invalid signature' });
        }

        const transactionStatus = notification.transaction_status;
        let newStatus = 'pending';

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            newStatus = 'paid';
        } else if (['deny', 'cancel', 'expire'].includes(transactionStatus)) {
            newStatus = 'failed';
        }

        db.run(`
            UPDATE orders 
            SET status = ?, 
                payment_type = ?, 
                midtrans_transaction_id = ?,
                paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE paid_at END
            WHERE order_id = ?
        `, [newStatus, notification.payment_type, notification.transaction_id, newStatus, order_id], 
        function(err) {
            if (err) {
                console.error('Error:', err);
                return res.status(500).json({ error: err.message });
            }

            if (newStatus === 'paid') {
                db.run(`
                    UPDATE houses 
                    SET status = 'booked' 
                    WHERE id = (SELECT house_id FROM orders WHERE order_id = ?)
                `, [order_id]);
            }

            console.log(`✅ Order ${order_id} → ${newStatus}`);
            res.status(200).json({ success: true });
        });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});

module.exports = router;