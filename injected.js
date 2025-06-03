
// Original injected.js content starts here
const evt = new Evt();
const settingClass = new Settings();
const dataClass = new BankinData();

let setting = settingClass.getAllSetting();
let currentUrl = location.href;

evt.listen('data_loaded', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during data_loaded event:", error);
    }
});

evt.listen("settings_reloaded", () => {
    setting = settingClass.getAllSetting();
});

evt.listen('url_change', async () => {
    try {
        await build();
    } catch (error) {
        console.error("Error during url_change event:", error);
    }
});

setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        evt.dispatch('url_change');
    }
}, 1000); // Consider using other methods to detect URL changes

async function build() {
    evt.dispatch('build called');

    await settingClass.loadSettings();

    if (location.href === "https://app2.bankin.com/accounts") {
        loadingScreen(); // This might clear the space needed for the new chart if not handled
        setTimeout(() => { new Hidder() }, 500);

        const refreshIcon = document.querySelector(".refreshIcon");
        if (refreshIcon) { // Ensure refreshIcon exists
            refreshIcon.addEventListener("click", () => {
                let cacheObject = {
                    ['cache_data_transactions']: "",
                    ['cache_time_transactions']: ""
                };
                setTimeout(async () => {
                    await settingClass.setSettings(cacheObject);
                    new BankinData(); // This reloads data, might need to reload budget chart too
                }, 1100);
            });
        }

        // Existing chart logic
        const chartData = new ChartData(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), settingClass.getSetting('accountsSelected'), setting);
        const preparedData = await chartData.prepareData();
        
        // Modification: Create separate containers for charts
        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            console.log(`[InjectedJS] homeBlock clientWidth: ${homeBlock.clientWidth}px, offsetWidth: ${homeBlock.offsetWidth}px`);
            var style = document.createElement('style');
            style.innerHTML = `
                .homeBlock > div {
                    max-width: none !important;
                }
            `;
            document.head.appendChild(style);
            console.log('[InjectedJS] Applied user CSS override for .homeBlock > div max-width.');
            // const homeBlockStyles = window.getComputedStyle(homeBlock);
            // console.log(`[InjectedJS] homeBlock computed width: ${homeBlockStyles.width}, padding: ${homeBlockStyles.paddingLeft}/${homeBlockStyles.paddingRight}`);
            homeBlock.innerHTML = ""; // Clear existing content

            // Container for the original chart
            const originalChartContainer = document.createElement('div');
            originalChartContainer.id = "originalChartContainer";
            homeBlock.appendChild(originalChartContainer);
            const canvasOriginal = createCanvasElement(originalChartContainer); // createCanvasElement appends canvas
            const chartJsConfig = await chartData.getChartJsConfig();
            chartJsConfig.data = preparedData;
            new Chart(canvasOriginal.getContext('2d'), chartJsConfig);


            // Container for the new budget donut chart
            const budgetChartBlock = document.createElement('div');
            budgetChartBlock.id = "budgetChartBlock";
            budgetChartBlock.style.marginTop = "20px"; // Add some space
            budgetChartBlock.style.height = "500px"; // Explicit height for the container
            budgetChartBlock.style.width = '100%';    // NEW
            budgetChartBlock.style.display = 'block'; // NEW
            homeBlock.appendChild(budgetChartBlock);
            
            const budgetTitle = document.createElement('h3');
            budgetTitle.textContent = "Median Budget Comparison"; // New Title
            budgetChartBlock.appendChild(budgetTitle);

            // --- NEW SELECTORS START ---
            const selectorContainer = document.createElement('div');
            selectorContainer.id = 'medianChartSelectors'; // Keep main container ID for now
            selectorContainer.style.marginBottom = '15px';
            selectorContainer.style.marginTop = '10px';
            budgetChartBlock.appendChild(selectorContainer);

            const currentYr = new Date().getFullYear();
            const months = ["All Months", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            // Left Column (Primary)
            const leftColumnDiv = document.createElement('div');
            leftColumnDiv.style.marginBottom = '10px'; // Space between left and right columns

            const leftColumnTitle = document.createElement('strong');
            leftColumnTitle.textContent = 'Left Column (Primary)';
            leftColumnDiv.appendChild(leftColumnTitle);
            leftColumnDiv.appendChild(document.createElement('br'));

            const yearLabelLeft = document.createElement('label');
            yearLabelLeft.textContent = 'Year: ';
            yearLabelLeft.htmlFor = 'yearSelectorLeft';
            leftColumnDiv.appendChild(yearLabelLeft);
            const yearSelectorLeft = document.createElement('select');
            yearSelectorLeft.id = 'yearSelectorLeft';
            yearSelectorLeft.style.marginRight = '10px';
            for (let y = currentYr + 1; y >= 2015; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y;
                if (y === currentYr) option.selected = true;
                yearSelectorLeft.appendChild(option);
            }
            leftColumnDiv.appendChild(yearSelectorLeft);

            const monthLabelLeft = document.createElement('label');
            monthLabelLeft.textContent = 'Month: ';
            monthLabelLeft.htmlFor = 'monthSelectorLeft';
            leftColumnDiv.appendChild(monthLabelLeft);
            const monthSelectorLeft = document.createElement('select');
            monthSelectorLeft.id = 'monthSelectorLeft';
            months.forEach((monthName, index) => {
                const option = document.createElement('option');
                option.value = (index === 0) ? "ALL" : index;
                option.textContent = monthName;
                monthSelectorLeft.appendChild(option);
            });
            monthSelectorLeft.value = "ALL"; // Default
            leftColumnDiv.appendChild(monthSelectorLeft);
            selectorContainer.appendChild(leftColumnDiv);

            // Right Column (Comparison)
            const rightColumnDiv = document.createElement('div');
            rightColumnDiv.style.marginTop = '10px'; // Matches example
            rightColumnDiv.style.marginBottom = '10px'; // Space before calc type

            const rightColumnTitle = document.createElement('strong');
            rightColumnTitle.textContent = 'Right Column (Comparison)';
            rightColumnDiv.appendChild(rightColumnTitle);
            rightColumnDiv.appendChild(document.createElement('br'));

            const yearLabelRight = document.createElement('label');
            yearLabelRight.textContent = 'Year: ';
            yearLabelRight.htmlFor = 'yearSelectorRight';
            rightColumnDiv.appendChild(yearLabelRight);
            const yearSelectorRight = document.createElement('select');
            yearSelectorRight.id = 'yearSelectorRight';
            yearSelectorRight.style.marginRight = '10px';
            for (let y = currentYr + 1; y >= 2015; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y;
                if (y === currentYr - 1) option.selected = true; // Default to previous year
                yearSelectorRight.appendChild(option);
            }
            rightColumnDiv.appendChild(yearSelectorRight);

            const monthLabelRight = document.createElement('label');
            monthLabelRight.textContent = 'Month: ';
            monthLabelRight.htmlFor = 'monthSelectorRight';
            rightColumnDiv.appendChild(monthLabelRight);
            const monthSelectorRight = document.createElement('select');
            monthSelectorRight.id = 'monthSelectorRight';
            months.forEach((monthName, index) => {
                const option = document.createElement('option');
                option.value = (index === 0) ? "ALL" : index;
                option.textContent = monthName;
                monthSelectorRight.appendChild(option);
            });
            monthSelectorRight.value = "ALL"; // Default
            rightColumnDiv.appendChild(monthSelectorRight);
            selectorContainer.appendChild(rightColumnDiv);

            // Calculation Type Selector
            const calcDiv = document.createElement('div');
            calcDiv.style.marginTop = '10px'; // Matches example

            const calcLabel = document.createElement('label');
            calcLabel.textContent = 'Calculation: ';
            calcLabel.htmlFor = 'calculationTypeSelector';
            // calcLabel.style.marginLeft = '10px'; // Removed as it's on its own line now
            calcDiv.appendChild(calcLabel);

            const calcTypeSelector = document.createElement('select');
            calcTypeSelector.id = 'calculationTypeSelector';
            
            const optionMedian = document.createElement('option');
            optionMedian.value = 'median';
            optionMedian.textContent = 'Median';
            optionMedian.selected = true; // Default
            calcTypeSelector.appendChild(optionMedian);

            const optionAverage = document.createElement('option');
            optionAverage.value = 'average';
            optionAverage.textContent = 'Average';
            calcTypeSelector.appendChild(optionAverage);
            
            calcDiv.appendChild(calcTypeSelector);
            selectorContainer.appendChild(calcDiv);
            // --- NEW SELECTORS END ---

            // Remove old donut chart buttons if they were in budgetChartBlock
            const oldButtonContainer = budgetChartBlock.querySelector('div[style*="text-align: center"]'); 
            if (oldButtonContainer) {
                console.log('[InjectedJS] Removing old button container for donut chart.')
                oldButtonContainer.remove();
            }

            const budgetCanvas = createCanvasElement(budgetChartBlock); // createCanvasElement appends canvas
            console.log(`[InjectedJS] budgetChartBlock clientWidth: ${budgetChartBlock.clientWidth}px, offsetWidth: ${budgetChartBlock.offsetWidth}px`);
            if (budgetCanvas) { // budgetCanvas is the canvas element itself
                console.log(`[InjectedJS] budgetCanvas clientWidth: ${budgetCanvas.clientWidth}px, offsetWidth: ${budgetCanvas.offsetWidth}px, styled width: ${budgetCanvas.style.width}, styled height: ${budgetCanvas.style.height}`);
            }
            const budgetCtx = budgetCanvas.getContext('2d');

            const rawTransactionsForBudget = settingClass.getSetting('cache_data_transactions');
            console.log('[InjectedJS] build (accounts): Raw transactions for budget chart (length):', rawTransactionsForBudget ? rawTransactionsForBudget.length : 'null');
            // if (rawTransactionsForBudget && rawTransactionsForBudget.length > 0) console.log('[InjectedJS] build (accounts): Sample raw transaction for budget:', rawTransactionsForBudget[0]); // Verbose
            
            const categoriesForBudget = settingClass.getSetting('cache_data_categories');
            // console.log('[InjectedJS] build (accounts): Categories for budget chart (length):', categoriesForBudget ? categoriesForBudget.length : 'null'); // Verbose

            const accountsSelectedForBudget = settingClass.getSetting('accountsSelected');
            // console.log('[InjectedJS] build (accounts): AccountsSelected for budget chart:', accountsSelectedForBudget); // Can be sensitive or verbose

            const budgetChartDataInstance = new ChartDataBudget(
                rawTransactionsForBudget,
                categoriesForBudget,
                accountsSelectedForBudget,
                setting
            );

            let budgetChart = null; // Declare budgetChart here

            async function updateMedianChartView() {
                // Get new selector values
                const yearSelectorLeftElem = document.getElementById('yearSelectorLeft');
                const monthSelectorLeftElem = document.getElementById('monthSelectorLeft');
                const yearSelectorRightElem = document.getElementById('yearSelectorRight');
                const monthSelectorRightElem = document.getElementById('monthSelectorRight');
                const calculationTypeSelectorElem = document.getElementById('calculationTypeSelector');

                const selectedYearLeft = parseInt(yearSelectorLeftElem.value);
                const monthValueLeft = monthSelectorLeftElem.value;
                const selectedMonthLeft = (monthValueLeft === "ALL") ? "ALL" : parseInt(monthValueLeft);

                const selectedYearRight = parseInt(yearSelectorRightElem.value);
                const monthValueRight = monthSelectorRightElem.value;
                const selectedMonthRight = (monthValueRight === "ALL") ? "ALL" : parseInt(monthValueRight);

                const selectedCalcType = calculationTypeSelectorElem.value;

                console.log(`[InjectedJS] updateMedianChartView. Left: ${selectedYearLeft}/${selectedMonthLeft}, Right: ${selectedYearRight}/${selectedMonthRight}, CalcType: ${selectedCalcType}`);
                
                if (!budgetChartDataInstance || typeof budgetChartDataInstance.prepareData !== 'function') {
                    console.error('[InjectedJS] budgetChartDataInstance is not ready or prepareData is missing.');
                    return;
                }
                
                // Update prepareData call
                const newChartData = await budgetChartDataInstance.prepareData(selectedYearLeft, selectedMonthLeft, selectedYearRight, selectedMonthRight, selectedCalcType);
                // console.log('[InjectedJS] Data prepared for median bar chart:', JSON.stringify(newChartData)); // REMOVED - Too verbose

                if (!newChartData || !newChartData.labels || !newChartData.datasets || !Array.isArray(newChartData.datasets)) {
                    console.error('[InjectedJS] Invalid data structure received from prepareData for bar chart. Data:', newChartData);
                    if(budgetChart) {
                        budgetChart.data.labels = [];
                        budgetChart.data.datasets = [];
                        budgetChart.update();
                    }
                    return;
                }
                for(const dataset of newChartData.datasets) {
                    if (!Array.isArray(dataset.data)) {
                        console.error('[InjectedJS] Invalid dataset structure, missing data array:', dataset);
                        if(budgetChart) {
                           budgetChart.data.labels = [];
                           budgetChart.data.datasets = [];
                           budgetChart.update();
                        }
                        return;
                    }
                }

                if (budgetChart) {
                    // console.log('[InjectedJS] Updating existing median bar chart.'); // Retained, but less critical
                    budgetChart.data = newChartData;
                    // Update Chart Title Logic
                    const titleLeft = `${selectedYearLeft} ${monthValueLeft === "ALL" ? "All Months" : months[parseInt(monthValueLeft)]}`;
                    const titleRight = `${selectedYearRight} ${monthValueRight === "ALL" ? "All Months" : months[parseInt(monthValueRight)]}`;
                    budgetChart.options.plugins.title.text = `Budget: ${titleLeft} vs ${titleRight} (${selectedCalcType.charAt(0).toUpperCase() + selectedCalcType.slice(1)})`;
                    budgetChart.update();
                    // console.log('[InjectedJS] Median bar chart updated.'); // Retained, but less critical
                } else {
                    // console.log('[InjectedJS] Creating new median bar chart.'); // Retained
                    if (budgetChart) { // Defensive check
                       console.warn('[InjectedJS] budgetChart was not null before creation, destroying old instance.');
                       budgetChart.destroy(); 
                    }
                    // Update Chart Title Logic for new chart
                    const titleLeft = `${selectedYearLeft} ${monthValueLeft === "ALL" ? "All Months" : months[parseInt(monthValueLeft)]}`;
                    const titleRight = `${selectedYearRight} ${monthValueRight === "ALL" ? "All Months" : months[parseInt(monthValueRight)]}`;
                    const dynamicTitle = `Budget: ${titleLeft} vs ${titleRight} (${selectedCalcType.charAt(0).toUpperCase() + selectedCalcType.slice(1)})`;
                    try {
                        budgetChart = new Chart(budgetCtx, {
                            type: 'bar',
                            data: newChartData,
                            options: {
                                responsive: true,
                                maintainAspectRatio: false, // **** CHANGED TO FALSE ****
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: { 
                                            display: true,
                                            text: 'Amount (€)' 
                                        }
                                    },
                                    x: {
                                        title: {
                                            display: false, 
                                            text: 'Categories'
                                        }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                    },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                    },
                                    title: { // Add dynamic title to chart options
                                        display: true,
                                        text: dynamicTitle // Use the new dynamic title
                                    }
                                }
                            }
                        });
                        console.log('[InjectedJS] New median bar chart created successfully.');
                    } catch (error) {
                        console.error('[InjectedJS] Error creating new median bar chart:', error);
                        budgetChart = null; // Ensure budgetChart is null if creation failed
                    }
                }
            }

            // Add new listeners
            document.getElementById('yearSelectorLeft').addEventListener('change', updateMedianChartView);
            document.getElementById('monthSelectorLeft').addEventListener('change', updateMedianChartView);
            document.getElementById('yearSelectorRight').addEventListener('change', updateMedianChartView);
            document.getElementById('monthSelectorRight').addEventListener('change', updateMedianChartView);
            // The variable 'calcTypeSelector' from the DOM creation part is in scope and holds the correct element.
            calcTypeSelector.addEventListener('change', updateMedianChartView);

            // Initial call to load the chart with default selector values
            // Ensure this runs after the main DOM elements are presumably available.
            // Using a small timeout can help if elements are not immediately ready in some cases.
            // console.log('[InjectedJS] Scheduling initial call to updateMedianChartView.'); // Retained
            setTimeout(updateMedianChartView, 0); 

            // Extract known parent category names for the storage listener
            let knownCategoryNamesForVisibility = [];
            if (budgetChartDataInstance && budgetChartDataInstance.categories && Array.isArray(budgetChartDataInstance.categories)) {
                budgetChartDataInstance.categories.forEach(parentCat => {
                    if (parentCat && parentCat.name) {
                        knownCategoryNamesForVisibility.push(parentCat.name);
                    }
                });
                // console.log('[InjectedJS] Known parent category names for visibility checks:', knownCategoryNamesForVisibility);
            } else {
                console.warn('[InjectedJS] Could not retrieve known category names for storage listener setup from budgetChartDataInstance.categories.');
            }
            // Fallback or alternative: use categoryLookup keys if .categories isn't structured as expected or for broader coverage
            if (knownCategoryNamesForVisibility.length === 0 && budgetChartDataInstance && budgetChartDataInstance.categoryLookup) {
                 const uniqueNames = new Set(Array.from(budgetChartDataInstance.categoryLookup.values()));
                 knownCategoryNamesForVisibility = Array.from(uniqueNames);
                 // console.log('[InjectedJS] Using categoryLookup values for visibility checks:', knownCategoryNamesForVisibility);
            }


            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, areaName) => {
                    if (areaName === 'local') {
                        let relevantChangeDetected = false;
                        for (const key in changes) {
                            if (knownCategoryNamesForVisibility.includes(key)) {
                                // console.log(`[InjectedJS] Storage change detected for category '${key}':`, changes[key].newValue);
                                relevantChangeDetected = true;
                                break; 
                            }
                        }

                        if (relevantChangeDetected) {
                            console.log('[InjectedJS] Relevant category visibility changed in storage, calling updateMedianChartView.');
                            updateMedianChartView();
                        }
                    }
                });
                console.log('[InjectedJS] Added chrome.storage.onChanged listener for category visibility.');
            } else {
                console.warn('[InjectedJS] chrome.storage.onChanged not available. Live updates on legend click will not work.');
            }

        } else {
            console.error("[InjectedJS] homeBlock not found for account page charts."); // Added prefix for consistency
        }

    } else if (location.href === "https://app2.bankin.com/categories") {
        const menu = document.querySelector("#monthSelector");
        if (menu) {
            menu.addEventListener("click", () => {
                evt.dispatch('url_change');
            }, { once: true });
        }

        const dateChoosedElem = document.querySelector("#monthSelector .active .dib");
        if (dateChoosedElem) {
            const dateChoosed = dateChoosedElem.textContent.toLocaleLowerCase();
            const chartData2 = new ChartData2(settingClass.getSetting('cache_data_transactions'), settingClass.getSetting('cache_data_categories'), dateChoosed.split(" "));
            const preparedData = await chartData2.prepareData();

            let categBlock = document.getElementsByClassName("categoryChart");
            if (categBlock && categBlock[0]) {
                //categBlock[0].innerHTML = "";
                let canvasDiv = document.getElementsByClassName("canvasDiv")
                if (canvasDiv && canvasDiv.length > 0) {
                    for (let item of canvasDiv) {
                        item.remove()
                    }
                }
                canvasDiv = createCanvasElement(categBlock[0]);
                setTimeout(() => {
                    let h100 = document.querySelectorAll(".cntr.dtb.h100.active, .cntr.dtb.h100.notActive")
                    for (let item of h100) {
                        item.classList.remove("h100");
                    }
                }, 1000);

                const ctx = canvasDiv.getContext('2d');
                const myChart = new Chart(ctx, {
                    type: 'sankey',
                    data: {
                        datasets: [{
                            label: 'My Dataset',
                            data: preparedData,
                            colorFrom: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorTo: (c) => parseColorCSS("categoryColor_" + c.dataset.data[c.dataIndex].id),
                            colorMode: '',
                        }]
                    },
                    options: {
                        responsive: true,
                    }
                });
            }
        }
    }
}

