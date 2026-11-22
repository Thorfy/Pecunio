#!/usr/bin/env node
// Vérifie la cohérence de l'extension avant de la packager.
//
// Tant que le code n'est pas bundlé, l'ordre et la liste des scripts sont
// maintenus à la main dans manifest.json, popup.html et report.html. Ce script
// échoue si un fichier référencé n'existe pas, et signale les fichiers JS
// présents dans js/ qui ne sont chargés nulle part.
//
// Usage : node scripts/check-manifest.mjs [--root <dossier>]
//   --root : vérifie un autre dossier (ex. le contenu du zip décompressé en CI).
//            Par défaut : la racine du dépôt.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv.indexOf('--root');
const root =
    rootArg !== -1 && process.argv[rootArg + 1]
        ? resolve(process.argv[rootArg + 1])
        : resolve(fileURLToPath(new URL('..', import.meta.url)));
const errors = [];
const warnings = [];

const read = (path) => readFileSync(join(root, path), 'utf8');
const toPosix = (path) => path.split('\\').join('/');

/** @type {Map<string, string>} fichier référencé → origine de la référence */
const referenced = new Map();
function reference(file, from) {
    const normalized = toPosix(file).replace(/^\.?\//, '');
    if (!referenced.has(normalized)) referenced.set(normalized, from);
}

// --- manifest.json --------------------------------------------------------
let manifest;
try {
    manifest = JSON.parse(read('manifest.json'));
} catch (error) {
    console.error(`✖ manifest.json illisible : ${error.message}`);
    process.exit(1);
}

if (manifest.background?.service_worker) reference(manifest.background.service_worker, 'manifest background');
if (manifest.action?.default_popup) reference(manifest.action.default_popup, 'manifest action');
for (const icon of Object.values(manifest.icons ?? {})) reference(icon, 'manifest icons');
for (const [i, cs] of (manifest.content_scripts ?? []).entries()) {
    for (const file of [...(cs.js ?? []), ...(cs.css ?? [])]) reference(file, `manifest content_scripts[${i}]`);
}
for (const war of manifest.web_accessible_resources ?? []) {
    for (const file of war.resources ?? []) reference(file, 'manifest web_accessible_resources');
}

// --- pages HTML de l'extension -------------------------------------------
const htmlPages = [manifest.action?.default_popup, 'report.html'].filter(Boolean);
const LOCAL_ASSET = /<(?:script|img)\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*\bhref="([^"]+)"/g;
for (const page of htmlPages) {
    if (!existsSync(join(root, page))) continue; // signalé plus bas
    for (const match of read(page).matchAll(LOCAL_ASSET)) {
        const url = match[1] ?? match[2];
        if (/^(https?:|data:|chrome-extension:|#)/.test(url)) continue;
        reference(url.split(/[?#]/)[0], page);
    }
}

// --- existence des fichiers ----------------------------------------------
for (const [file, from] of referenced) {
    if (!existsSync(join(root, file))) errors.push(`${file} (référencé par ${from}) est introuvable`);
}

// --- fichiers JS jamais chargés --------------------------------------------
function listJs(dir) {
    const out = [];
    for (const entry of readdirSync(join(root, dir))) {
        const path = join(dir, entry);
        if (statSync(join(root, path)).isDirectory()) out.push(...listJs(path));
        else if (entry.endsWith('.js')) out.push(toPosix(path));
    }
    return out;
}
for (const file of listJs('js')) {
    if (!referenced.has(file)) warnings.push(`${file} n'est chargé par aucun manifest ni page HTML`);
}

// --- versions (seulement si package.json est présent, donc pas dans le zip) --
if (existsSync(join(root, 'package.json'))) {
    const pkg = JSON.parse(read('package.json'));
    if (pkg.version !== manifest.version) {
        errors.push(`version différente : package.json=${pkg.version}, manifest.json=${manifest.version}`);
    }
}

// --- rapport -----------------------------------------------------------------
for (const warning of warnings) console.warn(`⚠ ${warning}`);
for (const error of errors) console.error(`✖ ${error}`);
if (errors.length > 0) process.exit(1);
console.log(`✔ manifest cohérent (${referenced.size} fichiers référencés, version ${manifest.version})`);
