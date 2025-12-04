const skills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Flutter'];

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
                    '#6ec5ff', // To Do
                    '#f5d469', // In Review
                    '#4b8cff', // In Progress
                    '#2b5fd9', // Sprint
                    '#ff5f56', // Blocked
                    '#1fce88'  // Done
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

const chartConfig = {
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
            legend: {
                display: false
            },
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

// Carlos - Senior Developer
const chart1 = new Chart(document.getElementById('chart1'), {
    ...chartConfig,
    data: {
        labels: skills,
        datasets: [{
            data: [9, 9, 9, 8, 7],
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

// Ana - Mid-Level Developer
const chart2 = new Chart(document.getElementById('chart2'), {
    ...chartConfig,
    data: {
        labels: skills,
        datasets: [{
            data: [8, 7, 8, 7, 8],
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

// Diego - Junior Developer
const chart3 = new Chart(document.getElementById('chart3'), {
    ...chartConfig,
    data: {
        labels: skills,
        datasets: [{
            data: [7, 6, 7, 6, 5],
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

const charts = [chart1, chart2, chart3];

// Función para resaltar skill
function highlightSkill(skillIndex, chartIndex) {
    const chart = charts[chartIndex];
    const meta = chart.getDatasetMeta(0);
    
    // Resaltar el punto en el gráfico
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
}

// Función para resetear
function resetHighlight(chartIndex) {
    const chart = charts[chartIndex];
    const meta = chart.getDatasetMeta(0);
    
    meta.data.forEach((point) => {
        point.options.pointRadius = 5;
        point.options.pointBackgroundColor = '#c9a85c';
        point.options.pointBorderColor = '#1a1a1a';
        point.options.pointBorderWidth = 2;
    });
    
    chart.update('none');
}

// Agregar event listeners a los tags
document.querySelectorAll('.developer-card').forEach((card, chartIndex) => {
    const tags = card.querySelectorAll('.skill-tag');
    const canvas = card.querySelector('canvas');
    const chart = charts[chartIndex];
    
    tags.forEach((tag, tagIndex) => {
        tag.addEventListener('click', () => {
            // Toggle active class
            const wasActive = tag.classList.contains('active');
            
            // Remover active de todos los tags del mismo card
            tags.forEach(t => t.classList.remove('active'));
            
            if (!wasActive) {
                tag.classList.add('active');
                highlightSkill(tagIndex, chartIndex);
                
                // Activar tooltip
                chart.setActiveElements([{
                    datasetIndex: 0,
                    index: tagIndex
                }]);
                chart.tooltip.setActiveElements([{
                    datasetIndex: 0,
                    index: tagIndex
                }], {x: 0, y: 0});
                chart.update('none');
            } else {
                resetHighlight(chartIndex);
                chart.setActiveElements([]);
                chart.tooltip.setActiveElements([], {x: 0, y: 0});
                chart.update('none');
            }
        });

        tag.addEventListener('mouseenter', () => {
            if (!tag.classList.contains('active')) {
                highlightSkill(tagIndex, chartIndex);
            }
        });

        tag.addEventListener('mouseleave', () => {
            if (!tag.classList.contains('active')) {
                resetHighlight(chartIndex);
            }
        });
    });
});

// Click en los puntos del gráfico
document.querySelectorAll('canvas').forEach((canvas, chartIndex) => {
    canvas.addEventListener('click', (e) => {
        const chart = charts[chartIndex];
        const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
        
        if (points.length > 0) {
            const pointIndex = points[0].index;
            const card = canvas.closest('.developer-card');
            const tags = card.querySelectorAll('.skill-tag');
            
            // Toggle
            const wasActive = tags[pointIndex].classList.contains('active');
            
            tags.forEach(t => t.classList.remove('active'));
            
            if (!wasActive) {
                tags[pointIndex].classList.add('active');
                highlightSkill(pointIndex, chartIndex);
            } else {
                resetHighlight(chartIndex);
            }
        }
    });
});
