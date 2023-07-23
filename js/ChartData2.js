class ChartData2 {
    constructor(transactions, categories, params) {
        this.transactions = transactions;
        this.categories = categories;
        this.params = params;
    }

    async prepareData() {
        let filteredTransactions = await this.applySettingOnData();
        let transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        //console.log(filteredTransactions, transactionByCategory)
        //let formattedData = await this.getDataFormated(this.categories, transactionByCategory, true);
        //return formattedData;
    }

    applySettingOnData() {
        return new Promise(async (resolve, reject) => {
            let returned = []
            for (const transaction of this.transactions) {
                let transactionDate = new Date(transaction.date);
                transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month)
                
                if ((transactionDate.toLocaleString('default', { month: 'long' }) === this.params[0]) && (transactionDate.getUTCFullYear() === parseInt(this.params[1]))) {
                    returned.push(transaction)
                }
            }
            resolve(returned)
        })
    }

    mergeTransactionByCategory(allTransactions, allCategory) {
        let preparedData = [];
        //TODO CONSTANT
        let exceptionCat = [326, 282]
        allTransactions.forEach(transaction => {
            allCategory.forEach(category => {
                if (!preparedData[category.id])
                    preparedData[category.id] = [];

                if (transaction.category.id === category.id && !exceptionCat.includes(transaction.category.id)) {
                    preparedData[category.id].push(transaction);
                } else {
                    category.categories.forEach(childCategory => {
                        if (!preparedData[childCategory.id])
                            preparedData[childCategory.id] = [];

                        if (transaction.category.id === childCategory.id && !exceptionCat.includes(transaction.category.id)) {
                            preparedData[category.id].push(transaction);
                            preparedData[childCategory.id].push(transaction);
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
                borderColor: parseColorCSS("categoryColor_" + category.id),
                fill: false,
                tension: 0.3,
                hidden: settings[category.name]
            }

            data.datasets.push(dataCategory);
        })

        return data

    }
}
