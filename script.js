const statusColorMap = {
    'To Do': '#6ec5ff',
    'In Review': '#f5d469',
    'In Progress': '#4b8cff',
    'Done': '#1fce88'
};
const statusOrder = ['To Do', 'In Progress', 'In Review', 'Done'];
const storyPointSizeMap = new Map([
    [1, 'XS'],
    [2, 'S'],
    [3, 'M'],
    [5, 'L'],
    [8, 'XL']
]);
const storyPointSizeOrder = ['XS', 'S', 'M', 'L', 'XL'];
const storyPointSizeColorMap = {
    XS: '#9fd7ff',
    S: '#5fa8ff',
    M: '#f5d469',
    L: '#f0a74f',
    XL: '#e65b5b'
};
let sprintTrendChart = null;
let sprintMemberChart = null;
let sprintSummaryChart = null;
let memberSummaryChart = null;
let sprint3SummaryChart = null;
const memberPalette = ['#c9a85c', '#4b8cff', '#6ec5ff', '#f5d469', '#ff5f56', '#7de1c3'];
let statusChartInstance = null;
let teamCache = [];
const memberStatusCharts = new Map();
const excludedAverageNames = ['Guillermo Malagón'];
const isActiveMember = (member = {}) => member?.active !== false;
const getActiveMembers = (members = []) => (members || []).filter(isActiveMember);
let labelMapByAssigneeCurrent = new Map();
let labelMapByAssigneeTotal = new Map();
let isCurrentLabelsReady = false;
let isTotalLabelsReady = false;
const csvTableState = {
    header: [],
    rows: [],
    assigneeIndex: -1,
    assigneeAliases: new Map(),
    statusIndex: -1
};
let explicitAssigneeAliases = new Map();

const trendDeltaLabelPlugin = {
    id: 'trendDeltaLabelPlugin',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const pluginOptions = chart.options?.plugins?.trendDeltaLabelPlugin || {};
        const showLastPointValue = pluginOptions.showLastPointValue === true;
        const showLastPointTotal = pluginOptions.showLastPointTotal === true;
        ctx.save();
        ctx.font = 'bold 11px Roboto Condensed';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            if (dataset?.hideTrendDeltaLabel) return;
            const meta = chart.getDatasetMeta(datasetIndex);
            if (meta?.hidden) return;
            const data = dataset.data || [];
            meta.data.forEach((point, idx) => {
                if (!point || data[idx] == null) return;
                const current = Number(data[idx]) || 0;
                const prev = idx > 0 ? Number(data[idx - 1]) || 0 : null;
                const isLastPoint = idx === data.length - 1;
                let label;
                if (isLastPoint && (showLastPointValue || showLastPointTotal)) {
                    const lastValue = showLastPointTotal
                        ? Number(dataset.totals?.[idx])
                        : current;
                    label = Number.isFinite(lastValue) ? `${lastValue}` : `${current}`;
                } else {
                    label = '—';
                    if (prev !== null) {
                        const diff = current - prev;
                        if (diff > 0) label = `+${diff}`;
                        else if (diff < 0) label = `${diff}`;
                        else label = '=';
                    }
                }
                ctx.fillStyle = dataset.borderColor || '#d7d7d7';
                ctx.fillText(label, point.x, point.y - 10);
            });
        });

        ctx.restore();
    }
};

function getNonZeroAverage(values = []) {
    const numeric = values.map(v => Number(v) || 0).filter(v => v > 0);
    if (!numeric.length) return 0;
    const sum = numeric.reduce((acc, n) => acc + n, 0);
    return sum / numeric.length;
}

function getSprintAveragesForIndex(chart, index) {
    if (!chart || index == null) return { doneAvg: null, totalAvg: null };
    const doneValues = [];
    const totalValues = [];

    (chart.data?.datasets || []).forEach(ds => {
        if (ds.excludeFromAverage) return;
        const done = Number(ds.data?.[index]) || 0;
        const total = Number(ds.totals?.[index]) || 0;
        if (done > 0) doneValues.push(done);
        if (total > 0) totalValues.push(total);
    });

    const doneAvg = doneValues.length ? getNonZeroAverage(doneValues) : null;
    const totalAvg = totalValues.length ? getNonZeroAverage(totalValues) : null;
    return { doneAvg, totalAvg };
}

// Status overview donut chart
const statusCtx = document.getElementById('statusChart');
if (statusCtx) {
    statusChartInstance = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: statusOrder,
            datasets: [{
                data: [35, 5, 6, 16],
                backgroundColor: [
                    statusColorMap['To Do'],
                    statusColorMap['In Progress'],
                    statusColorMap['In Review'],
                    statusColorMap['Done']
                ],
                borderWidth: 0,
                hoverOffset: 6,
                cutout: '62%'
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff'
                }
            }
        }
    });
}

const radarBaseConfig = {
    type: 'radar',
    options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            r: {
                beginAtZero: true,
                max: 10,
                ticks: {
                    stepSize: 2,
                    font: {
                        size: 10,
                        family: 'Roboto Condensed',
                        weight: 'bold'
                    },
                    color: '#666',
                    backdropColor: 'transparent'
                },
                pointLabels: {
                    font: {
                        size: 11,
                        weight: 'bold',
                        family: 'Roboto Condensed'
                    },
                    color: '#c9a85c'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                    circular: true
                },
                angleLines: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(26, 26, 26, 0.95)',
                titleColor: '#c9a85c',
                bodyColor: '#ffffff',
                borderColor: '#c9a85c',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                titleFont: {
                    family: 'Bebas Neue',
                    size: 14,
                    weight: 'normal'
                },
                bodyFont: {
                    family: 'Roboto Condensed',
                    size: 13,
                    weight: 'bold'
                },
                callbacks: {
                    label: function(context) {
                        const label = context.dataset?.label || 'Nivel';
                        return `${label}: ${context.parsed.r}/10`;
                    }
                }
            }
        },
        onHover: (event, activeElements) => {
            event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
        }
    }
};

function createRadarChart(canvas, labels, currentLevels, initialLevels) {
    const datasets = [{
        label: 'Actual',
        data: currentLevels,
        backgroundColor: 'rgba(201, 168, 92, 0.15)',
        borderColor: '#c9a85c',
        borderWidth: 2.5,
        pointBackgroundColor: '#c9a85c',
        pointBorderColor: '#1a1a1a',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#c9a85c',
        pointHoverRadius: 7,
        fill: true
    }];

    if (Array.isArray(initialLevels) && initialLevels.length === labels.length) {
        datasets.push({
            label: 'Inicial',
            data: initialLevels,
            backgroundColor: 'rgba(201, 168, 92, 0.04)',
            borderColor: 'rgba(201, 168, 92, 0.55)',
            borderWidth: 1.6,
            borderDash: [6, 6],
            pointBackgroundColor: 'rgba(201, 168, 92, 0.6)',
            pointBorderColor: '#0f0f0f',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false
        });
    }

    return new Chart(canvas, {
        ...radarBaseConfig,
        data: {
            labels,
            datasets
        }
    });
}

function createMiniDonut(canvasId, labels, counts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const total = counts.reduce((sum, n) => sum + n, 0);
    const totalEl = document.querySelector(`[data-total-for="${canvasId}"]`);
    if (totalEl) totalEl.textContent = total;

    const colors = labels.map(label => statusColorMap[label] || '#6ec5ff');

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4,
                cutout: '60%'
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff'
                }
            }
        }
    });
}

function setupSkillInteractions(card, chart) {
    const tags = card.querySelectorAll('.skills-legend .skill-tag');
    const radarCanvas = card.querySelector('.chart-container canvas');
    const basePointStyles = chart.data.datasets.map(ds => ({
        radius: ds.pointRadius || 5,
        bg: ds.pointBackgroundColor || '#c9a85c',
        border: ds.pointBorderColor || '#1a1a1a',
        borderWidth: ds.pointBorderWidth || 2
    }));

    const setPointState = (skillIndex = null) => {
        chart.data.datasets.forEach((_, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            const base = basePointStyles[datasetIndex] || {};

            meta.data.forEach((point, index) => {
                const isActive = skillIndex === index;
                point.options.pointRadius = isActive ? (base.radius + 3) : base.radius;
                point.options.pointBackgroundColor = isActive ? '#ffffff' : base.bg;
                point.options.pointBorderColor = isActive ? '#c9a85c' : base.border;
                point.options.pointBorderWidth = isActive ? 3 : base.borderWidth;
            });
        });
        chart.update('none');
    };

    const highlight = (skillIndex) => {
        setPointState(skillIndex);
    };

    const resetHighlight = () => {
        setPointState(null);
        chart.setActiveElements([]);
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
    };

    const activateTooltip = (index) => {
        const activeElements = chart.data.datasets.map((_, datasetIndex) => ({
            datasetIndex,
            index
        }));
        chart.setActiveElements(activeElements);
        chart.tooltip.setActiveElements(activeElements, { x: 0, y: 0 });
        chart.update('none');
    };

    tags.forEach((tag, tagIndex) => {
        tag.addEventListener('click', () => {
            const wasActive = tag.classList.contains('active');
            tags.forEach(t => t.classList.remove('active'));

            if (!wasActive) {
                tag.classList.add('active');
                highlight(tagIndex);
                activateTooltip(tagIndex);
            } else {
                resetHighlight();
            }
        });

        tag.addEventListener('mouseenter', () => {
            if (!tag.classList.contains('active')) {
                highlight(tagIndex);
            }
        });

        tag.addEventListener('mouseleave', () => {
            if (!tag.classList.contains('active')) {
                resetHighlight();
            }
        });
    });

    if (radarCanvas) {
        radarCanvas.addEventListener('click', (e) => {
            const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
            if (points.length > 0) {
                const pointIndex = points[0].index;
                const wasActive = tags[pointIndex].classList.contains('active');

                tags.forEach(t => t.classList.remove('active'));

                if (!wasActive) {
                    tags[pointIndex].classList.add('active');
                    highlight(pointIndex);
                    activateTooltip(pointIndex);
                } else {
                    resetHighlight();
                }
            }
        });
    }
}

