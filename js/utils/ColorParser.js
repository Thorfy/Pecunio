/**
 * ColorParser - Utilitaire pour parser les couleurs CSS
 * Extrait les couleurs depuis les classes CSS de Bankin
 */
class ColorParser {
    /**
     * Parse une couleur CSS depuis une classe CSS
     * @param {string} strClass - La classe CSS (ex: "categoryColor_123")
     * @returns {string} - La couleur au format RGB/RGBA
     */
    static parseColorCSS(strClass) {
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);

        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();

        return colorVal;
    }
} 