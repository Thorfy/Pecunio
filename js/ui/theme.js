/**
 * Jetons de style de Pecunio, alignés sur l'interface de Bankin
 * (docs/AUDIT-UX.md §3) : même police, mêmes couleurs de texte et d'accent.
 * Utilisés par Chart.js (js/lib/chart.js) et par le CSS injecté (InjectedStyles).
 */
export const THEME = Object.freeze({
    /** Police de Bankin (déjà chargée par app2.bankin.com ; embarquée dans le rapport). */
    fontFamily: '"Open Sans", Arial, sans-serif',
    /** Titres et texte principal (bleu nuit de Bankin). */
    text: '#00213c',
    /** Textes secondaires, graduations et légendes. */
    textMuted: '#5b6b7c',
    /** Violet de Bankin. */
    accent: '#6562fc',
    /** Vert « croissance » de la marque Pecunio. */
    accentGreen: '#2ee6a6',
    /** Grilles des graphiques. */
    grid: '#e9f0f7',
    /** Bordures des cartes. */
    border: '#e6ebf2',
});

/**
 * Applique le thème aux réglages par défaut de Chart.js.
 * @param {typeof import('chart.js').Chart} Chart
 */
export function applyChartTheme(Chart) {
    Chart.defaults.font.family = THEME.fontFamily;
    Chart.defaults.color = THEME.textMuted;
    Chart.defaults.borderColor = THEME.grid;
    Chart.defaults.plugins.title.color = THEME.text;
    Chart.defaults.plugins.title.font = { ...Chart.defaults.plugins.title.font, size: 14, weight: 'bold' };
}
