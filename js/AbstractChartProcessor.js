// js/AbstractChartProcessor.js

class AbstractChartProcessor {
    constructor(dataService, chartSpecificParams = {}) {
        if (this.constructor === AbstractChartProcessor) {
            throw new Error("Abstract classes can't be instantiated directly.");
        }
        if (!dataService) {
            throw new Error("DataService instance is required.");
        }
        this.dataService = dataService;
        this.chartSpecificParams = chartSpecificParams;
        this.settingsService = dataService.settingsService; // Convenience access to settings
    }

    /**
     * Asynchronously prepares data for the chart.
     * This method should be overridden by subclasses.
     * It should fetch data via this.dataService, apply specific filters,
     * and transform it into a simple intermediate format.
     * @returns {Promise<Object>} A promise that resolves with the processed data.
     */
    async prepareData() {
        throw new Error("Method 'prepareData()' must be implemented by subclasses.");
    }

    /**
     * Gets the Chart.js configuration object.
     * This method should be overridden by subclasses.
     * It takes the processed data from prepareData() and returns the
     * complete Chart.js config object.
     * @param {Object} processedData - Data prepared by the prepareData() method.
     * @returns {Object} The Chart.js configuration object.
     */
    getChartConfig(processedData) {
        throw new Error("Method 'getChartConfig(processedData)' must be implemented by subclasses.");
    }
}
