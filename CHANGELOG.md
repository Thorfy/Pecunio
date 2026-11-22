# Changelog

Modifications visibles par les utilisateurs de Pecunio. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions
[sémantiques](https://semver.org/lang/fr/).

Avant une release : renommer « Non publié » en `[X.Y.Z] - AAAA-MM-JJ` (même
version que `package.json`), voir [docs/RELEASE.md](docs/RELEASE.md).

## [Non publié]

### Ajouté
- Interface des graphiques entièrement en français : mois des axes (« janv. 2026 »), montants au format `-1 234,50 €`, libellés de la comparaison budget (« Tous les mois », « Réel févr. 2024 », « Médiane 2026 »).
- Bouton « Afficher en courbes / en barres » au-dessus du graphique temporel, utilisable au clavier et par les lecteurs d'écran (remplace « Toggle chart type » dessiné dans le graphique).
- Bandeau d'état dans la page Bankin : chargement des données en cours, erreur de session ou de réseau avec bouton « Recharger ».
- Export CSV : vraie date de chaque transaction et colonne « Budget Month » (mois de rattachement choisi dans Bankin).
- Les catégories masquées dans la légende du graphique temporel le sont aussi dans la comparaison budget, et le restent d'une session à l'autre.

### Corrigé
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
- Tests : environ 400 tests unitaires, tests de contrat sur des captures anonymisées des pages Bankin, scénarios de bout en bout avec Playwright ; intégration continue sur chaque PR.

## Versions précédentes

Jusqu'à la 0.5.3 : voir les [releases GitHub](https://github.com/Thorfy/Pecunio/releases).
