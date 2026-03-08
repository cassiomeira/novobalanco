require('dotenv').config();
const { query, testConnection } = require('./db');

async function simulate(methodId, totalValue) {
    try {
        await testConnection();
        // Trim methodId to match CHAR(24) padding effectively
        console.log(`\nSimulating for Method: '${methodId}', Total: ${totalValue}`);

        // Get Payment Method Info
        const methodSql = `SELECT DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE TRIM(FORMA_DE_PAGAMENTO) = ?`;
        const methodRes = await query(methodSql, [methodId]);

        if (methodRes.length === 0) {
            console.log("Payment method not found");
            return;
        }

        const method = methodRes[0];
        console.log(`Method: ${method.DESCRICAO.trim()}`);

        // Get Installment Plans
        // Note: FORMA_PAGAMENTO in PLANOS_PAGAMENTOS might be padded. Using TRIM or LIKE.
        const plansSql = `
            SELECT DESCRICAO, NUMERO_PARCELAS, INDICE, ENTRADA, INTERVALO
            FROM PLANOS_PAGAMENTOS 
            WHERE TRIM(FORMA_PAGAMENTO) = ?
            ORDER BY NUMERO_PARCELAS
        `;
        const plans = await query(plansSql, [methodId]);

        if (plans.length === 0) {
            console.log("No specific installment plans found. Single payment.");
        } else {
            console.log(`Found ${plans.length} plans.`);
            plans.forEach(p => {
                const rate = p.INDICE || 0;
                const installments = p.NUMERO_PARCELAS || 1;

                // Logic: Total * (1 + Rate/100)
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
    await simulate('000003', 100.00); // Carteira
    await simulate('000016', 100.00); // Cartao Debito Master
    process.exit();
}

run();
