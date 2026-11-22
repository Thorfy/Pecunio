// Captures d'écran du README (docs/assets/screens/), sur le Bankin simulé
// avec le jeu de démonstration SYNTHÉTIQUE de e2e/demo-data.js.
// Usage : npm run screens   (construit l'extension, puis lance Chromium)
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { installBankinSimulator } from '../e2e/bankin-simulator.js';
import { CATEGORY_COLORS_CSS, DEMO_ACCOUNTS, DEMO_CATEGORIES, demoTransactions } from '../e2e/demo-data.js';

const EXTENSION = path.resolve('.output/chrome-mv3');
const OUT = path.resolve('docs/assets/screens');

// Dernier mois complet : les données s'arrêtent à la fin du mois précédent
const now = new Date();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const monthLabel = (date, long) =>
    date.toLocaleDateString('fr-FR', { month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) }).replace(/^./, (c) => c.toUpperCase());
const months = [2, 1, 0].map((back) => {
    const date = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - back, 1);
    return { label: monthLabel(date, true), short: monthLabel(date, false) };
});

const LAYOUT_CSS = `
body { margin: 0; background: #f4f6fb; font-family: "Open Sans", Arial, sans-serif; color: #00213c; }
table { width: 100%; }
.leftColumn { width: 320px; min-width: 320px; background: #fff; }
.rightColumn { width: 100%; padding: 16px; }
.topHeader { height: 64px; text-align: center; }`;

await mkdir(OUT, { recursive: true });
const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    deviceScaleFactor: 2,
    viewport: { width: 1360, height: 1000 },
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extensionId = new URL(worker.url()).host;
await installBankinSimulator(context, {
    transactions: demoTransactions({ until: lastMonth }),
    categories: DEMO_CATEGORIES,
    accounts: DEMO_ACCOUNTS,
    months,
    css: CATEGORY_COLORS_CSS + LAYOUT_CSS,
});
const settle = (page) => page.waitForTimeout(1500); // animations de Chart.js

// Page Comptes : graphique temporel et comparaison budget
const bankin = await context.newPage();
await bankin.goto('https://app2.bankin.com/accounts');
await bankin.locator('#budgetChartBlock canvas').waitFor();
await settle(bankin);
await bankin.locator('#originalChartContainer').screenshot({ path: `${OUT}/depenses-par-mois.png` });
await bankin.locator('#budgetChartBlock').screenshot({ path: `${OUT}/comparaison-budget.png` });

// Page Catégories : types de dépenses et flux financiers du dernier mois complet
await bankin.goto('https://app2.bankin.com/categories');
await bankin.locator('.pecunio-sankey-wrapper canvas').waitFor();
await settle(bankin);
await bankin.locator('.pecunio-expense-type-wrapper').screenshot({ path: `${OUT}/types-de-depenses.png` });
await bankin.locator('.pecunio-sankey-wrapper').screenshot({ path: `${OUT}/flux-financiers.png` });

// Popup et rapport PDF
const popup = await context.newPage();
await popup.setViewportSize({ width: 400, height: 1000 });
await popup.goto(`chrome-extension://${extensionId}/popup.html`);
// Instructions d'épinglage masquées (sans objet sur une capture)
await popup.locator('#pinInstructionsSection').evaluate((section) => section.style.setProperty('display', 'none'));
await settle(popup);
await popup.locator('.container').screenshot({ path: `${OUT}/popup.png` });

await popup.locator('#pdfYear').selectOption(String(lastMonth.getFullYear()));
const [report] = await Promise.all([context.waitForEvent('page'), popup.locator('#exportPdf').click()]);
await report.setViewportSize({ width: 1100, height: 1000 });
await report.waitForLoadState();
await report.locator('table tbody tr').first().waitFor();
await settle(report);
await report.screenshot({ path: `${OUT}/rapport.png`, clip: { x: 0, y: 0, width: 1100, height: 1000 } });

await context.close();
console.log(`Captures enregistrées dans ${OUT}`);
