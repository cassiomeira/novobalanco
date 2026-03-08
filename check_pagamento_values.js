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

    const query = 'SELECT FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO';

    db.query(query, function (err, rows) {
        if (err) {
            console.error(err);
        } else {
            console.log('\n--- FORMAS_PAGAMENTO Values ---');
            console.log(JSON.stringify(rows, null, 2));
        }
        try { db.detach(); } catch (e) { }
    });
});
