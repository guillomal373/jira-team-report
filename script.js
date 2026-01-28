const statusColorMap = {
    'To Do': '#6ec5ff',
    'In Review': '#f5d469',
    'In Progress': '#4b8cff',
    'Done': '#1fce88'
};
const statusOrder = ['To Do', 'In Progress', 'In Review', 'Done'];
let sprintTrendChart = null;
let sprintMemberChart = null;
let sprintSummaryChart = null;
let memberSummaryChart = null;
const memberPalette = ['#c9a85c', '#4b8cff', '#6ec5ff', '#f5d469', '#ff5f56', '#7de1c3'];
let statusChartInstance = null;
let teamCache = [];
const memberStatusCharts = new Map();
const excludedAverageNames = ['Guillermo Malagón'];
const isActiveMember = (member = {}) => member?.active !== false;
const getActiveMembers = (members = []) => (members || []).filter(isActiveMember);

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
    fire: 'images/badges/fire.svg',
    diamond: 'images/badges/diamond.svg',
    aws: 'images/badges/aws.svg',
    laravel: 'images/badges/laravel.svg',
    swift: 'images/badges/swift.svg',
    jira: 'images/badges/jira.svg',
    confluence: 'images/badges/confluence.svg'
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
                badges: ['fire', 'js'],
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
                    <div class="mini-metrics-card">
                        <h4 class="mini-status-title">Velocity</h4>
                        <div class="mini-metric-row">
                            <span class="mini-metric-label">Velocidad (Sprint)</span>
                            <span class="mini-metric-value" data-member-velocity="${member.name}">0</span>
                        </div>
                        <div class="mini-metric-row">
                            <span class="mini-metric-label">Velocidad promedio</span>
                            <span class="mini-metric-value" data-member-velocity-avg="${member.name}">0</span>
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
        const response = await fetch('./data/sprint_story_points.json');
        const data = await response.json();
        const sprints = data.sprints || [];
        if (!sprints.length) return;

        const optionsHtml = sprints.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
        selectEl.value = String(sprints.length - 1);

        renderSprintSummaries(sprints);

        const render = () => {
            const idx = Number(selectEl.value) || 0;
            const sprint = sprints[idx];
            const aggregated = aggregateSprintData(sprint);
            if (aggregated) {
                renderTrendChart(chartCanvas, aggregated.labels, aggregated.datasets);
                const memberData = buildMemberDatasets(sprint, aggregated.labels);
                renderMemberChart(document.getElementById('memberTrendChart'), aggregated.labels, memberData);
            }
            updateMetricsForSprint(sprint);
            updateStatusOverview(sprint);
            updateWorkloadForSprint(sprint);
            updateMemberStatusesForSprint(sprint);
            updateMemberVelocityForSprint(sprint, sprints);
        };

        selectEl.addEventListener('change', render);
        render();
    } catch (error) {
        console.error('Error loading sprint tasks:', error);
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

function buildAverageDoneMap(sprints = []) {
    const allNames = new Set();
    sprints.forEach(sprint => {
        getActiveMembers(sprint?.members).forEach(member => allNames.add(member.name));
    });

    const averageMap = new Map();
    Array.from(allNames).forEach(name => {
        if (excludedAverageNames.includes(name)) {
            averageMap.set(name, null);
            return;
        }
        const doneValues = [];
        sprints.forEach(sprint => {
            const member = getActiveMembers(sprint?.members).find(m => m.name === name);
            if (!member) return;
            const latestEntry = getLatestStatusEntry(member);
            const done = Number(latestEntry?.['Done']) || 0;
            doneValues.push(done);
        });
        averageMap.set(name, getNonZeroAverage(doneValues));
    });

    return averageMap;
}

function updateMemberVelocityForSprint(sprint, sprints = []) {
    const velocityNodes = document.querySelectorAll('[data-member-velocity]');
    const averageNodes = document.querySelectorAll('[data-member-velocity-avg]');
    if (!velocityNodes.length && !averageNodes.length) return;

    const doneByName = new Map();
    getActiveMembers(sprint?.members).forEach(member => {
        const latestEntry = getLatestStatusEntry(member);
        const done = Number(latestEntry?.['Done']) || 0;
        doneByName.set(member.name, done);
    });

    const averageMap = buildAverageDoneMap(sprints);

    velocityNodes.forEach(node => {
        const name = node.getAttribute('data-member-velocity') || '';
        const done = doneByName.get(name) || 0;
        node.textContent = formatVelocityValue(done);
    });

    averageNodes.forEach(node => {
        const name = node.getAttribute('data-member-velocity-avg') || '';
        const avg = averageMap.has(name) ? averageMap.get(name) : 0;
        node.textContent = avg == null ? '—' : formatVelocityValue(avg);
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

    sprintMemberChart = new Chart(canvas, {
        type: 'line',
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
