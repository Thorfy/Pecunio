import { BANKIN_SELECTORS } from '../bankin/BankinPage.js';
import { Chart } from '../lib/chart.js';
import { THEME } from './theme.js';

/**
 * InjectedStyles - Styles partagés pour tous les éléments injectés sur Bankin
 * Police et couleurs de Bankin (voir theme.js)
 */
export class InjectedStyles {
    /** Classe posée sur `<html>` quand les montants sont masqués (AmountHider). */
    static AMOUNTS_HIDDEN_CLASS = 'pecunio-amounts-hidden';

    static getStyles() {
        return `
            /* ===== STYLES PECUNIO INJECTÉS ===== */
            .pecunio-container {
                background: rgba(255, 255, 255, 0.98);
                border-radius: 12px;
                padding: 16px;
                margin: 12px 0;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                border: 1px solid #e1e5e9;
                font-family: ${THEME.fontFamily};
            }

            .pecunio-title {
                font-size: 18px;
                font-weight: 600;
                color: ${THEME.text};
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .pecunio-title::before {
                content: '';
                width: 3px;
                height: 18px;
                background: ${THEME.accent};
                border-radius: 2px;
            }

            .pecunio-section {
                background: #fff;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid ${THEME.border};
            }

            .pecunio-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: center;
                margin-bottom: 12px;
            }

            .pecunio-control-group {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }

            .pecunio-label {
                font-size: 13px;
                font-weight: 500;
                color: #555;
                white-space: nowrap;
            }

            .pecunio-select {
                padding: 6px 10px;
                border: 2px solid #e1e5e9;
                border-radius: 6px;
                font-size: 13px;
                background: #fff;
                transition: all 0.2s ease;
                min-width: 80px;
            }

            .pecunio-select:focus {
                outline: none;
                border-color: ${THEME.accent};
                box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
            }

            .pecunio-button {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                background: ${THEME.accent};
                color: white;
            }

            .pecunio-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }

            .pecunio-button-secondary {
                background: #f8f9fa;
                color: #6c757d;
                border: 2px solid #e1e5e9;
            }

            .pecunio-button-secondary:hover {
                background: #e9ecef;
                border-color: #adb5bd;
            }

            .pecunio-chart-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-start;
                gap: 8px;
                margin-bottom: 8px;
            }

            /* Boutons groupés (périodes, préréglages), un seul actif (aria-pressed) */
            .pecunio-segmented {
                display: inline-flex;
                border: 1px solid ${THEME.border};
                border-radius: 8px;
                overflow: hidden;
                background: #fff;
            }

            .pecunio-segmented button {
                width: auto !important;
                margin: 0 !important;
                padding: 6px 12px;
                border: none;
                border-right: 1px solid ${THEME.border};
                background-color: #fff !important;
                color: ${THEME.textMuted};
                font: 500 13px ${THEME.fontFamily};
                cursor: pointer;
            }

            .pecunio-segmented button:last-child {
                border-right: none;
            }

            .pecunio-segmented button[aria-pressed="true"] {
                background-color: ${THEME.accent} !important;
                color: #fff;
            }

            .pecunio-segmented button:focus-visible {
                outline: 2px solid ${THEME.accent};
                outline-offset: -2px;
            }

            .pecunio-budget-custom[hidden] {
                display: none !important;
            }

            .pecunio-budget-summary {
                margin: 4px 0 8px;
                font-size: 13px;
                color: ${THEME.textMuted};
            }

            .pecunio-chart-toolbar .pecunio-detail-toggle {
                width: auto;
                margin: 0;
                padding: 6px 12px;
                background-color: #f8f9fa !important;
                color: #495057;
                font-family: inherit;
                line-height: 1.4;
            }

            /* Bankin stylise tous les <button> (pleine largeur, marges, fond violet en !important) */
            .pecunio-chart-toolbar .pecunio-chart-type-toggle {
                width: auto;
                /* À droite de la barre d'outils */
                margin: 0 0 0 auto;
                padding: 6px 12px;
                background-color: #f8f9fa !important;
                color: #495057;
                font-family: inherit;
                line-height: 1.4;
            }

            .pecunio-chart-toolbar .pecunio-chart-type-toggle:hover {
                background-color: #e9ecef !important;
            }

            .pecunio-chart-type-toggle:focus-visible {
                outline: 2px solid ${THEME.accent};
                outline-offset: 2px;
            }

            .pecunio-canvas-container {
                position: relative;
                width: 100%;
                height: 400px;
                margin-top: 12px;
            }

            .pecunio-canvas {
                width: 100% !important;
                height: 100% !important;
                border-radius: 8px;
            }

            /* Styles pour le bouton de masquage */
            .pecunio-hide-button {
                width: 18px !important;
                height: 18px;
                cursor: pointer;
                transition: all 0.2s ease;
                border-radius: 4px;
                padding: 2px;
            }

            .pecunio-hide-button:hover {
                background: rgba(102, 126, 234, 0.1);
                transform: scale(1.1);
            }

            /* Styles pour les éléments flous */
            /* Masquage des montants : tous les montants de Bankin ciblés par
               l'adaptateur, y compris ceux affichés ou réécrits plus tard (U1) */
            html.${InjectedStyles.AMOUNTS_HIDDEN_CLASS} :is(${BANKIN_SELECTORS.HEADER_AMOUNT}, ${BANKIN_SELECTORS.AMOUNTS}) {
                filter: blur(6px) !important;
                transition: filter 0.3s ease;
            }

            /* Responsive pour petits écrans */
            @media (max-width: 768px) {
                .pecunio-controls {
                    flex-direction: column;
                    align-items: stretch;
                }

                .pecunio-control-group {
                    justify-content: space-between;
                }

                .pecunio-select {
                    flex: 1;
                    min-width: 120px;
                }
            }

            /* Animation d'apparition */
            @keyframes pecunioFadeIn {
                from { 
                    opacity: 0; 
                    transform: translateY(10px); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0); 
                }
            }

            .pecunio-container {
                animation: pecunioFadeIn 0.3s ease-out;
            }

            /* Styles pour les tooltips/infos */
            .pecunio-info {
                font-size: 12px;
                color: ${THEME.textMuted};
                margin-top: 8px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 6px;
                border-left: 3px solid ${THEME.accent};
            }

            /* Styles pour les badges/étiquettes */
            .pecunio-badge {
                display: inline-block;
                padding: 2px 6px;
                font-size: 11px;
                font-weight: 500;
                border-radius: 4px;
                background: ${THEME.accent};
                color: white;
            }

            /* Styles pour les séparateurs */
            .pecunio-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e1e5e9, transparent);
                margin: 12px 0;
            }

            /* Styles pour les graphiques côte à côte */
            .pecunio-charts-row {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                margin-bottom: 16px;
                width: 100%;
                /* Cartes côte à côte de même hauteur */
                align-items: stretch;
            }

            .pecunio-donut-wrapper,
            .pecunio-expense-type-wrapper {
                flex: 1 1 0;
                min-width: 0;
            }

            /* Page de détail d'une catégorie : donut étroit, historique à côté */
            .pecunio-charts-row--detail > .pecunio-donut-wrapper {
                flex: 0 0 340px;
            }
            .pecunio-charts-row--detail > .pecunio-history-wrapper {
                flex: 1 1 0;
                min-width: 0;
                margin-bottom: 0;
            }

            @media (max-width: 1024px) {
                .pecunio-charts-row {
                    flex-direction: column;
                }
                .pecunio-charts-row--detail > .pecunio-donut-wrapper,
                .pecunio-charts-row--detail > .pecunio-history-wrapper {
                    flex: 1 1 100%;
                }
                .pecunio-donut-wrapper,
                .pecunio-expense-type-wrapper {
                    flex: 1 1 100% !important;
                    min-width: 100% !important;
                    width: 100%;
                }
            }

            .pecunio-expense-type-wrapper {
                background: #fff;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e1e5e9;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }

            .pecunio-donut-wrapper {
                background: #fff;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e1e5e9;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }

            .pecunio-sankey-wrapper {
                background: #fff;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e1e5e9;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                margin-top: 16px;
            }
        `;
    }

