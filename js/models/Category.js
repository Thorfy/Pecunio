/**
 * Category - Modèle représentant une catégorie de transaction
 * Utilisé pour organiser et classifier les transactions
 */
export class Category {
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
} 