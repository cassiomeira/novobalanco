require('dotenv').config();
const { query } = require('./db');

async function inspectPlans() {
    try {
        console.log('--- PLANOS_PAGAMENTOS Structure ---');
        const cols = await query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PLANOS_PAGAMENTOS'");
        console.log(cols.map(c => c.RDB$FIELD_NAME.trim()));

        console.log('\n--- PLANOS_PAGAMENTOS (First 5) ---');
        const plans = await query('SELECT FIRST 5 * FROM PLANOS_PAGAMENTOS');
        console.log(JSON.stringify(plans, null, 2));

        console.log('\n--- PARCELAMENTOS_AVANCADO (First 5) ---');
        const adv = await query('SELECT FIRST 5 * FROM PARCELAMENTOS_AVANCADO');
        console.log(JSON.stringify(adv, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

inspectPlans();
