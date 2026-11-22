import { BankinPage } from '../bankin/BankinPage.js';
import { formatEuros } from '../utils/format.js';
import { Config } from '../core/Config.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { ColorParser } from '../utils/ColorParser.js';
import { BaseChartData } from './base/BaseChartData.js';

export class SankeyChart extends BaseChartData {
    constructor(transactions, categories, params, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.params = params;
        this.chartInstance = null;
    }

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
                    label: 'Flux financiers',
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
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            // Quand blur: seulement from → to. Sinon: comportement par défaut Sankey (from → to : flow €)
                            label: (context) => {
                                if (Config.isBlurry()) {
                                    const r = context.raw || {};
                                    return r.from && r.to ? `${r.from} → ${r.to}` : (context.label || '');
                                }
                                const r = context.raw || {};
                                if (r.from != null && r.to != null && r.flow != null) {
                                    return `${r.from} → ${r.to} : ${formatEuros(Number(r.flow))}`;
                                }
                                return context.formatted != null ? context.formatted : (context.label || '');
                            }
                        }
                    }
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
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);

        // Ajuster les hauteurs des conteneurs après un délai
        setTimeout(() => {
            new BankinPage(document).categoryChartPanels().forEach(item => {
                item.classList.remove("h100");
            });
        }, 1000);

        return this.chartInstance;
    }

    async prepareData() {
        const filteredTransactions = this.applySettingOnDataByMonth(this.params[0], this.params[1]);
        const transactionByCategory = this.mergeTransactionByCategory(filteredTransactions, this.categories);
        const formattedData = this.getDataFormated(this.categories, transactionByCategory, true);
        const sankeyData = this.convertDataToSankeyFormat(formattedData);
        return sankeyData;
    }

    getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        const datasets = []

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
            const childData = []
            
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
    /**
     * Flux net d'un ensemble de transactions, toujours positif ou nul.
     * Revenus : somme des montants ; dépenses : opposé de la somme
     * (une dépense de 100 € remboursée de 40 € donne 60 €).
     * @param {Array} transactions
     * @param {boolean} isIncome
     * @returns {number}
     */
    static netFlow(transactions, isIncome) {
        const net = transactions.reduce((total, transaction) =>
            transaction && typeof transaction.amount === 'number' ? total + transaction.amount : total, 0);
        const flow = isIncome ? net : -net;
        return flow > 0 ? Math.round(flow * 100) / 100 : 0;
    }

    convertDataToSankeyFormat(data, exceptionalCategories = [Config.CATEGORIES.BUDGET_CATEGORY_ID]) {
        const sankeyData = [];
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

                    // Montant net : un remboursement réduit la dépense (bug B18)
                    const totalAmount = SankeyChart.netFlow(transactions, exceptionalCategories.includes(node.id));

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

            const totalAmount = SankeyChart.netFlow(transactions, exceptionalCategories.includes(node.id));

            if (!exceptionalCategories.includes(node.id) && totalAmount > 0) {
                totalExpense += totalAmount;
                sankeyData.push({ from: "Dépenses", to: node.name, flow: totalAmount, id: node.id });
            }
        });

        if (totalBudget > totalExpense) {
            sankeyData.push({ from: "Budget", to: "Restant", flow: totalBudget - totalExpense, id: Config.CATEGORIES.BUDGET_CATEGORY_ID });
        }
        sankeyData.push({ from: "Budget", to: "Dépenses", flow: totalExpense, id: Config.CATEGORIES.EXPENSES_CATEGORY_ID });

        return sankeyData;
    }
}
