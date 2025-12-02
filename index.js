const express = require("express");
const cors = require('cors');
const path = require("path");
const adminRoutes = require("./admin");
const personelRoutes = require("./personel");
const { sql, connectDb } = require("./db");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(adminRoutes);
app.use(personelRoutes);

// ==================== REZERVASYON API'LERİ ====================

// Tüm rezervasyonları listeleme
app.get("/reservations", async (req, res) => {
    try {
        const result = await sql.query(
            "SELECT Id, ad, Soyad, insanSayisi, Tarih, Saat, aciklama, Email, TelefonNumarasi FROM Reservasyonlar ORDER BY Tarih"
        );

        const rezervasyonlar = result.recordset.map((row) => {
            return {
                id: row.Id,
                isim: row.ad,
                Soyad: row.Soyad,
                kisiSayisi: row.insanSayisi,
                tarih: row.Tarih.toISOString().split("T")[0],
                saat: row.Saat.toString().slice(16, 21),
                aciklama: row.aciklama || "",
                email: row.Email,
                TelefonNumarasi: row.TelefonNumarasi
            };
        });

        res.json(rezervasyonlar);
    } catch (err) {
        console.error("Rezervasyonları listelerken hata:", err);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// Yeni rezervasyon ekleme
app.post("/reservations", async (req, res) => {
    const { isim, Soyad, kisiSayisi, tarih, saat, aciklama, email, TelefonNumarasi } = req.body;

    if (!isim || !Soyad || !kisiSayisi || !tarih || !saat || !email || !TelefonNumarasi) {
        return res.status(400).json({ message: "Eksik bilgi var" });
    }

    try {
        const result = await sql.query`
            INSERT INTO Reservasyonlar (ad, Soyad, insanSayisi, Tarih, Saat, aciklama, Email, TelefonNumarasi)
            OUTPUT INSERTED.Id, INSERTED.ad, INSERTED.Soyad, INSERTED.insanSayisi, INSERTED.Tarih, INSERTED.Saat, INSERTED.aciklama, INSERTED.TelefonNumarasi, INSERTED.Email
            VALUES(${isim}, ${Soyad}, ${kisiSayisi}, ${tarih}, ${saat}, ${aciklama}, ${email}, ${TelefonNumarasi})
        `;

        const row = result.recordset[0];

        const yeniRezervasyon = {
            id: row.Id,
            isim: row.ad,
            Soyad: row.Soyad,
            kisiSayisi: row.insanSayisi,
            tarih: row.Tarih.toISOString().split("T")[0],
            saat: row.Saat.toString().slice(0, 5),
            aciklama: row.aciklama || "",
            email: row.Email,
            TelefonNumarasi: row.TelefonNumarasi
        };

        res.status(201).json(yeniRezervasyon);
    } catch (err) {
        console.error("Rezervasyon eklerken hata:", err);
        res.status(500).json({ message: "Sunucu hatası (ekleme)" });
    }
});

// Rezervasyon silme
app.delete("/reservations/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Geçersiz id" });
    }

    try {
        const checkResult = await sql.query`
            SELECT Id, ad, Soyad, insanSayisi, Tarih, Saat, aciklama, Email, TelefonNumarasi
            FROM Reservasyonlar
            WHERE Id = ${id}
        `;

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ message: "Rezervasyon bulunamadı" });
        }

        const row = checkResult.recordset[0];

        await sql.query`DELETE FROM Reservasyonlar WHERE Id = ${id}`;

        const silinen = {
            id: row.Id,
            isim: row.ad,
            Soyad: row.Soyad,
            kisiSayisi: row.insanSayisi,
            tarih: row.Tarih.toISOString().split("T")[0],
            saat: row.Saat.toString().slice(0, 5),
            aciklama: row.aciklama || "",
            email: row.Email,
            TelefonNumarasi: row.TelefonNumarasi
        };

        return res.json({
            message: "Rezervasyon silindi",
            data: silinen,
        });
    } catch (err) {
        console.error("Rezervasyon silinirken hata oluştu:", err);
        res.status(500).json({ message: "Sunucu hatası (silme)" });
    }
});

// ==================== MASA & SİPARİŞ API'LERİ ====================

