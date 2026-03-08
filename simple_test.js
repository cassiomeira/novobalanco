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

Firebird.attach(options, function (err, db) {
    if (err) { console.error(err); return; }

    // Simplest possible query to check table access
    db.query('SELECT FIRST 1 * FROM PLANOS_PAGAMENTOS', function (err, result) {
        db.detach();
        if (err) {
            console.error("Query Error:", err);
        } else {
            console.log("Success! Row:", result);
        }
    });
});
