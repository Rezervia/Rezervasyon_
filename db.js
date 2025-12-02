// Veri tabanı bağlantı
const sql = require("mssql");

const dbConfig = {
  user: "sa",
  password: "123456",
  server: "localhost",
  port: 1433,
  database: "Rezervasyon2",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function connectDb() {
  try {
    await sql.connect(dbConfig);
    console.log("SQL server bağlantı başarılı! (ortak)");
  } catch (err) {
    console.error("SQL server bağlantı hatası:", err);
    throw err;
  }
}

module.exports = { sql, connectDb };
