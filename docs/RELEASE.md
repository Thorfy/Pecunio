# Publier une version de Pecunio

La publication sur le Chrome Web Store reste **manuelle** : le workflow de
release envoie la version en brouillon, rien n'est publié automatiquement
(décision de la phase 6, `docs/AUDIT-MODERNISATION.md`).

## 1. Préparer la version (PR)

1. Choisir la version ([semver](https://semver.org/lang/fr/)) : correctifs → `0.5.4`, nouveautés → `0.6.0`.
2. Mettre à jour `package.json` sans créer de tag :
   ```bash
   npm version 0.6.0 --no-git-tag-version
   ```
   WXT reprend cette version dans le manifest.
3. Dans `CHANGELOG.md`, renommer « ## [Non publié] » en `## [0.6.0] - AAAA-MM-JJ` et ouvrir une nouvelle section « Non publié » vide au-dessus.
4. Ouvrir la PR ; la CI (lint, types, tests sous 3 fuseaux, build, scénarios e2e) doit être verte. Merger.

Répétition générale possible à tout moment : onglet **Actions** → « Release Chrome extension » → **Run workflow** sur `main`. Mêmes contrôles et zip en artefact, sans release GitHub ni envoi sur le store.

## 2. Tagger (déclenche le workflow)

```bash
git checkout main && git pull
git tag v0.6.0
git push origin v0.6.0
```

Le workflow `.github/workflows/release.yml` :

1. vérifie que le tag égale la version de `package.json` et que `CHANGELOG.md` a une section pour cette version ;
2. relance tous les contrôles (`npm run check`, `npm run test:tz`, scénarios Playwright) et construit le zip ;
3. crée une **release GitHub en brouillon** avec le zip, les notes du changelog et la liste des PR générée par GitHub ;
4. envoie le zip sur le Chrome Web Store **sans le publier**.

Secrets nécessaires (Settings → Secrets → Actions) : `CI_GOOGLE_CLIENT_ID`, `CI_GOOGLE_CLIENT_SECRET`, `CI_GOOGLE_REFRESH_TOKEN` (voir les liens en tête du job `upload`).

## 3. Vérifier puis publier (manuel)

1. Charger le zip de la release (ou `.output/chrome-mv3`) en extension non empaquetée et suivre la recette du §7 de [AUDIT-MODERNISATION.md](AUDIT-MODERNISATION.md) sur le vrai Bankin.
2. Tableau de bord du Chrome Web Store : vérifier la fiche (description, captures, politique de confidentialité : voir « Données et vie privée » dans le README), puis **Soumettre pour examen**. Le déploiement progressif est possible depuis le tableau de bord.
3. Publier la release GitHub (bouton « Publish release » du brouillon).

En cas de problème après publication : retirer la release GitHub, corriger, et publier une version corrective (`0.6.1`) ; le Web Store ne permet pas de revenir à un ancien zip.
