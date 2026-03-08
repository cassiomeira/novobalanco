require('dotenv').config();
const { query, testConnection } = require('./db');

async function getInformaticaProducts() {
    try {
        await testConnection();
        const sql = `
            SELECT FIRST 5 
                EAN, 
                DESCRICAO 
            FROM PRODUTOS 
            WHERE TRIM(GRUPO) = '000012' 
              AND EAN IS NOT NULL 
              AND TRIM(EAN) <> ''
        `;
        const rows = await query(sql);
        console.table(rows);
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

getInformaticaProducts();
