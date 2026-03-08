const Firebird = require('node-firebird');
require('dotenv').config();

const dbOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3050,
  database: process.env.DB_PATH,
  user: process.env.DB_USER || 'SYSDBA',
  password: process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
  retryConnectionInterval: 1000,
  charset: process.env.DB_CHARSET || 'WIN1252',
};

// Pool de conexões para melhor performance
const pool = Firebird.pool(5, dbOptions);

/**
 * Executa uma query SQL no banco Firebird
 * @param {string} sql - Query SQL
 * @param {Array} params - Parâmetros da query
 * @returns {Promise<Array>} Resultados da query
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) {
        console.error('Erro ao conectar ao banco:', err);
        return reject(err);
      }

      db.query(sql, params, (err, result) => {
        db.detach();

        if (err) {
          console.error('Erro na query:', err);
          return reject(err);
        }

        resolve(result || []);
      });
    });
  });
}

/**
 * Testa a conexão com o banco de dados
 * @returns {Promise<boolean>}
 */
function testConnection() {
  return new Promise((resolve, reject) => {
    Firebird.attach(dbOptions, (err, db) => {
      if (err) {
        console.error('Erro ao conectar:', err);
        return reject(err);
      }

      db.query('SELECT 1 FROM RDB$DATABASE', [], (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolve(true);
      });
    });
  });
}

/**
 * Lista todas as tabelas do banco de dados
 * @returns {Promise<Array>}
 */
function listTables() {
  const sql = `
    SELECT RDB$RELATION_NAME as TABLE_NAME 
    FROM RDB$RELATIONS 
    WHERE RDB$SYSTEM_FLAG = 0 
      AND RDB$VIEW_BLR IS NULL
    ORDER BY RDB$RELATION_NAME
  `;
  return query(sql);
}

/**
 * Lista as colunas de uma tabela
 * @param {string} tableName
 * @returns {Promise<Array>}
 */
function listColumns(tableName) {
  const sql = `
    SELECT RF.RDB$FIELD_NAME as COLUMN_NAME,
           T.RDB$TYPE_NAME as DATA_TYPE
    FROM RDB$RELATION_FIELDS RF
    JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
    JOIN RDB$TYPES T ON F.RDB$FIELD_TYPE = T.RDB$TYPE AND T.RDB$FIELD_NAME = 'RDB$FIELD_TYPE'
    WHERE RF.RDB$RELATION_NAME = ?
    ORDER BY RF.RDB$FIELD_POSITION
  `;
  return query(sql, [tableName]);
}

module.exports = { query, testConnection, listTables, listColumns, dbOptions };
