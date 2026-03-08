const http = require('http');

const data = JSON.stringify({
    total: 120.00,
    forma_pagamento_id: '000025' // Amex 7/12
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/pagamentos/calculo',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const json = JSON.parse(body);
            console.log('Payment Method:', json.forma_pagamento);
            console.log('Options received:', json.opcoes.length);
            json.opcoes.forEach(o => {
                console.log(`${o.descricao}: ${o.parcelas}x de R$ ${o.valor_parcela} - Total: R$ ${o.total} (Taxa: ${o.taxa})`);
            });
        } catch (e) {
            console.log('Body:', body);
        }
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
