/**
 * benchmark.js — Node.js benchmark runner for jira-team-report data functions.
 * Run: node benchmark.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// ─── Constants (copied from script.js) ─────────────────────────────────────

const statusColorMap = {
    'To Do': '#6ec5ff',
    'In Review': '#f5d469',
    'In Progress': '#4b8cff',
    'Done': '#1fce88'
};
const statusOrder = ['To Do', 'In Progress', 'In Review', 'Done'];
const storyPointSizeMap = new Map([[1,'XS'],[2,'S'],[3,'M'],[5,'L'],[8,'XL']]);
const excludedAverageNames = ['Guillermo Malagón'];

// ─── Data functions (copied verbatim from script.js) ────────────────────────

function parseCsv(text = '') {
    const normalized = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const next = normalized[i + 1];
        if (inQuotes) {
            if (char === '"' && next === '"') { value += '"'; i += 1; }
            else if (char === '"') { inQuotes = false; }
            else { value += char; }
            continue;
        }
        if (char === '"') { inQuotes = true; continue; }
        if (char === ',') { row.push(value); value = ''; continue; }
        if (char === '\n') { row.push(value); rows.push(row); row = []; value = ''; continue; }
        if (char === '\r') { continue; }
        value += char;
    }
    if (value.length || row.length) { row.push(value); rows.push(row); }
    return rows;
}

function normalizeName(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const isActiveMember = (member = {}) => member?.active !== false;
const getActiveMembers = (members = []) => (members || []).filter(isActiveMember);

let explicitAssigneeAliases = new Map();

function buildExplicitAliasMapFromTeam(teamMembers = []) {
    const map = new Map();
    (teamMembers || []).forEach(member => {
        const name = member?.name;
        if (!name) return;
        const aliases = member?.csvAliases || member?.csvAlias || [];
        const list = Array.isArray(aliases) ? aliases : [aliases];
        list.forEach(alias => {
            const normalized = normalizeName(alias);
            if (!alias || !normalized) return;
            map.set(normalized, name);
        });
    });
    return map;
}

function buildAssigneeAliasMap(teamMembers = [], csvAssignees = []) {
    const teamNormalized = (teamMembers || [])
        .map(member => ({ name: member?.name || '', normalized: normalizeName(member?.name || '') }))
        .filter(entry => entry.name && entry.normalized);

    const aliasMap = new Map();
    (csvAssignees || []).forEach(assignee => {
        const normalizedAssignee = normalizeName(assignee);
        if (!normalizedAssignee) return;
        if (explicitAssigneeAliases.has(normalizedAssignee)) {
            aliasMap.set(assignee, explicitAssigneeAliases.get(normalizedAssignee));
            return;
        }
        let match = teamNormalized.find(entry => entry.normalized === normalizedAssignee);
        if (!match) {
            const matches = teamNormalized.filter(entry =>
                normalizedAssignee.includes(entry.normalized) ||
                entry.normalized.includes(normalizedAssignee)
            );
            if (matches.length) match = matches.sort((a, b) => b.normalized.length - a.normalized.length)[0];
        }
        aliasMap.set(assignee, match ? match.name : assignee);
    });
    return aliasMap;
}

function getAssigneeIndex(header = []) {
    return header.findIndex(cell => String(cell || '').trim().toLowerCase() === 'assignee');
}
function getStatusIndex(header = []) {
    return header.findIndex(cell => String(cell || '').trim().toLowerCase() === 'status');
}
function getStoryPointIndex(header = []) {
    const normalized = header.map(cell => String(cell || '').trim().toLowerCase());
    const exact = normalized.findIndex(cell => cell === 'custom field (story point estimate)');
    if (exact >= 0) return exact;
    const estimate = normalized.findIndex(cell => cell.includes('story point estimate'));
    if (estimate >= 0) return estimate;
    return normalized.findIndex(cell => cell.includes('story point'));
}

function parseCsvDate(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const match = raw.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/);
    if (!match) return null;
    const day = Number(match[1]);
    const monthKey = match[2].toLowerCase();
    const yearRaw = match[3];
    const monthMap = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const month = monthMap[monthKey];
    if (month == null) return null;
    const yearNum = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    if (!yearNum || Number.isNaN(yearNum)) return null;
    const date = new Date(yearNum, month, day);
    if (Number.isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildMemberDatasetsFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { labels: [], datasets: [] };
    const header = rows[0].map(cell => String(cell || '').trim());
    const headerLower = header.map(cell => cell.toLowerCase());
    const assigneeIndex = headerLower.findIndex(cell => cell === 'assignee');
    const statusIndex = headerLower.findIndex(cell => cell === 'status' || cell.includes('status'));
    const pointsIndex = headerLower.findIndex(cell => cell.includes('story point'));
    const updatedIndex = headerLower.findIndex(cell => cell === 'updated');
    if (assigneeIndex < 0 || statusIndex < 0 || pointsIndex < 0 || updatedIndex < 0) return { labels: [], datasets: [] };

    const dataRows = rows.slice(1);
    const csvAssignees = Array.from(new Set(dataRows.map(row => String(row[assigneeIndex] || '').trim()).filter(Boolean)));
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeMembers = (teamMembers || []).filter(isActiveMember);
    const activeNames = new Set(activeMembers.map(member => member?.name).filter(Boolean));

    const datesSet = new Set();
    const byMemberDate = new Map();
    const totalsByMember = new Map();
    let hasDone = false;

    dataRows.forEach(row => {
        const status = String(row[statusIndex] || '').trim();
        if (!status) return;
        if (status.toLowerCase() === 'done') {
            const points = Number(String(row[pointsIndex] || '').replace(',', '.')) || 0;
            if (points > 0) hasDone = true;
        }
    });

    const includeAllStatuses = !hasDone;
    dataRows.forEach(row => {
        const rawAssignee = String(row[assigneeIndex] || '').trim();
        if (!rawAssignee) return;
        const canonical = aliasMap.get(rawAssignee) || rawAssignee;
        if (!activeNames.has(canonical)) return;
        const status = String(row[statusIndex] || '').trim();
        if (!status) return;
        if (!includeAllStatuses && status.toLowerCase() !== 'done') return;
        const dateKey = parseCsvDate(row[updatedIndex]);
        if (!dateKey) return;
        const points = Number(String(row[pointsIndex] || '').replace(',', '.')) || 0;
        if (!Number.isFinite(points) || points <= 0) return;
        datesSet.add(dateKey);
        if (!byMemberDate.has(canonical)) byMemberDate.set(canonical, new Map());
        const dateMap = byMemberDate.get(canonical);
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + points);
        totalsByMember.set(canonical, (totalsByMember.get(canonical) || 0) + points);
    });

    const labels = Array.from(datesSet).sort((a, b) => new Date(a) - new Date(b));
    const datasets = activeMembers.map((member, idx) => {
        const name = member?.name || `Member ${idx + 1}`;
        const perDate = byMemberDate.get(name) || new Map();
        let running = 0;
        const data = labels.map(day => { running += Number(perDate.get(day)) || 0; return running; });
        const total = totalsByMember.get(name) || 0;
        return { label: name, data, totals: labels.map(() => total) };
    });

    return { labels, datasets };
}

function buildTrendDataFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return null;
    const header = rows[0].map(cell => String(cell || '').trim());
    const headerLower = header.map(cell => cell.toLowerCase());
    const findIndex = (predicate) => headerLower.findIndex(predicate);
    const assigneeIndex = findIndex(cell => cell === 'assignee');
    const statusIndex = findIndex(cell => cell === 'status' || cell.includes('status'));
    const pointsIndex = findIndex(cell => cell.includes('story point'));
    const updatedIndex = findIndex(cell => cell === 'updated');
    const createdIndex = findIndex(cell => cell === 'created');
    const startIndex = findIndex(cell => cell.includes('start date'));
    const dueIndex = findIndex(cell => cell === 'due date');
    if (statusIndex < 0 || pointsIndex < 0) return null;

    const dataRows = rows.slice(1);
    const csvAssignees = assigneeIndex >= 0
        ? Array.from(new Set(dataRows.map(row => String(row[assigneeIndex] || '').trim()).filter(Boolean)))
        : [];
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeNames = new Set((teamMembers || []).map(m => m?.name).filter(Boolean));

    const dateMap = new Map();
    const seenStates = new Set();
    const dateIndexes = [updatedIndex, createdIndex, startIndex, dueIndex].filter(idx => idx >= 0);

    dataRows.forEach(row => {
        if (assigneeIndex >= 0 && activeNames.size) {
            const rawAssignee = String(row[assigneeIndex] || '').trim();
            if (!rawAssignee) return;
            const canonical = aliasMap.get(rawAssignee) || rawAssignee;
            if (!activeNames.has(canonical)) return;
        }
        const status = String(row[statusIndex] || '').trim();
        if (!status) return;
        const dateRaw = dateIndexes.map(idx => row[idx]).find(val => String(val || '').trim().length > 0);
        const dateKey = parseCsvDate(dateRaw);
        if (!dateKey) return;
        const points = Number(String(row[pointsIndex] || '').replace(',', '.')) || 0;
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
        const acc = dateMap.get(dateKey);
        acc[status] = (acc[status] || 0) + points;
        seenStates.add(status);
    });

    if (!dateMap.size) return null;
    const labels = Array.from(dateMap.keys()).sort((a, b) => new Date(a) - new Date(b));
    const states = statusOrder.filter(s => seenStates.has(s)).concat(Array.from(seenStates).filter(s => !statusOrder.includes(s)));
    const datasets = states.map(state => ({
        label: state,
        data: labels.map(day => dateMap.get(day)?.[state] || 0)
    }));
    return { labels, datasets };
}

function buildStatusTotalsFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { counts: {}, states: [] };
    const header = rows[0].map(cell => String(cell || '').trim());
    const headerLower = header.map(cell => cell.toLowerCase());
    const assigneeIndex = headerLower.findIndex(cell => cell === 'assignee');
    const statusIndex = headerLower.findIndex(cell => cell === 'status' || cell.includes('status'));
    const pointsIndex = headerLower.findIndex(cell => cell.includes('story point'));
    if (statusIndex < 0 || pointsIndex < 0) return { counts: {}, states: [] };

    const dataRows = rows.slice(1);
    const csvAssignees = assigneeIndex >= 0
        ? Array.from(new Set(dataRows.map(row => String(row[assigneeIndex] || '').trim()).filter(Boolean)))
        : [];
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeNames = new Set((teamMembers || []).map(m => m?.name).filter(Boolean));

    const counts = {};
    const states = new Set();
    dataRows.forEach(row => {
        if (assigneeIndex >= 0 && activeNames.size) {
            const rawAssignee = String(row[assigneeIndex] || '').trim();
            if (!rawAssignee) return;
            const canonical = aliasMap.get(rawAssignee) || rawAssignee;
            if (!activeNames.has(canonical)) return;
        }
        const status = String(row[statusIndex] || '').trim();
        if (!status) return;
        const points = Number(String(row[pointsIndex] || '').replace(',', '.')) || 0;
        counts[status] = (counts[status] || 0) + points;
        states.add(status);
    });
    return { counts, states: Array.from(states) };
}

function buildStoryPointMatrixFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { header: [], rows: [], total: 0 };
    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = getAssigneeIndex(header);
    const statusIndex = getStatusIndex(header);
    const pointsIndex = getStoryPointIndex(header);
    if (assigneeIndex < 0 || pointsIndex < 0) return { header: [], rows: [], total: 0 };

    const dataRows = rows.slice(1);
    const csvAssignees = Array.from(new Set(dataRows.map(row => String(row[assigneeIndex] || '').trim()).filter(Boolean)));
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeMembers = getActiveMembers(teamMembers);
    const activeNameSet = new Set(activeMembers.map(m => m?.name).filter(Boolean));

    const countsByMember = new Map();
    const totalsByMember = new Map();
    const storyPointSet = new Set();
    let total = 0;

    dataRows.forEach(row => {
        const rawAssignee = String(row[assigneeIndex] || '').trim();
        if (!rawAssignee) return;
        const canonical = aliasMap.get(rawAssignee) || rawAssignee;
        if (activeNameSet.size && !activeNameSet.has(canonical)) return;
        if (statusIndex >= 0) {
            const status = String(row[statusIndex] || '').trim();
            if (!status || status.toLowerCase() !== 'done') return;
        }
        const rawPoints = String(row[pointsIndex] || '').trim();
        const pointsLabel = rawPoints || 'Sin estimar';
        storyPointSet.add(pointsLabel);
        const counts = countsByMember.get(canonical) || new Map();
        counts.set(pointsLabel, (counts.get(pointsLabel) || 0) + 1);
        countsByMember.set(canonical, counts);
        totalsByMember.set(canonical, (totalsByMember.get(canonical) || 0) + 1);
        total += 1;
    });

    return { header: ['Member', ...Array.from(storyPointSet)], rows: [], total };
}

function buildLabelMapFromCsv(rows = [], aliasMap = new Map()) {
    if (!rows.length) return new Map();
    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = header.findIndex(cell => cell.toLowerCase() === 'assignee');
    const labelIndexes = header.map((cell, idx) => cell.toLowerCase().startsWith('labels') ? idx : -1).filter(idx => idx >= 0);
    if (assigneeIndex < 0 || !labelIndexes.length) return new Map();

    const map = new Map();
    rows.slice(1).forEach(row => {
        const assignee = String(row[assigneeIndex] || '').trim();
        if (!assignee) return;
        const canonical = aliasMap.get(assignee) || assignee;
        const counts = map.get(canonical) || new Map();
        labelIndexes.forEach(idx => {
            const cell = String(row[idx] || '').trim();
            if (!cell) return;
            cell.split(/[,;]+/).forEach(label => {
                const value = label.trim();
                if (!value) return;
                counts.set(value, (counts.get(value) || 0) + 1);
            });
        });
        map.set(canonical, counts);
    });
    return map;
}

function buildMemberDoneTotalsFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return null;
    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = getAssigneeIndex(header);
    const statusIndex = getStatusIndex(header);
    const pointsIndex = getStoryPointIndex(header);
    if (assigneeIndex < 0 || statusIndex < 0 || pointsIndex < 0) return null;

    const dataRows = rows.slice(1);
    const csvAssignees = Array.from(new Set(dataRows.map(row => String(row[assigneeIndex] || '').trim()).filter(Boolean)));
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeNames = new Set((teamMembers || []).filter(isActiveMember).map(m => m?.name).filter(Boolean));

    const totals = new Map();
    dataRows.forEach(row => {
        const rawAssignee = String(row[assigneeIndex] || '').trim();
        if (!rawAssignee) return;
        const canonical = aliasMap.get(rawAssignee) || rawAssignee;
        if (activeNames.size && !activeNames.has(canonical)) return;
        const status = String(row[statusIndex] || '').trim();
        if (!status || status.toLowerCase() !== 'done') return;
        const points = Number(String(row[pointsIndex] || '').replace(',', '.')) || 0;
        if (!Number.isFinite(points) || points <= 0) return;
        totals.set(canonical, (totals.get(canonical) || 0) + points);
    });
    return totals;
}

// ─── Benchmark harness ──────────────────────────────────────────────────────

function bench(name, iterations, fn) {
    // Warmup
    for (let i = 0; i < Math.min(3, iterations); i++) fn();

    const times = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const total = times.reduce((s, t) => s + t, 0);
    const avg = total / times.length;
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const min = times[0];
    const max = times[times.length - 1];
    return { name, iterations, avg, median, p95, min, max, total };
}

function fmtMs(n) {
    return n < 1 ? `${(n * 1000).toFixed(0)}µs` : `${n.toFixed(3)}ms`;
}

function printResults(results) {
    const nameW = Math.max(...results.map(r => r.name.length), 4);
    const header = `${'FUNCTION'.padEnd(nameW)}  ${'ITERS'.padStart(5)}  ${'AVG'.padStart(9)}  ${'MEDIAN'.padStart(9)}  ${'P95'.padStart(9)}  ${'MIN'.padStart(9)}  ${'MAX'.padStart(9)}`;
    console.log('\n' + '─'.repeat(header.length));
    console.log(header);
    console.log('─'.repeat(header.length));
    for (const r of results) {
        console.log(
            `${r.name.padEnd(nameW)}  ${String(r.iterations).padStart(5)}  ${fmtMs(r.avg).padStart(9)}  ${fmtMs(r.median).padStart(9)}  ${fmtMs(r.p95).padStart(9)}  ${fmtMs(r.min).padStart(9)}  ${fmtMs(r.max).padStart(9)}`
        );
    }
    console.log('─'.repeat(header.length));
    const worst = [...results].sort((a, b) => b.avg - a.avg);
    console.log('\n⚠️  WORST PERFORMERS (by avg):');
    worst.slice(0, 3).forEach((r, i) => console.log(`  ${i + 1}. ${r.name}: avg=${fmtMs(r.avg)}, p95=${fmtMs(r.p95)}`));
}

// ─── Load test data ─────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
const CSV_DIR = path.join(DATA_DIR, 'sprints-csv');

const teamData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'team.json'), 'utf8'));
const teamMembers = teamData.team || [];
explicitAssigneeAliases = buildExplicitAliasMapFromTeam(teamMembers);

const csvFiles = fs.readdirSync(CSV_DIR)
    .filter(f => f.endsWith('.csv'))
    .map(f => ({ name: f, text: fs.readFileSync(path.join(CSV_DIR, f), 'utf8') }));

// Pre-parse all CSVs
const parsedCsvs = csvFiles.map(({ name, text }) => ({
    name,
    text,
    rows: parseCsv(text).filter(row => row.some(cell => String(cell || '').trim().length > 0))
}));

// Use the largest CSV for single-file benchmarks
const largest = parsedCsvs.reduce((best, cur) => cur.rows.length > best.rows.length ? cur : best);
console.log(`\nLoaded ${csvFiles.length} CSV files. Using "${largest.name}" (${largest.rows.length} rows) for single-file benchmarks.`);
console.log(`Team members: ${teamMembers.length}`);

// Extract unique assignees from the largest CSV for alias map benchmarks
const largestHeader = largest.rows[0]?.map(c => String(c || '').trim()) || [];
const largestAssigneeIdx = getAssigneeIndex(largestHeader);
const largestCsvAssignees = largestAssigneeIdx >= 0
    ? Array.from(new Set(largest.rows.slice(1).map(r => String(r[largestAssigneeIdx] || '').trim()).filter(Boolean)))
    : [];

// ─── Run benchmarks ─────────────────────────────────────────────────────────

const ITERS = 500;
const results = [];

console.log('\nRunning benchmarks...\n');

// 1. parseCsv — raw text parsing
results.push(bench('parseCsv (largest CSV)', ITERS, () => {
    parseCsv(largest.text);
}));

// 2. normalizeName — called many times per sprint switch
results.push(bench('normalizeName (×100 names)', ITERS, () => {
    for (const m of teamMembers) normalizeName(m.name || '');
    for (const a of largestCsvAssignees) normalizeName(a);
}));

// 3. buildAssigneeAliasMap — called 4+ times per sprint switch
results.push(bench('buildAssigneeAliasMap', ITERS, () => {
    buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
}));

// 4. buildAssigneeAliasMap × 4 — simulates a single sprint switch
results.push(bench('buildAssigneeAliasMap ×4 (1 sprint switch)', ITERS, () => {
    buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
    buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
    buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
    buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
}));

// 5. buildTrendDataFromCsvRows
results.push(bench('buildTrendDataFromCsvRows', ITERS, () => {
    buildTrendDataFromCsvRows(largest.rows, teamMembers);
}));

// 6. buildMemberDatasetsFromCsvRows
results.push(bench('buildMemberDatasetsFromCsvRows', ITERS, () => {
    buildMemberDatasetsFromCsvRows(largest.rows, teamMembers);
}));

// 7. buildStatusTotalsFromCsvRows
results.push(bench('buildStatusTotalsFromCsvRows', ITERS, () => {
    buildStatusTotalsFromCsvRows(largest.rows, teamMembers);
}));

// 8. buildStoryPointMatrixFromCsvRows
results.push(bench('buildStoryPointMatrixFromCsvRows', ITERS, () => {
    buildStoryPointMatrixFromCsvRows(largest.rows, teamMembers);
}));

// 9. buildLabelMapFromCsv
const aliasMapForLabel = buildAssigneeAliasMap(teamMembers, largestCsvAssignees);
results.push(bench('buildLabelMapFromCsv', ITERS, () => {
    buildLabelMapFromCsv(largest.rows, aliasMapForLabel);
}));

// 10. buildMemberDoneTotalsFromCsvRows
results.push(bench('buildMemberDoneTotalsFromCsvRows', ITERS, () => {
    buildMemberDoneTotalsFromCsvRows(largest.rows, teamMembers);
}));

// 11. All-sprints sequential processing (simulates loadCsvStatusSummaryForAllSprints data phase)
results.push(bench('buildStatusTotals × all sprints (sequential)', 100, () => {
    for (const { rows } of parsedCsvs) {
        buildStatusTotalsFromCsvRows(rows, teamMembers);
    }
}));

// 12. Full sprint-switch pipeline (all data transforms, no DOM)
results.push(bench('Full sprint-switch pipeline (no DOM)', ITERS, () => {
    buildTrendDataFromCsvRows(largest.rows, teamMembers);
    buildMemberDatasetsFromCsvRows(largest.rows, teamMembers);
    buildStoryPointMatrixFromCsvRows(largest.rows, teamMembers);
    buildMemberDoneTotalsFromCsvRows(largest.rows, teamMembers);
}));

printResults(results);

// ─── Profiling annotations ───────────────────────────────────────────────────
console.log('\n📊 PROFILING NOTES:');
console.log('  • buildAssigneeAliasMap is called 4+ times per sprint switch.');
console.log('    It calls normalizeName() on every team member on every invocation.');
console.log('  • buildTrendDataFromCsvRows + buildMemberDatasetsFromCsvRows each call');
console.log('    buildAssigneeAliasMap independently, rebuilding the same alias map.');
console.log('  • parseCsvDate() is called once per data row (up to 78 times) per function.');
console.log('  • renderCsvTable / renderStoryPointMatrix use createElement per cell');
console.log('    (~60 rows × 19 cols = 1,140 DOM ops per table render) — not benchmarked');
console.log('    here (requires browser), but visible in Chrome DevTools > Performance.');
console.log('\n💡 BROWSER DEVTOOLS GUIDE:');
console.log('  1. Open Chrome DevTools → Performance tab');
console.log('  2. Click Record, then switch sprints 2–3 times, then Stop.');
console.log('  3. In the flame chart, look for long tasks (red corner = > 50ms).');
console.log('  4. Expected hot spots:');
console.log('     - renderCsvTable / innerHTML manipulation');
console.log('     - buildAssigneeAliasMap (called 4x, each rebuilds normalizeName loop)');
console.log('     - Chart.js destroy() + new Chart() calls');
