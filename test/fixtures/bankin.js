// Données de test SYNTHÉTIQUES au format de l'API Bankin v2.
//
// Aucune donnée réelle : comptes, montants et libellés sont inventés.
// Les identifiants de catégories 2, 326 et 282 reprennent ceux que le code
// traite spécialement (Config.CATEGORIES) ; les autres sont arbitraires.

/** Catégories : parents avec sous-catégories (`categories`). */
export const CATEGORIES = [
    {
        id: 2,
        name: "Entrées d'argent",
        categories: [
            { id: 230, name: 'Salaires' },
            { id: 231, name: 'Remboursements' },
        ],
    },
    {
        id: 168,
        name: 'Alimentation & Restau.',
        categories: [
            { id: 188, name: 'Supermarché / Epicerie' },
            { id: 189, name: 'Restaurants' },
        ],
    },
    {
        id: 159,
        name: 'Logement',
        categories: [{ id: 180, name: 'Loyer' }],
    },
    {
        id: 160,
        name: 'Banque',
        categories: [
            { id: 326, name: 'Virements internes' },
            { id: 282, name: 'Épargne' },
        ],
    },
];

export const ACCOUNTS = [
    { id: 101, name: 'Compte courant' },
    { id: 102, name: 'Livret A' },
];

let nextId = 1000;

/**
 * Transaction brute Bankin.
 * @param {Partial<{id:number, amount:number, date:string, description:string,
 *   accountId:number, categoryId:number, expense_type:string, current_month:number}>} [fields]
 */
export function tx({
    id = nextId++,
    amount = -10,
    date = '2024-03-15',
    description = 'Achat test',
    accountId = 101,
    categoryId = 188,
    expense_type = 'ESSENTIAL',
    ...extra
} = {}) {
    return {
        id,
        amount,
        date,
        description,
        account: { id: accountId, resource_uri: `/v2/accounts/${accountId}` },
        category: { id: categoryId, resource_uri: `/v2/categories/${categoryId}` },
        expense_type,
        ...extra,
    };
}

/** Jeu de transactions varié sur 2024 (deux comptes, revenus, dépenses, exceptions). */
export function sampleTransactions() {
    return [
        tx({ id: 1, amount: 2500, date: '2024-01-31', categoryId: 230, expense_type: 'OTHER', description: 'Salaire' }),
        tx({ id: 2, amount: -800, date: '2024-01-05', categoryId: 180, description: 'Loyer janvier' }),
        tx({ id: 3, amount: -120.5, date: '2024-01-12', categoryId: 188, description: 'Courses' }),
        tx({ id: 4, amount: -45, date: '2024-01-20', categoryId: 189, expense_type: 'PLEASURE', description: 'Resto' }),
        tx({ id: 5, amount: -300, date: '2024-01-25', categoryId: 326, expense_type: 'OTHER', description: 'Virement vers livret' }),
        tx({ id: 6, amount: 300, date: '2024-01-25', categoryId: 326, accountId: 102, expense_type: 'OTHER', description: 'Virement depuis courant' }),
        tx({ id: 7, amount: 2500, date: '2024-02-29', categoryId: 230, expense_type: 'OTHER', description: 'Salaire' }),
        tx({ id: 8, amount: -800, date: '2024-02-05', categoryId: 180, description: 'Loyer février' }),
        tx({ id: 9, amount: -98.3, date: '2024-02-14', categoryId: 188, description: 'Courses' }),
        tx({ id: 10, amount: -60, date: '2024-02-14', categoryId: 189, expense_type: 'PLEASURE', description: 'Resto' }),
        tx({ id: 11, amount: -200, date: '2024-02-28', categoryId: 282, expense_type: 'SAVING', description: 'Épargne auto' }),
        tx({ id: 12, amount: -800, date: '2024-03-05', categoryId: 180, description: 'Loyer mars' }),
        tx({ id: 13, amount: -150, date: '2024-03-10', categoryId: 188, description: 'Courses' }),
    ];
}

/**
 * Page de réponse paginée de l'API.
 * @param {object[]} resources
 * @param {string|null} [nextUri]
 */
export function apiPage(resources, nextUri = null) {
    return { resources, pagination: { next_uri: nextUri, previous_uri: null } };
}

/** Réponse `fetch` minimale. */
export function jsonResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    };
}

/** En-têtes d'authentification factices capturés par bg.js. */
export const AUTH_HEADERS = {
    Authorization: 'Bearer test-token',
    'Bankin-Version': '2019-08-22',
    'Client-Id': 'test-client-id',
    'Client-Secret': 'test-client-secret',
};
