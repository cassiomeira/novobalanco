require('dotenv').config();
const { query, testConnection } = require('./db');

async function simulate(methodId, totalValue) {
    try {
        await testConnection();
        console.log(`\nSimulating for Method: '${methodId}', Total: ${totalValue}`);

        // Direct interpolation for testing to avoid binding issues
        const methodSql = `SELECT DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE FORMA_DE_PAGAMENTO = '${methodId}'`;
        const methodRes = await query(methodSql);

        if (methodRes.length === 0) {
            console.log("Payment method not found");
            return;
        }

        const method = methodRes[0];
        console.log(`Method: ${method.DESCRICAO.trim()}`);
        console.log(`Discount (Deságio): ${method.PERC_DESAGIO}%`);
        console.log(`Advance (Antecipação): ${method.PERC_ANTECIPACAO}%`);

        const plansSql = `
            SELECT DESCRICAO, NUMERO_PARCELAS, INDICE, ENTRADA, INTERVALO
            FROM PLANOS_PAGAMENTOS 
            WHERE FORMA_PAGAMENTO = '${methodId}' 
            ORDER BY NUMERO_PARCELAS
        `;
        const plans = await query(plansSql);

        if (plans.length === 0) {
            console.log("No specific installment plans found. Single payment.");

            // Calculate final price based on Discount/Advance
            let final = totalValue;
            let msg = '';

            if (method.PERC_DESAGIO > 0) {
                final = totalValue * (1 - method.PERC_DESAGIO / 100);
                msg = `(Global Discount: ${method.PERC_DESAGIO}%)`;
            } else if (method.PERC_ANTECIPACAO > 0) {
                final = totalValue * (1 + method.PERC_ANTECIPACAO / 100);
                msg = `(Global Addition: ${method.PERC_ANTECIPACAO}%)`;
            }
            console.log(`Final Price: R$ ${final.toFixed(2)} ${msg}`);

        } else {
            console.log(`Found ${plans.length} plans.`);
            plans.forEach(p => {
                const rate = p.INDICE || 0;
                const installments = p.NUMERO_PARCELAS || 1;

                // Logic check: Is INDICE a monthly rate or total addition?
                // Usually it's total addition percentage for that plan.
                // Assuming: Total * (1 + Indice/100)

                const totalWithRate = totalValue * (1 + (rate / 100));
                const installmentValue = totalWithRate / installments;

                console.log(`${p.DESCRICAO ? p.DESCRICAO.trim() : 'Plano'} (${installments}x): R$ ${installmentValue.toFixed(2)} - Total: R$ ${totalWithRate.toFixed(2)} (Rate: ${rate}%)`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

async function run() {
    // Note: IDs in database have padding. '000003' is likely '000003                  '
    // I need to use the exact padded string or a LIKE query.
    // Let's try to query the ID from the DB first to get the exact string.

    try {
        const rows = await query("SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'");
        if (rows.length > 0) {
            await simulate(rows[0].FORMA_DE_PAGAMENTO, 100);
        }

        const rows2 = await query("SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%MASTER%'");
        if (rows2.length > 0) {
            await simulate(rows2[0].FORMA_DE_PAGAMENTO, 100);
        }

    } catch (e) { console.error(e); }

    process.exit();
}

run();
