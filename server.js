const express = require('express');
const cors = require('cors');
require('dotenv').config();
const crypto = require('crypto');

const { query, testConnection, listTables, listColumns } = require('./db');
const { initSQLite, getSQLiteDB } = require('./sqlite');

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== HEALTH CHECK ==========
app.get('/api/health', async (req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', message: 'Conectado ao banco Firebird' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ========== SCHEMA EXPLORATION ==========
app.get('/api/schema/tables', async (req, res) => {
    try {
        const tables = await listTables();
        const tableNames = tables.map(t => t.TABLE_NAME.trim());
        res.json({ count: tableNames.length, tables: tableNames });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/schema/columns/:table', async (req, res) => {
    try {
        const columns = await listColumns(req.params.table.toUpperCase());
        const cols = columns.map(c => ({
            name: c.COLUMN_NAME.trim(),
            type: c.DATA_TYPE.trim()
        }));
        res.json({ table: req.params.table.toUpperCase(), columns: cols });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== BUSCA DE PRODUTOS ==========

// Buscar por descrição (texto livre)
app.get('/api/produtos/busca', async (req, res) => {
    try {
        const { q, limit = 50 } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Informe pelo menos 2 caracteres para busca' });
        }

        const palavras = q.trim().toUpperCase().split(/\s+/);
        let conditions = palavras.map(() => `UPPER(P.DESCRICAO) LIKE ?`);
        let params = palavras.map(p => `%${p}%`);

        const sql = `
      SELECT FIRST ${parseInt(limit)}
        P.EMPRESA, P.PRODUTO, P.DESCRICAO, P.UNIDADE,
        P.EAN, P.EAN1, P.EAN2,
        P.VENDA, P.CUSTO, P.SALDO,
        P.VENDA2, P.VENDA3,
        P.MARCA, P.GRUPO, P.ESTOQUE_MINIMO,
        P.BLOQUEADO, P.FORA_LINHA
      FROM PRODUTOS P
      WHERE ${conditions.join(' AND ')}
        AND (P.BLOQUEADO IS NULL OR P.BLOQUEADO <> 'True')
        AND (P.FORA_LINHA IS NULL OR P.FORA_LINHA <> 'True')
      ORDER BY P.DESCRICAO
    `;

        const produtos = await query(sql, params);

        // Para cada produto, buscar grade (se existir)
        const result = [];
        for (const p of produtos) {
            const prod = formatProduto(p);
            prod.grade = await getGrade(p.EMPRESA, p.PRODUTO);
            result.push(prod);
        }

        res.json({ count: result.length, query: q, produtos: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

let gradeEanCache = null;

async function loadGradeEanCache() {
    if (gradeEanCache) return;
    try {
        console.log('Carregando cache de EANs da Grade para otimização...');
        const sql = `SELECT EMPRESA, PRODUTO, GRADE, ITEM_GRADE, EAN FROM ESTOQUE_GRADE WHERE EAN IS NOT NULL AND TRIM(EAN) <> ''`;
        const rows = await query(sql);
        gradeEanCache = new Map();
        rows.forEach(r => {
            if (r.EAN) {
                gradeEanCache.set(String(r.EAN).trim(), {
                    empresa: r.EMPRESA,
                    produto: r.PRODUTO,
                    grade: r.GRADE,
                    item_grade: r.ITEM_GRADE
                });
            }
        });
        console.log(`Cache carregado: ${gradeEanCache.size} variações.`);
    } catch (err) {
        console.error('Erro ao carregar cache de EANs:', err);
    }
}

// Carregar cache no inicio e a cada 30 min para atualizar novos cadastros
loadGradeEanCache();
setInterval(loadGradeEanCache, 30 * 60 * 1000);

// Buscar por código de barras (verifica EAN do produto + EAN da grade)
app.get('/api/produtos/barcode/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo.trim();

        // Primeiro: buscar no EAN do produto principal
        let sql = `
      SELECT P.EMPRESA, P.PRODUTO, P.DESCRICAO, P.UNIDADE,
        P.EAN, P.EAN1, P.EAN2,
        P.VENDA, P.CUSTO, P.SALDO,
        P.VENDA2, P.VENDA3,
        P.MARCA, P.GRUPO, P.ESTOQUE_MINIMO
      FROM PRODUTOS P
      WHERE P.EAN = ? OR P.EAN1 = ? OR P.EAN2 = ?
    `;
        let produtos = await query(sql, [codigo, codigo, codigo]);

        // Se não encontrou, buscar no cache in-memory do EAN da grade
        if (produtos.length === 0) {
            if (!gradeEanCache) await loadGradeEanCache();
            const gradeItem = gradeEanCache ? gradeEanCache.get(codigo) : null;

            if (!gradeItem) {
                return res.status(404).json({ error: 'Produto não encontrado', barcode: codigo });
            }

            // Encontrou no cache! Agora busca os dados rápido pela chave primária
            sql = `
        SELECT P.EMPRESA, P.PRODUTO, P.DESCRICAO, P.UNIDADE,
          P.EAN, P.EAN1, P.EAN2,
          P.VENDA, P.CUSTO, P.SALDO,
          P.VENDA2, P.VENDA3,
          P.MARCA, P.GRUPO, P.ESTOQUE_MINIMO,
          EG.GRADE as GRADE_COD, EG.ITEM_GRADE, EG.SALDO as GRADE_SALDO, EG.EAN as GRADE_EAN,
          G.DESCRICAO as GRADE_DESC,
          IG.DESCRICAO as VARIACAO, IG.ABREVIATURA as VARIACAO_ABREV
        FROM ESTOQUE_GRADE EG
        JOIN PRODUTOS P ON P.EMPRESA = EG.EMPRESA AND P.PRODUTO = EG.PRODUTO
        JOIN GRADES G ON G.GRADE = EG.GRADE
        JOIN ITENS_GRADE IG ON IG.GRADE = EG.GRADE AND IG.ITEM_GRADE = EG.ITEM_GRADE
        WHERE EG.EMPRESA = ? AND EG.PRODUTO = ? AND EG.GRADE = ? AND EG.ITEM_GRADE = ?
      `;
            const gradeResults = await query(sql, [gradeItem.empresa, gradeItem.produto, gradeItem.grade, gradeItem.item_grade]);

            if (gradeResults.length === 0) {
                return res.status(404).json({ error: 'Produto não encontrado', barcode: codigo });
            }

            // Encontrou pela grade
            const g = gradeResults[0];
            const prod = formatProduto(g);
            prod.variacao_encontrada = {
                grade: g.GRADE_DESC ? g.GRADE_DESC.trim() : null,
                variacao: g.VARIACAO ? g.VARIACAO.trim() : null,
                abreviatura: g.VARIACAO_ABREV ? g.VARIACAO_ABREV.trim() : null,
                ean: g.GRADE_EAN ? String(g.GRADE_EAN).trim() : null,
                estoque: g.GRADE_SALDO != null ? parseFloat(g.GRADE_SALDO) : null,
            };
            prod.grade = await getGrade(g.EMPRESA, g.PRODUTO);
            return res.json(prod);
        }

        const prod = formatProduto(produtos[0]);
        prod.grade = await getGrade(produtos[0].EMPRESA, produtos[0].PRODUTO);
        res.json(prod);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar por código interno
app.get('/api/produtos/:id', async (req, res) => {
    try {
        const sql = `
      SELECT P.EMPRESA, P.PRODUTO, P.DESCRICAO, P.UNIDADE,
        P.EAN, P.EAN1, P.EAN2,
        P.VENDA, P.CUSTO, P.SALDO,
        P.VENDA2, P.VENDA3,
        P.MARCA, P.GRUPO, P.ESTOQUE_MINIMO
      FROM PRODUTOS P
      WHERE P.PRODUTO = ?
    `;
        const produtos = await query(sql, [req.params.id]);
        if (produtos.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        const prod = formatProduto(produtos[0]);
        prod.grade = await getGrade(produtos[0].EMPRESA, produtos[0].PRODUTO);
        res.json(prod);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== CONFIGURAÇÕES / AUXILIARES ==========

// Listar formas de pagamento
app.get('/api/pagamentos', async (req, res) => {
    try {
        const sql = `
      SELECT FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO
      FROM FORMAS_PAGAMENTO
      WHERE BLOQUEADO <> 'S' OR BLOQUEADO IS NULL
      ORDER BY DESCRICAO
    `;
        const pagamentos = await query(sql);
        const result = pagamentos.map(p => ({
            id: p.FORMA_DE_PAGAMENTO.trim(),
            descricao: p.DESCRICAO.trim(),
            taxa: p.PERC_DESAGIO || 0
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Calcular parcelamento/preço final
app.post('/api/pagamentos/calculo', async (req, res) => {
    try {
        const { total, forma_pagamento_id } = req.body;

        if (!total || !forma_pagamento_id) {
            return res.status(400).json({ error: 'Total e forma de pagamento são obrigatórios' });
        }

        const totalValue = parseFloat(total);
        if (isNaN(totalValue)) {
            return res.status(400).json({ error: 'Total inválido' });
        }

        // 1. Buscar dados da forma de pagamento
        const methodSql = `SELECT FIRST 1 FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO WHERE FORMA_DE_PAGAMENTO = ?`;
        // OBS: Usando parametro direto. Se der erro de driver, teremos que usar a lógica de busca sem param ou interpolação segura.
        // Dado o histórico, vou arriscar o parâmetro simples primeiro pois funcionou para buscas simples.
        // Se falhar, faremos o "fetch all methods".
        let methods = await query(methodSql, [forma_pagamento_id]);

        // Fallback se não encontrar por ID com binding (pelo padding)
        if (methods.length === 0) {
            // Tentar buscar tudo e filtrar (mais seguro dado os problemas anteriores)
            const allMethods = await query("SELECT FORMA_DE_PAGAMENTO, DESCRICAO, PERC_DESAGIO, PERC_ANTECIPACAO FROM FORMAS_PAGAMENTO");
            const match = allMethods.find(m => {
                let mId = m.FORMA_DE_PAGAMENTO;
                if (Buffer.isBuffer(mId)) mId = mId.toString();
                return mId.trim() === forma_pagamento_id.trim();
            });
            if (match) methods = [match];
        }

        if (methods.length === 0) {
            return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
        }

        const method = methods[0];
        let methodId = method.FORMA_DE_PAGAMENTO;
        if (Buffer.isBuffer(methodId)) methodId = methodId.toString();
        const cleanMethodId = methodId.trim();

        // 2. Buscar planos de parcelamento (com paginação segura)
        let matchingPlans = [];
        let offset = 0;
        let limit = 50;
        let hasMore = true;

        // Limite de segurança para não loopar infinito se o driver bugar
        let safetyCounter = 0;

        while (hasMore && safetyCounter < 50) {
            safetyCounter++;
            const planSql = `SELECT FIRST ${limit} SKIP ${offset} DESCRICAO, FORMA_PAGAMENTO, PAGAMENTOS, INDICE FROM PLANOS_PAGAMENTOS`;
            const rows = await query(planSql);

            if (rows.length === 0) {
                hasMore = false;
            } else {
                rows.forEach(p => {
                    let pId = p.FORMA_PAGAMENTO;
                    if (!pId) return;
                    if (Buffer.isBuffer(pId)) pId = pId.toString();
                    if (pId.trim() === cleanMethodId) {
                        matchingPlans.push(p);
                    }
                });
                // Se retornou menos que o limite, acabou
                if (rows.length < limit) hasMore = false;
                else offset += limit;
            }
        }

        const result = {
            forma_pagamento: method.DESCRICAO.trim(),
            opcoes: []
        };

        if (matchingPlans.length > 0) {
            // Calcular opções baseadas nos planos
            matchingPlans.forEach(p => {
                const installments = p.PAGAMENTOS || 1;
                const rate = p.INDICE || 0;
                const totalWithRate = totalValue * (1 + (rate / 100));
                const installmentVal = totalWithRate / installments;
                const desc = p.DESCRICAO ? p.DESCRICAO.trim() : `Plano ${installments}x`;

                result.opcoes.push({
                    descricao: desc,
                    parcelas: installments,
                    valor_parcela: parseFloat(installmentVal.toFixed(2)),
                    total: parseFloat(totalWithRate.toFixed(2)),
                    taxa: rate
                });
            });
            // Ordenar por nr parcelas
            result.opcoes.sort((a, b) => a.parcelas - b.parcelas);
        } else {
            // Se não tem planos no banco, adiciona opção única (À vista ou Padrão)
            // IMPORTANTE: O usuário solicitou NÃO simular parcelas baseadas no nome (ex: "7/12").
            // Somente o que é real do sistema.

            let final = totalValue;
            let taxa = 0;

            // CORREÇÃO: PERC_DESAGIO é taxa do lojista, ignorando no preço final.
            // Se houver antecipação, aplica como acréscimo.
            if (method.PERC_ANTECIPACAO > 0) {
                taxa = method.PERC_ANTECIPACAO;
                final = totalValue * (1 + method.PERC_ANTECIPACAO / 100);
            }

            result.opcoes.push({
                descricao: 'À Vista / Rotativo',
                parcelas: 1,
                valor_parcela: parseFloat(final.toFixed(2)),
                total: parseFloat(final.toFixed(2)),
                taxa: taxa
            });
        }

        res.json(result);

    } catch (err) {
        console.error('Erro calculo pagamentos:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== GRADE ==========
async function getGrade(empresa, produto) {
    try {
        const sql = `
      SELECT
        EG.GRADE, EG.ITEM_GRADE, EG.SALDO, EG.EAN,
        G.DESCRICAO as GRADE_DESC,
        IG.DESCRICAO as ITEM_DESC, IG.ABREVIATURA
      FROM ESTOQUE_GRADE EG
      JOIN GRADES G ON G.GRADE = EG.GRADE
      JOIN ITENS_GRADE IG ON IG.GRADE = EG.GRADE AND IG.ITEM_GRADE = EG.ITEM_GRADE
      WHERE EG.EMPRESA = ? AND EG.PRODUTO = ? AND EG.SALDO > 0
      ORDER BY IG.DESCRICAO
    `;
        const rows = await query(sql, [empresa, produto]);

        if (rows.length === 0) return null;

        return {
            tipo: rows[0].GRADE_DESC ? rows[0].GRADE_DESC.trim() : null,
            itens: rows.map(r => ({
                variacao: r.ITEM_DESC ? r.ITEM_DESC.trim() : null,
                abreviatura: r.ABREVIATURA ? r.ABREVIATURA.trim() : null,
                ean: r.EAN ? String(r.EAN).trim() : null,
                estoque: r.SALDO != null ? parseFloat(r.SALDO) : null,
            }))
        };
    } catch (err) {
        return null;
    }
}

// ========== UTILS ==========
function formatProduto(p) {
    return {
        codigo: p.PRODUTO ? String(p.PRODUTO).trim() : null,
        descricao: p.DESCRICAO ? p.DESCRICAO.trim() : null,
        unidade: p.UNIDADE ? p.UNIDADE.trim() : null,
        ean: p.EAN ? String(p.EAN).trim() : null,
        ean1: p.EAN1 ? String(p.EAN1).trim() : null,
        ean2: p.EAN2 ? String(p.EAN2).trim() : null,
        preco_venda: p.VENDA != null ? parseFloat(p.VENDA) : null,
        preco_custo: p.CUSTO != null ? parseFloat(p.CUSTO) : null,
        estoque: p.SALDO != null ? parseFloat(p.SALDO) : null,
        preco_venda2: p.VENDA2 != null ? parseFloat(p.VENDA2) : null,
        preco_venda3: p.VENDA3 != null ? parseFloat(p.VENDA3) : null,
        marca: p.MARCA ? String(p.MARCA).trim() : null,
        grupo: p.GRUPO ? String(p.GRUPO).trim() : null,
        estoque_minimo: p.ESTOQUE_MINIMO != null ? parseFloat(p.ESTOQUE_MINIMO) : null,
    };
}

// ========== GRUPOS (BALANÇO) ==========
app.get('/api/grupos', async (req, res) => {
    try {
        const sql = `
            SELECT GRUPO, DESCRICAO
            FROM GRUPOS
            ORDER BY DESCRICAO
        `;
        const rows = await query(sql);
        const result = rows.map(r => ({
            id: r.GRUPO ? r.GRUPO.trim() : null,
            descricao: r.DESCRICAO ? r.DESCRICAO.trim() : null
        })).filter(r => r.id && r.descricao); // Remover grupos vazios

        res.json(result);
    } catch (err) {
        console.error('Erro ao buscar grupos:', err);
        res.status(500).json({ error: err.message });
    }
});

// Total de produtos em um grupo (para acompanhamento do balanço)
app.get('/api/grupos/:id/produtos/total', async (req, res) => {
    try {
        const grupoId = req.params.id.trim();
        const sql = `
            SELECT COUNT(*) as TOTAL
            FROM PRODUTOS
            WHERE TRIM(GRUPO) = ?
              AND (BLOQUEADO IS NULL OR BLOQUEADO <> 'True')
              AND (FORA_LINHA IS NULL OR FORA_LINHA <> 'True')
        `;
        const rows = await query(sql, [grupoId]);
        const total = rows.length > 0 ? rows[0].TOTAL : 0;

        res.json({ grupo: grupoId, total_produtos: total });
    } catch (err) {
        console.error('Erro ao contar produtos do grupo:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== AUTHENTICATION ==========
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, senha } = req.body;
        if (!login || !senha) return res.status(400).json({ error: 'Login e senha obrigatorios' });

        const hashSenha = crypto.createHash('md5').update(senha).digest('hex');
        const db = getSQLiteDB();

        const user = await db.get('SELECT id, nome, login FROM usuarios WHERE login = ? AND senha = ? AND ativo = 1', [login, hashSenha]);
        if (!user) {
            return res.status(401).json({ error: 'Login ou senha invalidos' });
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== BALANCO (SYNC & WEB) ==========
app.post('/api/balanco/sync', async (req, res) => {
    try {
        const { usuario_id, grupo_id, itens, local_session_id } = req.body;
        if (!usuario_id || !grupo_id || !itens || !Array.isArray(itens)) {
            return res.status(400).json({ error: 'Dados incompletos para sincronizacao' });
        }

        const db = getSQLiteDB();
        
        let sessaoId;

        // Se o app enviar uma identificacao de sessao contínua, tenta atualizar
        if (local_session_id) {
            const sessaoExistente = await db.get('SELECT id FROM sessoes_balanco WHERE local_session_id = ?', [local_session_id]);
            
            if (sessaoExistente) {
                sessaoId = sessaoExistente.id;
                // Deleta todos os itens antigos dessa sessão para inserir a nova lista completa
                await db.run('DELETE FROM itens_balanco WHERE sessao_id = ?', [sessaoId]);
                // Atualiza data fim sinalizando ultimo sync
                await db.run('UPDATE sessoes_balanco SET data_fim = CURRENT_TIMESTAMP WHERE id = ?', [sessaoId]);
            }
        }

        // Se nao existia ou o app nao mandou ID local, cria nova sessao
        if (!sessaoId) {
            const result = await db.run(
                'INSERT INTO sessoes_balanco (usuario_id, grupo_id, status, local_session_id) VALUES (?, ?, ?, ?)',
                [usuario_id, grupo_id, 'SINCRONIZADO', local_session_id || null]
            );
            sessaoId = result.lastID;
        }

        // Inserir itens atualizados
        for (const item of itens) {
            await db.run(
                'INSERT INTO itens_balanco (sessao_id, ean, descricao, quantidade) VALUES (?, ?, ?, ?)',
                [sessaoId, item.ean, item.nome || item.descricao, item.qty]
            );
        }

        res.json({ success: true, sessao_id: sessaoId, message: 'Balanco sincronizado com sucesso!' });
    } catch (err) {
        console.error('Erro na sincronizacao:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/balanco/sessions', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const sessoes = await db.all(`
            SELECT s.id, s.grupo_id, s.data_inicio, s.status, u.nome as usuario_nome,
                (SELECT SUM(quantidade) FROM itens_balanco WHERE sessao_id = s.id) as total_itens,
                (SELECT COUNT(*) FROM itens_balanco WHERE sessao_id = s.id) as produtos_diferentes
            FROM sessoes_balanco s
            JOIN usuarios u ON s.usuario_id = u.id
            ORDER BY s.data_inicio DESC
        `);

        // Busca o nome do grupo no Firebird para cada sessao
        for (let s of sessoes) {
            try {
                const fbResult = await query('SELECT DESCRICAO FROM GRUPOS WHERE GRUPO = ?', [s.grupo_id]);
                s.grupo_nome = fbResult.length > 0 ? fbResult[0].DESCRICAO.trim() : s.grupo_id;
            } catch (fbErr) {
                s.grupo_nome = s.grupo_id;
            }
        }

        res.json(sessoes);
    } catch (err) {
        console.error('Erro ao listar sessoes:', err);
        res.status(500).json({ error: err.message });
    }
});

// Buscar itens individuais de uma sessao
app.get('/api/balanco/session-items/:id', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const { id } = req.params;
        const itens = await db.all(`
            SELECT ib.ean, ib.descricao, ib.quantidade,
                   s.data_inicio, s.grupo_id,
                   u.nome as usuario_nome
            FROM itens_balanco ib
            JOIN sessoes_balanco s ON s.id = ib.sessao_id
            JOIN usuarios u ON u.id = s.usuario_id
            WHERE ib.sessao_id = ?
            ORDER BY ib.ean
        `, [id]);
        res.json(itens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar grupos que possuem sessoes sincronizadas
app.get('/api/balanco/grupos-sincronizados', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const gruposSqlite = await db.all(`
            SELECT grupo_id, 
                   COUNT(DISTINCT id) as total_sessoes
            FROM sessoes_balanco
            GROUP BY grupo_id
        `);

        for (let g of gruposSqlite) {
            try {
                const fbResult = await query('SELECT DESCRICAO FROM GRUPOS WHERE GRUPO = ?', [g.grupo_id]);
                g.grupo_nome = fbResult.length > 0 ? fbResult[0].DESCRICAO.trim() : g.grupo_id;
            } catch (fbErr) {
                g.grupo_nome = g.grupo_id;
            }
            
            // Pega o total consolidado de itens
            const sumQuery = await db.get(`
                SELECT SUM(quantidade) as q, COUNT(DISTINCT ean) as e 
                FROM itens_balanco 
                WHERE sessao_id IN (SELECT id FROM sessoes_balanco WHERE grupo_id = ?)
            `, [g.grupo_id]);
            
            g.total_itens = sumQuery.q || 0;
            g.produtos_diferentes = sumQuery.e || 0;
        }

        res.json(gruposSqlite);
    } catch (err) {
        console.error('Erro ao listar grupos sinc:', err);
        res.status(500).json({ error: err.message });
    }
});

// Exportar consolidado do grupo inteiro
app.get('/api/balanco/export-group/:id', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const { id } = req.params;
        const { only } = req.query; // 'sem_ean' ou 'com_ean'

        let grupoNome = 'grupo';
        try {
            const fbResult = await query('SELECT DESCRICAO FROM GRUPOS WHERE GRUPO = ?', [id]);
            if (fbResult.length > 0) grupoNome = fbResult[0].DESCRICAO.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        } catch (e) {}

        let eanFilter = '';
        if (only === 'sem_ean') eanFilter = "AND ean = 'SEM_EAN'";
        else if (only === 'com_ean') eanFilter = "AND ean != 'SEM_EAN'";

        // Busca agregando EANs iguais de TODAS as sessoes deste grupo
        const itens = await db.all(`
            SELECT ean, MAX(descricao) as descricao, SUM(quantidade) as total_qty 
            FROM itens_balanco 
            WHERE sessao_id IN (SELECT id FROM sessoes_balanco WHERE grupo_id = ?)
            ${eanFilter}
            GROUP BY ean
        `, [id]);

        if (itens.length === 0) {
            return res.status(404).send('Nenhum item encontrado para este grupo.');
        }

        let txtContent = '';
        itens.forEach(item => {
            if (item.ean === 'SEM_EAN') {
                txtContent += `${item.ean};${item.total_qty};${item.descricao || ''}\n`;
            } else {
                txtContent += `${item.ean};${item.total_qty}\n`;
            }
        });

        // Format date YYYYMMDD
        const today = new Date();
        const dateStr = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
        
        let filename = `balanco_CONSOLIDADO_${grupoNome}_${dateStr}.txt`;
        if (only === 'sem_ean') filename = `balanco_CONSOLIDADO_${grupoNome}_${dateStr}_SOMENTE_SEM_EAN.txt`;
        else if (only === 'com_ean') filename = `balanco_CONSOLIDADO_${grupoNome}_${dateStr}_SOMENTE_COM_EAN.txt`;

        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain');
        res.send(txtContent);
    } catch (err) {
        console.error('Erro ao exportar TXT consolidado:', err);
        res.status(500).send('Erro ao exportar arquivo consolidado.');
    }
});

app.get('/api/balanco/export/:id', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const { id } = req.params;
        const { only } = req.query; // 'sem_ean' ou 'com_ean'

        // Get group for filename
        const sessao = await db.get('SELECT grupo_id FROM sessoes_balanco WHERE id = ?', [id]);
        if (!sessao) return res.status(404).send('Sessao nao encontrada.');

        let grupoNome = 'grupo';
        try {
            const fbResult = await query('SELECT DESCRICAO FROM GRUPOS WHERE GRUPO = ?', [sessao.grupo_id]);
            if (fbResult.length > 0) grupoNome = fbResult[0].DESCRICAO.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        } catch (e) {}

        let eanFilter = '';
        if (only === 'sem_ean') eanFilter = "AND ean = 'SEM_EAN'";
        else if (only === 'com_ean') eanFilter = "AND ean != 'SEM_EAN'";

        const itens = await db.all(`SELECT ean, quantidade, descricao FROM itens_balanco WHERE sessao_id = ? ${eanFilter}`, [id]);
        if (itens.length === 0) {
            return res.status(404).send('Nenhum item encontrado nesta sessao.');
        }

        let txtContent = '';
        itens.forEach(item => {
            if (item.ean === 'SEM_EAN') {
                txtContent += `${item.ean};${item.quantidade};${item.descricao || ''}\n`;
            } else {
                txtContent += `${item.ean};${item.quantidade}\n`;
            }
        });

        // Format date YYYYMMDD
        const today = new Date();
        const dateStr = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
        
        let filename = `balanco_${grupoNome}_${dateStr}_sessao_${id}.txt`;
        if (only === 'sem_ean') filename = `balanco_${grupoNome}_${dateStr}_sessao_${id}_SOMENTE_SEM_EAN.txt`;
        else if (only === 'com_ean') filename = `balanco_${grupoNome}_${dateStr}_sessao_${id}_SOMENTE_COM_EAN.txt`;

        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain');
        res.send(txtContent);
    } catch (err) {
        console.error('Erro ao exportar TXT:', err);
        res.status(500).send('Erro ao exportar arquivo.');
    }
});

// ========== ZERAR BALANCO ==========

// Zerar TODOS os dados de balanco (todas sessoes e itens)
app.delete('/api/balanco/zerar-tudo', async (req, res) => {
    try {
        const db = getSQLiteDB();
        await db.run('DELETE FROM itens_balanco');
        await db.run('DELETE FROM sessoes_balanco');
        res.json({ success: true, message: 'Todos os dados de balanço foram apagados.' });
    } catch (err) {
        console.error('Erro ao zerar tudo:', err);
        res.status(500).json({ error: err.message });
    }
});

// Zerar dados de um grupo específico
app.delete('/api/balanco/zerar-grupo/:id', async (req, res) => {
    try {
        const db = getSQLiteDB();
        const { id } = req.params;
        await db.run(
            'DELETE FROM itens_balanco WHERE sessao_id IN (SELECT id FROM sessoes_balanco WHERE grupo_id = ?)',
            [id]
        );
        await db.run('DELETE FROM sessoes_balanco WHERE grupo_id = ?', [id]);
        res.json({ success: true, message: `Dados do grupo ${id} apagados.` });
    } catch (err) {
        console.error('Erro ao zerar grupo:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== WEB FRONTEND ROUTING ==========
// Faz com que o Node sirva o index.html da pasta public caso a rota nao seja de API.
// Isso permite que a navegação interna do App React/Expo Web funcione no navegador.
const path = require('path');
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint não encontrado' });
    }
});

// ========== START SERVER ==========
app.listen(PORT, '0.0.0.0', async () => {
    // Inicializar SQLite
    try {
        await initSQLite();
    } catch (err) {
        console.error('Erro ao inicializar banco local (SQLite):', err);
    }

    console.log(`\n🔍 Busca Preço API rodando em http://0.0.0.0:${PORT}`);
    console.log(`\nEndpoints disponíveis:`);
    console.log(`  GET /api/health                  - Status da conexão`);
    console.log(`  GET /api/produtos/busca?q=texto   - Buscar por descrição`);
    console.log(`  GET /api/produtos/barcode/:cod    - Buscar por código de barras`);
    console.log(`  GET /api/produtos/:id             - Buscar por código interno`);

    try {
        await testConnection();
        console.log(`\n✅ Conexão com Firebird OK!`);
        const count = await query('SELECT COUNT(*) as TOTAL FROM PRODUTOS');
        const gradeCount = await query(`SELECT COUNT(*) as TOTAL FROM ESTOQUE_GRADE WHERE EAN IS NOT NULL AND EAN <> ''`);
        console.log(`📦 ${count[0].TOTAL} produtos | 🏷️  ${gradeCount[0].TOTAL} variações com EAN`);
    } catch (err) {
        console.log(`\n⚠️  Não foi possível conectar ao banco: ${err.message}`);
    }
});
