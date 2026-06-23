const API_URL = 'http://localhost:3000/api';

function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

async function loadHouses() {
    try {
        const response = await fetch(`${API_URL}/houses`);
        const result = await response.json();
        
        if (!result.success) return;

        const container = document.getElementById('houses-container');
        if (!container) return;
        
        container.innerHTML = '';

        result.data.forEach(house => {
            container.innerHTML += createHouseCard(house);
        });
    } catch (error) {
        console.error('Error loading houses:', error);
    }
}

function createHouseCard(house) {
    const isAvailable = house.status === 'available';
    const statusBadge = isAvailable 
        ? '<span class="badge bg-success">Tersedia</span>' 
        : '<span class="badge bg-danger">Terbooking</span>';
    
    const button = isAvailable 
        ? `<button class="btn btn-primary w-100 mt-2" onclick="openBookingModal(${house.id}, '${house.title.replace(/'/g, "\\'")}', ${house.price})">Booking Sekarang</button>`
        : `<button class="btn btn-secondary w-100 mt-2" disabled>Sudah Terbooking</button>`;

    return `
        <div class="col-12 col-md-6 col-lg-4 mb-5">
            <div class="card p-2 w-100 h-100">
                <img src="${house.image}" class="card-img-top" alt="${house.title}" style="height: 220px; object-fit: cover;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h4 class="mb-0">${formatRupiah(house.price)}</h4>
                        ${statusBadge}
                    </div>
                    <p class="mb-1 lh-sm">${house.location}<br>
                        <span class="text-danger text-uppercase">${house.type}</span>
                    </p>
                    <p class="text-muted small">${house.description}</p>
                </div>
                <div class="card-fasilitas d-flex justify-content-between px-4 mb-3">
                    <div class="text-center">
                        <i class="bi bi-door-open-fill"></i>
                        <span>${house.bedrooms}</span>
                        <p class="small mb-0">Kamar</p>
                    </div>
                    <div class="text-center">
                        <i class="bi bi-droplet-fill"></i>
                        <span>${house.bathrooms}</span>
                        <p class="small mb-0">Mandi</p>
                    </div>
                    <div class="text-center">
                        <i class="bi bi-rulers"></i>
                        <span>${house.area} m²</span>
                        <p class="small mb-0">Luas</p>
                    </div>
                </div>
                <div class="px-3 pb-3">
                    ${button}
                </div>
            </div>
        </div>
    `;
}

function openBookingModal(houseId, title, price) {
    document.getElementById('house_id').value = houseId;
    document.getElementById('house-info').innerHTML = `
        <h6>${title}</h6>
        <p class="mb-0 text-primary fw-bold">${formatRupiah(price)}</p>
    `;
    
    const modalEl = document.getElementById('bookingModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Handle booking form
document.addEventListener('DOMContentLoaded', function() {
    loadHouses();

    const form = document.getElementById('bookingForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const houseId = document.getElementById('house_id').value;
            const customerName = document.getElementById('customer_name').value;
            const customerEmail = document.getElementById('customer_email').value;
            const customerPhone = document.getElementById('customer_phone').value;

            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/orders/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        house_id: parseInt(houseId),
                        customer_name: customerName,
                        customer_email: customerEmail,
                        customer_phone: customerPhone
                    })
                });

                const result = await response.json();

                if (result.success) {
                    bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
                    
                    snap.pay(result.data.snap_token, {
                        onSuccess: function(result) {
                            alert('✅ Pembayaran berhasil! Order ID: ' + result.order_id);
                            loadHouses();
                        },
                        onPending: function(result) {
                            alert('⏳ Pembayaran pending. Silakan selesaikan pembayaran Anda.');
                        },
                        onError: function(result) {
                            alert('❌ Pembayaran gagal. Silakan coba lagi.');
                        },
                        onClose: function() {
                            alert('Anda menutup popup pembayaran.');
                        }
                    });
                } else {
                    alert('Gagal: ' + result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Terjadi kesalahan. Silakan coba lagi.');
            } finally {
                submitBtn.innerHTML = 'Lanjutkan Pembayaran';
                submitBtn.disabled = false;
            }
        });
    }
});