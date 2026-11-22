import { Config } from '../core/Config.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { formatEuros, formatPercent } from '../utils/format.js';
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
     * Mapping centralisé des types de dépenses (libellé, couleur)
     */
    static EXPENSE_TYPE_MAPPING = {
        'ESSENTIAL': { 
            name: 'Essentiel', 
            color: 'rgba(102, 126, 234, 0.8)' 
        },
        'PLEASURE': { 
            name: 'Plaisir', 
            color: 'rgba(255, 99, 132, 0.8)' 
        },
        'OTHER': { 
            name: 'Autre', 
            color: 'rgba(199, 199, 199, 0.8)' 
        },
        'SAVING': { 
            name: 'Épargne', 
            color: 'rgba(75, 192, 192, 0.8)' 
        }
    };

    /**
     * Prépare le conteneur pour le chart (doit être appelé avant render)
     * @param {HTMLElement} categBlock - Élément categoryChart
     * @returns {HTMLElement} Conteneur de ligne pour les charts
     */
    static prepareContainer(categBlock) {
        return InjectedStyles.prepareChartsRow(categBlock);
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

        // Même format que le donut de Bankin voisin : en-tête, donut, légende dessous
        const { wrapper: expenseTypeWrapper, canvas: expenseTypeCanvas } = InjectedStyles.createDonutChart('Types de dépenses', '285px');
        const datasetValues = /** @type {number[]} */ (preparedData.datasets[0]?.data || []);
        expenseTypeWrapper.insertBefore(
            ExpenseTypeChart.createHeader(ExpenseTypeChart.mainType(preparedData.labels || [], datasetValues)),
            expenseTypeCanvas.parentElement,
        );
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

        // Ordre fixe (Essentiel, Plaisir, Épargne, Autre), types inconnus ensuite (U7)
        const order = ['ESSENTIAL', 'PLEASURE', 'SAVING', 'OTHER'];
        const rank = (type) => (order.includes(type) ? order.indexOf(type) : order.length);
        const expenseTypes = [...expenseTypeMap.keys()].sort((a, b) => rank(a) - rank(b));
        const labels = expenseTypes.map((type) => this._formatExpenseType(type));
        const data = expenseTypes.map((type) => Math.round(expenseTypeMap.get(type) * 100) / 100);

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
                            font: { size: 13 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const dataset = data.datasets[0];
                                    const values = /** @type {number[]} */ (dataset.data);
                                    return data.labels.map((label, i) => {
                                        return {
                                            // Part de chaque type (U7) : un pourcentage, pas un montant
                                            text: ExpenseTypeChart.legendText(String(label), values, i),
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
                                if (Config.isBlurry()) return label;
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                if (total === 0 || label === 'Aucune donnée') {
                                    return 'Aucune donnée disponible';
                                }
                                return `${label} : ${formatEuros(value)} (${formatPercent((value / total) * 100)})`;
                            }
                        }
                    }
                },
                cutout: '62%'
            },
        };
    }

    /**
     * Libellé de légende : « Essentiel · 82 % ».
     * @param {string} label
     * @param {number[]} values
     * @param {number} index
     */
    static legendText(label, values, index) {
        const total = values.reduce((a, b) => a + b, 0);
        if (label === 'Aucune donnée' || total <= 0) return label;
        return `${label} · ${formatPercent((values[index] / total) * 100)}`;
    }

    /**
     * Type principal du mois : « 45 % », « Essentiel ». Le total est déjà en
     * tête du donut de Bankin voisin ; une part n'est pas un montant, elle
     * reste visible quand les montants sont masqués.
     * @param {string[]} labels
     * @param {number[]} values
     * @returns {{ share: string, label: string } | null}
     */
    static mainType(labels, values) {
        const total = values.reduce((a, b) => a + b, 0);
        if (labels[0] === 'Aucune donnée' || total <= 0) return null;
        const index = values.indexOf(Math.max(...values));
        return { share: `${Math.round((values[index] / total) * 100)} %`, label: String(labels[index]) };
    }

    /**
     * En-tête au format de celui du donut de Bankin : chiffre puis légende.
     * @param {{ share: string, label: string } | null} main
     */
    static createHeader(main) {
        const header = document.createElement('div');
        header.className = 'pecunio-donut-header';
        const figure = document.createElement('span');
        figure.className = 'pecunio-donut-figure';
        figure.textContent = main ? main.share : '—';
        const caption = document.createElement('span');
        caption.className = 'pecunio-donut-caption';
        caption.textContent = main ? `${main.label}, type principal` : 'Aucune dépense ce mois-ci';
        header.append(figure, caption);
        return header;
    }

    /**
     * Libellé d'un type de dépense (sans emoji : rendu variable selon le système)
     * @param {string} expenseType - Type de dépense brut
     * @returns {string} Libellé affiché
     */
    _formatExpenseType(expenseType) {
        const mapped = ExpenseTypeChart.EXPENSE_TYPE_MAPPING[expenseType] || { name: expenseType };
        return mapped.name;
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