function setupCardToggle(card) {
    const toggle = card.querySelector('.card-toggle');
    const details = card.querySelector('.dev-details');
    const label = card.querySelector('.toggle-label');
    if (!toggle || !details || !label) return;

    const setState = (expanded) => {
        card.classList.toggle('collapsed', !expanded);
        details.hidden = !expanded;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        label.textContent = expanded ? 'Hide details' : 'More details';
    };

    setState(false);
    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        setState(!isExpanded);
    });
}

function buildStatusRows(labels, counts, memberName = '') {
    return labels.map((label, idx) => {
        const color = statusColorMap[label] || '#6ec5ff';
        const count = counts[idx] ?? 0;
        const dataAttr = memberName ? `data-member-status="${memberName}" data-status-key="${label}"` : '';
        return `
            <div class="mini-status-row">
                <span class="mini-status-dot" style="background:${color}"></span>
                <span class="mini-status-label">${label}</span>
                <span class="mini-status-value" ${dataAttr}>${count}</span>
            </div>
        `;
    }).join('');
}

function buildSkillTags(labels) {
    return labels.map(label => `<span class="skill-tag">${label}</span>`).join('');
}

function buildWordCloudTagsFromCounts(countsMap) {
    if (!countsMap || (countsMap instanceof Map && countsMap.size === 0)) {
        return '<span class="word-cloud-placeholder">Sin labels</span>';
    }

    const entries = countsMap instanceof Map
        ? Array.from(countsMap.entries())
        : Object.entries(countsMap || {});

    if (!entries.length) return '<span class="word-cloud-placeholder">Sin labels</span>';

    entries.sort((a, b) => b[1] - a[1]);
    const maxCount = entries[0]?.[1] || 1;

    return entries.map(([label, count]) => {
        const ratio = maxCount ? count / maxCount : 0;
        let size = 'sm';
        if (ratio >= 0.75) size = 'xl';
        else if (ratio >= 0.5) size = 'lg';
        else if (ratio >= 0.25) size = 'md';
        return `<span class="word-cloud-tag word-cloud-tag--${size}">${label}</span>`;
    }).join('');
}

function getWordCloudMarkupForMember(name = '', mode = 'current') {
    const isTotal = mode === 'total';
    const map = isTotal ? labelMapByAssigneeTotal : labelMapByAssigneeCurrent;
    const isReady = isTotal ? isTotalLabelsReady : isCurrentLabelsReady;
    if (!isReady || !map || map.size === 0) {
        return '<span class="word-cloud-placeholder">Cargando labels...</span>';
    }
    return buildWordCloudTagsFromCounts(map.get(name));
}

function normalizeSkillData(skills = {}) {
    const labels = skills.labels || [];
    const currentLevels = skills.levels || skills.current || [];
    let initialLevels = skills.initialLevels || skills.initial || [];

    if (!Array.isArray(initialLevels) || initialLevels.length !== labels.length) {
        initialLevels = labels.map((_, idx) => {
            const current = Number(currentLevels[idx]) || 0;
            return Math.max(1, current - 2);
        });
    }

    return { labels, currentLevels, initialLevels };
}

const badgeAssets = {
    js: 'images/badges/js.svg',
    dotnet: 'images/badges/dotnet.svg',
    net: 'images/badges/dotnet.svg',
    fire: 'images/badges/fire.svg',
    diamond: 'images/badges/diamond.svg',
    aws: 'images/badges/aws.svg',
    laravel: 'images/badges/laravel.svg',
    swift: 'images/badges/swift.svg',
    android: 'images/badges/android.svg',
    e2e: 'images/badges/e2e.svg',
    cypress: 'images/badges/cypress.svg',
    jira: 'images/badges/jira.svg',
    confluence: 'images/badges/confluence.svg',
    dotnet: 'images/badges/dotnet.svg'
};

function buildBadges(badges = []) {
    const list = badges.length ? badges : ['js'];
    const columnsClass = list.length > 4 ? 'dev-badges dev-badges--two' : 'dev-badges';
    const items = list.map(key => {
        const normalized = (key || '').toString().toLowerCase();
        const src = badgeAssets[normalized];
        if (src) {
            return `<span class="dev-badge"><img src="${src}" alt="Badge ${key}"></span>`;
        }
        return `<span class="dev-badge dev-badge--text">${key}</span>`;
    }).join('');
    return `<div class="${columnsClass}">${items}</div>`;
}

function getAvatarPaths(member = {}) {
    const hero = (member.hero || '').toString().toLowerCase();
    const level = Number(member.level) || 10;
    const folder = hero ? `images/avatar/${hero}` : (member.avatarFolder || '');
    const main = folder ? `${folder}/${level}.png` : (member.avatar || '');
    const circle = folder ? `${folder}/circle.png` : (member.avatar ? member.avatar.replace(/[^/]+$/, 'circle.png') : '');
    return { folder, main, circle };
}

