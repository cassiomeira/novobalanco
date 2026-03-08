require('dotenv').config();
const { query, testConnection } = require('./db');

async function findTables() {
    try {
        await testConnection();
        const sql = `
            SELECT RDB$RELATION_NAME 
            FROM RDB$RELATIONS 
            WHERE RDB$SYSTEM_FLAG = 0 
            AND (
                RDB$RELATION_NAME LIKE '%PARCELA%' 
                OR RDB$RELATION_NAME LIKE '%PLANO%'
                OR RDB$RELATION_NAME LIKE '%VENCIMENTO%'
                OR RDB$RELATION_NAME LIKE '%PRAZO%'
            )
        `;
        const tables = await query(sql);
        console.log('Tables found:', tables.map(t => t.RDB$RELATION_NAME.trim()));
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

findTables();
