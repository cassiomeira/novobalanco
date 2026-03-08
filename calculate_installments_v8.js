require('dotenv').config();
const Firebird = require('node-firebird');

const options = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3050,
    database: process.env.DB_PATH,
    user: process.env.DB_USER || 'SYSDBA',
    password: process.env.DB_PASSWORD || 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

async function executeQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        Firebird.attach(options, function (err, db) {
            if (err) return reject(err);
            db.query(sql, params, function (err, result) {
                db.detach();
                if (err) return reject(err);
                resolve(result);
            });
        });
    });
}

(async () => {
    try {
        console.log("Getting Method ID for 'CARTEIRA'...");
        const methodSql = `SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'`;
        const methods = await executeQuery(methodSql);

        if (methods.length === 0) {
            console.log("Method not found.");
            return;
        }

        const method = methods[0];
        let methodId = method.FORMA_DE_PAGAMENTO;
        if (Buffer.isBuffer(methodId)) methodId = methodId.toString();
        methodId = methodId.trim();

        console.log(`Method: ${method.DESCRICAO.trim()} (ID: ${methodId})`);

        // Fetch plans with pagination to avoid driver crash
        let offset = 0;
        let limit = 50;
        let hasMore = true;
        let matchingPlans = [];

        while (hasMore) {
            const planSql = `SELECT FIRST ${limit} SKIP ${offset} DESCRICAO, FORMA_PAGAMENTO, PAGAMENTOS, INDICE FROM PLANOS_PAGAMENTOS`;
            // console.log(`Fetching plans with skip ${offset}...`);
            const rows = await executeQuery(planSql);

            if (rows.length === 0) {
                hasMore = false;
            } else {
                rows.forEach(p => {
                    let pId = p.FORMA_PAGAMENTO;
                    if (!pId) return;
                    if (Buffer.isBuffer(pId)) pId = pId.toString();
                    if (pId.trim() === methodId) {
                        matchingPlans.push(p);
                    }
                });
                offset += limit;
            }
        }

        console.log(`Found ${matchingPlans.length} matching plans.`);
        matchingPlans.sort((a, b) => (a.PAGAMENTOS || 0) - (b.PAGAMENTOS || 0));

        const totalValue = 100.00;

        matchingPlans.forEach(p => {
            const installments = p.PAGAMENTOS || 1;
            const rate = p.INDICE || 0;
            const totalWithRate = totalValue * (1 + (rate / 100));
            const installmentVal = totalWithRate / installments;

            const desc = p.DESCRICAO ? p.DESCRICAO.trim() : 'Plano sem nome';
            console.log(`${desc} (${installments}x): R$ ${installmentVal.toFixed(2)} - Total: R$ ${totalWithRate.toFixed(2)}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
})();
