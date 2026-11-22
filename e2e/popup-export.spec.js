// Scénarios de bout en bout de la popup : réglages, export CSV, rapport PDF.
// Numéros : plan de modernisation, phase 5 (docs/AUDIT-MODERNISATION.md).
import { readFile } from 'node:fs/promises';
import { bankinUrl, expect, openPopup, test } from './fixtures.js';

const LINE_CHART = '#originalChartContainer canvas';

/** Onglet Bankin ouvert sur la page Comptes, données chargées dans le cache. */
async function openBankin(context) {
    const page = await context.newPage();
    await page.goto(bankinUrl('/accounts'));
    await expect(page.locator(LINE_CHART)).toBeVisible();
    return page;
}

/** Saisit une date dans la popup (enregistrée quand le champ perd le focus). */
async function setDate(popup, id, value) {
    await popup.locator(`#${id}`).fill(value);
    await popup.locator(`#${id}`).blur();
}

test('7 — popup : changer la période met à jour l\'onglet Bankin', async ({ context, extensionId, bankin, serviceWorker, consoleErrors }) => {
    const bankinPage = await openBankin(context);
    const popup = await openPopup(context, extensionId);
    // Comptes du cache proposés par la popup
    await expect(popup.locator('.choices__item--selectable', { hasText: 'Compte courant' }).first()).toBeAttached();

    await bankinPage.locator(LINE_CHART).evaluate((canvas) => canvas.setAttribute('data-avant', ''));
    await setDate(popup, 'startDate', '2024-02-01');

    await expect
        .poll(() => serviceWorker.evaluate(() => chrome.storage.local.get('startDate')))
        .toEqual({ startDate: '2024-02-01' });
    // Le graphique de l'onglet Bankin est reconstruit avec la nouvelle période
    await expect(bankinPage.locator(`${LINE_CHART}:not([data-avant])`)).toBeVisible();
    expect(consoleErrors).toEqual([]);
});

test('8a — export CSV : fichier téléchargé, période et contenu attendus', async ({ context, extensionId, bankin, consoleErrors }) => {
    await openBankin(context);
    const popup = await openPopup(context, extensionId);
    await setDate(popup, 'startDate', '2024-02-01');
    await popup.locator('#noEndDate').uncheck();
    await setDate(popup, 'endDate', '2024-02-29');

    const [download] = await Promise.all([popup.waitForEvent('download'), popup.locator('#exportCsv').click()]);
    expect(download.suggestedFilename()).toMatch(/^transaction_export_\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = (await readFile(await download.path(), 'utf8')).replace(/^\uFEFF/, '');
    const [header, ...rows] = csv.trim().split(/\r?\n/);

    expect(header).toContain('Transaction ID');
    expect(header).toContain('Budget Month');
    // Février 2024 uniquement : les 5 transactions du mois (données synthétiques)
    expect(rows).toHaveLength(5);
    expect(csv).toContain('Loyer février');
    expect(csv).not.toContain('Loyer janvier');
    expect(csv).not.toContain('Loyer mars');
    expect(consoleErrors).toEqual([]);
});

test('8b — rapport PDF : page du rapport puis PDF téléchargé', async ({ context, extensionId, bankin, consoleErrors, externalRequests }) => {
    await openBankin(context);
    const popup = await openPopup(context, extensionId);
    await popup.locator('#pdfYear').selectOption('2024');
    await popup.locator('#pdfMonth').selectOption({ label: 'Toute l\'année' });

    const [report] = await Promise.all([context.waitForEvent('page'), popup.locator('#exportPdf').click()]);
    await report.waitForLoadState();
    await expect(report.locator('#report-period')).toContainText('2024');
    await expect(report.locator('#stat-count')).not.toHaveText('—');
    await expect(report.locator('table tbody tr').first()).toBeVisible();

    const [download] = await Promise.all([
        report.waitForEvent('download', { timeout: 30_000 }),
        report.locator('#btn-download-pdf').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    // Popup et rapport sans service tiers (badges, polices) : U12
    expect(externalRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
});
