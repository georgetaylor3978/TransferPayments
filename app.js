/* ═══════════════════════════════════════════
   Transfer Payments Dashboard — app.js
   ═══════════════════════════════════════════ */

// ── State ──
let rawRecords = [];
let deptMap = {};
let allYears = [];
let allDepts = [];
let allGroups = [];
let selectedGroup = '<ALL>';
let selectedDept = '<ALL>';
let selectedYear = null;
let combineDepartments = true;
let themeMode = 'dark';

// Table state
let programSortColumn = 'amount';
let programSortDirection = 'desc';
let programSearchQuery = '';

// Chart instances
let chart1Instance = null;
let chart2Instance = null;

// Premium palette for stacked charts
const themePalette = [
    '#3b82f6', // Blue
    '#10b981', // Emerald Green
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16'  // Lime
];

// ══════════════════════════════════════
//  1.  LOAD DATA (JSON & CSV Map)
// ══════════════════════════════════════
async function fetchAllData() {
    const status = document.getElementById('dataStatus');

    try {
        const [resData, resCsv] = await Promise.all([
            fetch('data.json'),
            fetch('DeptMap.csv')
        ]);
        if (!resData.ok) throw new Error(`HTTP ${resData.status} loading data`);
        if (!resCsv.ok) throw new Error(`HTTP ${resCsv.status} loading DeptMap.csv`);
        
        rawRecords = await resData.json();
        const csvText = await resCsv.text();
        deptMap = parseCSV(csvText);
    } catch (err) {
        status.textContent = '❌ Load failed';
        status.className = 'data-status error';
        console.error(err);
        return;
    }

    // Assign Ministerial Group to records
    rawRecords.forEach(r => {
        r.ministerialGroup = deptMap[r.department] || 'Unassigned';
    });

    // Derive unique lists
    allYears = [...new Set(rawRecords.map(r => r.year))].sort((a, b) => a - b);
    allGroups = [...new Set(rawRecords.map(r => r.ministerialGroup))].sort();
    allDepts = [...new Set(rawRecords.map(r => r.department))].sort();
    selectedYear = allYears[allYears.length - 1];

    status.textContent = `✓ ${rawRecords.length.toLocaleString()} records`;
    status.className = 'data-status loaded';

    initTheme();
    buildGroupDropdown();
    buildDeptDropdown();
    buildYearSelect();
    initCombineToggle();
    initTableControls();
    
    renderAll();
}

// Simple yet robust CSV parser
function parseCSV(text) {
    const lines = [];
    let row = [""];
    lines.push(row);
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++;
            row = [''];
            lines.push(row);
        } else {
            row[row.length - 1] += c;
        }
    }
    
    const mapping = {};
    for (let i = 1; i < lines.length; i++) {
        const r = lines[i];
        if (r.length >= 2 && r[0].trim()) {
            mapping[r[0].trim()] = r[1].trim() || 'Unassigned';
        }
    }
    return mapping;
}

