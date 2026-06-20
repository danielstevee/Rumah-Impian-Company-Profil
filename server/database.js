const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initDatabase();
    }
});

function initDatabase() {
    // Tabel Rumah
    db.run(`
        CREATE TABLE IF NOT EXISTS houses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            price INTEGER NOT NULL,
            type TEXT NOT NULL,
            location TEXT NOT NULL,
            image TEXT,
            bedrooms INTEGER,
            bathrooms INTEGER,
            area INTEGER,
            status TEXT DEFAULT 'available',
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabel Orders
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            house_id INTEGER,
            customer_name TEXT NOT NULL,
            customer_email TEXT,
            customer_phone TEXT,
            amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_type TEXT,
            snap_token TEXT,
            midtrans_transaction_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME,
            FOREIGN KEY (house_id) REFERENCES houses(id)
        )
    `);

    // Insert dummy data kalau kosong
    db.get("SELECT COUNT(*) as count FROM houses", [], (err, row) => {
        if (err || row.count > 0) return;

        const dummyHouses = [
            ['Rumah Minimalis Modern', 200000000, 'jual', 'Jl. Soekarno Hatta No.1, Jakarta', '../asset/gambar1.png', 3, 2, 120, 'available', 'Rumah minimalis dengan desain modern dan fasilitas lengkap'],
            ['Apartemen Mewah Sudirman', 150000000, 'jual', 'Jl. Sudirman No.5, Jakarta', '../asset/gambar1.png', 2, 1, 80, 'available', 'Apartemen di pusat kota dengan view skyline'],
            ['Villa Ubud Bali', 5000000, 'sewa', 'Jl. Raya Ubud, Bali', '../asset/gambar1.png', 4, 3, 200, 'available', 'Villa dengan kolam renang pribadi'],
            ['Rumah Strategis Thamrin', 250000000, 'jual', 'Jl. Thamrin No.10, Jakarta', '../asset/gambar1.png', 3, 2, 150, 'available', 'Lokasi strategis dekat mall dan transportasi'],
            ['Kos Elite Diponegoro', 1500000, 'sewa', 'Jl. Diponegoro No.3, Bandung', '../asset/gambar1.png', 1, 1, 25, 'available', 'Kos eksklusif fasilitas lengkap'],
            ['Rumah Cluster Ahmad Yani', 350000000, 'jual', 'Jl. Ahmad Yani No.7, Surabaya', '../asset/gambar1.png', 4, 2, 180, 'available', 'Rumah di cluster perumahan dengan security 24 jam']
        ];

        const stmt = db.prepare(`
            INSERT INTO houses (title, price, type, location, image, bedrooms, bathrooms, area, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        dummyHouses.forEach(house => stmt.run(house));
        stmt.finalize();
        console.log('✅ Dummy houses inserted');
    });
}

module.exports = db;