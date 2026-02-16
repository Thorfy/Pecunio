/**
 * ReviewPrompt - Modale d'invitation à laisser un avis Chrome Web Store.
 * S'affiche sur les pages Bankin (comptes / catégories) après plusieurs utilisations
 * de Pecunio, sans spammer l'utilisateur.
 *
 * Dépendance globale : Config (optionnel, pour Config.REVIEW.DEBUG).
 */
class ReviewPrompt {
    static STORE_URL = 'https://chromewebstore.google.com/detail/pecunio/jeomdpldhaigmdbjobamliaipijhmiie/reviews';
    static MIN_BUILDS_BEFORE_PROMPT = 5;
    static DISMISS_DELAY_DAYS = 14;
    static SHOW_DELAY_MS = 2000;
    static MS_PER_DAY = 1000 * 60 * 60 * 24;

    static STORAGE_KEYS = {
        BUILD_COUNT: 'review_build_count',
        STATE: 'review_state',
        DISMISSED_AT: 'review_dismissed_at'
    };

    /** États possibles du prompt (stockés dans chrome.storage.local) */
    static STATE = {
        NONE: 'none',
        DISMISSED: 'dismissed',
        REVIEWED: 'reviewed',
        NEVER: 'never'
    };

    /** IDs / sélecteurs DOM pour éviter les chaînes magiques */
    static DOM = {
        OVERLAY_ID: 'pr-overlay',
        STYLES_ID: 'pr-styles',
        CTA_ID: 'pr-go',
        LATER_ID: 'pr-later',
        NEVER_ID: 'pr-never',
        VISIBLE_CLASS: 'pr-visible',
        CLOSE_ANIMATION_MS: 350
    };

    // ─── Public API ───────────────────────────────────────────

    /**
     * Tente d'afficher la modale d'invitation à l'avis.
     * Incrémente le compteur de "builds", puis affiche la modale si les conditions sont remplies.
     * Appelé depuis injected.js après chargement des pages comptes / catégories.
     * @returns {Promise<void>}
     */
    static async tryShow() {
        try {
            const data = await this._getStorageData();
            const buildCount = (data[this.STORAGE_KEYS.BUILD_COUNT] || 0) + 1;
            const state = data[this.STORAGE_KEYS.STATE] || this.STATE.NONE;
            const dismissedAt = data[this.STORAGE_KEYS.DISMISSED_AT] || 0;

            await this._setStorage({ [this.STORAGE_KEYS.BUILD_COUNT]: buildCount });
            console.log(`[ReviewPrompt] Builds: ${buildCount}, State: ${state}`);

            if (!this._shouldShow(buildCount, state, dismissedAt)) return;
            if (document.querySelector(`#${this.DOM.OVERLAY_ID}`)) return;

            setTimeout(() => this._render(), this.SHOW_DELAY_MS);
        } catch (err) {
            console.warn('[ReviewPrompt] Error:', err);
        }
    }

    // ─── Decision logic ───────────────────────────────────────

    /**
     * Détermine si la modale doit être affichée.
     * @param {number} buildCount - Nombre de fois que la page a été construite
     * @param {string} state - État stocké (none | dismissed | reviewed | never)
     * @param {number} dismissedAt - Timestamp du dernier "Plus tard"
     * @returns {boolean}
     */
    static _shouldShow(buildCount, state, dismissedAt) {
        if (typeof Config !== 'undefined' && Config.REVIEW && Config.REVIEW.DEBUG) {
            console.log('[ReviewPrompt] DEBUG mode — forcing display');
            return true;
        }
        if (state === this.STATE.REVIEWED || state === this.STATE.NEVER) return false;
        if (buildCount < this.MIN_BUILDS_BEFORE_PROMPT) return false;
        if (state === this.STATE.DISMISSED && dismissedAt) {
            const days = (Date.now() - dismissedAt) / this.MS_PER_DAY;
            if (days < this.DISMISS_DELAY_DAYS) return false;
        }
        return true;
    }

    // ─── Styles ───────────────────────────────────────────────

