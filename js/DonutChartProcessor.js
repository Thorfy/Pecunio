// Assuming AbstractChartProcessor.js, UIManager.js are available

class DonutChartProcessor extends AbstractChartProcessor {
    constructor(dataService, chartSpecificParams = {}) {
        // chartSpecificParams = { year: YYYY }
        super(dataService, chartSpecificParams);
    }

    /**
     * Prepares data for the yearly donut chart.
     * Filters transactions for a specific year and aggregates amounts by parent category.
     * @returns {Promise<Object>} Chart.js data structure: { labels, datasets: [{ data, backgroundColor }] }
     */
    async prepareData() {
        const year = this.chartSpecificParams.year;
        if (!year || typeof year !== 'number') {
            console.error("DonutChartProcessor: 'year' is required in chartSpecificParams and must be a number.");
            return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
        }

        const allTransactions = this.dataService.getAllTransactions(true); // Get transactions with 'effectiveDate'

        const yearlyTransactions = allTransactions.filter(transaction => {
            const transactionDate = transaction.effectiveDate ? new Date(transaction.effectiveDate) : new Date(transaction.date);
            return transactionDate.getUTCFullYear() === year;
        });

        if (yearlyTransactions.length === 0) {
            return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
        }

        const aggregatedData = {}; // Using parent category names as keys
        // const allCategories = this.dataService.getAllCategories(); // Not strictly needed if getParentCategory works well

        yearlyTransactions.forEach(transaction => {
            const parentCategory = this.dataService.getParentCategory(transaction.category_id);

            if (parentCategory) {
                if (!aggregatedData[parentCategory.name]) {
                    aggregatedData[parentCategory.name] = {
                        value: 0,
                        color: UIManager.parseColorCSS("categoryColor_" + parentCategory.id) || this._getRandomColor(),
                        id: parentCategory.id
                    };
                }
                aggregatedData[parentCategory.name].value += transaction.amount;
            }
        });

        const labels = Object.keys(aggregatedData);
        const dataValues = labels.map(label => aggregatedData[label].value);
        const backgroundColors = labels.map(label => aggregatedData[label].color);

        return {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors
            }]
        };
    }

    /**
     * Gets the Chart.js configuration for a Donut chart.
     * @param {Object} preparedData - Data from prepareData(), expected to be { labels, datasets }.
     * @returns {Object} The Chart.js configuration object.
     */
    getChartConfig(preparedData) {
        const year = this.chartSpecificParams.year;
        const title = `Dépenses ${year} par catégorie`; // Dynamic title

        return {
            type: 'doughnut',
            data: preparedData, // Assign data structure from prepareData()
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: title
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.raw; // This is the actual data value for the segment
                                if (sum > 0) {
                                    label += (value / sum * 100).toFixed(2) + '% (' + value.toLocaleString() + ')';
                                } else {
                                    label += '0%';
                                }
                                return label;
                            }
                        }
                    }
                },
            }
        };
    }

    // Helper to get a random color if a category color is not found by parseColorCSS
    _getRandomColor() {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        return `rgb(${r},${g},${b})`;
    }
}
