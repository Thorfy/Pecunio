# Architecture de Pecunio

## Vue d'ensemble

Pecunio est une extension Chrome qui enrichit l'interface de Bankin avec des visualisations de données financières personnalisées. L'extension intercepte les requêtes API de Bankin, récupère les données de transactions, catégories et comptes, puis les transforme en graphiques interactifs.

## Architecture générale

```mermaid
graph TB
    subgraph "Extension Chrome"
        BG[Background Script<br/>bg.js]
        POPUP[Popup<br/>popup.html/js]
        INJECTED[Content Script<br/>injected.js]
    end
    
    subgraph "Core"
        CONFIG[Config]
        EVT[Evt<br/>Event Manager]
        SETTINGS[Settings<br/>Storage Manager]
        DATAMGR[DataManager]
    end
    
    subgraph "Models"
        TRANS[Transaction]
        ACCOUNT[Account]
        CATEGORY[Category]
    end
    
    subgraph "Services"
        BANKIN[BankinDataService]
        MERGER[DataMerger]
    end
    
    subgraph "Charts"
        BASE[BaseChartData]
        LINE[LineBarChart]
        BUDGET[BudgetChart]
        SANKEY[SankeyChart]
    end
    
    subgraph "UI"
        STYLES[InjectedStyles]
        LOADING[LoadingScreen]
        HIDER[AmountHider]
    end
    
    subgraph "External"
        BANKIN_API[Bankin API]
        CHROME_STORAGE[Chrome Storage]
    end
    
    BG -->|Intercept Headers| BANKIN_API
    BG -->|Send Headers| DATAMGR
    DATAMGR -->|Fetch Data| BANKIN_API
    DATAMGR -->|Cache| CHROME_STORAGE
    SETTINGS -->|Read/Write| CHROME_STORAGE
    DATAMGR -->|Transform| TRANS
    DATAMGR -->|Transform| ACCOUNT
    DATAMGR -->|Transform| CATEGORY
    MERGER -->|Uses| TRANS
    MERGER -->|Uses| ACCOUNT
    MERGER -->|Uses| CATEGORY
    INJECTED -->|Uses| DATAMGR
    INJECTED -->|Uses| SETTINGS
    INJECTED -->|Creates| LINE
    INJECTED -->|Creates| BUDGET
    INJECTED -->|Creates| SANKEY
    LINE -->|Extends| BASE
    BUDGET -->|Extends| BASE
    SANKEY -->|Extends| BASE
    POPUP -->|Uses| SETTINGS
    POPUP -->|Uses| MERGER
    EVT -->|Coordinates| INJECTED
    EVT -->|Coordinates| POPUP
    CONFIG -->|Provides Constants| DATAMGR
    CONFIG -->|Provides Constants| BASE
```

## Flux de données

### 1. Initialisation et récupération des données

```mermaid
sequenceDiagram
    participant BG as Background Script
    participant DM as DataManager
    participant API as Bankin API
    participant STORAGE as Chrome Storage
    participant INJ as Injected Script
    
    BG->>API: Intercept Request Headers
    BG->>DM: Send Headers via Port
    DM->>STORAGE: Check Cache
    alt Cache Valid
        STORAGE->>DM: Return Cached Data
    else Cache Invalid/Empty
        DM->>API: Fetch Transactions
        DM->>API: Fetch Categories
        DM->>API: Fetch Accounts
        API->>DM: Return Data
        DM->>STORAGE: Save to Cache
    end
    DM->>INJ: Dispatch 'data_loaded'
    INJ->>INJ: Build Charts
```

### 2. Affichage des graphiques

```mermaid
sequenceDiagram
    participant INJ as Injected Script
    participant SETTINGS as Settings
    participant CHART as Chart Classes
    participant DOM as Page DOM
    
    INJ->>SETTINGS: Get Filter Settings
    SETTINGS->>INJ: Return Dates/Accounts
    INJ->>CHART: Create Chart Instance
    CHART->>SETTINGS: Get Transactions
    CHART->>CHART: Filter & Transform Data
    CHART->>DOM: Render Chart
    DOM->>USER: Display Chart
```

