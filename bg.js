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
    portEvent = port;
});
