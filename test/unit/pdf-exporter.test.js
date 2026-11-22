import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PdfExporter } from '../../js/report/PdfExporter.js';

/** Faux html2pdf().set().from().save() qui mémorise l'état du DOM au moment de l'export. */
const fakeHtml2pdf = ({ fail = false } = {}) => {
    const calls = [];
    const html2pdf = vi.fn(() => {
        const chain = {
            set: (opt) => {
                calls.push({ opt });
                return chain;
            },
            from: (element) => {
                calls.at(-1).imagesDuringExport = element.querySelectorAll('img').length;
                calls.at(-1).canvasesDuringExport = element.querySelectorAll('canvas').length;
                return chain;
            },
            save: () => (fail ? Promise.reject(new Error('échec PDF')) : Promise.resolve()),
        };
        return chain;
    });
    return { calls, html2pdf };
};

let container;
beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = '<section><canvas id="a"></canvas></section><section><canvas id="b"></canvas></section>';
    document.body.appendChild(container);
    // happy-dom ne dessine pas : on simule la conversion canvas → JPEG.
    vi.spyOn(PdfExporter.prototype, 'canvasToJpegWithWhiteBg').mockReturnValue('data:image/jpeg;base64,AAAA');
});

afterEach(() => {
    container.remove();
});

describe('PdfExporter', () => {
    test('nom de fichier par défaut daté du jour', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
        expect(new PdfExporter(container).filename).toBe('pecunio_rapport_2024-03-15.pdf');
        expect(new PdfExporter(container, { filename: 'x.pdf' }).filename).toBe('x.pdf');
    });

    test('options par défaut issues de Config', () => {
        const exporter = new PdfExporter(container);
        expect(exporter).toMatchObject({ imageQuality: 1, jpegQuality: 1, fontReadyDelayMs: 400 });
        expect(new PdfExporter(null).getChartCanvases()).toEqual([]);
    });

    test('remplace les canvas par des images puis les restaure', () => {
        const exporter = new PdfExporter(container);
        const restored = exporter.replaceCanvasesWithImagesInPlace();
        expect(restored).toHaveLength(2);
        expect(container.querySelectorAll('canvas')).toHaveLength(0);
        expect(container.querySelector('img').src).toContain('data:image/jpeg');
        exporter.restoreCanvasesAfterPdf();
        expect(container.querySelectorAll('canvas')).toHaveLength(2);
        expect(container.querySelectorAll('img')).toHaveLength(0);
    });

    test('un canvas qui ne se convertit pas est laissé en place', () => {
        PdfExporter.prototype.canvasToJpegWithWhiteBg.mockImplementationOnce(() => {
            throw new Error('tainted');
        });
        expect(new PdfExporter(container).replaceCanvasesWithImagesInPlace()).toHaveLength(1);
    });

    test('fige les graphiques sans animation', () => {
        const chart = { update: vi.fn() };
        PdfExporter.freezeChartsForPdf([chart, null, {}]);
        expect(chart.update).toHaveBeenCalledWith('none');
    });

    test('exportToPdf : images pendant l\'export, canvas restaurés après', async () => {
        const { calls, html2pdf } = fakeHtml2pdf();
        const chart = { update: vi.fn() };
        await new PdfExporter(container, { fontReadyDelayMs: 0, filename: 'r.pdf', html2pdf }).exportToPdf([chart]);
        expect(calls[0]).toMatchObject({ imagesDuringExport: 2, canvasesDuringExport: 0 });
        expect(calls[0].opt).toMatchObject({ filename: 'r.pdf', jsPDF: { format: 'a4' } });
        expect(container.querySelectorAll('canvas')).toHaveLength(2);
        expect(chart.update).toHaveBeenCalled();
    });

    test('exportToPdf : canvas restaurés même si la génération échoue', async () => {
        const { html2pdf } = fakeHtml2pdf({ fail: true });
        await expect(new PdfExporter(container, { fontReadyDelayMs: 0, html2pdf }).exportToPdf()).rejects.toThrow('échec PDF');
        expect(container.querySelectorAll('canvas')).toHaveLength(2);
    });

    test('exportToPdf : html2pdf absent → erreur', async () => {
        await expect(new PdfExporter(container).exportToPdf()).rejects.toThrow('html2pdf non chargé');
    });
});
