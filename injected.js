class ChartDataBudget {
    constructor(transactions, categories, accountsSelected = null, settings) {
        this.transactions = transactions || []; // Ensure transactions is an array
        this.categories = categories;
        this.accountsSelected = accountsSelected;
        this.settings = settings; // Assuming settings object is passed for potential future use

        this.categoryLookup = new Map();
        if (this.categories && Array.isArray(this.categories)) {
            this.categories.forEach(parentCategory => {
                if (parentCategory && parentCategory.id != null && parentCategory.name) {
                    this.categoryLookup.set(parentCategory.id, parentCategory.name);
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
        console.log('[ChartDataBudget] Constructor: categoryLookup initialized. Size:', this.categoryLookup.size);
        // console.log('[ChartDataBudget] Constructor: categoryLookup map:', this.categoryLookup); // Optional: for deep debugging

        // Initialize organizedData
        this.organizedData = {};
        this._organizeTransactions();
        // console.log('[ChartDataBudget] Constructor: organizedData initialized.'); // Can be removed if _organizeTransactions logs enough
    }

    static _calculateMedian(arr) {
        if (!arr || arr.length === 0) return 0;
        // Filter out non-numeric values or handle them as needed
        const numericArr = arr.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericArr.length === 0) return 0;

        const sortedArr = [...numericArr].sort((a, b) => a - b);
        const mid = Math.floor(sortedArr.length / 2);
        if (sortedArr.length % 2 === 0) {
            return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
        } else {
            return sortedArr[mid];
        }
    }

    _organizeTransactions() {
        // console.log('[ChartDataBudget] _organizeTransactions: Starting with transactions count:', this.transactions.length);
        this.organizedData = {}; // Reset or initialize

        if (!this.transactions || this.transactions.length === 0) {
            console.warn('[ChartDataBudget] _organizeTransactions: No transactions to organize.');
            return;
        }

        // Apply account filtering if accountsSelected is provided
        let transactionsToProcess = this.transactions;
        if (this.accountsSelected && this.accountsSelected.length > 0) {
            transactionsToProcess = this.transactions.filter(t =>
                t.account && this.accountsSelected.includes(parseInt(t.account.id))
            );
            // console.log(`[ChartDataBudget] _organizeTransactions: Filtered by accounts ${this.accountsSelected}, count: ${transactionsToProcess.length}`);
        }

        transactionsToProcess.forEach(transaction => {
            if (!transaction || !transaction.date || !transaction.category || transaction.category.id == null || transaction.amount == null) {
                // console.warn('[ChartDataBudget] _organizeTransactions: Skipping transaction with missing critical fields:', transaction ? transaction.id : 'N/A');
                return;
            }

            const date = new Date(transaction.date);
            if (isNaN(date.getTime())) { // Check if date is valid
                // console.warn('[ChartDataBudget] _organizeTransactions: Skipping transaction with invalid date:', transaction ? transaction.id : 'N/A', transaction.date);
                return;
            }
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12 for months
            const categoryName = this.categoryLookup.get(transaction.category.id);

            if (!categoryName) {
                // console.warn(`[ChartDataBudget] _organizeTransactions: Category ID ${transaction.category.id} not found for transaction ${transaction.id || 'N/A'}.`);
                return;
            }

            if (!this.organizedData[year]) {
                this.organizedData[year] = {};
            }
            if (!this.organizedData[year][month]) {
                this.organizedData[year][month] = {};
            }
            if (!this.organizedData[year][month][categoryName]) {
                this.organizedData[year][month][categoryName] = [];
            }
            this.organizedData[year][month][categoryName].push(Math.abs(transaction.amount));
        });
        console.log(`[ChartDataBudget] _organizeTransactions: Completed. Organized data for ${Object.keys(this.organizedData).length} years.`);
    }

    getMedianMonthlySpendingForYear(year) {
        console.log(`[ChartDataBudget] getMedianMonthlySpendingForYear: Called for year ${year}.`);
        const result = {};
        if (!this.organizedData[year]) {
            console.warn(`[ChartDataBudget] getMedianMonthlySpendingForYear: No data found for year ${year}.`);
            return result;
        }

        const categoriesInYear = new Set();
        for (let month = 1; month <= 12; month++) {
            if (this.organizedData[year][month]) {
                Object.keys(this.organizedData[year][month]).forEach(cat => categoriesInYear.add(cat));
            }
        }

        categoriesInYear.forEach(categoryName => {
            const monthlyTotals = [];
            for (let month = 1; month <= 12; month++) {
                const amounts = this.organizedData[year][month]?.[categoryName] || [];
                const totalForMonth = amounts.reduce((sum, val) => sum + val, 0);
                if (totalForMonth > 0 || (this.organizedData[year][month] && this.organizedData[year][month][categoryName])) {
                     monthlyTotals.push(totalForMonth);
                }
            }
            if (monthlyTotals.length > 0) {
                 result[categoryName] = ChartDataBudget._calculateMedian(monthlyTotals);
            } else {
                result[categoryName] = 0;
            }
        });
        // console.log(`[ChartDataBudget] getMedianMonthlySpendingForYear: Result for ${year}:`, result); // Result can be large
        return result;
    }

    getActualSpendingForMonth(year, month) {
        console.log(`[ChartDataBudget] getActualSpendingForMonth: Called for year ${year}, month ${month}.`);
        const result = {};
        if (!this.organizedData[year] || !this.organizedData[year][month]) {
            console.warn(`[ChartDataBudget] getActualSpendingForMonth: No data found for year ${year}, month ${month}.`);
        }

        const allCategoryNames = new Set();
        this.categoryLookup.forEach(name => allCategoryNames.add(name));

        allCategoryNames.forEach(categoryName => {
            const amounts = this.organizedData[year]?.[month]?.[categoryName] || [];
            result[categoryName] = amounts.reduce((sum, val) => sum + val, 0);
        });
        // console.log(`[ChartDataBudget] getActualSpendingForMonth: Result for ${year}-${month}:`, result); // Result can be large
        return result;
    }

    getHistoricalMedianForMonth(targetMonth, currentYear) {
        console.log(`[ChartDataBudget] getHistoricalMedianForMonth: Called for month ${targetMonth}, up to year ${currentYear - 1}.`);
        const result = {};
        const historicalSpendingByCat = {};
        const allCategoryNames = new Set();
        this.categoryLookup.forEach(name => allCategoryNames.add(name));

        allCategoryNames.forEach(categoryName => {
            historicalSpendingByCat[categoryName] = [];
            for (const year in this.organizedData) {
                if (parseInt(year) < currentYear) {
                    if (this.organizedData[year][targetMonth] && this.organizedData[year][targetMonth][categoryName]) {
                        const monthlyTotal = this.organizedData[year][targetMonth][categoryName].reduce((sum, val) => sum + val, 0);
                        historicalSpendingByCat[categoryName].push(monthlyTotal);
                    } else {
                        if(this.organizedData[year] && Object.values(this.organizedData[year]).some(m => m[categoryName])) {
                             historicalSpendingByCat[categoryName].push(0);
                        }
                    }
                }
            }
            result[categoryName] = ChartDataBudget._calculateMedian(historicalSpendingByCat[categoryName]);
        });
        // console.log(`[ChartDataBudget] getHistoricalMedianForMonth: Result for month ${targetMonth} (vs prior years):`, result); // Result can be large
        return result;
    }

    // Main method to prepare data for charts
    async prepareData(selectedYear, selectedMonth) {
        console.log(`[ChartDataBudget] prepareData: For year ${selectedYear}, month ${selectedMonth}.`);

        let primaryData = {};
        let comparisonData = {};
        let primaryLabel = '';
        let comparisonLabel = '';
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; // For labels
        const _getMonthName = (monthNumber) => monthNames[monthNumber] || '';


        if (selectedMonth === 'ALL') {
            console.log('[ChartDataBudget] prepareData: Mode: ALL months selected.');
            primaryData = this.getMedianMonthlySpendingForYear(selectedYear);
            primaryLabel = `Median ${selectedYear}`;
            comparisonData = this.getMedianMonthlySpendingForYear(selectedYear - 1);
            comparisonLabel = `Median ${selectedYear - 1}`;
        } else { // month is a number
            console.log(`[ChartDataBudget] prepareData: Mode: Specific month ${selectedMonth}/${selectedYear}`);
            primaryData = this.getActualSpendingForMonth(selectedYear, selectedMonth);
            primaryLabel = `Actual ${_getMonthName(selectedMonth)} ${selectedYear}`;
            comparisonData = this.getHistoricalMedianForMonth(selectedMonth, selectedYear);
            comparisonLabel = `Hist. Median ${_getMonthName(selectedMonth)}`;
        }

        const allCategoryNames = new Set();
        Object.keys(primaryData).forEach(name => allCategoryNames.add(name));
        Object.keys(comparisonData).forEach(name => allCategoryNames.add(name));

        const categoryNamesArray = Array.from(allCategoryNames);
        let visibilitySettings = {};

        if (categoryNamesArray.length > 0 && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                visibilitySettings = await new Promise((resolve, reject) => {
                    chrome.storage.local.get(categoryNamesArray, (items) => {
                        if (chrome.runtime.lastError) {
                            console.error('[ChartDataBudget] Error fetching visibility settings:', chrome.runtime.lastError.message);
                            // Don't reject, just resolve with empty settings so chart can still render
                            resolve({});
                        } else {
                            resolve(items);
                        }
                    });
                });
                console.log('[ChartDataBudget] prepareData: Fetched visibilitySettings:', visibilitySettings);
            } catch (error) {
                console.error('[ChartDataBudget] prepareData: Failed to fetch visibility settings from chrome.storage.local:', error);
                // visibilitySettings remains {}
            }
        } else {
            if (categoryNamesArray.length === 0) {
                console.log('[ChartDataBudget] prepareData: No categories to fetch visibility for.');
            } else {
                console.warn('[ChartDataBudget] prepareData: chrome.storage.local not available. Cannot fetch visibility settings.');
            }
        }

        // For this subtask, filtering is NOT applied yet.
        const finalLabels = [];
        const primaryDatasetData = [];
        const comparisonDatasetData = [];

        categoryNamesArray.sort(); // Ensure consistent order

        for (const name of categoryNamesArray) {
            if (visibilitySettings[name] !== true) { // true means hidden, undefined or false means visible
                finalLabels.push(name);
                primaryDatasetData.push(primaryData[name] || 0);
                comparisonDatasetData.push(comparisonData[name] || 0);
            } else {
                console.log(`[ChartDataBudget] prepareData: Filtering out hidden category: ${name}`);
            }
        }

        console.log(`[ChartDataBudget] prepareData: Returning ${finalLabels.length} visible categories out of ${categoryNamesArray.length} total.`);

        return {
            labels: finalLabels,
            datasets: [
                { label: primaryLabel, data: primaryDatasetData, backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                { label: comparisonLabel, data: comparisonDatasetData, backgroundColor: 'rgba(255, 99, 132, 0.6)' }
            ]
        };
    }


    // --- Old methods below - to be evaluated for removal later ---
    // For now, they are kept to avoid breaking existing donut chart if it's still somehow used.
    // The main `build` function in `injected.js` will need to be updated to call the new `prepareData`
    // and use a bar chart.

    async applySettingOnData() {
        // This method was for the old prepareData and donut chart.
        // Its logic for date range and account filtering is now partially in _organizeTransactions (account filtering)
        // and date range filtering is implicitly handled by querying specific year/month from organizedData.
        // If global date range filtering is needed on top of organizedData, it's more complex.
        console.warn('[ChartDataBudget] applySettingOnData: This method is part of the old donut chart data flow and might be deprecated.');

        // Fallback to original transactions if no specific date filtering is applied here.
        // This is just to keep it from breaking if something old calls it.
        let transactionsToFilter = this.transactions;

        // Apply account filtering if accountsSelected is provided (similar to _organizeTransactions)
        if (this.accountsSelected && this.accountsSelected.length > 0) {
            transactionsToFilter = transactionsToFilter.filter(t =>
                t.account && this.accountsSelected.includes(parseInt(t.account.id))
            );
        }

        // Apply date range filtering from settings (if startDate/endDate are set in settings)
        const startDateSetting = settingClass.getSetting('startDate');
        const endDateSetting = settingClass.getSetting('endDate');
        const startDate = startDateSetting ? Date.parse(startDateSetting) : null;
        const endDate = endDateSetting ? Date.parse(endDateSetting) : null;

        if (startDate || endDate) {
            transactionsToFilter = transactionsToFilter.filter(transaction => {
                 if (!transaction || !transaction.date) return false;
                 const transactionDate = new Date(transaction.date);
                 const parsedTransactionDate = Date.parse(transactionDate.toDateString());
                 if (isNaN(parsedTransactionDate)) return false;

                 if (startDate && endDate) return parsedTransactionDate >= startDate && parsedTransactionDate <= endDate;
                 if (startDate) return parsedTransactionDate >= startDate;
                 if (endDate) return parsedTransactionDate <= endDate;
                 return true;
            });
        }
        // console.log('[ChartDataBudget] applySettingOnData (fallback): Filtered transactions length:', transactionsToFilter.length); // Can be removed
        return transactionsToFilter;
    }

    extractBudgets(transactions) {
        console.warn('[ChartDataBudget] extractBudgets: This method is part of the old donut chart data flow and should ideally not be called.');
        // console.log('[ChartDataBudget] extractBudgets: Input transactions length:', transactions ? transactions.length : 0); // Verbose
        // if (transactions && transactions.length > 0) console.log('[ChartDataBudget] extractBudgets: Sample input transaction:', transactions[0]); // Verbose

        const budgets = {};
        if (!transactions) {
            return budgets;
        }

        transactions.forEach(transaction => {
            if (transaction && transaction.category && transaction.category.id != null && transaction.amount != null) {
                const categoryId = transaction.category.id;
                const categoryName = this.categoryLookup.get(categoryId) || `Unknown Category (${categoryId})`;
                budgets[categoryName] = (budgets[categoryName] || 0) + Math.abs(transaction.amount);
            }
        });
        // console.log('[ChartDataBudget] extractBudgets: Resulting budgets:', JSON.stringify(budgets)); // Verbose
        return budgets;
    }

    aggregateBudgets(budgets, granularity) {
        console.warn('[ChartDataBudget] aggregateBudgets: This method is part of the old donut chart data flow and should ideally not be called.');
        // console.log('[ChartDataBudget] aggregateBudgets: Input budgets:', JSON.stringify(budgets), 'Granularity:', granularity); // Verbose
        return budgets;
    }

    formatDataForDonutChart(aggregatedBudgets) {
        console.warn('[ChartDataBudget] formatDataForDonutChart: This method is part of the old donut chart data flow and should ideally not be called.');
        // console.log('[ChartDataBudget] formatDataForDonutChart: Input aggregatedBudgets:', JSON.stringify(aggregatedBudgets)); // Verbose
        const labels = Object.keys(aggregatedBudgets);
        const data = Object.values(aggregatedBudgets);
        let backgroundColors = [];

        if (labels.length > 0) {
            backgroundColors = labels.map((_, i) => `hsl(${i * (360 / labels.length)}, 70%, 50%)`);
        } else {
            // console.log('[ChartDataBudget] formatDataForDonutChart: No labels, resulting in empty data and colors.'); // Not critical
        }
        // console.log('[ChartDataBudget] formatDataForDonutChart: Result - labels:', labels, 'data:', data, 'colors:', backgroundColors); // Verbose
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

    // parseColorCSS can remain as it's a general utility
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
            budgetTitle.textContent = "Median Budget Comparison"; // New Title
            budgetChartBlock.appendChild(budgetTitle);

            // --- NEW SELECTORS START ---
            const selectorContainer = document.createElement('div');
            selectorContainer.id = 'medianChartSelectors';
            selectorContainer.style.marginBottom = '15px';
            selectorContainer.style.marginTop = '10px'; // Added for spacing
            budgetChartBlock.appendChild(selectorContainer);

            // Year Selector
            const yearLabel = document.createElement('label');
            yearLabel.textContent = 'Year: ';
            yearLabel.htmlFor = 'yearSelectorMedian';
            selectorContainer.appendChild(yearLabel);
            const yearSelector = document.createElement('select');
            yearSelector.id = 'yearSelectorMedian';
            yearSelector.style.marginRight = '10px';
            const currentYr = new Date().getFullYear();
            for (let y = currentYr + 1; y >= 2015; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y;
                if (y === currentYr) option.selected = true;
                yearSelector.appendChild(option);
            }
            selectorContainer.appendChild(yearSelector);

            // Month Selector
            const monthLabel = document.createElement('label');
            monthLabel.textContent = 'Month: ';
            monthLabel.htmlFor = 'monthSelectorMedian';
            selectorContainer.appendChild(monthLabel);
            const monthSelector = document.createElement('select');
            monthSelector.id = 'monthSelectorMedian';
            const months = ["All Months", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            months.forEach((monthName, index) => {
                const option = document.createElement('option');
                option.value = (index === 0) ? "ALL" : index; // "ALL" or 1-12
                option.textContent = monthName;
                monthSelector.appendChild(option);
            });
            monthSelector.value = "ALL"; // Default
            selectorContainer.appendChild(monthSelector);
            // --- NEW SELECTORS END ---

            // Remove old donut chart buttons if they were in budgetChartBlock
            const oldButtonContainer = budgetChartBlock.querySelector('div[style*="text-align: center"]');
            if (oldButtonContainer) {
                console.log('[InjectedJS] Removing old button container for donut chart.')
                oldButtonContainer.remove();
            }

            const budgetCanvas = createCanvasElement(budgetChartBlock); // createCanvasElement appends canvas
            const budgetCtx = budgetCanvas.getContext('2d');

            const rawTransactionsForBudget = settingClass.getSetting('cache_data_transactions');
            console.log('[InjectedJS] build (accounts): Raw transactions for budget chart (length):', rawTransactionsForBudget ? rawTransactionsForBudget.length : 'null');
            // if (rawTransactionsForBudget && rawTransactionsForBudget.length > 0) console.log('[InjectedJS] build (accounts): Sample raw transaction for budget:', rawTransactionsForBudget[0]); // Verbose

            const categoriesForBudget = settingClass.getSetting('cache_data_categories');
            // console.log('[InjectedJS] build (accounts): Categories for budget chart (length):', categoriesForBudget ? categoriesForBudget.length : 'null'); // Verbose

            const accountsSelectedForBudget = settingClass.getSetting('accountsSelected');
            // console.log('[InjectedJS] build (accounts): AccountsSelected for budget chart:', accountsSelectedForBudget); // Can be sensitive or verbose

            const budgetChartDataInstance = new ChartDataBudget(
                rawTransactionsForBudget,
                categoriesForBudget,
                accountsSelectedForBudget,
                setting
            );

            let budgetChart = null; // Declare budgetChart here

            async function updateMedianChartView() {
                const selectedYear = parseInt(yearSelector.value);
                const monthValue = monthSelector.value;
                const selectedMonth = (monthValue === "ALL") ? "ALL" : parseInt(monthValue);

                console.log(`[InjectedJS] updateMedianChartView. Year: ${selectedYear}, Month: ${selectedMonth}`);

                if (!budgetChartDataInstance || typeof budgetChartDataInstance.prepareData !== 'function') {
                    console.error('[InjectedJS] budgetChartDataInstance is not ready or prepareData is missing.');
                    return;
                }

                const newChartData = await budgetChartDataInstance.prepareData(selectedYear, selectedMonth);
                // console.log('[InjectedJS] Data prepared for median bar chart:', JSON.stringify(newChartData)); // REMOVED - Too verbose

                if (!newChartData || !newChartData.labels || !newChartData.datasets || !Array.isArray(newChartData.datasets)) {
                    console.error('[InjectedJS] Invalid data structure received from prepareData for bar chart. Data:', newChartData);
                    if(budgetChart) {
                        budgetChart.data.labels = [];
                        budgetChart.data.datasets = [];
                        budgetChart.update();
                    }
                    return;
                }
                for(const dataset of newChartData.datasets) {
                    if (!Array.isArray(dataset.data)) {
                        console.error('[InjectedJS] Invalid dataset structure, missing data array:', dataset);
                        if(budgetChart) {
                           budgetChart.data.labels = [];
                           budgetChart.data.datasets = [];
                           budgetChart.update();
                        }
                        return;
                    }
                }

                if (budgetChart) {
                    // console.log('[InjectedJS] Updating existing median bar chart.'); // Retained, but less critical
                    budgetChart.data = newChartData;
                    budgetChart.options.plugins.title.text = `Comparison: ${selectedYear} ${monthValue === "ALL" ? "All Months (Median)" : months[parseInt(monthValue)]}`;
                    budgetChart.update();
                    // console.log('[InjectedJS] Median bar chart updated.'); // Retained, but less critical
                } else {
                    // console.log('[InjectedJS] Creating new median bar chart.'); // Retained
                    try {
                        budgetChart = new Chart(budgetCtx, {
                            type: 'bar',
                            data: newChartData,
                            options: {
                                responsive: true,
                                maintainAspectRatio: true,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: {
                                            display: true,
                                            text: 'Amount (€)'
                                        }
                                    },
                                    x: {
                                        title: {
                                            display: false,
                                            text: 'Categories'
                                        }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                    },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                    },
                                    title: { // Add dynamic title to chart options
                                        display: true,
                                        text: `Comparison: ${selectedYear} ${monthValue === "ALL" ? "All Months (Median)" : months[parseInt(monthValue)]}`
                                    }
                                }
                            }
                        });
                        console.log('[InjectedJS] New median bar chart created successfully.');
                    } catch (error) {
                        console.error('[InjectedJS] Error creating new median bar chart:', error);
                        budgetChart = null; // Ensure budgetChart is null if creation failed
                    }
                }
            }

            yearSelector.addEventListener('change', updateMedianChartView);
            monthSelector.addEventListener('change', updateMedianChartView);

            // Initial call to load the chart with default selector values
            // Ensure this runs after the main DOM elements are presumably available.
            // Using a small timeout can help if elements are not immediately ready in some cases.
            // console.log('[InjectedJS] Scheduling initial call to updateMedianChartView.'); // Retained
            setTimeout(updateMedianChartView, 0);

            // Extract known parent category names for the storage listener
            let knownCategoryNamesForVisibility = [];
            if (budgetChartDataInstance && budgetChartDataInstance.categories && Array.isArray(budgetChartDataInstance.categories)) {
                budgetChartDataInstance.categories.forEach(parentCat => {
                    if (parentCat && parentCat.name) {
                        knownCategoryNamesForVisibility.push(parentCat.name);
                    }
                });
                // console.log('[InjectedJS] Known parent category names for visibility checks:', knownCategoryNamesForVisibility);
            } else {
                console.warn('[InjectedJS] Could not retrieve known category names for storage listener setup from budgetChartDataInstance.categories.');
            }
            // Fallback or alternative: use categoryLookup keys if .categories isn't structured as expected or for broader coverage
            if (knownCategoryNamesForVisibility.length === 0 && budgetChartDataInstance && budgetChartDataInstance.categoryLookup) {
                 const uniqueNames = new Set(Array.from(budgetChartDataInstance.categoryLookup.values()));
                 knownCategoryNamesForVisibility = Array.from(uniqueNames);
                 // console.log('[InjectedJS] Using categoryLookup values for visibility checks:', knownCategoryNamesForVisibility);
            }


            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, areaName) => {
                    if (areaName === 'local') {
                        let relevantChangeDetected = false;
                        for (const key in changes) {
                            if (knownCategoryNamesForVisibility.includes(key)) {
                                // console.log(`[InjectedJS] Storage change detected for category '${key}':`, changes[key].newValue);
                                relevantChangeDetected = true;
                                break;
                            }
                        }

                        if (relevantChangeDetected) {
                            console.log('[InjectedJS] Relevant category visibility changed in storage, calling updateMedianChartView.');
                            updateMedianChartView();
                        }
                    }
                });
                console.log('[InjectedJS] Added chrome.storage.onChanged listener for category visibility.');
            } else {
                console.warn('[InjectedJS] chrome.storage.onChanged not available. Live updates on legend click will not work.');
            }

        } else {
            console.error("[InjectedJS] homeBlock not found for account page charts."); // Added prefix for consistency
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