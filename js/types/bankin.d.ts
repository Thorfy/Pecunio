// Types des données de l'API Bankin v2 (sync.bankin.com), telles que Pecunio les lit.
// Seuls les champs utilisés sont décrits ; l'API en renvoie d'autres.

/** Référence vers une ressource liée (compte, catégorie). */
export interface BankinRef {
    id: number;
    resource_uri?: string;
}

export interface BankinTransaction {
    id: number;
    /** Montant signé : négatif pour une dépense, positif pour un revenu. */
    amount: number;
    /** Date de la transaction, `YYYY-MM-DD`. */
    date: string;
    description: string;
    account: BankinRef;
    category: BankinRef;
    /** Décalage du mois de rattachement (« budget ») choisi dans Bankin, en mois. */
    current_month?: number | null;
    expense_type?: 'ESSENTIAL' | 'PLEASURE' | 'SAVING' | 'OTHER' | string | null;
}

export interface BankinCategory {
    id: number;
    name: string;
    /** Sous-catégories ; absentes pour certaines catégories parentes. */
    categories?: BankinCategory[];
}

export interface BankinAccount {
    id: number;
    name: string;
}

/** Page d'une réponse paginée de l'API. */
export interface BankinPage<T> {
    resources?: T[];
    pagination?: { next_uri?: string | null; previous_uri?: string | null };
}

/** Données de l'API mises en cache par CacheStore. */
export interface BankinData {
    transactions: BankinTransaction[];
    categories: BankinCategory[];
    accounts: BankinAccount[];
}
