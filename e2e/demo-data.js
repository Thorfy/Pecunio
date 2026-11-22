// Jeu de démonstration SYNTHÉTIQUE pour les captures du README
// (scripts/capture-readme-screens.mjs) : deux ans de transactions inventées
// pour un foyer fictif, avec la taxonomie et les couleurs de catégories de
// Bankin. Aucune donnée réelle.

/** Couleurs des catégories parentes de Bankin (classes CSS `categoryColor_<id>`). */
export const CATEGORY_COLORS = {
    2: 'rgb(84, 222, 61)', // Entrées d'argent
    159: 'rgb(137, 209, 255)', // Impôts & Taxes
    160: 'rgb(159, 195, 211)', // Divers
    161: 'rgb(103, 127, 224)', // Logement
    162: 'rgb(254, 51, 102)', // Achats & Shopping
    163: 'rgb(252, 93, 106)', // Santé
    164: 'rgb(183, 134, 103)', // Banque
    165: 'rgb(0, 203, 203)', // Auto & Transports
    168: 'rgb(255, 178, 0)', // Alimentation & Restau.
    170: 'rgb(155, 89, 182)', // Loisirs & Sorties
    171: 'rgb(194, 148, 194)', // Abonnements
};

/** Feuille de style équivalente à celle de Bankin pour ces couleurs. */
export const CATEGORY_COLORS_CSS = Object.entries(CATEGORY_COLORS)
    .map(([id, color]) => `.categoryColor_${id} { background-color: ${color}; }`)
    .join('\n');

export const DEMO_CATEGORIES = [
    { id: 2, name: "Entrées d'argent", categories: [{ id: 230, name: 'Salaires' }, { id: 231, name: 'Remboursements' }] },
    { id: 161, name: 'Logement', categories: [{ id: 180, name: 'Loyer' }, { id: 181, name: 'Électricité' }, { id: 182, name: 'Assurance habitation' }] },
    { id: 168, name: 'Alimentation & Restau.', categories: [{ id: 188, name: 'Supermarché / Epicerie' }, { id: 189, name: 'Restaurants' }] },
    { id: 165, name: 'Auto & Transports', categories: [{ id: 190, name: 'Carburant' }, { id: 191, name: 'Transports en commun' }] },
    { id: 170, name: 'Loisirs & Sorties', categories: [{ id: 200, name: 'Sport' }, { id: 201, name: 'Sorties' }, { id: 202, name: 'Voyages / Vacances' }] },
    { id: 171, name: 'Abonnements', categories: [{ id: 210, name: 'Internet' }, { id: 211, name: 'Téléphonie mobile' }, { id: 212, name: 'Streaming' }] },
    { id: 162, name: 'Achats & Shopping', categories: [{ id: 220, name: 'Vêtements' }, { id: 221, name: 'Cadeaux' }] },
    { id: 163, name: 'Santé', categories: [{ id: 240, name: 'Médecin' }, { id: 241, name: 'Pharmacie' }] },
    { id: 164, name: 'Banque', categories: [{ id: 250, name: 'Frais bancaires' }, { id: 282, name: 'Épargne' }, { id: 326, name: 'Virements internes' }] },
    { id: 159, name: 'Impôts & Taxes', categories: [{ id: 260, name: 'Taxe foncière' }] },
];

export const DEMO_ACCOUNTS = [
    { id: 101, name: 'Compte courant' },
    { id: 102, name: 'Livret A' },
];

/** Générateur pseudo-aléatoire déterministe (mêmes captures à chaque exécution). */
function random(seed) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/**
 * Transactions de démonstration sur `months` mois, jusqu'au mois de `until` inclus.
 * @param {{ until?: Date, months?: number, seed?: number }} [options]
 */
export function demoTransactions({ until = new Date(), months = 24, seed = 42 } = {}) {
    const rnd = random(seed);
    const between = (min, max) => Math.round((min + rnd() * (max - min)) * 100) / 100;
    const transactions = [];
    let id = 1;
    const add = (year, month, day, amount, categoryId, description, expenseType, accountId = 101) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        transactions.push({
            id: id++,
            amount,
            date,
            description,
            account: { id: accountId, resource_uri: `/v2/accounts/${accountId}` },
            category: { id: categoryId, resource_uri: `/v2/categories/${categoryId}` },
            expense_type: expenseType,
            current_month: 0,
        });
    };

    for (let i = months - 1; i >= 0; i--) {
        const ref = new Date(until.getFullYear(), until.getMonth() - i, 1);
        const y = ref.getFullYear();
        const m = ref.getMonth() + 1;
        const last = new Date(y, m, 0).getDate();
        const day = (d) => Math.min(d, last);

        add(y, m, day(28), between(2600, 2700), 230, 'Salaire', 'OTHER');
        if (rnd() < 0.2) add(y, m, day(12), between(20, 90), 231, 'Remboursement mutuelle', 'OTHER');

        add(y, m, 5, -890, 180, 'Loyer', 'ESSENTIAL');
        add(y, m, 8, -between(m <= 3 || m >= 11 ? 85 : 45, m <= 3 || m >= 11 ? 120 : 65), 181, 'Électricité', 'ESSENTIAL');
        add(y, m, 10, -18.5, 182, 'Assurance habitation', 'ESSENTIAL');

        for (const d of [3, 10, 17, 24]) add(y, m, day(d), -between(55, 115), 188, 'Supermarché', 'ESSENTIAL');
        const restaurants = 2 + Math.floor(rnd() * 3);
        for (let r = 0; r < restaurants; r++) add(y, m, day(6 + r * 6), -between(14, 48), 189, 'Restaurant', 'PLEASURE');

        add(y, m, 7, -between(55, 75), 190, 'Station-service', 'ESSENTIAL');
        add(y, m, 21, -between(50, 70), 190, 'Station-service', 'ESSENTIAL');
        add(y, m, 2, -75.2, 191, 'Abonnement transports', 'ESSENTIAL');

        add(y, m, 4, -35, 200, 'Salle de sport', 'PLEASURE');
        add(y, m, day(15), -between(20, 65), 201, 'Cinéma et sorties', 'PLEASURE');
        if (m === 7 || m === 8) add(y, m, 12, -between(550, 900), 202, 'Location vacances', 'PLEASURE');

        add(y, m, 6, -29.99, 210, 'Box internet', 'ESSENTIAL');
        add(y, m, 9, -14.99, 211, 'Forfait mobile', 'ESSENTIAL');
        add(y, m, 11, y >= until.getFullYear() ? -13.99 : -11.99, 212, 'Streaming vidéo', 'PLEASURE');

        if (rnd() < 0.7) add(y, m, day(19), -between(35, 140), 220, 'Vêtements', 'PLEASURE');
        if (m === 12) add(y, m, 18, -between(250, 400), 221, 'Cadeaux de Noël', 'PLEASURE');
        if (rnd() < 0.4) add(y, m, day(13), -26.5, 240, 'Consultation médecin', 'ESSENTIAL');
        if (rnd() < 0.3) add(y, m, day(14), -between(8, 30), 241, 'Pharmacie', 'ESSENTIAL');

        add(y, m, 1, -2.9, 250, 'Frais de tenue de compte', 'ESSENTIAL');
        add(y, m, day(29), -300, 282, 'Épargne mensuelle', 'SAVING');
        add(y, m, day(29), 300, 326, 'Virement depuis compte courant', 'OTHER', 102);
        if (m === 10) add(y, m, 15, -between(700, 800), 260, 'Taxe foncière', 'ESSENTIAL');
    }
    return transactions;
}
