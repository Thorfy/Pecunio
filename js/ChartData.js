class ChartData {
    constructor(transactions, categories, accountsSelected = null, settings) {
        this.transactions = transactions;
        this.categories = categories;
        this.accountsSelected = accountsSelected;
        this.settings = settings;
    }

    async prepareData() {
        const filteredTransactions = await this.applySettingOnData();
        const transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        return this.getDataFormated(this.categories, transactionByCategory, true);
    }

    async applySettingOnData() {
        const startDate = Date.parse(settingClass.getSetting('startDate'));
        const endDate = Date.parse(settingClass.getSetting('endDate'));
        return this.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            transactionDate.setDate(1);
            transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month);
            transaction.date = transactionDate;
            const modifiedDate = transactionDate.toDateString();
            return (
                !(startDate && endDate) ||
                (Date.parse(modifiedDate) >= startDate && Date.parse(modifiedDate) <= endDate))
                && ((this.accountsSelected && this.accountsSelected.includes(parseInt(transaction.account.id))) || (this.accountsSelected == null)
                );
        });
    }

    mergeTransactionByCategory(allTransactions, allCategory) {
        const preparedData = [];
        const exceptionCat = [326, 282];

        allTransactions.forEach(transaction => {
            allCategory.forEach(category => {
                if (!preparedData[category.id]) preparedData[category.id] = [];

                if (transaction.category.id === category.id && !exceptionCat.includes(transaction.category.id)) {
                    preparedData[category.id].push(transaction);
                } else {
                    category.categories.forEach(childCategory => {
                        if (transaction.category.id === childCategory.id && !exceptionCat.includes(transaction.category.id)) {
                            preparedData[category.id].push(transaction);
                        }
                    });
                }
            });
        });

        return preparedData;
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        const data = { datasets: [] };
        const settingsList = categoryData.map(category => category.name);
        const settings = await chrome.storage.local.get(settingsList);

        categoryData.forEach(category => {
            const transactions = transactionByCategory[parseInt(category.id)];
            const dateValueObject = [];
            const transactionObject = {};

            transactions.forEach(transaction => {
                const dateObj = new Date(transaction.date);
                const month = `${dateObj.getMonth() + 1}`.padStart(2, "0");
                const year = dateObj.getUTCFullYear();
                const stringDate = [year, month].join("-");

                if (isCumulative) {
                    transactionObject[stringDate] = (transactionObject[stringDate] || 0) + transaction.amount;
                } else {
                    dateValueObject.push({ x: transaction.date, y: transaction.amount, name: transaction.name });
                }
            });

            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({ x: date, y: transactionObject[date] });
                }
            }

            const color = this.parseColorCSS("categoryColor_" + category.id);

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

    parseColorCSS(strClass) {
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);
        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();
        return colorVal;
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

    async getChartJsConfig() {
        const settings = await chrome.storage.local.get(['startDate', 'endDate', 'chartType']);
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
