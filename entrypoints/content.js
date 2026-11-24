// Content script injecté dans les pages Bankin (voir js/content/main.js).
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startPecunio } from '../js/content/main.js';

export default defineContentScript({
    matches: ['https://app2.bankin.com/*'],
    main() {
        startPecunio();
    },
});
