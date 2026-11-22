// Faux objets pour tester PageController (fenêtre, classes de graphiques).
import { vi } from 'vitest';

/** Fausse fenêtre : URL modifiable, événements déclenchables, minuteurs de Vitest. */
export const makeWin = (href) => {
    const listeners = {};
    return {
        location: { href, reload: vi.fn() },
        document,
        addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
        fire: (type) => (listeners[type] || []).forEach((fn) => fn(new Event(type))),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
    };
};

/** Fausses classes de graphiques qui enregistrent leurs instances. */
export const makeCharts = () => {
    const created = [];
    class FakeChart {
        constructor(...args) {
            this.args = args;
            this.destroy = vi.fn();
            this.kind = this.constructor.name;
            created.push(this);
        }
        static createMainContainer(homeBlock) {
            homeBlock.innerHTML = '';
            const main = document.createElement('div');
            homeBlock.appendChild(main);
            return main;
        }
        static prepareContainer(block) {
            const row = document.createElement('div');
            row.className = 'pecunio-charts-row';
            block.appendChild(row);
            return row;
        }
        createContainer(parent) {
            const container = document.createElement('div');
            parent.appendChild(container);
            return container;
        }
        createUI(id) {
            this.containerId = id;
        }
    }
    class LineBarChart extends FakeChart {
        async render() {
            this.rendered = true;
        }
    }
    class BudgetChart extends FakeChart {}
    class ExpenseTypeChart extends FakeChart {
        async render(row) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pecunio-expense-type-wrapper';
            wrapper.appendChild(document.createElement('canvas'));
            row.appendChild(wrapper);
        }
    }
    class SankeyChart extends FakeChart {
        async render(block) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pecunio-sankey-wrapper';
            block.appendChild(wrapper);
        }
    }
    return { classes: { LineBarChart, BudgetChart, ExpenseTypeChart, SankeyChart }, created };
};