function renderWorkload(team = [], taskOverride = {}) {
    const container = document.getElementById('workload-list');
    if (!container) return;

    const normalized = (team || []).map(member => {
        const paths = getAvatarPaths(member);
        const overrideTasks = taskOverride[member.name];
        const counts = (member.status?.counts || []).map(n => Number(n) || 0);
        const defaultTasks = counts.reduce((sum, n) => sum + n, 0);
        const tasks = typeof overrideTasks === 'number' ? overrideTasks : defaultTasks;
        const color = member.color || '#c9a85c';
        return {
            name: member.name || 'Unassigned',
            role: member.role || '',
            avatarMain: paths.main,
            avatarCircle: paths.circle,
            color,
            tasks
        };
    });

    const totalTasks = normalized.reduce((sum, member) => sum + member.tasks, 0);
    const safeTotal = totalTasks > 0 ? totalTasks : 1;
    normalized.sort((a, b) => (b.tasks || 0) - (a.tasks || 0));

    const rows = normalized.map(member => {
        const percent = member.tasks ? Math.round((member.tasks / safeTotal) * 100) : 0;
        const percentLabel = member.tasks ? `${percent}%` : '...';
        const initial = (member.name || '?').charAt(0).toUpperCase();
        const avatarSrc = member.avatarCircle || member.avatarMain;
        const avatar = avatarSrc
            ? `<div class="workload-avatar" style="--avatar-border:${member.color};"><img src="${avatarSrc}" alt="${member.name}"></div>`
            : `<div class="workload-avatar workload-avatar--fallback" style="--avatar-border:${member.color};">${initial}</div>`;

        return `
            <div class="workload-row">
                <div class="workload-person">
                    ${avatar}
                    <div>
                        <div class="workload-name">${member.name}</div>
                        <div class="workload-role">${member.role || 'Contributor'}</div>
                    </div>
                </div>
                <div class="workload-progress">
                    <span class="workload-percent">${percentLabel}</span>
                    <div class="workload-bar">
                        <span class="workload-bar-fill" style="width:${percent}%;"></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = rows || '<p class="workload-desc">No workload data available.</p>';
}

async function loadTeam() {
    const teamGrid = document.getElementById('team-grid');

    const fallbackData = {
        team: [
            {
                name: 'Samil Vargas',
                role: 'Senior Full Stack Developer',
                hero: 'dexter',
                level: 10,
                color: '#c9a85c',
                badges: ['fire', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [9, 9, 9, 8, 7],
                    initialLevels: [7, 7, 8, 6, 5]
                },
                status: {
                    labels: ['To Do', 'In Progress', 'In Review', 'Done'],
                    counts: [8, 3, 2, 7]
                }
            },
            {
                name: 'Roberto Hiraldo',
                role: 'Senior Full Stack Developer',
                hero: 'darkowl',
                level: 10,
                color: '#4b8cff',
                badges: ['fire', 'js', 'android'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [8, 7, 8, 7, 8],
                    initialLevels: [6, 6, 6, 5, 6]
                },
                status: {
                    labels: ['To Do', 'In Progress', 'In Review', 'Done'],
                    counts: [6, 4, 1, 4]
                }
            },
            {
                name: 'Nicolás Díaz',
                role: 'Junior Developer',
                hero: 'deadpool',
                level: 10,
                color: '#6ec5ff',
                badges: ['diamond', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [7, 6, 7, 6, 5],
                    initialLevels: [5, 5, 5, 4, 4]
                },
                status: {
                    labels: ['To Do', 'In Progress', 'In Review', 'Done'],
                    counts: [5, 2, 1, 4]
                }
            },
            {
                name: 'Guillermo Malagón',
                role: 'Project manager',
                hero: 'hulk',
                level: 10,
                color: '#f5d469',
                badges: ['diamond', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [7, 6, 7, 6, 5],
                    initialLevels: [5, 5, 5, 4, 4]
                },
                status: {
                    labels: ['To Do', 'In Progress', 'In Review', 'Done'],
                    counts: [5, 2, 1, 4]
                }
            }
        ]
    };

    const renderTeam = (team = []) => {
        if (!teamGrid) return;
        teamGrid.innerHTML = '';

        team.forEach((member, index) => {
            const radarId = `chart-${index}`;
            const donutId = `devStatus-${index}`;
            const avatarPaths = getAvatarPaths(member);
            const skillData = normalizeSkillData(member.skills);
            const wordCloudMarkup = getWordCloudMarkupForMember(member.name);

            const card = document.createElement('div');
            card.className = 'developer-card';
            card.setAttribute('data-member-card', member.name || '');
            card.innerHTML = `
                <div class="dev-header">
                    <div class="dev-media">
                        ${buildBadges(member.badges)}
                        <div class="dev-image">
                            <img src="${avatarPaths.main}" alt="Avatar of ${member.name}">
                        </div>
                    </div>
                    <h2 class="dev-name">${member.name}</h2>
                    <span class="dev-level">${member.role}</span>
                </div>
                <button class="card-toggle" type="button" aria-expanded="false">
                    <span class="toggle-label">More details</span>
                    <span class="toggle-icon">▼</span>
                </button>
                <div class="dev-details">
                    <div class="word-cloud">
                        <div class="word-cloud-header">
                            <h4 class="word-cloud-title">Nube de Palabras</h4>
                            <button class="word-cloud-toggle" type="button" data-wordcloud-toggle>
                                Ver acumulado
                            </button>
                        </div>
                        <div class="word-cloud-body">
                            ${wordCloudMarkup}
                        </div>
                    </div>
                    <div class="mini-metrics-card">
                        <h4 class="mini-status-title">Velocity</h4>
                        <div class="mini-metric-row">
                            <span class="mini-metric-label" data-member-velocity-label>Sprint Vel.</span>
                            <span class="mini-metric-value" data-member-velocity="${member.name}">0</span>
                        </div>
                    </div>
                    <div class="mini-status-card">
                        <h4 class="mini-status-title">Work Status</h4>
                        <div class="mini-donut">
                            <div class="mini-donut-wrap">
                                <canvas id="${donutId}"></canvas>
                                <div class="mini-donut-center">
                                    <div class="mini-donut-total" data-total-for="${donutId}"></div>
                                    <div class="mini-donut-sub">tasks</div>
                                </div>
                            </div>
                        </div>
                        <div class="mini-status-legend">
                            ${buildStatusRows(member.status.labels, member.status.counts, member.name)}
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="${radarId}"></canvas>
                    </div>
                    <div class="radar-legend">
                        <span class="radar-pill radar-pill--current">Actual</span>
                        <span class="radar-pill radar-pill--initial">Inicial</span>
                    </div>
                    <div class="skills-legend">
                        ${buildSkillTags(skillData.labels)}
                    </div>
                </div>
            `;

            teamGrid.appendChild(card);
            card.dataset.wordcloudMode = 'current';

            const wordCloudToggle = card.querySelector('[data-wordcloud-toggle]');
            if (wordCloudToggle) {
                wordCloudToggle.addEventListener('click', () => {
                    const currentMode = card.dataset.wordcloudMode || 'current';
                    const nextMode = currentMode === 'current' ? 'total' : 'current';
                    card.dataset.wordcloudMode = nextMode;
                    wordCloudToggle.textContent = nextMode === 'current'
                        ? 'Ver acumulado'
                        : 'Ver sprint';
                    updateWordClouds();
                });
            }

            const radarChart = createRadarChart(
                card.querySelector(`#${radarId}`),
                skillData.labels,
                skillData.currentLevels,
                skillData.initialLevels
            );

            const donutChart = createMiniDonut(donutId, member.status.labels, member.status.counts);
            setupSkillInteractions(card, radarChart);
            setupCardToggle(card);

            const totalEl = card.querySelector(`[data-total-for="${donutId}"]`);
            const statusNodes = card.querySelectorAll(`[data-member-status="${member.name}"]`);
            memberStatusCharts.set(member.name, { chart: donutChart, totalEl, statusNodes });
        });
    };

    try {
        const response = await fetch('./data/team.json');
        const data = await response.json();
        const team = data.team || [];
        const finalTeam = team.length ? team : fallbackData.team;
        explicitAssigneeAliases = buildExplicitAliasMapFromTeam(finalTeam);
        const activeTeam = getActiveMembers(finalTeam);
        renderTeam(activeTeam);
        renderWorkload(activeTeam);
        teamCache = activeTeam;
    } catch (error) {
        console.error('Error loading team data:', error);
        const activeFallback = getActiveMembers(fallbackData.team);
        renderTeam(activeFallback);
        renderWorkload(activeFallback);
        teamCache = activeFallback;
    }
}

loadTeam().then(() => {
    loadSprintTrends();
});

async function loadSprintTrends() {
    const selectEl = document.getElementById('globalSprintSelect');
    const chartCanvas = document.getElementById('sprintTrendChart');
    if (!selectEl || !chartCanvas) return;

    try {
        const [metaResponse, dataResponse] = await Promise.all([
            fetch('./data/sprints.json'),
            fetch('./data/sprint_story_points.json')
        ]);
        const metaData = metaResponse.ok ? await metaResponse.json() : {};
        const data = dataResponse.ok ? await dataResponse.json() : {};
        const sprintMeta = metaData.sprints || [];
        const sprints = data.sprints || [];
        if (!sprintMeta.length) {
            console.error('No sprint metadata found in sprints.json');
            return;
        }

        const optionsSource = sprintMeta;
        const optionsHtml = optionsSource.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
        selectEl.value = String(optionsSource.length - 1);

        if (sprints.length) {
            renderSprintSummaries(sprints);
            loadSprint3SummaryChart(sprintMeta, teamCache);
        }

        const resolveSprintData = (idx) => {
            const metaEntry = optionsSource[idx] || null;
            if (!metaEntry) return { metaEntry: null, sprint: null };
            const matched = sprints.find(s => s.name === metaEntry.name) || null;
            return { metaEntry, sprint: matched };
        };

        const render = () => {
            const idx = Number(selectEl.value) || 0;
            const { metaEntry, sprint } = resolveSprintData(idx);
            updateMetricsForSprint(sprint);
            updateStatusOverview(sprint);
            updateWorkloadForSprint(sprint);
            updateMemberStatusesForSprint(sprint);
            updateMemberVelocityForSprint(sprint, sprints);
            if (metaEntry?.csvFile) {
                const csvPath = `./data/${metaEntry.csvFile}`;
                loadCsvTable(csvPath);
                loadCsvMemberTrendForSprint(csvPath, teamCache);
                loadCsvStoryPointMatrixForSprint(csvPath, teamCache);
            } else {
                loadCsvTable();
                loadCsvMemberTrendForSprint();
                loadCsvStoryPointMatrixForSprint(undefined, teamCache);
            }
        };

        if (!isTotalLabelsReady) {
            loadAccumulatedWordClouds(sprintMeta);
        }
        loadCsvStatusSummaryForAllSprints(sprintMeta, teamCache);

        selectEl.addEventListener('change', render);
        render();
    } catch (error) {
        console.error('Error loading sprint tasks:', error);
    }
}

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
            if (char === '"' && next === '"') {
                value += '"';
                i += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                value += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ',') {
            row.push(value);
            value = '';
            continue;
        }

        if (char === '\n') {
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
            continue;
        }

        if (char === '\r') {
            continue;
        }

        value += char;
    }

    if (value.length || row.length) {
        row.push(value);
        rows.push(row);
    }

    return rows;
}

const csvCache = new Map();

