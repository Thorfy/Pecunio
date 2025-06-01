class ChartDataBudget {
    constructor(transactions, categories, accountsSelected = null, settings) {
        this.transactions = transactions;
        this.categories = categories; // Keep for now, might be useful for filtering
        this.accountsSelected = accountsSelected;
        this.settings = settings;
    }

    async prepareData(granularity = 'monthly') { // granularity can be 'monthly' or 'yearly'
        const filteredTransactions = await this.applySettingOnData();
        const budgets = this.extractBudgets(filteredTransactions);
        const aggregatedBudgets = this.aggregateBudgets(budgets, granularity);
        return this.formatDataForDonutChart(aggregatedBudgets);
    }

    async applySettingOnData() {
        // Similar to ChartData.js, filter transactions based on date range and selected accounts
        // This might need adjustment if budget data is structured differently
        const startDate = Date.parse(settingClass.getSetting('startDate'));
        const endDate = Date.parse(settingClass.getSetting('endDate'));

        return this.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            // Assuming transaction.current_month is 0-indexed if it exists, otherwise adjust
            // For now, directly use transaction.date
            // if (transaction.hasOwnProperty('current_month')) {
            //     transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month);
            // }
            const modifiedDate = transactionDate.toDateString(); // Use toDateString for consistent date parsing

            const isDateInRange = (!startDate || !endDate) || (Date.parse(modifiedDate) >= startDate && Date.parse(modifiedDate) <= endDate);
            const isAccountSelected = !this.accountsSelected || this.accountsSelected.includes(parseInt(transaction.account.id));

            return isDateInRange && isAccountSelected;
        });
    }

    extractBudgets(transactions) {
        // This is a placeholder. We need to determine how budgets are stored.
        // For now, let's assume transactions have a 'budgetAmount' and 'budgetCategory' field.
        // Or, if budgets are defined per category, we might need to link transactions to category budgets.
        // This part will likely need significant changes based on actual data structure.

        // Example: Grouping transactions by category and summing amounts
        const budgets = {};
        transactions.forEach(transaction => {
            if (transaction.category && transaction.category.name) {
                const categoryName = transaction.category.name;
                budgets[categoryName] = (budgets[categoryName] || 0) + Math.abs(transaction.amount); // Assuming budget is positive
            }
        });
        return budgets; // This will be an object like { "Groceries": 500, "Transport": 150 }
    }

    aggregateBudgets(budgets, granularity) {
        // This method will further aggregate if needed (e.g., if budgets are monthly and we need yearly)
        // For now, extractBudgets is doing a simple sum, so this might not be complex.
        // If budgets were time-series (e.g., monthly budgets over a year), then aggregation here would be key.

        // For a simple donut chart of category totals, this might just return the budgets object.
        // If we were to show budget progression (e.g. budget used vs. total budget), this would be different.
        return budgets;
    }

    formatDataForDonutChart(aggregatedBudgets) {
        const labels = Object.keys(aggregatedBudgets);
        const data = Object.values(aggregatedBudgets);

        // Generate colors - can use a predefined palette or random generation
        const backgroundColors = labels.map((_, i) => `hsl(${i * (360 / labels.length)}, 70%, 50%)`);

        return {
            labels: labels,
            datasets: [{
                label: 'Budget',
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        };
    }

    // Helper function to parse colors if needed (can reuse from injected.js or ChartData.js)
    parseColorCSS(strClass) {
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);
        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();
        return colorVal;
    }
}

// Original injected.js content starts here
const evt = new Evt();
const settingClass = new Settings();
const dataClass = new BankinData();

let setting = settingClass.getAllSetting();
let currentUrl = location.href;

evt.listen('data_loaded', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during data_loaded event:", error);
    }
});

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
});

evt.listen('url_change', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during url_change event:", error);
    }
});

setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, 1000); // Consider using other methods to detect URL changes