    /**
     * Injecte les styles dans le document
     */
    static inject() {
        if (document.getElementById('pecunio-styles')) {
            return; // Styles déjà injectés
        }

        const styleElement = document.createElement('style');
        styleElement.id = 'pecunio-styles';
        styleElement.textContent = this.getStyles();
        document.head.appendChild(styleElement);
    }

    /**
     * Applique les classes Pecunio à un élément
     */
    static applyContainerClasses(element) {
        element.classList.add('pecunio-container');
    }

    /**
     * Crée un titre avec le style Pecunio
     */
    static createTitle(text) {
        const title = document.createElement('h3');
        title.textContent = text;
        title.classList.add('pecunio-title');
        return title;
    }

    /**
     * Crée un groupe de contrôles avec le style Pecunio
     */
    static createControlGroup() {
        const group = document.createElement('div');
        group.classList.add('pecunio-control-group');
        return group;
    }

    /**
     * Crée un label avec le style Pecunio
     */
    static createLabel(text, htmlFor = null) {
        const label = document.createElement('label');
        label.textContent = text;
        label.classList.add('pecunio-label');
        if (htmlFor) {
            label.htmlFor = htmlFor;
        }
        return label;
    }

    /**
     * Crée un select avec le style Pecunio
     */
    static createSelect(id = null) {
        const select = document.createElement('select');
        select.classList.add('pecunio-select');
        if (id) {
            select.id = id;
        }
        return select;
    }

    /**
     * Crée un conteneur de canvas avec le style Pecunio
     */
    static createCanvasContainer() {
        const container = document.createElement('div');
        container.classList.add('pecunio-canvas-container');
        return container;
    }

