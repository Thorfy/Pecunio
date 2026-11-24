import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { deltaText } from './budgetComparison.js';
import { buildYearPace, dailySpendingByYear, DAYS_IN_YEAR, medianYears, monthDayFromIndex, yearChoices } from './yearPace.js';

/**
 * Rythme de l'année (page Comptes) : dépenses cumulées d'une année au choix,
 * face à une année complète au choix ou à la médiane des années complètes
 * précédentes. Pas de carte sans au moins une année complète.
 */
export class YearPaceChart extends BaseChartData {
    /** Repères de l'axe des jours, un par mois. */
    static MONTH_TICKS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

    /** Valeur de « Comparer à » pour la médiane. */
    static MEDIAN = 'median';

    /**
     * @param {object[]} transactions
     * @param {object[]} categories
     * @param {number[] | null} accountsSelected
     * @param {object} [settings]
     * @param {object} [settingsInstance]
     */
    constructor(transactions, categories, accountsSelected = null, settings = null, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        this.chartInstance = null;
        /** Date du jour (remplaçable dans les tests). */
        this.now = () => new Date();
    }

    /** Catégories de revenus (« Entrées d'argent » et ses sous-catégories), ignorées. */
    _incomeCategoryIds() {
        const income = this.categories?.find((c) => c?.id === Config.CATEGORIES.BUDGET_CATEGORY_ID);
        return new Set([Config.CATEGORIES.BUDGET_CATEGORY_ID, ...(income?.categories || []).map((c) => c.id)]);
    }

    /**
     * Dépenses par jour des comptes choisis, sur tout l'historique (la période
     * du graphique des dépenses ne s'applique pas : on choisit l'année ici).
     */
    prepareData() {
        const transactions = this.applySettingOnData({ startDate: null, endDate: null });
        this.spending = dailySpendingByYear(transactions, this._incomeCategoryIds());
        this.choices = yearChoices(this.spending, this.now());
        return this.choices;
    }

    /**
     * Références possibles pour une année affichée : la médiane des années
     * complètes précédentes (s'il y en a), puis chaque autre année complète.
     * @param {{ years: number[], completeYears: number[] }} choices
     * @param {number} year
     * @returns {{ value: string, label: string, years: number[] }[]}
     */
    static referenceOptions(choices, year) {
        const options = [];
        const median = medianYears(choices.completeYears, year);
        if (median.length > 1) {
            options.push({ value: YearPaceChart.MEDIAN, label: `Médiane de ${median[0]} à ${median.at(-1)}`, years: median });
        }
        for (const y of choices.completeYears) {
            if (y !== year) options.push({ value: String(y), label: String(y), years: [y] });
        }
        return options;
    }

    /**
     * Année affichée par défaut : l'année en cours si elle a des dépenses,
     * sinon la plus récente qui peut être comparée.
     * @param {{ years: number[], completeYears: number[] }} choices
     */
    static defaultYear(choices) {
        return choices.years.find((y) => YearPaceChart.referenceOptions(choices, y).length > 0) ?? null;
    }

    /** « 24 novembre » pour un indice de l'axe. */
    static dayLabel(index) {
        const { month, day } = monthDayFromIndex(index);
        return `${day === 1 ? '1er' : day} ${DateRange.MONTH_NAMES_FR[month - 1]}`;
    }

    /**
     * Légende de la courbe de référence.
     * @param {number[]} referenceYears
     */
    static referenceLabel(referenceYears) {
        if (referenceYears.length === 1) return String(referenceYears[0]);
        return `Médiane de ${referenceYears[0]} à ${referenceYears.at(-1)}`;
    }

    /**
     * Phrase de synthèse : « Au 24 novembre : … dépensés, contre … en 2025 à cette date, écart −12 % ».
     * @param {ReturnType<typeof buildYearPace>} pace
     * @param {boolean} hideAmounts
     */
    static summary(pace, hideAmounts) {
        if (pace.lastIndex < 0) return 'Année à venir : pas encore de dépenses.';
        const wholeYear = pace.lastIndex === DAYS_IN_YEAR - 1;
        const when = wholeYear ? `Sur ${pace.year}` : `Au ${YearPaceChart.dayLabel(pace.lastIndex)}`;
        const single = pace.referenceYears.length === 1 ? pace.referenceYears[0] : null;
        const delta = pace.delta == null ? null : deltaText(pace.delta);
        if (hideAmounts) {
            const versus = single ? `avec ${single}` : 'avec la médiane';
            return delta ? `${when} : ${delta} ${versus}` : when;
        }
        const base = `${when} : ${formatEuros(pace.spent)} dépensés`;
        const reference = single ? `en ${single}` : 'en médiane';
        const usual = wholeYear ? reference : `${reference} à cette date`;
        return delta ? `${base}, contre ${formatEuros(pace.usual)} ${usual}, ${delta}` : base;
    }