## Structure des modules

### Core (`js/core/`)

#### Config.js
Centralise toutes les constantes de configuration :
- URLs et endpoints API
- IDs de catégories spéciales
- Sélecteurs CSS
- Clés de stockage
- Configuration des graphiques

#### Evt.js
Gestionnaire d'événements centralisé utilisant les CustomEvents du DOM :
- Écoute et dispatch d'événements
- Gestion des listeners multiples
- Mode debug

#### Settings.js
Gestionnaire de persistance des paramètres :
- Interface avec `chrome.storage.local`
- Validation des données
- Gestion de l'initialisation asynchrone

#### DataManager.js
Gestionnaire centralisé des données :
- Récupération depuis l'API Bankin
- Gestion du cache
- Transformation des données brutes
- Filtrage des transactions

### Models (`js/models/`)

#### Transaction.js
Modèle représentant une transaction bancaire :
- Validation des données
- Calcul de dates ajustées
- Méthodes utilitaires (isExpense, isIncome, etc.)

#### Account.js
Modèle représentant un compte bancaire :
- Validation simple
- Méthodes d'affichage

#### Category.js
Modèle représentant une catégorie :
- Support des catégories parent/enfant
- Validation

### Services (`js/services/`)

#### BankinDataService.js ⚠️ (À déprécier)
Ancien service de récupération de données. **Doit être remplacé par DataManager**.

#### DataMerger.js
Service de fusion et transformation des données :
- Fusion transactions + catégories + comptes
- Filtrage par date et compte
- Export CSV
- Calcul de statistiques

### Charts (`js/charts/`)

#### BaseChartData.js
Classe de base pour tous les graphiques :
- Filtrage commun des transactions
- Gestion des catégories
- Parsing des couleurs CSS
- Méthodes utilitaires

#### LineBarChart.js
Graphique linéaire/barres empilées :
- Affichage temporel des dépenses
- Toggle entre ligne et barres
- Cumul par catégorie

#### BudgetChart.js
Graphique de comparaison budgétaire :
- Comparaison médiane/moyenne
- Sélection de périodes
- Gestion de la visibilité des catégories

#### SankeyChart.js
Diagramme de Sankey pour flux financiers :
- Visualisation Budget → Dépenses
- Organisation par catégories

### UI (`js/ui/`)

#### InjectedStyles.js
Styles CSS injectés dans la page Bankin :
- Design cohérent
- Classes utilitaires
- Responsive

#### LoadingScreen.js
Écran de chargement pendant le traitement

#### AmountHider.js
Masquage des montants sensibles :
- Toggle blur/unblur
- Persistance de l'état

## Problèmes identifiés et solutions

### 1. Duplication de services

**Problème** : `BankinDataService` et `DataManager` font la même chose.

**Solution** : 
- Déprécier `BankinDataService`
- Utiliser uniquement `DataManager`
- Mettre à jour `injected.js` pour utiliser `DataManager`

### 2. Duplication de code

**Problème** : `parseColorCSS` est dupliqué dans plusieurs endroits.

**Solution** :
- Utiliser uniquement `ColorParser.parseColorCSS()`
- Supprimer les duplications

### 3. Dépendances globales

**Problème** : Les charts dépendent directement de `settingClass` global.

**Solution** :
- Injecter `Settings` via le constructeur
- Utiliser l'injection de dépendances

### 4. Gestion d'erreurs inconsistante

**Problème** : Certaines erreurs sont silencieuses, d'autres loggées.

**Solution** :
- Standardiser la gestion d'erreurs
- Ajouter des validations partout
- Utiliser des erreurs typées

## Schémas détaillés par service

Voir les fichiers dans `docs/services/` pour les schémas détaillés de chaque service.
