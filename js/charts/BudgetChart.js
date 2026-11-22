import { getHiddenCategories, watchHiddenCategories } from '../core/CategoryVisibility.js';
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { ColorParser } from '../utils/ColorParser.js';
import { MONTH_NAMES, formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { BUDGET_PRESETS, formatDelta, presetPeriods, toExpenseComparison } from './budgetComparison.js';

export class BudgetChart extends BaseChartData {
    /**
     * Libellé de l'infobulle d'une barre : « Série : -158,30 € ».
     * Pour un graphique en barres, Chart.js fournit `context.parsed` sous forme
     * d'objet { x, y } : la valeur est `parsed.y` (bug B20 : NaN affiché).
     * @param {{ dataset?: { label?: string }, parsed?: number|{ x?: number, y?: number }, raw?: unknown }} context
     * @param {boolean} hideAmounts - mode « montants masqués »
     * @param {'x' | 'y'} [valueAxis] axe de la valeur : 'x' pour des barres horizontales
     * @returns {string}
     */
    static formatTooltipLabel(context, hideAmounts, valueAxis = 'y') {
        const label = context?.dataset?.label || '';
        if (hideAmounts) return label;
        const parsed = context?.parsed;
        const candidate = parsed != null && typeof parsed === 'object' ? parsed[valueAxis] : (parsed ?? context?.raw);
        const value = typeof candidate === 'number' ? candidate : Number(candidate);
        return candidate == null || !Number.isFinite(value) ? `${label} : —` : `${label} : ${formatEuros(value)}`;
    }

    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        
        this.organizedData = {};
        this.initializationPromise = this._initializeData();

        // UI related instance properties
        this.containerElement = null;
        this.yearSelectorLeft = null;
        this.monthSelectorLeft = null;
        this.yearSelectorRight = null;
        this.monthSelectorRight = null;
        this.calcTypeSelector = null;
        this.budgetCtx = null;
        this.budgetChart = null;
        this.monthsArray = [BudgetChart.ALL_MONTHS_LABEL, ...MONTH_NAMES.slice(1)];
        /** Date du jour (remplaçable dans les tests). */
        this.now = () => new Date();
        /** Préréglage affiché (préférence budgetPreset). */
        this.preset = settingsInstance?.getSetting?.('budgetPreset') || 'last';
    }

    /** Hauteur d'une ligne (catégorie) du graphique horizontal, en pixels. */
    static ROW_HEIGHT = 34;

    /** Opacité des barres de la période de référence (même couleur, plus claire). */
    static COMPARISON_ALPHA = 0.35;

    /**
     * Même couleur avec une opacité : « rgb(1, 2, 3) » → « rgba(1, 2, 3, 0.35) ».
     * @param {string} color
     * @param {number} alpha
     */
    static withAlpha(color, alpha) {
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
        return match ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})` : color;
    }

    /**
     * Couleur de Bankin de chaque catégorie (par son nom), violet de Pecunio à défaut.
     * @param {string[]} names
     * @returns {string[]}
     */
    _categoryColors(names) {
        return names.map((name) => {
            const category = this.categories?.find((c) => c && c.name === name);
            const color = category ? ColorParser.parseColorCSS(`categoryColor_${category.id}`) : '';
            // Sans règle CSS, la couleur calculée est transparente
            return color && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(color) ? color : THEME.accent;
        });
    }

    static ALL_MONTHS_LABEL = 'Tous les mois';

    /** Libellé du calcul : « Médiane » ou « Moyenne ». */
    static calculationLabel(calculationType) {
        return calculationType === 'average' ? 'Moyenne' : 'Médiane';
    }

    createUI(containerElementId) {
        this.containerElement = document.getElementById(containerElementId);
        if (!this.containerElement) {
            console.error(`[ChartDataBudget] createUI: Container element with ID '${containerElementId}' not found.`);
            return;
        }
        InjectedStyles.inject();
        this.containerElement.innerHTML = '';
        InjectedStyles.applyContainerClasses(this.containerElement);
        this.containerElement.appendChild(InjectedStyles.createTitle('Comparaison du budget'));

        // Préréglages (lot UX-2a) ; « Personnaliser » affiche les listes de choix
        const toolbar = document.createElement('div');
        toolbar.className = 'pecunio-chart-toolbar';
        this.presetGroup = document.createElement('div');
        this.presetGroup.className = 'pecunio-segmented pecunio-budget-presets';
        this.presetGroup.setAttribute('role', 'group');
        this.presetGroup.setAttribute('aria-label', 'Période comparée');
        for (const [preset, label] of Object.entries(BUDGET_PRESETS)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.dataset.preset = preset;
            button.addEventListener('click', () => this.selectPreset(/** @type {any} */ (preset)));
            this.presetGroup.appendChild(button);
        }
        toolbar.appendChild(this.presetGroup);
        this.containerElement.appendChild(toolbar);

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'medianChartSelectors';
        selectorContainer.classList.add('pecunio-controls', 'pecunio-budget-custom');
        this.customPanel = selectorContainer;
        this.containerElement.appendChild(selectorContainer);

        const currentYear = this.now().getFullYear();
        const group = (title, yearId, monthId, defaultYear) => {
            const div = InjectedStyles.createControlGroup();
            const strong = document.createElement('strong');
            strong.textContent = title;
            strong.style.fontSize = '13px';
            strong.style.color = THEME.text;
            div.appendChild(strong);
            div.appendChild(InjectedStyles.createLabel('Année :', yearId));
            const yearSelect = this._createYearSelect(yearId, defaultYear, currentYear);
            div.appendChild(yearSelect);
            div.appendChild(InjectedStyles.createLabel('Mois :', monthId));
            const monthSelect = this._createMonthSelect(monthId, 'ALL');
            div.appendChild(monthSelect);
            selectorContainer.appendChild(div);
            return [yearSelect, monthSelect];
        };
        [this.yearSelectorLeft, this.monthSelectorLeft] = group('Période', 'yearSelectorLeft', 'monthSelectorLeft', currentYear);
        [this.yearSelectorRight, this.monthSelectorRight] = group('Comparer à', 'yearSelectorRight', 'monthSelectorRight', currentYear - 1);

        const calcDiv = InjectedStyles.createControlGroup();
        calcDiv.appendChild(InjectedStyles.createLabel('Calcul :', 'calculationTypeSelector'));
        this.calcTypeSelector = InjectedStyles.createSelect('calculationTypeSelector');
        for (const [value, label] of [['median', 'Médiane'], ['average', 'Moyenne']]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            this.calcTypeSelector.appendChild(option);
        }
        this.calcTypeSelector.value = 'median';
        calcDiv.appendChild(this.calcTypeSelector);
        selectorContainer.appendChild(calcDiv);

        // Synthèse : totaux et écart
        this.summaryElement = document.createElement('p');
        this.summaryElement.className = 'pecunio-budget-summary';
        this.containerElement.appendChild(this.summaryElement);

        // Hauteur fixée à chaque mise à jour, selon le nombre de catégories (pas de boucle de redimensionnement, B23)
        this.canvasContainer = InjectedStyles.createCanvasContainer();
        this.containerElement.appendChild(this.canvasContainer);
        const budgetCanvas = InjectedStyles.createCanvas();
        this.canvasContainer.appendChild(budgetCanvas);
        this.budgetCtx = budgetCanvas.getContext('2d');

        for (const select of [this.yearSelectorLeft, this.monthSelectorLeft, this.yearSelectorRight, this.monthSelectorRight, this.calcTypeSelector]) {
            select.addEventListener('change', () => this._updateChartView());
        }
        this._showPreset();

        this.initializationPromise.then(() => {
            if (this._destroyed) return; // graphique remplacé entre-temps
            this._setupStorageListener();
            this._updateChartView();
        }).catch(error => {
            console.error("[ChartDataBudget] createUI: Error during initial data load for chart view:", error);
        });
    }

    /**
     * Change de préréglage, l'enregistre et redessine.
     * @param {'current' | 'last' | 'year' | 'custom'} preset
     */
    selectPreset(preset) {
        if (preset === this.preset) return;
        this.preset = preset;
        this._showPreset();
        this.settingsInstance?.setSetting?.('budgetPreset', preset)?.catch?.((error) =>
            console.warn('[ChartDataBudget] Préréglage non enregistré :', error));
        this._updateChartView();
    }

    /** Bouton actif et panneau « Personnaliser » selon le préréglage. */
    _showPreset() {
        this.presetGroup?.querySelectorAll('button').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.preset === this.preset));
        });
        if (this.customPanel) this.customPanel.hidden = this.preset !== 'custom';
    }

    /**
     * Redessine le graphique quand une catégorie est masquée ou affichée dans
     * la légende du graphique temporel. Un seul écouteur par graphique, retiré
     * par destroy() (bug B16).
     */
    _setupStorageListener() {
        this._removeStorageListener();
        this._unwatchHiddenCategories = watchHiddenCategories(() => {
            if (this.budgetChart) this._updateChartView();
        });
    }

    _removeStorageListener() {
        this._unwatchHiddenCategories?.();
        this._unwatchHiddenCategories = null;
    }

    /**
     * Détruit le graphique, ses écouteurs et l'écouteur de stockage (bug B16).
     * @override
     */
    destroy() {
        this._destroyed = true;
        this._removeStorageListener();
        if (this.budgetChart) {
            BaseChartData._detachAmountVisibilityListener(this.budgetChart);
            this.budgetChart.destroy();
            this.budgetChart = null;
        }
    }

    async _initializeData() {
        // Logger.debug('[ChartDataBudget] _initializeData: Starting data organization.');
        await this._organizeTransactions();
        // Logger.debug('[ChartDataBudget] _initializeData: Data organization complete.');
    }



    async _organizeTransactions() {
        this.organizedData = {};
        // Logger.debug('[ChartDataBudget] _organizeTransactions: Starting. Initial this.transactions count:', this.transactions ? this.transactions.length : 0);

        const filteredTransactions = await this.applySettingOnData();
        // Logger.debug('[ChartDataBudget] _organizeTransactions: Transactions count after applySettingOnData:', filteredTransactions ? filteredTransactions.length : 0);

        if (!filteredTransactions || filteredTransactions.length === 0) {
            console.warn('[ChartDataBudget] _organizeTransactions: No transactions to organize after filtering.');
            // Logger.debug(`[ChartDataBudget] _organizeTransactions: Completed (no data). Organized data for 0 years.`);
            return;
        }

        filteredTransactions.forEach(transaction => {
            if (!transaction || !transaction.date || !transaction.category || transaction.category.id == null || transaction.amount == null) return;

            if (this.isExceptionCategory(transaction.category.id)) {
                return; // Skip this transaction
            }
            // Mois de rattachement Bankin (current_month), sans décalage de fuseau
            const parts = DateRange.parts(DateRange.getBudgetDate(transaction));
            if (!parts) return;
            const { year, month } = parts;
            const categoryName = this.getCategoryNameById(transaction.category.id);
            if (!categoryName) {
                 console.warn(`[ChartDataBudget] _organizeTransactions: Cat ID ${transaction.category.id} not in lookup for tr ${transaction.id || 'N/A'}`);
                return;
            }
            if (!this.organizedData[year]) this.organizedData[year] = {};
            if (!this.organizedData[year][month]) this.organizedData[year][month] = {};
            if (!this.organizedData[year][month][categoryName]) this.organizedData[year][month][categoryName] = [];
            this.organizedData[year][month][categoryName].push(transaction.amount);
        });
        // Logger.debug(`[ChartDataBudget] _organizeTransactions: Completed. Organized data for ${Object.keys(this.organizedData).length} years.`);
    }





    getCalculatedMonthlyValueForYear(year, calculationType = 'median') {
        // Logger.debug(`[ChartDataBudget] getCalculatedMonthlyValueForYear: Called for year ${year}, type: ${calculationType}.`);
        /** @type {Record<string, number>} */
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getCalculatedMonthlyValueForYear.');
        }

        if (!this.organizedData[year]) {
            console.warn(`[ChartDataBudget] getCalculatedMonthlyValueForYear: No data found for year ${year}. Returning zeros for all known categories.`);
            return result; // All known categories are already initialized to 0
        }

        const now = new Date();
        const currentSystemYear = now.getFullYear();
        const currentSystemMonth = now.getMonth() + 1; 

        this.categoryLookup.forEach(categoryName => { // Iterate over all known category names
            const monthlyTotals = [];
            // Determine the last month to process for this year
            const lastMonthToProcess = (parseInt(year) === currentSystemYear) ? currentSystemMonth : 12;
            let categoryActiveInProcessedPeriod = false;

            // First, check if this category is active in the processed period for the given year
            for (let m = 1; m <= lastMonthToProcess; m++) {
                if (this.organizedData[year][m] && Object.hasOwn(this.organizedData[year][m], categoryName)) {
                    categoryActiveInProcessedPeriod = true;
                    break;
                }
            }

            if (categoryActiveInProcessedPeriod) {
                for (let m = 1; m <= lastMonthToProcess; m++) {
                    const amounts = this.organizedData[year][m]?.[categoryName] || [];
                    monthlyTotals.push(amounts.reduce((sum, val) => sum + val, 0));
                }
                
                // Ensure monthlyTotals is not empty before calculation, though categoryActiveInProcessedPeriod should imply this.
                if (monthlyTotals.length > 0) { 
                                    if (calculationType === 'average') {
                    result[categoryName] = BaseChartData.calculateAverage(monthlyTotals);
                } else { 
                    result[categoryName] = BaseChartData.calculateMedian(monthlyTotals);
                }
                } else {
                    // This case should ideally not be hit if categoryActiveInProcessedPeriod is true
                    // but as a fallback, it remains 0.
                    result[categoryName] = 0;
                }
            } else {
                // If category was not active in the processed period, it remains 0 from initialization.
                result[categoryName] = 0;
            }
        });
        // Logger.debug(`[ChartDataBudget] getCalculatedMonthlyValueForYear: Result for ${year}, type ${calculationType}:`, result); // Verbose
        return result;
    }

    /**
     * Médiane (ou moyenne) mensuelle par catégorie sur une liste de mois ; un
     * mois sans opération compte pour zéro dès que la catégorie a été active.
     * @param {{ year: number, month: number }[]} months
     * @param {'median' | 'average'} [calculationType]
     * @returns {Record<string, number>}
     */
    getCalculatedValueOverMonths(months, calculationType = 'median') {
        /** @type {Record<string, number>} */
        const result = {};
        for (const categoryName of new Set(this.categoryLookup.values())) {
            const totals = months.map(({ year, month }) =>
                (this.organizedData[year]?.[month]?.[categoryName] || []).reduce((sum, val) => sum + val, 0));
            const active = months.some(({ year, month }) => this.organizedData[year]?.[month]?.[categoryName]);
            result[categoryName] = !active
                ? 0
                : calculationType === 'average'
                    ? BaseChartData.calculateAverage(totals)
                    : BaseChartData.calculateMedian(totals);
        }
        return result;
    }

    /**
     * Montants d'une période (mois réel, médiane d'une liste de mois ou d'une année).
     * @param {import('./budgetComparison.js').BudgetPeriod} period
     */
    _periodValues(period) {
        if (period.kind === 'month') return this.getActualSpendingForMonth(period.year, period.month);
        if (period.kind === 'months') return this.getCalculatedValueOverMonths(period.months);
        return this.getCalculatedMonthlyValueForYear(period.year);
    }

    /**
     * Montants comparés selon le préréglage (ou les listes de « Personnaliser »).
     * @returns {Promise<{ primary: Record<string, number>, comparison: Record<string, number>, primaryLabel: string, comparisonLabel: string }>}
     */
    async getComparison(preset = this.preset) {
        await this.initializationPromise;
        if (preset === 'custom') {
            const month = (select) => (select.value === 'ALL' ? 'ALL' : parseInt(select.value));
            return this._customComparison(
                parseInt(this.yearSelectorLeft.value), month(this.monthSelectorLeft),
                parseInt(this.yearSelectorRight.value), month(this.monthSelectorRight),
                this.calcTypeSelector.value,
            );
        }
        const periods = presetPeriods(preset, this.now());
        return {
            primary: this._periodValues(periods.primary),
            comparison: this._periodValues(periods.comparison),
            primaryLabel: periods.primaryLabel,
            comparisonLabel: periods.comparisonLabel,
        };
    }

    /** Catégories exclues de la comparaison : revenus et catégories masquées. */
    async _excludedCategories() {
        const excluded = await getHiddenCategories();
        const income = this.categories?.find((c) => c && c.id === Config.CATEGORIES.BUDGET_CATEGORY_ID);
        if (income) excluded.add(income.name);
        return excluded;
    }

    getActualSpendingForMonth(year, month) {
        // Logger.debug(`[ChartDataBudget] getActualSpendingForMonth: Called for year ${year}, month ${month}.`);
        /** @type {Record<string, number>} */
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getActualSpendingForMonth.');
        }

        if (this.organizedData[year] && this.organizedData[year][month]) {
            // Iterate over the categories present in the specific month's data
            Object.keys(this.organizedData[year][month]).forEach(categoryName => {
                // Ensure this category is a known one, though organizedData should only contain known ones
                if (Array.from(this.categoryLookup.values()).includes(categoryName)) {
                    const amounts = this.organizedData[year][month][categoryName] || [];
                    result[categoryName] = amounts.reduce((sum, val) => sum + val, 0);
                }
            });
        } else {
            console.warn(`[ChartDataBudget] getActualSpendingForMonth: No data found for year ${year}, month ${month}. Returning zeros for all known categories.`);
        }
        return result;
    }

    getHistoricalCalculatedValueForMonth(targetMonth, currentYear, calculationType = 'median') {
        // Logger.debug(`[ChartDataBudget] getHistoricalCalculatedValueForMonth: Called for month ${targetMonth}, up to year ${currentYear - 1}, type: ${calculationType}.`);
        /** @type {Record<string, number>} */
        const result = {};
        // Initialize all known categories to 0
        if (this.categoryLookup && this.categoryLookup.size > 0) {
            this.categoryLookup.forEach(name => { result[name] = 0; });
        } else {
            console.warn('[ChartDataBudget] categoryLookup is empty or not available in getHistoricalCalculatedValueForMonth.');
        }
        
        const allCategoryNames = new Set(this.categoryLookup.values());

        allCategoryNames.forEach(categoryName => {
            const historicalMonthlyTotals = [];
            for (const yearStr in this.organizedData) {
                const year = parseInt(yearStr);
                if (year < currentYear) { // Only consider years before the currentYear for historical data
                    // Check if the category existed in this month for this historical year
                    if (this.organizedData[year][targetMonth] && Object.hasOwn(this.organizedData[year][targetMonth], categoryName)) {
                        const amounts = this.organizedData[year][targetMonth][categoryName] || [];
                        historicalMonthlyTotals.push(amounts.reduce((sum, val) => sum + val, 0));
                    }
                    // If category didn't exist at all in that historical year, it's implicitly excluded from historicalMonthlyTotals
                }
            }

            if (calculationType === 'average') {
                result[categoryName] = BaseChartData.calculateAverage(historicalMonthlyTotals);
            } else { // Default to median
                result[categoryName] = BaseChartData.calculateMedian(historicalMonthlyTotals);
            }
        });
        // Logger.debug(`[ChartDataBudget] getHistoricalCalculatedValueForMonth: Result for month ${targetMonth}, type ${calculationType}:`, result); // Verbose
        return result;
    }

    /** Montants comparés pour des années / mois choisis dans les listes. */
    _customComparison(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, calculationType = 'median') {
        // Logger.debug(`[ChartDataBudget] prepareData: Left: ${selectedYearLeft}/${selectedMonthLeft}, Right: ${selectedYearRight}/${selectedMonthRight}, Type: ${calculationType}.`);

        let primaryData, comparisonData, primaryLabel, comparisonLabel;
        const calcTypeString = BudgetChart.calculationLabel(calculationType);

        // Primary Data (Left Column)
        if (selectedMonthLeft === 'ALL') {
            primaryData = this.getCalculatedMonthlyValueForYear(selectedYearLeft, calculationType);
            primaryLabel = `${calcTypeString} ${selectedYearLeft}`;
        } else {
            primaryData = this.getActualSpendingForMonth(selectedYearLeft, selectedMonthLeft);
            primaryLabel = `Réel ${this.getMonthName(selectedMonthLeft)} ${selectedYearLeft}`;
        }

        // Comparison Data (Right Column)
        if (selectedMonthRight === 'ALL') {
            comparisonData = this.getCalculatedMonthlyValueForYear(selectedYearRight, calculationType);
            comparisonLabel = `${calcTypeString} ${selectedYearRight}`;
        } else {
            comparisonData = this.getActualSpendingForMonth(selectedYearRight, selectedMonthRight);
            comparisonLabel = `Réel ${this.getMonthName(selectedMonthRight)} ${selectedYearRight}`;
        }
        return { primary: primaryData, comparison: comparisonData, primaryLabel, comparisonLabel };
    }

    /**
     * Données brutes (toutes catégories, montants signés) pour des périodes choisies.
     * Utilisé par le mode « Personnaliser » et les tests.
     */
    async prepareData(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, calculationType = 'median') {
        await this.initializationPromise;
        const { primary: primaryData, comparison: comparisonData, primaryLabel, comparisonLabel } =
            this._customComparison(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, calculationType);

        const allCategoryNames = new Set();
        Object.keys(primaryData).forEach(name => allCategoryNames.add(name));
        Object.keys(comparisonData).forEach(name => allCategoryNames.add(name));
        const categoryNamesArray = Array.from(allCategoryNames).sort();
        
        const hiddenCategories = await getHiddenCategories();

        const finalLabels = [], primaryDatasetData = [], comparisonDatasetData = [];
        for (const name of categoryNamesArray) {
            if (hiddenCategories.has(name)) continue;
            finalLabels.push(name);
            primaryDatasetData.push(primaryData[name] || 0);
            comparisonDatasetData.push(comparisonData[name] || 0);
        }
        return {
            labels: finalLabels,
            datasets: [
                { label: primaryLabel, data: primaryDatasetData, backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                { label: comparisonLabel, data: comparisonDatasetData, backgroundColor: 'rgba(255, 99, 132, 0.6)' }
            ]
        };
    }

    /** Recalcule la comparaison et redessine le graphique horizontal. */
    async _updateChartView() {
        if (!this.canvasContainer) return; // createUI pas encore appelé
        let comparison;
        try {
            comparison = await this.getComparison();
        } catch (error) {
            console.error('[ChartDataBudget] Comparaison impossible :', error);
            return;
        }
        if (this._destroyed) return;
        const { rows, totals } = toExpenseComparison(comparison.primary, comparison.comparison, {
            exclude: await this._excludedCategories(),
        });
        this.lastComparison = { ...comparison, rows, totals };
        this._renderSummary(comparison, totals, rows.length);

        this.canvasContainer.style.height = `${Math.max(160, rows.length * BudgetChart.ROW_HEIGHT + 70)}px`;
        // Couleurs des catégories de Bankin : pleine pour la période, claire pour la référence
        const colors = this._categoryColors(rows.map((r) => r.name));
        const light = colors.map((c) => BudgetChart.withAlpha(c, BudgetChart.COMPARISON_ALPHA));
        const legendItem = (text, fillStyle, datasetIndex) => ({ text, fillStyle, strokeStyle: fillStyle, lineWidth: 0, datasetIndex, hidden: false });
        const config = {
            type: 'bar',
            data: {
                labels: rows.map((r) => r.name),
                datasets: [
                    { label: comparison.primaryLabel, data: rows.map((r) => r.primary), backgroundColor: colors, borderRadius: 4 },
                    { label: comparison.comparisonLabel, data: rows.map((r) => r.comparison), backgroundColor: light, borderColor: colors, borderWidth: 1, borderRadius: 4 },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value))) },
                    },
                    y: { grid: { display: false } },
                },
                plugins: {
                    legend: {
                        position: 'top',
                        // Une couleur par catégorie : la légende montre « foncé / clair » en gris neutre
                        labels: {
                            generateLabels: () => [
                                legendItem(comparison.primaryLabel, THEME.textMuted, 0),
                                legendItem(comparison.comparisonLabel, BudgetChart.withAlpha('rgb(91, 107, 124)', BudgetChart.COMPARISON_ALPHA), 1),
                            ],
                        },
                        onClick: () => {},
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => BudgetChart.formatTooltipLabel(context, Config.isBlurry(), 'x'),
                            footer: (items) => {
                                const row = rows[items[0]?.dataIndex];
                                return row ? `Écart : ${formatDelta(row.delta)}` : '';
                            },
                        },
                    },
                },
            },
        };
        if (this.budgetChart) {
            BaseChartData._detachAmountVisibilityListener(this.budgetChart);
            this.budgetChart.destroy();
            this.budgetChart = null;
        }
        if (!this.budgetCtx) return; // canvas indisponible (tests)
        try {
            this.budgetChart = new Chart(this.budgetCtx, /** @type {any} */ (config));
            BaseChartData._attachAmountVisibilityListener(this.budgetChart);
        } catch (error) {
            console.error('[ChartDataBudget] Graphique impossible à créer :', error);
            this.budgetChart = null;
        }
    }

    /** Phrase de synthèse : « Dépenses : 1 950,00 € (Octobre 2026) contre 2 100,00 € (…) : −7 % ». */
    _renderSummary(comparison, totals, rowCount) {
        if (!this.summaryElement) return;
        if (rowCount === 0) {
            this.summaryElement.textContent = 'Aucune dépense sur ces périodes.';
            return;
        }
        const delta = formatDelta(totals.delta);
        BaseChartData.bindAmountText(this.summaryElement, (hide) => (hide
            ? `Dépenses ${comparison.primaryLabel.toLowerCase()} face à ${comparison.comparisonLabel.toLowerCase()} : ${delta}`
            : `Dépenses : ${formatEuros(totals.primary)} (${comparison.primaryLabel}) contre ${formatEuros(totals.comparison)} (${comparison.comparisonLabel}), écart ${delta}`));
    }

    _createYearSelect(id, defaultSelectedYear, currentYear) {
        const selectEl = InjectedStyles.createSelect(id);
        for (let y = currentYear + 1; y >= 2015; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === defaultSelectedYear) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        }
        return selectEl;
    }

    _createMonthSelect(id, defaultMonthValue) {
        const selectEl = InjectedStyles.createSelect(id);
        this.monthsArray.forEach((monthName, index) => {
            const option = document.createElement('option');
            option.value = (index === 0) ? "ALL" : index.toString(); // Ensure value is string
            option.textContent = monthName;
            selectEl.appendChild(option);
        });
        selectEl.value = defaultMonthValue.toString(); // Ensure value matches option.value type
        return selectEl;
    }

}
