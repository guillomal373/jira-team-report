const statusColorMap = {
    'To Do': '#6ec5ff',
    'In Review': '#f5d469',
    'In Progress': '#4b8cff',
    'Sprint': '#2b5fd9',
    'Blocked': '#ff5f56',
    'Done': '#1fce88'
};

// Status overview donut chart
const statusCtx = document.getElementById('statusChart');
if (statusCtx) {
    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Review', 'In Progress', 'Sprint', 'Blocked', 'Done'],
            datasets: [{
                data: [35, 6, 5, 1, 1, 16],
                backgroundColor: [
                    statusColorMap['To Do'],
                    statusColorMap['In Review'],
                    statusColorMap['In Progress'],
                    statusColorMap['Sprint'],
                    statusColorMap['Blocked'],
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
                        return 'Level: ' + context.parsed.r + '/10';
                    }
                }
            }
        },
        onHover: (event, activeElements) => {
            event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
        }
    }
};

function createRadarChart(canvas, labels, data) {
    return new Chart(canvas, {
        ...radarBaseConfig,
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: 'rgba(201, 168, 92, 0.15)',
                borderColor: '#c9a85c',
                borderWidth: 2.5,
                pointBackgroundColor: '#c9a85c',
                pointBorderColor: '#1a1a1a',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#c9a85c',
                pointHoverRadius: 7
            }]
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

    const highlight = (skillIndex) => {
        const meta = chart.getDatasetMeta(0);
        meta.data.forEach((point, index) => {
            if (index === skillIndex) {
                point.options.pointRadius = 10;
                point.options.pointBackgroundColor = '#ffffff';
                point.options.pointBorderColor = '#c9a85c';
                point.options.pointBorderWidth = 3;
            } else {
                point.options.pointRadius = 5;
                point.options.pointBackgroundColor = '#c9a85c';
                point.options.pointBorderColor = '#1a1a1a';
                point.options.pointBorderWidth = 2;
            }
        });
        chart.update('none');
    };

    const resetHighlight = () => {
        const meta = chart.getDatasetMeta(0);
        meta.data.forEach((point) => {
            point.options.pointRadius = 5;
            point.options.pointBackgroundColor = '#c9a85c';
            point.options.pointBorderColor = '#1a1a1a';
            point.options.pointBorderWidth = 2;
        });
        chart.setActiveElements([]);
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
    };

    const activateTooltip = (index) => {
        chart.setActiveElements([{ datasetIndex: 0, index }]);
        chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], { x: 0, y: 0 });
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

function renderWorkload(team = []) {
    const container = document.getElementById('workload-list');
    if (!container) return;

    const normalized = (team || []).map(member => {
        const paths = getAvatarPaths(member);
        const counts = (member.status?.counts || []).map(n => Number(n) || 0);
        const tasks = counts.reduce((sum, n) => sum + n, 0);
        return {
            name: member.name || 'Unassigned',
            role: member.role || '',
            avatarMain: paths.main,
            avatarCircle: paths.circle,
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
            ? `<div class="workload-avatar"><img src="${avatarSrc}" alt="${member.name}"></div>`
            : `<div class="workload-avatar workload-avatar--fallback">${initial}</div>`;

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
                badges: ['fire', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [9, 9, 9, 8, 7]
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
                badges: ['fire', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [8, 7, 8, 7, 8]
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
                badges: ['diamond', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [7, 6, 7, 6, 5]
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
                badges: ['diamond', 'js'],
                skills: {
                    labels: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'],
                    levels: [7, 6, 7, 6, 5]
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
                <div class="skills-legend">
                    ${buildSkillTags(member.skills.labels)}
                </div>
            `;

            teamGrid.appendChild(card);

            const radarChart = createRadarChart(
                card.querySelector(`#${radarId}`),
                member.skills.labels,
                member.skills.levels
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
    } catch (error) {
        console.error('Error loading team data:', error);
        renderTeam(fallbackData.team);
        renderWorkload(fallbackData.team);
    }
}

loadTeam();