async function build() {
    evt.dispatch('build called');

    await settingClass.loadSettings();

    if (location.href === "https://app2.bankin.com/accounts") {
        loadingScreen(); // This might clear the space needed for the new chart if not handled
        setTimeout(() => { new Hidder() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        if (refreshIcon) { // Ensure refreshIcon exists
            refreshIcon.addEventListener("click", () => {
                let cacheObject = {
                    ['cache_data_transactions']: "",
                    ['cache_time_transactions']: ""
                };
                setTimeout(async () => {
                    await settingClass.setSettings(cacheObject);
                    new BankinData(); // This reloads data, might need to reload budget chart too
                }, 1100);
            });
        }

        // Existing chart logic
        const chartData = new ChartData(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), settingClass.getSetting('accountsSelected'), setting);
        const preparedData = await chartData.prepareData();

        // Modification: Create separate containers for charts
        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            homeBlock.innerHTML = ""; // Clear existing content

            // Container for the original chart
            const originalChartContainer = document.createElement('div');
            originalChartContainer.id = "originalChartContainer";
            homeBlock.appendChild(originalChartContainer);
            const canvasOriginal = createCanvasElement(originalChartContainer); // createCanvasElement appends canvas
            const chartJsConfig = await chartData.getChartJsConfig();
            chartJsConfig.data = preparedData;
            new Chart(canvasOriginal.getContext('2d'), chartJsConfig);


            // Container for the new budget donut chart
            const budgetChartBlock = document.createElement('div');
            budgetChartBlock.id = "budgetChartBlock";
            budgetChartBlock.style.marginTop = "20px"; // Add some space
            homeBlock.appendChild(budgetChartBlock);

            const budgetTitle = document.createElement('h3');
            budgetTitle.textContent = "Budget Overview";
            budgetChartBlock.appendChild(budgetTitle);

            const budgetCanvas = createCanvasElement(budgetChartBlock); // createCanvasElement appends canvas
            const budgetCtx = budgetCanvas.getContext('2d');

            const budgetChartDataInstance = new ChartDataBudget(
                settingClass.getSetting('cache_data_transactions'),
                settingClass.getSetting('cache_data_categories'),
                settingClass.getSetting('accountsSelected'),
                setting
            );

            let currentBudgetData = await budgetChartDataInstance.prepareData('monthly');
            const budgetChart = new Chart(budgetCtx, {
                type: 'doughnut',
                data: currentBudgetData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: false, // Title is handled by budgetTitle h3
                            // text: 'Budget Donut Chart'
                        }
                    }
                }
            });

            // UI for switching granularity
            const buttonContainer = document.createElement('div');
            buttonContainer.style.textAlign = 'center';
            buttonContainer.style.marginTop = '10px';

            const monthlyButton = document.createElement('button');
            monthlyButton.textContent = 'Monthly';
            monthlyButton.style.marginRight = '5px';
            monthlyButton.onclick = async () => {
                currentBudgetData = await budgetChartDataInstance.prepareData('monthly');
                budgetChart.data = currentBudgetData;
                budgetChart.update();
            };

            const yearlyButton = document.createElement('button');
            yearlyButton.textContent = 'Yearly';
            yearlyButton.onclick = async () => {
                currentBudgetData = await budgetChartDataInstance.prepareData('yearly');
                budgetChart.data = currentBudgetData;
                budgetChart.update();
            };

            buttonContainer.appendChild(monthlyButton);
            buttonContainer.appendChild(yearlyButton);
            budgetChartBlock.appendChild(buttonContainer);

        } else {
            console.error("homeBlock not found for account page charts.");
        }

    } else if (location.href === "https://app2.bankin.com/categories") {
        const menu = document.querySelector("#monthSelector");
        if (menu) {
            menu.addEventListener("click", () => {
                evt.dispatch('url_change');
            }, { once: true });
        }

        const dateChoosedElem = document.querySelector("#monthSelector .active .dib");
        if (dateChoosedElem) {
            const dateChoosed = dateChoosedElem.textContent.toLocaleLowerCase();
            const chartData2 = new ChartData2(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), dateChoosed.split(" "));
            const preparedData = await chartData2.prepareData();

            let categBlock = document.getElementsByClassName("categoryChart");
            if (categBlock && categBlock[0]) {
                //categBlock[0].innerHTML = "";
                let canvasDiv = document.getElementsByClassName("canvasDiv")
                if (canvasDiv && canvasDiv.length > 0) {
                    for (let item of canvasDiv) {
                        item.remove()
                    }
                }
                canvasDiv = createCanvasElement(categBlock[0]);
                setTimeout(() => {
                    let h100 = document.querySelectorAll(".cntr.dtb.h100.active, .cntr.dtb.h100.notActive")
                    for (let item of h100) {
                        item.classList.remove("h100");
                    }
                }, 1000);

                const ctx = canvasDiv.getContext('2d');
                const myChart = new Chart(ctx, {
                    type: 'sankey',
                    data: {
                        datasets: [{
                            label: 'My Dataset',
                            data: preparedData,
                            colorFrom: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorTo: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorMode: '',
                        }]
                    },
                    options: {
                        responsive: true,
                    }
                });
            }
        }
    }
}

function loadingScreen() {
    const rightBlock = document.getElementsByClassName("rightColumn");
    if (rightBlock && rightBlock[0]) {
        const childBlock = rightBlock[0].children;

        const imgdiv = document.createElement('img');
        imgdiv.src = chrome.runtime.getURL("asset/Loading.gif");
        imgdiv.style.textAlign = "center";

        if (childBlock && childBlock[0]) { // Check if childBlock[0] exists
            childBlock[0].innerHTML = "";
            childBlock[0].appendChild(imgdiv);
        } else {
            console.error("childBlock[0] not found in loadingScreen");
        }
    }
    evt.dispatch('loading_sreen_display');
}

function createCanvasElement(parentElement) {
    const canvasDiv = document.createElement('canvas');
    canvasDiv.classList = "canvasDiv";

    if (parentElement) {
        parentElement.appendChild(canvasDiv);
    }

    return canvasDiv;
}

const annotation = {
    type: 'line',
    borderColor: 'black',
    borderDash: [6, 6],
    borderDashOffset: 0,
    borderWidth: 3,
    label: {
        enabled: true,
        content: (ctx) => 'Average: ' + average(ctx).toFixed(2),
        position: 'end'
    },
    scaleID: 'y',
    value: (ctx) => average(ctx)
};

function average(ctx) {
    const values = ctx.chart.data.datasets[0].data;
    return values.reduce((a, b) => a + b, 0) / values.length;
};

function parseColorCSS(strClass) {
    const styleElement = document.createElement("div");
    styleElement.className = strClass;
    document.body.appendChild(styleElement);

    const colorVal = window.getComputedStyle(styleElement).backgroundColor;
    styleElement.remove();

    return colorVal;
}