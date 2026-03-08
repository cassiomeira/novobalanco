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

    // Search for tables related to Payment or Conditions
    const query = `
        SELECT RDB$RELATION_NAME 
        FROM RDB$RELATIONS 
        WHERE RDB$SYSTEM_FLAG = 0 
        AND (
            RDB$RELATION_NAME LIKE '%PAG%' 
            OR RDB$RELATION_NAME LIKE '%COND%'
            OR RDB$RELATION_NAME LIKE '%FORMA%'
        )
    `;

    db.query(query, function (err, result) {
        if (err) throw err;

        console.log('Tables found:', result);
        db.detach();
    });
});
