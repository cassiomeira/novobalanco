const { query, testConnection } = require('./db');

async function findGoodExample() {
    try {
        await testConnection();

        // Buscar produtos com grade que têm EAN com 13 digitos (padrão)
        const rows = await query(`
      SELECT FIRST 5
        EG.EMPRESA, EG.PRODUTO, EG.GRADE, EG.ITEM_GRADE, EG.SALDO, EG.EAN,
        P.DESCRICAO,
        G.DESCRICAO as GRADE_DESC,
        IG.DESCRICAO as ITEM_DESC
      FROM ESTOQUE_GRADE EG
      JOIN PRODUTOS P ON P.EMPRESA = EG.EMPRESA AND P.PRODUTO = EG.PRODUTO
      JOIN GRADES G ON G.GRADE = EG.GRADE
      JOIN ITENS_GRADE IG ON IG.GRADE = EG.GRADE AND IG.ITEM_GRADE = EG.ITEM_GRADE
      WHERE CHAR_LENGTH(EG.EAN) = 13
      ORDER BY P.DESCRICAO
    `);

        if (rows.length > 0) {
            console.log('=== EXEMPLOS PARA TESTE ===');
            rows.forEach(r => {
                console.log(`\nProduto: ${r.DESCRICAO.trim()}`);
                console.log(`Variação: ${r.ITEM_DESC.trim()}`);
                console.log(`EAN: ${r.EAN.trim()}`);
            });
        } else {
            console.log('Nenhum EAN 13 encontrado na grade, tentando qualquer um...');
            const rowsAny = await query(`
        SELECT FIRST 3
          EG.EAN, P.DESCRICAO, IG.DESCRICAO as ITEM_DESC
        FROM ESTOQUE_GRADE EG
        JOIN PRODUTOS P ON P.EMPRESA = EG.EMPRESA AND P.PRODUTO = EG.PRODUTO
        JOIN ITENS_GRADE IG ON IG.GRADE = EG.GRADE AND IG.ITEM_GRADE = EG.ITEM_GRADE
        WHERE EG.EAN IS NOT NULL AND CHAR_LENGTH(EG.EAN) > 6
      `);
            rowsAny.forEach(r => {
                console.log(`\nProduto: ${r.DESCRICAO.trim()}`);
                console.log(`Variação: ${r.ITEM_DESC.trim()}`);
                console.log(`EAN: ${r.EAN.trim()}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    }
}

findGoodExample();
