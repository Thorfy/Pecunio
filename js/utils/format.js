/**
 * Formatage des nombres pour l'affichage (français).
 */

const EUROS = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/**
 * Nombre (graduations des axes) : `-1 500`.
 * @param {number} value
 */
export function formatNumber(value) {
    return NUMBER.format(value);
}

/**
 * Montant en euros : `-1 234,50 €`.
 * @param {number} value
 */
export function formatEuros(value) {
    return `${EUROS.format(value)} €`;
}

/**
 * Pourcentage : `12,5 %`.
 * @param {number} value valeur en pourcentage (12.5 pour 12,5 %)
 */
export function formatPercent(value) {
    return `${PERCENT.format(value)} %`;
}

/** Abréviations des mois (index 1 à 12), comme sur les axes des graphiques. */
export const SHORT_MONTH_NAMES = ['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Noms des mois (index 1 à 12), avec majuscule, pour les listes de choix. */
export const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
