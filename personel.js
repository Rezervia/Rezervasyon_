const express = require("express");
const sql = require("mssql");
const router = express.Router();

// Tüm personelleri listeleme
router.get("/personel", async (req, res) => {
    try {
        const result = await sql.query(
            "SELECT Id, AdSoyad, Telefon, CalismaSaatleri, IzinGunu FROM Personel ORDER BY AdSoyad"
        );

        const personeller = result.recordset.map((row) => {
            return {
                id: row.Id,
                adSoyad: row.AdSoyad,
                telefon: row.Telefon,
                calismaSaatleri: row.CalismaSaatleri,
                izinGunu: row.IzinGunu
            };
        });

        res.json(personeller);
    } catch (err) {
        console.error("Personelleri listelerken hata:", err);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// Yeni personel ekleme
router.post("/personel", async (req, res) => {
    const { adSoyad, telefon, calismaSaatleri, izinGunu } = req.body;

    //kontrol kısmı
    if (!adSoyad || !telefon || !calismaSaatleri || !izinGunu) {
        return res.status(400).json({ message: "Eksik bilgi var" });
    }

    // Telefon numarası kontrolü (10 haneli olmalı)
    if (telefon.length !== 10 || !/^\d{10}$/.test(telefon)) {
        return res.status(400).json({ message: "Telefon numarası 10 haneli olmalıdır" });
    }

    try {
        const result = await sql.query`
            INSERT INTO Personel (AdSoyad, Telefon, CalismaSaatleri, IzinGunu)
            OUTPUT INSERTED.Id, INSERTED.AdSoyad, INSERTED.Telefon, INSERTED.CalismaSaatleri, INSERTED.IzinGunu
            VALUES(${adSoyad}, ${telefon}, ${calismaSaatleri}, ${izinGunu})
        `;

        const row = result.recordset[0];

        const yeniPersonel = {
            id: row.Id,
            adSoyad: row.AdSoyad,
            telefon: row.Telefon,
            calismaSaatleri: row.CalismaSaatleri,
            izinGunu: row.IzinGunu
        };

        res.status(201).json(yeniPersonel);
    } catch (err) {
        console.error("Personel eklerken hata:", err);
        res.status(500).json({ message: "Sunucu hatası (ekleme)" });
    }
});

// Personel güncelleme
router.put("/personel/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { adSoyad, telefon, calismaSaatleri, izinGunu } = req.body;

    if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Geçersiz id" });
    }

    if (!adSoyad || !telefon || !calismaSaatleri || !izinGunu) {
        return res.status(400).json({ message: "Eksik bilgi var" });
    }

    // Telefon numarası kontrolü
    if (telefon.length !== 10 || !/^\d{10}$/.test(telefon)) {
        return res.status(400).json({ message: "Telefon numarası 10 haneli olmalıdır" });
    }

    try {
        // Personel var mı kontrol
        const checkResult = await sql.query`
            SELECT Id FROM Personel WHERE Id = ${id}
        `;

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ message: "Personel bulunamadı" });
        }

        // Güncelleme
        const result = await sql.query`
            UPDATE Personel 
            SET AdSoyad = ${adSoyad}, 
                Telefon = ${telefon}, 
                CalismaSaatleri = ${calismaSaatleri}, 
                IzinGunu = ${izinGunu}
            OUTPUT INSERTED.Id, INSERTED.AdSoyad, INSERTED.Telefon, INSERTED.CalismaSaatleri, INSERTED.IzinGunu
            WHERE Id = ${id}
        `;

        const row = result.recordset[0];

        const guncellenenPersonel = {
            id: row.Id,
            adSoyad: row.AdSoyad,
            telefon: row.Telefon,
            calismaSaatleri: row.CalismaSaatleri,
            izinGunu: row.IzinGunu
        };

        res.json({
            message: "Personel güncellendi",
            data: guncellenenPersonel
        });
    } catch (err) {
        console.error("Personel güncellenirken hata:", err);
        res.status(500).json({ message: "Sunucu hatası (güncelleme)" });
    }
});

// Personel silme
router.delete("/personel/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Geçersiz id" });
    }

    try {
        // Personel var mı kontrol
        const checkResult = await sql.query`
            SELECT Id, AdSoyad, Telefon, CalismaSaatleri, IzinGunu
            FROM Personel
            WHERE Id = ${id}
        `;

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ message: "Personel bulunamadı" });
        }

        const row = checkResult.recordset[0];

        // Silme işlemi
        await sql.query`
            DELETE FROM Personel WHERE Id = ${id}
        `;

        const silinen = {
            id: row.Id,
            adSoyad: row.AdSoyad,
            telefon: row.Telefon,
            calismaSaatleri: row.CalismaSaatleri,
            izinGunu: row.IzinGunu
        };

        return res.json({
            message: "Personel silindi",
            data: silinen
        });
    } catch (err) {
        console.error("Personel silinirken hata:", err);
        res.status(500).json({ message: "Sunucu hatası (silme)" });
    }
});

// Tek bir personel detayı getirme
router.get("/personel/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Geçersiz id" });
    }

    try {
        const result = await sql.query`
            SELECT Id, AdSoyad, Telefon, CalismaSaatleri, IzinGunu
            FROM Personel
            WHERE Id = ${id}
        `;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Personel bulunamadı" });
        }

        const row = result.recordset[0];

        const personel = {
            id: row.Id,
            adSoyad: row.AdSoyad,
            telefon: row.Telefon,
            calismaSaatleri: row.CalismaSaatleri,
            izinGunu: row.IzinGunu
        };

        res.json(personel);
    } catch (err) {
        console.error("Personel detayı getirilirken hata:", err);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

module.exports = router;