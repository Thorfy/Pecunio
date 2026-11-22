import { Config } from '../core/Config.js';
import { defaultSettings } from '../core/SettingsSchema.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { currentMonthKey, savingsFromTimeline } from './savings.js';
import { RANGE_LABELS, buildTimeline } from './timeline.js';
import { roundHalfAway } from './variations.js';

/** Solde positif (épargne) et négatif (déficit). */
const SAVED_COLOR = 'rgb(46, 230, 166)';
const DEFICIT_COLOR = 'rgb(252, 93, 106)';
/** Taux affiché borné : un mois à faibles revenus écraserait l'échelle. */
const RATE_LIMIT = 100;

/**
 * Épargne mois par mois (page Comptes, G1, lot UX-3b) : solde de chaque mois
 * en barres et taux d'épargne en courbe, sur la période du graphique temporel.
 */
export class SavingsChart extends BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        this.chartInstance = null;
        this.savings = null;
        /** Date du jour (remplaçable dans les tests). */
        this.now = () => new Date();
    }

    /** Période du graphique temporel (`chartRange`). */
    _range() {
        return this.settingsInstance?.getSetting('chartRange') ?? defaultSettings().chartRange;
    }

    /** Mêmes données et même solde que le graphique temporel. */
    async prepareData() {
        const filtered = await this.applySettingOnData();
        const byCategory = this.mergeTransactionByCategoryLegacy(filtered, this.categories);
        const timeline = buildTimeline({ categories: this.categories, byCategory, range: this._range(), detailed: true });
        this.savings = savingsFromTimeline(timeline, currentMonthKey(this.now()));
        return this.savings;
    }

    /** Titre, selon la période. */
    static title(range) {
        return range === 'all' ? 'Épargne par mois' : `Épargne — ${RANGE_LABELS[range] ?? RANGE_LABELS['12m']}`;
    }

    /** « 12 % », « -8 % ». */
    static percent(rate) {
        return `${roundHalfAway(rate * 100)} %`;
    }

    /**
     * Phrase de synthèse sur les mois complets de la période.
     * @param {import('./savings.js').Savings} savings
     * @param {boolean} hideAmounts
     */
    static summary(savings, hideAmounts) {
        const { count, income, balance, rate } = savings.total;
        if (count === 0) return 'Pas encore de mois complet sur la période.';
        const span = count === 1 ? 'Sur 1 mois complet' : `Sur ${count} mois complets`;
        if (hideAmounts) return rate == null ? span : `${span} : taux d'épargne ${SavingsChart.percent(rate)}`;
        if (balance < 0) {
            const share = rate == null ? '' : ` (${SavingsChart.percent(rate)} des revenus)`;
            return `${span} : ${formatEuros(-balance)} de plus dépensés que reçus${share}`;
        }
        if (rate == null) return `${span} : ${formatEuros(balance)} de solde`;
        return `${span} : ${formatEuros(balance)} mis de côté sur ${formatEuros(income)} de revenus, soit ${SavingsChart.percent(rate)}`;
    }

    /** « nov. 25 ». */
    static monthLabel(month) {
        const [year, mon] = month.split('-').map(Number);
        return new Date(year, mon - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }

    /**
     * Crée la carte sous le graphique temporel.
     * @param {HTMLElement} container
     */
    async render(container) {
        const savings = await this.prepareData();
        const wrapper = document.createElement('div');
        wrapper.className = 'pecunio-section pecunio-savings-wrapper';
        wrapper.appendChild(InjectedStyles.createTitle(SavingsChart.title(this._range())));
        const summary = document.createElement('p');
        summary.className = 'pecunio-budget-summary';
        summary.textContent = SavingsChart.summary(savings, Config.isBlurry());
        wrapper.appendChild(summary);
        container.appendChild(wrapper);
        if (savings.months.length === 0) return null;

        const canvasContainer = InjectedStyles.createCanvasContainer();
        canvasContainer.style.height = '240px';
        const canvas = InjectedStyles.createCanvas();
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);

        // Mois en cours : couleur atténuée, il n'est pas terminé
        const alpha = (i) => (i === savings.inProgress ? 0.35 : 0.85);
        const barColors = savings.balance.map((value, i) =>
            (value >= 0 ? SAVED_COLOR : DEFICIT_COLOR).replace('rgb(', 'rgba(').replace(')', `, ${alpha(i)})`));
        const ratePoints = savings.rate.map((r) => (r == null ? null : Math.max(-RATE_LIMIT, Math.min(RATE_LIMIT, r * 100))));

        this.chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: savings.months.map((m, i) => `${SavingsChart.monthLabel(m)}${i === savings.inProgress ? ' (en cours)' : ''}`),
                datasets: [
                    /** @type {any} */ ({
                        type: 'line',
                        label: "Taux d'épargne",
                        data: ratePoints,
                        yAxisID: 'rate',
                        borderColor: THEME.accent,
                        backgroundColor: THEME.accent,
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.25,
                        spanGaps: false,
                        order: 0,
                    }),
                    {
                        label: 'Solde du mois',
                        data: savings.balance,
                        yAxisID: 'amount',
                        backgroundColor: barColors,
                        borderRadius: 4,
                        order: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    amount: {
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Solde du mois' },
                        ticks: { callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value))) },
                    },
                    rate: {
                        position: 'right',
                        // Zéro aligné sur celui des soldes tant qu'aucun mois n'est en déficit
                        suggestedMin: 0,
                        suggestedMax: 50,
                        title: { display: true, text: "Taux d'épargne" },
                        grid: { drawOnChartArea: false },
                        ticks: { callback: (value) => `${value} %` },
                    },
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            // Barres vertes ou rouges : légende en vert (épargne)
                            generateLabels: (chart) => Chart.defaults.plugins.legend.labels.generateLabels(chart).map((item) =>
                                (item.text === 'Solde du mois'
                                    ? { ...item, text: 'Solde du mois (rouge : déficit)', fillStyle: SAVED_COLOR, strokeStyle: SAVED_COLOR }
                                    : item)),
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const i = context.dataIndex;
                                if (context.dataset.yAxisID === 'rate') {
                                    const rate = savings.rate[i];
                                    return rate == null ? "Taux d'épargne : sans revenus" : `Taux d'épargne : ${SavingsChart.percent(rate)}`;
                                }
                                return Config.isBlurry() ? 'Solde du mois' : `Solde du mois : ${formatEuros(savings.balance[i])}`;
                            },
                        },
                    },
                },
            },
        });
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);
        return this.chartInstance;
    }
}
