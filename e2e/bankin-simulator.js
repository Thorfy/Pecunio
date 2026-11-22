// Bankin simulé pour les tests de bout en bout.
//
// - app2.bankin.com : pages HTML minimales reprenant la structure des vraies
//   pages (voir test/fixtures/bankin-pages/), avec un petit script qui imite
//   l'application Bankin : appel authentifié à /v2/accounts (capturé par le
//   service worker de Pecunio), sélecteur de mois, bouton ↻, navigation SPA.
// - sync.bankin.com : API v2 répondant avec les données SYNTHÉTIQUES de
//   test/fixtures/bankin.js (aucune donnée réelle).
import { ACCOUNTS, AUTH_HEADERS, CATEGORIES, apiPage, sampleTransactions } from '../test/fixtures/bankin.js';

const APP_ORIGIN = 'https://app2.bankin.com';

const CORS_HEADERS = {
    'access-control-allow-origin': APP_ORIGIN,
    'access-control-allow-headers': [...Object.keys(AUTH_HEADERS), 'Content-Type'].join(', '),
    'access-control-allow-methods': 'GET, OPTIONS',
};

/** Mois proposés par défaut par le sélecteur de la page Catégories (données de 2024). */
const DEFAULT_MONTHS = [
    { label: 'Janvier 2024', short: 'Janv.' },
    { label: 'Février 2024', short: 'Févr.' },
    { label: 'Mars 2024', short: 'Mars' },
];

/** Réglages de la page simulée (voir installBankinSimulator). */
let MONTHS = DEFAULT_MONTHS;
let extraCss = '';

const header = `
<td class="bgw vam topHeader"><header class="dtb tlf w100">
  <div class="dtc w33 vam tac"><span class="dbl fs14 fw7 lh18 elp">2 345,67 €</span><span class="dbl fs1 elp">Solde total</span></div>
  <div class="dtc w33 vam tar"><a class="dib vam fcbe cpo mr12 refreshIcon"><span class="dib vam fs2 bkIcon_refresh">↻</span></a></div>
</header></td>`;

const accountsBody = `
<tr>${header}</tr>
<tr><td class="vat rel leftColumn"><div class="scrollable"><section><div class="accountList"><ul>
  <li class="bgw"><a class="dbl cntr accountRow"><div class="m1 ml15 mr15"><div class="tlf w100 fs1">
    <div class="dtc vam">Compte courant</div><div class="dtc vam tar w30 amountGreen"><span class="dbl elp ml04 fw6">1 234,56 €</span></div>
  </div></div></a></li>
  <li class="bgw"><a class="dbl cntr accountRow"><div class="m1 ml15 mr15"><div class="tlf w100 fs1">
    <div class="dtc vam">Livret A</div><div class="dtc vam tar w30 amountGreen"><span class="dbl elp ml04 fw6">1 111,11 €</span></div>
  </div></div></a></li>
</ul></div></section></div></td>
<td class="vat rel rightColumn"><div class="scrollable bgw homeBlock"><p>Bienvenue sur Bankin</p></div></td></tr>`;

const categoriesBody = (activeIndex) => `
<tr><td class="bgw vam topAnalytics rel"><section><nav id="monthSelector" class="fs09 fw6 tac">
  ${MONTHS.map((m, i) => `<a class="dib${i === activeIndex ? ' active' : ''}" data-index="${i}"><span class="dib">${i === activeIndex ? m.label : m.short}</span></a>`).join('')}
</nav></section></td></tr>
<tr><td class="vat rel leftColumn"><div id="contentList" class="scrollable"><ul class="bgw active">
  <li><a class="dbl cntr categoryRow"><div class="m1 ml15 mr15"><div class="dtb tlf w100 fs1"><div class="dtc vam">Logement</div><div class="dtc vam tar w30"><span class="dbl elp ml04 fs11 fw7">800,00 €</span></div></div></div></a></li>
  <li><a class="dbl cntr categoryRow"><div class="m1 ml15 mr15"><div class="dtb tlf w100 fs1"><div class="dtc vam">Alimentation</div><div class="dtc vam tar w30"><span class="dbl elp ml04 fs11 fw7">150,00 €</span></div></div></div></a></li>
</ul></div></td>
<td class="vat rel rightColumn"><div class="scrollable categoryChart"><div class="cntr dtb h100 active"><div class="dtc vam">
  <div class="mt2 tac"><span class="dbl fs2 fw7">950,00 €</span><span class="dbl fs1">Total des dépenses</span></div>
  <div id="donutChart" class="m0a mt2 mb1"><svg width="100" height="100"><g><g class="arc"><text>84 %</text></g></g></svg></div>
</div></div></div></td></tr>`;

