/**
 * Bus d'événements partagé par les modules d'une même page (content script,
 * popup ou rapport : chaque page a sa propre instance).
 */
import { Evt } from './Evt.js';

export const evt = new Evt();
