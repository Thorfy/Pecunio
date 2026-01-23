# DataMerger - Service de fusion et transformation

## Responsabilités

Le `DataMerger` est responsable de :
1. Validation et transformation des données brutes en modèles
2. Fusion des transactions avec leurs métadonnées (catégories, comptes)
3. Filtrage selon les critères de l'utilisateur
4. Export au format CSV
5. Calcul de statistiques

## Schéma de flux

```mermaid
graph TD
    START[Construction DataMerger]
    START --> VALIDATE_TX[Valider Transactions]
    START --> VALIDATE_ACC[Valider Accounts]
    START --> VALIDATE_CAT[Valider Categories]
    
    VALIDATE_TX --> TRANSFORM_TX[Transformer en Transaction]
    VALIDATE_ACC --> TRANSFORM_ACC[Transformer en Account]
    VALIDATE_CAT --> TRANSFORM_CAT[Transformer en Category]
    
    TRANSFORM_TX --> BUILD_MAPS[Construire Maps de lookup]
    TRANSFORM_ACC --> BUILD_MAPS
    TRANSFORM_CAT --> BUILD_MAPS
    
    BUILD_MAPS --> MERGE[mergeData]
    MERGE --> FILTER[Filtrer par date/compte]
    FILTER --> MERGE_META[Fusionner avec métadonnées]
    MERGE_META --> SORT[Trier par date]
    SORT --> RETURN[Retourner données fusionnées]
    
    RETURN -->|Export CSV| CSV[convertToCSV]
    CSV --> DOWNLOAD[Télécharger fichier]
    
    RETURN -->|Stats| STATS[getStats]
    STATS --> CALC[Calculer totaux]
    CALC --> RETURN_STATS[Retourner statistiques]
```

## Interface publique

```javascript
class DataMerger {
    constructor(
        transactions: Array,
        categories: Array,
        accounts: Array,
        startDate?: string,
        endDate?: string,
        accountsSelected?: Array<number>
    )
    
    // Méthodes principales
    mergeData(): Array<Object>
    convertToCSV(data: Array<Object>): string
    exportToCSV(): void
    getStats(): Object
}
```

## Format de données fusionnées

```javascript
{
    transactionId: number,
    date: string, // YYYY-MM-DD
    amount: number,
    description: string,
    accountId: number,
    accountName: string,
    categoryId: number,
    categoryName: string,
    parentCategoryId: number | null,
    parentCategoryName: string,
    expenseType: string | null
}
```

## Dépendances

- `Transaction` : Modèle de transaction
- `Account` : Modèle de compte
- `Category` : Modèle de catégorie

## Améliorations proposées

1. **Validation stricte** : Rejeter les données invalides avec des erreurs claires
2. **Performance** : Optimiser les lookups avec des Maps
3. **Export multiple formats** : JSON, Excel en plus du CSV
4. **Filtres avancés** : Par catégorie, par type de transaction, etc.
