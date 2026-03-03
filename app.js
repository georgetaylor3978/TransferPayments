/* ═══════════════════════════════════════════
   Transfer Payments Dashboard — app.js
   ═══════════════════════════════════════════ */

// ── State ──
let rawRecords = [];
let allYears = [];
let allDepts = [];
let selectedDept = '<ALL>';
let selectedYear = null;
let chart1Instance = null;
let chart2Instance = null;
let chart3Instance = null;

// ══════════════════════════════════════
//  1.  LOAD DATA (pre-baked JSON)
// ══════════════════════════════════════
async function fetchAllData() {
    const status = document.getElementById('dataStatus');

    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rawRecords = await res.json();
    } catch (err) {
        status.textContent = '❌ Load failed';
        status.className = 'data-status error';
        console.error(err);
        return;
    }

    // ── Derive unique lists ──
    allYears = [...new Set(rawRecords.map(r => r.year))].sort((a, b) => a - b);
    allDepts = [...new Set(rawRecords.map(r => r.department))].sort();
    selectedYear = allYears[allYears.length - 1];

    status.textContent = `✓ ${rawRecords.length.toLocaleString()} records`;
    status.className = 'data-status loaded';

    buildDeptDropdown();
    buildYearSelect();
    renderAll();
}

// ══════════════════════════════════════
//  2.  DEPARTMENT DROPDOWN
// ══════════════════════════════════════
function buildDeptDropdown() {
    const list = document.getElementById('deptList');
    list.innerHTML = '';

    const items = ['<ALL>', ...allDepts];
    items.forEach(name => {
        const div = document.createElement('div');
        div.className = 'dd-item' + (name === selectedDept ? ' selected' : '');
        div.textContent = name;
        div.addEventListener('click', () => {
            selectedDept = name;
            document.querySelector('#deptTrigger .dropdown-label').textContent = name;
            list.querySelectorAll('.dd-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            closeDropdown();
            renderAll();
        });
        list.appendChild(div);
    });

    // Toggle
    const trigger = document.getElementById('deptTrigger');
    const dropdown = document.getElementById('deptDropdown');
    trigger.addEventListener('click', () => dropdown.classList.toggle('open'));

    // Search
    document.getElementById('deptSearch').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        list.querySelectorAll('.dd-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    // Click-outside
    document.addEventListener('click', e => {
        if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
    });
}

function closeDropdown() {
    document.getElementById('deptDropdown').classList.remove('open');
}

// ══════════════════════════════════════
//  3.  YEAR SELECT (for Graph 2 & 3)
// ══════════════════════════════════════
function buildYearSelect() {
    const sel = document.getElementById('yearSelect');
    sel.innerHTML = '';
    [...allYears].reverse().forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        selectedYear = parseInt(sel.value, 10);
        renderGraph2();
        renderGraph3();
    });
}

// ══════════════════════════════════════
//  4.  FILTERED DATA HELPERS
// ══════════════════════════════════════
function filteredByDept() {
    if (selectedDept === '<ALL>') return rawRecords;
    return rawRecords.filter(r => r.department === selectedDept);
}

// ══════════════════════════════════════
//  5.  KPIs
// ══════════════════════════════════════
function renderKPIs() {
    const data = filteredByDept();

    // Sum per year
    const byYear = {};
    data.forEach(r => { byYear[r.year] = (byYear[r.year] || 0) + r.amount; });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

    const elDollar = document.getElementById('kpiGrowthDollar');
    const elPct = document.getElementById('kpiGrowthPct');

    if (years.length < 2) {
        elDollar.textContent = '—';
        elPct.textContent = '—';
        return;
    }

    const earliest = byYear[years[0]];
    const latest = byYear[years[years.length - 1]];
    const growthD = latest - earliest;
    const growthP = earliest !== 0 ? ((latest - earliest) / earliest) * 100 : 0;

    elDollar.textContent = formatDollar(growthD);
    elDollar.style.color = growthD >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)';
    elPct.textContent = (growthP >= 0 ? '+' : '') + growthP.toFixed(1) + '%';
    elPct.style.color = growthP >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)';
}

// ══════════════════════════════════════
//  6.  GRAPH 1 — LINE: Amount over Time
// ══════════════════════════════════════
function renderGraph1() {
    const data = filteredByDept();

    const byYear = {};
    data.forEach(r => { byYear[r.year] = (byYear[r.year] || 0) + r.amount; });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const values = years.map(y => byYear[y]);

    const title = selectedDept === '<ALL>'
        ? 'Total Transfer Payments Over Time'
        : `Transfer Payments Over Time — ${selectedDept}`;
    document.getElementById('chart1Title').textContent = title;

    if (chart1Instance) chart1Instance.destroy();

    chart1Instance = new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Amount ($)',
                data: values,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 24
            }]
        },
        options: barOptsVertical('Amount ($)')
    });
}

// ══════════════════════════════════════
//  7.  GRAPH 2 — HORIZ BAR: Depts by $
// ══════════════════════════════════════
function renderGraph2() {
    const yearData = rawRecords.filter(r => r.year === selectedYear);

    const byDept = {};
    let totalAmount = 0;
    yearData.forEach(r => {
        byDept[r.department] = (byDept[r.department] || 0) + r.amount;
        totalAmount += r.amount;
    });

    const sorted = Object.entries(byDept).sort((a, b) => b[1] - a[1]);

    // Top 15 + Missing
    const top = sorted.slice(0, 15);
    const labels = top.map(s => s[0]);
    const values = top.map(s => s[1]);

    const topSum = values.reduce((sum, val) => sum + val, 0);
    const missingAmount = totalAmount - topSum;

    if (sorted.length > 15 && missingAmount > 0) {
        labels.push(`Missing: ${formatDollar(missingAmount)}`);
        values.push(missingAmount);
    }

    // Dynamic height
    const wrapper = document.getElementById('chart2Wrapper');
    wrapper.style.height = Math.max(400, labels.length * 28) + 'px';

    document.getElementById('chart2Title').textContent =
        `Transfer Payments by Department — ${selectedYear}`;

    if (chart2Instance) chart2Instance.destroy();

    const colors = generateGradientColors(top.length, '#3b82f6', '#22d3ee');
    if (labels.length > top.length) colors.push('#f97316'); // Orange for missing

    chart2Instance = new Chart(document.getElementById('chart2'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Amount ($)',
                data: values,
                backgroundColor: colors,
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 18
            }]
        },
        options: barOpts()
    });
}

