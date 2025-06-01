class ChartDataBudget {
    constructor(transactions, categories, accountsSelected = null, settings) {
        this.transactions = transactions;
        this.categories = categories; // This holds the main category list with parent and child categories
        this.accountsSelected = accountsSelected;
        this.settings = settings;

        this.categoryLookup = new Map();
        if (this.categories && Array.isArray(this.categories)) {
            this.categories.forEach(parentCategory => {
                if (parentCategory && parentCategory.id != null && parentCategory.name) {
                    // Map parent category ID to its name (assuming we want to group by parent category name)
                    this.categoryLookup.set(parentCategory.id, parentCategory.name);
                    // Map all child category IDs to the same parent's name
                    if (parentCategory.categories && Array.isArray(parentCategory.categories)) {
                        parentCategory.categories.forEach(childCategory => {
                            if (childCategory && childCategory.id != null) {
                                this.categoryLookup.set(childCategory.id, parentCategory.name);
                            }
                        });
                    }
                }
            });
        }
        console.log('[ChartDataBudget] Constructor: categoryLookup initialized. Size:', this.categoryLookup.size, 'Map:', this.categoryLookup);
    }

    async prepareData(granularity = 'monthly') { // granularity can be 'monthly' or 'yearly'
        console.log('[ChartDataBudget] prepareData: Granularity:', granularity);
        const filteredTransactions = await this.applySettingOnData();
        const budgets = this.extractBudgets(filteredTransactions); // Uses this.categoryLookup
        const aggregatedBudgets = this.aggregateBudgets(budgets, granularity);
        return this.formatDataForDonutChart(aggregatedBudgets);
    }

    async applySettingOnData() {
        console.log('[ChartDataBudget] applySettingOnData: Initial transactions length:', this.transactions ? this.transactions.length : 'null');
        if (this.transactions && this.transactions.length > 0) console.log('[ChartDataBudget] applySettingOnData: Sample initial transaction:', this.transactions[0]);

        const startDateSetting = settingClass.getSetting('startDate');
        const endDateSetting = settingClass.getSetting('endDate');
        const startDate = startDateSetting ? Date.parse(startDateSetting) : null; // Keep null if setting is missing
        const endDate = endDateSetting ? Date.parse(endDateSetting) : null; // Keep null if setting is missing

        console.log('[ChartDataBudget] applySettingOnData: startDateSetting:', startDateSetting, 'parsed startDate:', startDate, 'endDateSetting:', endDateSetting, 'parsed endDate:', endDate);
        console.log('[ChartDataBudget] applySettingOnData: accountsSelected:', this.accountsSelected);

        if (!this.transactions) {
            console.warn('[ChartDataBudget] applySettingOnData: Transactions array is null or undefined.');
            return [];
        }

        return this.transactions.filter(transaction => {
            if (!transaction || !transaction.date || !transaction.account || transaction.account.id == null) {
                console.warn('[ChartDataBudget] applySettingOnData: Skipping transaction with missing critical fields:', transaction);
                return false;
            }
            const transactionDate = new Date(transaction.date);
            const modifiedDate = transactionDate.toDateString();

            // Ensure date parsing is valid before comparing
            const parsedTransactionDate = Date.parse(modifiedDate);
            if (isNaN(parsedTransactionDate)) {
                console.warn('[ChartDataBudget] applySettingOnData: Skipping transaction with invalid date:', transaction);
                return false;
            }

            let isDateInRange = true;
            if (startDate && endDate) { // Both dates are set
                isDateInRange = parsedTransactionDate >= startDate && parsedTransactionDate <= endDate;
            } else if (startDate) { // Only start date is set
                isDateInRange = parsedTransactionDate >= startDate;
            } else if (endDate) { // Only end date is set
                isDateInRange = parsedTransactionDate <= endDate;
            }
            // If neither startDate nor endDate is set, isDateInRange remains true (no date filtering)

            let isAccountSelected = true; // Default to true (no filtering) if accountsSelected is not set or empty
            if (this.accountsSelected && this.accountsSelected.length > 0) {
                isAccountSelected = this.accountsSelected.includes(parseInt(transaction.account.id));
            }

            return isDateInRange && isAccountSelected;
        });
    }

    extractBudgets(transactions) {
        console.log('[ChartDataBudget] extractBudgets: Input transactions length:', transactions ? transactions.length : 0);
        if (transactions && transactions.length > 0) console.log('[ChartDataBudget] extractBudgets: Sample input transaction:', transactions[0]);

        const budgets = {};
        if (!transactions) {
            console.warn('[ChartDataBudget] extractBudgets: Filtered transactions array is null or undefined.');
            return budgets;
        }

        transactions.forEach(transaction => {
            if (transaction && transaction.category && transaction.category.id != null && transaction.amount != null) {
                const categoryId = transaction.category.id;
                const categoryName = this.categoryLookup.get(categoryId);

                if (categoryName) {
                    budgets[categoryName] = (budgets[categoryName] || 0) + Math.abs(transaction.amount);
                } else {
                    console.warn(`[ChartDataBudget] extractBudgets: Category ID ${categoryId} (from transaction ${transaction.id || 'N/A'}) not found in categoryLookup map. Grouping as 'Unknown Category'.`);
                    const unknownCategoryName = `Unknown Category (${categoryId})`; // Or just 'Unknown Category' to group all unknown
                    budgets[unknownCategoryName] = (budgets[unknownCategoryName] || 0) + Math.abs(transaction.amount);
                }
            } else {
                // console.log('[ChartDataBudget] extractBudgets: Transaction skipped due to missing category, category.id, or amount:', transaction ? (transaction.id || 'N/A') : 'N/A');
            }
        });
        console.log('[ChartDataBudget] extractBudgets: Resulting budgets:', JSON.stringify(budgets));
        return budgets;
    }

    aggregateBudgets(budgets, granularity) {
        // For now, this doesn't do much with monthly/yearly for this simple sum
        console.log('[ChartDataBudget] aggregateBudgets: Input budgets:', JSON.stringify(budgets), 'Granularity:', granularity);
        return budgets;
    }

    formatDataForDonutChart(aggregatedBudgets) {
        console.log('[ChartDataBudget] formatDataForDonutChart: Input aggregatedBudgets:', JSON.stringify(aggregatedBudgets));
        const labels = Object.keys(aggregatedBudgets);
        const data = Object.values(aggregatedBudgets);
        let backgroundColors = [];

        if (labels.length > 0) {
            backgroundColors = labels.map((_, i) => `hsl(${i * (360 / labels.length)}, 70%, 50%)`);
        } else {
            console.log('[ChartDataBudget] formatDataForDonutChart: No labels, resulting in empty data and colors.');
        }
        console.log('[ChartDataBudget] formatDataForDonutChart: Result - labels:', labels, 'data:', data, 'colors:', backgroundColors);
        return {
            labels: labels,
            datasets: [{
                label: 'Budget', // This label appears in the tooltip
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        };
    }

    // Helper function to parse colors if needed (can reuse from injected.js or ChartData.js)
    // This specific parseColorCSS is not used by ChartDataBudget itself but might be by other parts of injected.js
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

            const rawTransactionsForBudget = settingClass.getSetting('cache_data_transactions');
            console.log('[InjectedJS] build (accounts): Raw transactions for budget chart (length):', rawTransactionsForBudget ? rawTransactionsForBudget.length : 'null');
            if (rawTransactionsForBudget && rawTransactionsForBudget.length > 0) console.log('[InjectedJS] build (accounts): Sample raw transaction for budget:', rawTransactionsForBudget[0]);

            const categoriesForBudget = settingClass.getSetting('cache_data_categories');
            console.log('[InjectedJS] build (accounts): Categories for budget chart (length):', categoriesForBudget ? categoriesForBudget.length : 'null');

            const accountsSelectedForBudget = settingClass.getSetting('accountsSelected');
            console.log('[InjectedJS] build (accounts): AccountsSelected for budget chart:', accountsSelectedForBudget);


            const budgetChartDataInstance = new ChartDataBudget(
                rawTransactionsForBudget,
                categoriesForBudget,
                accountsSelectedForBudget,
                setting
            );

            let currentBudgetData = await budgetChartDataInstance.prepareData('monthly');
            console.log('[InjectedJS] build (accounts): Data for budget chart (initial monthly):', JSON.stringify(currentBudgetData));
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
                console.log('[InjectedJS] build (accounts): Monthly button clicked');
                currentBudgetData = await budgetChartDataInstance.prepareData('monthly');
                console.log('[InjectedJS] build (accounts): Data for budget chart (monthly click):', JSON.stringify(currentBudgetData));
                budgetChart.data = currentBudgetData;
                budgetChart.update();
            };

            const yearlyButton = document.createElement('button');
            yearlyButton.textContent = 'Yearly';
            yearlyButton.onclick = async () => {
                console.log('[InjectedJS] build (accounts): Yearly button clicked');
                currentBudgetData = await budgetChartDataInstance.prepareData('yearly');
                console.log('[InjectedJS] build (accounts): Data for budget chart (yearly click):', JSON.stringify(currentBudgetData));
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