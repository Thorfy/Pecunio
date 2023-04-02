const evt = new Evt();
const settingClass = new Settings();
const dataClass = new BankinData();

let setting;
let loadDataVal;
let currentUrl = location.href;

evt.listen('data_loaded', async () => {
    await build(loadDataVal);
});

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
});

evt.listen('url_change', async () => {
    console.log('test');
    await build(loadDataVal);
});

setInterval(() => {
    if (location.href != currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, 1000);

async function build(data) {
    evt.dispatch('build called');
    await settingClass.loadSettings();
    if (location.href === "https://app2.bankin.com/accounts") {
        loadingScreen();
        setTimeout(() => { new Hidder() }, 500);
        const chartData = new ChartData(data.transaction, data.category, setting);
        const preparedData = await chartData.prepareData();
        await buildChart(preparedData);
    }
}

function loadingScreen() {
    let rightBlock = document.getElementsByClassName("rightColumn")
    let childBlock = rightBlock[0].children

    let imgdiv = document.createElement('img')
    imgdiv.src = chrome.runtime.getURL("asset/Loading.gif")
    imgdiv.style = "text-align: center;"

    childBlock[0].innerHTML = ""
    childBlock[0].appendChild(imgdiv)
}

async function buildChart(formattedData) {
    let chartJsConfig = await getChartJsConfig();
    chartJsConfig.data = formattedData;
    const canvasDiv = createCanvasElement();
    const ctx = canvasDiv.getContext('2d');
    const myChart = new Chart(ctx, chartJsConfig);
}

function createCanvasElement() {
    let homeBlock = document.getElementsByClassName("homeBlock");
    let canvasDiv = document.createElement('canvas');
    if (homeBlock.length != 0) {
        homeBlock[0].innerHTML = "";
        homeBlock[0].appendChild(canvasDiv);
    }
    return canvasDiv;
}

async function getChartJsConfig() {
    let settings = await chrome.storage.local.get(['startDate', 'endDate'])

    const chartJsConfig = {
        type: 'line',
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Depense sur " + monthDiff(settings.startDate, settings.endDate) + " mois"
                },
                legend: {
                    onClick: async function (evt, item) {
                        let currentVal = await chrome.storage.local.get([item.text])
                        await chrome.storage.local.set({ [item.text]: !currentVal[item.text] })
                        // callback original event 
                        Chart.defaults.plugins.legend.onClick.call(this, evt, item, this);
                    },
                }
            },
            interaction: {
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',

                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                    display: true,
                    title: {
                        color: "#92cbdf",
                        display: false
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                }
            }
        },
    }
    return chartJsConfig;
}
//trick for get real color of category
function parseColorCSS(strClass) {
    let styleElement = document.createElement("div");
    styleElement.className = strClass;
    document.body.appendChild(styleElement)
    let colorVal = window.getComputedStyle(styleElement).backgroundColor;
    styleElement.remove();
    return colorVal;
}

function monthDiff(dateFrom, dateTo) {
    dateFrom = new Date(dateFrom)
    dateTo = new Date(dateTo)
    return dateTo.getMonth() - dateFrom.getMonth() + (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
}
