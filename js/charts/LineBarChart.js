class LineBarChart extends BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
    }

    async prepareData() {
        const filteredTransactions = await this.applySettingOnData();
        const transactionByCategory = this.mergeTransactionByCategoryLegacy(filteredTransactions, this.categories);
        return this.getDataFormated(this.categories, transactionByCategory, true);
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        const data = { datasets: [] };
        const settingsList = categoryData.map(category => category.name);
        const settings = await chrome.storage.local.get(settingsList);

        categoryData.forEach(category => {
            const transactions = transactionByCategory[parseInt(category.id)];
            
            // Vérifier que transactions existe et est un tableau avant d'appeler forEach
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                // Si pas de transactions pour cette catégorie, créer un dataset vide
                data.datasets.push({
                    label: category.name,
                    data: [],
                    backgroundColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    borderColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    fill: false,
                    tension: 0.3,
                    hidden: settings[category.name]
                });
                return; // Passer à la catégorie suivante
            }
            
            const dateValueObject = [];
            const transactionObject = {};

            transactions.forEach(transaction => {
                // Utiliser la date ajustée qui tient compte de current_month
                const adjustedDate = this.getAdjustedDate(transaction);
                if (!adjustedDate) {
                    return; // Ignorer les transactions sans date valide
                }
                
                const month = `${adjustedDate.getMonth() + 1}`.padStart(2, "0");
                const year = adjustedDate.getUTCFullYear();
                const stringDate = [year, month].join("-");

                if (isCumulative) {
                    transactionObject[stringDate] = (transactionObject[stringDate] || 0) + transaction.amount;
                } else {
                    // Utiliser la date ajustée pour l'affichage
                    dateValueObject.push({ x: adjustedDate.toISOString().split('T')[0], y: transaction.amount, name: transaction.name });
                }
            });

            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({ x: date, y: transactionObject[date] });
                }
            }

            const color = ColorParser.parseColorCSS("categoryColor_" + category.id);

            data.datasets.push({
                label: category.name,
                data: dateValueObject,
                backgroundColor: color,
                borderColor: color,
                fill: false,
                tension: 0.3,
                hidden: settings[category.name]
            });
        });

        return data;
    }


    async buildChart(formattedData) {
        const chartJsConfig = await this.getChartJsConfig();
        chartJsConfig.data = formattedData;

        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            homeBlock.innerHTML = "";
            const canvasDiv = createCanvasElement(homeBlock);
            const ctx = canvasDiv.getContext('2d');

            new Chart(ctx, chartJsConfig);
        }
    }

    /**
     * Retourne la configuration Chart.js standardisée
     * @returns {Promise<Object>} Configuration Chart.js avec type, data, options, plugins
     */
    async getChartJsConfig() {
        // Utiliser l'instance Settings injectée si disponible, sinon fallback sur chrome.storage
        let settings;
        if (this.settingsInstance) {
            await this.settingsInstance.waitForInitialization();
            settings = {
                startDate: this.settingsInstance.getSetting('startDate'),
                endDate: this.settingsInstance.getSetting('endDate'),
                chartType: this.settingsInstance.getSetting('chartType')
            };
        } else {
            settings = await chrome.storage.local.get(['startDate', 'endDate', 'chartType']);
        }
        const initialChartType = settings.chartType ?? 'bar';
        const cummulative = initialChartType === "line" ? false : true;

        const commonConfig = {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: {
                        annotation
                    }
                },
                title: {
                    display: true,
                    text: ""
                },
                legend: {
                    onClick: async function (evt, item) {
                        const currentVal = await chrome.storage.local.get([item.text]);
                        await chrome.storage.local.set({ [item.text]: !currentVal[item.text] });
                        Chart.defaults.plugins.legend.onClick.call(this, evt, item, this);
                    },
                }
            },
            interaction: {
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                    display: true,
                    stacked: true,
                    title: {
                        color: "#92cbdf",
                        display: false
                    }
                },
                y: {
                    display: true,
                    stacked: cummulative,
                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                }
            }
        };

        return {
            type: initialChartType,
            options: {
                ...commonConfig,
                plugins: {
                    ...commonConfig.plugins,
                    toggleTypeChart: {
                        display: true,
                    }
                }
            },
            plugins: [{
                id: 'toggleTypeChart',
                beforeInit: function (chart) {
                    // Helper function to calculate the number of months between two dates
                    function monthDiff(dateFrom, dateTo) {
                        return dateTo.getMonth() - dateFrom.getMonth() + (12 * (dateTo.getFullYear() - dateFrom.getFullYear()));
                    }

                    const minDate = new Date(Math.min(...chart.data.datasets.flatMap(dataset => dataset.data.map(data => new Date(data.x)))));
                    const maxDate = new Date(Math.max(...chart.data.datasets.flatMap(dataset => dataset.data.map(data => new Date(data.x)))));
                    const monthCount = monthDiff(minDate, maxDate);

                    chart.options.plugins.title.text = `Depense sur ${monthCount} mois`;
                },
                beforeDraw: function (chart) {
                    const canvas = chart.canvas;
                    const ctx = canvas.getContext('2d');
                    const legendWidth = 120;
                    const legendHeight = 20;
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.fillRect(10, 10, legendWidth, legendHeight);
                    ctx.fillStyle = 'black';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '12px Arial';
                    ctx.fillText('Toggle chart type', 10 + legendWidth / 2, 10 + legendHeight / 2);
                    ctx.restore();
                },
                afterEvent: async function (chart, args) {
                    const event = args.event;
                    const legendWidth = 120;
                    const legendHeight = 20;
                    const withinLegendX = event.x >= 10 && event.x <= 10 + legendWidth;
                    const withinLegendY = event.y >= 10 && event.y <= 10 + legendHeight;

                    if (withinLegendX && withinLegendY && event.type === 'click') {
                        await chrome.storage.local.set({ 'chartType': chart.config.type === 'line' ? 'bar' : 'line' });
                        evt.dispatch('url_change');
                    }
                }
            }]
        };
    }
}
