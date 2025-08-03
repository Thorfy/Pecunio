/**
 * Account - Modèle représentant un compte bancaire
 * Utilisé pour identifier la source des transactions
 */
class Account {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }

    /**
     * Crée une instance Account à partir de données brutes
     * @param {Object} rawAccount - Données brutes du compte
     * @returns {Account} Instance de Account
     */
    static fromRaw(rawAccount) {
        if (!rawAccount || !rawAccount.id || !rawAccount.name) {
            throw new Error('Invalid raw account data');
        }
        return new Account(rawAccount.id, rawAccount.name);
    }

    /**
     * Vérifie si le compte est valide
     * @returns {boolean}
     */
    isValid() {
        return this.id != null && this.name != null && this.name.trim() !== '';
    }

    /**
     * Retourne une représentation string du compte
     * @returns {string}
     */
    toString() {
        return `Account(id: ${this.id}, name: "${this.name}")`;
    }

    /**
     * Compare ce compte avec un autre
     * @param {Account} other - Autre compte à comparer
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof Account)) {
            return false;
        }
        return this.id === other.id && this.name === other.name;
    }

    /**
     * Retourne le nom du compte pour l'affichage
     * @returns {string}
     */
    getDisplayName() {
        return this.name || 'Compte sans nom';
    }
} 