const incomeBody = `
<tr><td class="vat rel leftColumn"><div id="contentList" class="scrollable"><ul class="bgw active">
  <li><a class="dbl cntr categoryRow"><div class="m1 ml15 mr15"><div class="dtb tlf w100 fs1"><div class="dtc vam">Salaires</div><div class="dtc vam tar w30"><span class="dbl elp ml04 fs11 fw7">2 500,00 €</span></div></div></div></a></li>
</ul></div></td>
<td class="vat rel rightColumn"><div class="scrollable categoryChart"><div class="cntr dtb h100 active"><div class="dtc vam">
  <div class="mt2 tac"><span class="dbl fs2 fw7">2 500,00 €</span><span class="dbl fs1">Total des revenus</span></div>
</div></div></div></td></tr>`;

/** Contenu de la page selon le chemin (aussi utilisé pour la navigation SPA). */
function bodyFor(pathname) {
    if (pathname === '/accounts') return accountsBody;
    if (pathname === '/categories') return categoriesBody(MONTHS.length - 1);
    if (pathname.startsWith('/categories/')) return incomeBody;
    return '';
}

/** Script de l'application Bankin simulée. */
const appScript = (authHeaders, bodies) => `
(() => {
  const AUTH = ${JSON.stringify(authHeaders)};
  const BODIES = ${JSON.stringify(bodies)};
  const MONTHS = ${JSON.stringify(MONTHS)};
  // Comme Bankin : appel authentifié à l'API (capturé par le service worker de Pecunio)
  const loadAccounts = () => fetch('https://sync.bankin.com/v2/accounts?limit=200', { headers: AUTH });
  const render = (pathname) => {
    document.querySelector('#bankin-content').innerHTML = BODIES[pathname] || '';
  };
  document.addEventListener('click', (event) => {
    const month = event.target.closest('#monthSelector a');
    if (month) {
      document.querySelectorAll('#monthSelector a').forEach((link, i) => {
        const active = link === month;
        link.classList.toggle('active', active);
        link.querySelector('span').textContent = active ? MONTHS[i].label : MONTHS[i].short;
      });
    }
    if (event.target.closest('.refreshIcon')) loadAccounts();
  });
  // Navigation interne (SPA), comme les onglets Dépenses / Revenus de Bankin
  window.__bankinNavigate = (pathname) => {
    history.pushState({}, '', pathname);
    render(pathname);
  };
  loadAccounts();
  // Comme Bankin au chargement : mise à jour des montants qui réécrit leur
  // attribut class (et efface toute classe ajoutée par une extension)
  setTimeout(() => {
    document.querySelectorAll('.dbl.fs14.fw7.lh18.elp, .amountGreen, .amountRed, .amountBlack').forEach((el) => {
      el.className = el.className.split(' ').filter((c) => !c.startsWith('pecunio')).join(' ');
    });
  }, 1500);
})();`;

function renderPage(pathname) {
    if (pathname === '/signin') {
        return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bankin' - Connexion</title></head>
<body><form id="signin"><input type="email" placeholder="Votre email"><button type="submit">Me connecter</button></form></body></html>`;
    }
    const bodies = Object.fromEntries(['/accounts', '/categories', '/categories/2'].map((p) => [p, bodyFor(p)]));
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bankin' (simulé)</title><style>${extraCss}</style></head>
<body><div id="root" class="content h100"><section class="cntr mw100 w100 dashboard dtb h100"><section class="dtc vat h100">
<table class="w100 h100"><tbody id="bankin-content">${bodyFor(pathname)}</tbody></table>
</section></section></div>
<script>${appScript(AUTH_HEADERS, bodies)}</script></body></html>`;
}

/**
 * Installe le Bankin simulé sur un contexte Playwright.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ transactions?: object[], categories?: object[], accounts?: object[],
 *   months?: { label: string, short: string }[], css?: string }} [data]
 *   months : mois du sélecteur de la page Catégories (le dernier est affiché) ;
 *   css : styles ajoutés à la page (ex. couleurs des catégories de Bankin)
 * @returns {Promise<{ apiCalls: string[] }>} appels reçus par l'API (chemin + requête)
 */
export async function installBankinSimulator(context, data = {}) {
    MONTHS = data.months ?? DEFAULT_MONTHS;
    extraCss = data.css ?? '';
    const state = {
        apiCalls: [],
        transactions: data.transactions ?? sampleTransactions(),
        categories: data.categories ?? CATEGORIES,
        accounts: data.accounts ?? ACCOUNTS,
    };

    await context.route('https://sync.bankin.com/**', async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
        const url = new URL(request.url());
        state.apiCalls.push(url.pathname + url.search);
        let resources = [];
        if (url.pathname.startsWith('/v2/transactions')) resources = state.transactions;
        else if (url.pathname.startsWith('/v2/categories')) resources = state.categories;
        else if (url.pathname.startsWith('/v2/accounts')) resources = state.accounts;
        else if (url.pathname.startsWith('/v2/items')) return route.fulfill({ status: 200, headers: CORS_HEADERS, json: {} });
        return route.fulfill({ status: 200, headers: CORS_HEADERS, json: apiPage(resources) });
    });

    await context.route(`${APP_ORIGIN}/**`, async (route) => {
        const { pathname } = new URL(route.request().url());
        if (/\.(png|gif|ico|svg|css|js)$/.test(pathname)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: renderPage(pathname) });
    });

    return state;
}
