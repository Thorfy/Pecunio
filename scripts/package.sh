#!/usr/bin/env bash
# Construit le zip de l'extension à partir d'une liste blanche de fichiers,
# puis vérifie que tout ce que le manifest et les pages HTML référencent
# est bien présent dans le zip.
#
# Usage : scripts/package.sh            → dist/pecunio-<version>.zip
# Requiert : bash, zip, unzip, node (disponibles sur les runners GitHub).
set -euo pipefail

cd "$(dirname "$0")/.."

# Fichiers et dossiers embarqués dans l'extension publiée.
# Tout ajout à la racine doit être déclaré ici.
FILES=(
  manifest.json
  bg.js
  injected.js
  popup.html
  popup.js
  report.html
  report.js
  js
  libs
  asset
)

version=$(node -p "require('./manifest.json').version")
out="dist/pecunio-${version}.zip"

rm -rf dist
mkdir -p dist
zip -qr "$out" "${FILES[@]}"

# Vérification du contenu réel du zip
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
unzip -q "$out" -d "$tmp"
node scripts/check-manifest.mjs --root "$tmp"

echo "✔ $out"
