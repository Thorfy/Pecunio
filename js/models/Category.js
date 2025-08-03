/**
 * Category - Modèle représentant une catégorie de transaction
 * Utilisé pour organiser et classifier les transactions
 */
class Category {
    constructor(id, name, parentId = null) {
        this.id = id;
        this.name = name;
        this.parentId = parentId;
    }

    /**
     * Crée une instance Category à partir de données brutes
     * @param {Object} rawCategory - Données brutes de la catégorie
     * @param {number|null} parentId - ID de la catégorie parent (optionnel)
     * @returns {Category} Instance de Category
     */
    static fromRaw(rawCategory, parentId = null) {
        if (!rawCategory || !rawCategory.id || !rawCategory.name) {
            throw new Error('Invalid raw category data');
        }
        return new Category(rawCategory.id, rawCategory.name, parentId);
    }

    /**
     * Vérifie si la catégorie est une catégorie parent
     * @returns {boolean}
     */
    isParent() {
        return this.parentId === null;
    }

    /**
     * Vérifie si la catégorie est une sous-catégorie
     * @returns {boolean}
     */
    isChild() {
        return this.parentId !== null;
    }

    /**
     * Retourne une représentation string de la catégorie
     * @returns {string}
     */
    toString() {
        return `Category(id: ${this.id}, name: "${this.name}", parentId: ${this.parentId})`;
    }

    /**
     * Compare cette catégorie avec une autre
     * @param {Category} other - Autre catégorie à comparer
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof Category)) {
            return false;
        }
        return this.id === other.id && 
               this.name === other.name && 
               this.parentId === other.parentId;
    }
} 