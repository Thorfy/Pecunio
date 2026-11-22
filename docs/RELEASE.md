# Publier une version de Pecunio

**Pousser un tag `vX.Y.Z` publie la version** : si tous les contrôles passent,
le workflow de release l'envoie sur le Chrome Web Store avec publication
automatique (après l'examen de Google) et publie la release GitHub. Si un
contrôle échoue, rien n'est envoyé (décision du 22/11/2026,
`docs/AUDIT-MODERNISATION.md`). Vérifier la version **avant** de tagger.

## 1. Préparer la version (PR)

1. Choisir la version ([semver](https://semver.org/lang/fr/)) : correctifs → `0.5.4`, nouveautés → `0.6.0`.
2. Mettre à jour `package.json` sans créer de tag :
   ```bash
   npm version 0.6.0 --no-git-tag-version
   ```
   WXT reprend cette version dans le manifest.
3. Dans `CHANGELOG.md`, renommer « ## [Non publié] » en `## [0.6.0] - AAAA-MM-JJ` et ouvrir une nouvelle section « Non publié » vide au-dessus.
4. Ouvrir la PR ; la CI (lint, types, tests sous 3 fuseaux, build, scénarios e2e) doit être verte. Merger.
5. Recette sur le vrai Bankin avec la version de `main` (`npm run build`, extension non empaquetée `.output/chrome-mv3`) : §7 de [AUDIT-MODERNISATION.md](AUDIT-MODERNISATION.md). Les tests utilisent un Bankin simulé : seule cette recette vérifie la version face au vrai site.

Répétition générale possible à tout moment : onglet **Actions** → « Release Chrome extension » → **Run workflow** sur `main`. Mêmes contrôles et zip en artefact, sans release GitHub ni envoi sur le store.

## 2. Tagger (publie la version)

```bash
git checkout main && git pull
git tag v0.6.0
git push origin v0.6.0
```

Le workflow `.github/workflows/release.yml` :

1. vérifie que le tag égale la version de `package.json` et que `CHANGELOG.md` a une section pour cette version ;
2. relance tous les contrôles (`npm run check`, `npm run test:tz`, scénarios Playwright) et construit le zip ; **si l'un échoue, le workflow s'arrête là** ;
3. envoie le zip sur le Chrome Web Store **et le publie** (`--auto-publish`) : la version part à l'examen de Google, puis est publiée automatiquement ;
4. publie la release GitHub avec le zip, les notes du changelog et la liste des PR générée par GitHub.

Secrets nécessaires (Settings → Secrets → Actions) : `CI_GOOGLE_CLIENT_ID`, `CI_GOOGLE_CLIENT_SECRET`, `CI_GOOGLE_REFRESH_TOKEN` (voir les liens en tête du job `upload`).

## 3. Après la publication

1. Suivre l'examen dans le tableau de bord du Chrome Web Store (quelques heures à quelques jours) ; la fiche (description, captures, politique de confidentialité : voir « Données et vie privée » dans le README) se modifie depuis ce tableau de bord.
2. Workflow en échec : rien n'a été envoyé si c'est le job « Contrôles complets et zip » ; corriger, puis supprimer et recréer le tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`) ou passer à la version suivante. Si l'envoi au store a réussi mais pas la release GitHub, relancer seulement ce job depuis l'onglet Actions.

En cas de problème après publication : corriger et publier une version corrective (`0.6.1`) ; le Web Store ne permet pas de revenir à un ancien zip.
