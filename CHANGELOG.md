# Changelog

Modifications visibles par les utilisateurs de Pecunio. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions
[sémantiques](https://semver.org/lang/fr/).

Avant une release : renommer « Non publié » en `[X.Y.Z] - AAAA-MM-JJ` (même
version que `package.json`), voir [docs/RELEASE.md](docs/RELEASE.md).

## [Non publié]

## [0.6.1] - 2026-11-25

### Ajouté
- Rythme de l'année sur la page Comptes : dépenses cumulées jour après jour d'une année au choix, comparées à une autre année ou à la médiane des années précédentes (jusqu'à 5). Affiché dès qu'une année complète est disponible.

### Modifié
- Page Comptes plus compacte : comparaison du budget et rythme de l'année côte à côte (empilés quand la place manque), épargne en bas, graphique des dépenses moins haut.
- Permissions réduites : Pecunio n'accède plus qu'à l'application Bankin (app2.bankin.com) et à son API (sync.bankin.com), et non plus à tous les sites *.bankin.com.

### Corrigé
- Sécurité : les identifiants de session Bankin ne peuvent plus être envoyés hors de sync.bankin.com, même si l'API renvoyait une adresse de page suivante piégée.
- Rapport : le bouton « Fermer » de l'écran d'erreur fonctionne (il était bloqué par la politique de sécurité de Chrome).

## [0.6.0] - 2026-11-22

### Ajouté
- Épargne sur la page Comptes : solde de chaque mois (vert ou rouge) et taux d'épargne, sur la période du graphique des dépenses.
- Plus fortes variations sur la page Catégories : les catégories dont la dépense s'écarte le plus de leur habitude (au même jour du mois pour le mois en cours).
- Rapport PDF : taux d'épargne et, sur plusieurs mois, solde et épargne mois par mois.
- Historique d'une catégorie : sur la page de détail d'une catégorie, ses 12 derniers mois par sous-catégorie, aux couleurs de Bankin, avec la médiane et le mois affiché mis en avant.
- Revenus sur 12 mois : l'onglet Revenus montre l'évolution des revenus par source.
- Rythme du mois sur la page Catégories : dépenses cumulées jour après jour, comparées au rythme habituel au même jour.
- Popup refaite à l'identité Pecunio : période en un clic (ce mois, 3 mois, 12 mois, tout), sections plus claires, actions rares repliées dans « Avancé », astuce d'épinglage refermable.
- Page Catégories : répartition par catégorie (donut de Bankin) et par type de dépense réunies en un bloc compact, au même format ; type principal du mois en tête et part de chaque type dans la légende.
- Flux financiers plus lisibles : petits montants regroupés, « Non dépensé » et « Dépassement » quand les dépenses dépassent les revenus.
- Graphique des dépenses : période au choix (6, 12, 24 mois ou tout), 12 mois par défaut, ligne du solde de chaque mois, vue simplifiée (5 catégories principales + « Autres ») ou toutes les catégories.
- Comparaison du budget repensée : « Mois dernier », « Ce mois-ci » ou « Cette année » en un clic, dépenses triées en barres horizontales, total et écart affichés ; « Personnaliser » pour d'autres périodes.
- Interface des graphiques entièrement en français : mois des axes (« janv. 2026 »), montants au format `-1 234,50 €`, libellés de la comparaison budget (« Tous les mois », « Réel févr. 2024 », « Médiane 2026 »).
- Bouton « Afficher en courbes / en barres » au-dessus du graphique temporel, utilisable au clavier et par les lecteurs d'écran (remplace « Toggle chart type » dessiné dans le graphique).
- Bandeau d'état dans la page Bankin : chargement des données en cours, erreur de session ou de réseau avec bouton « Recharger ».
- Export CSV : vraie date de chaque transaction et colonne « Budget Month » (mois de rattachement choisi dans Bankin).
- Les catégories masquées dans la légende du graphique temporel le sont aussi dans la comparaison budget, et le restent d'une session à l'autre.

### Corrigé
- Mois en cours : une transaction de fin du mois précédent rattachée à ce mois dans Bankin (par exemple un salaire versé en fin de mois et compté le mois suivant) manquait aux graphiques de la page Comptes et au rythme du mois.
- Masquage des montants : certains montants restaient visibles après le chargement de la page alors que l'œil indiquait « masqué ».
- Rapport PDF : graphique « Par catégorie » qui sortait de la page, barres « empilées » décalées, aire polaire remplacée par un donut, mois en français (« janv. 2024 ») et couleurs des catégories identiques à celles de Bankin.
- Graphiques dans la police et les couleurs de Bankin ; plus d'emojis dans les titres et légendes.
- Plusieurs onglets Bankin ouverts : chacun affiche ses graphiques (seul le dernier fonctionnait).
- Graphiques absents après une mise en veille du navigateur ou à l'ouverture d'un nouvel onglet.
- Page Catégories vide quand Chrome n'est pas en français.
- Graphiques de dépenses périmés sur l'onglet Revenus.
- Un clic sur ↻ rechargeait les données plusieurs fois.
- Graphique temporel qui « vibrait » en continu ; graphiques redessinés deux fois au chargement.
- Montants « NaN » dans l'infobulle de la comparaison budget.
- Dates décalées d'un jour selon le fuseau horaire ; rapport mensuel arrêté au 30 au lieu du 31.
- Diagramme de flux : remboursements comptés comme des dépenses ; plantage sur une catégorie sans sous-catégorie.
- Transactions en double après une erreur réseau pendant le chargement.
- Export CSV tronqué ou mal formé (caractères `#`, guillemets, formules de tableur) ; export qui échouait sans message sur un compte supprimé.
- La popup ne s'ouvre plus d'elle-même à chaque page Bankin (et plus de badge « ! » permanent).
- Modale « Un petit avis ? » affichée en double ; bandeau d'état déformé par les styles de Bankin.
- « Réinitialiser les paramètres » n'efface plus les données en cache ni le rapport.

### Sécurité et vie privée
- La popup et le rapport ne contactent plus aucun service tiers : badges de version (shields.io) retirés, police du rapport embarquée au lieu de Google Fonts.
- Dès que Bankin affiche sa page de connexion (déconnexion, session expirée), Pecunio efface ses données en cache, le dernier rapport et les en-têtes d'authentification ; seules les préférences sont gardées.
- Plus aucune transaction écrite dans la console du navigateur.
- Données des très anciennes versions de l'extension effacées à la mise à jour.

### Technique
- Construction avec WXT, code en modules, dépendances à jour (Chart.js 4).
- Tests : près de 500 tests unitaires, tests de contrat sur des captures anonymisées des pages Bankin, scénarios de bout en bout avec Playwright ; intégration continue sur chaque PR.

## Versions précédentes

Jusqu'à la 0.5.3 : voir les [releases GitHub](https://github.com/Thorfy/Pecunio/releases).
