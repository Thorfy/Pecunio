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
