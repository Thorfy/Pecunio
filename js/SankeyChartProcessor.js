// Assuming AbstractChartProcessor.js, UIManager.js are available

class SankeyChartProcessor extends AbstractChartProcessor {
    constructor(dataService, chartSpecificParams = {}) {
        // chartSpecificParams = { dateParams: ['monthName', 'yearString'] }
        super(dataService, chartSpecificParams);
        this.exceptionCat = [326, 282]; // From original ChartData2
    }

    /**
     * Prepares data for the Sankey chart.
     * Filters transactions for a specific month/year and structures them hierarchically.
     * @returns {Promise<Array>} An array of objects, where each object represents a parent category
     *                          and contains its transactions and child category data.
     *                          Example: [{ id, name, transactions, child: [{id, name, transactions}] }]
     */
    async prepareData() {
        const allTransactions = this.dataService.getAllTransactions(true); // Get transactions with 'groupingDate'
        const allCategories = this.dataService.getAllCategories(); // Full list of categories

        if (!this.chartSpecificParams.dateParams || this.chartSpecificParams.dateParams.length !== 2) {
            console.error("SankeyChartProcessor: dateParams are required as [monthName, yearString]");
            return [];
        }

        const [targetMonthName, targetYearStr] = this.chartSpecificParams.dateParams;
        const targetYear = parseInt(targetYearStr);

        // Filter transactions by month and year (logic from old applySettingOnData)
        const filteredTransactions = allTransactions.filter(transaction => {
            const transactionDate = transaction.groupingDate ? new Date(transaction.groupingDate) : new Date(transaction.effectiveDate);
            // Ensure groupingDate is used if available, as it's set to 1st of month
            const monthName = transactionDate.toLocaleString('default', { month: 'long' }).toLowerCase();
            const year = transactionDate.getUTCFullYear();
            return monthName === targetMonthName.toLowerCase() && year === targetYear;
        });

        if (filteredTransactions.length === 0) {
            return [];
        }

        // Merge transactions by category (logic from old mergeTransactionByCategory)
        // This created a Map: categoryId -> array of transactions
        // It also included child category transactions under their parent.
        const transactionsByCategoryMap = new Map();
        allCategories.forEach(category => { // Initialize map keys for all categories
            transactionsByCategoryMap.set(category.id, []);
        });

        filteredTransactions.forEach(transaction => {
            const categoryId = transaction.category.id;
            if (!this.exceptionCat.includes(categoryId)) {
                // Add to direct category
                if (transactionsByCategoryMap.has(categoryId)) {
                    transactionsByCategoryMap.get(categoryId).push(transaction);
                }

                // If it's a child category, also add to parent's list
                const parentCategory = this.dataService.getParentCategory(categoryId);
                if (parentCategory && parentCategory.id !== categoryId) { // Ensure it's a child and parent is different
                     if (transactionsByCategoryMap.has(parentCategory.id)) {
                        transactionsByCategoryMap.get(parentCategory.id).push(transaction);
                    }
                }
            }
        });

        // Format data hierarchically (logic from old getDataFormated)
        const hierarchicalData = [];
        const parentCategories = allCategories.filter(c => !c.parent_id);

        parentCategories.forEach(parentCategory => {
            const parentTransactions = transactionsByCategoryMap.get(parentCategory.id) || [];
            let childData = [];

            const childCategoryObjects = allCategories.filter(c => c.parent_id === parentCategory.id);
            childCategoryObjects.forEach(childCatObj => {
                childData.push({
                    "id": childCatObj.id,
                    "name": childCatObj.name,
                    "transactions": transactionsByCategoryMap.get(childCatObj.id) || []
                });
            });

            hierarchicalData.push({
                "id": parentCategory.id,
                "name": parentCategory.name,
                "transactions": parentTransactions, // All transactions for this parent (incl. children's)
                "child": childData
            });
        });

        return hierarchicalData; // This is the intermediate, structured data
    }

    /**
     * Gets the Chart.js configuration for a Sankey chart.
     * @param {Array} processedData - Hierarchical data from prepareData().
     * @returns {Object} The Chart.js Sankey configuration object.
     */
    getChartConfig(processedData) {
        // Convert hierarchical data to Sankey format (logic from old convertDataToSankeyFormat)
        const sankeyFlows = this._convertDataToSankeyFormat(processedData);

        return {
            type: 'sankey', // Chart.js Sankey controller type
            data: {
                datasets: [{
                    label: 'Data Flow', // Or a more dynamic label
                    data: sankeyFlows,
                    // Color settings for Sankey (can be customized further)
                    colorFrom: (c) => UIManager.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                    colorTo: (c) => UIManager.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                    colorMode: 'gradient', // Or 'from', 'to', etc.
                    size: 'max', // For node size calculation
                }]
            },
            options: {
                responsive: true,
                // Sankey specific options can be added here if needed
                // e.g., layout, node styles, link styles
                // title: { display: true, text: `Data Flow for ${this.chartSpecificParams.dateParams.join(' ')}` }
            }
        };
    }

