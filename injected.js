let port = chrome.runtime.connect();
let authHeader = false;
const requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]

port.onMessage.addListener(message => {
    authHeader = message.data;
    console.log(authHeader);
    console.log(requiredHeader);

    for (const property in authHeader) {
        console.log(`${property}: ${authHeader[property]}`);
        if (!requiredHeader.includes(property)) {
            return false;
        }
    }
    getTransactionData(authHeader);
});
console.log('injected');

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
const data = {
    labels: labels,
    datasets: [
        {
            label: 'Cubic interpolation (monotone)',
            data: datapoints,
            borderColor: "red",
            fill: false,
            cubicInterpolationMode: 'monotone',
            tension: 0.4
        }, {
            label: 'Cubic interpolation',
            data: datapoints,
            borderColor: "blue",
            fill: false,
            tension: 0.4
        }, {
            label: 'Linear interpolation (default)',
            data: datapoints,
            borderColor: "green",
            fill: false
        }
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
                text: 'Chart.js Line Chart - Cubic interpolation mode'
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
let categoryDiv = document.getElementsByClassName("categoryChart")
console.log(categoryDiv)
let canvasDiv = document.createElement('canvas');
canvasDiv.setAttribute('id', 'chartJsCanvas');
if(categoryDiv.length != 0){
    categoryDiv[0].appendChild(canvasDiv);
}
const ctx = document.getElementById('chartJsCanvas').getContext('2d');
const myChart = new Chart(ctx, chartJsConfig);
