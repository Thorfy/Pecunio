class Category {
    constructor(id, name, parentId = null) {
        this.id = id;
        this.name = name;
        this.parentId = parentId;
    }

    static fromRaw(rawCategory, parentId = null) {
        return new Category(rawCategory.id, rawCategory.name, parentId);
    }
}

class Transaction {
    constructor(id, amount, date, description, categoryId, current_month) {
        this.id = id;
        this.amount = amount;
        this.date = date;
        this.description = description;
        this.categoryId = categoryId;
        this.current_month = current_month;
    }

    static fromRaw(rawTransaction) {
        return new Transaction(
            rawTransaction.id,
            rawTransaction.amount,
            rawTransaction.date,
            rawTransaction.description,
            rawTransaction.category.id,
            rawTransaction.current_month
        );
    }
}

class DataMerger {
    constructor(transactions, categorizations, startDate = null, endDate = null) {
        this.transactions = transactions.map(Transaction.fromRaw);
        this.categorizations = this.flattenCategories(categorizations);
        this.categoryMap = this.buildCategoryMap();
        this.startDate = startDate ? new Date(startDate) : null;
        this.endDate = endDate ? new Date(endDate) : null;
    }

    // Flatten and normalize the categorizations array
    flattenCategories(categorizations) {
        let flatCategories = [];
        categorizations.forEach(group => {
            flatCategories.push(Category.fromRaw(group));
            group.categories.forEach(category => {
                flatCategories.push(Category.fromRaw(category, group.id));
            });
        });
        return flatCategories;
    }

    // Build a map of categories for easy lookup
    buildCategoryMap() {
        let categoryMap = new Map();
        this.categorizations.forEach(category => {
            categoryMap.set(category.id, category);
        });
        return categoryMap;
    }

    // Merge transactions with their corresponding categories
    mergeData() {
        let filteredTransactions = [];
        this.transactions.forEach(transaction => {
            let transactionDate = new Date(transaction.date);
            if (transaction.current_month < 0) {
                transactionDate.setDate(30);
            } else if (transaction.current_month > 0) {
                transactionDate.setDate(1);
            }
            transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month);  // Adjust month

            transaction.date = transactionDate;  // Update transaction date
            let modifiedDate = transactionDate.toDateString();

            if (!(this.startDate && this.endDate) ||
                (Date.parse(modifiedDate) >= this.startDate && Date.parse(modifiedDate) <= this.endDate)) {
                filteredTransactions.push(transaction);
            }
        });

        let mergedData = filteredTransactions.map(transaction => {
            const category = this.categoryMap.get(transaction.categoryId) || {};
            return {
                transactionId: transaction.id,
                date: transaction.date.toISOString().split('T')[0],
                amount: transaction.amount,
                description: transaction.description,
                categoryId: category.id || null,
                categoryName: category.name || 'Uncategorized',
                parentCategoryId: category.parentId || null,
                parentCategoryName: category.parentId ? this.categoryMap.get(category.parentId).name : 'Uncategorized'
            };
        });

        // Sort transactions by date
        mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));

        return mergedData;
    }

    // Convert merged data to CSV format
    convertToCSV(data) {
        const header = ["Transaction ID", "Date", "Amount", "Description", "Category ID", "Category Name", "Parent Category ID", "Parent Category Name"];
        const csvRows = [header.join(",")];

        data.forEach(row => {
            const values = [
                row.transactionId,
                row.date,
                row.amount,
                `"${row.description}"`,
                row.categoryId,
                `"${row.categoryName}"`,
                row.parentCategoryId,
                `"${row.parentCategoryName}"`
            ];
            csvRows.push(values.join(","));
        });

        return csvRows.join("\r\n");
    }

    // Export merged data to CSV
    exportToCSV() {
        const mergedData = this.mergeData();
        const csvContent = this.convertToCSV(mergedData);
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);

        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "transaction_export_" + new Date().toLocaleDateString() + ".csv");
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);
    }
}

const evt = new Evt();
const settingClass = new Settings();
let setting;

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
});


document.addEventListener('DOMContentLoaded', async function () {

    await settingClass.loadSettings();

    let currentVersionImg = document.querySelector("#currentVersion");
    let cvSource = "https://img.shields.io/badge/installed-" + chrome.runtime.getManifest().version + "-blue";
    currentVersionImg.src = cvSource;

    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let accounts = document.querySelector('#accounts');
    let csvExport = document.querySelector("#exportCsv");
    let refresh = document.querySelector("#refresh");

    chrome.storage.local.get(['startDate', 'endDate'], function (data) {
        if (data.endDate != null && data.startDate != null) {
            startDate.value = data.startDate;
            endDate.value = data.endDate;
        } else {
            startDate.value = new Date(null).toDateInputValue();
            endDate.value = new Date().toDateInputValue();
        }
    });

    chrome.storage.local.get(['accountsList'], function (data) {
        if (data.accountsList != null) {
            for (const account of data.accountsList) {
                let newOption = new Option(account, account);
                accounts.add(newOption, undefined);
            }
        }
    });

    let inputs = [startDate, endDate, accounts];
    for (const input of inputs) {
        input.addEventListener('blur', function () {
            chrome.storage.local.set({ [this.id]: this.value });
        });
    }

    // Load data
    chrome.storage.local.get(['cache_data_transac', 'cache_data_categ'], function (data) {
        csvExport.addEventListener('click', function () {
            console.log(data, startDate.value, endDate.value)
            const dataMerger = new DataMerger(data.cache_data_transac, data.cache_data_categ, startDate.value, endDate.value);
            dataMerger.exportToCSV();
        });
    });

    refresh.addEventListener('click', function () {
        chrome.storage.local.clear(function () {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
            } else {
                console.log("data refresh");
                evt.dispatch('url_change');
            }
        });
    });
});
