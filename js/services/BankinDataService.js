class BankinDataService {
    static requiredHeader = ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"]
    static domain = "https://sync.bankin.com";
    static urlTransactions = "/v2/transactions?limit=500";
    static urlCategories = "/v2/categories?limit=200";
    static urlAccounts = "/v2/accounts?limit=500";

    constructor() {
        this.port = chrome.runtime.connect();
        this.authRequest = new Promise((resolve, reject) => {
            this.port.onMessage.addListener(message => {
                if (Object.keys(message.data).length === 0)
                    return false;
                for (const property in message.data) {
                    if (!BankinDataService.requiredHeader.includes(property))
                        return false;
                }
                this.authHeader = message.data;
                resolve(this.authHeader);
            });
        });
        this.authRequest.then(() => this.reloadData());
    }

    async reloadData() {
        const [transactions, categories, accounts] = await Promise.all([
            this.loadCache(this.authHeader, BankinDataService.urlTransactions, "transactions"), 
            this.loadCache(this.authHeader, BankinDataService.urlCategories, "categories"),
            this.loadCache(this.authHeader, BankinDataService.urlAccounts, "accounts")
        ]);
        
        this.dataVal = { transactions: transactions, categories: categories, accounts: accounts };
        //loadDataVal = this.dataVal;
        evt.dispatch('data_loaded');
    }

    async loadCache(authHeader, url, type) {
        let dataReturn = [];

        const cachedData = settingClass.getSetting('cache_data_' + type);
        const cachedTime = settingClass.getSetting('cache_time_' + type);

        if (cachedData && cachedTime > Date.now() - 2000 * 60) {
            evt.dispatch("cache_data_" + type + "_loaded");
            dataReturn = cachedData;
        } else {
            dataReturn = await this.getBankinDataApi(authHeader, dataReturn, url);
            let cacheObject = {
                ['cache_data_' + type]: dataReturn,
                ['cache_time_' + type]: Date.now()
            };
            await settingClass.setSettings(cacheObject);
        }
        return dataReturn;
    }

    async getBankinDataApi(authHeader, globalVar, url) {
        const myInit = {
            method: 'GET',
            headers: authHeader,
            mode: 'cors',
            cache: 'default'
        };

        try {
            const res = await fetch((BankinDataService.domain + url), myInit);
            const data = await res.json();

            if (data.resources && data.resources.length) {
                Array.prototype.push.apply(globalVar, data.resources);
            }

            if (data.pagination.next_uri && data.pagination.next_uri.length) {
                globalVar = await this.getBankinDataApi(authHeader, globalVar, data.pagination.next_uri);
            }

            evt.dispatch('fresh_data_loaded');
            return globalVar;
        } catch (error) {
            console.error(error);
        }
    }
}
