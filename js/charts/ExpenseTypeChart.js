import { Config } from '../core/Config.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { BaseChartData } from './base/BaseChartData.js';

/**
 * ExpenseTypeChart - Graphique pour visualiser la répartition des expense_type
 * Affiche un graphique en donut/pie pour montrer la distribution des types de dépenses
 */
export class ExpenseTypeChart extends BaseChartData {
    constructor(transactions, categories, params, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.params = params; // [mois, année] pour filtrer par période
        this.chartInstance = null;
    }

    /**
     * Mapping centralisé des types de dépenses (name, icon, color)
     */
    static EXPENSE_TYPE_MAPPING = {
        'ESSENTIAL': { 
            name: 'Essentiel', 
            icon: '🏠', 
            color: 'rgba(102, 126, 234, 0.8)' 
        },
        'PLEASURE': { 
            name: 'Plaisir', 
            icon: '🎯', 
            color: 'rgba(255, 99, 132, 0.8)' 
        },
        'OTHER': { 
            name: 'Autre', 
            icon: '📦', 
            color: 'rgba(199, 199, 199, 0.8)' 
        },
        'SAVING': { 
            name: 'Épargne', 
            icon: '💰', 
            color: 'rgba(75, 192, 192, 0.8)' 
        }
    };

    /**
     * Prépare le conteneur pour le chart (doit être appelé avant render)
     * @param {HTMLElement} categBlock - Élément categoryChart
     * @returns {HTMLElement} Conteneur de ligne pour les charts
     */
    static prepareContainer(categBlock) {
        InjectedStyles.inject();
        InjectedStyles.cleanupPecunioElements(categBlock);

        let chartsRowContainer = categBlock.querySelector('.pecunio-charts-row');
        if (!chartsRowContainer) {
            chartsRowContainer = InjectedStyles.createChartsRow();
        }
        InjectedStyles.organizeDonutContent(categBlock, chartsRowContainer);
        
        return chartsRowContainer;
    }

