require('dotenv').config();
const { query, testConnection } = require('./db');

async function inspectDeep() {
    try {
        await testConnection();

        console.log('--- FORMAS_PAGAMENTO Columns ---');
        const cols = await query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'FORMAS_PAGAMENTO'");
        console.log(cols.map(c => c.RDB$FIELD_NAME.trim()));

        console.log('\n--- ALL PLANOS_PAGAMENTOS ---');
        // Fetch all to see if we can find the "Credit Card" plans
        const plans = await query("SELECT DESCRICAO, FORMA_PAGAMENTO, PAGAMENTOS, INDICE FROM PLANOS_PAGAMENTOS");
        plans.forEach(p => {
            console.log(`Plan: ${p.DESCRICAO.trim()} | MethodID: '${p.FORMA_PAGAMENTO.toString().trim()}' | Count: ${p.PAGAMENTOS} | Indice: ${p.INDICE}%`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

inspectDeep();
