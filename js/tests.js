// Mock chrome.storage API
const mockChromeStorage = {
    local: {
        data: {},
        get: function(keys, callback) {
            const result = {};
            if (keys === null) {
                if (typeof callback === 'function') callback(this.data);
                return Promise.resolve(this.data);
            }
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach(key => {
                result[key] = this.data[key] !== undefined ? this.data[key] : null;
            });
            if (typeof callback === 'function') callback(result);
            return Promise.resolve(result);
        },
        set: function(items, callback) {
            Object.keys(items).forEach(key => {
                this.data[key] = items[key];
            });
            if (typeof callback === 'function') callback();
            return Promise.resolve();
        },
        clear: function(callback) {
            this.data = {};
            if (typeof callback === 'function') callback();
            return Promise.resolve();
        }
    }
};

if (typeof chrome === 'undefined') {
    global.chrome = mockChromeStorage;
} else {
    chrome.storage = mockChromeStorage.storage || chrome.storage;
}

// Mock DOM environment
let mockStyleSheets = {};
global.document = {
    createElement: function(tagName) {
        if (tagName === 'div' || tagName === 'canvas') {
            const el = {
                style: {},
                className: '',
                id: '',
                appendChild: function() {},
                remove: function() {},
                getContext: function() { return {};} // Mock for canvas.getContext
            };
            if (tagName === 'canvas') {
                el.classList = { add: function() {} }; // Mock classList.add for canvas
            }
            return el;
        }
        return {};
    },
    body: {
        appendChild: function() {},
        remove: function() {}
    },
    getElementById: function(id) {
        // Simple mock, can be expanded if tests need specific elements
        // console.log(`document.getElementById called with: ${id}`);
        return null; // Default to not found
    },
    getElementsByClassName: function(className) {
        if (className === 'homeBlock' || className === 'categoryChart') {
            const mockParent = {
                innerHTML: '',
                appendChild: function() {},
                querySelectorAll: () => [], // for existingCanvases checks
                querySelector: () => null // for existingCanvas check
            };
            return [mockParent];
        }
        return [];
    },
    querySelectorAll: () => [] // global querySelectorAll
};

global.window = {
    getComputedStyle: function(element) {
        if (element && element.className && mockStyleSheets[element.className]) {
            return { backgroundColor: mockStyleSheets[element.className] };
        }
        return { backgroundColor: '' };
    }
};
// Mock Chart.js global
global.Chart = function() { return { destroy: function() {} }; }; // Mock constructor and destroy
global.Chart.getChart = function() { return null; }; // Mock getChart
global.Chart.defaults = { plugins: { legend: { onClick: function() {} } } };


// Test Runner (existing simple one)
const tests = [];
let testsPassed = 0;
let testsFailed = 0;

function describe(description, fn) {
    console.group(description);
    fn();
    console.groupEnd();
}

function it(description, fn) {
    tests.push({ description, fn });
}

async function runTests() {
    console.log("Starting tests...");
    testsPassed = 0; // Reset for each run
    testsFailed = 0; // Reset for each run
    // Clear mock storage for next run if any
    if (global.chrome && global.chrome.storage) { // Check if chrome and storage are defined
        await global.chrome.storage.local.clear();
    }
    mockStyleSheets = {}; // Clear mock stylesheets

    for (const test of tests) {
        console.log(`RUNS: ${test.description}`);
        try {
            await test.fn(); // Added await here for async tests
            console.log(`%cPASS: ${test.description}`, 'color: green;');
            testsPassed++;
        } catch (error) {
            console.error(`%cFAIL: ${test.description}`, 'color: red;');
            console.error(error);
            testsFailed++;
        }
    }
    console.log("--------------------");
    console.log(`Tests finished. Passed: ${testsPassed}, Failed: ${testsFailed}`);
}