function loadingScreen() {
    const rightBlock = document.getElementsByClassName("rightColumn");
    if (rightBlock && rightBlock[0]) {
        const childBlock = rightBlock[0].children;

        const imgdiv = document.createElement('img');
        imgdiv.src = chrome.runtime.getURL("asset/Loading.gif");
        imgdiv.style.textAlign = "center";

        if (childBlock && childBlock[0]) { // Check if childBlock[0] exists
            childBlock[0].innerHTML = "";
            childBlock[0].appendChild(imgdiv);
        } else {
            console.error("childBlock[0] not found in loadingScreen");
        }
    }
    evt.dispatch('loading_sreen_display');
}

function createCanvasElement(parentElement) {
    const canvasDiv = document.createElement('canvas');
    canvasDiv.classList = "canvasDiv"; // Keep class if it has other relevant styles
    canvasDiv.style.width = '100%';   // Ensure canvas tries to use full width of parent
    canvasDiv.style.height = '400px';  // Set a default height
    if (parentElement) {
        parentElement.appendChild(canvasDiv);
    }

    return canvasDiv;
}

const annotation = {
    type: 'line',
    borderColor: 'black',
    borderDash: [6, 6],
    borderDashOffset: 0,
    borderWidth: 3,
    label: {
        enabled: true,
        content: (ctx) => 'Average: ' + average(ctx).toFixed(2),
        position: 'end'
    },
    scaleID: 'y',
    value: (ctx) => average(ctx)
};

function average(ctx) {
    const values = ctx.chart.data.datasets[0].data;
    return values.reduce((a, b) => a + b, 0) / values.length;
};

function parseColorCSS(strClass) {
    const styleElement = document.createElement("div");
    styleElement.className = strClass;
    document.body.appendChild(styleElement);

    const colorVal = window.getComputedStyle(styleElement).backgroundColor;
    styleElement.remove();

    return colorVal;
}