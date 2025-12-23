const statusColorMap = {
    'To Do': '#6ec5ff',
    'In Review': '#f5d469',
    'In Progress': '#4b8cff',
    'Done': '#1fce88'
};
const statusOrder = ['To Do', 'In Progress', 'In Review', 'Done'];
let sprintTrendChart = null;
let sprintMemberChart = null;
const memberPalette = ['#c9a85c', '#4b8cff', '#6ec5ff', '#f5d469', '#ff5f56', '#7de1c3'];
let statusChartInstance = null;
let teamCache = [];

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

function buildStatusRows(labels, counts) {
    return labels.map((label, idx) => {
        const color = statusColorMap[label] || '#6ec5ff';
        const count = counts[idx] ?? 0;
        return `
            <div class="mini-status-row">
                <span class="mini-status-dot" style="background:${color}"></span>
                <span class="mini-status-label">${label}</span>
                <span class="mini-status-value">${count}</span>
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
    diamond: 'images/badges/diamond.svg'
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
                        ${buildStatusRows(member.status.labels, member.status.counts)}
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
            `;

            teamGrid.appendChild(card);

            const radarChart = createRadarChart(
                card.querySelector(`#${radarId}`),
                skillData.labels,
                skillData.currentLevels,
                skillData.initialLevels
            );

            createMiniDonut(donutId, member.status.labels, member.status.counts);
            setupSkillInteractions(card, radarChart);
        });
    };

    try {
        const response = await fetch('./data/team.json');
        const data = await response.json();
        const team = data.team || [];
        const finalTeam = team.length ? team : fallbackData.team;
        renderTeam(finalTeam);
        renderWorkload(finalTeam);
        teamCache = finalTeam;
    } catch (error) {
        console.error('Error loading team data:', error);
        renderTeam(fallbackData.team);
        renderWorkload(fallbackData.team);
        teamCache = fallbackData.team;
    }
}

loadTeam();
loadSprintTrends();

async function loadSprintTrends() {
    const selectEl = document.getElementById('globalSprintSelect');
    const chartCanvas = document.getElementById('sprintTrendChart');
    if (!selectEl || !chartCanvas) return;

    try {
        const response = await fetch('./data/sprint_tasks.json');
        const data = await response.json();
        const sprints = data.sprints || [];
        if (!sprints.length) return;

        const optionsHtml = sprints.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;

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
    (sprint.members || []).forEach(member => {
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
        (sprint.members || []).forEach(member => {
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

    (sprint.members || []).forEach(member => {
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

function computeSprintStatusCounts(sprint) {
    if (!sprint) return { counts: {}, total: 0, latestDate: null };

    let latestDate = null;
    (sprint.members || []).forEach(member => {
        (member.statuses || []).forEach(entry => {
            if (!entry.date) return;
            if (!latestDate || new Date(entry.date) > new Date(latestDate)) {
                latestDate = entry.date;
            }
        });
    });

    const counts = {};
    if (latestDate) {
        (sprint.members || []).forEach(member => {
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

    (sprint.members || []).forEach(member => {
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

function buildMemberDatasets(sprint, labels) {
    const members = sprint?.members || [];
    return members.map((member, idx) => {
        const color = member.color || memberPalette[idx % memberPalette.length] || '#c9a85c';
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
                            return `${context.dataset.label}: ${context.parsed.y} de ${total} tareas Done`;
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
