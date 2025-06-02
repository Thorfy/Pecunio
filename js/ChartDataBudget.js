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

    static _calculateAverage(arr) {
        if (!arr || arr.length === 0) return 0;
        const numericArr = arr.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericArr.length === 0) return 0;
    
        const sum = numericArr.reduce((acc, val) => acc + val, 0);
        return sum / numericArr.length;
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
                 console.warn(`[ChartDataBudget] _organizeTransactions: Cat ID ${transaction.category.id} not in lookup for tr ${transaction.id || 'N/A'}`);
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

    getCalculatedMonthlyValueForYear(year, calculationType = 'median') {
        console.log(`[ChartDataBudget] getCalculatedMonthlyValueForYear: Called for year ${year}, type: ${calculationType}.`);
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getCalculatedMonthlyValueForYear.');
            // No categories known, so result will remain empty unless data for a category is found below.
        }

        if (!this.organizedData[year]) {
            console.warn(`[ChartDataBudget] getCalculatedMonthlyValueForYear: No data found for year ${year}. Returning zeros for all known categories.`);
            return result; // result already contains all known categories initialized to 0
        }

        // Iterate over all known category names to ensure all are processed
        this.categoryLookup.forEach(categoryName => {
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
                    // If category generally exists in the year (i.e., has data in other months), count this month as 0.
                     if (Object.values(this.organizedData[year]).some(dataForMonth => dataForMonth.hasOwnProperty(categoryName))) {
                        monthlyTotals.push(0);
                        categoryHadDataInYear = true; // Mark that category has data within the year
                     }
                }
            }

            if (categoryHadDataInYear) {
                if (calculationType === 'average') {
                    result[categoryName] = ChartDataBudget._calculateAverage(monthlyTotals);
                } else { // Default to median
                    result[categoryName] = ChartDataBudget._calculateMedian(monthlyTotals);
                }
            } else {
                result[categoryName] = 0; // No data for this category in the entire year
            }
        });
        // console.log(`[ChartDataBudget] getCalculatedMonthlyValueForYear: Result for ${year}, type ${calculationType}:`, result); // Verbose
        return result;
    }

    getActualSpendingForMonth(year, month) {
        console.log(`[ChartDataBudget] getActualSpendingForMonth: Called for year ${year}, month ${month}.`);
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getActualSpendingForMonth.');
        }

        // Proceed to fill with actual data if present
        if (this.organizedData[year] && this.organizedData[year][month]) {
            // Iterate over the categories present in the specific month's data
            Object.keys(this.organizedData[year][month]).forEach(categoryName => {
                // Ensure this category is a known one, though organizedData should only contain known ones
                if (Array.from(this.categoryLookup.values()).includes(categoryName)) {
                    const amounts = this.organizedData[year][month][categoryName] || [];
                    result[categoryName] = amounts.reduce((sum, val) => sum + val, 0);
                }
            });
        } else {
            console.warn(`[ChartDataBudget] getActualSpendingForMonth: No data found for year ${year}, month ${month}. Returning zeros for all known categories.`);
        }
        return result;
    }

    getHistoricalCalculatedValueForMonth(targetMonth, currentYear, calculationType = 'median') {
        console.log(`[ChartDataBudget] getHistoricalCalculatedValueForMonth: Called for month ${targetMonth}, up to year ${currentYear - 1}, type: ${calculationType}.`);
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getHistoricalCalculatedValueForMonth.');
        }
        
        const allCategoryNames = new Set(this.categoryLookup.values()); // Still useful for iterating

        allCategoryNames.forEach(categoryName => {
            const historicalMonthlyTotals = [];
            for (const yearStr in this.organizedData) {
                const year = parseInt(yearStr);
                if (year < currentYear) { // Only consider years before the currentYear for historical data
                    // Check if the category existed in this month for this historical year
                    if (this.organizedData[year][targetMonth] && this.organizedData[year][targetMonth].hasOwnProperty(categoryName)) {
                        const amounts = this.organizedData[year][targetMonth][categoryName] || [];
                        historicalMonthlyTotals.push(amounts.reduce((sum, val) => sum + val, 0));
                    } else if (this.organizedData[year] && Object.values(this.organizedData[year]).some(dataForMonth => dataForMonth.hasOwnProperty(categoryName))) {
                        // If category exists in other months of that historical year, consider this targetMonth as 0 for that year
                        historicalMonthlyTotals.push(0);
                    }
                    // If category didn't exist at all in that historical year, it's implicitly excluded from historicalMonthlyTotals
                }
            }

            if (calculationType === 'average') {
                result[categoryName] = ChartDataBudget._calculateAverage(historicalMonthlyTotals);
            } else { // Default to median
                result[categoryName] = ChartDataBudget._calculateMedian(historicalMonthlyTotals);
            }
        });
        // console.log(`[ChartDataBudget] getHistoricalCalculatedValueForMonth: Result for month ${targetMonth}, type ${calculationType}:`, result); // Verbose
        return result;
    }

    async prepareData(selectedYear, selectedMonth, calculationType = 'median') { // Added calculationType parameter
        console.log(`[ChartDataBudget] prepareData: For year ${selectedYear}, month ${selectedMonth}, type: ${calculationType}.`);
        let primaryData = {}, comparisonData = {}, primaryLabel = '', comparisonLabel = '';
        const calcTypeString = calculationType.charAt(0).toUpperCase() + calculationType.slice(1);

        if (selectedMonth === 'ALL') {
            console.log('[ChartDataBudget] prepareData: Mode: ALL months selected.');
            primaryData = this.getCalculatedMonthlyValueForYear(selectedYear, calculationType); 
            primaryLabel = `${calcTypeString} ${selectedYear}`;
            comparisonData = this.getCalculatedMonthlyValueForYear(selectedYear - 1, calculationType);
            comparisonLabel = `${calcTypeString} ${selectedYear - 1}`;
        } else {
            console.log(`[ChartDataBudget] prepareData: Mode: Specific month ${selectedMonth}/${selectedYear}`);
            primaryData = this.getActualSpendingForMonth(selectedYear, selectedMonth); // Actual spending is always sum
            primaryLabel = `Actual ${this._getMonthName(selectedMonth)} ${selectedYear}`;
            comparisonData = this.getHistoricalCalculatedValueForMonth(selectedMonth, selectedYear, calculationType);
            comparisonLabel = `Hist. ${calcTypeString} ${this._getMonthName(selectedMonth)}`;
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
