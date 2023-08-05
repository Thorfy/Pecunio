class Evt {
    initPrivate() {
        this._eventDispatched = {};
        this._key = 'Event_';
    }
    constructor() {
        this.initPrivate();
    }
    listen(str, cb, once = false, useChromeMessaging = false) {
        if(this._eventDispatched[str]) {
            cb();
        } else {
            // Écoute les événements standards du document
            document.addEventListener(this._key + str, cb, { once:once });
            
            // Si useChromeMessaging est vrai, écoute aussi les messages de Chrome
            if(useChromeMessaging) {
                chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                    if (request.method === this._key + str) {
                        cb();
                    }
                });
            }
        }
    }
    dispatch(str, useChromeMessaging = false) {
        this._eventDispatched[str] = true;
        console.log(this._key + str)
        document.dispatchEvent(new Event(this._key + str));
        
        // Si useChromeMessaging est vrai, envoie aussi un message de Chrome
        if(useChromeMessaging) {
            chrome.runtime.sendMessage({ method: this._key + str }, function(response) {
                console.log(response);
            });
        }
    }
}
