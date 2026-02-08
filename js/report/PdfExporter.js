/**
 * PdfExporter - Génération du PDF du rapport
 * Remplace les canvas par des images, capture avec html2pdf, restaure les canvas
 */
class PdfExporter {
    /**
     * @param {HTMLElement} container - Élément racine à exporter (#report-container)
     * @param {Object} options - Options (filename, imageQuality, etc.)
     */
    constructor(container, options = {}) {
        this.container = container;
        const reportCfg = typeof Config !== 'undefined' && Config.REPORT && Config.REPORT.PDF
            ? Config.REPORT.PDF
            : {};
        this.filename = options.filename != null
            ? options.filename
            : (reportCfg.DEFAULT_FILENAME_PREFIX || 'pecunio_rapport_') + new Date().toISOString().slice(0, 10) + '.pdf';
        this.imageQuality = options.imageQuality != null ? options.imageQuality : (reportCfg.IMAGE_QUALITY ?? 0.88);
        this.jpegQuality = options.jpegQuality != null ? options.jpegQuality : (reportCfg.JPEG_QUALITY ?? 1);
        this.fontReadyDelayMs = options.fontReadyDelayMs != null ? options.fontReadyDelayMs : (reportCfg.FONT_READY_DELAY_MS ?? 400);
        this._restored = [];
    }

    /**
     * Retourne tous les canvas du container
     * @returns {HTMLCanvasElement[]}
     */
    getChartCanvases() {
        if (!this.container) return [];
        const canvases = this.container.querySelectorAll('canvas');
        return Array.from(canvases);
    }

    /**
     * Dessine un canvas sur fond blanc et retourne un data URL JPEG
     * @param {HTMLCanvasElement} srcCanvas
     * @param {number} quality
     * @returns {string}
     */
    canvasToJpegWithWhiteBg(srcCanvas, quality = 0.88) {
        const w = srcCanvas.width;
        const h = srcCanvas.height;
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(srcCanvas, 0, 0);
        return off.toDataURL('image/jpeg', quality);
    }

    /**
     * Remplace les canvas par des images dans le container (pour PDF)
     * @returns {Array<{canvas: HTMLCanvasElement, img: HTMLImageElement, parent: HTMLElement}>} Liste pour restauration
     */
    replaceCanvasesWithImagesInPlace() {
        const sourceCanvases = this.getChartCanvases();
        const restored = [];
        sourceCanvases.forEach((srcCanvas) => {
            try {
                const dataUrl = this.canvasToJpegWithWhiteBg(srcCanvas, this.imageQuality);
                const img = document.createElement('img');
                img.src = dataUrl;
                img.alt = '';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                img.style.objectFit = 'contain';
                const parent = srcCanvas.parentElement;
                if (parent) {
                    parent.replaceChild(img, srcCanvas);
                    restored.push({ canvas: srcCanvas, img, parent });
                }
            } catch (e) {
                console.warn('[PdfExporter] Canvas to image failed for', srcCanvas.id, e);
            }
        });
        this._restored = restored;
        return restored;
    }

    /**
     * Restaure les canvas après l'export PDF
     * @param {Array<{canvas: HTMLCanvasElement, img: HTMLImageElement, parent: HTMLElement}>} restored - Liste retournée par replaceCanvasesWithImagesInPlace
     */
    restoreCanvasesAfterPdf(restored) {
        (restored || this._restored).forEach(({ canvas, img, parent }) => {
            if (parent && img.parentNode === parent) {
                parent.replaceChild(canvas, img);
            }
        });
        this._restored = [];
    }

    /**
     * Met à jour les graphiques en mode sans animation pour figer le rendu (évite de muter
     * c.options qui provoque une récursion infinie avec les proxies Chart.js).
     * @param {Array<Object>} chartInstances - Instances Chart.js
     */
    static freezeChartsForPdf(chartInstances) {
        chartInstances.forEach(c => {
            if (c && typeof c.update === 'function') c.update('none');
        });
    }

    /**
     * Lance l'export PDF (remplacement canvas → images, html2pdf, restauration)
     * @param {Array<Object>} chartInstances - Instances Chart.js à figer avant export
     * @returns {Promise<void>}
     */
    exportToPdf(chartInstances = []) {
        if (typeof html2pdf === 'undefined') {
            return Promise.reject(new Error('html2pdf non chargé'));
        }

        PdfExporter.freezeChartsForPdf(chartInstances);

        const opt = {
            margin: 0,
            filename: this.filename,
            image: { type: 'jpeg', quality: this.jpegQuality },
            html2canvas: {
                scale: 1,
                useCORS: true,
                logging: false,
                allowTaint: false,
                backgroundColor: '#ffffff',
                foreignObjectRendering: false,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const doPdf = () => {
            const restored = this.replaceCanvasesWithImagesInPlace();
            window.scrollTo(0, 0);
            if (this.container && this.container.scrollTop !== 0) this.container.scrollTop = 0;

            return html2pdf().set(opt).from(this.container).save()
                .then(() => this.restoreCanvasesAfterPdf(restored))
                .catch(err => {
                    this.restoreCanvasesAfterPdf(restored);
                    throw err;
                });
        };

        const runAfterReady = () => new Promise((resolve, reject) => {
            requestAnimationFrame(() => {
                setTimeout(() => doPdf().then(resolve).catch(reject), this.fontReadyDelayMs);
            });
        });

        if (document.fonts && document.fonts.ready) {
            return document.fonts.ready.then(runAfterReady).catch(() => runAfterReady());
        }
        return runAfterReady();
    }
}
