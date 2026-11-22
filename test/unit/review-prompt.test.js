import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ReviewPrompt } from '../../js/ui/ReviewPrompt.js';

const overlays = () => document.querySelectorAll(`#${ReviewPrompt.DOM.OVERLAY_ID}`);

beforeEach(() => {
    vi.useFakeTimers();
    ReviewPrompt._scheduled = false;
});

afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
});

describe('ReviewPrompt._shouldShow', () => {
    const DAY = ReviewPrompt.MS_PER_DAY;

    test('pas avant le nombre minimal de constructions', () => {
        expect(ReviewPrompt._shouldShow(ReviewPrompt.MIN_BUILDS_BEFORE_PROMPT - 1, 'none', 0)).toBe(false);
        expect(ReviewPrompt._shouldShow(ReviewPrompt.MIN_BUILDS_BEFORE_PROMPT, 'none', 0)).toBe(true);
    });

    test('jamais après « avis laissé » ou « ne plus demander »', () => {
        expect(ReviewPrompt._shouldShow(100, 'reviewed', 0)).toBe(false);
        expect(ReviewPrompt._shouldShow(100, 'never', 0)).toBe(false);
    });

    test('« plus tard » : de nouveau après le délai', () => {
        vi.setSystemTime(new Date(2024, 2, 20));
        const now = Date.now();
        expect(ReviewPrompt._shouldShow(100, 'dismissed', now - (ReviewPrompt.DISMISS_DELAY_DAYS - 1) * DAY)).toBe(false);
        expect(ReviewPrompt._shouldShow(100, 'dismissed', now - (ReviewPrompt.DISMISS_DELAY_DAYS + 1) * DAY)).toBe(true);
    });
});

describe('ReviewPrompt.tryShow', () => {
    test('compte les constructions', async () => {
        await ReviewPrompt.tryShow();
        await ReviewPrompt.tryShow();
        expect(chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.BUILD_COUNT]).toBe(2);
    });

    test('affiche la modale après le délai, une fois le seuil atteint', async () => {
        chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.BUILD_COUNT] = ReviewPrompt.MIN_BUILDS_BEFORE_PROMPT;
        await ReviewPrompt.tryShow();
        expect(overlays()).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(ReviewPrompt.SHOW_DELAY_MS);
        expect(overlays()).toHaveLength(1);
    });

    test('B21 — deux constructions rapprochées n\'affichent qu\'une seule modale', async () => {
        chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.BUILD_COUNT] = ReviewPrompt.MIN_BUILDS_BEFORE_PROMPT;
        await ReviewPrompt.tryShow();
        await ReviewPrompt.tryShow();
        await vi.advanceTimersByTimeAsync(ReviewPrompt.SHOW_DELAY_MS * 2);
        expect(overlays()).toHaveLength(1);
        await ReviewPrompt.tryShow();
        await vi.advanceTimersByTimeAsync(ReviewPrompt.SHOW_DELAY_MS * 2);
        expect(overlays()).toHaveLength(1);
    });

    test('« Plus tard » ferme la modale et mémorise la date', async () => {
        chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.BUILD_COUNT] = ReviewPrompt.MIN_BUILDS_BEFORE_PROMPT;
        await ReviewPrompt.tryShow();
        await vi.advanceTimersByTimeAsync(ReviewPrompt.SHOW_DELAY_MS);
        document.getElementById(ReviewPrompt.DOM.LATER_ID).click();
        await vi.advanceTimersByTimeAsync(ReviewPrompt.DOM.CLOSE_ANIMATION_MS);
        expect(overlays()).toHaveLength(0);
        expect(chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.STATE]).toBe(ReviewPrompt.STATE.DISMISSED);
        expect(typeof chrome.storage.local._data[ReviewPrompt.STORAGE_KEYS.DISMISSED_AT]).toBe('number');
    });
});
