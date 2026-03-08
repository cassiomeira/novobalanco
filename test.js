const { query, testConnection } = require('./db');

async function test() {
    try {
        await testConnection();
        console.log('✅ Conexão OK!\n');

        // Test 1: Buscar por descrição
        console.log('=== TESTE 1: Buscar por "CAMISA" ===');
        const r1 = await query(`
      SELECT FIRST 3 P.PRODUTO, P.DESCRICAO, P.EAN, P.VENDA, P.SALDO, P.UNIDADE
      FROM PRODUTOS P
      WHERE UPPER(P.DESCRICAO) LIKE '%CAMISA%'
        AND (P.BLOQUEADO IS NULL OR P.BLOQUEADO <> 'True')
      ORDER BY P.DESCRICAO
    `);
        r1.forEach(p => {
            console.log(`  [${String(p.PRODUTO).trim()}] ${p.DESCRICAO.trim()} - R$ ${p.VENDA} - Estoque: ${p.SALDO} - EAN: ${p.EAN || 'N/A'}`);
        });

        // Test 2: Buscar por EAN
        console.log('\n=== TESTE 2: Buscar por EAN (7898511128916) ===');
        const r2 = await query(`
      SELECT P.PRODUTO, P.DESCRICAO, P.EAN, P.EAN1, P.EAN2, P.VENDA, P.SALDO
      FROM PRODUTOS P
      WHERE P.EAN = '7898511128916' OR P.EAN1 = '7898511128916' OR P.EAN2 = '7898511128916'
    `);
        if (r2.length > 0) {
            const p = r2[0];
            console.log(`  Encontrado: ${p.DESCRICAO.trim()}`);
            console.log(`  Preço: R$ ${p.VENDA}`);
            console.log(`  Estoque: ${p.SALDO}`);
        } else {
            console.log('  Não encontrado');
        }

        // Test 3: Contar total de produtos
        console.log('\n=== TESTE 3: Total de produtos ===');
        const r3 = await query('SELECT COUNT(*) as TOTAL FROM PRODUTOS');
        console.log(`  Total: ${r3[0].TOTAL} produtos no banco`);

        // Test 4: Contar produtos ativos
        const r4 = await query(`SELECT COUNT(*) as TOTAL FROM PRODUTOS WHERE (BLOQUEADO IS NULL OR BLOQUEADO <> 'True') AND (FORA_LINHA IS NULL OR FORA_LINHA <> 'True')`);
        console.log(`  Ativos: ${r4[0].TOTAL} produtos`);

        process.exit(0);
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    }
}

test();