    /**
     * Crée la carte (rien sans année complète à comparer).
     * @param {HTMLElement} container
     */
    async render(container) {
        const choices = this.prepareData();
        const year = YearPaceChart.defaultYear(choices);
        if (year == null) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'pecunio-section pecunio-year-pace-wrapper';
        wrapper.appendChild(InjectedStyles.createTitle("Rythme de l'année"));

        const controls = document.createElement('div');
        controls.className = 'pecunio-controls';
        const group = (label, id) => {
            const div = InjectedStyles.createControlGroup();
            div.appendChild(InjectedStyles.createLabel(label, id));
            const select = InjectedStyles.createSelect(id);
            div.appendChild(select);
            controls.appendChild(div);
            return select;
        };
        this.yearSelect = group('Année :', 'pecunioYearPaceYear');
        this.referenceSelect = group('Comparer à :', 'pecunioYearPaceReference');
        for (const y of choices.years) {
            if (YearPaceChart.referenceOptions(choices, y).length === 0) continue;
            const option = document.createElement('option');
            option.value = String(y);
            option.textContent = String(y);
            this.yearSelect.appendChild(option);
        }
        this.yearSelect.value = String(year);
        wrapper.appendChild(controls);

        this.summaryElement = document.createElement('p');
        this.summaryElement.className = 'pecunio-budget-summary';
        BaseChartData.bindAmountText(this.summaryElement, (hide) => (this.pace ? YearPaceChart.summary(this.pace, hide) : ''));
        wrapper.appendChild(this.summaryElement);
        const canvasContainer = InjectedStyles.createCanvasContainer();
        canvasContainer.style.height = '260px';
        const canvas = InjectedStyles.createCanvas();
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);
        container.appendChild(wrapper);

        this.chartInstance = new Chart(canvas.getContext('2d'), this._chartConfig());
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);

        this._fillReferences();
        this.yearSelect.addEventListener('change', () => {
            this._fillReferences();
            this.update();
        });
        this.referenceSelect.addEventListener('change', () => this.update());
        this.update();
        return this.chartInstance;
    }

    /** Liste « Comparer à » de l'année choisie ; garde le choix précédent s'il existe encore. */
    _fillReferences() {
        const previous = this.referenceSelect.value;
        const options = YearPaceChart.referenceOptions(this.choices, Number(this.yearSelect.value));
        this.referenceSelect.replaceChildren(...options.map(({ value, label }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            return option;
        }));
        this._referenceOptions = options;
        this.referenceSelect.value = options.some((o) => o.value === previous) ? previous : options[0].value;
    }

    /** Recalcule et redessine pour l'année et la référence choisies. */
    update() {
        const year = Number(this.yearSelect.value);
        const reference = this._referenceOptions.find((o) => o.value === this.referenceSelect.value) ?? this._referenceOptions[0];
        this.pace = buildYearPace({ spending: this.spending, year, referenceYears: reference.years, today: this.now() });
        const [current, usual] = this.chartInstance.data.datasets;
        current.label = String(year);
        current.data = this.pace.current;
        usual.label = YearPaceChart.referenceLabel(reference.years);
        usual.data = this.pace.reference;
        this.chartInstance.update();
        this.summaryElement.textContent = YearPaceChart.summary(this.pace, Config.isBlurry());
    }

    _chartConfig() {
        return /** @type {any} */ ({
            type: 'line',
            data: {
                labels: Array.from({ length: DAYS_IN_YEAR }, (_, i) => YearPaceChart.dayLabel(i)),
                datasets: [
                    {
                        label: '',
                        data: [],
                        borderColor: THEME.accent,
                        backgroundColor: 'rgba(101, 98, 252, 0.12)',
                        fill: true,
                        borderWidth: 3,
                        pointRadius: 0,
                        tension: 0.2,
                        spanGaps: false,
                    },
                    {
                        label: '',
                        data: [],
                        borderColor: THEME.textMuted,
                        borderDash: [6, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.2,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { display: false },
                        // Un repère par mois, au 1er
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            callback: (_, index) => {
                                const { month, day } = monthDayFromIndex(index);
                                return day === 1 ? YearPaceChart.MONTH_TICKS[month - 1] : null;
                            },
                        },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value))) },
                    },
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                if (Config.isBlurry() || context.parsed.y == null) return label;
                                return `${label} : ${formatEuros(Number(context.parsed.y))}`;
                            },
                        },
                    },
                },
            },
        });
    }
}
