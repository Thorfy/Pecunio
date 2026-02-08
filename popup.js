// Les classes Category, Account, Transaction et DataMerger ont été extraites dans des fichiers séparés
// Voir js/models/ et js/services/ pour les implémentations

const evt = new Evt();
const settingClass = new Settings();
let setting = {};

evt.listen("settings_reloaded", () => {
    // Pas besoin d'attendre, les settings sont déjà chargés
    setting = settingClass.getAllSettings();
});


document.addEventListener('DOMContentLoaded', async function () {

    // Attendre l'initialisation (qui inclut déjà loadSettings())
    await settingClass.waitForInitialization();
    setting = settingClass.getAllSettings();

    let currentVersionImg = document.querySelector("#currentVersion");
    let currentVersionBadge = document.querySelector("#currentVersionBadge");
    let cvSource = "https://img.shields.io/badge/installed-" + chrome.runtime.getManifest().version + "-blue";
    currentVersionImg.textContent = chrome.runtime.getManifest().version;
    currentVersionBadge.src = cvSource;

    // Retirer le badge si présent (l'utilisateur a ouvert la popup)
    chrome.action.setBadgeText({ text: '' });

    // Récupérer les éléments DOM
    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let noEndDateCheckbox = document.querySelector('#noEndDate');
    let accountsInput = document.querySelector('#accountsInput');
    let csvExport = document.querySelector("#exportCsv");
    let exportPdf = document.querySelector("#exportPdf");
    let pdfYear = document.querySelector("#pdfYear");
    let pdfMonth = document.querySelector("#pdfMonth");
    let refreshData = document.querySelector("#refreshData");
    let refreshSettings = document.querySelector("#refreshSettings");

    const PDF_MONTHS = ['Toute l\'année', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    function fillPdfYearSelect(transactions) {
        const currentYear = new Date().getFullYear();
        let minYear = currentYear - 10;
        let defaultYear = currentYear;
        if (transactions && transactions.length > 0) {
            const years = transactions.map(t => new Date(t.date).getFullYear());
            minYear = Math.min(minYear, Math.min(...years));
            defaultYear = Math.max(...years);
        }
        minYear = Math.max(2015, minYear);
        pdfYear.innerHTML = '';
        for (let y = currentYear; y >= minYear; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === defaultYear) opt.selected = true;
            pdfYear.appendChild(opt);
        }
    }

    function fillPdfMonthSelect() {
        pdfMonth.innerHTML = '';
        PDF_MONTHS.forEach((label, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = label;
            if (index === 0) opt.selected = true;
            pdfMonth.appendChild(opt);
        });
    }

    // Fonction pour charger les dates
    function loadDates(startDate, endDate, noEndDateCheckbox) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['startDate', 'endDate', 'cache_data_transactions', 'noEndDate'], function (data) {
        let startDateValue = data.startDate;
        let endDateValue = data.endDate;
        let noEndDateValue = data.noEndDate || false;
        
        // Si pas de date de fin définie, utiliser aujourd'hui
        if (!endDateValue) {
            const today = new Date();
            endDateValue = today.toISOString().split('T')[0];
            chrome.storage.local.set({ endDate: endDateValue });
        }
        
        // Si pas de date de début définie, calculer la plus ancienne date disponible
        if (!startDateValue) {
            if (data.cache_data_transactions && data.cache_data_transactions.length > 0) {
                // Trouver la date la plus ancienne parmi les transactions
                const oldestDate = data.cache_data_transactions
                    .map(t => new Date(t.date))
                    .reduce((oldest, current) => current < oldest ? current : oldest);
                startDateValue = oldestDate.toISOString().split('T')[0];
            } else {
                // Fallback: 1 an en arrière
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                startDateValue = oneYearAgo.toISOString().split('T')[0];
            }
            chrome.storage.local.set({ startDate: startDateValue });
        }
        
        startDate.value = startDateValue;
        endDate.value = endDateValue;
        noEndDateCheckbox.checked = noEndDateValue;
        
        // Désactiver/activer le champ endDate selon la checkbox
        endDate.disabled = noEndDateValue;
        
        console.log('[Popup] Date range initialized:', startDateValue, 'to', endDateValue, 'noEndDate:', noEndDateValue);
        resolve();
            });
        });
    }

    // Variable pour stocker l'instance Choices
    let choicesInstance = null;

    // Fonction pour charger et afficher les comptes
    async function loadAccounts() {
        const cache_data_accounts = settingClass.getSetting('cache_data_accounts');
        let accountsSelected = settingClass.getSetting('accountsSelected');

        if (cache_data_accounts && Array.isArray(cache_data_accounts) && cache_data_accounts.length > 0) {
            if (!accountsSelected || !Array.isArray(accountsSelected)) {
                accountsSelected = cache_data_accounts.map(account => account.id);
                await settingClass.setSetting('accountsSelected', accountsSelected);
            }

            // Si Choices est déjà initialisé, le détruire avant de recréer
            if (choicesInstance) {
                try {
                    choicesInstance.destroy();
                } catch (e) {
                    console.warn('[Popup] Error destroying Choices instance:', e);
                }
                choicesInstance = null;
            }

            // Réinitialiser le select
            accountsInput.innerHTML = '';
            cache_data_accounts.forEach(account => {
                let checked = accountsSelected.includes(account.id);
                const option = new Option(account.name, account.id, checked, checked);
                accountsInput.add(option);
            });

            // Initialiser Choices
            choicesInstance = new Choices(accountsInput, {
                removeItemButton: true,
                placeholder: false,
                searchEnabled: true,
                shouldSort: true,
            });

            console.log('[Popup] Accounts loaded:', cache_data_accounts.length);
        } else {
            console.warn('[Popup] No accounts found in cache. Available settings:', Object.keys(settingClass.getAllSettings()));
        }
    }

    // Charger les dates, vérifier l'épinglage et charger les comptes en parallèle
    await Promise.all([
        loadDates(startDate, endDate, noEndDateCheckbox),
        checkAndShowPinInstructions()
    ]);

    // Charger les comptes après (nécessite que les settings soient chargés)
    await loadAccounts();

    fillPdfMonthSelect();
    const cacheTx = settingClass.getSetting('cache_data_transactions');
    fillPdfYearSelect(cacheTx || []);

    // Recharger les comptes quand les settings sont mis à jour
    evt.listen('settings_reloaded', async () => {
        await loadAccounts();
    });

    // Recharger les comptes quand ils sont chargés depuis le cache ou l'API
    evt.listen('cache_data_accounts_loaded', async () => {
        console.log('[Popup] Accounts cache loaded event received');
        await loadAccounts();
    });

    evt.listen('data_loaded', async () => {
        console.log('[Popup] Data loaded event received');
        await loadAccounts();
        const tx = settingClass.getSetting('cache_data_transactions');
        if (tx && tx.length) fillPdfYearSelect(tx);
    });

    accountsInput.addEventListener('change', function () {
        const selectedOptions = Array.from(this.selectedOptions).map(option => parseInt(option.value));
        chrome.storage.local.set({ accountsSelected: selectedOptions });
    });

    // Event listener pour la checkbox "pas de date de fin"
    noEndDateCheckbox.addEventListener('change', function () {
        endDate.disabled = this.checked;
        chrome.storage.local.set({ noEndDate: this.checked });
        
        // Si activé, mettre à jour la date de fin à aujourd'hui
        if (this.checked) {
            const today = new Date();
            endDate.value = today.toISOString().split('T')[0];
            chrome.storage.local.set({ endDate: endDate.value });
        }
    });
    
    let inputs = [startDate, endDate];
    for (const input of inputs) {
        input.addEventListener('blur', function () {
            chrome.storage.local.set({ [this.id]: this.value });
        });
    }

    // Load data
    csvExport.addEventListener('click', async function () {
        try {
            chrome.storage.local.get(['cache_data_transactions', 'cache_data_categories', 'cache_data_accounts', 'accountsSelected'], function (data) {
                if (typeof DataMerger === 'undefined') {
                    console.error('DataMerger class not available');
                    alert('Erreur: Impossible de charger les données. Veuillez recharger l\'extension.');
                    return;
                }
                
                // Debug: Afficher les données disponibles
                console.log('=== DEBUG CSV EXPORT ===');
                console.log('Transactions:', data.cache_data_transactions?.length || 0);
                console.log('Categories:', data.cache_data_categories?.length || 0);
                console.log('Accounts:', data.cache_data_accounts?.length || 0);
                console.log('Accounts Selected:', data.accountsSelected);
                console.log('Start Date:', startDate.value);
                console.log('End Date:', endDate.value);
                console.log('No End Date Checked:', noEndDateCheckbox.checked);
                if (noEndDateCheckbox.checked) {
                    const today = new Date();
                    const effectiveEndDate = today.toISOString().split('T')[0];
                    console.log('Effective End Date (today):', effectiveEndDate);
                }
                
                if (!data.cache_data_transactions || data.cache_data_transactions.length === 0) {
                    alert('Aucune donnée de transaction disponible. Veuillez d\'abord charger des données depuis Bankin.');
                    return;
                }
                
                // Déterminer la date de fin à utiliser
                let effectiveEndDate = endDate.value;
                if (noEndDateCheckbox.checked) {
                    // Si "pas de date de fin" est coché, utiliser aujourd'hui
                    const today = new Date();
                    effectiveEndDate = today.toISOString().split('T')[0];
                }
                
                const dataMerger = new DataMerger(data.cache_data_transactions, data.cache_data_categories, data.cache_data_accounts, startDate.value, effectiveEndDate, data.accountsSelected);
                
                // Debug: Vérifier les données fusionnées
                const mergedData = dataMerger.mergeData();
                console.log('Merged Data Length:', mergedData.length);
                console.log('Sample Merged Data:', mergedData.slice(0, 2));
                
                if (mergedData.length === 0) {
                    alert('Aucune transaction trouvée pour la période sélectionnée. Vérifiez vos dates et comptes sélectionnés.');
                    return;
                }
                
                dataMerger.exportToCSV();
            });
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Erreur lors de l\'export CSV: ' + error.message);
        }
    });

    // Générer rapport PDF : période = Année + Mois (sélecteurs décroissants)
    exportPdf.addEventListener('click', async function () {
        try {
            const year = parseInt(pdfYear.value, 10);
            const monthIndex = parseInt(pdfMonth.value, 10);
            let reportStartDate, reportEndDate;
            if (monthIndex === 0) {
                reportStartDate = `${year}-01-01`;
                const end = year === new Date().getFullYear() ? new Date() : new Date(year, 11, 31);
                reportEndDate = end.toISOString().split('T')[0];
            } else {
                reportStartDate = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
                const lastDay = new Date(year, monthIndex, 0);
                reportEndDate = lastDay.toISOString().split('T')[0];
            }
            chrome.storage.local.get(['cache_data_transactions', 'cache_data_categories', 'cache_data_accounts', 'accountsSelected'], async function (data) {
                if (typeof DataMerger === 'undefined') {
                    alert('Erreur: Impossible de charger les données. Veuillez recharger l\'extension.');
                    return;
                }
                if (!data.cache_data_transactions || data.cache_data_transactions.length === 0) {
                    alert('Aucune donnée de transaction disponible. Veuillez d\'abord charger des données depuis Bankin.');
                    return;
                }
                let dataMerger = new DataMerger(data.cache_data_transactions, data.cache_data_categories, data.cache_data_accounts, reportStartDate, reportEndDate, data.accountsSelected);
                let mergedData = dataMerger.mergeData();
                let usedStartDate = reportStartDate;
                let usedEndDate = reportEndDate;
                let usedPdfYear = year;
                let usedPdfMonthIndex = monthIndex;
                if (mergedData.length === 0) {
                    const fallbackStart = startDate.value;
                    let fallbackEnd = endDate.value;
                    if (noEndDateCheckbox.checked) {
                        const today = new Date();
                        fallbackEnd = today.toISOString().split('T')[0];
                    }
                    dataMerger = new DataMerger(data.cache_data_transactions, data.cache_data_categories, data.cache_data_accounts, fallbackStart, fallbackEnd, data.accountsSelected);
                    mergedData = dataMerger.mergeData();
                    usedStartDate = fallbackStart;
                    usedEndDate = fallbackEnd;
                    usedPdfYear = null;
                    usedPdfMonthIndex = null;
                }
                if (mergedData.length === 0) {
                    alert('Aucune transaction trouvée pour la période sélectionnée ni pour la période d\'export. Vérifiez les dates et les comptes sélectionnés.');
                    return;
                }
                const stats = dataMerger.getStats();
                const accountNames = (data.cache_data_accounts || [])
                    .filter(a => (data.accountsSelected || []).includes(a.id))
                    .map(a => a.name)
                    .join(', ') || 'Tous les comptes';
                const exceptionCategoryIds = typeof Config !== 'undefined' && Config.CATEGORIES && Array.isArray(Config.CATEGORIES.EXCEPTION_IDS)
                    ? Config.CATEGORIES.EXCEPTION_IDS
                    : [326, 282];
                const params = {
                    startDate: usedStartDate,
                    endDate: usedEndDate,
                    accountNames: accountNames,
                    pdfYear: usedPdfYear,
                    pdfMonthIndex: usedPdfMonthIndex != null ? usedPdfMonthIndex : 0,
                    pdfMonthLabel: usedPdfMonthIndex != null ? PDF_MONTHS[usedPdfMonthIndex] : 'Toute l\'année',
                    exceptionCategoryIds: exceptionCategoryIds
                };
                await ReportStorage.saveReportData(mergedData, stats, params);
                chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
            });
        } catch (error) {
            console.error('Error preparing PDF report:', error);
            alert('Erreur lors de la préparation du rapport PDF: ' + error.message);
        }
    });

    // Réinitialiser uniquement les données (cache)
    refreshData.addEventListener('click', async function () {
        const cacheKeys = [
            'cache_data_transactions',
            'cache_time_transactions',
            'cache_data_categories',
            'cache_time_categories'
            // Note: cache_data_accounts et cache_time_accounts sont gérés par refreshSettings
        ];
        
        try {
            await settingClass.waitForInitialization();
            
            // Supprimer chaque cache
            for (const key of cacheKeys) {
                await settingClass.removeSetting(key);
            }
            
            console.log('[Popup] Données (caches) réinitialisées avec succès');
            evt.dispatch('url_change');
            alert('Les données ont été réinitialisées avec succès. Les paramètres ont été conservés.');
        } catch (error) {
            console.error('[Popup] Erreur lors de la réinitialisation des données:', error);
            alert('Erreur lors de la réinitialisation des données: ' + error.message);
        }
    });

    // Réinitialiser uniquement les paramètres utilisateur
    refreshSettings.addEventListener('click', async function () {
        if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous vos paramètres ? Les données seront conservées.')) {
            return;
        }
        
        // Récupérer tous les noms de paramètres depuis Settings
        // Exclure les caches de transactions et catégories (qui sont gérés par refreshData)
        const cacheKeys = [
            'cache_data_transactions',
            'cache_time_transactions',
            'cache_data_categories',
            'cache_time_categories'
            // Note: cache_data_accounts et cache_time_accounts sont supprimés avec les paramètres
        ];
        
        // Liste complète des paramètres utilisateur à supprimer
        const settingsKeys = Settings.ALL_SETTING_NAMES
            .filter(key => !cacheKeys.includes(key)) // Exclure uniquement les caches de transactions/catégories
            .concat(['noEndDate']); // Ajouter noEndDate qui n'est pas dans ALL_SETTING_NAMES
        
        console.log('[Popup] Suppression des paramètres:', settingsKeys);
        
        try {
            await settingClass.waitForInitialization();
            
            // Supprimer chaque paramètre
            for (const key of settingsKeys) {
                await settingClass.removeSetting(key);
            }
            
            console.log('[Popup] Paramètres réinitialisés avec succès');
            
            // Recharger la page pour appliquer les changements
            window.location.reload();
        } catch (error) {
            console.error('[Popup] Erreur lors de la réinitialisation des paramètres:', error);
            alert('Erreur lors de la réinitialisation des paramètres: ' + error.message);
        }
    });
});

