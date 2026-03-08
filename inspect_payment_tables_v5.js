require('dotenv').config();
const { query, testConnection } = require('./db');

async function inspect() {
    try {
        await testConnection();
        console.log('--- FORMAS_PAGAMENTO (First 5) ---');
        const formas = await query('SELECT FIRST 5 * FROM FORMAS_PAGAMENTO');
        console.log(JSON.stringify(formas, null, 2));

        console.log('\n--- CONDICOES_PAGAMENTO (Structure) ---');
        // Check if table exists first or just try to select
        try {
            const condicoes = await query('SELECT FIRST 5 * FROM CONDICOES_PAGAMENTO');
            console.log(JSON.stringify(condicoes, null, 2));
        } catch (e) {
            console.log('CONDICOES_PAGAMENTO error:', e.message);
        }

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

inspect();
