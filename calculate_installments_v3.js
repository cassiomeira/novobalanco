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
    pageSize: 4096,
    retryConnectionInterval: 1000
};

console.log("Connecting to:", options.database);

Firebird.attach(options, function (err, db) {
    if (err) {
        console.error("Connection Error:", err);
        return;
    }

    console.log("Connected!");

    // Helper to query
    const runQuery = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.query(query, params, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    (async () => {
        try {
            // 1. Fetch form of payment ID for a known type
            console.log("Fetching payment method ID...");
            // Using UPPER just in case, but LIKE is safer
            const rows = await runQuery("SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE DESCRICAO LIKE '%CARTEIRA%'");

            if (rows.length > 0) {
                const method = rows[0];
                const methodId = method.FORMA_DE_PAGAMENTO.toString(); // Ensure buffer/string handling
                console.log(`Found: ${method.DESCRICAO} (ID: ${methodId.length} chars)`);
                console.log(`ID Buffer:`, method.FORMA_DE_PAGAMENTO);

                // 2. Fetch plans using this ID - try exact buffer match or trimmed string
                // FORMA_PAGAMENTO in PLANOS_PAGAMENTOS is likely CHAR(X)
                console.log("Fetching plans...");

                // We will fetch ALL plans and filter in JS to avoid binding issues
                const allPlans = await runQuery("SELECT FORMA_PAGAMENTO, DESCRICAO, NUMERO_PARCELAS, INDICE FROM PLANOS_PAGAMENTOS");

                console.log(`Total Plans found: ${allPlans.length}`);

                const matches = allPlans.filter(p => {
                    // Compare buffers or trimmed strings
                    const pId = p.FORMA_PAGAMENTO.toString().trim();
                    const mId = methodId.toString().trim();
                    return pId === mId;
                });

                if (matches.length > 0) {
                    console.log(`Found ${matches.length} matching plans for ${method.DESCRICAO}`);
                    matches.forEach(p => console.log(`- ${p.DESCRICAO.trim()} (${p.NUMERO_PARCELAS}x) Indice: ${p.INDICE}`));
                } else {
                    console.log("No partial matches found via JS filtering.");
                }
            } else {
                console.log("Carteira not found.");
            }

        } catch (e) {
            console.error("Query Error:", e);
        } finally {
            db.detach();
        }
    })();
});
