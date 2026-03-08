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

async function fetchPage(offset, limit) {
    return new Promise((resolve, reject) => {
        Firebird.attach(options, function (err, db) {
            if (err) return reject(err);

            const sql = `SELECT FIRST ${limit} SKIP ${offset} DESCRICAO, FORMA_PAGAMENTO, NUMERO_PARCELAS, INDICE FROM PLANOS_PAGAMENTOS`;
            db.query(sql, function (err, result) {
                db.detach();
                if (err) return reject(err);
                resolve(result);
            });
        });
    });
}

(async () => {
    try {
        let offset = 0;
        let limit = 10;
        let allPlans = [];
        let hasMore = true;

        while (hasMore) {
            console.log(`Fetching offset ${offset}...`);
            try {
                const rows = await fetchPage(offset, limit);
                if (rows.length === 0) {
                    hasMore = false;
                } else {
                    allPlans = allPlans.concat(rows);
                    offset += limit;
                }
            } catch (e) {
                console.error(`Error at offset ${offset}:`, e.message);
                hasMore = false; // Stop on error
            }
        }

        console.log(`Total plans fetched: ${allPlans.length}`);

        // Filter for 'Carteira' (000003)
        const methodId = '000003';
        const matches = allPlans.filter(p => {
            let pId = p.FORMA_PAGAMENTO;
            if (Buffer.isBuffer(pId)) pId = pId.toString();
            return pId.trim() == methodId.trim();
        });

        console.log(`Found ${matches.length} matching plans.`);
        matches.forEach(p => {
            console.log(`- ${p.DESCRICAO.trim()} (${p.NUMERO_PARCELAS}x): ${p.INDICE}%`);
        });

    } catch (e) {
        console.error(e);
    }
})();
