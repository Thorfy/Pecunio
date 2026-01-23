# Plan de refactoring - Amélioration de la maintenabilité

## Objectifs

1. Éliminer les duplications de code
2. Unifier les services (BankinDataService → DataManager)
3. Améliorer la gestion d'erreurs
4. Standardiser les patterns
5. Améliorer la documentation

## Phase 1 : Nettoyage des duplications

### 1.1 Supprimer BankinDataService

**Fichier** : `js/services/BankinDataService.js`

**Actions** :
- [ ] Remplacer toutes les utilisations de `BankinDataService` par `DataManager` dans `injected.js`
- [ ] Supprimer le fichier `BankinDataService.js`
- [ ] Mettre à jour `manifest.json` pour retirer la référence

**Impact** : `injected.js` ligne 4 et 62

### 1.2 Unifier parseColorCSS

**Fichiers concernés** :
- `js/charts/base/BaseChartData.js` (ligne 212)
- `js/charts/LineBarChart.js` (ligne 57)
- `js/core/DataManager.js` (ligne 282)

**Actions** :
- [ ] Supprimer toutes les méthodes `parseColorCSS` locales
- [ ] Utiliser uniquement `ColorParser.parseColorCSS()`
- [ ] Vérifier que `ColorParser` est bien chargé dans le manifest

### 1.3 Centraliser les constantes

**Problème** : `EXCEPTION_CATEGORIES` est défini dans plusieurs endroits

**Actions** :
- [ ] Utiliser uniquement `Config.CATEGORIES.EXCEPTION_IDS`
- [ ] Supprimer les définitions locales

## Phase 2 : Amélioration de DataManager

### 2.1 Gestion d'erreurs robuste

**Actions** :
- [ ] Ajouter retry automatique pour les requêtes API
- [ ] Valider la structure des données reçues
- [ ] Ajouter des erreurs typées

### 2.2 Validation des données

**Actions** :
- [ ] Créer des validateurs pour chaque type de données
- [ ] Rejeter les données invalides avec des messages clairs
- [ ] Logger les données invalides pour debug

## Phase 3 : Amélioration des Charts

### 3.1 Injection de dépendances

**Problème** : Les charts dépendent de `settingClass` global

**Actions** :
- [ ] Injecter `Settings` via le constructeur
- [ ] Supprimer les dépendances globales

### 3.2 Interface commune

**Actions** :
- [ ] Créer une interface `IChart` avec méthodes communes
- [ ] Standardiser `prepareData()` et `getChartJsConfig()`

## Phase 4 : Documentation et tests

### 4.1 Documentation

**Actions** :
- [x] Créer `docs/ARCHITECTURE.md`
- [x] Créer `docs/services/*.md` pour chaque service
- [ ] Ajouter des exemples d'utilisation
- [ ] Documenter les événements

### 4.2 Tests

**Actions** :
- [ ] Créer des tests unitaires pour les modèles
- [ ] Tester la transformation des données
- [ ] Tester le filtrage

## Checklist de validation

Avant de considérer le refactoring terminé :

- [ ] Tous les tests passent
- [ ] Aucune duplication de code
- [ ] Gestion d'erreurs cohérente
- [ ] Documentation à jour
- [ ] Code review effectué
- [ ] Manifest.json nettoyé

## Ordre d'exécution recommandé

1. Phase 1 (nettoyage) - Impact minimal, gains immédiats
2. Phase 2 (DataManager) - Améliore la robustesse
3. Phase 3 (Charts) - Améliore la maintenabilité
4. Phase 4 (Doc/Tests) - Finalise le travail