// Tüm masaları getir
app.get('/api/tables', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT m.*, 
                   (SELECT TOP 1 id FROM Siparisler WHERE masaNumarasi = m.masaNumarasi AND durum = 'active') as activeOrderId
            FROM Masalar m
            ORDER BY m.masaNumarasi
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Masalar getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Menü öğelerini getir
app.get('/api/menu', async (req, res) => {
    try {
        const result = await sql.query(`
  SELECT *
  FROM MenuOgeleri
  ORDER BY
    CASE 
      WHEN kategori = 'tavukdonerdurumler' THEN 1
      WHEN kategori = 'kebap' THEN 2
      WHEN kategori = 'servisdoner' THEN 3
      WHEN kategori = 'mezeler' THEN 4
      WHEN kategori = 'tatlilar' THEN 5
      WHEN kategori = 'icecekler' THEN 6
      ELSE 7
    END, id;
`);

        res.json(result.recordset);
    } catch (err) {
        console.error('Menü getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Belirli bir masanın aktif siparişini getir
app.get('/api/orders/table/:tableNumber', async (req, res) => {
    try {
        const { tableNumber } = req.params;

        const result = await sql.query`
  SELECT *
  FROM vw_DetayliSiparisler
  WHERE masaNumarasi = ${tableNumber}
    AND durum = 'active';
`;


        if (result.recordset.length === 0) {
            return res.json(null);
        }

        const order = {
            id: result.recordset[0].id,
            masaNumarasi: result.recordset[0].masaNumarasi,
            toplamTutar: result.recordset[0].toplamTutar,
            durum: result.recordset[0].durum,
            siparisTarihi: result.recordset[0].siparisTarihi,
            items: result.recordset
                .filter(r => r.menuOgeID)
                .map(r => ({
                    menuItemId: r.menuOgeID,
                    itemName: r.itemName,
                    category: r.category,
                    quantity: r.miktar,
                    price: r.tutar
                }))
        };

        res.json(order);
    } catch (err) {
        console.error('Sipariş getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Yeni sipariş oluştur
app.post('/api/orders', async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { tableNumber, items, totalPrice } = req.body;

        await transaction.begin();

        const orderResult = await transaction.request()
            .input('masaNumarasi', sql.Int, tableNumber)
            .input('toplamTutar', sql.Decimal(10, 2), totalPrice)
            .query(`
                INSERT INTO Siparisler (masaNumarasi, toplamTutar)
                OUTPUT INSERTED.id
                VALUES (@masaNumarasi, @toplamTutar)
            `);

        const orderId = orderResult.recordset[0].id;

        for (const item of items) {
            await transaction.request()
                .input('siparisID', sql.Int, orderId)
                .input('menuOgeID', sql.Int, item.menuItemId)
                .input('miktar', sql.Int, item.quantity)
                .input('tutar', sql.Decimal(10, 2), item.price)
                .query(`
                    INSERT INTO SipariSDetaylar (siparisID, menuOgeID, miktar, tutar)
                    VALUES (@siparisID, @menuOgeID, @miktar, @tutar)
                `);
        }

        await transaction.request()
            .input('masaNumarasi', sql.Int, tableNumber)
            .query(`UPDATE Masalar SET durum = 'occupied' WHERE masaNumarasi = @masaNumarasi`);

        await transaction.commit();

        res.json({
            success: true,
            orderId: orderId,
            message: 'Sipariş başarıyla oluşturuldu!'
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Sipariş oluşturma hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Siparişi güncelle
app.put('/api/orders/:orderId', async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { orderId } = req.params;
        const { items, totalPrice } = req.body;

        await transaction.begin();

        await transaction.request()
            .input('orderId', sql.Int, orderId)
            .input('toplamTutar', sql.Decimal(10, 2), totalPrice)
            .query(`UPDATE Siparisler SET toplamTutar = @toplamTutar WHERE id = @orderId`);

        await transaction.request()
            .input('orderId', sql.Int, orderId)
            .query(`DELETE FROM SipariSDetaylar WHERE siparisID = @orderId`);

        for (const item of items) {
            await transaction.request()
                .input('siparisID', sql.Int, orderId)
                .input('menuOgeID', sql.Int, item.menuItemId)
                .input('miktar', sql.Int, item.quantity)
                .input('tutar', sql.Decimal(10, 2), item.price)
                .query(`
                    INSERT INTO SipariSDetaylar (siparisID, menuOgeID, miktar, tutar)
                    VALUES (@siparisID, @menuOgeID, @miktar, @tutar)
                `);
        }

        await transaction.commit();

        res.json({
            success: true,
            message: 'Sipariş başarıyla güncellendi!'
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Sipariş güncelleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Tüm siparişleri getir
app.get('/api/orders/all', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT * FROM Siparisler 
            ORDER BY siparisTarihi DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Siparişleri getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Siparişi kapat (ödeme)
app.post('/api/orders/:orderId/close', async (req, res) => {
    try {
        const { orderId } = req.params;

        await sql.query`UPDATE Siparisler SET durum = 'completed' WHERE id = ${orderId}`;

        const orderInfo = await sql.query`SELECT masaNumarasi FROM Siparisler WHERE id = ${orderId}`;
        const masaNumarasi = orderInfo.recordset[0].masaNumarasi;

        const activeOrders = await sql.query`
            SELECT COUNT(*) as count 
            FROM Siparisler 
            WHERE masaNumarasi = ${masaNumarasi} AND durum = 'active'
        `;

        if (activeOrders.recordset[0].count === 0) {
            await sql.query`UPDATE Masalar SET durum = 'available' WHERE masaNumarasi = ${masaNumarasi}`;
        }

        res.json({
            success: true,
            message: 'Sipariş kapatıldı!'
        });

    } catch (err) {
        console.error('Sipariş kapatma hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Menü öğesi ekle
app.post('/api/menu', async (req, res) => {
    try {
        const { ad, kategori, fiyat } = req.body;

        const result = await sql.query`
            INSERT INTO MenuOgeleri (ad, kategori, fiyat)
            OUTPUT INSERTED.id
            VALUES (${ad}, ${kategori}, ${fiyat})
        `;

        res.json({
            success: true,
            id: result.recordset[0].id,
            message: 'Menü öğesi eklendi!'
        });

    } catch (err) {
        console.error('Menü öğesi ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Menü öğesi güncelle
app.put('/api/menu/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ad, kategori, fiyat } = req.body;

        await sql.query`
            UPDATE MenuOgeleri 
            SET ad = ${ad}, kategori = ${kategori}, fiyat = ${fiyat}
            WHERE id = ${id}
        `;

        res.json({
            success: true,
            message: 'Menü öğesi güncellendi!'
        });

    } catch (err) {
        console.error('Menü güncelleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Menü öğesi sil
app.delete('/api/menu/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Önce öğenin var olup olmadığını kontrol et
        const checkResult = await sql.query`SELECT id FROM MenuOgeleri WHERE id = ${id}`;

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Menü öğesi bulunamadı!'
            });
        }

        // Silme işlemi
        await sql.query`DELETE FROM MenuOgeleri WHERE id = ${id}`;

        console.log(`Menü öğesi silindi - ID: ${id}`);

        res.json({
            success: true,
            message: 'Menü öğesi başarıyla silindi!'
        });

    } catch (err) {
        console.error('Menü silme hatası:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==================== RAPOR API'LERİ (VIEW KULLANIMI) ====================
// Bu bölümü index.js'in sonuna, "SUNUCU BAŞLAT" bölümünden ÖNCE ekleyin

// Günlük satış raporu
app.get('/api/reports/daily', async (req, res) => {
    try {
        const { tarih } = req.query; // Format: YYYY-MM-DD

        let query = `
            SELECT 
                urunAdi,
                kategori,
                SUM(miktar) as toplamMiktar,
                SUM(tutar) as toplamTutar,
                COUNT(DISTINCT siparisID) as siparisSayisi
            FROM vw_SiparisRaporu
        `;

        if (tarih) {
            query += ` WHERE CAST(siparisTarihi AS DATE) = '${tarih}'`;
        } else {
            query += ` WHERE CAST(siparisTarihi AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        query += `
            GROUP BY urunAdi, kategori
            ORDER BY toplamTutar DESC
        `;

        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Günlük rapor hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Aylık satış raporu
app.get('/api/reports/monthly', async (req, res) => {
    try {
        const { yil, ay } = req.query;

        const currentYear = yil || new Date().getFullYear();
        const currentMonth = ay || (new Date().getMonth() + 1);

        const result = await sql.query`
            SELECT 
                gun,
                SUM(toplamTutar) as gunlukCiro,
                COUNT(DISTINCT siparisID) as siparisSayisi
            FROM vw_SiparisRaporu
            WHERE yil = ${currentYear} AND ay = ${currentMonth}
            AND durum = 'completed'
            GROUP BY gun
            ORDER BY gun
        `;

        res.json(result.recordset);
    } catch (err) {
        console.error('Aylık rapor hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// En çok satan ürünler
app.get('/api/reports/top-products', async (req, res) => {
    try {
        const { limit = 10, baslangic, bitis } = req.query;

        let query = `
            SELECT TOP ${limit}
                urunAdi,
                kategori,
                SUM(miktar) as toplamSatisMiktari,
                SUM(tutar) as toplamGelir,
                AVG(birimFiyat) as ortalamaBirimFiyat
            FROM vw_SiparisRaporu
            WHERE durum = 'completed'
        `;

        if (baslangic && bitis) {
            query += ` AND siparisTarihi BETWEEN '${baslangic}' AND '${bitis}'`;
        }

        query += `
            GROUP BY urunAdi, kategori
            ORDER BY toplamSatisMiktari DESC
        `;

        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('En çok satan ürünler hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Kategori bazlı satış analizi
app.get('/api/reports/category-analysis', async (req, res) => {
    try {
        const { baslangic, bitis } = req.query;

        let query = `
            SELECT 
                kategori,
                SUM(tutar) as toplamGelir,
                SUM(miktar) as toplamMiktar,
                COUNT(DISTINCT siparisID) as siparisSayisi,
                AVG(tutar) as ortalamaIslemTutari
            FROM vw_SiparisRaporu
            WHERE durum = 'completed'
        `;

        if (baslangic && bitis) {
            query += ` AND siparisTarihi BETWEEN '${baslangic}' AND '${bitis}'`;
        }

        query += `
            GROUP BY kategori
            ORDER BY toplamGelir DESC
        `;

        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Kategori analizi hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Haftalık satış trendi
app.get('/api/reports/weekly-trend', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT 
                gunAdi,
                SUM(toplamTutar) as toplamCiro,
                COUNT(DISTINCT siparisID) as siparisSayisi,
                AVG(toplamTutar) as ortalamaSiparisTutari
            FROM vw_SiparisRaporu
            WHERE siparisTarihi >= DATEADD(DAY, -7, GETDATE())
            AND durum = 'completed'
            GROUP BY gunAdi
            ORDER BY 
                CASE gunAdi
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                END
        `;

        res.json(result.recordset);
    } catch (err) {
        console.error('Haftalık trend hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Genel istatistikler (Dashboard için)
app.get('/api/reports/dashboard-stats', async (req, res) => {
    try {
        const bugunResult = await sql.query`
            SELECT 
                COUNT(DISTINCT siparisID) as bugunSiparisSayisi,
                ISNULL(SUM(toplamTutar), 0) as bugunCiro,
                ISNULL(AVG(toplamTutar), 0) as bugunOrtalamaSiparis
            FROM vw_SiparisRaporu
            WHERE CAST(siparisTarihi AS DATE) = CAST(GETDATE() AS DATE)
            AND durum = 'completed'
        `;

        const aylikResult = await sql.query`
            SELECT 
                COUNT(DISTINCT siparisID) as aylikSiparisSayisi,
                ISNULL(SUM(toplamTutar), 0) as aylikCiro,
                ISNULL(AVG(toplamTutar), 0) as aylikOrtalamaSiparis
            FROM vw_SiparisRaporu
            WHERE MONTH(siparisTarihi) = MONTH(GETDATE())
            AND YEAR(siparisTarihi) = YEAR(GETDATE())
            AND durum = 'completed'
        `;

        const topUrunlerResult = await sql.query`
            SELECT TOP 3
                urunAdi,
                SUM(miktar) as toplamSatis
            FROM vw_SiparisRaporu
            WHERE durum = 'completed'
            AND siparisTarihi >= DATEADD(DAY, -30, GETDATE())
            GROUP BY urunAdi
            ORDER BY toplamSatis DESC
        `;

        res.json({
            bugun: bugunResult.recordset[0] || { bugunSiparisSayisi: 0, bugunCiro: 0, bugunOrtalamaSiparis: 0 },
            aylik: aylikResult.recordset[0] || { aylikSiparisSayisi: 0, aylikCiro: 0, aylikOrtalamaSiparis: 0 },
            enCokSatanlar: topUrunlerResult.recordset
        });

    } catch (err) {
        console.error('Dashboard istatistikleri hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ANA SAYFA ====================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==================== SUNUCU BAŞLAT ====================

connectDb().then(() => {
    app.listen(PORT, () => {
        console.log(`===========================================`);
        console.log(`Server çalışıyor: http://localhost:${PORT}`);
        console.log(`Ana Sayfa: http://localhost:${PORT}`);
        console.log(`Admin Paneli: http://localhost:${PORT}/admin.html`);
        console.log(`Masalar: http://localhost:${PORT}/masalar.html`);
        console.log(`Rezervasyonlar: http://localhost:${PORT}/reservations`);
        console.log(`===========================================`);
    });
}).catch((err) => {
    console.error(" Uygulama başlatılamadı, DB bağlantı hatası:", err);
});