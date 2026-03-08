require('dotenv').config();
const { query, testConnection } = require('./db');

async function dumpPlans() {
    try {
        await testConnection();
        console.log('--- Dumping Valid Plans ---');

        const plans = await query("SELECT DESCRICAO, FORMA_PAGAMENTO, PAGAMENTOS, INDICE FROM PLANOS_PAGAMENTOS");

        // Filter out nulls and print
        const validPlans = plans.filter(p => p.FORMA_PAGAMENTO !== null);

        console.log(`Total Valid Plans: ${validPlans.length}`);

        validPlans.forEach(p => {
            let pId = p.FORMA_PAGAMENTO;
            if (Buffer.isBuffer(pId)) pId = pId.toString();
            pId = pId.trim();

            // Print interesting plans (more than 1 installment)
            if (p.PAGAMENTOS > 1) {
                console.log(`Plan: ${p.DESCRICAO ? p.DESCRICAO.trim() : 'Unamed'} | MethodID: '${pId}' | Installments: ${p.PAGAMENTOS} | Rate: ${p.INDICE}%`);
            }
        });

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

dumpPlans();