/**
 * Vérifie si l'extension est épinglée à la barre d'outils et affiche les instructions si nécessaire
 */
async function checkAndShowPinInstructions() {
    try {
        const pinInstructionsSection = document.querySelector('#pinInstructionsSection');
        
        if (!pinInstructionsSection) {
            console.warn('[Popup] Section d\'instructions d\'épinglage non trouvée');
            return;
        }

        // Fonction pour vérifier et mettre à jour l'affichage
        const updatePinInstructions = async () => {
            try {
                const userSettings = await chrome.action.getUserSettings();
                const isPinned = userSettings.isOnToolbar;

                if (!isPinned) {
                    // Afficher les instructions si pas épinglée
                    pinInstructionsSection.style.display = 'block';
                } else {
                    // Masquer les instructions si épinglée
                    pinInstructionsSection.style.display = 'none';
                }
            } catch (error) {
                // Si l'API n'est pas disponible (ancienne version de Chrome), ne rien afficher
                console.log('[Popup] Impossible de vérifier l\'état d\'épinglage:', error);
                pinInstructionsSection.style.display = 'none';
            }
        };

        // Vérifier immédiatement
        await updatePinInstructions();

        // Vérifier périodiquement si l'extension est maintenant épinglée
        // (pour masquer automatiquement les instructions si l'utilisateur épingle)
        const checkInterval = setInterval(async () => {
            await updatePinInstructions();
        }, 2000); // Vérifier toutes les 2 secondes

        // Nettoyer l'intervalle quand la popup est fermée
        window.addEventListener('beforeunload', () => {
            clearInterval(checkInterval);
        });

    } catch (error) {
        console.error('[Popup] Erreur lors de la vérification de l\'épinglage:', error);
    }
}
