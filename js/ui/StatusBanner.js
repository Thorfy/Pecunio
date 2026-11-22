/**
 * StatusBanner - Bandeau d'état de Pecunio dans la page Bankin
 *
 * Informe l'utilisateur au lieu d'écrire seulement dans la console :
 * chargement en cours, authentification impossible, API indisponible (bug B12).
 * Un seul bandeau à la fois ; chaque message a une clé pour pouvoir être
 * retiré sans effacer un autre message plus récent.
 */
class StatusBanner {
    static ID = 'pecunio-status-banner';

    static COLORS = {
        info: { background: '#eef2ff', border: '#667eea', text: '#312e81' },
        error: { background: '#fef2f2', border: '#ef4444', text: '#7f1d1d' },
    };

    /**
     * Affiche (ou remplace) le bandeau.
     * @param {string} message - Texte affiché (jamais interprété comme du HTML)
     * @param {{ type?: 'info'|'error', key?: string, actionLabel?: string, onAction?: () => void }} [options]
     * @returns {HTMLElement|null}
     */
    static show(message, { type = 'info', key = 'default', actionLabel, onAction } = {}) {
        if (typeof document === 'undefined' || !document.body) return null;
        StatusBanner.hide();

        const colors = StatusBanner.COLORS[type] || StatusBanner.COLORS.info;
        const banner = document.createElement('div');
        banner.id = StatusBanner.ID;
        banner.dataset.key = key;
        banner.dataset.type = type;
        banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
        banner.style.cssText = [
            'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483000', 'max-width:420px',
            'display:flex', 'align-items:center', 'gap:12px', 'padding:12px 14px', 'border-radius:10px',
            'box-shadow:0 6px 24px rgba(0,0,0,.15)', 'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            `background:${colors.background}`, `border-left:4px solid ${colors.border}`, `color:${colors.text}`,
        ].join(';');

        const text = document.createElement('span');
        text.textContent = `Pecunio — ${message}`;
        text.style.flex = '1';
        banner.appendChild(text);

        if (actionLabel && typeof onAction === 'function') {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'pecunio-status-action';
            action.textContent = actionLabel;
            action.style.cssText = `cursor:pointer;border:0;border-radius:6px;padding:6px 10px;font-weight:600;background:${colors.border};color:#fff`;
            action.addEventListener('click', () => onAction());
            banner.appendChild(action);
        }

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'pecunio-status-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        close.style.cssText = `cursor:pointer;border:0;background:none;font-size:18px;line-height:1;color:${colors.text}`;
        close.addEventListener('click', () => banner.remove());
        banner.appendChild(close);

        document.body.appendChild(banner);
        return banner;
    }

    /**
     * Retire le bandeau ; avec une clé, seulement s'il affiche ce message.
     * @param {string} [key]
     */
    static hide(key) {
        if (typeof document === 'undefined') return;
        const banner = document.getElementById(StatusBanner.ID);
        if (banner && (key == null || banner.dataset.key === key)) banner.remove();
    }

    /** @param {string} [key] */
    static isVisible(key) {
        if (typeof document === 'undefined') return false;
        const banner = document.getElementById(StatusBanner.ID);
        return Boolean(banner && (key == null || banner.dataset.key === key));
    }
}
