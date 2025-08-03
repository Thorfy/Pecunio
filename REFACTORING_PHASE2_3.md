# Phase 2.3 : Réorganisation et Renommage des Fichiers

## 🎯 **Objectifs**

Réorganiser la structure des fichiers JavaScript pour améliorer :
- **Lisibilité** : Noms de classes plus descriptifs
- **Maintenabilité** : Organisation logique par responsabilité
- **Évolutivité** : Structure claire pour les futures phases
- **Séparation des préoccupations** : Isolation des composants

## 📁 **Nouvelle Structure de Fichiers**

### **Structure Avant**
```
js/
├── BankinData.js          # Mélange logique métier + données
├── ChartData.js           # Nom peu descriptif
├── ChartData2.js          # Nom très peu descriptif
├── ChartDataBudget.js     # Plus descriptif mais pas cohérent
├── Hidder.js              # Nom peu clair
├── Settings.js            # OK
├── Evt.js                 # OK
├── Config.js              # OK
├── DataManager.js         # OK
├── models/
│   ├── Category.js        # OK
│   ├── Account.js         # OK
│   └── Transaction.js     # OK
├── services/
│   └── DataMerger.js      # OK
├── base/
│   └── BaseChartData.js   # OK
└── styles/
    └── InjectedStyles.js  # OK
```

### **Structure Après**
```
js/
├── core/                  # Classes fondamentales
│   ├── Settings.js
│   ├── Evt.js
│   ├── Config.js
│   └── DataManager.js
├── models/                # Modèles de données
│   ├── Category.js
│   ├── Account.js
│   └── Transaction.js
├── services/              # Services métier
│   ├── DataMerger.js
│   └── BankinDataService.js  # Renommé depuis BankinData.js
├── charts/                # Tous les graphiques
│   ├── base/
│   │   └── BaseChartData.js
│   ├── LineBarChart.js    # Renommé depuis ChartData.js
│   ├── SankeyChart.js     # Renommé depuis ChartData2.js
│   └── BudgetChart.js     # Renommé depuis ChartDataBudget.js
├── ui/                    # Composants d'interface
│   ├── InjectedStyles.js
│   ├── AmountHider.js     # Renommé depuis Hidder.js
│   └── LoadingScreen.js   # Nouveau composant extrait
└── utils/                 # Utilitaires
    └── ColorParser.js     # Nouveau utilitaire extrait
```

## 🔄 **Renommages Effectués**

### **Classes Renommées**
- `ChartData` → `LineBarChart`
- `ChartData2` → `SankeyChart`
- `ChartDataBudget` → `BudgetChart`
- `Hidder` → `AmountHider`
- `BankinData` → `BankinDataService`

### **Nouveaux Composants Créés**
- `LoadingScreen.js` : Composant d'écran de chargement
- `ColorParser.js` : Utilitaire pour parser les couleurs CSS

## 📝 **Modifications Apportées**

### **1. Déplacement des Fichiers**
- **Core** : `Settings.js`, `Evt.js`, `Config.js`, `DataManager.js` → `js/core/`
- **Services** : `BankinData.js` → `js/services/BankinDataService.js`
- **Charts** : Tous les graphiques → `js/charts/`
- **UI** : `Hidder.js` → `js/ui/AmountHider.js`, `InjectedStyles.js` → `js/ui/`

### **2. Mise à Jour des Imports**
- **manifest.json** : Mise à jour de tous les chemins de scripts
- **popup.html** : Mise à jour des chemins de scripts
- **injected.js** : Mise à jour des noms de classes

### **3. Extraction de Composants**
- **LoadingScreen** : Extraction de la fonction `loadingScreen()` de `injected.js`
- **ColorParser** : Extraction de la fonction `parseColorCSS()` de `injected.js`

### **4. Mise à Jour des Références**
- Tous les appels de constructeurs mis à jour avec les nouveaux noms
- Toutes les références de classes mises à jour

## ✅ **Avantages Obtenus**

### **1. Lisibilité Améliorée**
- Noms de classes plus descriptifs et explicites
- Structure de dossiers logique et intuitive
- Séparation claire des responsabilités

### **2. Maintenabilité**
- Organisation par domaine fonctionnel
- Isolation des composants
- Facilité de localisation des fichiers

### **3. Évolutivité**
- Structure prête pour les futures phases
- Séparation des préoccupations
- Réutilisabilité des composants

### **4. Cohérence**
- Convention de nommage uniforme
- Organisation logique des dossiers
- Standardisation des patterns

## 🧪 **Tests Recommandés**

1. **Fonctionnalité** : Vérifier que tous les graphiques s'affichent correctement
2. **Import/Export** : Tester l'export CSV
3. **UI** : Vérifier l'écran de chargement et le masquage des montants
4. **Navigation** : Tester les changements de page
5. **Console** : S'assurer qu'aucune erreur n'apparaît

## 📊 **Impact**

- **Positif** : Amélioration significative de la lisibilité et maintenabilité
- **Négatif** : Aucun impact négatif attendu
- **Migration** : Transparent pour l'utilisateur final
- **Performance** : Aucun impact sur les performances

## 🚀 **Prochaines Étapes**

Cette réorganisation constitue une excellente base pour :
- **Phase 2.4** : Optimisation des performances
- **Phase 3** : Amélioration de l'architecture
- **Phase 4** : Tests et qualité

La structure est maintenant prête pour les évolutions futures ! 