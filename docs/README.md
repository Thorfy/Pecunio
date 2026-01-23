# Documentation Pecunio

Bienvenue dans la documentation de l'architecture Pecunio. Cette documentation a été créée pour améliorer la maintenabilité et faciliter l'évolution du code.

## 📚 Structure de la documentation

### Vue d'ensemble

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** : Vue d'ensemble complète de l'architecture avec schémas Mermaid
- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** : Liste détaillée de toutes les améliorations apportées
- **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)** : Plan de refactoring avec checklist

### Documentation par service

Chaque service spécialisé a sa propre documentation avec schémas :

- **[services/DataManager.md](./services/DataManager.md)** : Service de gestion des données
  - Récupération depuis l'API Bankin
  - Gestion du cache
  - Filtrage des transactions

- **[services/DataMerger.md](./services/DataMerger.md)** : Service de fusion et transformation
  - Fusion transactions + catégories + comptes
  - Export CSV
  - Calcul de statistiques

- **[services/Charts.md](./services/Charts.md)** : Système de graphiques
  - BaseChartData (classe de base)
  - LineBarChart, BudgetChart, SankeyChart
  - Flux de données et transformations

- **[services/Settings.md](./services/Settings.md)** : Gestionnaire de paramètres
  - Persistance dans Chrome Storage
  - Validation des données
  - Gestion de l'initialisation asynchrone

## 🎨 Visualisation des schémas

Tous les schémas utilisent **Mermaid** et peuvent être visualisés dans :

- **GitHub** : Support natif (affichage automatique)
- **VS Code** : Avec l'extension "Markdown Preview Mermaid Support"
- **En ligne** : [mermaid.live](https://mermaid.live)

## 🔍 Comment utiliser cette documentation

### Pour comprendre l'architecture globale

1. Commencez par **[ARCHITECTURE.md](./ARCHITECTURE.md)**
2. Regardez les schémas de flux de données
3. Explorez les services individuels selon vos besoins

### Pour modifier un service

1. Consultez la documentation du service concerné dans `services/`
2. Regardez le schéma de flux pour comprendre les dépendances
3. Vérifiez la section "Améliorations proposées" pour les idées futures

### Pour ajouter une fonctionnalité

1. Consultez **[ARCHITECTURE.md](./ARCHITECTURE.md)** pour comprendre où intégrer
2. Regardez les schémas pour identifier les points d'extension
3. Suivez les patterns existants documentés

## 📊 Schémas disponibles

### Architecture générale
- Diagramme de l'architecture complète
- Flux de données (initialisation)
- Flux d'affichage des graphiques

### Par service
- **DataManager** : Flux de chargement et cache
- **DataMerger** : Flux de fusion et transformation
- **Charts** : Hiérarchie et flux de données
- **Settings** : Flux de persistance et validation

## 🚀 Améliorations récentes

Voir **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** pour la liste complète, notamment :

- ✅ Élimination des duplications de code
- ✅ Unification des services (BankinDataService → DataManager)
- ✅ Amélioration de la gestion d'erreurs avec retry automatique
- ✅ Validation des données
- ✅ Documentation complète avec schémas

## 📝 Conventions

### Schémas Mermaid

- **graph TD** : Diagrammes de flux (top-down)
- **sequenceDiagram** : Diagrammes de séquence
- **graph LR** : Diagrammes horizontaux

### Documentation

- Chaque service documente son interface publique
- Les dépendances sont explicitement listées
- Les événements émis/reçus sont documentés
- Les améliorations futures sont proposées

## 🔧 Maintenance

Cette documentation doit être mise à jour lors de :
- Ajout de nouveaux services
- Modification de l'architecture
- Changement des interfaces publiques
- Ajout de nouvelles fonctionnalités majeures

## 📞 Support

Pour toute question sur l'architecture :
1. Consultez d'abord la documentation du service concerné
2. Regardez les schémas pour comprendre les flux
3. Vérifiez le plan de refactoring pour les évolutions prévues

---

*Documentation générée et maintenue pour améliorer la maintenabilité du projet Pecunio*
