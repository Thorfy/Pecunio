import { BANKIN_SELECTORS } from '../bankin/BankinPage.js';
import { getHiddenCategories, setCategoryHidden } from '../core/CategoryVisibility.js';
import { Config } from '../core/Config.js';
import { defaultSettings } from '../core/SettingsSchema.js';
import { Chart, DATE_LOCALE } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { ColorParser } from '../utils/ColorParser.js';
import { formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { BALANCE_LABEL, RANGE_LABELS, buildTimeline } from './timeline.js';

/** Couleur de « Autres dépenses ». */
const OTHERS_COLOR = 'rgb(173, 184, 197)';

/**
 * Graphique temporel de la page Comptes : revenus et dépenses par mois et par
 * catégorie, avec le solde de chaque mois (lot UX-2a).
 * Données : js/charts/timeline.js ; préférences : chartRange, chartDetailed, chartType.
 */
export class LineBarChart extends BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        this.chartInstance = null;
        /** Dernières données calculées (mois, séries, solde). */
        this.timeline = null;
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

    /**
     * Boutons de période (6 mois, 12 mois, 24 mois, Tout), un seul actif.
     * @param {string} current période affichée
     * @param {(range: string) => void} onSelect
     * @returns {HTMLElement}
     */
    static createRangeSelector(current, onSelect) {
        const group = document.createElement('div');
        group.className = 'pecunio-segmented pecunio-range-selector';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Période affichée');
        for (const [range, label] of Object.entries(RANGE_LABELS)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.dataset.range = range;
            button.setAttribute('aria-pressed', String(range === current));
            button.addEventListener('click', () => {
                if (range !== current) onSelect(range);
            });
            group.appendChild(button);
        }
        return group;
    }

    /** Texte du bouton de détail, selon la vue affichée. */
    static detailToggleLabel(detailed) {
        return detailed ? 'Vue simplifiée' : 'Toutes les catégories';
    }

    /**
     * Bouton qui bascule entre la vue simplifiée et toutes les catégories.
     * @param {boolean} detailed vue affichée
     * @param {() => void} onToggle
     */
    static createDetailToggle(detailed, onToggle) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pecunio-button pecunio-button-secondary pecunio-detail-toggle';
        button.textContent = LineBarChart.detailToggleLabel(detailed);
        button.addEventListener('click', onToggle);
        return button;
    }

    /**
     * Préférence d'affichage (valeur par défaut du schéma si absente).
     * @param {'chartType' | 'chartRange' | 'chartDetailed'} key
     */
    _option(key) {
        const value = this.settingsInstance?.getSetting(key);
        return value ?? defaultSettings()[key];
    }

    /**
     * Enregistre une préférence d'affichage ; PageController redessine le graphique.
     * @param {'chartType' | 'chartRange' | 'chartDetailed'} key
     * @param {unknown} value
     */
    async _saveOption(key, value) {
        try {
            if (this.settingsInstance) {
                await this.settingsInstance.setSetting(key, value);
            } else {
                await chrome.storage.local.set({ [key]: value });
            }
            window.dispatchEvent(new CustomEvent('pecunio_chart_type_changed'));
        } catch (error) {
            console.error(`[LineBarChart] Préférence « ${key} » non enregistrée :`, error);
        }
    }

    /** Enregistre l'autre type de graphique (barres / courbes). */
    async toggleChartType() {
        const current = this.chartInstance?.config.type === 'line' ? 'line' : 'bar';
        await this._saveOption('chartType', current === 'line' ? 'bar' : 'line');
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

    /** Titre du graphique, selon la période. */
    static title(range) {
        return range === 'all' ? 'Revenus et dépenses par mois' : `Revenus et dépenses — ${RANGE_LABELS[range]}`;
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

        // Axe X : exactement les mois de la période
        const months = this.timeline?.months || [];
        if (months.length > 0) {
            chartJsConfig.options.scales.x.min = months[0];
            chartJsConfig.options.scales.x.max = months.at(-1);
        }
        const range = this._option('chartRange');
        chartJsConfig.options.plugins.title.text = LineBarChart.title(range);

        const toolbar = document.createElement('div');
        toolbar.className = 'pecunio-chart-toolbar';
        toolbar.appendChild(LineBarChart.createRangeSelector(range, (next) => this._saveOption('chartRange', next)));
        const detailed = Boolean(this._option('chartDetailed'));
        toolbar.appendChild(LineBarChart.createDetailToggle(detailed, () => this._saveOption('chartDetailed', !detailed)));
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

    /**
     * Données Chart.js : une série par catégorie (ou les principales + « Autres »)
     * et la ligne du solde mensuel.
     */
    async prepareData() {
        const filteredTransactions = await this.applySettingOnData();
        const byCategory = this.mergeTransactionByCategoryLegacy(filteredTransactions, this.categories);
        this.timeline = buildTimeline({
            categories: this.categories,
            byCategory,
            range: this._option('chartRange'),
            detailed: Boolean(this._option('chartDetailed')),
        });
        return LineBarChart.toChartData(this.timeline, await getHiddenCategories());
    }

    /**
     * @param {ReturnType<typeof buildTimeline>} timeline
     * @param {Set<string>} hiddenCategories
     */
    static toChartData({ months, series, balance }, hiddenCategories) {
        const points = (values) => months.map((month, i) => ({ x: month, y: values[i] }));
        /** @type {Record<string, unknown>[]} */
        const datasets = series.map((s) => {
            const color = s.id == null ? OTHERS_COLOR : ColorParser.parseColorCSS(`categoryColor_${s.id}`);
            return {
                label: s.label,
                data: points(s.values),
                backgroundColor: color,
                borderColor: color,
                fill: false,
                tension: 0.3,
                stack: 'flux',
                order: 1,
                hidden: hiddenCategories.has(s.label),
            };
        });
        if (months.length > 0) {
            datasets.push({
                type: 'line',
                label: BALANCE_LABEL,
                data: points(balance),
                borderColor: THEME.text,
                backgroundColor: THEME.text,
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.3,
                fill: false,
                // Pile à part : le solde n'est pas empilé avec les catégories, et passe devant
                stack: 'solde',
                order: 0,
                hidden: hiddenCategories.has(BALANCE_LABEL),
            });
        }
        return { datasets };
    }

    /**
     * Retourne la configuration Chart.js standardisée
     * @returns {Promise<Object>} Configuration Chart.js avec type, data, options, plugins
     */
    async getChartJsConfig() {
        if (this.settingsInstance) await this.settingsInstance.waitForInitialization();
        const initialChartType = this._option('chartType') === 'line' ? 'line' : 'bar';
        const stacked = initialChartType === 'bar';

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
                mode: 'index',
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
                        tooltipFormat: 'MMMM yyyy'
                    },
                    // Barres centrées sur leur mois
                    offset: true,
                    ticks: {
                        maxTicksLimit: 24
                    },
                    grid: {
                        color: THEME.grid,
                        tickColor: THEME.grid
                    },
                    // Chart.js 4 : la couleur de l'axe est dans `border` (et non plus `grid.borderColor`)
                    border: {
                        color: THEME.border
                    },
                    display: true,
                    stacked: true,
                    title: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    stacked,
                    grid: {
                        color: THEME.grid,
                        tickColor: THEME.grid
                    },
                    border: {
                        color: THEME.border
                    },
                    ticks: {
                        callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value)))
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
