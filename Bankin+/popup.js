document.addEventListener('DOMContentLoaded', function () {
    console.log("popupReady")

    let currentVersionImg = document.querySelector("#currentVersion")
    let cvSource = "https://img.shields.io/badge/installed-" + chrome.runtime.getManifest().version + "-blue"
    currentVersionImg.src = cvSource

    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let accounts = document.querySelector('#accounts');

    chrome.storage.local.get(['startDate', 'endDate'], function (data) {
        for (const input of inputs) {
            input.value = data[input.id]
        }
    });

    chrome.storage.local.get(['accountsList'], function (data) {
        for (const account of data.accountsList) {
            let newOption = new Option(account, account);
            accounts.add(newOption, undefined);
        }
    });


    let inputs = [startDate, endDate, accounts]
    for (const input of inputs) {
        input.addEventListener('blur', function () {
            console.log(this.id, this.value)
            chrome.storage.local.set({ [this.id]: this.value });
        })
    }
    //load data

    chrome.storage.local.get(['transac', 'categ'], function (data) {
        console.log(data)
    });
});