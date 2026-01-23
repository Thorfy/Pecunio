# Charts - Système de graphiques

## Architecture

Tous les graphiques héritent de `BaseChartData` qui fournit :
- Filtrage commun des transactions
- Gestion des catégories
- Parsing des couleurs
- Méthodes utilitaires

```mermaid
graph TD
    BASE[BaseChartData]
    LINE[LineBarChart]
    BUDGET[BudgetChart]
    SANKEY[SankeyChart]
    
    BASE --> LINE
    BASE --> BUDGET
    BASE --> SANKEY
    
    BASE --> FILTER[Filtrage]
    BASE --> CATEGORY[Gestion Catégories]
    BASE --> COLOR[Parsing Couleurs]
    
    LINE --> TIME[Visualisation Temporelle]
    BUDGET --> COMPARE[Comparaison Budget]
    SANKEY --> FLOW[Flux Financiers]
```

## BaseChartData

### Responsabilités

1. **Filtrage des données** :
   - Par date (startDate, endDate)
   - Par compte (accountsSelected)
   - Par mois/année spécifiques
   - Exclusion des catégories d'exception

2. **Gestion des catégories** :
   - Lookup rapide par ID
   - Organisation parent/enfant
   - Filtrage des catégories valides

3. **Utilitaires** :
   - Parsing des couleurs CSS
   - Formatage de dates
   - Calculs statistiques (moyenne, médiane)

### Méthodes principales

```javascript
class BaseChartData {
    applySettingOnData(options): Array<Transaction>
    applySettingOnDataByMonth(month, year): Array<Transaction>
    mergeTransactionByCategory(transactions, categories): Map
    parseColorCSS(cssClass): string
    getCategoryNameById(categoryId): string
    isExceptionCategory(categoryId): boolean
}
```

## LineBarChart

### Responsabilités

- Affichage temporel des dépenses par catégorie
- Toggle entre graphique linéaire et barres empilées
- Cumul mensuel des transactions
- Gestion de la visibilité des catégories

### Flux de données

```mermaid
graph LR
    TX[Transactions] --> FILTER[Filtrage]
    FILTER --> GROUP[Groupement par Catégorie]
    GROUP --> DATE[Groupement par Date]
    DATE --> FORMAT[Formatage Chart.js]
    FORMAT --> RENDER[Affichage]
```

## BudgetChart

### Responsabilités

- Comparaison de budgets entre périodes
- Calcul de médiane/moyenne mensuelle
- Comparaison année complète vs mois spécifique
- Gestion de la visibilité des catégories via storage

### Flux de données

```mermaid
graph TD
    TX[Transactions] --> ORG[Organisation par Année/Mois/Catégorie]
    ORG --> SELECT[Sélection Période]
    SELECT -->|Année| CALC_YEAR[Calcul Médiane/Moyenne Annuelle]
    SELECT -->|Mois| ACTUAL[Dépenses Réelles du Mois]
    CALC_YEAR --> COMPARE[Comparaison]
    ACTUAL --> COMPARE
    COMPARE --> CHART[Graphique Barres]
```

### Structure de données organisées

```javascript
{
    [year]: {
        [month]: {
            [categoryName]: [amount1, amount2, ...]
        }
    }
}
```

## SankeyChart

### Responsabilités

- Visualisation des flux financiers
- Organisation Budget → Catégories → Sous-catégories
- Calcul des totaux et restes

### Flux de données

```mermaid
graph TD
    TX[Transactions] --> FILTER[Filtrage par Mois]
    FILTER --> GROUP[Groupement par Catégorie]
    GROUP --> FORMAT[Format Sankey]
    FORMAT --> NODES[Nœuds: Budget, Dépenses, Catégories]
    FORMAT --> LINKS[Liens: Flux avec montants]
    NODES --> RENDER[Affichage]
    LINKS --> RENDER
```

## Améliorations proposées

1. **Interface commune** : Définir une interface `IChart` pour tous les graphiques
2. **Factory pattern** : Créer les graphiques via une factory
3. **Configuration centralisée** : Options Chart.js dans Config
4. **Tests unitaires** : Tester la transformation des données
5. **Performance** : Lazy loading des données volumineuses
6. **Accessibilité** : Ajouter des labels ARIA et support clavier
