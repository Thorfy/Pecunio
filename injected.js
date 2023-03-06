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

build();

// let dataClass = new BankinData()
// let loadDataVal = dataClass.getData()
// loadDataVal.then((res) => {
//     console.log(res)
// })

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


function build() {
    //routing 
    if (location.href === "https://app2.bankin.com/accounts") {

        loadingscreen();
        loadSettings();

        authHeader.then(res => {
            Promise.all([loadData(res, urlTransactions, "transac"), loadData(res, urlCategory, "categ")]).then(async ([transac, categ]) => {

                let settings = await chrome.storage.local.get(['startDate', 'endDate', 'accounts'])
                defineMandatorySetting(settings)

                transac = await applySettingOnData(transac, settings)
                chrome.storage.local.set({ 'transac': transac });
                chrome.storage.local.set({ 'categ': categ });

                await buildChart(transac, categ, settings);
            });
        });
    }
}

async function loadData(authHeader, url, type) {
    return new Promise(async (resolve, reject) => {
        let dataReturn = []

        //verify chrome storage
        let cacheData = await chrome.storage.local.get(['cache_data_' + type, 'cache_time_' + type])

        //verify time of cache
        if (cacheData && cacheData['cache_data_' + type] && (cacheData['cache_time_' + type] > Date.now() - 2000 * 60)) {
            dataReturn = cacheData['cache_data_' + type];

        } else {
            dataReturn = await getBankinData(authHeader, domain, dataReturn, url);
            let cacheObject = {};
            cacheObject['cache_data_' + type] = dataReturn;
            cacheObject['cache_time_' + type] = Date.now();
            chrome.storage.local.set(cacheObject);
        }
        resolve(dataReturn);
    })
}

function loadingscreen() {
    let homeBlock = document.getElementsByClassName("homeBlock")
    let imgdiv = document.createElement('img')
    imgdiv.src = chrome.runtime.getURL("Loading.gif")
    imgdiv.style = "text-align: center;"
    homeBlock[0].innerHTML = ""
    homeBlock[0].appendChild(imgdiv)
}

function loadSettings(){
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

function defineMandatorySetting(settings) {
   
}

function applySettingOnData(transactions, settings) {
    return new Promise((resolve, reject) => {

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


async function getBankinData(authHeader, domain, globalVar, url) {
    const myInit = {
        method: 'GET',
        headers: authHeader,
        mode: 'cors',
        cache: 'default'
    };
    return new Promise((resolve, reject) => {

        fetch((domain + url), myInit)
            .then(res => res.json())
            .then(async data => {

                if (data.resources && data.resources.length) {
                    data.resources.map(transaction => globalVar.push(transaction))
                }

                if (data.pagination.next_uri && data.pagination.next_uri.length) {
                    globalVar = await getBankinData(authHeader, domain, globalVar, data.pagination.next_uri);
                }

                resolve(globalVar);
            })
            .catch(error => reject(error));

    })
}


function buildChart(allTransactions, allCategory, settings) {

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
        let chartJsConfig = getChartJsConfig(settings);
        chartJsConfig.data = getDataFormated(allCategory, transactionByCategory, true);
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


function getChartJsConfig(settings) {

    const chartJsConfig = {
        type: 'line',
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Depense sur " + monthDiff(settings.startDate, settings.endDate) + " mois"
                },
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

function getDataFormated(categoryData, transactionByCategory, isCumulative = false) {

    let data = {
        datasets: []
    }

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

        let dataCategory = {
            label: category.name,
            data: dateValueObject,
            borderColor: parseColorCSS("categoryColor_" + category.id),
            fill: false,
            tension: 0.3
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