    /**
     * Crée et affiche le chart dans le conteneur fourni
     * @param {HTMLElement} chartsRowContainer - Conteneur de ligne pour les charts
     * @returns {Promise<Chart>} Instance Chart.js créée
     */
    async render(chartsRowContainer) {
        const preparedData = await this.prepareData();
        const chartJsConfig = await this.getChartJsConfig();
        chartJsConfig.data = preparedData;

        const { wrapper: expenseTypeWrapper, canvas: expenseTypeCanvas } = InjectedStyles.createDonutChart('Types de dépenses');
        chartsRowContainer.appendChild(expenseTypeWrapper);

        this.chartInstance = new Chart(expenseTypeCanvas.getContext('2d'), chartJsConfig);
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);
        return this.chartInstance;
    }

    /**
     * Prépare les données pour le graphique expense_type
     * @returns {Promise<Object>} Données formatées pour Chart.js
     */
    async prepareData() {
        // Filtrer les transactions par mois/année si des paramètres sont fournis
        let filteredTransactions = this.transactions || [];
        if (this.params && this.params.length >= 2) {
            filteredTransactions = this.applySettingOnDataByMonth(this.params[0], this.params[1]);
        }

        // Grouper les transactions par expense_type
        const expenseTypeMap = new Map();
        
        filteredTransactions.forEach(transaction => {
            // Ignorer les transactions invalides
            if (!transaction || !transaction.expense_type) {
                return;
            }

            // Exclure strictement les revenus (montants positifs ou nuls)
            // On ne garde que les dépenses (montants strictement négatifs)
            if (transaction.amount >= 0) {
                return;
            }

            // Exclure les catégories d'exception (comme dans les autres charts)
            if (transaction.category && this.isExceptionCategory(transaction.category.id)) {
                return;
            }

            const expenseType = transaction.expense_type;
            const amount = Math.abs(transaction.amount); // Utiliser la valeur absolue

            if (!expenseTypeMap.has(expenseType)) {
                expenseTypeMap.set(expenseType, 0);
            }
            expenseTypeMap.set(expenseType, expenseTypeMap.get(expenseType) + amount);
        });

        // Si aucune donnée, retourner un graphique vide avec un message
        if (expenseTypeMap.size === 0) {
            return {
                labels: ['Aucune donnée'],
                datasets: [{
                    label: 'Montant par type de dépense',
                    data: [1],
                    backgroundColor: ['rgba(200, 200, 200, 0.5)'],
                    borderColor: ['rgba(200, 200, 200, 0.8)'],
                    borderWidth: 2
                }]
            };
        }

        // Convertir en format Chart.js
        const labels = [];
        const data = [];
        const expenseTypes = []; // Garder les types bruts pour les couleurs

        expenseTypeMap.forEach((total, expenseType) => {
            labels.push(this._formatExpenseType(expenseType));
            data.push(total);
            expenseTypes.push(expenseType);
        });

        // Générer les couleurs en fonction des types
        const colors = this._generateColors(expenseTypeMap.size, expenseTypes);

        return {
            labels: labels,
            datasets: [{
                label: 'Montant par type de dépense',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => this._darkenColor(color, 0.2)),
                borderWidth: 2
            }],
            expenseTypes: expenseTypes // Stocker les types bruts pour la légende
        };
    }

    /**
     * Obtient la configuration Chart.js pour un graphique en donut
     * @returns {Promise<Object>} Configuration Chart.js
     */
    async getChartJsConfig() {
        return {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 12,
                            font: {
                                size: 13,
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const dataset = data.datasets[0];
                                    return data.labels.map((label, i) => {
                                        return {
                                            text: label,
                                            fillStyle: dataset.backgroundColor[i],
                                            strokeStyle: dataset.borderColor[i],
                                            lineWidth: dataset.borderWidth,
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const labelWithoutIcon = label.replace(/^[^\s]+\s/, '');
                                if (Config.isBlurry()) return labelWithoutIcon;
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                if (total === 0 || label === 'Aucune donnée') {
                                    return 'Aucune donnée disponible';
                                }
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${labelWithoutIcon}: ${value.toFixed(2)} € (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%' // Pour un style donut plus moderne
            }
        };
    }

    /**
     * Formate le nom de l'expense_type pour l'affichage avec icône
     * @param {string} expenseType - Type de dépense brut
     * @returns {string} Type formaté avec icône
     */
    _formatExpenseType(expenseType) {
        const mapped = ExpenseTypeChart.EXPENSE_TYPE_MAPPING[expenseType] || { 
            name: expenseType, 
            icon: '📦' 
        };
        return `${mapped.icon} ${mapped.name}`;
    }

    /**
     * Génère des couleurs pour le graphique selon le type de dépense
     * @param {number} count - Nombre de couleurs à générer
     * @param {Array<string>} expenseTypes - Types de dépenses pour assigner des couleurs spécifiques
     * @returns {Array<string>} Tableau de couleurs
     */
    _generateColors(count, expenseTypes = []) {
        const defaultColor = 'rgba(199, 199, 199, 0.8)';

        // Si on a les types, utiliser les couleurs spécifiques depuis le mapping
        if (expenseTypes.length > 0) {
            return expenseTypes.map(type => {
                const mapping = ExpenseTypeChart.EXPENSE_TYPE_MAPPING[type];
                return mapping ? mapping.color : defaultColor;
            });
        }

        // Sinon, utiliser des couleurs par défaut depuis le mapping
        const baseColors = Object.values(ExpenseTypeChart.EXPENSE_TYPE_MAPPING)
            .map(mapping => mapping.color);

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length] || defaultColor);
        }
        return colors;
    }

    /**
     * Assombrit une couleur
     * @param {string} color - Couleur au format rgba
     * @param {number} factor - Facteur d'assombrissement (0-1)
     * @returns {string} Couleur assombrie
     */
    _darkenColor(color, factor) {
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!rgbaMatch) return color;

        const r = Math.max(0, Math.floor(parseInt(rgbaMatch[1]) * (1 - factor)));
        const g = Math.max(0, Math.floor(parseInt(rgbaMatch[2]) * (1 - factor)));
        const b = Math.max(0, Math.floor(parseInt(rgbaMatch[3]) * (1 - factor)));
        const a = rgbaMatch[4] || '1';

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
}
