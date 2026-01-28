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

// Écouter les messages pour ouvrir la popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openPopup') {
        // Essayer d'ouvrir la popup
        // Note: openPopup() nécessite un user gesture, donc cela peut ne pas fonctionner
        // mais on essaie quand même pour être sûr que l'utilisateur voit la popup
        chrome.action.openPopup()
            .then(() => {
                // Si la popup s'ouvre avec succès, retirer le badge s'il existe
                chrome.action.setBadgeText({ text: '' });
            })
            .catch(error => {
                // Si l'ouverture échoue (pas de user gesture), on peut au moins mettre un badge
                console.log("[BG] Impossible d'ouvrir la popup automatiquement:", error.message);
                // Mettre un badge pour indiquer qu'il y a quelque chose à voir
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
            });
    }
    return true; // Indique qu'on répondra de manière asynchrone si nécessaire
});
