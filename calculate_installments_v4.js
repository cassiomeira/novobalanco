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

function execute(sql, params = []) {
    return new Promise((resolve, reject) => {
        Firebird.attach(options, function (err, db) {
            if (err) return reject(err);

            db.query(sql, params, function (err, result) {
                db.detach(); // Detach immediately after query
                if (err) return reject(err);
                resolve(result);
            });
        });
    });
}

async function run() {
    try {
        console.log("1. Fetching Payment Method...");
        // Fetch method first
        const methods = await execute("SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'");

        if (methods.length === 0) {
            console.log("No method found.");
            return;
        }

        const method = methods[0];
        console.log(`Method Found: ${method.DESCRICAO.trim()}`);
        console.log(`Desagio: ${method.PERC_DESAGIO}, Antecipacao: ${method.PERC_ANTECIPACAO}`);

        // Convert Buffer to String if needed, or use as is if driver handles it
        // Firebird CHAR/VARCHAR usually comes as string, but check just in case.
        let methodId = method.FORMA_DE_PAGAMENTO;
        if (Buffer.isBuffer(methodId)) {
            methodId = methodId.toString();
        }

        console.log("2. Fetching Plans for Method ID:", methodId);

        // New connection for second query
        // Note: We need to match the ID. 
        // If exact match fails, we might need to TRIM in SQL.
        const plans = await execute("SELECT DESCRICAO, NUMERO_PARCELAS, INDICE FROM PLANOS_PAGAMENTOS");

        console.log(`Fetched ${plans.length} total plans. Filtering in JS...`);

        const myPlans = plans.filter(p => {
            let pId = p.FORMA_PAGAMENTO;
            if (Buffer.isBuffer(pId)) pId = pId.toString();
            return pId.trim() == methodId.trim();
        });

        if (myPlans.length > 0) {
            console.log(`Found ${myPlans.length} plans:`);
            myPlans.forEach(p => {
                console.log(` - ${p.DESCRICAO.trim()} (${p.NUMERO_PARCELAS}x): ${p.INDICE}%`);
            });
        } else {
            console.log("No plans matched.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
