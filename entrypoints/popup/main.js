import { CacheStore } from '../../js/core/CacheStore.js';
import { Config } from '../../js/core/Config.js';
import { DateRange } from '../../js/core/DateRange.js';
import { evt } from '../../js/core/events.js';
import { Logger } from '../../js/core/Logger.js';
import { Settings } from '../../js/core/Settings.js';
import { DataMerger } from '../../js/services/DataMerger.js';
import { ReportStorage } from '../../js/services/ReportStorage.js';
import Choices from 'choices.js';
import 'choices.js/public/assets/styles/choices.min.css';

// Popup de l'extension : période, comptes, export CSV et rapport PDF.

const settingClass = new Settings();
const cacheStore = new CacheStore();

document.addEventListener('DOMContentLoaded', async function () {

    // Attendre l'initialisation (qui inclut déjà loadSettings())
    await settingClass.waitForInitialization();
    await cacheStore.waitForInitialization();

    // Version installée (locale : aucune requête vers un service tiers, U12)
    document.querySelector("#currentVersion").textContent = chrome.runtime.getManifest().version;

    // Retirer le badge si présent (l'utilisateur a ouvert la popup)
    chrome.action.setBadgeText({ text: '' });

    // Récupérer les éléments DOM
    const startDate = /** @type {HTMLInputElement} */ (document.querySelector('#startDate'));
    const endDate = /** @type {HTMLInputElement} */ (document.querySelector('#endDate'));
    const noEndDateCheckbox = /** @type {HTMLInputElement} */ (document.querySelector('#noEndDate'));
    const accountsInput = /** @type {HTMLSelectElement} */ (document.querySelector('#accountsInput'));
    const csvExport = /** @type {HTMLButtonElement} */ (document.querySelector("#exportCsv"));
    const exportPdf = /** @type {HTMLButtonElement} */ (document.querySelector("#exportPdf"));
    const pdfYear = /** @type {HTMLSelectElement} */ (document.querySelector("#pdfYear"));
    const pdfMonth = /** @type {HTMLSelectElement} */ (document.querySelector("#pdfMonth"));
    const refreshData = /** @type {HTMLButtonElement} */ (document.querySelector("#refreshData"));
    const refreshSettings = /** @type {HTMLButtonElement} */ (document.querySelector("#refreshSettings"));

    const PDF_MONTHS = ['Toute l\'année', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    function fillPdfYearSelect(transactions) {
        const currentYear = new Date().getFullYear();
        let minYear = currentYear - 10;
        let defaultYear = currentYear;
        if (transactions && transactions.length > 0) {
            const years = transactions.map(t => DateRange.parts(t.date)?.year).filter(Boolean);
            minYear = Math.min(minYear, Math.min(...years));
            defaultYear = Math.max(...years);
        }
        minYear = Math.max(2015, minYear);
        pdfYear.innerHTML = '';
        for (let y = currentYear; y >= minYear; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === defaultYear) opt.selected = true;
            pdfYear.appendChild(opt);
        }
    }

    function fillPdfMonthSelect() {
        pdfMonth.innerHTML = '';
        PDF_MONTHS.forEach((label, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);
            opt.textContent = label;
            if (index === 0) opt.selected = true;
            pdfMonth.appendChild(opt);
        });
    }

    // Fonction pour charger les dates
    async function loadDates(startDate, endDate, noEndDateCheckbox) {
        const data = await chrome.storage.local.get(['startDate', 'endDate', 'noEndDate']);
        let startDateValue = data.startDate;
        let endDateValue = data.endDate;
        const noEndDateValue = data.noEndDate || false;

        // Si pas de date de fin définie, utiliser aujourd'hui
        if (!endDateValue) {
            endDateValue = DateRange.getTodayInputValue();
            await chrome.storage.local.set({ endDate: endDateValue });
        }

        // Si pas de date de début définie : plus ancienne transaction, sinon il y a un an
        if (!startDateValue) {
            const dates = (cacheStore.get('transactions') || [])
                .map(t => DateRange.toDateOnly(t.date))
                .filter(Boolean);
            startDateValue = dates.length > 0
                ? dates.reduce((oldest, current) => (current < oldest ? current : oldest))
                : DateRange.addMonths(DateRange.getTodayInputValue(), -12);
            await chrome.storage.local.set({ startDate: startDateValue });
        }

        startDate.value = startDateValue;
        endDate.value = endDateValue;
        noEndDateCheckbox.checked = noEndDateValue;

        // Désactiver/activer le champ endDate selon la checkbox
        endDate.disabled = noEndDateValue;
    }

    // Variable pour stocker l'instance Choices
    let choicesInstance = null;

    // Fonction pour charger et afficher les comptes
    async function loadAccounts() {
        const cache_data_accounts = cacheStore.get('accounts');
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
                const checked = accountsSelected.includes(account.id);
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

            Logger.debug('[Popup] Accounts loaded:', cache_data_accounts.length);
        } else {
            console.warn('[Popup] No accounts found in cache');
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
    fillPdfYearSelect(cacheStore.get('transactions') || []);

    // Recharger les comptes quand les settings sont mis à jour
    evt.listen('settings_reloaded', async () => {
        await loadAccounts();
    });

    // Données chargées par l'onglet Bankin pendant que la popup est ouverte
    // (premier chargement, ↻) : liste des comptes et années du rapport à jour.
    const CACHE_KEYS_SHOWN = [Config.getCacheKey('accounts'), Config.getCacheKey('transactions')];
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== 'local' || !Object.keys(changes).some((key) => CACHE_KEYS_SHOWN.includes(key))) return;
        Logger.debug('[Popup] Données Bankin mises à jour');
        await cacheStore.load();
        await loadAccounts();
        const tx = cacheStore.get('transactions');
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
            endDate.value = DateRange.getTodayInputValue();
            chrome.storage.local.set({ endDate: endDate.value });
        }
    });
    
    const inputs = [startDate, endDate];
    for (const input of inputs) {
        input.addEventListener('blur', function () {
            chrome.storage.local.set({ [this.id]: this.value });
        });
    }

    /** Retourne la date de fin effective (aujourd'hui si "pas de limite" coché, sinon valeur du champ). */
    function getEffectiveEndDate() {
        if (noEndDateCheckbox.checked) {
            return DateRange.getTodayInputValue();
        }
        return endDate.value;
    }

    /**
     * Lit les données en cache nécessaires à l'export.
     * @returns {Promise<{transactions: Array, categories: Array, accounts: Array, accountsSelected: Array|null}|null>}
     *   null (après un message à l'utilisateur) s'il n'y a aucune transaction
     */
    async function readExportData() {
        await cacheStore.load();
        const transactions = cacheStore.get('transactions');
        if (!transactions || transactions.length === 0) {
            alert('Aucune donnée de transaction disponible. Veuillez d\'abord charger des données depuis Bankin.');
            return null;
        }
        const stored = await chrome.storage.local.get('accountsSelected');
        /** @type {number[] | null} */
        const accountsSelected = Array.isArray(stored.accountsSelected) ? stored.accountsSelected : null;
        return {
            transactions,
            categories: cacheStore.get('categories') || [],
            accounts: cacheStore.get('accounts') || [],
            accountsSelected,
        };
    }

    // Export CSV de la période et des comptes choisis
    csvExport.addEventListener('click', async function () {
        try {
            const data = await readExportData();
            if (!data) return;

            const dataMerger = new DataMerger(data.transactions, data.categories, data.accounts, startDate.value, getEffectiveEndDate(), data.accountsSelected);
            if (dataMerger.mergeData().length === 0) {
                alert('Aucune transaction trouvée pour la période sélectionnée. Vérifiez vos dates et comptes sélectionnés.');
                return;
            }
            dataMerger.exportToCSV();
        } catch (error) {
            console.error('[Popup] Erreur lors de l\'export CSV :', error);
            alert('Erreur lors de l\'export CSV : ' + error.message);
        }
    });

    // Générer rapport PDF : période = Année + Mois (sélecteurs décroissants)
    exportPdf.addEventListener('click', async function () {
        try {
            const year = parseInt(pdfYear.value, 10);
            const monthIndex = parseInt(pdfMonth.value, 10);
            const today = DateRange.getTodayInputValue();
            let reportStartDate, reportEndDate;
            if (monthIndex === 0) {
                reportStartDate = `${year}-01-01`;
                reportEndDate = year === new Date().getFullYear() ? today : `${year}-12-31`;
            } else {
                reportStartDate = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
                reportEndDate = DateRange.lastDayOfMonth(year, monthIndex);
            }

            const data = await readExportData();
            if (!data) return;

            let dataMerger = new DataMerger(data.transactions, data.categories, data.accounts, reportStartDate, reportEndDate, data.accountsSelected);
            let mergedData = dataMerger.mergeData();
            let usedStartDate = reportStartDate;
            let usedEndDate = reportEndDate;
            let usedPdfYear = year;
            let usedPdfMonthIndex = monthIndex;
            if (mergedData.length === 0) {
                const fallbackStart = startDate.value;
                const fallbackEnd = getEffectiveEndDate();
                dataMerger = new DataMerger(data.transactions, data.categories, data.accounts, fallbackStart, fallbackEnd, data.accountsSelected);
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
            const accountNames = data.accounts
                .filter(a => (data.accountsSelected || []).includes(a.id))
                .map(a => a.name)
                .join(', ') || 'Tous les comptes';
            const params = {
                startDate: usedStartDate,
                endDate: usedEndDate,
                accountNames: accountNames,
                pdfYear: usedPdfYear,
                pdfMonthIndex: usedPdfMonthIndex != null ? usedPdfMonthIndex : 0,
                pdfMonthLabel: usedPdfMonthIndex != null ? PDF_MONTHS[usedPdfMonthIndex] : 'Toute l\'année',
                exceptionCategoryIds: Config.CATEGORIES.EXCEPTION_IDS
            };
            await ReportStorage.saveReportData(mergedData, stats, params);
            chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
        } catch (error) {
            console.error('[Popup] Erreur lors de la préparation du rapport PDF :', error);
            alert('Erreur lors de la préparation du rapport PDF : ' + error.message);
        }
    });

    // Réinitialiser uniquement les données (cache des transactions et catégories)
    // Le cache des comptes est conservé ; il est supprimé avec les paramètres.
    refreshData.addEventListener('click', async function () {
        try {
            await cacheStore.clear(['transactions', 'categories']);
            alert('Les données ont été réinitialisées avec succès. Les paramètres ont été conservés.');
        } catch (error) {
            console.error('[Popup] Erreur lors de la réinitialisation des données:', error);
            alert('Erreur lors de la réinitialisation des données: ' + error.message);
        }
    });

    // Réinitialiser uniquement les paramètres utilisateur (et la liste des comptes)
    refreshSettings.addEventListener('click', async function () {
        if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous vos paramètres ? Les données seront conservées.')) {
            return;
        }
        try {
            await settingClass.clearAllSettings();
            await cacheStore.remove('accounts');
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
        const pinInstructionsSection = /** @type {HTMLElement} */ (document.querySelector('#pinInstructionsSection'));
        
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
                Logger.debug('[Popup] Impossible de vérifier l\'état d\'épinglage:', error);
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
