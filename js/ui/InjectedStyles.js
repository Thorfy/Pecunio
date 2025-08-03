/**
 * InjectedStyles - Styles partagés pour tous les éléments injectés sur Bankin
 * Design cohérent avec la popup mais adapté pour l'espace réduit du site
 */
class InjectedStyles {
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .pecunio-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .pecunio-title::before {
                content: '';
                width: 3px;
                height: 18px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 2px;
            }

            .pecunio-section {
                background: #fff;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid #f0f0f0;
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
                border-color: #667eea;
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
                background: linear-gradient(135deg, #667eea, #764ba2);
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
            .pecunio-blurred {
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
                color: #666;
                margin-top: 8px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 6px;
                border-left: 3px solid #667eea;
            }

            /* Styles pour les badges/étiquettes */
            .pecunio-badge {
                display: inline-block;
                padding: 2px 6px;
                font-size: 11px;
                font-weight: 500;
                border-radius: 4px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }

            /* Styles pour les séparateurs */
            .pecunio-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e1e5e9, transparent);
                margin: 12px 0;
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
     * Crée une section avec le style Pecunio
     */
    static createSection() {
        const section = document.createElement('div');
        section.classList.add('pecunio-section');
        return section;
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
     * Crée un bouton avec le style Pecunio
     */
    static createButton(text, isSecondary = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.classList.add('pecunio-button');
        if (isSecondary) {
            button.classList.add('pecunio-button-secondary');
        }
        return button;
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
} 