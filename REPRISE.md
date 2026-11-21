# BITUME — reprise courte

## Priorité : démarrage téléphone sans banc

Candidat **0.2.80 / p15 / FERRO 0.3.15** : détection passive, sans scène de
mesure ni rafale GPU. Les 103 contrôles ciblés passent ; réception navigateur
et publication en cours. [Fiche](docs/reprise/DEMARRAGE-MOBILE-SANS-BANC-2026-11-21.md).
Les mains restent sur leur branche et seront intégrées après leurs images.

## Point d’entrée : personnages et mains après Gemini

Lire [le lot mains](docs/reprise/MAINS-REALISME-2026-11-21.md), puis
`docs/reprise/ETAT.json`. La dernière demande reprend les avancées Gemini sur
`main` et donne priorité aux personnages, surtout aux mains plus réalistes.

**Nouveau trajet : sommet du col de Larche → Vinadio, par la SS21, environ 32 km.**
La dernière précision de David remplace le départ initial de Barcelonnette.
Vrai tracé et vrai relief, échelle 1:1, parcours ouvert avec arrivée.
[Fiche sources et lots L0–L6](docs/reprise/COL-DE-LARCHE-VINADIO-2026-11-21.md).

## Publication et préparations

Base publiée vérifiée : **0.2.79 / p15 / FERRO 0.3.15**, `main` **`d408124`**,
126 CK, poignets R4b corrigés, six caméras et compteurs du titre intégrés.
HTML `77d774fd99484f7d` ; **190 suites Node et 8 tests Python réussis** dans la CI
du commit exact. [Reçu](docs/reprise/rapports/MAINS-REALISME-2026-11-21/BASE-0279.json).
Les anciennes réserves R4b sont levées ; les alias .75/.77 ont été archivés.

La voiture et son implantation par rapport aux essieux précèdent le pilote.
Une seule géométrie monde dans toutes les vues ; occultation naturelle du volant
acceptée. [Plan R0–R5](docs/reprise/MODELE-COMPLET-126CK-2026-11-21.md).

Lot actif : **M1–M3, doigts et transitions**, sur
`codex/bitume-mains-realisme-20261121` ; conserver le rig R4b et qualifier les
surfaces et captures comparées .79/candidat. Puis M4 personnages/manches et
**L0–L2 Larche → Vinadio**. [Programme complet](docs/reprise/FEUILLE-DE-ROUTE-2026-11-21.md).
Préserver décor, PR 43, Monaco/Marseille et les 9 circuits existants.
Réserve construction décor <150 ms ouverte. Activation réelle des compteurs et
version servie sur le site non vérifiées par cet audit du dépôt.
