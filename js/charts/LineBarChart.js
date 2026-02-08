class LineBarChart extends BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings, settingsInstance = null) {
        super(transactions, categories, accountsSelected, settings, settingsInstance);
        this.chartInstance = null;
    }

    /**
     * Sélecteurs CSS utilisés par ce chart
     */
    static SELECTORS = {
        HOME_BLOCK: Config.SELECTORS.HOME_BLOCK,
        REFRESH_ICON: Config.SELECTORS.REFRESH_ICON
    };

    /**
     * Configure le bouton de rafraîchissement
     * @param {DataManager} dataManager - Instance du DataManager
     * @param {Settings} settingsInstance - Instance de Settings
     */
    static setupRefreshButton(dataManager, settingsInstance) {
        const refreshIcon = document.querySelector(LineBarChart.SELECTORS.REFRESH_ICON);
        if (refreshIcon) {
            refreshIcon.addEventListener("click", async () => {
                try {
                    const cacheObject = {
                        ['cache_data_transactions']: "",
                        ['cache_time_transactions']: ""
                    };
                    setTimeout(async () => {
                        try {
                            await settingsInstance.setSettings(cacheObject);
                            await dataManager.refreshData();
                        } catch (error) {
                            console.error("[LineBarChart] Error refreshing data:", error);
                            if (error.message && error.message.includes('Authentication')) {
                                console.error("[LineBarChart] Authentication not ready. Please wait a moment and try again.");
                            }
                        }
                    }, 1100);
                } catch (error) {
                    console.error("[LineBarChart] Error setting up refresh:", error);
                }
            });
        }
    }

    /**
     * Crée le conteneur principal pour le chart
     * @param {HTMLElement} homeBlock - Élément homeBlock parent
     * @returns {HTMLElement} Conteneur principal créé
     */
    static createMainContainer(homeBlock) {
        // Injecter les styles Pecunio
        InjectedStyles.inject();
        
        // Style pour enlever la limitation de largeur
        const style = document.createElement('style');
        style.innerHTML = `
            .homeBlock > div {
                max-width: none !important;
            }
        `;
        document.head.appendChild(style);
        homeBlock.innerHTML = "";

        // Container principal avec style Pecunio
        const mainContainer = document.createElement('div');
        InjectedStyles.applyContainerClasses(mainContainer);
        homeBlock.appendChild(mainContainer);

        return mainContainer;
    }

    /**
     * Crée le conteneur pour ce chart
     * @param {HTMLElement} parentContainer - Conteneur parent
     * @returns {HTMLElement} Conteneur créé
     */
    createContainer(parentContainer) {
        const container = document.createElement('div');
        container.id = "originalChartContainer";
        container.classList.add('pecunio-section');
        parentContainer.appendChild(container);
        return container;
    }

    /**
     * Crée et affiche le chart
     * @param {HTMLElement} container - Conteneur pour le chart
     * @returns {Promise<Chart>} Instance Chart.js créée
     */
    async render(container) {
        const preparedData = await this.prepareData();
        const chartJsConfig = await this.getChartJsConfig();
        chartJsConfig.data = preparedData;

        // Adapter l'axe X aux données réelles (pas de trou : min/max = plage des données)
        const allX = preparedData.datasets.flatMap(d => (d.data || []).map(p => p.x)).filter(Boolean);
        if (allX.length > 0 && chartJsConfig.options && chartJsConfig.options.scales && chartJsConfig.options.scales.x) {
            const minT = Math.min(...allX.map(x => new Date(x).getTime()));
            const maxT = Math.max(...allX.map(x => new Date(x).getTime()));
            chartJsConfig.options.scales.x.min = minT;
            chartJsConfig.options.scales.x.max = maxT;
        }
        // Titre ici pour éviter toute mutation dans le plugin (RangeError)
        const dates = preparedData.datasets.flatMap(d => (d.data || []).map(p => p.x)).filter(Boolean);
        if (dates.length > 0 && chartJsConfig.options && chartJsConfig.options.plugins && chartJsConfig.options.plugins.title) {
            const minD = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
            const maxD = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
            const monthCount = maxD.getMonth() - minD.getMonth() + 12 * (maxD.getFullYear() - minD.getFullYear());
            chartJsConfig.options.plugins.title.text = Config.isBlurry()
                ? 'Dépenses' : `Depense sur ${monthCount} mois`;
        }

        const canvas = InjectedStyles.createCanvas();
        canvas.classList.add("canvasDiv");
        container.appendChild(canvas);

        this.chartInstance = new Chart(canvas.getContext('2d'), chartJsConfig);
        if (this.settingsInstance) {
            this.chartInstance._settingsInstance = this.settingsInstance;
        }
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);
        return this.chartInstance;
    }

    async prepareData() {
        const filteredTransactions = await this.applySettingOnData();
        const transactionByCategory = this.mergeTransactionByCategoryLegacy(filteredTransactions, this.categories);
        return this.getDataFormated(this.categories, transactionByCategory, true);
    }

    async getDataFormated(categoryData, transactionByCategory, isCumulative = false) {
        const data = { datasets: [] };
        const settingsList = categoryData.map(category => category.name);
        const settings = await chrome.storage.local.get(settingsList);

        categoryData.forEach(category => {
            const transactions = transactionByCategory[parseInt(category.id)];
            
            // Vérifier que transactions existe et est un tableau avant d'appeler forEach
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                // Si pas de transactions pour cette catégorie, créer un dataset vide
                data.datasets.push({
                    label: category.name,
                    data: [],
                    backgroundColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    borderColor: ColorParser.parseColorCSS("categoryColor_" + category.id),
                    fill: false,
                    tension: 0.3,
                    hidden: settings[category.name]
                });
                return; // Passer à la catégorie suivante
            }
            
            const dateValueObject = [];
            const transactionObject = {};

            transactions.forEach(transaction => {
                // Utiliser la date ajustée qui tient compte de current_month
                const adjustedDate = this.getAdjustedDate(transaction);
                if (!adjustedDate) {
                    return; // Ignorer les transactions sans date valide
                }
                
                const month = `${adjustedDate.getMonth() + 1}`.padStart(2, "0");
                const year = adjustedDate.getUTCFullYear();
                const stringDate = [year, month].join("-");

                if (isCumulative) {
                    transactionObject[stringDate] = (transactionObject[stringDate] || 0) + transaction.amount;
                } else {
                    // Utiliser la date ajustée pour l'affichage
                    dateValueObject.push({ x: adjustedDate.toISOString().split('T')[0], y: transaction.amount, name: transaction.name });
                }
            });

            if (isCumulative) {
                for (const date in transactionObject) {
                    dateValueObject.push({ x: date, y: transactionObject[date] });
                }
            }

            const color = ColorParser.parseColorCSS("categoryColor_" + category.id);

            data.datasets.push({
                label: category.name,
                data: dateValueObject,
                backgroundColor: color,
                borderColor: color,
                fill: false,
                tension: 0.3,
                hidden: settings[category.name]
            });
        });

        return data;
    }


    async buildChart(formattedData) {
        const chartJsConfig = await this.getChartJsConfig();
        chartJsConfig.data = formattedData;

        const homeBlock = document.getElementsByClassName("homeBlock")[0];
        if (homeBlock) {
            homeBlock.innerHTML = "";
            const canvasDiv = createCanvasElement(homeBlock);
            const ctx = canvasDiv.getContext('2d');

            new Chart(ctx, chartJsConfig);
        }
    }

    /**
     * Retourne la configuration Chart.js standardisée
     * @returns {Promise<Object>} Configuration Chart.js avec type, data, options, plugins
     */
    async getChartJsConfig() {
        // Utiliser l'instance Settings injectée si disponible, sinon fallback sur chrome.storage
        let settings;
        if (this.settingsInstance) {
            await this.settingsInstance.waitForInitialization();
            settings = {
                startDate: this.settingsInstance.getSetting('startDate'),
                endDate: this.settingsInstance.getSetting('endDate'),
                chartType: this.settingsInstance.getSetting('chartType'),
                isBlurry: this.settingsInstance.getSetting(Config.STORAGE_KEYS.IS_BLURRY)
            };
        } else {
            settings = await chrome.storage.local.get(['startDate', 'endDate', 'chartType', Config.STORAGE_KEYS.IS_BLURRY]);
        }
        const initialChartType = settings.chartType ?? 'bar';
        const cummulative = initialChartType === "line" ? false : true;

        const commonConfig = {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: {
                        annotation: Config.CHART.ANNOTATION
                    }
                },
                title: {
                    display: true,
                    text: ""
                },
                legend: {
                    onClick: async function (evt, item) {
                        const currentVal = await chrome.storage.local.get([item.text]);
                        await chrome.storage.local.set({ [item.text]: !currentVal[item.text] });
                        Chart.defaults.plugins.legend.onClick.call(this, evt, item, this);
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (Config.isBlurry()) return context.dataset.label || '';
                            const label = context.dataset.label || '';
                            const value = context.parsed?.y ?? context.parsed;
                            return value != null ? `${label}: ${Number(value).toFixed(2)} €` : label;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            millisecond: 'HH:mm',
                            second: 'HH:mm',
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'dd MMM',
                            week: 'dd MMM',
                            month: 'MMM yyyy',
                            quarter: 'MMM yyyy',
                            year: 'yyyy'
                        },
                        tooltipFormat: 'MMM yyyy'
                    },
                    ticks: {
                        maxTicksLimit: 24
                    },
                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                    display: true,
                    stacked: true,
                    title: {
                        color: "#92cbdf",
                        display: false
                    }
                },
                y: {
                    display: true,
                    stacked: cummulative,
                    grid: {
                        color: "#e9f5f9",
                        borderColor: "#d3eaf2",
                        tickColor: "#e9f5f9"
                    },
                    ticks: {
                        callback: (value) => (Config.isBlurry() ? '' : value)
                    }
                }
            }
        };

        return {
            type: initialChartType,
            options: {
                ...commonConfig,
                plugins: {
                    ...commonConfig.plugins,
                    toggleTypeChart: {
                        display: true,
                    }
                }
            },
            plugins: [{
                id: 'toggleTypeChart',
                afterInit: function (chart) {
                    // Ajouter un event listener directement sur le canvas pour une meilleure fiabilité
                    const canvas = chart.canvas;
                    const legendWidth = 120;
                    const legendHeight = 20;
                    
                    const handleClick = async (event) => {
                        const rect = canvas.getBoundingClientRect();
                        const x = event.clientX - rect.left;
                        const y = event.clientY - rect.top;
                        
                        const withinLegendX = x >= 10 && x <= 10 + legendWidth;
                        const withinLegendY = y >= 10 && y <= 10 + legendHeight;

                        if (withinLegendX && withinLegendY) {
                            try {
                                const newChartType = chart.config.type === 'line' ? 'bar' : 'line';
                                
                                // Utiliser settingsInstance si disponible, sinon chrome.storage.local
                                if (chart._settingsInstance) {
                                    await chart._settingsInstance.setSetting('chartType', newChartType);
                                } else {
                                    await chrome.storage.local.set({ 'chartType': newChartType });
                                }
                                
                                // Déclencher un événement personnalisé pour notifier le changement
                                window.dispatchEvent(new CustomEvent('pecunio_chart_type_changed'));
                            } catch (error) {
                                console.error('[LineBarChart] Error toggling chart type:', error);
                            }
                        }
                    };
                    
                    // Ajouter l'event listener
                    canvas.addEventListener('click', handleClick);
                    
                    // Stocker la fonction de nettoyage pour pouvoir la supprimer si nécessaire
                    chart._toggleChartHandler = handleClick;
                },
                beforeDraw: function (chart) {
                    const canvas = chart.canvas;
                    const ctx = canvas.getContext('2d');
                    const legendWidth = 120;
                    const legendHeight = 20;
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.fillRect(10, 10, legendWidth, legendHeight);
                    ctx.fillStyle = 'black';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '12px Arial';
                    ctx.fillText('Toggle chart type', 10 + legendWidth / 2, 10 + legendHeight / 2);
                    ctx.restore();
                },
                beforeDestroy: function (chart) {
                    if (chart._toggleChartHandler && chart.canvas) {
                        chart.canvas.removeEventListener('click', chart._toggleChartHandler);
                        chart._toggleChartHandler = null;
                    }
                    if (chart._pecunioAmountVisibilityHandler) {
                        window.removeEventListener('pecunio_amounts_visibility_changed', chart._pecunioAmountVisibilityHandler);
                        chart._pecunioAmountVisibilityHandler = null;
                    }
                }
            }]
        };
    }
}
