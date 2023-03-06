class BankinData {

    constructor() {

        this.requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
        this.domain = "https://sync.bankin.com";
        this.urlTransactions = "/v2/transactions?limit=500";
        this.urlCategory = "/v2/categories?limit=200";
        this.port = chrome.runtime.connect();
        
        this.authRequest = new Promise((resolve, reject) => {
            this.port.onMessage.addListener(message => {
    
                if (Object.keys(message.data).length === 0)
                    return false
                for (const property in message.data) {
                    if (!this.requiredHeader.includes(property))
                        return false;
                }
                resolve(message.data);
            });
        });
    
    }

    getData() {
        return this.authRequest.then(authHeader => {
            return new Promise(async (resolve, reject) => {
                Promise.all([this.loadCache(authHeader, this.urlTransactions, "transac"), this.loadCache(authHeader, this.urlCategory, "categ")]).then(async ([transac, categ]) => {
                    resolve({transaction: transac, category: categ})
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

            fetch((this.domain + url), myInit)
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