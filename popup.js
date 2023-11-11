const evt = new Evt();
const settingClass = new Settings();

let setting; 

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
});


document.addEventListener('DOMContentLoaded', async function () {

    await settingClass.loadSettings();

    let currentVersionImg = document.querySelector("#currentVersion")
    let cvSource = "https://img.shields.io/badge/installed-" + chrome.runtime.getManifest().version + "-blue"
    currentVersionImg.src = cvSource

    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let accounts = document.querySelector('#accounts');
    let csvExport = document.querySelector("#exportCsv");
    let refresh = document.querySelector("#refresh");
    chrome.storage.local.get(['startDate', 'endDate'], function (data) {
        data.endDate
        if (data.endDate != null && data.startDate != null ) {
            startDate.value = data.startDate
            endDate.value = data.endDate
        } else {
            startDate.value = new Date(null).toDateInputValue()
            endDate.value = new Date().toDateInputValue()
        }
    });

    chrome.storage.local.get(['accountsList'], function (data) {
        if (data.accountsList !=null) {
            for (const account of data.accountsList) {
                let newOption = new Option(account, account);
                accounts.add(newOption, undefined);
            }
        } else {

        }
    });


    let inputs = [startDate, endDate, accounts]
    for (const input of inputs) {
        input.addEventListener('blur', function () {
            chrome.storage.local.set({ [this.id]: this.value });
        })
    }


    //load data

    chrome.storage.local.get(['cache_data_transac', 'cache_data_categ'], function (data) {
        csvExport.addEventListener('click', function () {
            // Convert Object to JSON
            let jsonObject = JSON.stringify(data.cache_data_transac);
            let csvContent = "data:text/csv;charset=utf-8," + ConvertToCSV(jsonObject)
            let encodedUri = encodeURI(csvContent);

            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "transaction_export_" + new Date().toLocaleDateString() + ".csv");
            document.body.appendChild(link); // Required for FF
            link.click(); // This will download the data file named "my_data.csv".

        })
    });

    refresh.addEventListener('click', function () {
        chrome.storage.local.set({ ["cache_data_transac"]: null });
        chrome.storage.local.set({ ["cache_data_categ"]: null });
        chrome.storage.local.get(['cache_data_transac', 'cache_data_categ'], function (data) {
        console.log("data refresh",data.cache_data_transac, data.cache_data_categ)
        evt.dispatch('url_change');
        })
    })


    function ConvertToCSV(objArray) {


        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        var str = '';

        let keys = Object.keys(array[0])
        str = keys.join(",") + "\r\n"

        for (var i = 0; i < array.length; i++) {
            var line = '';
            for (var index in array[i]) {
                if (line != '') line += ','
                if (typeof array[i][index] === 'object' && array[i][index] != null) array[i][index] = array[i][index].id
                line += array[i][index];
            }

            str += line + '\r\n';
        }

        return str;
    }
});

