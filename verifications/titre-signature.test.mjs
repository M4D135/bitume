// Signature de l'écran titre : reprise de la branche opencode, puis déplacée en bas à gauche avec
// l'avatar embarqué (commit concurrent a617a04). Le contrôle porte sur l'écran titre lui-même.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const ici = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(process.argv[2] || path.join(ici, '..', 'src', 'index.html'), 'utf8');
const feuille = readFileSync(process.argv[3] || path.join(ici, '..', 'src', 'style.css'), 'utf8');

const debut = page.indexOf('<section id="titre"');
assert.ok(debut >= 0, "l'écran titre est absent de la page");
const titre = page.slice(debut, page.indexOf('</section>', debut));
const marque = (() => {
  const d = titre.indexOf('<div class="marque">');
  assert.ok(d >= 0, "la marque est absente de l'écran titre");
  return titre.slice(d, titre.indexOf('</div>', d));
})();

test("l'écran titre porte la signature m4d135 vers GitHub", () => {
  assert.match(titre, /<a class="signature" href="https:\/\/github\.com\/M4D135"/);
  assert.match(titre, /target="_blank" rel="noopener"/);
  assert.match(titre, />m4d135<\/a>/);
  assert.match(titre, /<img class="signature-avatar" src="data:image\/jpeg;base64,[A-Za-z0-9+/]+"/,
    "l'avatar de la signature doit être embarqué, sans appel réseau");
});

test('la marque garde son badge de version, sans fermeture excédentaire', () => {
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
  assert.match(feuille, /\.signature-avatar \{[^}]*border-radius: 50%/);
  assert.match(feuille, /#titre \.signature \{[^}]*position: absolute/);
});
