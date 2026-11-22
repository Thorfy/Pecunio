/**
 * Rapport PDF Pecunio - Point d'entrée de la page report.html
 * Utilise ReportStorage, ReportFilters, ReportChartDataBuilder et PdfExporter
 */
(function () {
    const LIGHT_GRID = 'rgba(0, 0, 0, 0.06)';
    const LIGHT_SUCCESS = 'rgba(5, 150, 105, 0.85)';
    const LIGHT_DANGER = 'rgba(220, 38, 38, 0.85)';

    let categoryChartInstance = null;
    let evolutionChartInstance = null;
    let sankeyChartInstance = null;
    let polarChartInstance = null;
    let incomeVsExpenseChartInstance = null;
    let categoryChartData = null;
    let evolutionChartData = null;
    let sankeyChartData = null;
    let polarChartData = null;

    function formatCurrency(value) {
        if (value == null || isNaN(value)) return '—';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderHeader(params) {
        const periodEl = document.getElementById('report-period');
        const accountsEl = document.getElementById('report-accounts');
        if (params.pdfYear != null && params.pdfMonthLabel) {
            periodEl.textContent = params.pdfMonthIndex === 0
                ? `Année ${params.pdfYear}`
                : `${params.pdfMonthLabel} ${params.pdfYear}`;
        } else if (params.startDate && params.endDate) {
            periodEl.textContent = `Du ${formatDate(params.startDate)} au ${formatDate(params.endDate)}`;
        }
        if (params.accountNames) {
            accountsEl.textContent = params.accountNames;
        }
    }

    function renderStats(stats) {
        document.getElementById('stat-count').textContent = (stats.totalTransactions != null) ? stats.totalTransactions.toLocaleString('fr-FR') : '—';
        document.getElementById('stat-income').textContent = formatCurrency(stats.totalIncome);
        document.getElementById('stat-expenses').textContent = formatCurrency(stats.totalExpenses || 0);
        const balance = (stats.totalIncome || 0) - (stats.totalExpenses || 0);
        const balanceEl = document.getElementById('stat-balance');
        balanceEl.textContent = formatCurrency(balance);
        balanceEl.classList.toggle('positive', balance >= 0);
        balanceEl.classList.toggle('negative', balance < 0);
    }

    function renderIncomeVsExpenseChart(incomeExpenseStats) {
        const canvas = document.getElementById('chart-income-expense');
        if (!canvas) return;
        if (incomeVsExpenseChartInstance) {
            incomeVsExpenseChartInstance.destroy();
            incomeVsExpenseChartInstance = null;
        }
        const totalIncome = Math.max(0, incomeExpenseStats.totalIncome || 0);
        const totalExpenses = Math.max(0, incomeExpenseStats.totalExpenses || 0);
        incomeVsExpenseChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Revenus', 'Dépenses'],
                datasets: [{
                    label: 'Montant (€)',
                    data: [totalIncome, totalExpenses],
                    backgroundColor: [LIGHT_SUCCESS, LIGHT_DANGER],
                    borderColor: ['#059669', '#dc2626'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: LIGHT_GRID } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    function renderCategoryChart(chartType) {
        if (!categoryChartData || !categoryChartData.labels.length) return;
        const canvas = document.getElementById('chart-category');
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
            categoryChartInstance = null;
        }
        const ctx = canvas.getContext('2d');
        const isBar = chartType === 'bar';
        categoryChartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: categoryChartData.labels,
                datasets: [{
                    label: 'Montant (€)',
                    data: categoryChartData.data,
                    backgroundColor: categoryChartData.colors,
                    borderColor: categoryChartData.colors.map(c => c.replace('0.85', '1')),
                    borderWidth: 2,
                    fill: !isBar,
                    tension: isBar ? 0 : 0.3,
                    pointBackgroundColor: categoryChartData.colors,
                    pointBorderColor: categoryChartData.colors.map(c => c.replace('0.85', '1')),
                    pointRadius: isBar ? 0 : 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                indexAxis: isBar ? 'y' : 'x',
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: LIGHT_GRID }, display: isBar },
                    y: { beginAtZero: true, grid: { display: true, color: LIGHT_GRID } }
                }
            }
        });
    }

    function renderEvolutionChart(chartType) {
        const canvas = document.getElementById('chart-evolution');
        if (!canvas || !evolutionChartData || !evolutionChartData.labels.length || !evolutionChartData.datasets.length) return;
        if (evolutionChartInstance) {
            evolutionChartInstance.destroy();
            evolutionChartInstance = null;
        }
        const ctx = canvas.getContext('2d');
        const isBar = chartType === 'bar';
        evolutionChartInstance = new Chart(ctx, {
            type: isBar ? 'bar' : 'line',
            data: {
                labels: evolutionChartData.labels,
                datasets: evolutionChartData.datasets.map(ds => ({
                    ...ds,
                    fill: !isBar,
                    tension: isBar ? 0 : 0.3,
                    pointRadius: isBar ? 0 : 3
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                stacked: isBar,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    x: { grid: { color: LIGHT_GRID } },
                    y: { beginAtZero: true, stacked: isBar, grid: { color: LIGHT_GRID } }
                }
            }
        });
    }

    function renderSankeyChart() {
        const canvas = document.getElementById('chart-sankey');
        if (!canvas || !sankeyChartData || !sankeyChartData.data.length) return;
        if (sankeyChartInstance) {
            sankeyChartInstance.destroy();
            sankeyChartInstance = null;
        }
        const colorMap = sankeyChartData.colorMap || [];
        const defaultColor = 'rgba(79, 70, 229, 0.75)';
        sankeyChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'sankey',
            data: {
                datasets: [{
                    label: 'Flux',
                    data: sankeyChartData.data,
                    colorFrom: (ctx) => {
                        try {
                            const d = ctx.dataset && ctx.dataset.data && ctx.dataset.data[ctx.dataIndex];
                            return (d && d.id != null && colorMap[d.id]) ? colorMap[d.id] : defaultColor;
                        } catch (_) { return defaultColor; }
                    },
                    colorTo: (ctx) => {
                        try {
                            const d = ctx.dataset && ctx.dataset.data && ctx.dataset.data[ctx.dataIndex];
                            return (d && d.id != null && colorMap[d.id]) ? colorMap[d.id] : defaultColor;
                        } catch (_) { return defaultColor; }
                    },
                    size: 'max',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                layout: { padding: { top: 16, bottom: 16, left: 16, right: 16 } },
                aspectRatio: 2.8
            }
        });
    }

    function renderPolarChart() {
        const canvas = document.getElementById('chart-polar');
        if (!canvas || !polarChartData || !polarChartData.labels.length) return;
        if (polarChartInstance) {
            polarChartInstance.destroy();
            polarChartInstance = null;
        }
        polarChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'polarArea',
            data: {
                labels: polarChartData.labels,
                datasets: [{
                    data: polarChartData.data,
                    backgroundColor: polarChartData.colors,
                    borderColor: polarChartData.colors.map(c => c.replace('0.85', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                plugins: { legend: { position: 'bottom' } },
                scales: { r: { grid: { color: LIGHT_GRID } } }
            }
        });
    }

    function renderCharts(filteredData) {
        categoryChartData = ReportChartDataBuilder.buildCategoryData(filteredData);
        evolutionChartData = ReportChartDataBuilder.buildEvolutionData(filteredData);
        sankeyChartData = ReportChartDataBuilder.buildSankeyData(filteredData);
        polarChartData = ReportChartDataBuilder.buildPolarData(filteredData);

        const incomeExpenseStats = ReportFilters.computeIncomeExpenseForChart(filteredData);
        renderIncomeVsExpenseChart(incomeExpenseStats);

        const expenseType = ReportChartDataBuilder.buildExpenseTypeData(filteredData);
        const ctxDonut = document.getElementById('chart-expense-type').getContext('2d');
        if (expenseType.labels.length) {
            new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: expenseType.labels,
                    datasets: [{
                        data: expenseType.data,
                        backgroundColor: expenseType.colors,
                        borderColor: '#e2e8f0',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 400 },
                    cutout: '58%',
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        const chartTypeSelect = document.getElementById('chart-category-type');
        renderCategoryChart((chartTypeSelect && chartTypeSelect.value) || 'bar');
        if (chartTypeSelect) {
            chartTypeSelect.addEventListener('change', function () { renderCategoryChart(this.value); });
        }

        const sectionSankey = document.getElementById('section-sankey');
        if (sankeyChartData && sankeyChartData.data && sankeyChartData.data.length) {
            if (sectionSankey) sectionSankey.style.display = '';
            renderSankeyChart();
        } else {
            if (sectionSankey) sectionSankey.style.display = 'none';
        }

        const sectionPolar = document.getElementById('section-polar');
        if (polarChartData && polarChartData.labels && polarChartData.labels.length) {
            if (sectionPolar) sectionPolar.style.display = '';
            renderPolarChart();
        } else {
            if (sectionPolar) sectionPolar.style.display = 'none';
        }

        const sectionEvolution = document.getElementById('section-evolution');
        if (evolutionChartData && evolutionChartData.labels.length && evolutionChartData.datasets.length) {
            if (sectionEvolution) sectionEvolution.style.display = '';
            const evolutionTypeSelect = document.getElementById('chart-evolution-type');
            renderEvolutionChart((evolutionTypeSelect && evolutionTypeSelect.value) || 'bar');
            if (evolutionTypeSelect) {
                evolutionTypeSelect.addEventListener('change', function () { renderEvolutionChart(this.value); });
            }
        } else {
            if (sectionEvolution) sectionEvolution.style.display = 'none';
        }
    }

    function renderTable(filteredData) {
        const tbody = document.getElementById('transactions-tbody');
        tbody.innerHTML = '';
        const sorted = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));
        sorted.forEach(row => {
            const tr = document.createElement('tr');
            const amountClass = row.amount >= 0 ? 'amount-positive' : 'amount-negative';
            tr.innerHTML = `
                <td>${formatDate(row.date)}</td>
                <td>${escapeHtml(row.description || '—')}</td>
                <td>${escapeHtml(row.categoryName || row.parentCategoryName || '—')}</td>
                <td>${escapeHtml(row.accountName || '—')}</td>
                <td class="${amountClass}" style="text-align:right">${formatCurrency(row.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderFooterMentions() {
        const footer = document.getElementById('report-footer');
        if (!footer) return;
        footer.innerHTML = '<strong>Mentions :</strong> Pour des calculs cohérents, certaines catégories sont exclues des totaux (notamment le graphique Revenus vs Dépenses) : <strong>virements internes</strong>, <strong>épargne</strong> et <strong>remboursements</strong>. Les statistiques du rapport appliquent les mêmes règles d\'exclusion que l\'application Pecunio.';
    }

    function getChartInstancesForPdf() {
        const charts = [];
        if (categoryChartInstance) charts.push(categoryChartInstance);
        if (evolutionChartInstance) charts.push(evolutionChartInstance);
        if (sankeyChartInstance) charts.push(sankeyChartInstance);
        if (polarChartInstance) charts.push(polarChartInstance);
        if (incomeVsExpenseChartInstance) charts.push(incomeVsExpenseChartInstance);
        const donutCanvas = document.getElementById('chart-expense-type');
        const donutChart = donutCanvas && typeof Chart !== 'undefined' ? Chart.getChart(donutCanvas) : null;
        if (donutChart) charts.push(donutChart);
        return charts;
    }

    function downloadPdf() {
        const container = document.getElementById('report-container');
        const bar = document.querySelector('.actions-bar');
        const msg = document.getElementById('status-msg');
        if (bar) bar.style.display = 'none';
        msg.textContent = 'Préparation du PDF…';
        document.body.classList.add('pdf-export');

        const finish = (success = true) => {
            document.body.classList.remove('pdf-export');
            msg.textContent = success ? 'PDF téléchargé.' : 'Erreur lors de la génération du PDF.';
            if (bar) bar.style.display = 'flex';
        };

        const exporter = new PdfExporter(container);
        const chartInstances = getChartInstancesForPdf();

        exporter.exportToPdf(chartInstances)
            .then(() => finish(true))
            .catch(err => {
                console.error(err);
                finish(false);
            });
    }

    function init() {
        const btnPdf = document.getElementById('btn-download-pdf');
        const btnClose = document.getElementById('btn-close');

        btnPdf.addEventListener('click', downloadPdf);
        btnClose.addEventListener('click', () => window.close());

        ReportStorage.loadReportData()
            .then(({ mergedData, stats, params }) => {
                const filteredData = ReportFilters.applyReportFilters(mergedData, params);
                const computedStats = ReportFilters.computeStatsLikeIncomeExpenseChart(filteredData);
                renderHeader(params);
                renderStats(computedStats);
                renderCharts(filteredData);
                renderTable(filteredData);
                renderFooterMentions();
            })
            .catch(err => {
                document.getElementById('report-container').innerHTML = `
                    <div class="report-section" style="text-align:center; padding: 48px;">
                        <p style="color: var(--fintech-danger); margin-bottom: 16px;">${escapeHtml(err.message)}</p>
                        <button type="button" class="btn btn-secondary" onclick="window.close()">Fermer</button>
                    </div>
                `;
                const ab = document.querySelector('.actions-bar');
                if (ab) ab.style.display = 'none';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
