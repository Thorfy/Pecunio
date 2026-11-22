/**
 * StatusBanner - Bandeau d'état de Pecunio dans la page Bankin
 *
 * Informe l'utilisateur au lieu d'écrire seulement dans la console :
 * chargement en cours, authentification impossible, API indisponible (bug B12).
 * Un seul bandeau à la fois ; chaque message a une clé pour pouvoir être
 * retiré sans effacer un autre message plus récent.
 *
 * Le contenu est placé dans un Shadow DOM : les règles CSS de Bankin (par
 * exemple sur tous les `button`) ne peuvent pas le déformer (bug B22).
 */
export class StatusBanner {
    static ID = 'pecunio-status-banner';

    static COLORS = {
        info: { background: '#eef2ff', border: '#667eea', text: '#312e81' },
        error: { background: '#fef2f2', border: '#ef4444', text: '#7f1d1d' },
    };

    /** Feuille de style interne au Shadow DOM (aucune règle de la page ne s'y applique). */
    static #css(colors) {
        return `
            :host { all: initial; }
            .banner {
                display: flex; align-items: center; gap: 12px;
                box-sizing: border-box; max-width: 420px; padding: 12px 14px;
                border-radius: 10px; border-left: 4px solid ${colors.border};
                background: ${colors.background}; color: ${colors.text};
                box-shadow: 0 6px 24px rgba(0, 0, 0, .15);
                font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .text { flex: 1 1 auto; min-width: 0; }
            button { all: unset; box-sizing: border-box; cursor: pointer; flex: 0 0 auto; }
            button:focus-visible { outline: 2px solid ${colors.border}; outline-offset: 2px; }
            .pecunio-status-action {
                padding: 6px 10px; border-radius: 6px; font-weight: 600;
                background: ${colors.border}; color: #fff;
            }
            .pecunio-status-close { padding: 0 4px; font-size: 18px; line-height: 1; color: ${colors.text}; }
        `;
    }

    /**
     * Affiche (ou remplace) le bandeau.
     * @param {string} message - Texte affiché (jamais interprété comme du HTML)
     * @param {{ type?: 'info'|'error', key?: string, actionLabel?: string, onAction?: () => void }} [options]
     * @returns {HTMLElement|null} élément hôte (le contenu est dans `host.shadowRoot`)
     */
    static show(message, { type = 'info', key = 'default', actionLabel, onAction } = {}) {
        if (typeof document === 'undefined' || !document.body) return null;
        StatusBanner.hide();

        const colors = StatusBanner.COLORS[type] || StatusBanner.COLORS.info;
        const host = document.createElement('div');
        host.id = StatusBanner.ID;
        host.dataset.key = key;
        host.dataset.type = type;
        host.setAttribute('role', type === 'error' ? 'alert' : 'status');
        // Position imposée (« important ») : l'élément hôte reste dans la page de Bankin
        for (const [property, value] of [
            ['position', 'fixed'], ['right', '16px'], ['bottom', '16px'],
            ['z-index', '2147483000'], ['display', 'block'], ['margin', '0'],
        ]) {
            host.style.setProperty(property, value, 'important');
        }

        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = StatusBanner.#css(colors);
        root.appendChild(style);

        const banner = document.createElement('div');
        banner.className = 'banner';

        const text = document.createElement('span');
        text.className = 'text';
        text.textContent = `Pecunio — ${message}`;
        banner.appendChild(text);

        if (actionLabel && typeof onAction === 'function') {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'pecunio-status-action';
            action.textContent = actionLabel;
            action.addEventListener('click', () => onAction());
            banner.appendChild(action);
        }

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'pecunio-status-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        close.addEventListener('click', () => host.remove());
        banner.appendChild(close);

        root.appendChild(banner);
        document.body.appendChild(host);
        return host;
    }

    /**
     * Retire le bandeau ; avec une clé, seulement s'il affiche ce message.
     * @param {string} [key]
     */
    static hide(key) {
        if (typeof document === 'undefined') return;
        const host = document.getElementById(StatusBanner.ID);
        if (host && (key == null || host.dataset.key === key)) host.remove();
    }

    /** @param {string} [key] */
    static isVisible(key) {
        if (typeof document === 'undefined') return false;
        const host = document.getElementById(StatusBanner.ID);
        return Boolean(host && (key == null || host.dataset.key === key));
    }
}
