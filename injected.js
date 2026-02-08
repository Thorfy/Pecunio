
const evt = new Evt();
const settingClass = new Settings();
const dataManager = new DataManager();

let setting = {};
let currentUrl = location.href;

// Demander l'ouverture de la popup dès le début (sans bloquer)
try {
    chrome.runtime.sendMessage({ action: 'openPopup' });
} catch (error) {
    console.warn("[InjectedJS] Impossible d'envoyer le message pour ouvrir la popup:", error);
}

// Charger les settings en arrière-plan (sans bloquer)
settingClass.waitForInitialization().then(() => {
    setting = settingClass.getAllSettings();
});

evt.listen('data_loaded', async () => {
    try {
        await build();
    } catch (error) {
        console.error("[InjectedJS] Error during data_loaded event:", error);
        // Afficher un message d'erreur à l'utilisateur si possible
        if (error.message && error.message.includes('Authentication')) {
            console.error("[InjectedJS] Authentication issue detected. Please refresh the page.");
        }
    }
});

evt.listen("settings_reloaded", async () => {
    await settingClass.waitForInitialization();
    setting = settingClass.getAllSettings();
});

evt.listen('url_change', async () => {
    try {
        await build();
    } catch (error) {
        console.error("[InjectedJS] Error during url_change event:", error);
    }
});

// Écouter les changements de type de chart
window.addEventListener('pecunio_chart_type_changed', async () => {
    // Attendre que les settings soient bien rechargés avant de reconstruire
    await settingClass.waitForInitialization();
    // loadSettings() est déjà appelé dans _initialize(), pas besoin de le refaire
    evt.dispatch('url_change');
});

setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, Config.INTERVALS.URL_CHECK);

/**
 * Fonction helper pour obtenir les données communes pour les charts
 * @returns {Object} Objet contenant transactions, categories, accountsSelected, settings
 */
function getCommonChartData() {
    return {
        transactions: settingClass.getSetting('cache_data_transactions'),
        categories: settingClass.getSetting('cache_data_categories'),
        accountsSelected: settingClass.getSetting('accountsSelected'),
        settings: setting,
        settingsInstance: settingClass
    };
}

async function build() {
    evt.dispatch('build called');

    // Attendre l'initialisation (qui inclut déjà loadSettings())
    await settingClass.waitForInitialization();
    // Mettre à jour la variable setting
    setting = settingClass.getAllSettings();
    // Sync global pour les charts (évite mutations chart.options = stack overflow)
    window.__pecunioIsBlurry = !!settingClass.getSetting(Config.STORAGE_KEYS.IS_BLURRY);

    if (location.href === Config.URLS.ACCOUNTS_PAGE) {
        await buildAccountsPage();
        setTimeout(() => { new AmountHider(); AmountHider.refreshBlur(); }, Config.INTERVALS.HIDDER_DELAY);
    } else if (location.href === Config.URLS.CATEGORIES_PAGE) {
        await buildCategoriesPage();
        setTimeout(() => { new AmountHider(); AmountHider.refreshBlur(); }, Config.INTERVALS.HIDDER_DELAY);
    }
}

/**
 * Construit la page des comptes avec les charts LineBarChart et BudgetChart
 */
async function buildAccountsPage() {
    loadingScreen();

    // Configuration du bouton de rafraîchissement
    LineBarChart.setupRefreshButton(dataManager, settingClass);

    const homeBlock = document.querySelector(LineBarChart.SELECTORS.HOME_BLOCK);
    if (!homeBlock) {
        console.error("[InjectedJS] homeBlock not found for account page charts.");
        return;
    }

    // Créer le conteneur principal
    const mainContainer = LineBarChart.createMainContainer(homeBlock);

    // Récupérer les données communes
    const commonData = getCommonChartData();

    // Créer et afficher le LineBarChart
    const lineBarChart = new LineBarChart(
        commonData.transactions,
        commonData.categories,
        commonData.accountsSelected,
        commonData.settings,
        commonData.settingsInstance
    );
    const lineBarChartContainer = lineBarChart.createContainer(mainContainer);
    await lineBarChart.render(lineBarChartContainer);

    // Créer et afficher le BudgetChart
    const budgetChartBlock = document.createElement('div');
    budgetChartBlock.id = "budgetChartBlock";
    budgetChartBlock.classList.add('pecunio-section');
    mainContainer.appendChild(budgetChartBlock);

    const budgetChart = new BudgetChart(
        commonData.transactions,
        commonData.categories,
        commonData.accountsSelected,
        commonData.settings,
        commonData.settingsInstance
    );
    budgetChart.createUI(budgetChartBlock.id);
}

/**
 * Construit la page des catégories avec les charts SankeyChart et ExpenseTypeChart
 */
async function buildCategoriesPage() {
    const menu = document.querySelector(Config.SELECTORS.MONTH_SELECTOR);
    if (menu) {
        menu.addEventListener("click", () => {
            // Laisser le temps au DOM (SPA) de mettre à jour .active sur le nouveau mois
            setTimeout(() => evt.dispatch('url_change'), 30);
        }, { once: true });
    }

    const dateChoosedElem = document.querySelector(Config.SELECTORS.MONTH_SELECTOR_ACTIVE);
    if (!dateChoosedElem) {
        return;
    }

    const dateChoosed = dateChoosedElem.textContent.toLocaleLowerCase();
    const dateParams = dateChoosed.split(" ");

    const categBlock = document.querySelector(Config.SELECTORS.CATEGORY_CHART);
    if (!categBlock) {
        return;
    }

    // Préparer le conteneur pour les charts
    const chartsRowContainer = ExpenseTypeChart.prepareContainer(categBlock);

    // Récupérer les données communes
    const commonData = getCommonChartData();

    // Créer et afficher le ExpenseTypeChart
    const expenseTypeChart = new ExpenseTypeChart(
        commonData.transactions,
        commonData.categories,
        dateParams,
        commonData.settingsInstance
    );
    await expenseTypeChart.render(chartsRowContainer);

    // Créer et afficher le SankeyChart
    const sankeyChart = new SankeyChart(
        commonData.transactions,
        commonData.categories,
        dateParams,
        commonData.settingsInstance
    );
    await sankeyChart.render(categBlock);
}

/**
 * Affiche l'écran de chargement
 */
function loadingScreen() {
    LoadingScreen.show();
}