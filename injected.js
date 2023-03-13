const requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
const domain = "https://sync.bankin.com";
const urlTransactions = "/v2/transactions?limit=500";
const urlCategory = "/v2/categories?limit=200";

let port = chrome.runtime.connect();
let authHeader = new Promise((resolve, reject) => {
    port.onMessage.addListener(message => {

        if (Object.keys(message.data).length === 0)
            return false
        for (const property in message.data) {
            if (!requiredHeader.includes(property))
                return false;
        }
        resolve(message.data);
    });
});
chrome.storage.local.set({ 'accounts': "undefined" });

let dataClass = new BankinData()
let loadDataVal = dataClass.getData()

setTimeout(async () => { 
    build();

    // store url on load
    let currentPage = location.href;
    
    // listen for url changes
    setInterval(function () {
        if (currentPage != location.href) {
            // page has changed, set new page as 'current'
            currentPage = location.href;
            build();
        }
    }, 100);
}, 500);



function build() {

    //routing 
    if (location.href === "https://app2.bankin.com/accounts") {

        setTimeout(() => {  new Hidder() }, 500);
        
        loadingScreen();
        loadSettings();
        loadDataVal.then(async (res) => {
                transac = await applySettingOnData(res.transaction)
                chrome.storage.local.set({ 'transac': res.transaction });
                chrome.storage.local.set({ 'categ': res.category });

                await buildChart(transac,  res.category);
        })
    }
}

function loadingScreen() {
    let homeBlock = document.getElementsByClassName("homeBlock")
    let imgdiv = document.createElement('img')
    imgdiv.src = chrome.runtime.getURL("asset/Loading.gif")
    imgdiv.style = "text-align: center;"
    homeBlock[0].innerHTML = ""
    homeBlock[0].appendChild(imgdiv)
}

function loadSettings() {
    return new Promise(async (resolve, reject) => {
        let list = []
        let htmlElements = await document.querySelectorAll('.accountRow')
        htmlElements.forEach((x) => {
            const href = x.href.split("/")
            list.push(href[4])
        })
        chrome.storage.local.set({ 'accountsList': list });
    })
}


function applySettingOnData(transactions) {
    return new Promise(async (resolve, reject) => {
        let settings = await chrome.storage.local.get(['startDate', 'endDate', 'accounts'])

        let startDate = Date.parse(settings.startDate)
        let endDate = Date.parse(settings.endDate)
        let accounts = settings.accounts

        let returned = []
        for (const transaction of transactions) {
            if (
                (!(startDate && endDate) || (Date.parse(transaction.date) >= startDate && Date.parse(transaction.date) <= endDate)) &&
                (accounts == "undefined" || (accounts.includes(transaction.account.id)))
            ) {
                returned.push(transaction)
            }
        }
        resolve(returned)
    })
}

async function buildChart(allTransactions, allCategory) {

    let transactionByCategory = false;
    if (allCategory.length && allTransactions.length) {
        transactionByCategory = mergeTransactionByCategory(allTransactions, allCategory);


        //select category DIV
        let homeBlock = document.getElementsByClassName("homeBlock")
        let canvasDiv = document.createElement('canvas');
        if (homeBlock.length != 0) {
            homeBlock[0].innerHTML = "";
            homeBlock[0].appendChild(canvasDiv);
        }
        let chartJsConfig = await getChartJsConfig();
        chartJsConfig.data = await getDataFormated(allCategory, transactionByCategory, true);
        const ctx = canvasDiv.getContext('2d');
        const myChart = new Chart(ctx, chartJsConfig);
    }
}

function mergeTransactionByCategory(allTransactions, allCategory) {
    preparedData = [];
    exceptionCat = [326, 282]
    allTransactions.forEach(transaction => {
        allCategory.forEach(category => {
            if (!preparedData[category.id])
                preparedData[category.id] = [];

            if (transaction.category.id === category.id && !exceptionCat.includes(transaction.category.id)) {
                preparedData[category.id].push(transaction);
            } else {
                category.categories.forEach(childCategory => {
                    if (transaction.category.id === childCategory.id && !exceptionCat.includes(transaction.category.id)) {
                        preparedData[category.id].push(transaction);
                    }
                })
            }
        })

    })
    return preparedData;
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
                    onClick : async function (evt, item) {
                        let currentVal = await chrome.storage.local.get([item.text])
                        await chrome.storage.local.set({[item.text]: !currentVal[item.text] })
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

async function getDataFormated(categoryData, transactionByCategory, isCumulative = false ) {

    let data = {
        datasets: []
    }
    let settingsList = []
    await categoryData.forEach(category => {
        settingsList.push(category.name)
    })
    let settings =  await chrome.storage.local.get(settingsList)
    console.log(settings)

    categoryData.forEach(category => {

        let transactions = transactionByCategory[parseInt(category.id)];
        let dateValueObject = [];
        let transactionObject = {};
        transactions.forEach(transaction => {

            // insert control of filter here 
            //period, account, cumulative


            let dateObj = new Date(transaction.date);
            let month = `${dateObj.getMonth() + 1}`.padStart(2, "0"); //months from 1-12
            let year = dateObj.getUTCFullYear();
            const stringDate = [year, month].join("-")

            if (isCumulative) {
                if (!transactionObject[stringDate]) {
                    transactionObject[stringDate] = transaction.amount;
                } else {
                    transactionObject[stringDate] += transaction.amount;
                }
            } else {
                dateValueObject.push({
                    x: transaction.date,
                    y: transaction.amount,
                    name: transaction.name
                });
            }

        })
        if (isCumulative) {
            for (const date in transactionObject) {
                dateValueObject.push({
                    x: date,
                    y: transactionObject[date],
                });
            }
        }
        //let get Config and load it 
        let dataCategory = {
            label: category.name,
            data: dateValueObject,
            borderColor: parseColorCSS("categoryColor_" + category.id),
            fill: false,
            tension: 0.3,
            hidden: settings[category.name]
        }

        data.datasets.push(dataCategory);
    })

    return data

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
