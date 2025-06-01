const evt = new Evt();

// Instantiate new services
const settingsService = new SettingsService();
const bankinDataProvider = new BankinData(settingsService); // BankinData now takes settingsService
const dataService = new DataService(settingsService, bankinDataProvider); // DataService takes both

let currentSettings = settingsService.getAllSettings(); // Updated way to get all settings
let currentUrl = location.href;

// TODO: Review if 'data_loaded' from BankinData is still the primary trigger for 'build',
// or if 'data_service_ready' from DataService should be used.
// For now, keeping 'data_loaded' as BankinData dispatches it after its own loading.
evt.listen('data_loaded', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during data_loaded event:", error);
    }
});

evt.listen("settings_reloaded", () => {
    currentSettings = settingsService.getAllSettings(); // Update currentSettings when settings are reloaded
});

evt.listen('data_service_ready', async () => { // Optional: Listen to data_service_ready if build depends on it
    console.log("Data Service is ready, potentially trigger build or updates here.");
    // If build() should only run once DataService has processed initial data from BankinData
    // then this is a good place to call build() or a part of it.
    // However, the original flow ties build() to 'data_loaded' from BankinData and 'url_change'.
    // For minimal changes to flow, we'll let build() be triggered by those,
    // and assume DataService is ready by then or ChartData classes will use DataService internally.
});

evt.listen('url_change', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during url_change event:", error);
    }
});

setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, 1000); // Consider using other methods to detect URL changes

async function build() {
    evt.dispatch('build called');

    // settingsService constructor already loads settings. Explicit call might be redundant unless forced refresh.
    // await settingsService.loadSettings();
    currentSettings = settingsService.getAllSettings(); // Ensure currentSettings is up-to-date

    if (location.href === "https://app2.bankin.com/accounts") {
        UIManager.loadingScreen(document.getElementsByClassName("rightColumn")[0]); // UIManager
        setTimeout(() => { new Hidder() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        refreshIcon.addEventListener("click", () => {
            let cacheObject = {
                ['cache_data_transactions']: "",
                ['cache_time_transactions']: ""
            };

            setTimeout(async () => {
                await settingsService.setSettings(cacheObject); // Use settingsService
                // new BankinData() // Old way; BankinData is now bankinDataProvider, already instantiated.
                                 // If refresh is needed, bankinDataProvider should have a public method like reloadData().
                                 // For now, setSettings will trigger cache update & BankinData might use new cache on next load.
                                 // To force immediate data refresh in BankinData:
                if (bankinDataProvider && typeof bankinDataProvider.reloadData === 'function') {
                    await bankinDataProvider.reloadData();
                }
            }, 1100);
        })

        // TODO: ChartData and ChartDataYearlyDonuts will be refactored later to use DataService.
        // For now, they still expect raw data and settings.
        // We fetch this data using settingsService (which gets it from cache).
        // const transactionsForChart = settingsService.getSetting('cache_data_transactions'); // Will be fetched by processor via DataService
        // const categoriesForChart = settingsService.getSetting('cache_data_categories'); // Will be fetched by processor via DataService
        // const accountsSelectedForChart = settingsService.getSetting('accountsSelected'); // Now obtained within UIManager methods or passed to factory

        // For /accounts page (Line/Bar chart and Donuts)
        const lineBarParams = { accountsSelected: settingsService.getSetting('accountsSelected') }; // accountsSelected still needed here for now
        const lineBarProcessor = ChartFactory.createProcessor('lineBar', dataService, lineBarParams);

        await UIManager.displayMainLineBarChart(lineBarProcessor, "homeBlock");
        await UIManager.displayYearlyDonutCharts(dataService, ChartFactory, "homeBlock"); // Pass ChartFactory

    } else if (location.href === "https://app2.bankin.com/categories") {
        const menu = document.querySelector("#monthSelector");
        if (menu) {
            menu.addEventListener("click", () => {
                evt.dispatch('url_change');
            }, { once: true });
        }

        const dateChoosedElem = document.querySelector("#monthSelector .active .dib");
        if (dateChoosedElem) {
            const dateChoosedParams = dateChoosedElem.textContent.toLocaleLowerCase().split(" ");

            const sankeyParams = { dateParams: dateChoosedParams };
            const sankeyProcessor = ChartFactory.createProcessor('sankey', dataService, sankeyParams);

            await UIManager.displaySankeyChart(sankeyProcessor, "categoryChart");
        }
    }
    // Hide loading screen once all processing for the current view is done
    UIManager.hideLoadingScreen();
}

// annotation and average functions have been moved to LineBarChartProcessor.js