// ══════════════════════════════════════
//  2.  MINISTERIAL GROUP DROPDOWN
// ══════════════════════════════════════
function buildGroupDropdown() {
    const list = document.getElementById('groupList');
    list.innerHTML = '';

    const items = ['<ALL>', ...allGroups];
    items.forEach(name => {
        const div = document.createElement('div');
        div.className = 'dd-item' + (name === selectedGroup ? ' selected' : '');
        div.textContent = name;
        div.addEventListener('click', () => {
            selectedGroup = name;
            document.querySelector('#groupTrigger .dropdown-label').textContent = name;
            list.querySelectorAll('.dd-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            
            // Check if current department belongs to newly selected group
            if (selectedGroup !== '<ALL>') {
                const deptsInGroup = [...new Set(rawRecords.filter(r => r.ministerialGroup === selectedGroup).map(r => r.department))];
                if (selectedDept !== '<ALL>' && !deptsInGroup.includes(selectedDept)) {
                    selectedDept = '<ALL>';
                    document.querySelector('#deptTrigger .dropdown-label').textContent = '<ALL>';
                    
                    // Show/hide combine toggle
                    document.getElementById('combineToggleGroup').style.display = 'flex';
                }
            }
            
            closeGroupDropdown();
            buildDeptDropdown();
            renderAll();
        });
        list.appendChild(div);
    });

    // Toggle
    const trigger = document.getElementById('groupTrigger');
    const dropdown = document.getElementById('groupDropdown');
    trigger.addEventListener('click', () => {
        dropdown.classList.toggle('open');
        document.getElementById('deptDropdown').classList.remove('open');
    });

    // Search
    document.getElementById('groupSearch').addEventListener('input', e => {
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

function closeGroupDropdown() {
    document.getElementById('groupDropdown').classList.remove('open');
}

// ══════════════════════════════════════
//  3.  DEPARTMENT DROPDOWN
// ══════════════════════════════════════
function buildDeptDropdown() {
    const list = document.getElementById('deptList');
    list.innerHTML = '';

    // Filter departments based on selected group
    let filteredDepts = allDepts;
    if (selectedGroup !== '<ALL>') {
        filteredDepts = [...new Set(rawRecords.filter(r => r.ministerialGroup === selectedGroup).map(r => r.department))].sort();
    }

    const items = ['<ALL>', ...filteredDepts];
    items.forEach(name => {
        const div = document.createElement('div');
        div.className = 'dd-item' + (name === selectedDept ? ' selected' : '');
        div.textContent = name;
        div.addEventListener('click', () => {
            selectedDept = name;
            document.querySelector('#deptTrigger .dropdown-label').textContent = name;
            list.querySelectorAll('.dd-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            
            closeDeptDropdown();
            
            // Show/hide combine toggle based on selectedDept
            const toggleGroup = document.getElementById('combineToggleGroup');
            if (selectedDept === '<ALL>') {
                toggleGroup.style.display = 'flex';
            } else {
                toggleGroup.style.display = 'none';
            }
            
            renderAll();
        });
        list.appendChild(div);
    });

    // Toggle
    const trigger = document.getElementById('deptTrigger');
    const dropdown = document.getElementById('deptDropdown');
    
    // Reset any old listeners by replacing trigger with clone
    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);

    newTrigger.addEventListener('click', () => {
        dropdown.classList.toggle('open');
        document.getElementById('groupDropdown').classList.remove('open');
    });

    // Search
    const searchInput = document.getElementById('deptSearch');
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        list.querySelectorAll('.dd-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    // Click-outside
    document.addEventListener('click', e => {
        if (!dropdown.contains(e.target) && e.target !== newTrigger && !newTrigger.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

function closeDeptDropdown() {
    document.getElementById('deptDropdown').classList.remove('open');
}

// ══════════════════════════════════════
//  4.  YEAR SELECT
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
        renderTable();
    });
}

// ══════════════════════════════════════
//  5.  COMBINE DEPARTMENTS TOGGLE
// ══════════════════════════════════════
function initCombineToggle() {
    const toggle = document.getElementById('combineToggle');
    toggle.checked = combineDepartments;
    toggle.addEventListener('change', () => {
        combineDepartments = toggle.checked;
        renderGraph1();
    });
}

// ══════════════════════════════════════
//  6.  FILTERED DATA HELPERS
// ══════════════════════════════════════
function getFilteredRecords() {
    let records = rawRecords;
    if (selectedGroup !== '<ALL>') {
        records = records.filter(r => r.ministerialGroup === selectedGroup);
    }
    if (selectedDept !== '<ALL>') {
        records = records.filter(r => r.department === selectedDept);
    }
    return records;
}

// ══════════════════════════════════════
//  7.  KPIs
// ══════════════════════════════════════
function renderKPIs() {
    const data = getFilteredRecords();

    const byYear = {};
    data.forEach(r => { byYear[r.year] = (byYear[r.year] || 0) + r.amount; });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

    const elDollar = document.getElementById('kpiGrowthDollar');
    const elPct = document.getElementById('kpiGrowthPct');

    if (years.length < 2) {
        elDollar.textContent = '—';
        elPct.textContent = '—';
        elDollar.style.color = '';
        elPct.style.color = '';
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
//  8.  GRAPH 1 — Spend over Time
// ══════════════════════════════════════
function renderGraph1() {
    if (chart1Instance) chart1Instance.destroy();

    const years = allYears;
    let datasets = [];
    let title = '';
    let isStacked = false;

    // Filter records by Ministerial Group first
    let baseRecords = rawRecords;
    if (selectedGroup !== '<ALL>') {
        baseRecords = baseRecords.filter(r => r.ministerialGroup === selectedGroup);
    }

    if (selectedDept !== '<ALL>') {
        // Case A: Specific department selected
        title = `${selectedGroup} › ${selectedDept}`;
        
        const byYear = {};
        baseRecords.filter(r => r.department === selectedDept).forEach(r => {
            byYear[r.year] = (byYear[r.year] || 0) + r.amount;
        });
        const dataValues = years.map(y => byYear[y] || 0);

        datasets.push({
            label: selectedDept,
            data: dataValues,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            borderSkipped: false,
            barThickness: 24
        });
    } else if (combineDepartments) {
        // Case B: ALL departments selected and Combine is ON
        title = selectedGroup === '<ALL>' 
            ? 'Total Transfer Payments Over Time' 
            : `${selectedGroup} Spend Over Time (Combined)`;

        const byYear = {};
        baseRecords.forEach(r => {
            byYear[r.year] = (byYear[r.year] || 0) + r.amount;
        });
        const dataValues = years.map(y => byYear[y] || 0);

        datasets.push({
            label: selectedGroup === '<ALL>' ? 'All Groups' : selectedGroup,
            data: dataValues,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            borderSkipped: false,
            barThickness: 24
        });
    } else {
        // Case C: ALL departments selected and Combine is OFF (Separate)
        isStacked = true;
        
        if (selectedGroup === '<ALL>') {
            // C1: Breakdown by Ministerial Group
            title = 'Transfer Payments Over Time by Ministerial Group';
            
            const groupMap = {};
            allGroups.forEach(g => { groupMap[g] = {}; });
            
            baseRecords.forEach(r => {
                if (!groupMap[r.ministerialGroup]) groupMap[r.ministerialGroup] = {};
                groupMap[r.ministerialGroup][r.year] = (groupMap[r.ministerialGroup][r.year] || 0) + r.amount;
            });

            const sortedGroups = [...allGroups].sort((a, b) => {
                const sumA = Object.values(groupMap[a] || {}).reduce((s, v) => s + v, 0);
                const sumB = Object.values(groupMap[b] || {}).reduce((s, v) => s + v, 0);
                return sumB - sumA;
            });

            sortedGroups.forEach((group, idx) => {
                const dataValues = years.map(y => groupMap[group][y] || 0);
                datasets.push({
                    label: group,
                    data: dataValues,
                    backgroundColor: themePalette[idx % themePalette.length],
                    borderRadius: 4
                });
            });
        } else {
            // C2: Breakdown by Department in selected Ministerial Group
            title = `Spend Over Time by Department — ${selectedGroup}`;

            const deptsInGroup = [...new Set(baseRecords.map(r => r.department))].sort();
            const deptDataMap = {};
            deptsInGroup.forEach(d => { deptDataMap[d] = {}; });

            baseRecords.forEach(r => {
                deptDataMap[r.department][r.year] = (deptDataMap[r.department][r.year] || 0) + r.amount;
            });

            const sortedDepts = deptsInGroup.sort((a, b) => {
                const sumA = Object.values(deptDataMap[a] || {}).reduce((s, v) => s + v, 0);
                const sumB = Object.values(deptDataMap[b] || {}).reduce((s, v) => s + v, 0);
                return sumB - sumA;
            });

            sortedDepts.forEach((dept, idx) => {
                const dataValues = years.map(y => deptDataMap[dept][y] || 0);
                datasets.push({
                    label: dept,
                    data: dataValues,
                    backgroundColor: themePalette[idx % themePalette.length],
                    borderRadius: 4
                });
            });
        }
    }

    document.getElementById('chart1Title').textContent = title;

    chart1Instance = new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: {
            labels: years,
            datasets: datasets
        },
        options: barOptsVertical('Amount ($)', isStacked)
    });
}

// ══════════════════════════════════════
//  9.  GRAPH 2 — Department Breakdown
// ══════════════════════════════════════
function renderGraph2() {
    if (chart2Instance) chart2Instance.destroy();

    let yearData = rawRecords.filter(r => r.year === selectedYear);
    if (selectedGroup !== '<ALL>') {
        yearData = yearData.filter(r => r.ministerialGroup === selectedGroup);
    }

    const byDept = {};
    let totalAmount = 0;
    yearData.forEach(r => {
        byDept[r.department] = (byDept[r.department] || 0) + r.amount;
        totalAmount += r.amount;
    });

    const sorted = Object.entries(byDept).sort((a, b) => b[1] - a[1]);

    const top = sorted.slice(0, 15);
    const labels = top.map(s => s[0]);
    const values = top.map(s => s[1]);

    const topSum = values.reduce((sum, val) => sum + val, 0);
    const missingAmount = totalAmount - topSum;

    if (sorted.length > 15 && missingAmount > 0) {
        labels.push(`Other Departments`);
        values.push(missingAmount);
    }

    const wrapper = document.getElementById('chart2Wrapper');
    wrapper.style.height = Math.max(400, labels.length * 28) + 'px';

    let title = `Transfer Payments by Department — ${selectedYear}`;
    if (selectedGroup !== '<ALL>') {
        title = `Departmental Spending in ${selectedGroup} — ${selectedYear}`;
    }
    document.getElementById('chart2Title').textContent = title;

    // Create high-contrast highlight for selected department
    let colors = [];
    const defaultColors = generateGradientColors(top.length, '#3b82f6', '#06b6d4');
    
    for (let i = 0; i < top.length; i++) {
        const deptName = top[i][0];
        if (selectedDept !== '<ALL>' && deptName === selectedDept) {
            colors.push('#fbbf24'); // Vibrant amber for selected dept
        } else {
            colors.push(defaultColors[i]);
        }
    }
    
    if (labels.length > top.length) {
        colors.push('#6b7089');
    }

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
//  10. INTERACTIVE PROGRAMS TABLE
// ══════════════════════════════════════
function initTableControls() {
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.value = programSearchQuery;
        searchInput.addEventListener('input', e => {
            programSearchQuery = e.target.value;
            renderTable();
        });
    }

    const headers = document.querySelectorAll('.premium-table th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (programSortColumn === column) {
                programSortDirection = programSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                programSortColumn = column;
                programSortDirection = column === 'amount' || column === 'percent' ? 'desc' : 'asc';
            }
            renderTable();
        });
    });
}

function updateTableSortIcons() {
    const headers = document.querySelectorAll('.premium-table th.sortable');
    headers.forEach(th => {
        const column = th.getAttribute('data-sort');
        th.classList.remove('sort-asc', 'sort-desc');
        if (programSortColumn === column) {
            th.classList.add(programSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    let data = rawRecords.filter(r => r.year === selectedYear);
    if (selectedGroup !== '<ALL>') {
        data = data.filter(r => r.ministerialGroup === selectedGroup);
    }
    if (selectedDept !== '<ALL>') {
        data = data.filter(r => r.department === selectedDept);
    }

    const progAgg = {};
    let totalSum = 0;

    data.forEach(r => {
        const key = r.program;
        if (!progAgg[key]) {
            progAgg[key] = {
                program: r.program,
                department: r.department,
                amount: 0
            };
        }
        progAgg[key].amount += r.amount;
        totalSum += r.amount;
    });

    let list = Object.values(progAgg);

    if (programSearchQuery.trim() !== '') {
        const q = programSearchQuery.toLowerCase();
        list = list.filter(item => 
            item.program.toLowerCase().includes(q) || 
            item.department.toLowerCase().includes(q)
        );
    }

    // Calculate percent of overall sum for sorting
    list.forEach(item => {
        item.percent = totalSum > 0 ? (item.amount / totalSum) * 100 : 0;
    });

    list.sort((a, b) => {
        let valA = a[programSortColumn];
        let valB = b[programSortColumn];

        if (typeof valA === 'string') {
            return programSortDirection === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return programSortDirection === 'asc' 
                ? valA - valB 
                : valB - valA;
        }
    });

    const displayedItems = list.slice(0, 50);
    const sumOfDisplayed = displayedItems.reduce((s, item) => s + item.amount, 0);

    tableBody.innerHTML = '';
    if (displayedItems.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align: center; color: var(--text-muted); padding: 32px;">No matching programs found.</td>`;
        tableBody.appendChild(tr);
    } else {
        displayedItems.forEach(item => {
            const pctOfDisplayed = sumOfDisplayed > 0 ? (item.amount / sumOfDisplayed) * 100 : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.program}</strong></td>
                <td>
                    <span class="table-dept-text">${item.department}</span>
                    <span class="table-dept-subtext">${deptMap[item.department] || 'Unassigned'}</span>
                </td>
                <td class="numeric">${formatDollar(item.amount)}</td>
                <td class="numeric"><strong>${pctOfDisplayed.toFixed(2)}%</strong></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    let subtitle = `Top Programs in ${selectedYear}`;
    if (selectedGroup !== '<ALL>') subtitle += ` — ${selectedGroup}`;
    if (selectedDept !== '<ALL>') subtitle += ` — ${selectedDept}`;
    if (list.length > 50) subtitle += ` (Top 50 of ${list.length})`;
    document.getElementById('tableSubtitle').textContent = subtitle;
    
    updateTableSortIcons();
}

// ══════════════════════════════════════
//  11. THEME MANAGEMENT
// ══════════════════════════════════════
function initTheme() {
    const toggleBtn = document.getElementById('themeToggle');
    if (!toggleBtn) return;

    const savedTheme = localStorage.getItem('theme-mode') || 'dark';
    themeMode = savedTheme;
    
    if (themeMode === 'light') {
        document.body.classList.add('light-mode');
        toggleBtn.querySelector('.theme-icon').textContent = '☀️';
    } else {
        document.body.classList.remove('light-mode');
        toggleBtn.querySelector('.theme-icon').textContent = '🌙';
    }

    toggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('light-mode')) {
            document.body.classList.remove('light-mode');
            toggleBtn.querySelector('.theme-icon').textContent = '🌙';
            themeMode = 'dark';
        } else {
            document.body.classList.add('light-mode');
            toggleBtn.querySelector('.theme-icon').textContent = '☀️';
            themeMode = 'light';
        }
        localStorage.setItem('theme-mode', themeMode);
        
        // Dynamic re-render to update Chart.js theme colors
        renderGraph1();
        renderGraph2();
    });
}

function getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() ||
           getComputedStyle(document.body).getPropertyValue(varName).trim();
}

// ══════════════════════════════════════
//  12. RENDER ALL
// ══════════════════════════════════════
function renderAll() {
    renderKPIs();
    renderGraph1();
    renderGraph2();
    renderTable();
}

// ══════════════════════════════════════
//  13. CHART OPTION BUILDERS
// ══════════════════════════════════════
function barOptsVertical(yLabel, stacked = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                display: stacked,
                position: 'bottom',
                labels: {
                    color: getThemeColor('--text-secondary') || '#a0a4b8',
                    font: { size: 10, family: 'Inter' },
                    boxWidth: 12
                }
            },
            tooltip: {
                backgroundColor: getThemeColor('--bg-card') || '#1a1d2e',
                titleColor: getThemeColor('--text-primary') || '#e8eaf0',
                bodyColor: getThemeColor('--text-secondary') || '#a0a4b8',
                borderColor: getThemeColor('--border') || '#262a3d',
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
                stacked: stacked,
                grid: { display: false },
                ticks: { 
                    color: getThemeColor('--text-muted') || '#6b7089', 
                    font: { size: 11, family: 'Inter' } 
                }
            },
            y: {
                stacked: stacked,
                grid: { 
                    color: getThemeColor('--border-light') || '#2d3150',
                    opacity: 0.1 
                },
                ticks: {
                    color: getThemeColor('--text-muted') || '#6b7089',
                    font: { size: 11, family: 'Inter' },
                    callback: v => formatCompact(v)
                },
                title: { 
                    display: true, 
                    text: yLabel, 
                    color: getThemeColor('--text-muted') || '#6b7089', 
                    font: { size: 11, family: 'Inter' } 
                }
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
                backgroundColor: getThemeColor('--bg-card') || '#1a1d2e',
                titleColor: getThemeColor('--text-primary') || '#e8eaf0',
                bodyColor: getThemeColor('--text-secondary') || '#a0a4b8',
                borderColor: getThemeColor('--border') || '#262a3d',
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
                grid: { 
                    color: getThemeColor('--border-light') || '#2d3150',
                    opacity: 0.1 
                },
                ticks: {
                    color: getThemeColor('--text-muted') || '#6b7089',
                    font: { size: 11, family: 'Inter' },
                    callback: v => formatCompact(v)
                }
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: getThemeColor('--text-secondary') || '#a0a4b8',
                    font: { size: 11, family: 'Inter' },
                    autoSkip: false
                }
            }
        }
    };
}

// ══════════════════════════════════════
//  14. UTILITIES
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
//  15. INIT
// ══════════════════════════════════════
fetchAllData();
