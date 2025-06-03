
const evt = new Evt();
const settingClass = new Settings();
const dataClass = new BankinData();

let setting = settingClass.getAllSetting();
let currentUrl = location.href;

evt.listen('data_loaded', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during data_loaded event:", error);
    }
});

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
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

    await settingClass.loadSettings();

    if (location.href === "https://app2.bankin.com/accounts") {
        loadingScreen(); // This might clear the space needed for the new chart if not handled
        setTimeout(() => { new Hidder() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        if (refreshIcon) {
            refreshIcon.addEventListener("click", () => {
                let cacheObject = {
                    ['cache_data_transactions']: "",
                    ['cache_time_transactions']: ""
                };
                setTimeout(async () => {
                    await settingClass.setSettings(cacheObject);
                    new BankinData(); // This reloads data, might need to reload budget chart too
                }, 1100);
            });
        }

        const chartData = new ChartData(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), settingClass.getSetting('accountsSelected'), setting);
        const preparedData = await chartData.prepareData();
        
        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            var style = document.createElement('style');
            style.innerHTML = `
                .homeBlock > div {
                    max-width: none !important;
                }
            `;
            document.head.appendChild(style);
            homeBlock.innerHTML = ""; // Clear existing content

            const originalChartContainer = document.createElement('div');
            originalChartContainer.id = "originalChartContainer";
            homeBlock.appendChild(originalChartContainer);
            const canvasOriginal = createCanvasElement(originalChartContainer);
            const chartJsConfig = await chartData.getChartJsConfig();
            chartJsConfig.data = preparedData;
            new Chart(canvasOriginal.getContext('2d'), chartJsConfig);


            // Container for the new budget chart
            const budgetChartBlock = document.createElement('div');
            budgetChartBlock.id = "budgetChartBlock";
            budgetChartBlock.style.marginTop = "20px";
            budgetChartBlock.style.height = "500px";
            budgetChartBlock.style.width = '100%';
            budgetChartBlock.style.display = 'block';
            homeBlock.appendChild(budgetChartBlock);

            const rawTransactionsForBudget = settingClass.getSetting('cache_data_transactions');
            const categoriesForBudget = settingClass.getSetting('cache_data_categories');
            const accountsSelectedForBudget = settingClass.getSetting('accountsSelected');

            const budgetChartDataInstance = new ChartDataBudget(
                rawTransactionsForBudget,
                categoriesForBudget,
                accountsSelectedForBudget,
                setting // Assuming 'setting' is still relevant for ChartDataBudget constructor
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
            const chartData2 = new ChartData2(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), dateChoosed.split(" "));
            const preparedData = await chartData2.prepareData();

            let categBlock = document.getElementsByClassName("categoryChart");
            if (categBlock && categBlock[0]) {
                let canvasDiv = document.getElementsByClassName("canvasDiv")
                if (canvasDiv && canvasDiv.length > 0) {
                    for (let item of canvasDiv) {
                        item.remove()
                    }
                }
                canvasDiv = createCanvasElement(categBlock[0]);
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
                            colorFrom: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorTo: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorMode: '',
                        }]
                    },
                    options: {
                        responsive: true,
                    }
                });
            }
        }
    }
}

function loadingScreen() {
    const rightBlock = document.getElementsByClassName("rightColumn");
    if (rightBlock && rightBlock[0]) {
        const childBlock = rightBlock[0].children;

        const imgdiv = document.createElement('img');
        imgdiv.src = chrome.runtime.getURL("asset/Loading.gif");
        imgdiv.style.textAlign = "center";

        if (childBlock && childBlock[0]) { // Check if childBlock[0] exists
            childBlock[0].innerHTML = "";
            childBlock[0].appendChild(imgdiv);
        } else {
            console.error("childBlock[0] not found in loadingScreen");
        }
    }
    evt.dispatch('loading_sreen_display');
}

function createCanvasElement(parentElement) {
    const canvasDiv = document.createElement('canvas');
    canvasDiv.classList = "canvasDiv"; // Keep class if it has other relevant styles
    canvasDiv.style.width = '100%';
    canvasDiv.style.height = '400px';
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

function parseColorCSS(strClass) {
    const styleElement = document.createElement("div");
    styleElement.className = strClass;
    document.body.appendChild(styleElement);

    const colorVal = window.getComputedStyle(styleElement).backgroundColor;
    styleElement.remove();

    return colorVal;
}