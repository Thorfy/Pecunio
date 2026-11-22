/**
 * Chart.js configuré pour Pecunio : tous les types de base, l'adaptateur de
 * dates (axe temporel) et le diagramme de Sankey.
 * Les modules importent `Chart` d'ici plutôt que de 'chart.js' directement.
 */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { Flow, SankeyController } from 'chartjs-chart-sankey';

Chart.register(SankeyController, Flow);

export { Chart };
