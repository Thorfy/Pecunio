// Service worker de l'extension (voir js/background/authHeaders.js).
import { defineBackground } from 'wxt/utils/define-background';
import { startAuthHeaderRelay } from '../js/background/authHeaders.js';

export default defineBackground(() => {
    startAuthHeaderRelay();
});
