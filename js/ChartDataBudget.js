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
