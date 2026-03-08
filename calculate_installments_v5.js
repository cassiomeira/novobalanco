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

async function getPlansForMethod(methodId) {
    return new Promise((resolve, reject) => {
        Firebird.attach(options, function (err, db) {
            if (err) return reject(err);

            // Fetch ALL plans to avoid driver binding issues
            db.query('SELECT DESCRICAO, FORMA_PAGAMENTO, NUMERO_PARCELAS, INDICE, ENTRADA FROM PLANOS_PAGAMENTOS', function (err, result) {
                db.detach();
                if (err) return reject(err);

                // Filter in JS
                const plans = result.filter(p => {
                    let pId = p.FORMA_PAGAMENTO;
                    if (Buffer.isBuffer(pId)) pId = pId.toString();
                    return pId.trim() == methodId.trim();
                });

                resolve(plans);
            });
        });
    });
}

(async () => {
    try {
        const methodId = '000003'; // Carteira (from previous test)
        console.log(`Fetching plans for ${methodId}...`);
        const plans = await getPlansForMethod(methodId);

        console.log(`Found ${plans.length} plans.`);
        plans.sort((a, b) => a.NUMERO_PARCELAS - b.NUMERO_PARCELAS);

        plans.forEach(p => {
            console.log(`- ${p.DESCRICAO.trim()} (${p.NUMERO_PARCELAS}x) Rate: ${p.INDICE}%`);
        });

    } catch (e) {
        console.error(e);
    }
})();
