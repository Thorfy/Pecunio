// Manifest généré par WXT (wxt.config.js) : contraintes du Chrome Web Store.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import config from '../../wxt.config.js';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

describe('Manifest', () => {
    test('description en français, 132 caractères au plus (D12)', () => {
        const { description } = config.manifest;
        expect(description.length).toBeLessThanOrEqual(132);
        expect(description).toMatch(/^Enrichit Bankin/);
    });

    test('permissions limitées à Bankin', () => {
        expect(config.manifest.permissions.sort()).toEqual(['storage', 'unlimitedStorage', 'webRequest']);
        expect(config.manifest.host_permissions).toEqual(['https://*.bankin.com/*']);
    });

    test('version sémantique (reprise de package.json dans le manifest)', () => {
        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(config.manifest.version).toBeUndefined();
    });
});
