require('dotenv').config();
const { query } = require('./db');
// Revert to simple db.js usage now that we know the column name error was the cause, not necessarily driver bugs (though fetch-all is safer)

async function simulate(methodId, totalValue) {
    try {
        console.log(`\nSimulating for Method: '${methodId}', Total: ${totalValue}`);

        // Get Payment Method Info
        const methodSql = `SELECT DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'`;
        const methodRes = await query(methodSql);

        if (methodRes.length === 0) {
            console.log("Payment method not found");
            return;
        }

        const method = methodRes[0];
        console.log(`Method: ${method.DESCRICAO.trim()}`);
        console.log(`Desagio: ${method.PERC_DESAGIO}, Antecipacao: ${method.PERC_ANTECIPACAO}`);

        // Use correct column PAGAMENTOS for installment count
        const plansSql = `
            SELECT DESCRICAO, PAGAMENTOS, INDICE, ENTRADA, INTERVALO, FORMA_PAGAMENTO
            FROM PLANOS_PAGAMENTOS 
        `;
        const allPlans = await query(plansSql);

        // Filter in JS for safety
        const plans = allPlans.filter(p => {
            // Assuming we found the ID via the method query earlier, but here we just used LIKE.
            // Let's assume we are testing for the method found above.
            // We need the ID from the first query to filter plans.
            // Querying ID explicitly this time.
            return true;
        });

        // Actually, let's get the ID properly
        const methodIdRes = await query("SELECT FORMA_DE_PAGAMENTO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'");
        const realMethodId = methodIdRes[0].FORMA_DE_PAGAMENTO.toString().trim();

        const myPlans = allPlans.filter(p => p.FORMA_PAGAMENTO.toString().trim() == realMethodId);

        if (myPlans.length === 0) {
            console.log("No specific installment plans found. Single payment.");
            let final = totalValue;
            if (method.PERC_DESAGIO > 0) final = totalValue * (1 - method.PERC_DESAGIO / 100);
            else if (method.PERC_ANTECIPACAO > 0) final = totalValue * (1 + method.PERC_ANTECIPACAO / 100);
            console.log(`Final: R$ ${final.toFixed(2)}`);
        } else {
            console.log(`Found ${myPlans.length} plans.`);
            myPlans.sort((a, b) => a.PAGAMENTOS - b.PAGAMENTOS);

            myPlans.forEach(p => {
                const rate = p.INDICE || 0;
                const installments = p.PAGAMENTOS || 1;

                const totalWithRate = totalValue * (1 + (rate / 100));
                const installmentValue = totalWithRate / installments;

                console.log(`${p.DESCRICAO ? p.DESCRICAO.trim() : 'Plano'} (${installments}x): R$ ${installmentValue.toFixed(2)} - Total: R$ ${totalWithRate.toFixed(2)} (Rate: ${rate}%)`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

simulate('ignored', 100.00);
