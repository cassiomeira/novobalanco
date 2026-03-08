const Firebird = require('node-firebird');
require('dotenv').config();

const options = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_PATH,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

Firebird.attach(options, function (err, db) {
    if (err) throw err;

    const tables = ['FORMAS_PAGAMENTO', 'CONDICOES_PAGAMENTO', 'TABELA_PAGAMENTO'];

    tables.forEach(table => {
        const query = `
            SELECT R.RDB$FIELD_NAME, T.RDB$TYPE_NAME
            FROM RDB$RELATION_FIELDS R
            LEFT JOIN RDB$FIELDS F ON R.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
            LEFT JOIN RDB$TYPES T ON F.RDB$FIELD_TYPE = T.RDB$TYPE
            WHERE R.RDB$RELATION_NAME = '${table}'
            ORDER BY R.RDB$FIELD_POSITION
        `;

        db.query(query, function (err, result) {
            if (err) {
                console.log(`Error reading ${table}:`, err.message);
            } else {
                console.log(`\n--- ${table} ---`);
                console.log(result.map(r => r.RDB$FIELD_NAME.trim()));
            }
        });
    });

    // Detach after a delay to allow queries to finish (simple hack)
    setTimeout(() => {
        db.detach();
    }, 2000);
});
