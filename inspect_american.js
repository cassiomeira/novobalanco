require('dotenv').config();
const { query, testConnection } = require('./db');

async function inspectAmerican() {
    try {
        await testConnection();
        console.log('--- Searching for American Express ---');

        // 1. Find the method
        const methodSql = `SELECT FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO 
                           FROM FORMAS_PAGAMENTO 
                           WHERE DESCRICAO LIKE '%AMER%' OR DESCRICAO LIKE '%7/12%'`;
        const methods = await query(methodSql);

        if (methods.length === 0) {
            console.log("No payment method found matching 'AMER' or '7/12'");
            return;
        }

        for (const method of methods) {
            console.log(`\nMETHOD: ${method.DESCRICAO.trim()} (ID: ${method.FORMA_DE_PAGAMENTO})`);
            console.log(`- Deságio (Discount/Fee?): ${method.PERC_DESAGIO}%`);
            console.log(`- Antecipação: ${method.PERC_ANTECIPACAO}%`);

            let methodId = method.FORMA_DE_PAGAMENTO;
            if (Buffer.isBuffer(methodId)) methodId = methodId.toString();
            methodId = methodId.trim();

            // 2. Find plans for this method (fetch all and filter)
            // Using the safe 'fetch all' approach to be sure
            const allPlans = await query("SELECT DESCRICAO, FORMA_PAGAMENTO, PAGAMENTOS, INDICE FROM PLANOS_PAGAMENTOS");

            const matches = allPlans.filter(p => {
                let pId = p.FORMA_PAGAMENTO;
                if (!pId) return false;
                if (Buffer.isBuffer(pId)) pId = pId.toString();
                return pId.trim() === methodId;
            });

            if (matches.length > 0) {
                console.log(`- Found ${matches.length} plans:`);
                matches.sort((a, b) => (a.PAGAMENTOS || 0) - (b.PAGAMENTOS || 0));
                matches.forEach(p => {
                    const desc = p.DESCRICAO ? p.DESCRICAO.trim() : 'No Desc';
                    console.log(`  * ${desc} | Parcelas: ${p.PAGAMENTOS} | Indice: ${p.INDICE}%`);
                });
            } else {
                console.log(`- No specific plans found for this method.`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

inspectAmerican();
