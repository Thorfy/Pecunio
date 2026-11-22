import { categoryColor } from '../bankin/categoryColors.js';

/** Identifiant de la catégorie parente d'une ligne (couleur de Bankin). */
const parentIdOf = (row) => row.parentCategoryId ?? row.categoryId ?? null;

/** « 2024-02 » → « févr. 2024 ». */
const monthLabel = (yearMonth) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

/**
 * ReportChartDataBuilder - Construction des données pour les graphiques du rapport PDF
 * Prend des lignes fusionnées (mergedData) et produit les structures attendues par Chart.js
 */
export class ReportChartDataBuilder {
    static EXPENSE_TYPE_LABELS = {
        ESSENTIAL: 'Essentiel',
        PLEASURE: 'Plaisir',
        OTHER: 'Autre',
        SAVING: 'Épargne'
    };

    static EXPENSE_TYPE_COLORS = [
        'rgba(99, 102, 241, 0.85)',
        'rgba(247, 113, 113, 0.85)',
        'rgba(148, 163, 184, 0.85)',
        'rgba(52, 211, 153, 0.85)'
    ];

    /**
     * Données pour le graphique par type de dépense (donut)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], data: number[], colors: string[] }}
     */
    static buildExpenseTypeData(mergedData) {
        const byType = new Map();
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const type = row.expenseType || 'OTHER';
            const label = ReportChartDataBuilder.EXPENSE_TYPE_LABELS[type] || type;
            const abs = Math.abs(row.amount);
            byType.set(label, (byType.get(label) || 0) + abs);
        });
        const labels = [];
        const data = [];
        const typeOrder = ['ESSENTIAL', 'PLEASURE', 'SAVING', 'OTHER'];
        const seen = new Set();
        typeOrder.forEach(t => {
            const label = ReportChartDataBuilder.EXPENSE_TYPE_LABELS[t];
            if (byType.has(label)) {
                labels.push(label);
                data.push(byType.get(label));
                seen.add(label);
            }
        });
        byType.forEach((val, label) => {
            if (!seen.has(label)) {
                labels.push(label);
                data.push(val);
            }
        });
        const colors = labels.map((_, i) =>
            ReportChartDataBuilder.EXPENSE_TYPE_COLORS[i % ReportChartDataBuilder.EXPENSE_TYPE_COLORS.length]);
        return { labels, data, colors };
    }

    /**
     * Données pour le graphique par catégorie (barres / courbe)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], data: number[], colors: string[] }}
     */
    static buildCategoryData(mergedData) {
        const byCat = new Map();
        const idByCat = new Map();
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const cat = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            byCat.set(cat, (byCat.get(cat) || 0) + Math.abs(row.amount));
            if (!idByCat.has(cat)) idByCat.set(cat, parentIdOf(row));
        });
        const entries = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const labels = entries.map(e => e[0]);
        const data = entries.map(e => e[1]);
        // Couleurs des catégories de Bankin (U20)
        const colors = labels.map((label, i) => categoryColor(idByCat.get(label), 0.85, i));
        return { labels, data, colors };
    }

    /**
     * Données pour l'évolution mensuelle (dépenses cumulées par catégorie par mois)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], datasets: Object[], colors: string[] }}
     */
    static buildEvolutionData(mergedData) {
        const byMonth = new Map();
        const idByCat = new Map();
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            // Mois de rattachement Bankin s'il est connu, sinon mois de la date
            const d = row.budgetMonth || (row.date ? String(row.date).slice(0, 7) : '');
            if (!d) return;
            const cat = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            if (!idByCat.has(cat)) idByCat.set(cat, parentIdOf(row));
            if (!byMonth.has(d)) byMonth.set(d, new Map());
            const catMap = byMonth.get(d);
            catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(row.amount));
        });
        const months = Array.from(byMonth.keys()).sort();
        const allCats = new Set();
        byMonth.forEach(catMap => catMap.forEach((_, cat) => allCats.add(cat)));
        const categories = Array.from(allCats);
        const colors = categories.map((cat, i) => categoryColor(idByCat.get(cat), 0.85, i));
        const monthLabels = months.map(monthLabel);
        const datasets = categories.map((cat, i) => ({
            label: cat,
            data: months.map(m => byMonth.get(m).get(cat) || 0),
            backgroundColor: colors[i],
            borderColor: colors[i].replace('0.85', '1'),
            borderWidth: 2,
            fill: true,
            tension: 0.3
        }));
        return { labels: monthLabels, datasets, colors };
    }

    /**
     * Données Sankey : flux Dépenses → catégories parentes → sous-catégories
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ data: Array<Object>, colorMap: Array<string> }}
     */
    static buildSankeyData(mergedData) {
        const byParent = new Map();
        const byParentChild = new Map();
        const idByParent = new Map();
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const parent = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            if (!idByParent.has(parent)) idByParent.set(parent, parentIdOf(row));
            const child = row.categoryName || parent;
            const abs = Math.abs(row.amount);
            byParent.set(parent, (byParent.get(parent) || 0) + abs);
            const key = parent + '|' + child;
            byParentChild.set(key, (byParentChild.get(key) || 0) + abs);
        });
        const sankeyData = [];
        const nodeIds = new Map();
        /** Catégorie parente de chaque nœud (pour sa couleur). */
        const parentOfNode = new Map();
        let idGen = 1;
        const getId = (name) => {
            if (!nodeIds.has(name)) nodeIds.set(name, idGen++);
            return nodeIds.get(name);
        };
        byParent.forEach((flow, parent) => {
            parentOfNode.set(parent, parent);
            sankeyData.push({ from: 'Dépenses', to: parent, flow: flow, id: getId(parent) });
        });
        byParentChild.forEach((flow, key) => {
            const [parent, child] = key.split('|');
            if (parent !== child) {
                parentOfNode.set(child, parent);
                sankeyData.push({ from: parent, to: child, flow: flow, id: getId(child) });
            }
        });
        const colorMap = [];
        const parents = Array.from(byParent.keys());
        nodeIds.forEach((id, name) => {
            const parent = parentOfNode.get(name);
            colorMap[id] = categoryColor(idByParent.get(parent), 0.9, parents.indexOf(parent));
        });
        return { data: sankeyData, colorMap };
    }

    /**
     * Données du donut « Répartition par catégorie » (même structure que catégories)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], data: number[], colors: string[] }}
     */
    static buildPolarData(mergedData) {
        return ReportChartDataBuilder.buildCategoryData(mergedData);
    }
}
