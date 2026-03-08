require('dotenv').config();
const { query, testConnection } = require('./db');

async function inspectInventoryGroups() {
    try {
        await testConnection();
        console.log('--- Inspecting PRODUTOS table columns for group/section ---');
        const prodCols = await query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PRODUTOS'");
        console.log("PRODUTOS columns:", prodCols.map(c => c.RDB$FIELD_NAME.trim()).filter(c => c.includes('GRUPO') || c.includes('SECAO') || c.includes('DEPTO') || c.includes('FAMILIA') || c.includes('LINHA')));

        console.log('\n--- Looking for Group/Section Tables ---');
        const tables = await query("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0");
        const groupTables = tables.map(t => t.RDB$RELATION_NAME.trim()).filter(n => n.includes('GRUPO') || n.includes('SECAO') || n.includes('DEPTO') || n.includes('FAMILIA') || n.includes('LINHA'));
        console.log("Potential Group/Section Tables:", groupTables);

        // If we found 'GRUPOS', let's inspect it
        if (groupTables.includes('GRUPOS')) {
            console.log('\n--- Inspecting GRUPOS table columns ---');
            const groupCols = await query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'GRUPOS'");
            console.log("GRUPOS columns:", groupCols.map(c => c.RDB$FIELD_NAME.trim()));

            console.log('\n--- Sample Data from GRUPOS ---');
            const groups = await query("SELECT FIRST 10 * FROM GRUPOS");
            console.dir(groups, { depth: null });
        }

        // If we found 'SECOES', let's inspect it
        if (groupTables.includes('SECOES')) {
            console.log('\n--- Inspecting SECOES table columns ---');
            const secCols = await query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'SECOES'");
            console.log("SECOES columns:", secCols.map(c => c.RDB$FIELD_NAME.trim()));

            console.log('\n--- Sample Data from SECOES ---');
            const secoes = await query("SELECT FIRST 10 * FROM SECOES");
            console.dir(secoes, { depth: null });
        }

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

inspectInventoryGroups();
