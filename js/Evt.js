class Evt {
    initPrivate() {
        this._eventDispatched = {};
        this._key = 'Event_';
    }
    constructor() {
        this.initPrivate();
    }
    listen(str, cb, once = false) {
        if(this._eventDispatched[str]) {
            cb();
        } else {
            document.addEventListener(this._key + str, cb, { once:once });
        }
    }
    dispatch(str) {
        this._eventDispatched[str] = true;
        console.log(this._key + str)
        document.dispatchEvent(new Event(this._key + str));
    }
}