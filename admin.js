// admin giriş kontrol 
const express = require("express");
const router = express.Router();
const sql = require("mssql");

// POST /login 
router.post("/login", async (req, res) => {
  const { kullaniciAdi, sifre } = req.body;

  // Boş alan kontrolü
  if (!kullaniciAdi || !sifre) {
    return res
      .status(400)
      .json({ message: "Kullanıcı adı ve şifre zorunludur." });
  }

  try {
    // Admins tablosundan kullanıcıyı çek
    const result = await sql.query`
      SELECT TOP 1 Id, kullaniciAdi, sifre
      FROM Admins
      WHERE kullaniciAdi = ${kullaniciAdi} AND sifre = ${sifre}
    `;

    // Kayıt yoksa
    if (result.recordset.length === 0) {
      return res
        .status(401)
        .json({ message: "Kullanıcı adı veya şifre hatalı." });
    }

    const admin = result.recordset[0];

    return res.status(200).json({
      message: "Giriş başarılı!",
      admin: {
        id: admin.Id,
        kullaniciAdi: admin.kullaniciAdi,
      },
    });
  } catch (err) {
    console.error("Admin girişi sırasında hata:", err);
    return res
      .status(500)
      .json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." });
  }
});

module.exports = router;