    /** @returns {string} CSS de la modale et de l’overlay */
    static _getStyles() {
        return `
            #${this.DOM.OVERLAY_ID},
            #${this.DOM.OVERLAY_ID} .pr-modal,
            #${this.DOM.OVERLAY_ID} .pr-modal * {
                box-sizing: border-box !important;
            }

            #${this.DOM.OVERLAY_ID} {
                position: fixed;
                inset: 0;
                background: rgba(15, 10, 30, 0.55);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                opacity: 0;
                transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #${this.DOM.OVERLAY_ID}.${this.DOM.VISIBLE_CLASS} { opacity: 1; }

            .pr-modal {
                background: #fff !important;
                color-scheme: light !important;
                border-radius: 20px;
                padding: 0;
                max-width: 400px;
                width: 90%;
                box-sizing: border-box !important;
                box-shadow:
                    0 24px 80px rgba(102, 126, 234, 0.18),
                    0 8px 24px rgba(0, 0, 0, 0.12);
                transform: translateY(24px) scale(0.96);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            .pr-modal, .pr-modal * {
                color-scheme: light !important;
            }
            #${this.DOM.OVERLAY_ID}.${this.DOM.VISIBLE_CLASS} .pr-modal {
                transform: translateY(0) scale(1);
            }

            .pr-bar {
                height: 5px;
                background: linear-gradient(135deg, #667eea, #9b59b6, #764ba2);
                background-size: 200% 100%;
                animation: pr-shimmer 3s ease infinite;
            }
            @keyframes pr-shimmer {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            .pr-body {
                padding: 32px 28px 28px;
                text-align: center;
                box-sizing: border-box !important;
            }

            .pr-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: linear-gradient(135deg, #667eea, #764ba2) !important;
                color: #fff !important;
                font-size: 12px;
                font-weight: 600;
                padding: 5px 12px;
                border-radius: 20px;
                letter-spacing: 0.5px;
                margin-bottom: 20px;
            }

            .pr-title {
                font-size: 22px;
                font-weight: 700;
                color: #1a1a2e !important;
                margin-bottom: 10px;
                line-height: 1.3;
            }

            .pr-subtitle {
                font-size: 14px;
                color: #6b7280 !important;
                line-height: 1.6;
                margin-bottom: 28px;
            }

            .pr-cta {
                display: block !important;
                width: 100% !important;
                min-width: 0;
                box-sizing: border-box !important;
                padding: 14px 24px;
                border: none !important;
                border-radius: 14px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                color: #fff !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                margin-bottom: 16px;
                text-decoration: none !important;
                text-align: center;
            }
            .pr-cta:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            .pr-cta:active {
                transform: translateY(0);
            }

            .pr-dismiss-row {
                display: flex;
                justify-content: center;
                gap: 12px;
            }

            .pr-dismiss {
                background: #f3f4f6 !important;
                border: 1px solid #d1d5db !important;
                font-size: 13px;
                font-weight: 500;
                color: #374151 !important;
                cursor: pointer;
                padding: 8px 18px;
                border-radius: 10px;
                transition: background 0.15s ease, border-color 0.15s ease;
            }
            .pr-dismiss:hover {
                background: #e5e7eb !important;
                border-color: #9ca3af !important;
            }
        `;
    }

    static _injectStyles() {
        if (document.querySelector(`#${this.DOM.STYLES_ID}`)) return;
        const style = document.createElement('style');
        style.id = this.DOM.STYLES_ID;
        style.textContent = this._getStyles();
        document.head.appendChild(style);
    }

    // ─── Render ───────────────────────────────────────────────

    static _render() {
        this._injectStyles();

        const overlay = document.createElement('div');
        overlay.id = this.DOM.OVERLAY_ID;

        overlay.innerHTML = `
            <div class="pr-modal">
                <div class="pr-bar"></div>
                <div class="pr-body">
                    <div class="pr-badge">PECUNIO</div>
                    <div class="pr-title">Un petit avis ?</div>
                    <div class="pr-subtitle">
                        Si Pecunio vous est utile, un avis sur le Chrome Web Store
                        nous aide beaucoup à faire connaître l'extension
                        et à continuer de l'améliorer.
                    </div>
                    <a class="pr-cta" id="${this.DOM.CTA_ID}" href="${this.STORE_URL}" target="_blank" rel="noopener noreferrer">
                        Laisser un avis
                    </a>
                    <div class="pr-dismiss-row">
                        <button class="pr-dismiss" id="${this.DOM.LATER_ID}">Plus tard</button>
                        <button class="pr-dismiss" id="${this.DOM.NEVER_ID}">Ne plus demander</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add(this.DOM.VISIBLE_CLASS));
        this._bindEvents(overlay);
    }

    // ─── Events ───────────────────────────────────────────────

    static _bindEvents(overlay) {
        overlay.querySelector(`#${this.DOM.CTA_ID}`).addEventListener('click', () => {
            this._setStorage({ [this.STORAGE_KEYS.STATE]: this.STATE.REVIEWED });
            this._close(overlay);
        });

        overlay.querySelector(`#${this.DOM.LATER_ID}`).addEventListener('click', () => {
            this._dismiss(overlay);
        });

        overlay.querySelector(`#${this.DOM.NEVER_ID}`).addEventListener('click', () => {
            this._setStorage({ [this.STORAGE_KEYS.STATE]: this.STATE.NEVER });
            this._close(overlay);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._dismiss(overlay);
        });

        const onEsc = (e) => {
            if (e.key === 'Escape') {
                this._dismiss(overlay);
                document.removeEventListener('keydown', onEsc);
            }
        };
        document.addEventListener('keydown', onEsc);
    }

    // ─── Helpers ──────────────────────────────────────────────

    static _dismiss(overlay) {
        this._setStorage({
            [this.STORAGE_KEYS.STATE]: this.STATE.DISMISSED,
            [this.STORAGE_KEYS.DISMISSED_AT]: Date.now()
        });
        this._close(overlay);
    }

    static _close(overlay) {
        overlay.classList.remove(this.DOM.VISIBLE_CLASS);
        setTimeout(() => overlay.remove(), this.DOM.CLOSE_ANIMATION_MS);
    }

    /**
     * @param {Object} payload - Clés/valeurs à écrire dans chrome.storage.local
     * @returns {Promise<void>}
     */
    static _setStorage(payload) {
        return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    }

    /**
     * @returns {Promise<{ [key: string]: number | string }>}
     */
    static _getStorageData() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                this.STORAGE_KEYS.BUILD_COUNT,
                this.STORAGE_KEYS.STATE,
                this.STORAGE_KEYS.DISMISSED_AT
            ], resolve);
        });
    }
}
