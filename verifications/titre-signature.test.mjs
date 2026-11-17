// Signature de l'écran titre : reprise de la branche opencode, sans sa fermeture </span> excédentaire
// et sans le lien ZIP que le second commit avait retiré.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const ici = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(process.argv[2] || path.join(ici, '..', 'src', 'index.html'), 'utf8');
const feuille = readFileSync(process.argv[3] || path.join(ici, '..', 'src', 'style.css'), 'utf8');

const debut = page.indexOf('<div class="marque">');
assert.ok(debut >= 0, 'la marque est absente de la page');
const marque = page.slice(debut, page.indexOf('</div>', debut));

test('la marque porte la signature m4d135 vers GitHub', () => {
  assert.match(marque, /<a class="signature" href="https:\/\/github\.com\/M4D135"/);
  assert.match(marque, /target="_blank" rel="noopener"/);
  assert.match(marque, /<svg viewBox="0 0 64 64"[^>]*><circle cx="32" cy="32" r="32" fill="#b7492a"\/><\/svg>m4d135<\/a>/);
});

test('aucune fermeture excédentaire et le badge de version reste en place', () => {
  const ouvrants = (marque.match(/<span\b/g) || []).length, fermantes = (marque.match(/<\/span>/g) || []).length;
  assert.equal(ouvrants, fermantes, 'les span de la marque ne sont pas appariés');
  assert.doesNotMatch(marque, /<\/span>\s*<\/span>/);
  assert.match(marque, /<b class="version-jeu" aria-label="Version __VERSION_JEU__">V__VERSION_JEU__<\/b>/);
});

test('le lien ZIP retiré par la branche ne revient pas', () => {
  assert.doesNotMatch(page, /m4d-zip|TÉLÉCHARGER[^<]*ZIP/i);
});

test('la feuille de style tient la signature', () => {
  assert.match(feuille, /\.signature \{[^}]*display: inline-flex/);
  assert.match(feuille, /\.signature:hover, \.signature:focus-visible \{/);
  assert.match(feuille, /\.signature svg \{/);
});
