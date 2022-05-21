/*
working POC*/
const allHeaders = {};
const requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
let portEvent = false;
chrome.webRequest.onBeforeSendHeaders.addListener(
    function (info) {
        info.requestHeaders.forEach(headerRow => {
            if(requiredHeader.includes(headerRow.name)){
                allHeaders[headerRow.name] = headerRow.value
            }
        })
        if (portEvent){
            portEvent.postMessage({
                'data': allHeaders
            });
        }

    },
    {
        urls: ['https://sync.bankin.com/v2/accounts?limit=200'],
        types: ['main_frame', 'sub_frame', 'xmlhttprequest']
    },
    ['requestHeaders']
);

chrome.runtime.onConnect.addListener(port => {
    portEvent = port
    port.postMessage({
        data: allHeaders
    });
});


// step for success

//HEADER -> ok
// get header -> ok
// transfer data -> ok

//DATA
// Do a call to api with custom header -> ok
// update real Time header -> ok
// avoid infinite while with ajax -> use setting instead -> OK
// start sending ajax only 1 times when authHeader is ready to use -> use setting instead -> OK
// choose account in function of tab in bankin
// structure data correctly

//CHART
// inject libs chartJs -> ok
// create canvas -> ok
// display chart.js with fake data -> ok
// modify html for style

//POPUP OPTION
// create popup -> Ok
// choose data time set
// export button
// do export to csv

//FINALIZE
// Tuning
// Fix bug
// Error handler
// Optimize seo of chrome store
// Publication on chrome store
