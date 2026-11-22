import { getHiddenCategories, watchHiddenCategories } from '../core/CategoryVisibility.js';
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { MONTH_NAMES, formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';

export class BudgetChart extends BaseChartData {
    /**
     * Libellé de l'infobulle d'une barre : « Série : -158,30 € ».
     * Pour un graphique en barres, Chart.js fournit `context.parsed` sous forme
     * d'objet { x, y } : la valeur est `parsed.y` (bug B20 : NaN affiché).
     * @param {{ dataset?: { label?: string }, parsed?: number|{ y?: number }, raw?: unknown }} context
     * @param {boolean} hideAmounts - mode « montants masqués »
     * @returns {string}
     */
    static formatTooltipLabel(context, hideAmounts) {
        const label = context?.dataset?.label || '';
        if (hideAmounts) return label;
        const parsed = context?.parsed;
        const candidate = parsed != null && typeof parsed === 'object' ? parsed.y : (parsed ?? context?.raw);
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
        
        // Injecter les styles Pecunio
        InjectedStyles.inject();
        
        this.containerElement.innerHTML = ''; // Clear the container
        
        // Appliquer les classes Pecunio au conteneur
        InjectedStyles.applyContainerClasses(this.containerElement);

        const budgetTitle = InjectedStyles.createTitle("📊 Comparaison Budget Médian");
        this.containerElement.appendChild(budgetTitle);

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'medianChartSelectors';
        selectorContainer.classList.add('pecunio-controls');
        this.containerElement.appendChild(selectorContainer);

        const currentYear = new Date().getFullYear();

        // Left Column (Primary)
        const leftColumnDiv = InjectedStyles.createControlGroup();

        const leftColumnTitle = document.createElement('strong');
        leftColumnTitle.textContent = 'Colonne Gauche (Principale)';
        leftColumnTitle.style.fontSize = '13px';
        leftColumnTitle.style.color = '#333';
        leftColumnDiv.appendChild(leftColumnTitle);

        const yearLabelLeft = InjectedStyles.createLabel('Année:', 'yearSelectorLeft');
        leftColumnDiv.appendChild(yearLabelLeft);
        this.yearSelectorLeft = this._createYearSelect('yearSelectorLeft', currentYear, currentYear);
        leftColumnDiv.appendChild(this.yearSelectorLeft);

        const monthLabelLeft = InjectedStyles.createLabel('Mois:', 'monthSelectorLeft');
        leftColumnDiv.appendChild(monthLabelLeft);
        this.monthSelectorLeft = this._createMonthSelect('monthSelectorLeft', "ALL");
        leftColumnDiv.appendChild(this.monthSelectorLeft);
        selectorContainer.appendChild(leftColumnDiv);

        // Right Column (Comparison)
        const rightColumnDiv = InjectedStyles.createControlGroup();

        const rightColumnTitle = document.createElement('strong');
        rightColumnTitle.textContent = 'Colonne Droite (Comparaison)';
        rightColumnTitle.style.fontSize = '13px';
        rightColumnTitle.style.color = '#333';
        rightColumnDiv.appendChild(rightColumnTitle);

        const yearLabelRight = InjectedStyles.createLabel('Année:', 'yearSelectorRight');
        rightColumnDiv.appendChild(yearLabelRight);
        this.yearSelectorRight = this._createYearSelect('yearSelectorRight', currentYear - 1, currentYear);
        rightColumnDiv.appendChild(this.yearSelectorRight);

        const monthLabelRight = InjectedStyles.createLabel('Mois:', 'monthSelectorRight');
        rightColumnDiv.appendChild(monthLabelRight);
        this.monthSelectorRight = this._createMonthSelect('monthSelectorRight', "ALL");
        rightColumnDiv.appendChild(this.monthSelectorRight);
        selectorContainer.appendChild(rightColumnDiv);

        // Calculation Type Selector
        const calcDiv = InjectedStyles.createControlGroup();

        const calcLabel = InjectedStyles.createLabel('Calcul:', 'calculationTypeSelector');
        calcDiv.appendChild(calcLabel);

        this.calcTypeSelector = InjectedStyles.createSelect('calculationTypeSelector');

        const optionMedian = document.createElement('option');
        optionMedian.value = 'median';
        optionMedian.textContent = 'Médiane';
        optionMedian.selected = true;
        this.calcTypeSelector.appendChild(optionMedian);

        const optionAverage = document.createElement('option');
        optionAverage.value = 'average';
        optionAverage.textContent = 'Moyenne';
        this.calcTypeSelector.appendChild(optionAverage);

        calcDiv.appendChild(this.calcTypeSelector);
        selectorContainer.appendChild(calcDiv);

        // Canvas Creation
        const canvasContainer = InjectedStyles.createCanvasContainer();
        this.containerElement.appendChild(canvasContainer);
        
        const budgetCanvas = InjectedStyles.createCanvas();
        canvasContainer.appendChild(budgetCanvas);
        
        if (budgetCanvas) {
            this.budgetCtx = budgetCanvas.getContext('2d');
        } else {
            console.error("[ChartDataBudget] createUI: Failed to create canvas element.");
            return;
        }

        // Attach Event Listeners
        this.yearSelectorLeft.addEventListener('change', this._updateChartView.bind(this));
        this.monthSelectorLeft.addEventListener('change', this._updateChartView.bind(this));
        this.yearSelectorRight.addEventListener('change', this._updateChartView.bind(this));
        this.monthSelectorRight.addEventListener('change', this._updateChartView.bind(this));
        this.calcTypeSelector.addEventListener('change', this._updateChartView.bind(this));

        // Initial Chart Load (after awaiting initializationPromise)
        this.initializationPromise.then(() => {
            if (this._destroyed) return; // graphique remplacé entre-temps
            this._setupStorageListener();
            this._updateChartView();
        }).catch(error => {
            console.error("[ChartDataBudget] createUI: Error during initial data load for chart view:", error);
        });
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

    getActualSpendingForMonth(year, month) {
        // Logger.debug(`[ChartDataBudget] getActualSpendingForMonth: Called for year ${year}, month ${month}.`);
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

    async prepareData(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, calculationType = 'median') {
        await this.initializationPromise;
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

    async _updateChartView() {
        // Get new selector values
        const selectedYearLeft = parseInt(this.yearSelectorLeft.value);
        const monthValueLeft = this.monthSelectorLeft.value;
        const selectedMonthLeft = (monthValueLeft === "ALL") ? "ALL" : parseInt(monthValueLeft);

        const selectedYearRight = parseInt(this.yearSelectorRight.value);
        const monthValueRight = this.monthSelectorRight.value;
        const selectedMonthRight = (monthValueRight === "ALL") ? "ALL" : parseInt(monthValueRight);

        const selectedCalcType = this.calcTypeSelector.value;

        // Logger.debug(`[ChartDataBudget] _updateChartView. Left: ${selectedYearLeft}/${selectedMonthLeft}, Right: ${selectedYearRight}/${selectedMonthRight}, CalcType: ${selectedCalcType}`);

        if (!this || typeof this.prepareData !== 'function') { // Check instance and method
            console.error('[ChartDataBudget] _updateChartView: instance is not ready or prepareData is missing.');
            return;
        }

        const newChartData = await this.prepareData(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, selectedCalcType);

        if (!newChartData || !newChartData.labels || !newChartData.datasets || !Array.isArray(newChartData.datasets)) {
            console.error('[ChartDataBudget] _updateChartView: Invalid data structure received from prepareData. Data:', newChartData);
            if(this.budgetChart) {
                this.budgetChart.data.labels = [];
                this.budgetChart.data.datasets = [];
                this.budgetChart.update();
            }
            return;
        }
        for(const dataset of newChartData.datasets) {
            if (!Array.isArray(dataset.data)) {
                console.error('[ChartDataBudget] _updateChartView: Invalid dataset structure, missing data array:', dataset);
                if(this.budgetChart) {
                   this.budgetChart.data.labels = [];
                   this.budgetChart.data.datasets = [];
                   this.budgetChart.update();
                }
                return;
            }
        }

        const periodLabel = (year, monthValue) =>
            monthValue === "ALL" ? `${year}, tous les mois` : `${this.monthsArray[parseInt(monthValue)]} ${year}`;
        const dynamicTitle = `Budget : ${periodLabel(selectedYearLeft, monthValueLeft)} et ${periodLabel(selectedYearRight, monthValueRight)}`
            + ` (${BudgetChart.calculationLabel(selectedCalcType).toLowerCase()})`;

        if (this.budgetChart) {
            this.budgetChart.data = newChartData;
            this.budgetChart.options.plugins.title.text = dynamicTitle;
            this.budgetChart.update();
        } else {
            if (this.budgetChart) {
               // console.warn('[ChartDataBudget] _updateChartView: budgetChart was not null before creation, destroying old instance.');
               this.budgetChart.destroy();
            }
            try {
                this.budgetChart = new Chart(this.budgetCtx, { // Assumes Chart is global
                    type: 'bar',
                    data: newChartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: Config.isBlurry() ? '' : 'Montant (€)'
                                },
                                ticks: {
                                    callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value)))
                                }
                            },
                            x: {
                                title: {
                                    display: false,
                                    text: 'Catégories'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: (context) => BudgetChart.formatTooltipLabel(context, Config.isBlurry())
                                }
                            },
                            title: {
                                display: true,
                                text: dynamicTitle
                            }
                        }
                    }
                });
                BaseChartData._attachAmountVisibilityListener(this.budgetChart);
                // Logger.debug('[ChartDataBudget] _updateChartView: New budget bar chart created successfully.');
            } catch (error) {
                console.error('[ChartDataBudget] _updateChartView: Error creating new budget bar chart:', error);
                this.budgetChart = null;
            }
        }
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
