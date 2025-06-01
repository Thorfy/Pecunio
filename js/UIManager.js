class UIManager { // Renamed from DomManipulator
    static createCanvasElement(parent) {
        const canvasDiv = document.createElement('canvas');
        parent.appendChild(canvasDiv);
        return canvasDiv;
    }

    static loadingScreen(parent) {
        // Ensure parent exists before manipulating
        if (!parent) {
            // console.warn("UIManager.loadingScreen: Parent element is null or undefined.");
            // Attempt to find a default parent or log an error
            parent = document.body; // Fallback, or handle error appropriately
            if(!parent) {
                console.error("UIManager.loadingScreen: Parent element not found and document.body is not available.");
                return null;
            }
        }

        // Clear previous loading screens from this parent if any
        const existingLoadingScreens = parent.querySelectorAll('.loading-screen');
        existingLoadingScreens.forEach(screen => screen.remove());

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-screen';
        loadingDiv.textContent = 'Loading...';
        // Custom styles for visibility - this should be in CSS ideally
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.padding = '20px';
        loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.borderRadius = '5px';
        loadingDiv.style.zIndex = '10000'; // Ensure it's on top

        parent.appendChild(loadingDiv);
        return loadingDiv;
    }

    static hideLoadingScreen(loadingDivInstance) {
        if (loadingDivInstance && loadingDivInstance.parentNode) {
            loadingDivInstance.remove();
        } else {
            // Fallback if specific instance not passed: remove all
            const screens = document.querySelectorAll('.loading-screen');
            screens.forEach(screen => screen.remove());
        }
    }


    static parseColorCSS(strClass) {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            // console.warn("UIManager.parseColorCSS: DOM environment not available.");
            return 'rgb(0,0,0)'; // Fallback color
        }
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);
        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();
        return colorVal || 'rgb(0,0,0)'; // Ensure a value is returned
    }

    static createDonutChartContainer(year, parentElement) {
        if (typeof document === 'undefined') {
            // console.warn("UIManager.createDonutChartContainer: DOM environment not available.");
            return null;
        }
        const containerId = `donut-chart-container-${year}`;
        let containerDiv = document.getElementById(containerId);

        if (!containerDiv) {
            containerDiv = document.createElement('div');
            containerDiv.id = containerId;
            containerDiv.className = 'donut-container'; // For styling donut groups
            // Optional: Add a title for the year group
            const yearTitle = document.createElement('h4');
            yearTitle.textContent = `Année ${year}`;
            yearTitle.style.textAlign = 'center'; // Basic styling
            containerDiv.appendChild(yearTitle);
            parentElement.appendChild(containerDiv);
        } else {
            // Clear previous canvas if container exists to avoid multiple canvases for the same year on re-renders
            const oldCanvas = containerDiv.querySelector(`canvas#donut-chart-canvas-${year}`);
            if(oldCanvas) oldCanvas.remove();
        }

        const canvasId = `donut-chart-canvas-${year}`;
        const canvasElement = document.createElement('canvas');
        canvasElement.id = canvasId;
        // Optional: set a fixed size or use CSS
        // canvasElement.style.maxWidth = '400px';
        // canvasElement.style.maxHeight = '400px';
        // canvasElement.style.margin = 'auto'; // Center if smaller than container
        containerDiv.appendChild(canvasElement);

        return canvasElement;
    }

    static buildChart(ChartConstructor, chartConfig, canvasElement) {
        if (!canvasElement) {
            console.error("UIManager.buildChart: canvasElement is null or undefined.");
            return null;
        }
        // Check if a chart instance already exists on this canvas
        let existingChart = Chart.getChart(canvasElement);
        if (existingChart) {
            existingChart.destroy(); // Destroy existing chart before creating a new one
        }

        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            console.error("UIManager.buildChart: Failed to get 2D context from canvasElement.");
            return null;
        }
        return new ChartConstructor(ctx, chartConfig);
    }

    // New methods for Part A

    static async displayMainLineBarChart(lineBarProcessor, parentElementSelector) {
        const parentElement = document.querySelector(parentElementSelector) || document.getElementsByClassName(parentElementSelector)[0];
        if (!parentElement) {
            console.error(`UIManager.displayMainLineBarChart: Parent element "${parentElementSelector}" not found.`);
            return;
        }
        parentElement.innerHTML = ""; // Clear parent container

        const processedData = await lineBarProcessor.prepareData();
        if (!processedData || !processedData.datasets || processedData.datasets.length === 0 || processedData.datasets.every(ds => ds.data.length === 0)) {
            console.log("UIManager.displayMainLineBarChart: No data to display after processing.");
            parentElement.innerHTML = "<p>Pas de données disponibles pour le graphique principal.</p>"; // User feedback
            return;
        }

        const chartConfig = await lineBarProcessor.getChartConfig(processedData); // getChartConfig can be async now
        const canvasElement = UIManager.createCanvasElement(parentElement);
        canvasElement.id = "mainLineBarChartCanvas";
        UIManager.buildChart(Chart, chartConfig, canvasElement); // Chart is window.Chart
    }

    static async displayYearlyDonutCharts(dataService, chartFactory, parentElementSelector) {
        const parentElement = document.querySelector(parentElementSelector) || document.getElementsByClassName(parentElementSelector)[0];
        if (!parentElement) {
            console.error(`UIManager.displayYearlyDonutCharts: Parent element "${parentElementSelector}" not found.`);
            return;
        }
        // Note: The main line/bar chart clears parentElement.innerHTML.
        // If donuts are in the same parent, this method should be called after,
        // or donuts need their own dedicated parent outside this one.
        // For now, assuming they append to the same parent, after it has been cleared by main chart.

        const allTransactions = dataService.getAllTransactions(true); // Get all transactions with processed dates
        if (!allTransactions || allTransactions.length === 0) {
            console.log("UIManager.displayYearlyDonutCharts: No transactions available to generate donut charts.");
            return;
        }

        const years = [...new Set(allTransactions.map(t => {
            const dateToUse = t.effectiveDate ? new Date(t.effectiveDate) : new Date(t.date);
            return dateToUse.getUTCFullYear();
        }))].sort((a, b) => b - a); // Recent years first

        if (years.length === 0) {
            console.log("UIManager.displayYearlyDonutCharts: No years found in transactions.");
            return;
        }

        for (const year of years) {
            const donutProcessor = chartFactory.createProcessor('donut', dataService, { year: year });
            const processedData = await donutProcessor.prepareData();

            if (processedData && processedData.datasets && processedData.datasets[0].data.length > 0) {
                const chartConfig = donutProcessor.getChartConfig(processedData);
                const donutCanvas = UIManager.createDonutChartContainer(year, parentElement); // This creates a sub-container + canvas
                if (donutCanvas) {
                    UIManager.buildChart(Chart, chartConfig, donutCanvas);
                }
            } else {
                // console.log(`UIManager.displayYearlyDonutCharts: No data for year ${year}.`);
            }
        }
    }

    static async displaySankeyChart(sankeyProcessor, parentElementSelector) {
        const parentElement = document.querySelector(parentElementSelector) || document.getElementsByClassName(parentElementSelector)[0];
        if (!parentElement) {
            console.error(`UIManager.displaySankeyChart: Parent element "${parentElementSelector}" not found.`);
            return;
        }

        // Clear previous Sankey chart(s) inside this specific parent
        // The old code removed any element with class "canvasDiv"
        const existingCanvases = parentElement.querySelectorAll(".canvasDiv"); // Assuming Sankey canvas has this class
        existingCanvases.forEach(cv => cv.remove());
        // Or, if parentElement should only contain this chart: parentElement.innerHTML = "";

        const processedData = await sankeyProcessor.prepareData();
        if (!processedData || processedData.length === 0) { // Sankey data is an array of flows
            console.log("UIManager.displaySankeyChart: No data to display after processing.");
            parentElement.innerHTML = "<p>Pas de données disponibles pour le graphique Sankey.</p>";
            return;
        }

        const chartConfig = sankeyProcessor.getChartConfig(processedData);
        const canvasElement = UIManager.createCanvasElement(parentElement);
        canvasElement.classList.add("canvasDiv"); // Add class as in original injected.js

        UIManager.buildChart(Chart, chartConfig, canvasElement);

        // Handle h100 class removal (from original injected.js)
        // This was for specific Bankin page styling quirks.
        setTimeout(() => {
            const h100Elements = document.querySelectorAll(".cntr.dtb.h100.active, .cntr.dtb.h100.notActive");
            h100Elements.forEach(item => item.classList.remove("h100"));
        }, 1000);
    }
}