function buildCsvFetchUrls(csvPath = '') {
    const raw = String(csvPath || '').trim();
    if (!raw) return [];
    const encoded = encodeURI(raw);
    const encodedParens = encoded.replace(/[()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const urls = [encoded];
    if (encodedParens !== encoded) urls.push(encodedParens);
    return urls;
}

async function loadCsvRows(csvPath) {
    if (!csvPath) return [];
    if (csvCache.has(csvPath)) return csvCache.get(csvPath);

    const urls = buildCsvFetchUrls(csvPath);
    let response = null;
    let lastError = null;
    for (const url of urls) {
        try {
            const attempt = await fetch(url);
            if (attempt.ok) {
                response = attempt;
                break;
            }
            lastError = new Error(`HTTP ${attempt.status}`);
        } catch (error) {
            lastError = error;
        }
    }
    if (!response) throw lastError || new Error('CSV fetch failed');
    const text = await response.text();
    const rows = parseCsv(text).filter(row =>
        row.some(cell => String(cell || '').trim().length > 0)
    );
    if (!rows.length) {
        csvCache.set(csvPath, []);
        return [];
    }

    const maxCols = Math.max(...rows.map(r => r.length));
    const normalizedRows = rows.map(row => {
        if (row.length < maxCols) {
            return row.concat(Array(maxCols - row.length).fill(''));
        }
        return row;
    });

    csvCache.set(csvPath, normalizedRows);
    return normalizedRows;
}

function renderCsvTable(table, header, rows) {
    if (!table) return;
    const thead = table.querySelector('thead') || table.createTHead();
    const tbody = table.querySelector('tbody') || table.createTBody();

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const headerRow = document.createElement('tr');
    header.forEach((cell, idx) => {
        const th = document.createElement('th');
        th.textContent = cell || `Col ${idx + 1}`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        row.forEach((cell) => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function renderStoryPointMatrix(table, header, rows) {
    if (!table) return;
    const thead = table.querySelector('thead') || table.createTHead();
    const tbody = table.querySelector('tbody') || table.createTBody();

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!header.length) return;

    const headerRow = document.createElement('tr');
    header.forEach((cell, idx) => {
        const th = document.createElement('th');
        th.textContent = cell || `Col ${idx + 1}`;
        if (idx === 0) th.classList.add('matrix-sticky');
        else th.classList.add('matrix-number');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        row.forEach((cell, idx) => {
            if (idx === 0) {
                const th = document.createElement('th');
                th.textContent = cell;
                th.classList.add('matrix-sticky');
                tr.appendChild(th);
            } else {
                const td = document.createElement('td');
                td.textContent = cell;
                td.classList.add('matrix-number');
                const numericVal = Number(cell) || 0;
                if (numericVal > 0) td.classList.add('matrix-cell--hot');
                tr.appendChild(td);
            }
        });
        tbody.appendChild(tr);
    });
}

function buildLabelMapFromCsv(rows = [], aliasMap = new Map()) {
    if (!rows.length) return new Map();

    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = header.findIndex(
        cell => cell.toLowerCase() === 'assignee'
    );
    const labelIndexes = header
        .map((cell, idx) => cell.toLowerCase().startsWith('labels') ? idx : -1)
        .filter(idx => idx >= 0);

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

function sortStoryPointValues(values = []) {
    return values.sort((a, b) => {
        const aLabel = String(a || '').trim();
        const bLabel = String(b || '').trim();
        const aLower = aLabel.toLowerCase();
        const bLower = bLabel.toLowerCase();
        const aMissing = aLower === 'sin estimar';
        const bMissing = bLower === 'sin estimar';
        if (aMissing && !bMissing) return 1;
        if (bMissing && !aMissing) return -1;

        const aNum = Number(aLabel.replace(',', '.'));
        const bNum = Number(bLabel.replace(',', '.'));
        const numericPattern = /^[0-9]+([.,][0-9]+)?$/;
        const aIsNum = Number.isFinite(aNum) && numericPattern.test(aLabel);
        const bIsNum = Number.isFinite(bNum) && numericPattern.test(bLabel);
        if (aIsNum && bIsNum) return aNum - bNum;
        if (aIsNum) return -1;
        if (bIsNum) return 1;
        return aLabel.localeCompare(bLabel, 'es', { numeric: true, sensitivity: 'base' });
    });
}

function formatStoryPointDisplayLabel(rawLabel = '') {
    const label = String(rawLabel || '').trim();
    if (!label) return label;
    if (label.toLowerCase() === 'sin estimar') return 'Sin estimar';

    const numericValue = Number(label.replace(',', '.'));
    if (!Number.isFinite(numericValue)) return label;

    const size = storyPointSizeMap.get(numericValue);
    const displayValue = Number.isInteger(numericValue) ? String(numericValue) : String(numericValue);
    if (!size) return label;
    return `${size} (${displayValue})`;
}

function buildStoryPointMatrixFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { header: [], rows: [], total: 0, reason: 'empty' };

    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = getAssigneeIndex(header);
    const statusIndex = getStatusIndex(header);
    const pointsIndex = getStoryPointIndex(header);

    if (assigneeIndex < 0 || pointsIndex < 0) {
        return { header: [], rows: [], total: 0, reason: 'missing-columns' };
    }

    const dataRows = rows.slice(1);
    const csvAssignees = assigneeIndex >= 0
        ? Array.from(new Set(
            dataRows
                .map(row => String(row[assigneeIndex] || '').trim())
                .filter(Boolean)
        ))
        : [];
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeMembers = getActiveMembers(teamMembers);
    const activeNames = activeMembers.map(member => member?.name).filter(Boolean);
    const activeNameSet = new Set(activeNames);

    const countsByMember = new Map();
    //const totalsByMember = new Map();
    //const totalsByMember = new Map();
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
            if (!status) return;
            if (status.toLowerCase() !== 'done') return;
        }

        const rawPoints = String(row[pointsIndex] || '').trim();
        const pointsLabel = rawPoints ? rawPoints : 'Sin estimar';
        storyPointSet.add(pointsLabel);

        const counts = countsByMember.get(canonical) || new Map();
        counts.set(pointsLabel, (counts.get(pointsLabel) || 0) + 1);
        countsByMember.set(canonical, counts);
        total += 1;
    });

    if (!storyPointSet.size || !countsByMember.size) {
        return { header: [], rows: [], total, reason: 'no-data' };
    }

    const sortedPoints = sortStoryPointValues(Array.from(storyPointSet));
    const extras = Array.from(countsByMember.keys()).filter(name => !activeNameSet.has(name));
    extras.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const allMembers = activeNames.concat(extras);

    const matrixRows = allMembers.map(name => {
        const counts = countsByMember.get(name) || new Map();
        const values = sortedPoints.map(point => counts.get(point) || 0);
        return [name, ...values];
    });

    const displayPoints = sortedPoints.map(formatStoryPointDisplayLabel);
    return { header: ['Miembro', ...displayPoints], rows: matrixRows, total };
}

function parseCsvDate(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const match = raw.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/);
    if (!match) return null;

    const day = Number(match[1]);
    const monthKey = match[2].toLowerCase();
    const yearRaw = match[3];
    const monthMap = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
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
        ? Array.from(new Set(
            dataRows
                .map(row => String(row[assigneeIndex] || '').trim())
                .filter(Boolean)
        ))
        : [];
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeNames = new Set((teamMembers || []).map(member => member?.name).filter(Boolean));

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

        const pointsValue = String(row[pointsIndex] || '').replace(',', '.');
        const points = Number(pointsValue) || 0;

        if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
        const acc = dateMap.get(dateKey);
        acc[status] = (acc[status] || 0) + points;
        seenStates.add(status);
    });

    if (!dateMap.size) return null;

    const labels = Array.from(dateMap.keys()).sort((a, b) => new Date(a) - new Date(b));
    const states = statusOrder.filter(s => seenStates.has(s)).concat(
        Array.from(seenStates).filter(s => !statusOrder.includes(s))
    );

    const datasets = states.map(state => {
        const color = statusColorMap[state] || '#6ec5ff';
        const data = labels.map(day => dateMap.get(day)?.[state] || 0);
        return {
            label: state,
            data,
            borderColor: color,
            backgroundColor: color + 'cc',
            borderWidth: 1.2,
            barPercentage: 0.7,
            categoryPercentage: 0.7,
            stack: 'status'
        };
    });

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
        ? Array.from(new Set(
            dataRows
                .map(row => String(row[assigneeIndex] || '').trim())
                .filter(Boolean)
        ))
        : [];
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeNames = new Set((teamMembers || []).map(member => member?.name).filter(Boolean));

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
        const pointsValue = String(row[pointsIndex] || '').replace(',', '.');
        const points = Number(pointsValue) || 0;
        counts[status] = (counts[status] || 0) + points;
        states.add(status);
    });

    return { counts, states: Array.from(states) };
}

function buildMemberDatasetsFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { labels: [], datasets: [] };

    const header = rows[0].map(cell => String(cell || '').trim());
    const headerLower = header.map(cell => cell.toLowerCase());
    const assigneeIndex = headerLower.findIndex(cell => cell === 'assignee');
    const statusIndex = headerLower.findIndex(cell => cell === 'status' || cell.includes('status'));
    const pointsIndex = headerLower.findIndex(cell => cell.includes('story point'));
    const updatedIndex = headerLower.findIndex(cell => cell === 'updated');

    if (assigneeIndex < 0 || statusIndex < 0 || pointsIndex < 0 || updatedIndex < 0) {
        return { labels: [], datasets: [] };
    }

    const dataRows = rows.slice(1);
    const csvAssignees = Array.from(new Set(
        dataRows
            .map(row => String(row[assigneeIndex] || '').trim())
            .filter(Boolean)
    ));
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
            const pointsValue = String(row[pointsIndex] || '').replace(',', '.');
            const points = Number(pointsValue) || 0;
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

        const pointsValue = String(row[pointsIndex] || '').replace(',', '.');
        const points = Number(pointsValue) || 0;
        if (!Number.isFinite(points) || points <= 0) return;

        datesSet.add(dateKey);
        if (!byMemberDate.has(canonical)) byMemberDate.set(canonical, new Map());
        const dateMap = byMemberDate.get(canonical);
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + points);
        totalsByMember.set(canonical, (totalsByMember.get(canonical) || 0) + points);
    });

    const labels = Array.from(datesSet).sort((a, b) => new Date(a) - new Date(b));
    const nameColorMap = Object.fromEntries((teamCache || []).map(m => [m.name, m.color]));

    const datasets = activeMembers.map((member, idx) => {
        const name = member?.name || `Member ${idx + 1}`;
        const color = nameColorMap[name] || member?.color || memberPalette[idx % memberPalette.length] || '#c9a85c';
        const perDate = byMemberDate.get(name) || new Map();
        let running = 0;
        const data = labels.map(day => {
            running += Number(perDate.get(day)) || 0;
            return running;
        });
        const total = totalsByMember.get(name) || 0;
        const totals = labels.map(() => total);

        return {
            label: name,
            data,
            totals,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#111',
            pointBorderColor: color,
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            fill: false
        };
    });

    return { labels, datasets };
}

async function loadCsvStatusSummaryForAllSprints(sprintMeta = [], teamMembers = []) {
    if (!Array.isArray(sprintMeta) || !sprintMeta.length) return;
    const chartCanvas = document.getElementById('sprintTrendChart');
    if (!chartCanvas) return;

    const labels = [];
    const countsBySprint = [];
    const seenStates = new Set();

    for (const entry of sprintMeta) {
        const name = entry?.name || 'Sprint';
        labels.push(name);
        const csvFile = entry?.csvFile ? `./data/${entry.csvFile}` : '';
        if (!csvFile) {
            countsBySprint.push({});
            continue;
        }
        try {
            const rows = await loadCsvRows(csvFile);
            const { counts, states } = buildStatusTotalsFromCsvRows(rows, teamMembers);
            countsBySprint.push(counts);
            states.forEach(state => seenStates.add(state));
        } catch (error) {
            console.warn('CSV not found for sprint status summary:', csvFile, error);
            countsBySprint.push({});
        }
    }

    const states = statusOrder.filter(s => seenStates.has(s)).concat(
        Array.from(seenStates).filter(s => !statusOrder.includes(s))
    );

    const datasets = states.map(state => {
        const color = statusColorMap[state] || '#6ec5ff';
        const data = countsBySprint.map(counts => counts[state] || 0);
        return {
            label: state,
            data,
            borderColor: color,
            backgroundColor: color + 'cc',
            borderWidth: 1.2,
            barPercentage: 0.7,
            categoryPercentage: 0.7,
            stack: 'status'
        };
    });

    renderTrendChart(chartCanvas, labels, datasets);
}

async function loadCsvMemberTrendForSprint(csvPathOverride, teamMembers = []) {
    const chartCanvas = document.getElementById('memberTrendChart');
    if (!chartCanvas) return;

    try {
        const csvPath = csvPathOverride || './data/sprints-csv/Sprint Summary export (Jira).csv';
        const normalizedRows = await loadCsvRows(csvPath);
        const trendData = buildMemberDatasetsFromCsvRows(normalizedRows, teamMembers);
        renderMemberChart(chartCanvas, trendData.labels, trendData.datasets);
    } catch (error) {
        console.error('Error loading CSV member trend:', error);
    }
}

function updateWordClouds() {
    document.querySelectorAll('[data-member-card]').forEach(card => {
        const name = card.getAttribute('data-member-card') || '';
        const body = card.querySelector('.word-cloud-body');
        if (!body) return;
        const mode = card.dataset.wordcloudMode || 'current';
        body.innerHTML = getWordCloudMarkupForMember(name, mode);
    });
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
        .map(member => ({
            name: member?.name || '',
            normalized: normalizeName(member?.name || '')
        }))
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
            if (matches.length) {
                match = matches.sort((a, b) => b.normalized.length - a.normalized.length)[0];
            }
        }

        aliasMap.set(assignee, match ? match.name : assignee);
    });

    return aliasMap;
}

function getAssigneeIndex(header = []) {
    return header.findIndex(
        cell => String(cell || '').trim().toLowerCase() === 'assignee'
    );
}

function getStatusIndex(header = []) {
    return header.findIndex(
        cell => String(cell || '').trim().toLowerCase() === 'status'
    );
}

function getStoryPointIndex(header = []) {
    const normalized = header.map(cell => String(cell || '').trim().toLowerCase());
    const exact = normalized.findIndex(cell => cell === 'custom field (story point estimate)');
    if (exact >= 0) return exact;
    const estimate = normalized.findIndex(cell => cell.includes('story point estimate'));
    if (estimate >= 0) return estimate;
    return normalized.findIndex(cell => cell.includes('story point'));
}

function buildAssigneeOptions(selectEl, teamMembers = [], csvAssignees = [], aliasMap = new Map()) {
    if (!selectEl) return;
    const teamNames = (teamMembers || []).map(member => member?.name).filter(Boolean);
    const options = Array.from(new Set(teamNames)).sort((a, b) => a.localeCompare(b));
    const html = ['<option value="all">All</option>']
        .concat(options.map(name => `<option value="${name}">${name}</option>`))
        .join('');
    selectEl.innerHTML = html;
}

function buildStatusOptions(selectEl, statuses = []) {
    if (!selectEl) return;
    const options = Array.from(new Set(statuses)).sort((a, b) => a.localeCompare(b));
    const html = ['<option value="all">All</option>']
        .concat(options.map(status => `<option value="${status}">${status}</option>`))
        .join('');
    selectEl.innerHTML = html;
}

function filterCsvRowsByAssignee(rows = [], assigneeIndex, selected, aliasMap = new Map()) {
    if (!rows.length) return [];
    if (assigneeIndex < 0 || !selected || selected === 'all') return rows;
    return rows.filter(row => {
        const raw = String(row[assigneeIndex] || '').trim();
        const canonical = aliasMap.get(raw) || raw;
        return canonical === selected;
    });
}

function filterCsvRowsByStatus(rows = [], statusIndex, selected) {
    if (!rows.length) return [];
    if (statusIndex < 0 || !selected || selected === 'all') return rows;
    const selectedNorm = String(selected || '').trim().toLowerCase();
    return rows.filter(row => String(row[statusIndex] || '').trim().toLowerCase() === selectedNorm);
}

function applyCsvFilters() {
    const table = document.getElementById('csv-records-table');
    const messageEl = document.querySelector('[data-csv-message]');
    const countEl = document.querySelector('[data-csv-count]');
    const selectEl = document.querySelector('[data-csv-assignee]');
    const statusEl = document.querySelector('[data-csv-status]');
    if (!table) return;

    const selectedAssignee = selectEl?.value || 'all';
    const selectedStatus = statusEl?.value || 'all';
    const filteredByAssignee = filterCsvRowsByAssignee(
        csvTableState.rows,
        csvTableState.assigneeIndex,
        selectedAssignee,
        csvTableState.assigneeAliases
    );
    const filteredRows = filterCsvRowsByStatus(
        filteredByAssignee,
        csvTableState.statusIndex,
        selectedStatus
    );
    renderCsvTable(table, csvTableState.header, filteredRows);

    if (countEl) countEl.textContent = String(filteredRows.length);
    if (messageEl) {
        messageEl.style.display = filteredRows.length ? 'none' : 'block';
        messageEl.textContent = filteredRows.length ? '' : 'No hay registros para el filtro seleccionado.';
    }
}

