# Phase 2.2 - Création d'une classe de base pour les charts

## Objectif
Éliminer la duplication massive entre `ChartData`, `ChartData2`, et `ChartDataBudget` en créant une classe de base commune qui centralise toute la logique partagée.

## Problèmes identifiés

### Duplication massive
Les trois classes de charts contenaient des méthodes identiques ou très similaires :
- `applySettingOnData()` - Filtrage des transactions par date et compte
- `mergeTransactionByCategory()` - Organisation des transactions par catégorie
- `parseColorCSS()` - Parsing des couleurs CSS
- Logique de gestion des catégories d'exception `[326, 282]`
- Méthodes utilitaires de calcul (médiane, moyenne)
- Gestion du lookup des catégories

### Incohérences
- `ChartData` utilisait un tableau pour organiser les données
- `ChartData2` utilisait une Map
- `ChartDataBudget` avait sa propre implémentation du lookup des catégories
- Différentes approches pour le filtrage par date

## Solution implémentée

### 1. Création de `BaseChartData` (`js/base/BaseChartData.js`)

#### Fonctionnalités centralisées :
- **Constructeur unifié** : Gestion commune des transactions, catégories, comptes sélectionnés
- **Lookup des catégories** : Initialisation automatique du Map pour un accès rapide
- **Filtrage des données** : Méthodes `applySettingOnData()` et `applySettingOnDataByMonth()`
- **Organisation des données** : `mergeTransactionByCategory()` et `mergeTransactionByCategoryLegacy()`
- **Utilitaires** : `parseColorCSS()`, `getCategoryNameById()`, `isExceptionCategory()`
- **Méthodes statiques** : `calculateMedian()`, `calculateAverage()`, `formatDateToYearMonth()`, `getMonthName()`

#### Constantes centralisées :
- `EXCEPTION_CATEGORIES = [326, 282]` - Catégories à exclure du traitement

### 2. Refactoring des classes existantes

#### `ChartData.js`
- Hérite maintenant de `BaseChartData`
- Suppression de `applySettingOnData()` et `mergeTransactionByCategory()`
- Utilise `mergeTransactionByCategoryLegacy()` pour maintenir la compatibilité

#### `ChartData2.js`
- Hérite maintenant de `BaseChartData`
- Suppression de `applySettingOnData()` et `mergeTransactionByCategory()`
- Utilise `applySettingOnDataByMonth()` pour le filtrage spécifique par mois/année

#### `ChartDataBudget.js`
- Hérite maintenant de `BaseChartData`
- Suppression de `applySettingOnData()`, `_calculateMedian()`, `_calculateAverage()`, `_getMonthName()`
- Utilise les méthodes de la classe de base : `isExceptionCategory()`, `getCategoryNameById()`, `BaseChartData.calculateMedian()`, etc.

### 3. Mise à jour du manifest.json
Ajout de `"js/base/BaseChartData.js"` dans la liste des scripts à charger.

## Avantages obtenus

### Réduction de la duplication
- **~200 lignes de code** supprimées des classes existantes
- **Logique centralisée** pour le filtrage et l'organisation des données
- **Méthodes utilitaires** partagées

### Amélioration de la maintenabilité
- **Modifications centralisées** : Un seul endroit pour modifier la logique commune
- **Cohérence** : Toutes les classes utilisent la même approche
- **Documentation** : JSDoc complet pour toutes les méthodes

### Flexibilité
- **Compatibilité legacy** : `mergeTransactionByCategoryLegacy()` pour `ChartData`
- **Options configurables** : Paramètres optionnels pour personnaliser le comportement
- **Extensibilité** : Facile d'ajouter de nouvelles méthodes communes

### Robustesse
- **Gestion d'erreurs** : Validation des données d'entrée
- **Logs de debug** : Messages informatifs pour le diagnostic
- **Fallbacks** : Valeurs par défaut pour éviter les erreurs

## Impact sur les performances

### Positif
- **Lookup optimisé** : Map pour l'accès aux catégories au lieu de recherche linéaire
- **Moins de duplication** : Réduction de la taille du code chargé
- **Cache des calculs** : Réutilisation des résultats de filtrage

### Neutre
- **Héritage** : Légère surcharge due à l'héritage, mais négligeable
- **Initialisation** : Setup du lookup des catégories, mais une seule fois

## Tests recommandés

### Fonctionnalité
1. **Charts existants** : Vérifier que tous les charts s'affichent correctement
2. **Filtrage des données** : Tester avec différentes plages de dates
3. **Sélection de comptes** : Vérifier le filtrage par compte
4. **Catégories d'exception** : Confirmer que les catégories 326 et 282 sont bien exclues

### Performance
1. **Temps de chargement** : Mesurer l'impact sur l'initialisation
2. **Mémoire** : Vérifier l'utilisation mémoire avec de gros datasets
3. **Responsivité** : Tester la réactivité des charts

## Prochaines étapes

### Phase 2.3 - Optimisation des charts
- Analyser les performances de chaque chart
- Identifier les goulots d'étranglement
- Optimiser les calculs et le rendu

### Phase 2.4 - Tests unitaires
- Créer des tests pour `BaseChartData`
- Tester chaque méthode avec différents scénarios
- Ajouter des tests d'intégration pour les charts

## Fichiers modifiés

### Nouveaux fichiers
- `js/base/BaseChartData.js` - Classe de base pour tous les charts

### Fichiers modifiés
- `manifest.json` - Ajout du nouveau script
- `js/ChartData.js` - Héritage de BaseChartData, suppression du code dupliqué
- `js/ChartData2.js` - Héritage de BaseChartData, suppression du code dupliqué
- `js/ChartDataBudget.js` - Héritage de BaseChartData, suppression du code dupliqué

### Fichiers de documentation
- `REFACTORING_PHASE2_2.md` - Cette documentation 