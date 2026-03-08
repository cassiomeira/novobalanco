const { query, testConnection } = require('./db');

async function exploreGrade() {
    try {
        await testConnection();
        console.log('✅ Conectado!\n');

        // Buscar tabelas com "GRADE" no nome
        const tables = await query(`
      SELECT RDB$RELATION_NAME as TABLE_NAME 
      FROM RDB$RELATIONS 
      WHERE RDB$SYSTEM_FLAG = 0 
        AND RDB$VIEW_BLR IS NULL
        AND (RDB$RELATION_NAME LIKE '%GRADE%' OR RDB$RELATION_NAME LIKE '%VARIACAO%' OR RDB$RELATION_NAME LIKE '%TAMANHO%' OR RDB$RELATION_NAME LIKE '%COR%' OR RDB$RELATION_NAME LIKE '%SUBPROD%')
      ORDER BY RDB$RELATION_NAME
    `);

        console.log('=== TABELAS RELACIONADAS A GRADE ===');
        const tableNames = tables.map(t => t.TABLE_NAME.trim());
        tableNames.forEach(t => console.log(`  - ${t}`));

        // Para cada tabela, mostrar colunas e amostra
        for (const table of tableNames) {
            console.log(`\n\n=== COLUNAS: ${table} ===`);
            const cols = await query(`
        SELECT RF.RDB$FIELD_NAME as COLUMN_NAME
        FROM RDB$RELATION_FIELDS RF
        WHERE RF.RDB$RELATION_NAME = '${table}'
        ORDER BY RF.RDB$FIELD_POSITION
      `);
            cols.forEach(c => console.log(`  ${c.COLUMN_NAME.trim()}`));

            try {
                console.log(`\n--- AMOSTRA: ${table} (3 registros) ---`);
                const rows = await query(`SELECT FIRST 3 * FROM ${table}`);
                if (rows.length > 0) {
                    rows.forEach((row, i) => {
                        console.log(`\nRegistro ${i + 1}:`);
                        Object.entries(row).forEach(([key, val]) => {
                            if (val !== null && val !== undefined && String(val).trim() !== '') {
                                let display = String(val).trim();
                                if (display.length > 80) display = display.substring(0, 80) + '...';
                                console.log(`  ${key.trim()}: ${display}`);
                            }
                        });
                    });
                } else {
                    console.log('  (tabela vazia)');
                }
            } catch (e) {
                console.log(`  Erro: ${e.message}`);
            }
        }

        // Procurar grade de um produto específico (ex: produto 000004 - Camisa Lunender)
        console.log('\n\n=== BUSCAR GRADE DO PRODUTO 000004 (CAMISA LUNENDER) ===');
        for (const table of tableNames) {
            try {
                // Tentar buscar por PRODUTO ou CODIGO_PRODUTO
                const cols = await query(`
          SELECT RF.RDB$FIELD_NAME as COLUMN_NAME
          FROM RDB$RELATION_FIELDS RF
          WHERE RF.RDB$RELATION_NAME = '${table}'
          ORDER BY RF.RDB$FIELD_POSITION
        `);
                const colNames = cols.map(c => c.COLUMN_NAME.trim());

                let prodCol = colNames.find(c => c === 'PRODUTO' || c === 'CODIGO_PRODUTO' || c === 'COD_PRODUTO');
                if (prodCol) {
                    const rows = await query(`SELECT FIRST 5 * FROM ${table} WHERE ${prodCol} = '000004'`);
                    if (rows.length > 0) {
                        console.log(`\n--- ${table} (produto 000004) ---`);
                        rows.forEach((row, i) => {
                            console.log(`\nRegistro ${i + 1}:`);
                            Object.entries(row).forEach(([key, val]) => {
                                if (val !== null && val !== undefined && String(val).trim() !== '') {
                                    console.log(`  ${key.trim()}: ${String(val).trim()}`);
                                }
                            });
                        });
                    }
                }
            } catch (e) {
                // skip
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    }
}

exploreGrade();
