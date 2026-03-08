const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');

let db;

// Inicializa o banco SQLite
async function initSQLite() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    console.log('✅ SQLite conectado');

    // Cria as tabelas se não existirem
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            login TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS sessoes_balanco (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            grupo_id TEXT NOT NULL,
            data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_fim DATETIME,
            status TEXT DEFAULT 'ABERTA',
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS itens_balanco (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessao_id INTEGER NOT NULL,
            ean TEXT NOT NULL,
            descricao TEXT,
            quantidade INTEGER NOT NULL,
            FOREIGN KEY (sessao_id) REFERENCES sessoes_balanco(id)
        );
    `);

    // Adiciona coluna local_session_id se não existir
    try {
        await db.exec('ALTER TABLE sessoes_balanco ADD COLUMN local_session_id TEXT');
        console.log('✅ Coluna local_session_id adicionada');
    } catch (e) {
        // Ignora erro se a coluna ja existir
    }

    // Insere um usuário padrão (admin) se a tabela estiver vazia
    const userCount = await db.get('SELECT COUNT(*) as contagem FROM usuarios');
    if (userCount.contagem === 0) {
        // Hash simples com MD5 para exemplo. Num cenário real, usar bcrypt.
        const hashSenha = crypto.createHash('md5').update('123456').digest('hex');
        await db.run('INSERT INTO usuarios (nome, login, senha) VALUES (?, ?, ?)', ['Administrador', 'admin', hashSenha]);
        console.log('👤 Usuário padrão criado: admin / 123456');
    }
}

// Retorna a instância do banco
function getSQLiteDB() {
    if (!db) {
        throw new Error('SQLite não inicializado. Chame initSQLite primeiro.');
    }
    return db;
}

module.exports = {
    initSQLite,
    getSQLiteDB
};
