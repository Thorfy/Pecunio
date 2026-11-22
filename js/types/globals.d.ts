// Compléments de types pour l'environnement navigateur (vérification JSDoc, `npm run typecheck`).
export {};

declare global {
    interface Window {
        /** État du masquage des montants, partagé avec les graphiques Chart.js. */
        __pecunioIsBlurry?: boolean;
        /** API Navigation (Chrome 102+), utilisée pour détecter les navigations de Bankin. */
        navigation?: EventTarget;
    }
}
