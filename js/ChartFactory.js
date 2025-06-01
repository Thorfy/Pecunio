// js/ChartFactory.js

// Assuming processor classes are available globally or will be imported if using modules.
// For current structure, they are expected to be global:
// LineBarChartProcessor, SankeyChartProcessor, DonutChartProcessor

class ChartFactory {
    /**
     * Creates and returns a chart processor instance based on the specified chart type.
     * @param {string} chartType - The type of chart processor to create (e.g., 'lineBar', 'sankey', 'donut').
     * @param {DataService} dataService - The instance of DataService to be used by the processor.
     * @param {Object} chartSpecificParams - Specific parameters required by the chart processor.
     * @returns {AbstractChartProcessor} An instance of the requested chart processor.
     * @throws {Error} If the chartType is unknown.
     */
    static createProcessor(chartType, dataService, chartSpecificParams = {}) {
        if (!dataService) {
            throw new Error("ChartFactory: DataService instance is required to create a processor.");
        }

        switch (chartType) {
            case 'lineBar':
                if (typeof LineBarChartProcessor === 'undefined') {
                    throw new Error("ChartFactory: LineBarChartProcessor class is not defined.");
                }
                return new LineBarChartProcessor(dataService, chartSpecificParams);
            case 'sankey':
                if (typeof SankeyChartProcessor === 'undefined') {
                    throw new Error("ChartFactory: SankeyChartProcessor class is not defined.");
                }
                return new SankeyChartProcessor(dataService, chartSpecificParams);
            case 'donut':
                if (typeof DonutChartProcessor === 'undefined') {
                    throw new Error("ChartFactory: DonutChartProcessor class is not defined.");
                }
                return new DonutChartProcessor(dataService, chartSpecificParams);
            default:
                throw new Error(`ChartFactory: Unknown chart type requested: ${chartType}`);
        }
    }
}
