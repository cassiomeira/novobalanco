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

    const query1 = 'SELECT FIRST 10 * FROM FORMAS_PAGAMENTO';

    // Using string concat for safety on multiline string issues
    const query2 = "SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND (RDB$RELATION_NAME LIKE '%JUROS%' OR RDB$RELATION_NAME LIKE '%PRECO%' OR RDB$RELATION_NAME LIKE '%TABELA%')";

    db.query(query1, function (err, rows) {
        if (err) {
            console.error(err);
        } else {
            console.log('\n--- FORMAS_PAGAMENTO Data (JSON) ---');
            console.log(JSON.stringify(rows, null, 2));
        }

        db.query(query2, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                console.log('\n--- Related Tables Found ---');
                console.log(result);
            }
            try { db.detach(); } catch (e) { }
        });
    });
});