    /**
     * Crée un canvas avec le style Pecunio
     */
    static createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.classList.add('pecunio-canvas');
        return canvas;
    }

    /**
     * Crée un conteneur pour les graphiques côte à côte
     */
    static createChartsRow() {
        const row = document.createElement('div');
        row.classList.add('pecunio-charts-row');
        return row;
    }

    /**
     * Crée un wrapper pour un donut chart
     */
    static createDonutWrapper() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('pecunio-donut-wrapper');
        return wrapper;
    }

    /**
     * Crée un wrapper pour le graphique expense_type
     */
    static createExpenseTypeWrapper() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('pecunio-expense-type-wrapper');
        return wrapper;
    }

    /**
     * Crée un wrapper pour le graphique Sankey
     */
    static createSankeyWrapper() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('pecunio-sankey-wrapper');
        return wrapper;
    }

    /**
     * Crée un graphique donut avec titre et canvas
     */
    static createDonutChart(title, height = '320px') {
        const wrapper = this.createExpenseTypeWrapper();
        const chartTitle = this.createTitle(title);
        wrapper.appendChild(chartTitle);
        
        const canvasContainer = this.createCanvasContainer();
        canvasContainer.style.height = height;
        
        const canvas = document.createElement('canvas');
        canvas.classList.add('canvasDiv');
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);
        
        return { wrapper, canvas };
    }

    /**
     * Crée un graphique Sankey avec titre et canvas
     */
    static createSankeyChart(title) {
        const wrapper = this.createSankeyWrapper();
        const chartTitle = this.createTitle(title);
        wrapper.appendChild(chartTitle);
        
        const canvasContainer = this.createCanvasContainer();
        // Pas de hauteur fixe pour le Sankey, laisser libre pour éviter l'écrasement
        canvasContainer.style.height = 'auto';
        canvasContainer.style.minHeight = '400px';
        
        const canvas = document.createElement('canvas');
        canvas.classList.add('canvasDiv');
        canvas.style.width = '100%';
        // Pas de hauteur fixe sur le canvas, laisser Chart.js gérer
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);
        
        return { wrapper, canvas };
    }

    /**
     * Nettoie les éléments créés par Pecunio dans un conteneur
     */
    static cleanupPecunioElements(container) {
        // Nettoyer les canvas
        // Utiliser querySelectorAll au lieu de getElementsByClassName pour éviter les problèmes
        // avec les HTMLCollection "live" qui se mettent à jour pendant l'itération
        const canvasDivs = container.querySelectorAll('.canvasDiv');
        if (canvasDivs && canvasDivs.length > 0) {
            // Convertir en tableau pour éviter les problèmes avec les NodeList
            // et détruire les instances Chart.js avant de supprimer les canvas
            Array.from(canvasDivs).forEach(canvas => {
                // Détruire l'instance Chart.js si elle existe
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) {
                    chartInstance.destroy();
                }
                canvas.remove();
            });
        }

        // Nettoyer les wrappers
        const expenseTypeWrapper = container.querySelector('.pecunio-expense-type-wrapper');
        if (expenseTypeWrapper) {
            expenseTypeWrapper.remove();
        }

        const sankeyWrapper = container.querySelector('.pecunio-sankey-wrapper');
        if (sankeyWrapper) {
            sankeyWrapper.remove();
        }
    }

    /**
     * Organise le contenu existant dans un wrapper donut
     */
    /**
     * Ligne de cartes du bloc des catégories : donut de Bankin dans une carte
     * « Catégories », puis les cartes Pecunio. `detail` : page de détail d'une
     * catégorie (donut étroit à côté de l'historique).
     * @param {Element} categBlock
     * @param {{ detail?: boolean }} [options]
     * @returns {HTMLElement}
     */
    static prepareChartsRow(categBlock, { detail = false } = {}) {
        this.inject();
        this.cleanupPecunioElements(categBlock);
        let row = /** @type {HTMLElement | null} */ (categBlock.querySelector('.pecunio-charts-row'));
        if (!row) row = this.createChartsRow();
        row.classList.toggle('pecunio-charts-row--detail', detail);
        this.organizeDonutContent(categBlock, row);
        return row;
    }

    static organizeDonutContent(container, chartsRowContainer) {
        let donutWrapper = container.querySelector('.pecunio-donut-wrapper');
        
        if (!donutWrapper) {
            donutWrapper = this.createDonutWrapper();
            const donutTitle = this.createTitle('Catégories');
            donutWrapper.appendChild(donutTitle);
            
            const existingContent = Array.from(container.children);
            // Contenu de Bankin seulement : les cartes Pecunio restent en place
            existingContent.forEach(child => {
                if (![...child.classList].some((c) => c.startsWith('pecunio-'))) {
                    donutWrapper.appendChild(child);
                }
            });
            
            chartsRowContainer.appendChild(donutWrapper);
            container.appendChild(chartsRowContainer);
        }
        
        return donutWrapper;
    }
} 