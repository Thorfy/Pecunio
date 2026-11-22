import { describe, expect, test } from 'vitest';
import { CONTENT_SCRIPTS, loadContentScripts } from '../helpers/load.js';

describe('harnais de test', () => {
    test('charge tout le content script dans l\'ordre du manifest', async () => {
        await loadContentScripts();
        expect(CONTENT_SCRIPTS[0]).toBe('js/core/Config.js');
        for (const name of ['Config', 'Evt', 'Settings', 'DataManager', 'DataValidators', 'Transaction', 'DataMerger', 'BaseChartData', 'BudgetChart', 'SankeyChart', 'ExpenseTypeChart', 'LineBarChart']) {
            expect(typeof globalThis[name], name).toBe('function');
        }
        expect(globalThis.evt).toBeInstanceOf(globalThis.Evt);
    });
});
