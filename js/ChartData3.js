class ChartData2 {
    constructor(transactions, categories, params) {
        this.transactions = transactions;
        this.categories = categories;
        this.params = params;
    }

    async prepareData() {
        let filteredTransactions = await this.applySettingOnData();
        let transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        let formattedData = await this.getDataFormated(this.categories, transactionByCategory, true);
        let sankeyData = this.convertDataToSankeyFormat(formattedData);
        return sankeyData;
    }

    applySettingOnData() {
        return new Promise(async (resolve, reject) => {
            let returned = []
            //get all period data
        })
    }

    mergeTransactionByCategory(allTransactions, allCategory) {
        //stack data by category
        return preparedData;
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        //create median and format data
        return datasets

    }
    
}
