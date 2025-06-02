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

        this.organizedData = {};
        this._organizeTransactions();
    }

    static _calculateMedian(arr) {
        if (!arr || arr.length === 0) return 0;
        const numericArr = arr.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericArr.length === 0) return 0;
        const sortedArr = [...numericArr].sort((a, b) => a - b);
        const mid = Math.floor(sortedArr.length / 2);
        return sortedArr.length % 2 === 0 ? (sortedArr[mid - 1] + sortedArr[mid]) / 2 : sortedArr[mid];
    }

    _organizeTransactions() {
        this.organizedData = {};
        if (!this.transactions || this.transactions.length === 0) {
            console.warn('[ChartDataBudget] _organizeTransactions: No transactions to organize.');
            return;
        }
        let transactionsToProcess = this.transactions;
        if (this.accountsSelected && this.accountsSelected.length > 0) {
            transactionsToProcess = this.transactions.filter(t =>
                t.account && t.account.id != null && this.accountsSelected.includes(parseInt(t.account.id))
            );
        }
        transactionsToProcess.forEach(transaction => {
            if (!transaction || !transaction.date || !transaction.category || transaction.category.id == null || transaction.amount == null) return;
            const date = new Date(transaction.date);
            if (isNaN(date.getTime())) return;
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const categoryName = this.categoryLookup.get(transaction.category.id);
            if (!categoryName) {
                 // console.warn(`[ChartDataBudget] _organizeTransactions: Cat ID ${transaction.category.id} not in lookup for tr ${transaction.id || 'N/A'}`);
                return;
            }
            if (!this.organizedData[year]) this.organizedData[year] = {};
            if (!this.organizedData[year][month]) this.organizedData[year][month] = {};
            if (!this.organizedData[year][month][categoryName]) this.organizedData[year][month][categoryName] = [];
            this.organizedData[year][month][categoryName].push(Math.abs(transaction.amount));
        });
        console.log(`[ChartDataBudget] _organizeTransactions: Completed. Organized data for ${Object.keys(this.organizedData).length} years.`);
    }

    _getMonthName(monthNumber) {
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return monthNames[monthNumber] || '';
    }

    getMedianMonthlySpendingForYear(year) {
        console.log(`[ChartDataBudget] getMedianMonthlySpendingForYear: Called for year ${year}.`);
        const result = {};
        if (!this.organizedData[year]) {
            // Populate with all known categories from categoryLookup, ensuring 0 if no data
            this.categoryLookup.forEach(name => { if (!result[name]) result[name] = 0; });
            return result;
        }
        const categoriesInYear = new Set();
        this.categoryLookup.forEach(name => categoriesInYear.add(name)); // Start with all known categories

        categoriesInYear.forEach(categoryName => {
            const monthlyTotals = [];
            let categoryHadDataInYear = false;
            for (let m = 1; m <= 12; m++) {
                const amounts = this.organizedData[year][m]?.[categoryName] || [];
                const totalForMonth = amounts.reduce((sum, val) => sum + val, 0);
                // Only push if the category existed in that month, even if total is 0
                if (this.organizedData[year][m] && this.organizedData[year][m].hasOwnProperty(categoryName)) {
                    monthlyTotals.push(totalForMonth);
                    categoryHadDataInYear = true;
                } else {
                    // If category generally exists in the year but not this month, count month as 0 for median
                     if (Object.values(this.organizedData[year]).some(dataForMonth => dataForMonth.hasOwnProperty(categoryName))) {
                        monthlyTotals.push(0);
                        categoryHadDataInYear = true;
                     }
                }
            }
            result[categoryName] = categoryHadDataInYear ? ChartDataBudget._calculateMedian(monthlyTotals) : 0;
        });
        return result;
    }

    getActualSpendingForMonth(year, month) {
        console.log(`[ChartDataBudget] getActualSpendingForMonth: Called for year ${year}, month ${month}.`);
        const result = {};
        const allCategoryNames = new Set(this.categoryLookup.values());
        allCategoryNames.forEach(categoryName => {
            const amounts = this.organizedData[year]?.[month]?.[categoryName] || [];
            result[categoryName] = amounts.reduce((sum, val) => sum + val, 0);
        });
        return result;
    }

    getHistoricalMedianForMonth(targetMonth, currentYear) {
        console.log(`[ChartDataBudget] getHistoricalMedianForMonth: Called for month ${targetMonth}, up to year ${currentYear - 1}.`);
        const result = {};
        const allCategoryNames = new Set(this.categoryLookup.values());

        allCategoryNames.forEach(categoryName => {
            const historicalMonthlyTotals = [];
            for (const yearStr in this.organizedData) {
                const year = parseInt(yearStr);
                if (year < currentYear) {
                    // Check if the category existed in this month for this year
                    if (this.organizedData[year][targetMonth] && this.organizedData[year][targetMonth].hasOwnProperty(categoryName)) {
                        const amounts = this.organizedData[year][targetMonth][categoryName] || [];
                        historicalMonthlyTotals.push(amounts.reduce((sum, val) => sum + val, 0));
                    } else if (this.organizedData[year] && Object.values(this.organizedData[year]).some(dataForMonth => dataForMonth.hasOwnProperty(categoryName))) {
                        // If category exists in other months of that year, consider this month as 0 for historical median
                        historicalMonthlyTotals.push(0);
                    }
                }
            }
            result[categoryName] = ChartDataBudget._calculateMedian(historicalMonthlyTotals);
        });
        return result;
    }

    async prepareData(selectedYear, selectedMonth) {
        console.log(`[ChartDataBudget] prepareData: For year ${selectedYear}, month ${selectedMonth}.`);
        let primaryData = {}, comparisonData = {}, primaryLabel = '', comparisonLabel = '';

        if (selectedMonth === 'ALL') {
            console.log('[ChartDataBudget] prepareData: Mode: ALL months selected.');
            primaryData = this.getMedianMonthlySpendingForYear(selectedYear);
            primaryLabel = `Median ${selectedYear}`;
            comparisonData = this.getMedianMonthlySpendingForYear(selectedYear - 1);
            comparisonLabel = `Median ${selectedYear - 1}`;
        } else {
            console.log(`[ChartDataBudget] prepareData: Mode: Specific month ${selectedMonth}/${selectedYear}`);
            primaryData = this.getActualSpendingForMonth(selectedYear, selectedMonth);
            primaryLabel = `Actual ${this._getMonthName(selectedMonth)} ${selectedYear}`;
            comparisonData = this.getHistoricalMedianForMonth(selectedMonth, selectedYear);
            comparisonLabel = `Hist. Median ${this._getMonthName(selectedMonth)}`;
        }

        const allCategoryNames = new Set();
        Object.keys(primaryData).forEach(name => allCategoryNames.add(name));
        Object.keys(comparisonData).forEach(name => allCategoryNames.add(name));
        const categoryNamesArray = Array.from(allCategoryNames).sort();

        let visibilitySettings = {};
        if (categoryNamesArray.length > 0 && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                visibilitySettings = await new Promise((resolve) => { // Removed reject for simplicity, always resolve
                    chrome.storage.local.get(categoryNamesArray, (items) => {
                        if (chrome.runtime.lastError) {
                            console.error('[ChartDataBudget] Error fetching visibility settings:', chrome.runtime.lastError.message);
                            resolve({}); // Resolve with empty on error
                        } else {
                            resolve(items);
                        }
                    });
                });
                // console.log('[ChartDataBudget] prepareData: Fetched visibilitySettings:', visibilitySettings); // Verbose
            } catch (error) { // Should not be reached if promise always resolves
                console.error('[ChartDataBudget] prepareData: Exception fetching visibility settings:', error);
            }
        } else if (categoryNamesArray.length === 0) {
             console.log('[ChartDataBudget] prepareData: No categories to fetch visibility for.');
        } else {
             console.warn('[ChartDataBudget] prepareData: chrome.storage.local not available.');
        }

        const finalLabels = [], primaryDatasetData = [], comparisonDatasetData = [];
        for (const name of categoryNamesArray) {
            if (visibilitySettings[name] !== true) { // true means hidden
                finalLabels.push(name);
                primaryDatasetData.push(primaryData[name] || 0);
                comparisonDatasetData.push(comparisonData[name] || 0);
            } else {
                // console.log(`[ChartDataBudget] prepareData: Filtering out hidden category: ${name}`); // Verbose
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

    // --- Old methods (kept with warnings) ---
    async applySettingOnData() {
        console.warn('[ChartDataBudget] applySettingOnData: OLD METHOD. Part of donut chart flow.');
        return this.transactions || []; // Simplified fallback
    }
    extractBudgets(transactionsInput) {
        console.warn('[ChartDataBudget] extractBudgets: OLD METHOD. Part of donut chart flow.');
        const budgets = {};
        const tr = transactionsInput || [];
        tr.forEach(t => { /* simplified logic */ });
        return budgets;
    }
    aggregateBudgets(budgets, granularity) {
        console.warn('[ChartDataBudget] aggregateBudgets: OLD METHOD. Part of donut chart flow.');
        return budgets;
    }
    formatDataForDonutChart(aggregatedBudgets) {
        console.warn('[ChartDataBudget] formatDataForDonutChart: OLD METHOD. Part of donut chart flow.');
        return { labels: [], datasets: [{ data: [] }] };
    }
    parseColorCSS(strClass) { // Utility, can stay
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);
        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();
        return colorVal;
    }
}
