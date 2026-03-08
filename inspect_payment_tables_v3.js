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

    // Using simple query based on RDB$RELATION_FIELDS
    tables.forEach(table => {
        const query = `
            SELECT RDB$FIELD_NAME 
            FROM RDB$RELATION_FIELDS 
            WHERE RDB$RELATION_NAME = '${table}'
            ORDER BY RDB$FIELD_POSITION
        `;

        db.query(query, function (err, result) {
            console.log(`\n--- ${table} ---`);
            if (err) {
                console.log(`Error:`, err.message);
            } else if (result.length === 0) {
                console.log("(Table not found or empty columns)");
            } else {
                result.forEach(r => console.log(r.RDB$FIELD_NAME.trim()));
            }
        });
    });

    setTimeout(() => {
        try {
            db.detach();
        } catch (e) { }
    }, 2000);
});