function assertEquals(expected, actual, message = "Assertion failed") {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(`${message}: Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
    }
}
function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}
function assertNotNull(value, message = "Assertion failed: value is null") {
    if (value === null || value === undefined) {
        throw new Error(message);
    }
}
function assertInstanceOf(instance, constructor, message = "Assertion failed: incorrect instance type") {
    if (!(instance instanceof constructor)) {
        throw new Error(message);
    }
}


// --- Mock Services & Data ---
const mockSettingsService = {
    getSetting: (key) => {
        const settings = {
            'startDate': '2023-01-01',
            'endDate': '2023-12-31',
            'chartType': 'bar',
            'accountsSelected': null
        };
        return settings[key] || null;
    },
    getSettings: async (keys) => { // Mock for getSettings used by LineBarChartProcessor
        const settings = { 'Category1': false, 'Category2': true }; // example visibility
        const result = {};
        keys.forEach(k => result[k] = settings[k]);
        return result;
    },
    setSetting: async () => {} // Mock async behavior
};

const sampleCategories = [
    { id: 1, name: 'Food', parent_id: null }, { id: 10, name: 'Groceries', parent_id: 1 },
    { id: 2, name: 'Transport', parent_id: null }, { id: 20, name: 'Gas', parent_id: 2 },
    { id: 3, name: 'Housing', parent_id: null }
];
const sampleTransactions = [
    { date: '2023-01-10', effectiveDate: new Date('2023-01-10'), category_id: 10, amount: 50, account: { id: 1 } },
    { date: '2023-01-15', effectiveDate: new Date('2023-01-15'), category_id: 20, amount: 30, account: { id: 1 } },
    { date: '2023-02-20', effectiveDate: new Date('2023-02-20'), category_id: 3, amount: 100, account: { id: 2 } },
    { date: '2024-01-05', effectiveDate: new Date('2024-01-05'), category_id: 10, amount: 60, account: { id: 1 } }
];

// --- DataService Tests ---
describe('DataService Tests', () => {
    let dataServiceInstance;

    // Simplified beforeEach for DataService tests
    function setupDataService() {
        const mockBankinDataProvider = { dataVal: { transactions: sampleTransactions, categories: sampleCategories, accounts: [] } };
        dataServiceInstance = new DataService(mockSettingsService, mockBankinDataProvider);
        // Manually trigger processing as event listening might be tricky in this test env
        if (mockBankinDataProvider.dataVal) {
            dataServiceInstance.rawTransactions = mockBankinDataProvider.dataVal.transactions || [];
            dataServiceInstance.rawCategories = mockBankinDataProvider.dataVal.categories || [];
            dataServiceInstance.rawAccounts = mockBankinDataProvider.dataVal.accounts || [];
            dataServiceInstance._processInitialData();
        }
    }

    it('getTransactions should filter by date', () => {
        setupDataService();
        const filtered = dataServiceInstance.getTransactions({ startDate: '2023-01-12', endDate: '2023-02-28' });
        assertEquals(2, filtered.length);
        assertEquals(30, filtered[0].amount); // Sort order might vary, check amounts
        assertEquals(100, filtered[1].amount);
    });

    it('getTransactions should filter by accountIds', () => {
        setupDataService();
        const filtered = dataServiceInstance.getTransactions({ accountIds: [2] });
        assertEquals(1, filtered.length);
        assertEquals(100, filtered[0].amount);
    });

    it('getParentCategory should return correct parent', () => {
        setupDataService();
        const parent = dataServiceInstance.getParentCategory(10); // Groceries
        assertNotNull(parent, "Parent category not found");
        assertEquals(1, parent.id);
        assertEquals('Food', parent.name);

        const alreadyParent = dataServiceInstance.getParentCategory(1); // Food
        assertEquals(1, alreadyParent.id);
    });

    it('aggregateByCategory should sum amounts correctly (groupByParent=true)', () => {
        setupDataService();
        const transactionsToAgg = [
            { category_id: 10, amount: 50 }, { category_id: 10, amount: 20 }, // Groceries (Food) -> 70
            { category_id: 20, amount: 30 }, // Gas (Transport) -> 30
            { category_id: 3, amount: 100 }  // Housing -> 100
        ];
        const aggregated = dataServiceInstance.aggregateByCategory(transactionsToAgg, true);
        const food = aggregated.find(a => a.name === 'Food');
        const transport = aggregated.find(a => a.name === 'Transport');
        const housing = aggregated.find(a => a.name === 'Housing');

        assertEquals(70, food.totalAmount, "Food aggregation incorrect");
        assertEquals(30, transport.totalAmount, "Transport aggregation incorrect");
        assertEquals(100, housing.totalAmount, "Housing aggregation incorrect");
    });
});


// --- LineBarChartProcessor Tests ---
describe('LineBarChartProcessor Tests', () => {
    let mockDataServiceForLineBar;
    let lineBarProcessor;

    function beforeEachLineBar() {
        mockDataServiceForLineBar = {
            settingsService: mockSettingsService,
            getTransactions: (filters) => {
                // Basic mock, refine if complex filtering by 'groupingDate' is needed for tests
                return sampleTransactions.filter(t => {
                    const d = new Date(t.effectiveDate);
                    if (filters.startDate && d < new Date(filters.startDate)) return false;
                    if (filters.endDate && d > new Date(filters.endDate)) return false;
                    if (filters.accountIds && !filters.accountIds.includes(t.account.id)) return false;
                    return true;
                }).map(t => ({...t, groupingDate: new Date(t.effectiveDate.getFullYear(), t.effectiveDate.getMonth(), 1) })); // Add groupingDate
            },
            getAllCategories: () => sampleCategories,
        };
        lineBarProcessor = new LineBarChartProcessor(mockDataServiceForLineBar, { accountsSelected: null });
    }

    it('prepareData should format data for line/bar chart', async () => {
        beforeEachLineBar();
        const preparedData = await lineBarProcessor.prepareData();
        // Example: First dataset should be 'Food' if categories are processed in order
        assert(preparedData.datasets.length > 0, "No datasets prepared");
        // More detailed assertions based on expected aggregation and formatting...
        // This depends heavily on the specific (complex) logic inside prepareData
    });

    it('getChartConfig should return a valid Chart.js config', async () => {
        beforeEachLineBar();
        const dummyProcessedData = { datasets: [{ label: 'Test', data: [{x:'2023-01', y:100}] }] };
        const config = await lineBarProcessor.getChartConfig(dummyProcessedData);
        assertEquals(mockSettingsService.getSetting('chartType'), config.type); // bar or line
        assert(config.options, "Config has no options");
        assert(config.data.datasets[0].label === 'Test', "Data not passed correctly");
    });
});


// --- SankeyChartProcessor Tests ---
describe('SankeyChartProcessor Tests', () => {
    let mockDataServiceForSankey;
    let sankeyProcessor;
    const sankeyDateParams = ['january', '2023']; // Example params

    function beforeEachSankey() {
        mockDataServiceForSankey = {
            settingsService: mockSettingsService,
            getAllTransactions: (includeProcessedDates) => sampleTransactions.map(t => ({...t, groupingDate: new Date(t.effectiveDate.getFullYear(), t.effectiveDate.getMonth(), 1) })),
            getAllCategories: () => sampleCategories,
            getParentCategory: (categoryId) => { /* Simplified from Donut tests */
                const cat = sampleCategories.find(c => c.id === categoryId);
                if (cat && cat.parent_id) return sampleCategories.find(c => c.id === cat.parent_id);
                return cat;
            }
        };
        sankeyProcessor = new SankeyChartProcessor(mockDataServiceForSankey, { dateParams: sankeyDateParams });
    }

    it('prepareData should filter and structure for Sankey', async () => {
        beforeEachSankey();
        const preparedData = await sankeyProcessor.prepareData();
        // Assertions on the hierarchical structure based on sampleTransactions and sankeyDateParams
        // e.g., check if correct transactions are filtered for Jan 2023 and grouped
        const foodParent = preparedData.find(p => p.name === "Food");
        assertNotNull(foodParent, "Food parent category missing in Sankey data");
        assertEquals(1, foodParent.child.find(c => c.name === "Groceries").transactions.length, "Groceries transaction count for Jan 2023 incorrect");
    });

    it('getChartConfig should return Sankey config', () => {
        beforeEachSankey();
        const dummyProcessedData = [{ id: 1, name: 'Food', transactions: [], child: [] }]; // Simplified
        const config = sankeyProcessor.getChartConfig(dummyProcessedData);
        assertEquals('sankey', config.type);
        assert(config.data.datasets[0].data.length >= 0, "Sankey flows not generated");
    });
});


// --- DonutChartProcessor Tests (adapted from previous version) ---
describe('DonutChartProcessor Tests', () => {
    let mockDataServiceForDonut;
    let originalUIManagerParseColorCSS;

    function beforeEachDonut() {
        mockDataServiceForDonut = {
            settingsService: mockSettingsService,
            getAllTransactions: (includeProcessedDates) => sampleTransactions.map(t => ({...t, effectiveDate: new Date(t.date)})),
            getParentCategory: (categoryId) => {
                const cat = sampleCategories.find(c => c.id === categoryId);
                if (cat && cat.parent_id) return sampleCategories.find(c => c.id === cat.parent_id);
                return cat;
            }
        };
        originalUIManagerParseColorCSS = UIManager.parseColorCSS;
        UIManager.parseColorCSS = (className) => "rgb(0,0,0)"; // Simple mock for all colors
    }
    function afterEachDonut() {
        UIManager.parseColorCSS = originalUIManagerParseColorCSS;
    }

    it('prepareData should aggregate for donut chart', async () => {
        beforeEachDonut();
        const donutProcessor = new DonutChartProcessor(mockDataServiceForDonut, { year: 2023 });
        const preparedData = await donutProcessor.prepareData();
        assertEquals(3, preparedData.labels.length, "Donut labels count for 2023 wrong");
        // Food (Groceries) = 50, Transport (Gas) = 30, Housing = 100
        assert(preparedData.datasets[0].data.includes(50) && preparedData.datasets[0].data.includes(30) && preparedData.datasets[0].data.includes(100), "Donut data aggregation incorrect for 2023");
        afterEachDonut();
    });

    it('getChartConfig should return donut config with title', () => {
        beforeEachDonut();
        const donutProcessor = new DonutChartProcessor(mockDataServiceForDonut, { year: 2023 });
        const mockPreparedData = { labels: ["Test"], datasets: [{ data: [1], backgroundColor: ["red"] }] };
        const config = donutProcessor.getChartConfig(mockPreparedData);
        assertEquals('doughnut', config.type);
        assertEquals('Dépenses 2023 par catégorie', config.options.plugins.title.text);
        afterEachDonut();
    });
});


// --- ChartFactory Tests ---
describe('ChartFactory Tests', () => {
    const mockDataServiceForFactory = { settingsService: mockSettingsService }; // Minimal mock

    it('createProcessor should return LineBarChartProcessor', () => {
        const processor = ChartFactory.createProcessor('lineBar', mockDataServiceForFactory, {});
        assertInstanceOf(processor, LineBarChartProcessor);
    });

    it('createProcessor should return SankeyChartProcessor', () => {
        const processor = ChartFactory.createProcessor('sankey', mockDataServiceForFactory, {});
        assertInstanceOf(processor, SankeyChartProcessor);
    });

    it('createProcessor should return DonutChartProcessor', () => {
        const processor = ChartFactory.createProcessor('donut', mockDataServiceForFactory, {});
        assertInstanceOf(processor, DonutChartProcessor);
    });

    it('createProcessor should throw error for unknown type', () => {
        let errorThrown = false;
        try {
            ChartFactory.createProcessor('unknownType', mockDataServiceForFactory, {});
        } catch (e) {
            errorThrown = true;
            assert(e.message.includes("Unknown chart type"), "Incorrect error message for unknown type");
        }
        assert(errorThrown, "Error not thrown for unknown chart type");
    });
});


// --- UIManager.js Tests (existing, ensure they are still valid) ---
describe('UIManager Tests', () => {
    it('parseColorCSS should return computed color', () => {
        mockStyleSheets['test-class'] = 'rgb(255, 0, 0)';
        const color = UIManager.parseColorCSS('test-class');
        assertEquals('rgb(255, 0, 0)', color, "parseColorCSS did not return expected color");
        delete mockStyleSheets['test-class'];
    });
    // ... other UIManager tests from previous state ...
});


// Function to be called to run all tests
function runAllTests() {
    testsPassed = 0;
    testsFailed = 0;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
       chrome.storage.local.clear();
    }
    mockStyleSheets = {};

    runTests();
}
