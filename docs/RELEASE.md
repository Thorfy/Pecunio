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

Répétition générale possible à tout moment : onglet **Actions** → « Release Chrome extension » → **Run workflow** sur `main`. Mêmes contrôles et zip en artefact, et vérification de l'accès au store en lecture seule ; ni envoi, ni release GitHub.

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

Accès au Chrome Web Store **sans clé ni jeton à renouveler**, comme ProperTease : GitHub Actions s'authentifie auprès de Google par fédération d'identité (le compte de service `cws-publisher@resonant-petal-394515.iam.gserviceaccount.com`, lié au store, accepte les jetons émis pour ce dépôt), puis le workflow appelle l'API v2 du store. Configuration (Settings → Secrets and variables → Actions), vérifiée en tête du workflow :
- variables `GCP_WIF_PROVIDER` (`projects/867456897646/locations/global/workloadIdentityPools/github/providers/pecunio`) et `GCP_SERVICE_ACCOUNT` (l'adresse du compte de service) ;
- secret `CI_GOOGLE_PUBLISHER_ID` : identifiant d'éditeur du compte développeur (dans l'adresse du tableau de bord du store).

Mise en place côté Google (une fois, dans Google Cloud Shell, avec le compte du Chrome Web Store) : un fournisseur d'identité réservé à ce dépôt, et le droit pour ce dépôt d'emprunter le compte de service.

```bash
gcloud config set project resonant-petal-394515
gcloud iam workload-identity-pools providers create-oidc pecunio --location=global --workload-identity-pool=github   --issuer-uri=https://token.actions.githubusercontent.com   --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"   --attribute-condition="assertion.repository=='Thorfy/Pecunio' && (assertion.ref.startsWith('refs/tags/v') || assertion.ref=='refs/heads/main')"
gcloud iam service-accounts add-iam-policy-binding cws-publisher@resonant-petal-394515.iam.gserviceaccount.com   --role=roles/iam.workloadIdentityUser   --member="principalSet://iam.googleapis.com/projects/867456897646/locations/global/workloadIdentityPools/github/attribute.repository/Thorfy/Pecunio"
```

La condition n'accepte que les tags de version et `main` (lancement manuel) : une autre branche du dépôt ne peut pas obtenir de jeton pour le store. Pour l'appliquer à un fournisseur déjà créé : `gcloud iam workload-identity-pools providers update-oidc pecunio --location=global --workload-identity-pool=github --attribute-condition="…"` (même condition).

Si Pecunio dépend d'un autre compte développeur que ProperTease, ajouter aussi l'adresse du compte de service dans la section **Compte** de son tableau de bord. Pour vérifier : onglet **Actions** → « Release Chrome extension » → **Run workflow** : l'étape « Accès à la fiche de l'extension » doit afficher « Fiche accessible » (lecture seule, rien n'est envoyé).

## 3. Après la publication

1. Suivre l'examen dans le tableau de bord du Chrome Web Store (quelques heures à quelques jours) ; la fiche (description, captures, politique de confidentialité : voir « Données et vie privée » dans le README) se modifie depuis ce tableau de bord.
2. Workflow en échec : rien n'a été envoyé si c'est le job « Contrôles complets et zip » ; corriger, puis supprimer et recréer le tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`) ou passer à la version suivante. Si l'envoi au store a réussi mais pas la release GitHub, relancer seulement ce job depuis l'onglet Actions.

En cas de problème après publication : corriger et publier une version corrective (`0.6.1`) ; le Web Store ne permet pas de revenir à un ancien zip.
