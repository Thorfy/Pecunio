class SankeyChart extends BaseChartData {
    constructor(transactions, categories, params, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.params = params;
        this.chartInstance = null;
    }

    /**
     * Sélecteurs CSS utilisés par ce chart
     */
    static SELECTORS = {
        CATEGORY_CHART: Config.SELECTORS.CATEGORY_CHART
    };

    /**
     * Obtient la configuration Chart.js pour le Sankey chart
     * @param {Array} preparedData - Données préparées (optionnel, sera préparé si non fourni)
     * @returns {Promise<Object>} Configuration Chart.js
     */
    async getChartJsConfig(preparedData = null) {
        const data = preparedData || await this.prepareData();
        
        return {
            type: 'sankey',
            data: {
                datasets: [{
                    label: 'My Dataset',
                    data: data,
                    colorFrom: (c) => ColorParser.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                    colorTo: (c) => ColorParser.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                    colorMode: '',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                layout: {
                    padding: { top: 20, bottom: 20, left: 20, right: 20 }
                }
            }
        };
    }

    /**
     * Crée et affiche le chart dans le conteneur fourni
     * @param {HTMLElement} container - Conteneur parent (categBlock)
     * @returns {Promise<Chart>} Instance Chart.js créée
     */
    async render(container) {
        const preparedData = await this.prepareData();
        const chartJsConfig = await this.getChartJsConfig(preparedData);
        
        const { wrapper: sankeyWrapper, canvas: sankeyCanvas } = InjectedStyles.createSankeyChart('Flux financiers');
        container.appendChild(sankeyWrapper);

        this.chartInstance = new Chart(sankeyCanvas.getContext('2d'), chartJsConfig);
        
        // Ajuster les hauteurs des conteneurs après un délai
        setTimeout(() => {
            document.querySelectorAll(".cntr.dtb.h100.active, .cntr.dtb.h100.notActive").forEach(item => {
                item.classList.remove("h100");
            });
        }, 1000);

        return this.chartInstance;
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

        if (!categoryData || !Array.isArray(categoryData)) {
            console.warn('[SankeyChart] getDataFormated: Invalid categoryData');
            return datasets;
        }

        if (!transactionByCategory || !(transactionByCategory instanceof Map)) {
            console.warn('[SankeyChart] getDataFormated: Invalid transactionByCategory');
            return datasets;
        }

        categoryData.forEach(categoryParent => {
            if (!categoryParent || !categoryParent.id) {
                console.warn('[SankeyChart] getDataFormated: Invalid categoryParent', categoryParent);
                return;
            }

            const transactions = transactionByCategory.get(parseInt(categoryParent.id)) || [];
            let childData = []
            
            if (categoryParent.categories && Array.isArray(categoryParent.categories)) {
                categoryParent.categories.forEach(categoryEnfant => {
                    if (!categoryEnfant || !categoryEnfant.id) {
                        return;
                    }
                    const transactionsChild = transactionByCategory.get(parseInt(categoryEnfant.id)) || [];
                    childData.push({
                        "id": categoryEnfant.id,
                        "name": categoryEnfant.name,
                        "transactions": transactionsChild
                    })
                })
            }

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

        if (!data || !Array.isArray(data)) {
            console.warn('[SankeyChart] convertDataToSankeyFormat: Invalid data');
            return sankeyData;
        }

        // Traiter tous les nœuds de niveau supérieur.
        data.forEach(function (node) {
            if (!node || !node.id) {
                console.warn('[SankeyChart] convertDataToSankeyFormat: Invalid node', node);
                return;
            }

            if (node.child && Array.isArray(node.child)) {
                node.child.forEach(function (childNode) {
                    if (!childNode || !childNode.name) {
                        return;
                    }
                    
                    // Vérifier que transactions existe et est un tableau
                    const transactions = childNode.transactions || [];
                    if (!Array.isArray(transactions)) {
                        console.warn('[SankeyChart] convertDataToSankeyFormat: Invalid transactions for childNode', childNode);
                        return;
                    }

                    let totalAmount = transactions.reduce(function (total, transaction) {
                        if (!transaction || typeof transaction.amount !== 'number') {
                            return total;
                        }
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

            // Vérifier que transactions existe et est un tableau
            const transactions = node.transactions || [];
            if (!Array.isArray(transactions)) {
                console.warn('[SankeyChart] convertDataToSankeyFormat: Invalid transactions for node', node);
                return;
            }

            let totalAmount = transactions.reduce(function (total, transaction) {
                if (!transaction || typeof transaction.amount !== 'number') {
                    return total;
                }
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
