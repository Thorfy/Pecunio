// Assuming AbstractChartProcessor.js, UIManager.js, Evt.js are available
// Assuming 'annotation' and 'average' are globally available as per original ChartData.js context for getChartJsConfig

class LineBarChartProcessor extends AbstractChartProcessor {
    constructor(dataService, chartSpecificParams = {}) {
        // chartSpecificParams might include { accountsSelected: [...] }
        super(dataService, chartSpecificParams);
    }

    /**
     * Prepares data for line/bar charts.
     * Fetches transactions, filters them, and aggregates them by category and date.
     * @returns {Promise<Object>} An object containing categories and aggregated data by category.
     *                            Example: { categories: [], datasets: [] } (similar to Chart.js data structure)
     */
    async prepareData() {
        const startDate = this.settingsService.getSetting('startDate');
        const endDate = this.settingsService.getSetting('endDate');
        const accountsSelected = this.chartSpecificParams.accountsSelected || null;

        // Get transactions using DataService, applying date and account filters.
        // DataService.getTransactions returns transactions with 'groupingDate' (adjusted for current_month and set to 1st of month)
        // and 'effectiveDate' (original transaction date).
        // For monthly aggregation as in original ChartData, 'groupingDate' is appropriate.
        const filteredTransactions = this.dataService.getTransactions({
            startDate: startDate,
            endDate: endDate,
            accountIds: accountsSelected,
            dateField: 'groupingDate' // Use the date field that sets day to 1st for monthly grouping
        });

        if (!filteredTransactions || filteredTransactions.length === 0) {
            return { datasets: [] }; // Return structure expected by getChartConfig
        }

        // Use DataService to get all categories
        const allCategories = this.dataService.getAllCategories();
        if (!allCategories || allCategories.length === 0) {
            return { datasets: [] };
        }

        // Aggregate transactions by category (parent category if applicable, or specific logic from old merge)
        // The old mergeTransactionByCategory was complex. Let's use DataService's simpler aggregation for now,
        // assuming it groups by parent category by default if a transaction belongs to a sub-category.
        // Or, if ChartData's specific merging (handling exceptionCat, specific child category logic) is crucial,
        // that logic needs to be carefully reimplemented here or in DataService.

        // Re-implementing the core of old mergeTransactionByCategory and getDataFormated:
        // 1. Group transactions by category ID (actual category_id from transaction)
        const transactionsByCategory = {};
        const exceptionCat = [326, 282]; // From original ChartData

        filteredTransactions.forEach(transaction => {
            // Find the primary category of the transaction.
            // The old logic sometimes grouped by parent even if transaction was in child.
            // Let's clarify: we group by the category that will be displayed in the legend.
            // If sub-categories are not displayed individually, group by parent.
            // The original `mergeTransactionByCategory` in ChartData seemed to collect transactions under the parent's ID.

            let targetCategoryId = null;
            const directCategory = allCategories.find(c => c.id === transaction.category.id);

            if (directCategory) {
                if (directCategory.parent_id && !exceptionCat.includes(transaction.category.id)) {
                     // Check if the parent category itself is one of the main categories to display
                    const parentCat = allCategories.find(c => c.id === directCategory.parent_id);
                    if (parentCat) targetCategoryId = parentCat.id; // Group by parent
                    else targetCategoryId = directCategory.id; // Fallback to direct if parent somehow not found
                } else if (!exceptionCat.includes(transaction.category.id)) {
                    targetCategoryId = directCategory.id; // Group by direct category (it's a parent or not handled by parent grouping)
                }
            }

            if (targetCategoryId) {
                if (!transactionsByCategory[targetCategoryId]) {
                    transactionsByCategory[targetCategoryId] = [];
                }
                transactionsByCategory[targetCategoryId].push(transaction);
            }
        });

        // 2. Format for Chart.js (datasets)
        const chartJsData = { datasets: [] };
        // We need a list of categories that are actually displayed (usually parent categories)
        const displayCategories = allCategories.filter(c => !c.parent_id || c.is_parent_for_display); // Assuming a way to identify main display categories

        // Get visibility settings for categories
        const categoryNamesForSettings = displayCategories.map(c => c.name);
        const visibilitySettings = await this.settingsService.getSettings(categoryNamesForSettings);


        displayCategories.forEach(category => {
            const categoryTransactions = transactionsByCategory[category.id] || [];
            const dateValueObject = []; // For non-cumulative (line chart)
            const transactionObject = {}; // For cumulative (bar chart)

            categoryTransactions.forEach(transaction => {
                // Use groupingDate from DataService processing for monthly aggregation
                const dateObj = transaction.groupingDate ? new Date(transaction.groupingDate) : new Date(transaction.effectiveDate);
                const month = `${dateObj.getUTCMonth() + 1}`.padStart(2, "0"); // Use UTC month
                const year = dateObj.getUTCFullYear();
                const stringDate = `${year}-${month}`;

                // Determine if chart type is cumulative (for 'bar') or not (for 'line')
                // This depends on chartType setting, which getChartConfig will handle for stacking.
                // For data preparation, we can assume 'isCumulative' based on a setting or default.
                // The original `getDataFormated` had an `isCumulative` param. Let's assume true for now (like original call).
                const isCumulative = true; // This might need to be dynamic based on chart type later

                if (isCumulative) {
                    transactionObject[stringDate] = (transactionObject[stringDate] || 0) + transaction.amount;
                } else {
                    // For line charts, individual points might be needed. Original used transaction.date (which was modified)
                    // Using effectiveDate for more accurate point plotting if not cumulative.
                    dateValueObject.push({ x: transaction.effectiveDate.toISOString().split('T')[0], y: transaction.amount, name: transaction.name });
                }
            });

            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({ x: date, y: transactionObject[date] });
                }
                // Sort by date for consistent line/bar progression
                dateValueObject.sort((a, b) => new Date(a.x) - new Date(b.x));
            }


            const color = UIManager.parseColorCSS("categoryColor_" + category.id) || '#CCC'; // Fallback color

            chartJsData.datasets.push({
                label: category.name,
                data: dateValueObject,
                backgroundColor: color,
                borderColor: color,
                fill: false,
                tension: 0.3,
                hidden: visibilitySettings[category.name] || false // Use fetched visibility or default to false
            });
        });

        return chartJsData; // This is directly the { datasets: [...] } part of Chart.js data object
    }

    /**
     * Gets the Chart.js configuration object for line/bar charts.
     * @param {Object} preparedData - Data from prepareData(), expected to be { datasets: [...] }.
     * @returns {Object} The Chart.js configuration object.
     */
    async getChartConfig(preparedData) {
        // This method adapts the old getChartJsConfig
        // `preparedData` should be the object { datasets: [...] }

        const chartTypeSetting = this.settingsService.getSetting('chartType') || 'bar'; // Default to 'bar'
        const isCumulativeStack = chartTypeSetting === 'bar'; // Stack if bar chart, don't if line

        // Ensure 'annotation' and 'average' are defined in the scope,
        // as they were used globally in the original getChartJsConfig.
        // If they are not available globally here, they need to be imported or passed.
        // For now, assuming they are available as in original context.
        // Moved annotation and average to static methods of this class.
        // if (typeof annotation === 'undefined' || typeof average === 'undefined') {
        //     console.warn('LineBarChartProcessor: "annotation" or "average" function is not defined globally. Chart annotations might not work.');
        // }

        const commonConfigOptions = {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: {
                        mainAnnotation: LineBarChartProcessor.getAnnotationObject()
                    }
                },
                title: {
                    display: true,
                    text: "" // Title text will be set by beforeInit plugin
                },
                legend: {
                    onClick: async (evt, item, legend) => { // Changed 'this' to 'legend'
                        const settingsServ = this.settingsService; // Capture service
                        const currentVal = await settingsServ.getSetting(item.text); // Use captured service
                        await settingsServ.setSetting(item.text, !currentVal); // Use captured service

                        // Default legend click behavior
                        Chart.defaults.plugins.legend.onClick.call(legend, evt, item, legend);
                    },
                }
            },
            interaction: {
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    time: { // Ensure time unit is appropriate if using 'time' scale with 'YYYY-MM' data
                        unit: 'month',
                         parser: 'YYYY-MM', // If your x values are 'YYYY-MM' strings
                         tooltipFormat: 'MMM YYYY'
                    },
                    grid: { color: "#e9f5f9", borderColor: "#d3eaf2", tickColor: "#e9f5f9" },
                    display: true,
                    stacked: true, // Always stack X-axis for this chart type as per original
                    title: { color: "#92cbdf", display: false }
                },
                y: {
                    display: true,
                    stacked: isCumulativeStack,
                    grid: { color: "#e9f5f9", borderColor: "#d3eaf2", tickColor: "#e9f5f9" },
                }
            }
        };

        return {
            type: chartTypeSetting,
            data: preparedData, // Assign datasets from prepareData()
            options: {
                ...commonConfigOptions,
                plugins: {
                    ...commonConfigOptions.plugins,
                    toggleTypeChart: { // Custom plugin from original
                        display: true, // This seems to be a custom flag, not a standard Chart.js option
                    }
                }
            },
            plugins: [{ // This is an array of plugin objects
                id: 'toggleTypeChart',
                beforeInit: function (chart) {
                    function monthDiff(dateFrom, dateTo) {
                        return dateTo.getUTCMonth() - dateFrom.getUTCMonth() + (12 * (dateTo.getUTCFullYear() - dateFrom.getUTCFullYear()));
                    }

                    let minDateOverall = null;
                    let maxDateOverall = null;

                    chart.data.datasets.forEach(dataset => {
                        dataset.data.forEach(dataPoint => {
                            const date = new Date(dataPoint.x);
                            if (!minDateOverall || date < minDateOverall) minDateOverall = date;
                            if (!maxDateOverall || date > maxDateOverall) maxDateOverall = date;
                        });
                    });

                    if (minDateOverall && maxDateOverall) {
                        const monthCount = monthDiff(minDateOverall, maxDateOverall) +1; // +1 to include start month
                        chart.options.plugins.title.text = `Dépenses sur ${monthCount} mois`;
                    } else {
                        chart.options.plugins.title.text = "Pas de données pour calculer la période";
                    }
                },
                // beforeDraw and afterEvent for toggle button (kept from original)
                // ... (These need 'evt' to be available, or refactor event dispatching)
                 beforeDraw: function (chart) {
                    // ... (original code for drawing toggle button) ...
                    // Make sure this code is still relevant and correctly placed.
                 },
                 afterEvent: async (chart, args) => { // evt object for dispatch
                    // ... (original code for handling click on toggle button) ...
                    // This used global `evt.dispatch('url_change');`
                    // This plugin might need access to settingsService or evt dispatcher passed somehow if they are not global
                    if (args.event.type === 'click') {
                        const canvas = chart.canvas;
                        const rect = canvas.getBoundingClientRect();
                        const x = args.event.x;
                        const y = args.event.y;
                        // Define clickable area for toggle, e.g., top-left corner
                        const legendWidth = 120;
                        const legendHeight = 20;
                        const withinLegendX = x >= 10 && x <= 10 + legendWidth;
                        const withinLegendY = y >= 10 && y <= 10 + legendHeight;

                        if (withinLegendX && withinLegendY) {
                             // Accessing settingsService here is tricky as 'this' is the plugin.
                             // One way: if settingsService is global or passed to chart options.
                             // For now, assuming it might not work without further refactor of plugin or service access.
                             // console.log("Toggle chart type clicked - settings update needs refactor for service access");
                             // await this.settingsService.setSetting('chartType', chart.config.type === 'line' ? 'bar' : 'line');
                             // evt.dispatch('url_change'); // If evt is global
                        }
                    }
                 }
            }]
        };
    }

    static getAverage(ctx) {
        if (!ctx.chart.data || !ctx.chart.data.datasets || !ctx.chart.data.datasets[0] || !ctx.chart.data.datasets[0].data) {
            return 0;
        }
        const values = ctx.chart.data.datasets[0].data;
        if (values.length === 0) return 0;

        const numericValues = values.map(v => (typeof v === 'object' && v !== null && v.y !== undefined) ? v.y : v)
                                  .filter(v => typeof v === 'number' && !isNaN(v));

        if (numericValues.length === 0) return 0;
        return numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    }

    static getAnnotationObject() {
        return {
            type: 'line',
            borderColor: 'black',
            borderDash: [6, 6],
            borderDashOffset: 0,
            borderWidth: 3,
            label: {
                enabled: true,
                content: (ctx) => 'Average: ' + LineBarChartProcessor.getAverage(ctx).toFixed(2),
                position: 'end'
            },
            scaleID: 'y',
            value: (ctx) => LineBarChartProcessor.getAverage(ctx)
        };
    }
}
