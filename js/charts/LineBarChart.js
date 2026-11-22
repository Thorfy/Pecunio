import { BANKIN_SELECTORS } from '../bankin/BankinPage.js';
import { getHiddenCategories, setCategoryHidden } from '../core/CategoryVisibility.js';
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart, DATE_LOCALE } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { ColorParser } from '../utils/ColorParser.js';
import { formatEuros } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';

export class LineBarChart extends BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        this.chartInstance = null;
    }

    // Le bouton ↻ de Bankin est géré par PageController (un seul écouteur, bug B4).

    /** Texte du bouton de changement de type, selon le type affiché. */
    static chartTypeToggleLabel(chartType) {
        return chartType === 'line' ? 'Afficher en barres' : 'Afficher en courbes';
    }

    /**
     * Bouton (HTML, accessible au clavier) qui bascule entre barres et courbes (D10).
     * @param {'bar' | 'line'} chartType type affiché
     * @param {() => void} onToggle
     * @returns {HTMLButtonElement}
     */
    static createChartTypeToggle(chartType, onToggle) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pecunio-button pecunio-button-secondary pecunio-chart-type-toggle';
        button.textContent = LineBarChart.chartTypeToggleLabel(chartType);
        button.addEventListener('click', onToggle);
        return button;
    }

    /** Enregistre l'autre type de graphique ; PageController redessine le graphique. */
    async toggleChartType() {
        const current = this.chartInstance?.config.type === 'line' ? 'line' : 'bar';
        const next = current === 'line' ? 'bar' : 'line';
        try {
            if (this.settingsInstance) {
                await this.settingsInstance.setSetting('chartType', next);
            } else {
                await chrome.storage.local.set({ chartType: next });
            }
            window.dispatchEvent(new CustomEvent('pecunio_chart_type_changed'));
        } catch (error) {
            console.error('[LineBarChart] Changement de type impossible :', error);
        }
    }

    /**
     * Conteneur de hauteur fixe pour le canvas du graphique temporel.
     * @returns {HTMLElement}
     */
    static createCanvasContainer() {
        const canvasContainer = InjectedStyles.createCanvasContainer();
        canvasContainer.style.height = Config.CHART.LINE_CHART_HEIGHT;
        return canvasContainer;
    }

    /**
     * Crée le conteneur principal pour le chart
     * @param {HTMLElement} homeBlock - Élément homeBlock parent
     * @returns {HTMLElement} Conteneur principal créé
     */
    static createMainContainer(homeBlock) {
        // Injecter les styles Pecunio
        InjectedStyles.inject();

        // Style pour enlever la limitation de largeur (ajouté une seule fois)
        if (!document.getElementById('pecunio-home-block-style')) {
            const style = document.createElement('style');
            style.id = 'pecunio-home-block-style';
            style.textContent = `${BANKIN_SELECTORS.ACCOUNTS_BLOCK} > div { max-width: none !important; }`;
            document.head.appendChild(style);
        }
        homeBlock.innerHTML = "";

        // Container principal avec style Pecunio
        const mainContainer = document.createElement('div');
        InjectedStyles.applyContainerClasses(mainContainer);
        homeBlock.appendChild(mainContainer);

        return mainContainer;
    }

    /**
     * Crée le conteneur pour ce chart
     * @param {HTMLElement} parentContainer - Conteneur parent
     * @returns {HTMLElement} Conteneur créé
     */
    createContainer(parentContainer) {
        const container = document.createElement('div');
        container.id = "originalChartContainer";
        container.classList.add('pecunio-section');
        parentContainer.appendChild(container);
        return container;
    }

    /**
     * Crée et affiche le chart
     * @param {HTMLElement} container - Conteneur pour le chart
     * @returns {Promise<Chart>} Instance Chart.js créée
     */
    async render(container) {
        const preparedData = await this.prepareData();
        const chartJsConfig = await this.getChartJsConfig();
        chartJsConfig.data = preparedData;

        // Adapter l'axe X aux données réelles (pas de trou : min/max = plage des données)
        const allX = preparedData.datasets.flatMap(d => (d.data || []).map(p => p.x)).filter(Boolean);
        if (allX.length > 0 && chartJsConfig.options && chartJsConfig.options.scales && chartJsConfig.options.scales.x) {
            const minT = Math.min(...allX.map(x => new Date(x).getTime()));
            const maxT = Math.max(...allX.map(x => new Date(x).getTime()));
            chartJsConfig.options.scales.x.min = minT;
            chartJsConfig.options.scales.x.max = maxT;
        }
        // Titre ici pour éviter toute mutation dans le plugin (RangeError)
        const dates = preparedData.datasets.flatMap(d => (d.data || []).map(p => p.x)).filter(Boolean);
        if (dates.length > 0 && chartJsConfig.options && chartJsConfig.options.plugins && chartJsConfig.options.plugins.title) {
            const minD = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
            const maxD = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
            const monthCount = maxD.getMonth() - minD.getMonth() + 12 * (maxD.getFullYear() - minD.getFullYear());
            chartJsConfig.options.plugins.title.text = Config.isBlurry()
                ? 'Dépenses' : `Dépenses sur ${monthCount} mois`;
        }

        const toolbar = document.createElement('div');
        toolbar.className = 'pecunio-chart-toolbar';
        toolbar.appendChild(LineBarChart.createChartTypeToggle(chartJsConfig.type, () => this.toggleChartType()));
        container.appendChild(toolbar);

        // Conteneur de hauteur fixe : sans lui, Chart.js et le CSS du canvas
        // (height: 100%) se renvoient la hauteur à l'infini, le graphique oscille
        // d'un pixel et se redessine en continu (bug B23).
        const canvasContainer = LineBarChart.createCanvasContainer();
        container.appendChild(canvasContainer);
        const canvas = InjectedStyles.createCanvas();
        canvas.classList.add("canvasDiv");
        canvasContainer.appendChild(canvas);

        this.chartInstance = new Chart(canvas.getContext('2d'), chartJsConfig);
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);
        return this.chartInstance;
    }

    async prepareData() {
        const filteredTransactions = await this.applySettingOnData();
        const transactionByCategory = this.mergeTransactionByCategoryLegacy(filteredTransactions, this.categories);
        return this.getDataFormated(this.categories, transactionByCategory, true);
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        const data = { datasets: [] };
        const hiddenCategories = await getHiddenCategories();

        categoryData.forEach(category => {
            const transactions = transactionByCategory[parseInt(category.id)];
            
            // Vérifier que transactions existe et est un tableau avant d'appeler forEach
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                // Si pas de transactions pour cette catégorie, créer un dataset vide
                data.datasets.push({
                    label: category.name,
                    data: [],
                    backgroundColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    borderColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    fill: false,
                    tension: 0.3,
                    hidden: hiddenCategories.has(category.name)
                });
                return; // Passer à la catégorie suivante
            }
            
            const dateValueObject = [];
            const transactionObject = {};

            transactions.forEach(transaction => {
                // Mois de rattachement Bankin (current_month), sans décalage de fuseau
                const budgetDate = DateRange.getBudgetDate(transaction);
                if (!budgetDate) {
                    return; // Ignorer les transactions sans date valide
                }
                const stringDate = budgetDate.slice(0, 7);

                if (isCumulative) {
                    transactionObject[stringDate] = (transactionObject[stringDate] || 0) + transaction.amount;
                } else {
                    dateValueObject.push({ x: budgetDate, y: transaction.amount, name: transaction.name });
                }
            });

            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({ x: date, y: transactionObject[date] });
                }
            }

            const color = ColorParser.parseColorCSS("categoryColor_" + category.id);

            data.datasets.push({
                label: category.name,
                data: dateValueObject,
                backgroundColor: color,
                borderColor: color,
                fill: false,
                tension: 0.3,
                hidden: hiddenCategories.has(category.name)
            });
        });

        return data;
    }

    /**
     * Retourne la configuration Chart.js standardisée
     * @returns {Promise<Object>} Configuration Chart.js avec type, data, options, plugins
     */
    async getChartJsConfig() {
        // Utiliser l'instance Settings injectée si disponible, sinon fallback sur chrome.storage
        let settings;
        if (this.settingsInstance) {
            await this.settingsInstance.waitForInitialization();
            settings = {
                startDate: this.settingsInstance.getSetting('startDate'),
                endDate: this.settingsInstance.getSetting('endDate'),
                chartType: this.settingsInstance.getSetting('chartType'),
                isBlurry: this.settingsInstance.getSetting(Config.STORAGE_KEYS.IS_BLURRY)
            };
        } else {
            settings = await chrome.storage.local.get(['startDate', 'endDate', 'chartType', Config.STORAGE_KEYS.IS_BLURRY]);
        }
        const initialChartType = settings.chartType ?? 'bar';
        const cummulative = initialChartType === "line" ? false : true;

        const commonConfig = {
            responsive: true,
            maintainAspectRatio: false, // hauteur donnée par le conteneur (bug B23)
            plugins: {
                title: {
                    display: true,
                    text: ""
                },
                legend: {
                    // Masque/affiche la catégorie et mémorise le choix (préférence hiddenCategories)
                    onClick: function (evt, item, legend) {
                        const hidden = !item.hidden;
                        Chart.defaults.plugins.legend.onClick.call(this, evt, item, legend);
                        setCategoryHidden(item.text, hidden).catch((error) =>
                            console.warn('[LineBarChart] Visibilité non enregistrée :', error));
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (Config.isBlurry()) return context.dataset.label || '';
                            const label = context.dataset.label || '';
                            const value = context.parsed?.y ?? context.parsed;
                            return value != null ? `${label} : ${formatEuros(Number(value))}` : label;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    adapters: {
                        date: { locale: DATE_LOCALE }
                    },
                    time: {
                        unit: 'month',
                        displayFormats: {
                            millisecond: 'HH:mm',
                            second: 'HH:mm',
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'dd MMM',
                            week: 'dd MMM',
                            month: 'MMM yyyy',
                            quarter: 'MMM yyyy',
                            year: 'yyyy'
                        },
                        tooltipFormat: 'MMM yyyy'
                    },
                    ticks: {
                        maxTicksLimit: 24
                    },
                    grid: {
                        color: "#e9f5f9",
                        tickColor: "#e9f5f9"
                    },
                    // Chart.js 4 : la couleur de l'axe est dans `border` (et non plus `grid.borderColor`)
                    border: {
                        color: "#d3eaf2"
                    },
                    display: true,
                    stacked: true,
                    title: {
                        color: "#92cbdf",
                        display: false
                    }
                },
                y: {
                    display: true,
                    stacked: cummulative,
                    grid: {
                        color: "#e9f5f9",
                        tickColor: "#e9f5f9"
                    },
                    // Chart.js 4 : la couleur de l'axe est dans `border` (et non plus `grid.borderColor`)
                    border: {
                        color: "#d3eaf2"
                    },
                    ticks: {
                        callback: (value) => (Config.isBlurry() ? '' : value)
                    }
                }
            }
        };

        return {
            type: initialChartType,
            options: commonConfig,
        };
    }
}
