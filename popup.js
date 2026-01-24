// Les classes Category, Account, Transaction et DataMerger ont été extraites dans des fichiers séparés
// Voir js/models/ et js/services/ pour les implémentations

const evt = new Evt();
const settingClass = new Settings();
let setting = {};

evt.listen("settings_reloaded", async () => {
    await settingClass.waitForInitialization();
    setting = settingClass.getAllSettings();
});


document.addEventListener('DOMContentLoaded', async function () {

    // Attendre l'initialisation complète des settings
    await settingClass.waitForInitialization();
    await settingClass.loadSettings();

    let currentVersionImg = document.querySelector("#currentVersion");
    let currentVersionBadge = document.querySelector("#currentVersionBadge");
    let cvSource = "https://img.shields.io/badge/installed-" + chrome.runtime.getManifest().version + "-blue";
    currentVersionImg.textContent = chrome.runtime.getManifest().version;
    currentVersionBadge.src = cvSource;

    let startDate = document.querySelector('#startDate');
    let endDate = document.querySelector('#endDate');
    let noEndDateCheckbox = document.querySelector('#noEndDate');
    let accountsInput = document.querySelector('#accountsInput');
    let csvExport = document.querySelector("#exportCsv");
    let refreshData = document.querySelector("#refreshData");
    let refreshSettings = document.querySelector("#refreshSettings");

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
    });

    chrome.storage.local.get(['cache_data_accounts', 'accountsSelected'], function (data) {
        let { cache_data_accounts, accountsSelected } = data;

        if (cache_data_accounts) {
            if (!accountsSelected) {
                accountsSelected = cache_data_accounts.map(account => account.id);
                chrome.storage.local.set({ accountsSelected: accountsSelected });
            }

            accountsInput.innerHTML = '';
            cache_data_accounts.forEach(account => {
                let checked = accountsSelected.includes(account.id)
                const option = new Option(account.name, account.id, checked, checked);

                accountsInput.add(option);
            });

            const choices = new Choices(accountsInput, {
                removeItemButton: true,   // Allows users to remove selected items
                placeholder: false,        // Enable placeholder
                searchEnabled: true,      // Enable search within the dropdown
                shouldSort: true,        // Disable sorting of options
            });
        }
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

    // Réinitialiser uniquement les données (cache)
    refreshData.addEventListener('click', function () {
        const cacheKeys = [
            'cache_data_transactions',
            'cache_time_transactions',
            'cache_data_categories',
            'cache_time_categories',
            'cache_data_accounts',
            'cache_time_accounts'
        ];
        
        chrome.storage.local.remove(cacheKeys, function () {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
                alert('Erreur lors de la réinitialisation des données: ' + error.message);
            } else {
                console.log("Données réinitialisées");
                evt.dispatch('url_change');
                alert('Les données ont été réinitialisées avec succès. Les paramètres ont été conservés.');
            }
        });
    });

    // Réinitialiser uniquement les paramètres utilisateur
    refreshSettings.addEventListener('click', function () {
        if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous vos paramètres ? Les données seront conservées.')) {
            return;
        }
        
        const settingsKeys = [
            'startDate',
            'endDate',
            'accounts',
            'accountsSelected',
            'isBlurry',
            'noEndDate'
        ];
        
        chrome.storage.local.remove(settingsKeys, function () {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
                alert('Erreur lors de la réinitialisation des paramètres: ' + error.message);
            } else {
                console.log("Paramètres réinitialisés");
                // Recharger la page pour appliquer les changements
                window.location.reload();
            }
        });
    });
});
