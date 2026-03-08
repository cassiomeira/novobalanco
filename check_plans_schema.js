require('dotenv').config();
const { query, testConnection } = require('./db');

async function checkColumns() {
    try {
        await testConnection();
        console.log('--- Columns of PLANOS_PAGAMENTOS ---');
        // RDB$RELATION_FIELDS is reliable
        const sql = `
            SELECT RDB$FIELD_NAME 
            FROM RDB$RELATION_FIELDS 
            WHERE RDB$RELATION_NAME = 'PLANOS_PAGAMENTOS'
            ORDER BY RDB$FIELD_POSITION
        `;
        const cols = await query(sql);
        console.log(cols.map(c => c.RDB$FIELD_NAME.trim()));

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

checkColumns();
