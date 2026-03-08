const { query, testConnection } = require('./db');

async function findGradeWithEAN() {
    try {
        await testConnection();

        // Buscar produtos com grade que têm EAN
        console.log('=== PRODUTOS COM GRADE + EAN ===');
        const rows = await query(`
      SELECT FIRST 5
        EG.EMPRESA, EG.PRODUTO, EG.GRADE, EG.ITEM_GRADE, EG.SALDO, EG.EAN,
        P.DESCRICAO,
        G.DESCRICAO as GRADE_DESC,
        IG.DESCRICAO as ITEM_DESC, IG.ABREVIATURA
      FROM ESTOQUE_GRADE EG
      JOIN PRODUTOS P ON P.EMPRESA = EG.EMPRESA AND P.PRODUTO = EG.PRODUTO
      JOIN GRADES G ON G.GRADE = EG.GRADE
      JOIN ITENS_GRADE IG ON IG.GRADE = EG.GRADE AND IG.ITEM_GRADE = EG.ITEM_GRADE
      WHERE EG.EAN IS NOT NULL AND EG.EAN <> ''
      ORDER BY P.DESCRICAO, IG.DESCRICAO
    `);

        rows.forEach((r, i) => {
            console.log(`\n--- Produto ${i + 1} ---`);
            console.log(`  Produto: ${r.DESCRICAO.trim()}`);
            console.log(`  Grade: ${r.GRADE_DESC.trim()}`);
            console.log(`  Variação: ${r.ITEM_DESC.trim()} (${r.ABREVIATURA.trim()})`);
            console.log(`  EAN: ${r.EAN.trim()}`);
            console.log(`  Estoque: ${r.SALDO}`);
        });

        // Contar quantos EANs de grade existem
        const count = await query(`SELECT COUNT(*) as TOTAL FROM ESTOQUE_GRADE WHERE EAN IS NOT NULL AND EAN <> ''`);
        console.log(`\nTotal de variações com EAN: ${count[0].TOTAL}`);

        process.exit(0);
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    }
}

findGradeWithEAN();
