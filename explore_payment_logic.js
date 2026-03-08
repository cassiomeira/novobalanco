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

    // Using simple query
    const query2 = `SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND (RDB$RELATION_NAME LIKE '%PRAZO%' OR RDB$RELATION_NAME LIKE '%PLANO%' OR RDB$RELATION_NAME LIKE '%PARCELA%')`;

    db.query(query1, function (err, rows) {
        console.log('\n--- FORMAS_PAGAMENTO Data ---');
        console.log(rows);

        db.query(query2, function (err, result) {
            console.log('\n--- Related Tables Founds ---');
            console.log(result);

            try { db.detach(); } catch (e) { }
        });
    });
});
