import { describe, expect, test } from 'vitest';
import { loadContentScripts } from '../helpers/load.js';

describe('harnais de test', () => {
    test('expose les classes de l\'extension et l\'instance partagée evt', async () => {
        await loadContentScripts();
        for (const name of ['Config', 'Evt', 'Settings', 'DataManager', 'DataValidators', 'Transaction', 'DataMerger', 'BaseChartData', 'BudgetChart', 'SankeyChart', 'ExpenseTypeChart', 'LineBarChart', 'PageController', 'Chart']) {
            expect(typeof globalThis[name], name).toBe('function');
        }
        const { evt } = await import('/js/core/events.js');
        expect(globalThis.evt).toBe(evt);
        expect(evt).toBeInstanceOf(globalThis.Evt);
    });
});