// ══════════════════════════════════════
//  8.  GRAPH 3 — HORIZ BAR: Programs
// ══════════════════════════════════════
function renderGraph3() {
    let data = rawRecords.filter(r => r.year === selectedYear);
    if (selectedDept !== '<ALL>') data = data.filter(r => r.department === selectedDept);

    const byProg = {};
    data.forEach(r => { byProg[r.program] = (byProg[r.program] || 0) + r.amount; });
    const sorted = Object.entries(byProg).sort((a, b) => b[1] - a[1]);

    // Limit to top 50 to avoid overcrowding when ALL is selected
    const top = sorted.slice(0, 50);

    // Wrap text: split long labels into arrays of strings so Chart.js renders them on multiple lines
    const labels = top.map(s => wrapTextLabel(s[0], 50));
    const values = top.map(s => s[1]);

    const wrapper = document.getElementById('chart3Wrapper');
    wrapper.style.height = Math.max(400, labels.length * 28) + 'px';

    let subtitle = `Programs — ${selectedYear}`;
    if (selectedDept !== '<ALL>') subtitle += ` — ${selectedDept}`;
    if (sorted.length > 50) subtitle += ` (Top 50 of ${sorted.length})`;
    document.getElementById('chart3Title').textContent = subtitle;

    if (chart3Instance) chart3Instance.destroy();

    chart3Instance = new Chart(document.getElementById('chart3'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Amount ($)',
                data: values,
                backgroundColor: generateGradientColors(labels.length, '#34d399', '#22d3ee'),
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 14 // thinner to accommodate multi-line labels
            }]
        },
        options: barOptsMultiLine()
    });
}

// ══════════════════════════════════════
//  RENDER ALL
// ══════════════════════════════════════
function renderAll() {
    renderKPIs();
    renderGraph1();
    renderGraph2();
    renderGraph3();
}

// ══════════════════════════════════════
//  CHART OPTION BUILDERS
// ══════════════════════════════════════
function barOptsVertical(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15,17,23,0.92)',
                titleColor: '#e8eaf0',
                bodyColor: '#a0a4b8',
                borderColor: '#262a3d',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: ctx => `Amount: ${formatDollar(ctx.parsed.y)}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#6b7089', font: { size: 11 } }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: {
                    color: '#6b7089',
                    font: { size: 11 },
                    callback: v => formatCompact(v)
                },
                title: { display: true, text: yLabel, color: '#6b7089', font: { size: 11 } }
            }
        }
    };
}

function lineOpts(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15,17,23,0.92)',
                titleColor: '#e8eaf0',
                bodyColor: '#a0a4b8',
                borderColor: '#262a3d',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${formatDollar(ctx.parsed.y)}`
                }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#6b7089', font: { size: 11 } }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: {
                    color: '#6b7089',
                    font: { size: 11 },
                    callback: v => formatCompact(v)
                },
                title: { display: true, text: yLabel, color: '#6b7089', font: { size: 11 } }
            }
        }
    };
}

function barOpts() {
    return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15,17,23,0.92)',
                titleColor: '#e8eaf0',
                bodyColor: '#a0a4b8',
                borderColor: '#262a3d',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: ctx => `Amount: ${formatDollar(ctx.parsed.x)}`
                }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: {
                    color: '#6b7089',
                    font: { size: 11 },
                    callback: v => formatCompact(v)
                }
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: '#a0a4b8',
                    font: { size: 11 },
                    autoSkip: false
                }
            }
        }
    };
}

function barOptsMultiLine() {
    const opts = barOpts();
    opts.scales.y.ticks.font = { size: 10 };
    return opts;
}

// ══════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════
function formatDollar(v) {
    const abs = Math.abs(v);
    let str;
    if (abs >= 1e9) str = '$' + (abs / 1e9).toFixed(2) + 'B';
    else if (abs >= 1e6) str = '$' + (abs / 1e6).toFixed(2) + 'M';
    else if (abs >= 1e3) str = '$' + (abs / 1e3).toFixed(1) + 'K';
    else str = '$' + abs.toFixed(0);
    return v < 0 ? '-' + str : str;
}

function formatCompact(v) {
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toString();
}

function truncateLabel(s, max) {
    return s && s.length > max ? s.slice(0, max - 1) + '…' : (s || '(unnamed)');
}

function wrapTextLabel(text, maxLineLength) {
    if (!text) return '(unnamed)';
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + words[i].length + 1 <= maxLineLength) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines.length === 1 ? lines[0] : lines;
}

function generateGradientColors(count, from, to) {
    if (count <= 1) return [from];
    const f = hexToRgb(from);
    const t = hexToRgb(to);
    return Array.from({ length: count }, (_, i) => {
        const p = i / (count - 1);
        const r = Math.round(f.r + (t.r - f.r) * p);
        const g = Math.round(f.g + (t.g - f.g) * p);
        const b = Math.round(f.b + (t.b - f.b) * p);
        return `rgb(${r},${g},${b})`;
    });
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
    };
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
fetchAllData();
