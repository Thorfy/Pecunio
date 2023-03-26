class BankinData {

    static requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
    static domain = "https://sync.bankin.com";
    static urlTransactions = "/v2/transactions?limit=500";
    static urlCategory = "/v2/categories?limit=200";

    constructor() {

        this.port = chrome.runtime.connect();


        
        this.authRequest = new Promise((resolve, reject) => {
            this.port.onMessage.addListener(message => {
    
                if (Object.keys(message.data).length === 0)
                    return false
                for (const property in message.data) {
                    if (!BankinData.requiredHeader.includes(property))
                        return false;
                }

                this.authHeader = message.data
                resolve(this.authHeader) 
            });
        });

        this.authRequest.then(authHeader => {
            console.log("test")
            Promise.all([this.loadCache(authHeader, BankinData.urlTransactions, "transac"), this.loadCache(authHeader, BankinData.urlCategory, "categ")]).then(async ([transac, categ]) => {
                this.dataVal = {transaction: transac, category: categ} 
                loadDataVal = this.dataVal 
                evt.dispatch('data_loaded');
            });
        })
    
    }

    getData() {
        console.log("getData")
        return this.authRequest.then(authHeader => {
            return new Promise((resolve, reject) => {
                console.log("test")
                Promise.all([this.loadCache(authHeader, BankinData.urlTransactions, "transac"), this.loadCache(authHeader, BankinData.urlCategory, "categ")]).then(async ([transac, categ]) => {
                    resolve({transaction: transac, category: categ})
                    evt.dispatch('data_loaded');
                
                });
            });
        })
    }

    loadCache(authHeader, url, type) {
        return new Promise(async (resolve, reject) => {
            let dataReturn = []

            //verify chrome storage
            let cacheData = await chrome.storage.local.get(['cache_data_' + type, 'cache_time_' + type])

            //verify time of cache
            if (cacheData && cacheData['cache_data_' + type] && (cacheData['cache_time_' + type] > Date.now() - 2000 * 60)) {
                dataReturn = cacheData['cache_data_' + type];

            } else {
                dataReturn = await this.getBankinDataApi(authHeader, dataReturn, url);
                let cacheObject = {};
                cacheObject['cache_data_' + type] = dataReturn;
                cacheObject['cache_time_' + type] = Date.now();
                chrome.storage.local.set(cacheObject);
            }
            resolve(dataReturn);
        })
    }


    getBankinDataApi(authHeader, globalVar, url) {
        const myInit = {
            method: 'GET',
            headers: authHeader,
            mode: 'cors',
            cache: 'default'
        };
        return new Promise((resolve, reject) => {

            fetch((BankinData.domain + url), myInit)
                .then(res => res.json())
                .then(async data => {

                    if (data.resources && data.resources.length) {
                        data.resources.map(transaction => globalVar.push(transaction))
                    }

                    if (data.pagination.next_uri && data.pagination.next_uri.length) {
                        globalVar = await this.getBankinDataApi(authHeader, globalVar, data.pagination.next_uri);
                    }

                    resolve(globalVar);
                })
                .catch(error => reject(error));
        })
    }
}