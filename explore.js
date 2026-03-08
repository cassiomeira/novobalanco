const { testConnection, listTables, listColumns, query } = require('./db');

async function explore() {
    try {
        console.log('Testando conexão...');
        await testConnection();
        console.log('✅ Conectado!\n');

        console.log('=== TABELAS DO BANCO ===');
        const tables = await listTables();
        const tableNames = tables.map(t => t.TABLE_NAME.trim());
        console.log(`Total: ${tableNames.length} tabelas\n`);
        tableNames.forEach(t => console.log(`  - ${t}`));

        // Procurar tabelas de produtos
        const prodTables = tableNames.filter(t =>
            t.includes('PROD') || t.includes('ITEM') || t.includes('MERCAD') || t.includes('ESTOQUE')
        );

        console.log('\n=== TABELAS RELACIONADAS A PRODUTOS ===');
        for (const table of prodTables) {
            console.log(`\n--- ${table} ---`);
            const cols = await listColumns(table);
            cols.forEach(c => console.log(`  ${c.COLUMN_NAME.trim()} (${c.DATA_TYPE.trim()})`));
        }

        // Tentar pegar uma amostra de dados da tabela mais provável
        for (const table of prodTables) {
            try {
                console.log(`\n=== AMOSTRA: ${table} (5 registros) ===`);
                const rows = await query(`SELECT FIRST 5 * FROM ${table}`);
                if (rows.length > 0) {
                    console.log('Colunas:', Object.keys(rows[0]).join(', '));
                    rows.forEach((row, i) => {
                        console.log(`\nRegistro ${i + 1}:`);
                        Object.entries(row).forEach(([key, val]) => {
                            if (val !== null && val !== undefined) {
                                let display = String(val).trim();
                                if (display.length > 80) display = display.substring(0, 80) + '...';
                                console.log(`  ${key.trim()}: ${display}`);
                            }
                        });
                    });
                }
            } catch (e) {
                console.log(`  Erro ao ler ${table}: ${e.message}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Erro:', err.message);
        process.exit(1);
    }
}

explore();