    // Private helper, adapted from old convertDataToSankeyFormat
    _convertDataToSankeyFormat(hierarchicalData, exceptionalCategories = [2]) { // exceptionalCategories might come from settings/params
        const sankeyData = [];
        let totalExpense = 0;
        let totalBudget = 0;

        hierarchicalData.forEach(parentNode => {
            if (parentNode.child && parentNode.child.length > 0) {
                parentNode.child.forEach(childNode => {
                    const totalAmount = (childNode.transactions || []).reduce((sum, transaction) => {
                        return sum + Math.abs(transaction.amount);
                    }, 0);

                    if (totalAmount > 0) {
                        if (exceptionalCategories.includes(parentNode.id)) {
                            totalBudget += totalAmount;
                            sankeyData.push({ from: childNode.name, to: "Budget", flow: totalAmount, id: parentNode.id });
                        } else {
                            sankeyData.push({ from: parentNode.name, to: childNode.name, flow: totalAmount, id: parentNode.id });
                        }
                    }
                });
            } else { // Node is a parent but has no children listed in 'child', or its transactions are direct
                 const totalParentAmount = (parentNode.transactions || []).reduce((sum, transaction) => {
                    // This sum needs care: if parentNode.transactions includes child transactions, avoid double counting.
                    // The old ChartData2's mergeTransactionByCategory put child transactions in BOTH child and parent arrays.
                    // If we only want to show flow from parent to child, this direct sum might be an issue.
                    // For Sankey, typically flow is from broader to narrower, or sequential.
                    // Let's assume for now that if a parent has children, its "direct" expenses are separate.
                    // Or, if parentNode.transactions is ONLY its direct transactions (not children's), then this is fine.
                    // The current prepareData puts ALL transactions (parent + child) in parentNode.transactions.
                    // This part of Sankey conversion might need refinement based on desired flow representation.
                    // A simpler model: "Depenses" -> ParentCategory -> ChildCategory.
                    // The current model seems to be: "Depenses" -> ParentCategory, and ParentCategory -> ChildCategory.
                    // If ParentCategory has direct expenses not attributed to a child, that's another flow.
                    // The original code only created flows for Parent->Child if child existed,
                    // and "Depenses"->Parent if parent was not exceptional.
                    return sum + Math.abs(transaction.amount);
                }, 0);

                // This logic needs to be clearer. If parentNode.child is empty, what does parentNode.transactions represent?
                // Assuming these are direct expenses to the parent category IF it has no children.
                if (!exceptionalCategories.includes(parentNode.id) && totalParentAmount > 0 && (!parentNode.child || parentNode.child.length === 0)) {
                     // This condition might be too restrictive or needs adjustment based on data model.
                     // For now, let's simplify: if a node has children, flows are parent -> child.
                     // If a node has no children, it's an endpoint from "Depenses".
                }
            }

            // This part is for flows from "Depenses" to parent categories (that are not budget sources)
            const totalParentDirectAndChildExpenses = (parentNode.transactions || []).reduce((sum, transaction) => {
                return sum + Math.abs(transaction.amount);
            }, 0);

            if (!exceptionalCategories.includes(parentNode.id) && totalParentDirectAndChildExpenses > 0) {
                totalExpense += totalParentDirectAndChildExpenses; // This sum might be an overcount if children also flow from parent.
                                                              // The original logic was: totalExpense += totalAmount (where totalAmount was from node.transactions, not children)
                                                              // This needs careful review of how Sankey should represent hierarchical expenses.
                                                              // Let's assume `totalExpense` should be sum of distinct expenses.
                                                              // The current `totalParentDirectAndChildExpenses` sums all transactions linked to parent (direct + children).
                                                              // If Parent->Child flows are already made, "Depenses" should flow to Parent only for Parent's *direct* expenses.
                                                              // Or, "Depenses" flows to Parent for total, and Parent flows to Children. This is simpler.
                                                              // Sticking to a simpler interpretation:
                sankeyData.push({ from: "Dépenses", to: parentNode.name, flow: totalParentDirectAndChildExpenses, id: parentNode.id });

            }


        });

        // Recalculate totalExpense based on flows to non-budget parent categories from "Dépenses"
        totalExpense = sankeyData
            .filter(d => d.from === "Dépenses" && !exceptionalCategories.includes(d.id)) // d.id here is parentNode.id
            .reduce((sum, d) => sum + d.flow, 0);


        if (totalBudget > 0) { // Only add Budget related nodes if there's a budget
            if (totalBudget > totalExpense) {
                sankeyData.push({ from: "Budget", to: "Restant", flow: totalBudget - totalExpense, id: exceptionalCategories[0] || 'budget_restant' });
            }
            // Always create the flow from Budget to Depenses if there are expenses and budget items
            if (totalExpense > 0) {
                 sankeyData.push({ from: "Budget", to: "Dépenses", flow: Math.min(totalExpense, totalBudget), id: exceptionalCategories[0] || 'budget_depenses' });
            }
        } else { // No budget, all expenses come from a generic source like "Revenus" or just "Source"
            // This case was not explicitly handled in the original, which always assumed a "Budget" node.
            // If no budget, perhaps "Depenses" node becomes the main source, or we introduce "Revenus".
            // For now, if no totalBudget, the Budget related flows won't be added.
        }

        return sankeyData;
    }
}
