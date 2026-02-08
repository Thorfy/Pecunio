/**
 * ReportStorage - Service de stockage des données du rapport PDF
 * Utilise chrome.storage.local et Config.REPORT.STORAGE_KEYS
 * Utilisé par la popup (écriture) et la page report.html (lecture)
 */
class ReportStorage {
    /**
     * Charge les données du rapport depuis le stockage
     * @returns {Promise<{mergedData: Array, stats: Object, params: Object}>}
     */
    static loadReportData() {
        const keys = typeof Config !== 'undefined' && Config.REPORT && Config.REPORT.STORAGE_KEYS
            ? Config.REPORT.STORAGE_KEYS
            : { MERGED: 'pecunio_report_mergedData', STATS: 'pecunio_report_stats', PARAMS: 'pecunio_report_params' };

        return new Promise((resolve, reject) => {
            chrome.storage.local.get([keys.MERGED, keys.STATS, keys.PARAMS], (data) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!data[keys.MERGED] || !Array.isArray(data[keys.MERGED])) {
                    reject(new Error('Aucune donnée de rapport. Générez le rapport depuis la popup Pecunio.'));
                    return;
                }
                resolve({
                    mergedData: data[keys.MERGED],
                    stats: data[keys.STATS] || {},
                    params: data[keys.PARAMS] || {}
                });
            });
        });
    }

    /**
     * Enregistre les données du rapport dans le stockage (utilisé par la popup)
     * @param {Array} mergedData - Données fusionnées
     * @param {Object} stats - Statistiques
     * @param {Object} params - Paramètres (startDate, endDate, accountNames, pdfYear, pdfMonthIndex, pdfMonthLabel, exceptionCategoryIds)
     * @returns {Promise<void>}
     */
    static saveReportData(mergedData, stats, params) {
        const keys = typeof Config !== 'undefined' && Config.REPORT && Config.REPORT.STORAGE_KEYS
            ? Config.REPORT.STORAGE_KEYS
            : { MERGED: 'pecunio_report_mergedData', STATS: 'pecunio_report_stats', PARAMS: 'pecunio_report_params' };

        return new Promise((resolve, reject) => {
            chrome.storage.local.set({
                [keys.MERGED]: mergedData,
                [keys.STATS]: stats,
                [keys.PARAMS]: params || {}
            }, () => (chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()));
        });
    }
}
