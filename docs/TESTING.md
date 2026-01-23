# Guide de tests manuels - Pecunio

Ce guide décrit comment tester manuellement l'extension Pecunio sans utiliser de framework de test. Ces tests peuvent être effectués directement dans la console du navigateur ou en observant le comportement de l'extension.

## Prérequis

1. Extension chargée dans Chrome (mode développeur)
2. Page Bankin ouverte (https://app2.bankin.com)
3. Console développeur ouverte (F12)

## Tests des modèles

### Test 1 : Transaction

```javascript
// Dans la console du navigateur
const transaction = new Transaction(
    123,
    -50.00,
    456,
    '2024-01-15',
    'Achat supermarché',
    789,
    0,
    'expense'
);

// Vérifier la validité
console.assert(transaction.isValid(), 'Transaction doit être valide');
console.assert(transaction.isExpense(), 'Transaction doit être une dépense');
console.assert(transaction.getAbsoluteAmount() === 50, 'Montant absolu doit être 50');

// Tester fromRaw
const rawTransaction = {
    id: 123,
    amount: -50,
    account: { id: 456 },
    date: '2024-01-15',
    description: 'Test',
    category: { id: 789 },
    current_month: 0
};
const tx = Transaction.fromRaw(rawTransaction);
console.assert(tx.isValid(), 'Transaction fromRaw doit être valide');
```

### Test 2 : Category

```javascript
const category = new Category(123, 'Alimentation', null);
console.assert(category.isParent(), 'Catégorie doit être parent');
console.assert(category.id === 123, 'ID doit être 123');

const childCategory = new Category(456, 'Supermarché', 123);
console.assert(childCategory.isChild(), 'Catégorie doit être enfant');

// Tester fromRaw
const rawCategory = { id: 123, name: 'Test' };
const cat = Category.fromRaw(rawCategory);
console.assert(cat.isValid === undefined || cat.isValid(), 'Catégorie fromRaw doit être valide');
```

### Test 3 : Account

```javascript
const account = new Account(123, 'Compte Courant');
console.assert(account.isValid(), 'Compte doit être valide');
console.assert(account.getDisplayName() === 'Compte Courant', 'Nom d\'affichage doit être correct');

// Tester fromRaw
const rawAccount = { id: 123, name: 'Test Account' };
const acc = Account.fromRaw(rawAccount);
console.assert(acc.isValid(), 'Compte fromRaw doit être valide');
```

## Tests de DataManager

### Test 4 : Initialisation

```javascript
// Dans la console de la page Bankin
const dataManager = new DataManager();

// Attendre l'initialisation
await dataManager.waitForInitialization();

// Vérifier les données
const data = dataManager.getCachedData();
console.assert(data.transactions !== null, 'Transactions doivent être chargées');
console.assert(data.categories !== null, 'Catégories doivent être chargées');
console.assert(data.accounts !== null, 'Comptes doivent être chargés');

console.log('Données chargées:', {
    transactions: data.transactions.length,
    categories: data.categories.length,
    accounts: data.accounts.length
});
```

### Test 5 : Filtrage des transactions

```javascript
const data = dataManager.getCachedData();
const allTransactions = data.transactions;

// Filtrer par date
const filtered = dataManager.filterTransactions(allTransactions, {
    startDate: '2024-01-01',
    endDate: '2024-12-31'
});

console.log(`Filtrage: ${allTransactions.length} → ${filtered.length} transactions`);

// Filtrer par compte
const byAccount = dataManager.filterTransactions(allTransactions, {
    accountsSelected: [123, 456] // Remplacer par de vrais IDs
});

console.log(`Par compte: ${byAccount.length} transactions`);
```

### Test 6 : Organisation par catégorie

```javascript
const data = dataManager.getCachedData();
const organized = dataManager.organizeTransactionsByCategory(
    data.transactions,
    data.categories
);

console.log('Organisation par catégorie:');
organized.forEach((transactions, categoryId) => {
    console.log(`  Catégorie ${categoryId}: ${transactions.length} transactions`);
});
```

### Test 7 : Gestion d'erreurs

```javascript
// Tester le refresh avec gestion d'erreurs
try {
    await dataManager.refreshData();
    console.log('✅ Refresh réussi');
} catch (error) {
    if (error instanceof AuthenticationError) {
        console.error('❌ Erreur d\'authentification:', error.message);
    } else if (error instanceof ValidationError) {
        console.error('❌ Erreur de validation:', error.dataType);
    } else if (error instanceof APIError) {
        console.error('❌ Erreur API:', error.statusCode, error.url);
    } else {
        console.error('❌ Erreur inconnue:', error);
    }
}
```

## Tests des Charts

### Test 8 : LineBarChart

```javascript
// Dans la console de la page /accounts
const settingClass = new Settings();
await settingClass.waitForInitialization();

const transactions = settingClass.getSetting('cache_data_transactions');
const categories = settingClass.getSetting('cache_data_categories');
const accountsSelected = settingClass.getSetting('accountsSelected');
const settings = settingClass.getAllSettings();

const chartData = new LineBarChart(
    transactions,
    categories,
    accountsSelected,
    settings,
    settingClass
);

// Préparer les données
const preparedData = await chartData.prepareData();
console.assert(preparedData.datasets !== undefined, 'Données doivent avoir datasets');
console.log('Datasets préparés:', preparedData.datasets.length);

// Obtenir la config
const config = await chartData.getChartJsConfig();
console.assert(config.type !== undefined, 'Config doit avoir un type');
console.assert(config.options !== undefined, 'Config doit avoir des options');
```

### Test 9 : BudgetChart

```javascript
const budgetChart = new BudgetChart(
    transactions,
    categories,
    accountsSelected,
    settings,
    settingClass
);

// Vérifier que l'initialisation est en cours
console.assert(budgetChart.initializationPromise !== undefined, 'Promise d\'initialisation doit exister');

// Attendre l'initialisation
await budgetChart.initializationPromise;

// Tester prepareData avec des paramètres
const budgetData = await budgetChart.prepareData(
    2024, 'january', // Année et mois gauche
    2024, 'february', // Année et mois droit
    'median' // Type de calcul
);

console.assert(budgetData.labels !== undefined, 'Données doivent avoir des labels');
console.assert(budgetData.datasets !== undefined, 'Données doivent avoir des datasets');
```

### Test 10 : SankeyChart

```javascript
const sankeyChart = new SankeyChart(
    transactions,
    categories,
    ['janvier', '2024'],
    settingClass
);

const sankeyData = await sankeyChart.prepareData();
console.assert(Array.isArray(sankeyData), 'Données Sankey doivent être un tableau');
console.log('Données Sankey:', sankeyData.length, 'éléments');
```

## Tests des événements

### Test 11 : Système d'événements

```javascript
const evt = new Evt();
evt.enableDebug(); // Activer les logs

let dataLoadedCount = 0;

// Écouter l'événement
evt.listen('data_loaded', () => {
    dataLoadedCount++;
    console.log('✅ Événement data_loaded reçu');
});

// Vérifier les stats
const stats = evt.getStats();
console.log('Stats événements:', stats);

// Vérifier les écouteurs
console.assert(evt.hasListeners('data_loaded'), 'Doit avoir des écouteurs pour data_loaded');
console.assert(evt.getListenerCount('data_loaded') === 1, 'Doit avoir 1 écouteur');
```

## Tests d'intégration

### Test 12 : Flux complet de chargement

```javascript
// 1. Initialiser les composants
const evt = new Evt();
const settingClass = new Settings();
const dataManager = new DataManager();

// 2. Attendre l'initialisation
await settingClass.waitForInitialization();
await dataManager.waitForInitialization();

// 3. Vérifier les données
const data = dataManager.getCachedData();
console.assert(data.transactions.length > 0, 'Doit avoir des transactions');
console.assert(data.categories.length > 0, 'Doit avoir des catégories');
console.assert(data.accounts.length > 0, 'Doit avoir des comptes');

// 4. Créer un chart
const chartData = new LineBarChart(
    data.transactions,
    data.categories,
    null,
    settingClass.getAllSettings(),
    settingClass
);

// 5. Préparer les données
const preparedData = await chartData.prepareData();
console.assert(preparedData.datasets.length > 0, 'Doit avoir des datasets');

console.log('✅ Flux complet réussi');
```

### Test 13 : Test de performance

```javascript
console.time('Chargement données');
const dataManager = new DataManager();
await dataManager.waitForInitialization();
console.timeEnd('Chargement données');

console.time('Préparation chart');
const chartData = new LineBarChart(
    dataManager.getCachedData().transactions,
    dataManager.getCachedData().categories,
    null,
    {},
    new Settings()
);
const data = await chartData.prepareData();
console.timeEnd('Préparation chart');

console.log('Performance:', {
    transactions: dataManager.getCachedData().transactions.length,
    datasets: data.datasets.length
});
```

## Tests visuels

### Test 14 : Vérification des graphiques

1. **Page /accounts** :
   - Vérifier que le LineBarChart s'affiche
   - Vérifier que le BudgetChart s'affiche
   - Tester le toggle entre bar et line
   - Vérifier que les catégories peuvent être masquées/affichées

2. **Page /categories** :
   - Vérifier que le SankeyChart s'affiche
   - Vérifier que le graphique se met à jour lors du changement de mois

3. **Fonctionnalités** :
   - Tester le bouton de refresh
   - Tester le masquage des montants (AmountHider)
   - Vérifier que les styles Pecunio sont appliqués

## Checklist de validation

Avant de considérer les tests réussis :

- [ ] Tous les modèles peuvent être créés et validés
- [ ] DataManager charge les données correctement
- [ ] Les erreurs sont gérées avec les types appropriés
- [ ] Les charts préparent les données correctement
- [ ] Les événements sont dispatchés et écoutés
- [ ] Le flux complet fonctionne de bout en bout
- [ ] Les graphiques s'affichent correctement visuellement
- [ ] Aucune erreur dans la console
- [ ] Les performances sont acceptables (< 2s pour le chargement)

## Dépannage

### Les données ne se chargent pas
- Vérifier que vous êtes sur la page Bankin
- Vérifier que l'authentification est complète
- Vérifier la console pour les erreurs d'authentification

### Les graphiques ne s'affichent pas
- Vérifier que les données sont chargées
- Vérifier que les éléments DOM existent
- Vérifier la console pour les erreurs JavaScript

### Erreurs de validation
- Vérifier la structure des données dans la console
- Utiliser `DataValidators` pour valider manuellement
- Vérifier les logs de données invalides
