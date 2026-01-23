
const evt = new Evt();
const settingClass = new Settings();
const dataManager = new DataManager();

let setting = {};
let currentUrl = location.href;

// Attendre l'initialisation des settings avant d'y accéder
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

setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, 1000); // Consider using other methods to detect URL changes

async function build() {
    evt.dispatch('build called');

    // Attendre l'initialisation complète des settings
    await settingClass.waitForInitialization();
    await settingClass.loadSettings();

    if (location.href === "https://app2.bankin.com/accounts") {
        loadingScreen(); // This might clear the space needed for the new chart if not handled
        setTimeout(() => { new AmountHider() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        if (refreshIcon) {
            refreshIcon.addEventListener("click", async () => {
                try {
                    let cacheObject = {
                        ['cache_data_transactions']: "",
                        ['cache_time_transactions']: ""
                    };
                    setTimeout(async () => {
                        try {
                            await settingClass.setSettings(cacheObject);
                            // refreshData() attend maintenant automatiquement l'authentification
                            await dataManager.refreshData(); // Reload data and trigger data_loaded event
                        } catch (error) {
                            console.error("[InjectedJS] Error refreshing data:", error);
                            if (error.message && error.message.includes('Authentication')) {
                                console.error("[InjectedJS] Authentication not ready. Please wait a moment and try again.");
                            }
                        }
                    }, 1100);
                } catch (error) {
                    console.error("[InjectedJS] Error setting up refresh:", error);
                }
            });
        }

        const chartData = new LineBarChart(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), settingClass.getSetting('accountsSelected'), setting, settingClass);
        const preparedData = await chartData.prepareData();
        
        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            // Injecter les styles Pecunio
            InjectedStyles.inject();
            
            var style = document.createElement('style');
            style.innerHTML = `
                .homeBlock > div {
                    max-width: none !important;
                }
            `;
            document.head.appendChild(style);
            homeBlock.innerHTML = ""; // Clear existing content

            // Container principal avec style Pecunio
            const mainContainer = document.createElement('div');
            InjectedStyles.applyContainerClasses(mainContainer);
            homeBlock.appendChild(mainContainer);

            const originalChartContainer = document.createElement('div');
            originalChartContainer.id = "originalChartContainer";
            originalChartContainer.classList.add('pecunio-section');
            mainContainer.appendChild(originalChartContainer);
            
            const canvasOriginal = createCanvasElement(originalChartContainer);
            const chartJsConfig = await chartData.getChartJsConfig();
            chartJsConfig.data = preparedData;
            new Chart(canvasOriginal.getContext('2d'), chartJsConfig);

            // Container for the new budget chart
            const budgetChartBlock = document.createElement('div');
            budgetChartBlock.id = "budgetChartBlock";
            budgetChartBlock.classList.add('pecunio-section');
            mainContainer.appendChild(budgetChartBlock);

            const rawTransactionsForBudget = settingClass.getSetting('cache_data_transactions');
            const categoriesForBudget = settingClass.getSetting('cache_data_categories');
            const accountsSelectedForBudget = settingClass.getSetting('accountsSelected');

            const budgetChartDataInstance = new BudgetChart(
                rawTransactionsForBudget,
                categoriesForBudget,
                accountsSelectedForBudget,
                setting,
                settingClass
            );
            budgetChartDataInstance.createUI(budgetChartBlock.id);

        } else {
            console.error("[InjectedJS] homeBlock not found for account page charts.");
        }

    } else if (location.href === "https://app2.bankin.com/categories") {
        const menu = document.querySelector("#monthSelector");
        if (menu) {
            menu.addEventListener("click", () => {
                evt.dispatch('url_change');
            }, { once: true });
        }

        const dateChoosedElem = document.querySelector("#monthSelector .active .dib");
        if (dateChoosedElem) {
            const dateChoosed = dateChoosedElem.textContent.toLocaleLowerCase();
            const chartData2 = new SankeyChart(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), dateChoosed.split(" "), settingClass);
            const preparedData = await chartData2.prepareData();

            let categBlock = document.getElementsByClassName("categoryChart");
            if (categBlock && categBlock[0]) {
                // Nettoyer les anciens canvas
                let canvasDiv = document.getElementsByClassName("canvasDiv")
                if (canvasDiv && canvasDiv.length > 0) {
                    for (let item of canvasDiv) {
                        item.remove()
                    }
                }
                
                // Créer un canvas spécifique pour le Sankey chart
                canvasDiv = document.createElement('canvas');
                canvasDiv.classList.add("canvasDiv");
                canvasDiv.style.width = '100%';
                canvasDiv.style.height = '400px'; // Hauteur fixe pour éviter la distorsion
                canvasDiv.style.maxWidth = '100%';
                canvasDiv.style.display = 'block';
                
                if (categBlock[0]) {
                    categBlock[0].appendChild(canvasDiv);
                }
                
                // Supprimer les classes qui peuvent causer des problèmes d'affichage
                setTimeout(() => {
                    let h100 = document.querySelectorAll(".cntr.dtb.h100.active, .cntr.dtb.h100.notActive")
                    for (let item of h100) {
                        item.classList.remove("h100");
                    }
                }, 1000);

                const ctx = canvasDiv.getContext('2d');
                const myChart = new Chart(ctx, {
                    type: 'sankey',
                    data: {
                        datasets: [{
                            label: 'My Dataset',
                            data: preparedData,
                            colorFrom: (c) => ColorParser.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorTo: (c) => ColorParser.parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorMode: '',
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, // Important pour éviter la distorsion
                        layout: {
                            padding: {
                                top: 20,
                                bottom: 20,
                                left: 20,
                                right: 20
                            }
                        }
                    }
                });
            }
        }
    }
}

function loadingScreen() {
    LoadingScreen.show();
}

function createCanvasElement(parentElement) {
    const canvasDiv = InjectedStyles.createCanvas();
    canvasDiv.classList.add("canvasDiv"); // Keep class if it has other relevant styles
    if (parentElement) {
        parentElement.appendChild(canvasDiv);
    }

    return canvasDiv;
}

const annotation = {
    type: 'line',
    borderColor: 'black',
    borderDash: [6, 6],
    borderDashOffset: 0,
    borderWidth: 3,
    label: {
        enabled: true,
        content: (ctx) => 'Average: ' + average(ctx).toFixed(2),
        position: 'end'
    },
    scaleID: 'y',
    value: (ctx) => average(ctx)
};

function average(ctx) {
    const values = ctx.chart.data.datasets[0].data;
    return values.reduce((a, b) => a + b, 0) / values.length;
};

// parseColorCSS est maintenant géré directement par ColorParser.parseColorCSS()