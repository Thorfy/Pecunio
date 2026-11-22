/**
 * Couleurs des catégories parentes de Bankin (règles CSS `.categoryColor_<id>`
 * de app2.bankin.com, relevées le 22/11/2026).
 *
 * Dans la page Bankin, les graphiques lisent ces couleurs directement dans le
 * CSS de Bankin (ColorParser). Les pages de l'extension (rapport PDF) n'ont pas
 * ce CSS : elles utilisent cette table, pour garder les mêmes couleurs.
 */
export const BANKIN_CATEGORY_COLORS = Object.freeze({
    0: 'rgb(82, 179, 242)',
    1: 'rgb(159, 195, 211)',
    2: 'rgb(84, 222, 61)', // Entrées d'argent
    159: 'rgb(137, 209, 255)', // Impôts & Taxes
    160: 'rgb(159, 195, 211)', // Divers
    161: 'rgb(103, 127, 224)', // Logement
    162: 'rgb(254, 51, 102)', // Achats & Shopping
    163: 'rgb(252, 93, 106)', // Santé
    164: 'rgb(183, 134, 103)', // Banque
    165: 'rgb(0, 203, 203)', // Auto & Transports
    166: 'rgb(113, 127, 195)', // Dépenses pro
    167: 'rgb(249, 182, 139)', // Scolarité & Enfants
    168: 'rgb(255, 178, 0)', // Alimentation & Restau.
    170: 'rgb(155, 89, 182)', // Loisirs & Sorties
    171: 'rgb(194, 148, 194)', // Abonnements
    303: 'rgb(24, 201, 93)', // Retraits, Chq. et Vir.
    315: 'rgb(255, 135, 194)', // Esthétique & Soins
});

/** Couleurs de repli (catégorie inconnue), dans l'ordre d'apparition. */
const FALLBACK_COLORS = ['rgb(101, 98, 252)', 'rgb(46, 230, 166)', 'rgb(255, 159, 64)', 'rgb(54, 162, 235)', 'rgb(201, 203, 207)'];

/**
 * Couleur d'une catégorie parente de Bankin.
 * @param {number | string | null | undefined} id identifiant de la catégorie parente
 * @param {number} [alpha] opacité (1 = opaque)
 * @param {number} [fallbackIndex] rang, pour varier la couleur de repli
 * @returns {string} `rgb(…)` ou `rgba(…)`
 */
export function categoryColor(id, alpha = 1, fallbackIndex = 0) {
    const rgb = (id != null && BANKIN_CATEGORY_COLORS[id]) || FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
    return alpha === 1 ? rgb : rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}
