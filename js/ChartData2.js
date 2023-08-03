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
            for (const transaction of this.transactions) {
                let transactionDate = new Date(transaction.date);
                //attention invalide date if no verif on day
                transactionDate.setDate(1)
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

        let datasets = []

        categoryData.forEach(categoryParent => {
            const transactions = transactionByCategory[parseInt(categoryParent.id)];
            let childData = []
            categoryParent.categories.forEach(categoryEnfant => {
                const transactionsChild = transactionByCategory[parseInt(categoryEnfant.id)];
                childData.push({
                    "id": categoryEnfant.id,
                    "name": categoryEnfant.name,
                    "transactions": transactionsChild
                })
            })

            datasets.push({
                "id": categoryParent.id,
                "name": categoryParent.name,
                "transactions": transactions,
                "child": childData
            })
        })
        return datasets

    }
    convertDataToSankeyFormat(data, exceptionalCategories = [2]) {
        var sankeyData = [];

        
        
        // Traiter tous les nœuds de niveau supérieur.
        data.forEach(function (node) {
            
            if(node.child){
                node.child.forEach(function (childNode){
                    let totalAmount = childNode.transactions.reduce(function (total, transaction) {
                        return total + Math.abs(transaction.amount);  // On utilise Math.abs pour éviter les valeurs négatives
                    }, 0);

                    if(exceptionalCategories.includes(node.id) && totalAmount > 0){
                        sankeyData.push({ from: childNode.name, to: "Budget", flow: totalAmount, id: node.id });
                    }else if(totalAmount > 0){
                        sankeyData.push({ from: node.name, to: childNode.name, flow: totalAmount , id: node.id });
                    }

                })
            }

            let totalAmount = node.transactions.reduce(function (total, transaction) {
                return total + Math.abs(transaction.amount);  // On utilise Math.abs pour éviter les valeurs négatives
            }, 0);

            if(!exceptionalCategories.includes(node.id) && totalAmount > 0){
                sankeyData.push({ from: "Budget", to: node.name, flow: totalAmount , id:node.id });
            }
        });

        return sankeyData;
    }
}
