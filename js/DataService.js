// Assuming Evt.js is available for event listening if needed for BankinData updates.

class DataService {
    constructor(settingsService, bankinDataProvider) {
        this.settingsService = settingsService;
        this.bankinDataProvider = bankinDataProvider; // Instance of BankinData

        this.rawTransactions = [];
        this.rawCategories = [];
        this.rawAccounts = [];

        this.processedTransactions = []; // Transactions with date adjustments, etc.
        this.allCategoriesMap = new Map(); // For quick category lookup by ID
        this.parentCategoriesMap = new Map(); // Map of parent categories by ID

        this._initializeDataService();
    }

    async _initializeDataService() {
        // BankinData's constructor already initiates data loading.
        // We need a way to access data from bankinDataProvider once it's loaded.
        // Option 1: BankinData dispatches 'data_loaded' with the data.
        // Option 2: BankinData provides getters for its `this.dataVal`.
        // Option 3: Pass a callback to BankinData (more coupled).

        // Let's assume BankinData has a method to get its loaded data or that we can listen.
        // For now, let's use an event-based approach if BankinData signals completion.
        // If BankinData's `this.dataVal` is accessible directly after its own async loading,
        // then `bankinDataProvider.authRequest.then(() => ...)` could be a point, but that's internal to BankinData.

        // A simple approach: if bankinDataProvider.dataVal is populated after its internal promise resolves.
        // This requires bankinDataProvider to expose dataVal or provide getters.
        // Let's modify BankinData slightly later (Part C) to make this cleaner.
        // For now, we'll assume that after BankinData's constructor, eventually data is ready.
        // A more robust way is an explicit ready signal or getter returning a promise.

        // Listening to 'data_loaded' dispatched by BankinData
        evt.listen('data_loaded', () => {
            // Assuming bankinDataProvider.dataVal holds {transactions, categories, accounts}
            if (this.bankinDataProvider.dataVal) {
                this.rawTransactions = this.bankinDataProvider.dataVal.transactions || [];
                this.rawCategories = this.bankinDataProvider.dataVal.categories || [];
                this.rawAccounts = this.bankinDataProvider.dataVal.accounts || [];

                this._processInitialData();
                evt.dispatch('data_service_ready'); // Notify that DataService has processed data
                // console.log('DataService: Data loaded and processed.');
            } else {
                // console.error('DataService: data_loaded event received, but bankinDataProvider.dataVal is not set.');
            }
        });

        // If BankinData is already ready (e.g. data loaded from cache synchronously or very quickly)
        // we might need to check its state or it should re-dispatch 'data_loaded' or provide a getter.
        // For now, relying on the event.
    }

    _processInitialData() {
        // Build category maps
        this.allCategoriesMap.clear();
        this.parentCategoriesMap.clear();
        (this.rawCategories || []).forEach(category => {
            this.allCategoriesMap.set(category.id, category);
            if (!category.parent_id) { // Assuming items with null/undefined parent_id are parent categories
                this.parentCategoriesMap.set(category.id, category);
            }
        });

        // Process transactions (e.g., date adjustments)
        this.processedTransactions = (this.rawTransactions || []).map(transaction => {
            const tDate = new Date(transaction.date);
            // The logic from ChartData.applySettingOnData for date modification:
            // "transactionDate.setDate(1); transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month);"
            // This sets all dates to the 1st of the month. This might be specific to that chart's needs.
            // For a general DataService, raw dates might be more appropriate unless this adjustment is universally needed.
            // Let's keep the original date for now and apply such transforms in specific getters if needed, or make it a utility.
            // For filtering, we will need the effective date.

            let effectiveDate = new Date(transaction.date); // Start with original date
            if (transaction.current_month !== undefined && transaction.current_month !== null) {
                 // This logic seems to normalize the date to the 1st of a month for monthly grouping.
                 // Let's call it groupingDate for clarity, and keep original for exact filtering.
                 let groupingDate = new Date(transaction.date);
                 groupingDate.setDate(1);
                 groupingDate.setMonth(groupingDate.getMonth() + transaction.current_month);
                 return { ...transaction, effectiveDate: effectiveDate, groupingDate: groupingDate };
            }
            return { ...transaction, effectiveDate: effectiveDate };
        });
    }

    refreshData() {
        // This method would re-fetch from bankinDataProvider if it supports explicit refresh
        // and then re-process.
        // For now, assuming bankinDataProvider handles its own refresh and emits 'data_loaded'.
        // console.log("DataService: Refresh triggered (conceptually).");
    }

    getAllTransactions(includeProcessedDates = false) {
        return includeProcessedDates ? this.processedTransactions : this.rawTransactions;
    }

    getAllCategories() {
        return this.rawCategories;
    }

    getAllAccounts() {
        return this.rawAccounts;
    }

    getTransactions({ startDate, endDate, accountIds, dateField = 'effectiveDate' } = {}) {
        // Use settingsService to get default date range if not provided?
        // For now, only filter if values are actually provided.
        const start = startDate ? Date.parse(startDate) : null;
        const end = endDate ? Date.parse(endDate) : null;

        return this.processedTransactions.filter(transaction => {
            let dateToFilter = transaction[dateField] || transaction.effectiveDate;
            if (!(dateToFilter instanceof Date)) {
                 dateToFilter = new Date(dateToFilter);
            }

            const transactionDate = dateToFilter.getTime(); // Compare timestamps

            if (start && transactionDate < start) {
                return false;
            }
            if (end && transactionDate > end) {
                return false;
            }
            if (accountIds && accountIds.length > 0 && transaction.account) { // transaction.account might not exist
                if (!accountIds.includes(parseInt(transaction.account.id))) {
                    return false;
                }
            }
            return true;
        });
    }

    getParentCategory(categoryId) {
        const category = this.allCategoriesMap.get(categoryId);
        if (!category) {
            return null; // Category not found
        }
        if (category.parent_id) {
            return this.allCategoriesMap.get(category.parent_id) || null; // Return parent or null if parent_id points to non-existent
        }
        return category; // It's already a parent category (or has no parent_id)
    }

    aggregateByCategory(transactionsToAggregate, groupByParent = true) {
        const aggregated = {}; // Key: categoryId (parent or child based on flag), Value: { name, totalAmount, color, items: [] }

        (transactionsToAggregate || []).forEach(transaction => {
            const categoryIdToUse = groupByParent ? (this.getParentCategory(transaction.category_id)?.id || transaction.category_id) : transaction.category_id;
            const categoryInfo = this.allCategoriesMap.get(categoryIdToUse);

            if (!categoryInfo) {
                // console.warn(`Category info not found for ID: ${categoryIdToUse}`);
                return; // Skip if no category info
            }

            if (!aggregated[categoryIdToUse]) {
                aggregated[categoryIdToUse] = {
                    id: categoryIdToUse,
                    name: categoryInfo.name,
                    totalAmount: 0,
                    // Color would typically come from categoryInfo or be parsed via DomManipulator
                    // color: DomManipulator.parseColorCSS("categoryColor_" + categoryInfo.id) || '#cccccc',
                    color: categoryInfo.color || (this.getParentCategory(categoryIdToUse)?.color || '#CCC'), // simplified color access
                    items: []
                };
            }
            aggregated[categoryIdToUse].totalAmount += transaction.amount;
            aggregated[categoryIdToUse].items.push(transaction);
        });

        return Object.values(aggregated); // Return as an array of aggregated objects
    }
}
