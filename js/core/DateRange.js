/**
 * DateRange - Manipulation des dates sans piège de fuseau horaire
 *
 * Règles :
 * - Une date « calendaire » est une chaîne `YYYY-MM-DD`, toujours interprétée en
 *   heure locale. On n'utilise jamais `new Date('YYYY-MM-DD')` (lu en UTC) ni
 *   `toISOString()` (écrit en UTC), sources des décalages d'un jour (bug B9).
 * - Bankin permet de rattacher une transaction à un autre mois (`current_month`,
 *   en nombre de mois de décalage). La « date budgétaire » est la date réelle
 *   décalée de ce nombre de mois, jour conservé (borné à la fin du mois).
 *   Les graphiques et les filtres de période utilisent la date budgétaire ;
 *   l'export affiche la date réelle et le mois de rattachement (décision B10).
 */
class DateRange {
    static MONTH_NAMES_FR = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ];

    static MONTH_NAMES_EN = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
    ];

    static #DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

    static #pad(n) {
        return String(n).padStart(2, '0');
    }

    /**
     * Décompose une date en { year, month (1-12), day }, en heure locale.
     * Accepte une chaîne commençant par `YYYY-MM-DD` (prise telle quelle),
     * une Date, un timestamp ou toute chaîne lisible par `Date`.
     * @param {string|Date|number|null|undefined} value
     * @returns {{ year: number, month: number, day: number } | null}
     */
    static parts(value) {
        if (value == null || value === '') return null;
        if (typeof value === 'string') {
            const match = DateRange.#DATE_ONLY.exec(value);
            if (match) {
                const [, y, m, d] = match.map(Number);
                if (m < 1 || m > 12 || d < 1 || d > 31) return null;
                return { year: y, month: m, day: d };
            }
        }
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return null;
        return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
    }

    /**
     * Date calendaire `YYYY-MM-DD` (heure locale), ou null si invalide.
     * @param {string|Date|number|null|undefined} value
     * @returns {string|null}
     */
    static toDateOnly(value) {
        const p = DateRange.parts(value);
        return p ? `${p.year}-${DateRange.#pad(p.month)}-${DateRange.#pad(p.day)}` : null;
    }

    /** Alias historique utilisé pour normaliser les bornes de filtre. */
    static toDateOnlyString(value) {
        return DateRange.toDateOnly(value);
    }

    /** Date du jour `YYYY-MM-DD` (heure locale). */
    static getTodayInputValue() {
        return DateRange.toDateOnly(new Date());
    }

    /**
     * Date locale à minuit pour une date calendaire.
     * @param {string|Date|number} value
     * @returns {Date|null}
     */
    static toLocalDate(value) {
        const p = DateRange.parts(value);
        return p ? new Date(p.year, p.month - 1, p.day) : null;
    }

    /**
     * Dernier jour d'un mois.
     * @param {number} year
     * @param {number} month 1-12
     * @returns {string} `YYYY-MM-DD`
     */
    static lastDayOfMonth(year, month) {
        const day = new Date(year, month, 0).getDate();
        return `${year}-${DateRange.#pad(month)}-${DateRange.#pad(day)}`;
    }

    /**
     * Ajoute des mois à une date calendaire, jour borné à la fin du mois
     * (31 janvier + 1 mois → 29 février).
     * @param {string|Date} value
     * @param {number} months
     * @returns {string|null}
     */
    static addMonths(value, months) {
        const p = DateRange.parts(value);
        if (!p) return null;
        const index = p.year * 12 + (p.month - 1) + (Number(months) || 0);
        const year = Math.floor(index / 12);
        const month = (index % 12) + 1;
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${DateRange.#pad(month)}-${DateRange.#pad(Math.min(p.day, lastDay))}`;
    }

    /**
     * Date budgétaire d'une transaction : date réelle décalée de `current_month` mois.
     * @param {{ date?: string|Date, current_month?: number|null }} transaction
     * @returns {string|null} `YYYY-MM-DD`
     */
    static getBudgetDate(transaction) {
        if (!transaction || transaction.date == null) return null;
        const offset = typeof transaction.current_month === 'number' && !isNaN(transaction.current_month)
            ? transaction.current_month
            : 0;
        return DateRange.addMonths(transaction.date, offset);
    }

    /**
     * Mois de rattachement `YYYY-MM` d'une transaction.
     * @param {{ date?: string|Date, current_month?: number|null }} transaction
     * @returns {string|null}
     */
    static getBudgetMonth(transaction) {
        const date = DateRange.getBudgetDate(transaction);
        return date ? date.slice(0, 7) : null;
    }

    /**
     * Comparaison inclusive sur des dates `YYYY-MM-DD` (bornes optionnelles).
     * @param {string|null} dateOnly
     * @param {string|null} start
     * @param {string|null} end
     */
    static isDateInRange(dateOnly, start, end) {
        if (!dateOnly) return false;
        if (start && dateOnly < start) return false;
        if (end && dateOnly > end) return false;
        return true;
    }

    /**
     * Numéro de mois (1-12) à partir d'un libellé, en français ou en anglais,
     * avec ou sans accents (« février », « fevrier », « February », « fév. »…).
     * Bankin affiche les mois en français quelle que soit la langue du navigateur (bug B19).
     * @param {string|number} label
     * @returns {number|null}
     */
    static monthIndexFromLabel(label) {
        if (typeof label === 'number') return label >= 1 && label <= 12 ? label : null;
        if (typeof label !== 'string') return null;
        const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
        const wanted = normalize(label);
        if (!wanted) return null;
        for (const names of [DateRange.MONTH_NAMES_FR, DateRange.MONTH_NAMES_EN]) {
            const exact = names.findIndex((name) => normalize(name) === wanted);
            if (exact !== -1) return exact + 1;
        }
        if (wanted.length >= 3) {
            for (const names of [DateRange.MONTH_NAMES_FR, DateRange.MONTH_NAMES_EN]) {
                const prefix = names.findIndex((name) => normalize(name).startsWith(wanted));
                if (prefix !== -1) return prefix + 1;
            }
        }
        return null;
    }

    /**
     * Date de fin effective : aujourd'hui si « pas de date de fin », sinon la date stockée.
     * @param {{ endDate?: string|null, noEndDate?: boolean }} params
     * @returns {string|null}
     */
    static getEffectiveEndDate({ endDate = null, noEndDate = false } = {}) {
        return noEndDate ? DateRange.getTodayInputValue() : DateRange.toDateOnly(endDate);
    }
}
