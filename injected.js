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
        loadingScreen();
        setTimeout(() => { new Hidder() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        refreshIcon.addEventListener("click", () => {
            let cacheObject = {
                ['cache_data_transactions']: "",
                ['cache_time_transactions']: ""
            };

            setTimeout(async () => {
                await settingClass.setSettings(cacheObject);
                new BankinData()
            }, 1100);
        })



        const chartData = new ChartData(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), settingClass.getSetting('accountsSelected'), setting);
        const preparedData = await chartData.prepareData();
        await chartData.buildChart(preparedData);
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
                //categBlock[0].innerHTML = "";
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

        childBlock[0].innerHTML = "";
        childBlock[0].appendChild(imgdiv);
    }
    evt.dispatch('loading_sreen_display');
}

function createCanvasElement(parentElement) {
    const canvasDiv = document.createElement('canvas');
    canvasDiv.classList = "canvasDiv";

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