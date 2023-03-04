document.addEventListener('DOMContentLoaded', function () {
    console.log("popupReady")

    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let accounts = document.querySelector('#accounts');
    
    chrome.storage.local.get(['startDate', 'endDate','accounts'], function (data) {
        for (const input of inputs) {
            input.value = data[input.id]
        }
    });
    
    let inputs = [startDate, endDate, accounts]
    for (const input of inputs) {
        input.addEventListener('blur', function() {
            console.log(this.id, this.value)
            chrome.storage.local.set({ [this.id]: this.value });
        })
    }
    //load data

    chrome.storage.local.get(['transac', 'categ'], function (data) {
        console.log(data)
    });
});