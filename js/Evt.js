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
        }
    }
    dispatch(str, useChromeMessaging = false) {
        this._eventDispatched[str] = true;
        console.log(this._key + str)
        document.dispatchEvent(new Event(this._key + str));
    }
}
