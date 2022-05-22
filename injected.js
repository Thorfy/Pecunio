let port = chrome.runtime.connect();
let authHeader = false;
const requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]

port.onMessage.addListener(message => {
    authHeader = message.data;
    console.log(authHeader);
    console.log(requiredHeader);
    if(Object.keys(authHeader).length === 0)
        return false
    for (const property in authHeader) {
        console.log(`${property}: ${authHeader[property]}`);
        if (!requiredHeader.includes(property)) {
            return false;
        }
    }
    getTransactionData(authHeader);
});
console.log('injected');


// load data after getting port, message and bearer 
// Promise.all([$promise1, $promise2]).then([promise1Result, promise2Result] => {});


function getTransactionData(authHeader) {
    console.log("getTransactionData");

    const myInit = {
        method: 'GET',
        headers: authHeader,
        mode: 'cors',
        cache: 'default'
    };

    fetch("https://sync.bankin.com/v2/transactions?limit=500&mytranscation", myInit)
        .then(res => res.json())

}

//get config and data
const DATA_COUNT = 12;
const labels = [];
for (let i = 0; i < DATA_COUNT; ++i) {
    labels.push(i.toString());
}
const datapoints = [0, 20, 20, 60, 60, 120, 160, 180, 120, 125, 105, 110, 170];
const datapoints1 = [260, 65, 185, 260, 42, 130, 180, 140, 300, 125, 125, 110, 170];
const datapoints2 = [0, 20, 20, 60, 60, 120, 160, 180, 120, 125, 105, 110, 170];
const datapoints3 = [0, 20, 20, 60, 60, 120, 160, 180, 120, 125, 105, 110, 170];
const datapoints4 = [0, 20, 20, 60, 60, 120, 160, 180, 120, 125, 105, 110, 170];
const data = {
    labels: labels,
    datasets: [
        {
            label: 'Course',
            data: datapoints,
            borderColor: "yellow",
            fill: false,
            tension: 0.4
        },{
            label: 'Voiture',
            data: datapoints1,
            borderColor: "blue",
            fill: false,
            tension: 0.4
        },{
            label: 'loyer',
            data: datapoints2,
            borderColor: "dark",
            fill: false,
            tension: 0.4
        },{
            label: 'Sport',
            data: datapoints3,
            borderColor: "red",
            fill: false,
            tension: 0.4
        },{
            label: 'revenue',
            data: datapoints4,
            borderColor: "green",
            fill: false,
            tension: 0.4
        },
    ]
};

//get config
const chartJsConfig = {
    type: 'line',
    data: data,
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
                display: true,
                title: {
                    display: true
                }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: 'Value'
                },
                suggestedMin: -10,
                suggestedMax: 200
            }
        }
    },
}

//select categroy DIV
let homeBlock = document.getElementsByClassName("homeBlock")
console.log(homeBlock)
let canvasDiv = document.createElement('canvas');
if(homeBlock.length != 0){
    homeBlock[0].innerHTML =  "";
    homeBlock[0].appendChild(canvasDiv);
}
const ctx = canvasDiv.getContext('2d');
const myChart = new Chart(ctx, chartJsConfig);

// store url on load
let currentPage = location.href;

// listen for url changes
setInterval(function() {
    if (currentPage != location.href) {
        // page has changed, set new page as 'current'
        console.log("setinterval")
        currentPage = location.href;

        // if data is present xontruct the whole things
        
    }
}, 500);
