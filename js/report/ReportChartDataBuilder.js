/**
 * ReportChartDataBuilder - Construction des données pour les graphiques du rapport PDF
 * Prend des lignes fusionnées (mergedData) et produit les structures attendues par Chart.js
 */
class ReportChartDataBuilder {
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
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const cat = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            byCat.set(cat, (byCat.get(cat) || 0) + Math.abs(row.amount));
        });
        const entries = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const labels = entries.map(e => e[0]);
        const data = entries.map(e => e[1]);
        const hueStep = 260 / Math.max(labels.length, 1);
        const colors = labels.map((_, i) => `hsla(${220 + i * hueStep}, 65%, 55%, 0.85)`);
        return { labels, data, colors };
    }

    /**
     * Données pour l'évolution mensuelle (dépenses cumulées par catégorie par mois)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], datasets: Object[], colors: string[] }}
     */
    static buildEvolutionData(mergedData) {
        const byMonth = new Map();
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const d = row.date ? String(row.date).slice(0, 7) : '';
            if (!d) return;
            const cat = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            if (!byMonth.has(d)) byMonth.set(d, new Map());
            const catMap = byMonth.get(d);
            catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(row.amount));
        });
        const months = Array.from(byMonth.keys()).sort();
        const allCats = new Set();
        byMonth.forEach(catMap => catMap.forEach((_, cat) => allCats.add(cat)));
        const categories = Array.from(allCats);
        const hueStep = 260 / Math.max(categories.length, 1);
        const colors = categories.map((_, i) => `hsla(${220 + i * hueStep}, 65%, 55%, 0.85)`);
        const monthLabels = months.map(m => {
            const [, mo] = m.split('-');
            const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
            return names[parseInt(mo, 10) - 1] + ' ' + m.slice(0, 4);
        });
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
        mergedData.forEach(row => {
            if (row.amount >= 0) return;
            const parent = row.parentCategoryName || row.categoryName || 'Non catégorisé';
            const child = row.categoryName || parent;
            const abs = Math.abs(row.amount);
            byParent.set(parent, (byParent.get(parent) || 0) + abs);
            const key = parent + '|' + child;
            byParentChild.set(key, (byParentChild.get(key) || 0) + abs);
        });
        const sankeyData = [];
        const nodeIds = new Map();
        let idGen = 1;
        const getId = (name) => {
            if (!nodeIds.has(name)) nodeIds.set(name, idGen++);
            return nodeIds.get(name);
        };
        byParent.forEach((flow, parent) => {
            sankeyData.push({ from: 'Dépenses', to: parent, flow: flow, id: getId(parent) });
        });
        byParentChild.forEach((flow, key) => {
            const [parent, child] = key.split('|');
            if (parent !== child) {
                sankeyData.push({ from: parent, to: child, flow: flow, id: getId(child) });
            }
        });
        const colorMap = [];
        const hueStep = 360 / Math.max(nodeIds.size, 1);
        nodeIds.forEach((id) => {
            colorMap[id] = `hsla(${(id * hueStep) % 360}, 65%, 55%, 0.9)`;
        });
        return { data: sankeyData, colorMap };
    }

    /**
     * Données pour le graphique polar (même structure que catégories)
     * @param {Array<Object>} mergedData - Données filtrées
     * @returns {{ labels: string[], data: number[], colors: string[] }}
     */
    static buildPolarData(mergedData) {
        return ReportChartDataBuilder.buildCategoryData(mergedData);
    }
}
