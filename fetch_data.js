/* fetch_data.js — Run with:  node fetch_data.js
   Downloads all Transfer Payments records from the Open Canada API
   and writes data.json for the dashboard.                          */

const https = require('https');
const fs = require('fs');

const RESOURCE = 'f942e312-df08-4f05-8fba-8b37b2a688db';
const LIMIT = 10000;
const OUT_FILE = 'data.json';

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'TransferPayments-Dashboard/1.0' } }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error('JSON parse error')); }
            });
        }).on('error', reject);
    });
}

(async () => {
    let offset = 0, total = Infinity;
    const rows = [];

    while (offset < total) {
        const url = `https://ouvert.canada.ca/data/api/3/action/datastore_search?resource_id=${RESOURCE}&limit=${LIMIT}&offset=${offset}`;
        console.log(`Fetching offset ${offset}…`);
        const json = await get(url);
        if (!json.success) throw new Error('API returned failure');
        total = json.result.total;
        rows.push(...json.result.records);
        offset += LIMIT;
        console.log(`  → got ${rows.length} / ${total}`);
    }

    // Transform
    const records = rows.map(r => {
        const m = r.fy_ef.match(/(\d{4})\s*-\s*(\d{2})/);
        let year;
        if (m) {
            const base = Math.floor(parseInt(m[1], 10) / 100) * 100;
            year = base + parseInt(m[2], 10);
        } else {
            year = 0;
        }
        return {
            year,
            department: r.org_name,
            program: r.description,
            type: r.type,
            amount: parseFloat(r.expenditures) || 0
        };
    });

    fs.writeFileSync(OUT_FILE, JSON.stringify(records));
    console.log(`✓ Wrote ${records.length} records to ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1)} MB)`);
})();