function getPeriodEndDate(period = '') {
    const matches = String(period).match(/\\d{4}-\\d{2}-\\d{2}/g) || [];
    if (!matches.length) return null;
    const end = matches[matches.length - 1];
    const date = new Date(`${end}T23:59:59`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function mergeLabelMaps(target = new Map(), source = new Map()) {
    source.forEach((countsMap, assignee) => {
        const dest = target.get(assignee) || new Map();
        countsMap.forEach((count, label) => {
            dest.set(label, (dest.get(label) || 0) + count);
        });
        target.set(assignee, dest);
    });
    return target;
}

async function buildLabelMapForCsv(csvPath, teamMembers = []) {
    const normalizedRows = await loadCsvRows(csvPath);
    if (!normalizedRows.length) return new Map();

    const header = normalizedRows[0] || [];
    const dataRows = normalizedRows.slice(1);
    const assigneeIndex = getAssigneeIndex(header);
    const csvAssignees = assigneeIndex >= 0
        ? Array.from(new Set(
            dataRows
                .map(row => String(row[assigneeIndex] || '').trim())
                .filter(Boolean)
        ))
        : [];
    const assigneeAliases = buildAssigneeAliasMap(teamMembers, csvAssignees);
    return buildLabelMapFromCsv(normalizedRows, assigneeAliases);
}

async function loadAccumulatedWordClouds(sprintMeta = []) {
    if (!Array.isArray(sprintMeta) || !sprintMeta.length) return;
    const today = new Date();
    const eligible = sprintMeta.filter(entry => {
        const endDate = getPeriodEndDate(entry?.period);
        return !endDate || endDate <= today;
    });

    const csvFiles = Array.from(new Set(
        eligible
            .map(entry => entry?.csvFile)
            .filter(Boolean)
    ));

    const aggregate = new Map();
    for (const csvFile of csvFiles) {
        try {
            const map = await buildLabelMapForCsv(`./data/${csvFile}`, teamCache);
            mergeLabelMaps(aggregate, map);
        } catch (error) {
            console.warn('CSV not found for accumulated labels:', csvFile, error);
        }
    }

    labelMapByAssigneeTotal = aggregate;
    isTotalLabelsReady = true;
    updateWordClouds();
}

async function loadCsvTable(csvPathOverride) {
    const table = document.getElementById('csv-records-table');
    const messageEl = document.querySelector('[data-csv-message]');
    const countEl = document.querySelector('[data-csv-count]');
    const filterEl = document.querySelector('[data-csv-assignee]');
    const statusEl = document.querySelector('[data-csv-status]');
    if (!table) return;

    if (messageEl) messageEl.textContent = 'Cargando CSV...';

    try {
        const csvPath = csvPathOverride || './data/sprints-csv/Sprint Summary export (Jira).csv';
        const normalizedRows = await loadCsvRows(csvPath);
        if (!normalizedRows.length) {
            if (messageEl) messageEl.textContent = 'No hay registros disponibles.';
            if (countEl) countEl.textContent = '0';
            return;
        }

        const header = normalizedRows[0] || [];
        const dataRows = normalizedRows.slice(1);
        const assigneeIndex = getAssigneeIndex(header);
        const statusIndex = getStatusIndex(header);
        const csvAssignees = assigneeIndex >= 0
            ? Array.from(new Set(
                dataRows
                    .map(row => String(row[assigneeIndex] || '').trim())
                    .filter(Boolean)
            ))
            : [];
        const csvStatuses = statusIndex >= 0
            ? Array.from(new Set(
                dataRows
                    .map(row => String(row[statusIndex] || '').trim())
                    .filter(Boolean)
            ))
            : [];

        const assigneeAliases = buildAssigneeAliasMap(teamCache, csvAssignees);
        const activeNames = new Set((teamCache || []).map(member => member?.name).filter(Boolean));
        const filteredRows = assigneeIndex >= 0
            ? dataRows.filter(row => {
                const raw = String(row[assigneeIndex] || '').trim();
                const canonical = assigneeAliases.get(raw) || raw;
                return activeNames.has(canonical);
            })
            : dataRows;
        const filteredAssignees = assigneeIndex >= 0
            ? Array.from(new Set(
                filteredRows
                    .map(row => String(row[assigneeIndex] || '').trim())
                    .filter(Boolean)
            ))
            : [];
        const filteredStatuses = statusIndex >= 0
            ? Array.from(new Set(
                filteredRows
                    .map(row => String(row[statusIndex] || '').trim())
                    .filter(Boolean)
            ))
            : [];
        const normalizedFilteredRows = [header, ...filteredRows];

        csvTableState.header = header;
        csvTableState.rows = filteredRows;
        csvTableState.assigneeIndex = assigneeIndex;
        csvTableState.assigneeAliases = assigneeAliases;
        csvTableState.statusIndex = statusIndex;

        labelMapByAssigneeCurrent = buildLabelMapFromCsv(normalizedFilteredRows, assigneeAliases);
        isCurrentLabelsReady = true;
        updateWordClouds();

        buildAssigneeOptions(filterEl, teamCache, filteredAssignees, assigneeAliases);
        buildStatusOptions(statusEl, filteredStatuses.length ? filteredStatuses : csvStatuses);
        if (filterEl && !filterEl.dataset.bound) {
            filterEl.addEventListener('change', applyCsvFilters);
            filterEl.dataset.bound = 'true';
        }
        if (statusEl && !statusEl.dataset.bound) {
            statusEl.addEventListener('change', applyCsvFilters);
            statusEl.dataset.bound = 'true';
        }

        if (filterEl) filterEl.value = 'all';
        if (statusEl) {
            const hasDone = Array.from(statusEl.options || []).some(opt => opt.value === 'Done');
            statusEl.value = hasDone ? 'Done' : 'all';
        }
        applyCsvFilters();
    } catch (error) {
        console.error('Error loading CSV:', error);
        if (messageEl) messageEl.textContent = 'No se pudo cargar el CSV.';
    }
}

async function loadCsvStoryPointMatrixForSprint(csvPathOverride, teamMembers = []) {
    const table = document.getElementById('storypoint-matrix-table');
    const messageEl = document.querySelector('[data-matrix-message]');
    const countEl = document.querySelector('[data-matrix-count]');
    if (!table) return;

    if (messageEl) messageEl.textContent = 'Cargando matriz...';

    try {
        const csvPath = csvPathOverride || './data/sprints-csv/Sprint Summary export (Jira).csv';
        const normalizedRows = await loadCsvRows(csvPath);
        if (!normalizedRows.length) {
            renderStoryPointMatrix(table, [], []);
            if (messageEl) {
                messageEl.style.display = 'block';
                messageEl.textContent = 'No hay registros disponibles.';
            }
            if (countEl) countEl.textContent = '0';
            return;
        }

        const { header, rows, total, reason } = buildStoryPointMatrixFromCsvRows(normalizedRows, teamMembers);
        renderStoryPointMatrix(table, header, rows);
        if (countEl) countEl.textContent = String(total || 0);
        if (messageEl) {
            if (rows.length) {
                messageEl.style.display = 'none';
                messageEl.textContent = '';
            } else {
                messageEl.style.display = 'block';
                messageEl.textContent = reason === 'missing-columns'
                    ? 'No se encontraron las columnas de Assignee o Story point estimate en el CSV.'
                    : 'No hay tareas Done para este sprint.';
            }
        }
    } catch (error) {
        console.error('Error loading story point matrix:', error);
        renderStoryPointMatrix(table, [], []);
        if (messageEl) {
            messageEl.style.display = 'block';
            messageEl.textContent = 'No se pudo cargar la matriz.';
        }
        if (countEl) countEl.textContent = '0';
    }
}

function updateMetricsForSprint(sprint) {
    const completedEl = document.querySelector('[data-metric="completed"]');
    const updatedEl = document.querySelector('[data-metric="updated"]');
    if (!completedEl || !updatedEl || !sprint) return;

    let latestDate = null;
    getActiveMembers(sprint.members).forEach(member => {
        (member.statuses || []).forEach(entry => {
            if (!entry.date) return;
            if (!latestDate || new Date(entry.date) > new Date(latestDate)) {
                latestDate = entry.date;
            }
        });
    });

    let doneTotal = 0;
    let allTotal = 0;

    if (latestDate) {
        getActiveMembers(sprint.members).forEach(member => {
            const entry = (member.statuses || []).find(s => s.date === latestDate);
            if (!entry) return;
            Object.keys(entry).forEach(key => {
                if (key === 'date') return;
                const val = Number(entry[key]) || 0;
                allTotal += val;
                if (key === 'Done') doneTotal += val;
            });
        });
    }

    completedEl.textContent = doneTotal || '0';
    updatedEl.textContent = allTotal || '0';
}

function aggregateSprintData(sprint) {
    if (!sprint) return null;
    const dateMap = new Map();
    const seenStates = new Set();

    getActiveMembers(sprint.members).forEach(member => {
        (member.statuses || []).forEach(entry => {
            const day = entry.date;
            if (!day) return;
            if (!dateMap.has(day)) dateMap.set(day, {});
            const acc = dateMap.get(day);
            Object.keys(entry).forEach(key => {
                if (key === 'date') return;
                const value = Number(entry[key]) || 0;
                acc[key] = (acc[key] || 0) + value;
                seenStates.add(key);
            });
        });
    });

    const labels = Array.from(dateMap.keys()).sort((a, b) => new Date(a) - new Date(b));
    const states = statusOrder.filter(s => seenStates.has(s)).concat(
        Array.from(seenStates).filter(s => !statusOrder.includes(s))
    );

    const datasets = states.map(state => {
        const color = statusColorMap[state] || '#6ec5ff';
        const data = labels.map(day => dateMap.get(day)?.[state] || 0);
        return {
            label: state,
            data,
            borderColor: color,
            backgroundColor: color + 'cc',
            borderWidth: 1.2,
            barPercentage: 0.7,
            categoryPercentage: 0.7,
            stack: 'status'
        };
    });

    return { labels, datasets };
}

function renderTrendChart(canvas, labels, datasets) {
    if (!canvas) return;
    if (sprintTrendChart) {
        sprintTrendChart.destroy();
    }

    sprintTrendChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 26 }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#d7d7d7',
                        font: {
                            family: 'Roboto Condensed',
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#9e9e9e',
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        color: '#9e9e9e',
                        stepSize: 2,
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}

function findSprintByNumber(sprints = [], number = 0) {
    const regex = new RegExp(`\\bSprint\\s*${number}\\b`, 'i');
    return (sprints || []).find(entry => regex.test(entry?.name || '')) || null;
}

function getStoryPointSizeLabel(rawValue = '') {
    const numericValue = Number(String(rawValue || '').replace(',', '.'));
    if (!Number.isFinite(numericValue)) return null;
    return storyPointSizeMap.get(numericValue) || null;
}

function buildSprintMemberSizeDatasetsFromCsvRows(rows = [], teamMembers = []) {
    if (!rows.length) return { labels: [], datasets: [], reason: 'empty' };

    const header = rows[0].map(cell => String(cell || '').trim());
    const assigneeIndex = getAssigneeIndex(header);
    const pointsIndex = getStoryPointIndex(header);

    if (assigneeIndex < 0 || pointsIndex < 0) {
        return { labels: [], datasets: [], reason: 'missing-columns' };
    }

    const dataRows = rows.slice(1);
    const csvAssignees = Array.from(new Set(
        dataRows
            .map(row => String(row[assigneeIndex] || '').trim())
            .filter(Boolean)
    ));
    const aliasMap = buildAssigneeAliasMap(teamMembers, csvAssignees);
    const activeMembers = getActiveMembers(teamMembers);
    const activeNames = activeMembers.map(member => member?.name).filter(Boolean);
    const activeNameSet = new Set(activeNames);

    const countsByMember = new Map();

    dataRows.forEach(row => {
        const rawAssignee = String(row[assigneeIndex] || '').trim();
        if (!rawAssignee) return;
        const canonical = aliasMap.get(rawAssignee) || rawAssignee;
        if (activeNameSet.size && !activeNameSet.has(canonical)) return;

        const sizeLabel = getStoryPointSizeLabel(row[pointsIndex]);
        if (!sizeLabel) return;

        const counts = countsByMember.get(canonical) || new Map();
        counts.set(sizeLabel, (counts.get(sizeLabel) || 0) + 1);
        countsByMember.set(canonical, counts);
        totalsByMember.set(canonical, (totalsByMember.get(canonical) || 0) + 1);
    });

    const labels = ['Sprint 3'];
    const baseMembers = activeNames.length ? activeNames : Array.from(countsByMember.keys());
    const members = baseMembers.filter(name => (totalsByMember.get(name) || 0) > 0);
    if (!members.length && baseMembers.length) {
        members.push(...baseMembers);
    }
    const datasets = [];

    storyPointSizeOrder.forEach((size, sizeIndex) => {
        const color = storyPointSizeColorMap[size] || '#6ec5ff';
        members.forEach(member => {
            const counts = countsByMember.get(member) || new Map();
            const value = counts.get(size) || 0;
            datasets.push({
                label: size,
                legendKey: size,
                member,
                data: [value],
                borderColor: color,
                backgroundColor: color + 'cc',
                borderWidth: 1.2,
                barPercentage: 0.7,
                categoryPercentage: 0.7,
                stack: member,
                order: sizeIndex
            });
        });
    });

    return { labels, datasets, reason: datasets.length ? '' : 'no-data' };
}

function renderSprint3SummaryChart(canvas, labels, datasets) {
    if (!canvas) return;
    if (sprint3SummaryChart) {
        sprint3SummaryChart.destroy();
    }

    sprint3SummaryChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 16 }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#d7d7d7',
                        font: {
                            family: 'Roboto Condensed',
                            size: 12,
                            weight: 'bold'
                        },
                        generateLabels: chart => {
                            const defaults = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            const seen = new Set();
                            return defaults.filter(item => {
                                const ds = chart.data.datasets?.[item.datasetIndex] || {};
                                const key = ds.legendKey || ds.label || item.text;
                                if (seen.has(key)) return false;
                                item.text = key;
                                seen.add(key);
                                return true;
                            });
                        }
                    },
                    onClick: (event, legendItem, legend) => {
                        const chart = legend.chart;
                        const key = legendItem.text;
                        chart.data.datasets.forEach((ds, idx) => {
                            if ((ds.legendKey || ds.label) !== key) return;
                            const meta = chart.getDatasetMeta(idx);
                            meta.hidden = meta.hidden === null ? !chart.isDatasetVisible(idx) : null;
                        });
                        chart.update();
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: context => {
                            const member = context.dataset.member || 'Miembro';
                            return `${member} · ${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#9e9e9e',
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        color: '#9e9e9e',
                        stepSize: 2,
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}

async function loadSprint3SummaryChart(sprintMeta = [], teamMembers = []) {
    const messageEl = document.querySelector('[data-sprint3-message]');
    const canvas = document.getElementById('sprint3MemberStackedChart');
    if (!canvas) return;

    if (messageEl) {
        messageEl.textContent = 'Cargando resumen...';
        messageEl.style.display = 'block';
    }

    const sprint3Meta = findSprintByNumber(sprintMeta, 3);
    if (!sprint3Meta?.csvFile) {
        if (messageEl) {
            messageEl.textContent = 'No se encontró el CSV de Sprint 3 en sprints.json.';
            messageEl.style.display = 'block';
        }
        return;
    }

    try {
        //const rawFile = String(sprint3Meta.csvFile || '').trim().replace(/^\\.?\\/?data\\//, '');
        const rawFile = String(sprint3Meta.csvFile || '').trim().replace(/^\.?\/?data\//, '');

        const csvPath = `./data/${rawFile}`;
        const rows = await loadCsvRows(csvPath);
        const { labels, datasets, reason } = buildSprintMemberSizeDatasetsFromCsvRows(rows, teamMembers);
        if (!labels.length || !datasets.length) {
            if (messageEl) {
                messageEl.textContent = reason === 'missing-columns'
                    ? 'No se encontró la columna de Story point estimate en el CSV.'
                    : 'Sprint 3 no tiene datos para graficar.';
                messageEl.style.display = 'block';
            }
            return;
        }

        if (messageEl) {
            messageEl.textContent = '';
            messageEl.style.display = 'none';
        }
        renderSprint3SummaryChart(canvas, labels, datasets);
    } catch (error) {
        if (messageEl) {
            messageEl.textContent = 'No se pudo cargar el CSV de Sprint 3.';
            messageEl.style.display = 'block';
        }
    }
}

function getLatestStatusEntry(member = {}) {
    let latest = null;
    (member?.statuses || []).forEach(entry => {
        if (!entry.date) return;
        if (!latest || new Date(entry.date) > new Date(latest.date)) {
            latest = entry;
        }
    });
    return latest;
}

function formatVelocityValue(value) {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function getSprintDayCount(sprint) {
    const days = new Set();
    getActiveMembers(sprint?.members).forEach(member => {
        (member.statuses || []).forEach(entry => {
            if (entry?.date) days.add(entry.date);
        });
    });
    return days.size;
}

function updateMemberVelocityForSprint(sprint, sprints = []) {
    const velocityNodes = document.querySelectorAll('[data-member-velocity]');
    const velocityLabelNodes = document.querySelectorAll('[data-member-velocity-label]');
    if (!velocityNodes.length && !velocityLabelNodes.length) return;

    const sprintDays = getSprintDayCount(sprint);
    velocityLabelNodes.forEach(node => {
        node.textContent = `Sprint Vel. ( ${sprintDays} Days )`;
    });

    const doneByName = new Map();
    getActiveMembers(sprint?.members).forEach(member => {
        const latestEntry = getLatestStatusEntry(member);
        const done = Number(latestEntry?.['Done']) || 0;
        doneByName.set(member.name, done);
    });

    velocityNodes.forEach(node => {
        const name = node.getAttribute('data-member-velocity') || '';
        const done = doneByName.get(name) || 0;
        node.textContent = formatVelocityValue(done);
    });
}

function aggregateStatusBySprint(sprints = []) {
    const labels = [];
    const countsBySprint = [];
    const seenStates = new Set();

    sprints.forEach(sprint => {
        labels.push(sprint?.name || 'Sprint');
        const { counts } = computeSprintStatusCounts(sprint);
        countsBySprint.push(counts);
        Object.keys(counts).forEach(key => seenStates.add(key));
    });

    const states = statusOrder.filter(s => seenStates.has(s)).concat(
        Array.from(seenStates).filter(s => !statusOrder.includes(s))
    );

    const datasets = states.map(state => {
        const color = statusColorMap[state] || '#6ec5ff';
        const data = countsBySprint.map(counts => counts[state] || 0);
        return {
            label: state,
            data,
            borderColor: color,
            backgroundColor: color + 'cc',
            borderWidth: 1.2,
            barPercentage: 0.7,
            categoryPercentage: 0.7,
            stack: 'status-summary'
        };
    });

    return { labels, datasets };
}

function buildMemberSummaryDatasets(sprints = []) {
    const allNames = new Set();
    sprints.forEach(sprint => {
        getActiveMembers(sprint?.members).forEach(member => allNames.add(member.name));
    });

    const nameColorMap = Object.fromEntries((teamCache || []).map(m => [m.name, m.color]));

    return Array.from(allNames).map((name, idx) => {
        const color = nameColorMap[name] || memberPalette[idx % memberPalette.length] || '#c9a85c';
        const data = [];
        const totals = [];

        sprints.forEach(sprint => {
            const member = getActiveMembers(sprint?.members).find(m => m.name === name);
            const latestEntry = getLatestStatusEntry(member);
            const done = Number(latestEntry?.['Done']) || 0;
            const total = latestEntry
                ? Object.keys(latestEntry).reduce((sum, key) => {
                    if (key === 'date') return sum;
                    const val = Number(latestEntry[key]) || 0;
                    return sum + val;
                }, 0)
                : 0;

            data.push(done);
            totals.push(total);
        });

        const excludeFromAverage = excludedAverageNames.includes(name);
        const averageDone = excludeFromAverage ? null : getNonZeroAverage(data);
        const averageTotal = excludeFromAverage ? null : getNonZeroAverage(totals);

        return {
            label: name || `Member ${idx + 1}`,
            data,
            totals,
            excludeFromAverage,
            averageDone,
            averageTotal,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#111',
            pointBorderColor: color,
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            fill: false
        };
    });
}

function renderSprintSummaryChart(canvas, labels, datasets) {
    if (!canvas) return;
    if (sprintSummaryChart) {
        sprintSummaryChart.destroy();
    }

    sprintSummaryChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#d7d7d7',
                        font: {
                            family: 'Roboto Condensed',
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#9e9e9e',
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        color: '#9e9e9e',
                        stepSize: 2,
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}

function renderMemberSummaryChart(canvas, labels, datasets) {
    if (!canvas) return;
    if (memberSummaryChart) {
        memberSummaryChart.destroy();
    }

    memberSummaryChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        plugins: [trendDeltaLabelPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#d7d7d7',
                        font: {
                            family: 'Roboto Condensed',
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: context => {
                            const total = context.dataset.totals?.[context.dataIndex] ?? 0;
                            const avgDone = context.dataset.averageDone;
                            const avgTotal = context.dataset.averageTotal;
                            const { doneAvg, totalAvg } = getSprintAveragesForIndex(context.chart, context.dataIndex);
                            const formatNum = (n) => Number.isInteger(n) ? n : n.toFixed(1);
                            const lines = [
                                `${context.dataset.label}: ${context.parsed.y} of ${total} story points Done`
                            ];
                            if (avgDone != null && avgTotal != null) {
                                lines.push(`Average (no zeros): ${formatNum(avgDone)} of ${formatNum(avgTotal)} story points Done`);
                            }
                            if (doneAvg != null && totalAvg != null) {
                                lines.push(`Sprint average (no zeros): ${formatNum(doneAvg)} of ${formatNum(totalAvg)} story points Done`);
                            }
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#9e9e9e',
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    beginAtZero: true,
                    grace: '18%',
                    ticks: {
                        color: '#9e9e9e',
                        stepSize: 2,
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}

function renderSprintSummaries(sprints = []) {
    if (!Array.isArray(sprints) || !sprints.length) return;
    const statusData = aggregateStatusBySprint(sprints);
    const memberData = buildMemberSummaryDatasets(sprints);
    renderSprintSummaryChart(document.getElementById('sprintSummaryChart'), statusData.labels, statusData.datasets);
    renderMemberSummaryChart(document.getElementById('memberSummaryChart'), statusData.labels, memberData);
}

function computeSprintStatusCounts(sprint) {
    if (!sprint) return { counts: {}, total: 0, latestDate: null };

    let latestDate = null;
    getActiveMembers(sprint.members).forEach(member => {
        (member.statuses || []).forEach(entry => {
            if (!entry.date) return;
            if (!latestDate || new Date(entry.date) > new Date(latestDate)) {
                latestDate = entry.date;
            }
        });
    });

    const counts = {};
    if (latestDate) {
        getActiveMembers(sprint.members).forEach(member => {
            const entry = (member.statuses || []).find(s => s.date === latestDate);
            if (!entry) return;
            Object.keys(entry).forEach(key => {
                if (key === 'date') return;
                const val = Number(entry[key]) || 0;
                counts[key] = (counts[key] || 0) + val;
            });
        });
    }

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { counts, total, latestDate };
}

function computeSprintWorkload(sprint) {
    const { latestDate } = computeSprintStatusCounts(sprint);
    const tasksByName = {};
    if (!latestDate) return tasksByName;

    getActiveMembers(sprint.members).forEach(member => {
        const entry = (member.statuses || []).find(s => s.date === latestDate);
        if (!entry) return;
        const total = Object.keys(entry).reduce((sum, key) => {
            if (key === 'date') return sum;
            const val = Number(entry[key]) || 0;
            return sum + val;
        }, 0);
        tasksByName[member.name] = total;
    });

    return tasksByName;
}

function updateStatusOverview(sprint) {
    if (!statusChartInstance) return;
    const { counts, total } = computeSprintStatusCounts(sprint);
    const order = statusOrder;
    const dataset = statusChartInstance.data.datasets?.[0];
    if (dataset) {
        dataset.data = order.map(key => counts[key] || 0);
    }
    statusChartInstance.update();

    const totalEl = document.querySelector('[data-status-total]');
    if (totalEl) totalEl.textContent = total || 0;

    document.querySelectorAll('[data-status]').forEach(el => {
        const key = el.getAttribute('data-status');
        el.textContent = counts[key] || 0;
    });
}

function updateWorkloadForSprint(sprint) {
    if (!teamCache || !teamCache.length) return;
    const taskOverride = computeSprintWorkload(sprint);
    renderWorkload(teamCache, taskOverride);
}

function updateMemberStatusesForSprint(sprint) {
    if (!sprint || !teamCache.length) return;

    // Determine latest date per sprint (reusing workload logic)
    const latestByName = {};
    getActiveMembers(sprint.members).forEach(member => {
        let latestEntry = null;
        (member.statuses || []).forEach(entry => {
            if (!entry.date) return;
            if (!latestEntry || new Date(entry.date) > new Date(latestEntry.date)) {
                latestEntry = entry;
            }
        });
        if (latestEntry) latestByName[member.name] = latestEntry;
    });

    teamCache.forEach(member => {
        const meta = memberStatusCharts.get(member.name);
        if (!meta || !meta.chart) return;

        const entry = latestByName[member.name];
        const countsObj = entry || null;
        const counts = statusOrder.map(key => Number(countsObj?.[key]) || 0);
        const total = counts.reduce((sum, n) => sum + n, 0);

        meta.chart.data.datasets[0].data = counts;
        meta.chart.update();
        if (meta.totalEl) meta.totalEl.textContent = total;

        meta.statusNodes?.forEach(node => {
            const key = node.getAttribute('data-status-key');
            if (key) node.textContent = Number(countsObj?.[key]) || 0;
        });
    });
}

function buildMemberDatasets(sprint, labels) {
    const members = getActiveMembers(sprint?.members);
    const nameColorMap = Object.fromEntries((teamCache || []).map(m => [m.name, m.color]));
    return members.map((member, idx) => {
        const color = nameColorMap[member.name] || member.color || memberPalette[idx % memberPalette.length] || '#c9a85c';
        const lookup = new Map((member.statuses || []).map(entry => [entry.date, entry]));
        const totals = [];
        const data = labels.map(day => {
            const entry = lookup.get(day) || {};
            const done = Number(entry['Done']) || 0;
            const total = Object.keys(entry).reduce((sum, key) => {
                if (key === 'date') return sum;
                const val = Number(entry[key]) || 0;
                return sum + val;
            }, 0);
            totals.push(total);
            return done;
        });

        return {
            label: member.name || `Member ${idx + 1}`,
            data,
            totals,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#111',
            pointBorderColor: color,
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            fill: false
        };
    });
}

function renderMemberChart(canvas, labels, datasets) {
    if (!canvas) return;
    if (sprintMemberChart) {
        sprintMemberChart.destroy();
    }
    const chartDatasets = datasets;

    sprintMemberChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: chartDatasets },
        plugins: [trendDeltaLabelPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 26 }
            },
            plugins: {
                trendDeltaLabelPlugin: {
                    showLastPointValue: true
                },
                legend: {
                    labels: {
                        color: '#d7d7d7',
                        font: {
                            family: 'Roboto Condensed',
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    borderColor: '#c9a85c',
                    borderWidth: 1,
                    titleColor: '#c9a85c',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: context => {
                            const total = context.dataset.totals?.[context.dataIndex] ?? 0;
                            return `${context.dataset.label}: ${context.parsed.y} of ${total} story points Done`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#9e9e9e',
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    beginAtZero: true,
                    grace: '18%',
                    ticks: {
                        color: '#9e9e9e',
                        stepSize: 2,
                        font: {
                            family: 'Roboto Condensed',
                            size: 11,
                            weight: 'bold'
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}
