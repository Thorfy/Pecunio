class SankeyChart extends BaseChartData {
    constructor(transactions, categories, params) {
        super(transactions, categories);
        this.params = params;
    }

    async prepareData() {
        let filteredTransactions = this.applySettingOnDataByMonth(this.params[0], this.params[1]);
        let transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        let formattedData = this.getDataFormated(this.categories, transactionByCategory, true);
        let sankeyData = this.convertDataToSankeyFormat(formattedData);
        return sankeyData;
    }

    getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        let datasets = []

        categoryData.forEach(categoryParent => {
            const transactions = transactionByCategory.get(parseInt(categoryParent.id));
            let childData = []
            categoryParent.categories.forEach(categoryEnfant => {
                const transactionsChild = transactionByCategory.get(parseInt(categoryEnfant.id));
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
        let totalExpense = 0;
        let totalBudget = 0;

        // Traiter tous les nœuds de niveau supérieur.
        data.forEach(function (node) {

            if (node.child) {
                node.child.forEach(function (childNode) {
                    let totalAmount = childNode.transactions.reduce(function (total, transaction) {
                        return total + Math.abs(transaction.amount);  // On utilise Math.abs pour éviter les valeurs négatives
                    }, 0);

                    if (exceptionalCategories.includes(node.id) && totalAmount > 0) {
                        totalBudget += totalAmount;
                        sankeyData.push({ from: childNode.name, to: "Budget", flow: totalAmount, id: node.id });
                    } else if (totalAmount > 0) {
                        sankeyData.push({ from: node.name, to: childNode.name, flow: totalAmount, id: node.id });
                    }
                })
            }

            let totalAmount = node.transactions.reduce(function (total, transaction) {
                return total + Math.abs(transaction.amount);  // On utilise Math.abs pour éviter les valeurs négatives
            }, 0);

            if (!exceptionalCategories.includes(node.id) && totalAmount > 0) {
                totalExpense += totalAmount;
                sankeyData.push({ from: "Depenses", to: node.name, flow: totalAmount, id: node.id });
            }
        });

        if (totalBudget > totalExpense) {
            sankeyData.push({ from: "Budget", to: "Restant", flow: totalBudget - totalExpense, id: 2 });
        }
        sankeyData.push({ from: "Budget", to: "Depenses", flow: totalExpense, id: 163 });


        return sankeyData;
    }
}
