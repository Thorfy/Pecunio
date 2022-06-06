let port = chrome.runtime.connect();
let authHeader = false;
const requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
let domain = "https://sync.bankin.com";

let urTransactions = "/v2/transactions?limit=500";
let urlCategory = "/v2/categories?limit=200";

let allTransactions = [];
let allCategory = [];
let preparedData = [];

port.onMessage.addListener(message => {
    authHeader = message.data;
    if (Object.keys(authHeader).length === 0)
        return false
    for (const property in authHeader) {
        if (!requiredHeader.includes(property))
            return false;

    }
    if(allTransactions.length == 0 && allCategory.length == 0){
        console.log(allTransactions.length, allCategory.length);
        getBankinData(authHeader, domain, allTransactions, urTransactions);
        getBankinData(authHeader, domain, allCategory, urlCategory);
    }
});

// load data after getting port, message and bearer 
// Promise.all([$promise1, $promise2]).then([promise1Result, promise2Result] => {});

// promise 1 load bankin data 



// store url on load
let currentPage = location.href;
build();
// listen for url changes
setInterval(function () {
    if (currentPage != location.href) {
        // page has changed, set new page as 'current'
        currentPage = location.href;
        build();
    }
}, 500);


function build() {
    if (location.href === "https://app2.bankin.com/accounts") {
        buildChart();
    }
}

function getBankinData(authHeader, domain, globalVar, url) {

    const myInit = {
        method: 'GET',
        headers: authHeader,
        mode: 'cors',
        cache: 'default'
    };

    fetch((domain + url), myInit)
        .then(res => res.json())
        .then(data => {
            if (data.resources && data.resources.length) {
                data.resources.map(transaction => globalVar.push(transaction))
            }
            if (data.pagination.next_uri && data.pagination.next_uri.length) {
                getBankinData(authHeader, domain, globalVar, data.pagination.next_uri);
            }
        })
}


function buildChart() {

    let transactionByCategory = false;
    if (allCategory.length && allTransactions.length) {
        transactionByCategory = mergeTransactionByCategory(allTransactions, allCategory);


        //select categroy DIV
        let homeBlock = document.getElementsByClassName("homeBlock")
        let canvasDiv = document.createElement('canvas');
        if (homeBlock.length != 0) {
            homeBlock[0].innerHTML = "";
            homeBlock[0].appendChild(canvasDiv);
        }
        let chartJsConfig = getChartJsConfig();
        chartJsConfig.data = getCumulatedDataFormated(allCategory, transactionByCategory);
        const ctx = canvasDiv.getContext('2d');
        const myChart = new Chart(ctx, chartJsConfig);
    }
}

function mergeTransactionByCategory(allTransactions, allCategory) {
    preparedData = [];
    allTransactions.forEach(transaction => {
        allCategory.forEach(category => {
            if (!preparedData[category.id])
                preparedData[category.id] = [];

            if (transaction.category.id === category.id) {
                preparedData[category.id].push(transaction);
            } else {
                category.categories.forEach(childCategory => {
                    if (transaction.category.id === childCategory.id) {
                        preparedData[category.id].push(transaction);
                    }
                })
            }
        })

    })
    //console.log(preparedData);
    return preparedData;
}


function getChartJsConfig() {

    const chartJsConfig = {
        type: 'line',
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'depense sur X mois (todo dynamic)'
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

function getDataFormated(categoryData, transactionByCategory = false) {

    let data = {
        datasets: []
    }
    categoryData.forEach(category => {
        let transactions = transactionByCategory[parseInt(category.id)];
        let dateValueObject = [];

        transactions.forEach(transaction => {

            // garde fou
            // choose periode
           // if(transaction.date.includes("2022")){
                dateValueObject.push({
                    x:transaction.date,
                    y:transaction.amount,
                    name: transaction.name
                });
            //}
        })


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

function getCumulatedDataFormated(categoryData, transactionByCategory = false) {

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
            console.log(transaction)

            let dateObj = new Date(transaction.date);
            let month = `${dateObj.getMonth() + 1}`.padStart(2, "0"); //months from 1-12
            let year = dateObj.getUTCFullYear();
            const stringDate = [year, month].join("-")
            
            if(!transactionObject[stringDate]){
                transactionObject[stringDate] = transaction.amount;
            }else{
                transactionObject[stringDate] += transaction.amount;
            }    

        })
        for (const date in transactionObject) {
            dateValueObject.push({
                x:date,
                y:transactionObject[date],
            });
            
            //console.log(`${date}: ${transactionObject[date]}`);
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




function getFakeData() {
    //get config and data
    const DATA_COUNT = timeInterval();
    const labels = [];
    for (let i = 0; i < DATA_COUNT; ++i) {
        labels.push(i.toString());
    }
    const datapoints = [0, 20, 20, 60, 60, 120, 160, 180, 120, 125, 105, 110, 170];
    const datapoints1 = [260, 65, 185, 260, 42, 130, 180, 140, 300, 125, 125, 110, 170];
    const data = {
        labels: labels,
        datasets: [
            {
                label: 'Course',
                data: datapoints,
                borderColor: parseColorCSS("categoryColor_162"),
                fill: false,
                tension: 0.4
            }, {
                label: 'Voiture',
                data: datapoints1,
                borderColor: parseColorCSS("categoryColor_162"),
                fill: false,
                tension: 0.4
            }
        ]
    };

    return data;
}

function timeInterval() {
    //default val
    let val = 12;
    //get value of html input or button
    return val;
};

//trick for get real color of category
function parseColorCSS(strClass) {
    let styleElement = document.createElement("div");
    styleElement.className = strClass;
    document.body.appendChild(styleElement)
    let colorVal = window.getComputedStyle(styleElement).backgroundColor;
    styleElement.remove();
    return colorVal;
}
