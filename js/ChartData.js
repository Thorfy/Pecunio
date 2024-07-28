class ChartData {
    constructor(transactions, categories, settings) {
        //console.log(transactions, categories)

        this.transactions = transactions;
        this.categories = categories;
        this.settings = settings;
    }

    async prepareData() {
        let filteredTransactions = await this.applySettingOnData();
        let transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        let formattedData = await this.getDataFormated(this.categories, transactionByCategory, true);
        return formattedData;
    }

    applySettingOnData() {
        return new Promise(async (resolve, reject) => {

            let startDate = Date.parse(settingClass.getSetting('startDate'))
            let endDate = Date.parse(settingClass.getSetting('endDate'))
            let accounts = settingClass.getSetting('accounts');

            let returned = []
            for (const transaction of this.transactions) {
                let transactionDate = new Date(transaction.date);
                transactionDate.setDate(1);
                transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month)
                transaction.date = transactionDate;
                let modifiedDate = transactionDate.toDateString()
                if (!(startDate && endDate) || (Date.parse(modifiedDate) >= startDate && Date.parse(modifiedDate) <= endDate)) {
                    returned.push(transaction)
                }
            }
            resolve(returned)
        })
    }

    mergeTransactionByCategory(allTransactions, allCategory) {
        let preparedData = [];
        let exceptionCat = [326, 282]
        allTransactions.forEach(transaction => {
            allCategory.forEach(category => {
                if (!preparedData[category.id])
                    preparedData[category.id] = [];

                if (transaction.category.id === category.id && !exceptionCat.includes(transaction.category.id)) {
                    preparedData[category.id].push(transaction);
                } else {
                    category.categories.forEach(childCategory => {
                        if (transaction.category.id === childCategory.id && !exceptionCat.includes(transaction.category.id)) {
                            preparedData[category.id].push(transaction);
                        }
                    })
                }
            })

        })
        return preparedData;
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {

        let data = {
            datasets: []
        }
        let settingsList = []
        await categoryData.forEach(category => {
            settingsList.push(category.name)
        })
        let settings = await chrome.storage.local.get(settingsList)

        categoryData.forEach(category => {

            let transactions = transactionByCategory[parseInt(category.id)];
            let dateValueObject = [];
            let transactionObject = {};
            transactions.forEach(transaction => {

                // insert control of filter here 
                //period, account, cumulative

                let dateObj = new Date(transaction.date);
                //dateObj.setMonth(dateObj.getMonth() + transaction.current_month)

                let month = `${dateObj.getMonth() + 1}`.padStart(2, "0"); //months from 1-12
                let year = dateObj.getUTCFullYear();
                const stringDate = [year, month].join("-")

                if (isCumulative) {
                    if (!transactionObject[stringDate]) {
                        transactionObject[stringDate] = transaction.amount;
                    } else {
                        transactionObject[stringDate] += transaction.amount;
                    }
                } else {
                    dateValueObject.push({
                        x: transaction.date,
                        y: transaction.amount,
                        name: transaction.name
                    });
                }

            })
            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({
                        x: date,
                        y: transactionObject[date],
                    });
                }
            }
            //let get Config and load it 
            let dataCategory = {
                label: category.name,
                data: dateValueObject,
                backgroundColor: this.parseColorCSS("categoryColor_" + category.id),
                fill: false,
                tension: 0.3,
                hidden: settings[category.name]
            }

            data.datasets.push(dataCategory);
        })

        return data

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

        const homeBlock = document.getElementsByClassName("homeBlock");
        if (homeBlock && homeBlock[0]) {
            homeBlock[0].innerHTML = "";
            const canvasDiv = createCanvasElement(homeBlock[0]);
            const ctx = canvasDiv.getContext('2d');

            const myChart = new Chart(ctx, chartJsConfig);
        }
    }


    async getChartJsConfig() {
        const settings = await chrome.storage.local.get(['startDate', 'endDate', 'chartType']);
        const initialChartType = settings.chartType || 'bar'; // Default to 'bar' if not set
    
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
                    text: "Depense sur " + this.monthDiff(settings.startDate, settings.endDate) + " mois"
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
                    stacked: true,
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
                beforeInit: async function (chart) {
                    // Set initial dataset properties based on chart type
                    const newType = initialChartType;
                    chart.config.type = newType;
    
                    chart.data.datasets.forEach(dataset => {
                        dataset.type = newType;
                        if (newType === 'line') {
                            dataset.borderColor = dataset.backgroundColor;
                            dataset.fill = false;
                            dataset.tension = 0.3;
                        } else {
                            dataset.borderColor = undefined;
                            dataset.fill = true;
                        }
                    });
                },
                beforeDraw: function (chart) {
                    var canvas = chart.canvas;
                    var ctx = canvas.getContext('2d');
                    var legendWidth = 120;
                    var legendHeight = 20;
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
                    var event = args.event;
                    var legendWidth = 120;
                    var legendHeight = 20;
                    var withinLegendX = event.x >= 10 && event.x <= 10 + legendWidth;
                    var withinLegendY = event.y >= 10 && event.y <= 10 + legendHeight;
                    if (withinLegendX && withinLegendY && event.type === 'click') {
                        const newType = chart.config.type === 'line' ? 'bar' : 'line';
                        chart.config.type = newType;
    
                        // Ensure dataset properties are retained correctly
                        chart.data.datasets.forEach(dataset => {
                            dataset.type = newType;
                            if (newType === 'line') {
                                dataset.borderColor = dataset.backgroundColor;
                                dataset.fill = false;
                                dataset.tension = 0.3;
                            } else {
                                dataset.borderColor = undefined;
                                dataset.fill = true;
                            }
                        });
    
                        await chrome.storage.local.set({ 'chartType': newType }); // Save the new chart type to settings
                        chart.update();
                    }
                }
            }]
        };
    }

    monthDiff(dateFrom, dateTo) {
        dateFrom = new Date(dateFrom);
        dateTo = new Date(dateTo);

        return dateTo.getMonth() - dateFrom.getMonth() + (12 * (dateTo.getFullYear() - dateFrom.getFullYear()));
    }
}
