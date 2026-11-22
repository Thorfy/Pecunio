// Fuseau horaire du processus de test (variable d'environnement TZ).
// La CI lance la suite sous plusieurs fuseaux : certains bugs de dates
// n'apparaissent qu'à l'est ou à l'ouest de UTC.
export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Fuseaux à l'est de UTC en hiver (ex. Europe/Paris, UTC+1). */
export const EAST_OF_UTC = new Date('2024-01-15T12:00:00Z').getTimezoneOffset() < 0;
/** Fuseaux à l'ouest de UTC en hiver (ex. America/New_York, UTC-5). */
export const WEST_OF_UTC = new Date('2024-01-15T12:00:00Z').getTimezoneOffset() > 0;
/** Tout fuseau différent de UTC en hiver. */
export const NOT_UTC = EAST_OF_UTC || WEST_OF_UTC;
