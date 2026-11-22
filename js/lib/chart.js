/**
 * Chart.js configuré pour Pecunio : tous les types de base, l'adaptateur de
 * dates (axe temporel, en français) et le diagramme de Sankey.
 * Les modules importent `Chart` d'ici plutôt que de 'chart.js' directement.
 */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { Flow, SankeyController } from 'chartjs-chart-sankey';
import { fr } from 'date-fns/locale';
import { applyChartTheme } from '../ui/theme.js';

Chart.register(SankeyController, Flow);

// Nombres des axes au format français (1 234,5)
Chart.defaults.locale = 'fr-FR';
// Police et couleurs de Bankin
applyChartTheme(Chart);

/** Langue des dates des axes temporels (`adapters.date.locale`) : « janv. 2026 ». */
export const DATE_LOCALE = fr;

export { Chart };
