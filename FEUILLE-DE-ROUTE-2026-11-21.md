# BITUME — Feuille de route du 21 novembre 2026

Document canonique disponible dans : [`docs/reprise/FEUILLE-DE-ROUTE-2026-11-21.md`](docs/reprise/FEUILLE-DE-ROUTE-2026-11-21.md)

---

## 1. Cadre et état des lieux

Cette feuille de route consolide l'état du projet au **21 novembre 2026**, intègre les décisions récentes de David (pivot 126 CK, demandes de mise en scène arcade, inspirations de course) et fixe l'ordonnancement de l'exécution autonome.

* **Socle livré sur `origin/main` :** **0.2.77** (commit `11e7e55`), physique **p15**, moteur **FERRO 0.3.15** canonique (34 modules verrouillés conformes SHA-256).
* **Validation des suites :** 182 suites de vérification Node réussies, 8 tests Python conformes, budget de la page autonome HTML respecté (< 1,4 Mo par `construire.py`), zéro asset importé, aucune ressource externe chargée au runtime.
* **Périmètre catalogue :** 9 circuits jouables (les 8 tracés initiaux + la Route-des-Cimes 0.2.66), 4 saisons paramétrables, mode météo réelle par géolocalisation préservé.
* **Déploiement externe :** Maintenu en local pour validation ; aucun déploiement sur `bitume.estrasse.fr` sans feu vert explicite de David.

---

## 2. Pivot visuel : Objectif Ferrari 126 CK (1980)

David a refusé les propositions de cockpit 0.2.75 et 0.2.76 issues de la 312 T5 et a fixé un nouvel objectif visuel formel : la **Ferrari F1 126 CK (1980)**.

1. **Références acquises et publiées (PR 53) :**
   * Collection complète RenderBlade de 41 fichiers (9 270 341 octets) indexée dans [`docs/references/ferrari-126ck-renderblade-2026-11-21/GALERIE.md`](docs/references/ferrari-126ck-renderblade-2026-11-21/GALERIE.md).
   * 20 rendus photoréalistes et 20 vues filaires géométriques en 1920 × 1920.
   * Vues clés cockpit : `16/36` (axial cockpit), `09/29` (plan supérieur), `11/31` (profil rétros et volant), `12/32` (plongée avant).
2. **Détail du volant vs ensemble de la monoplace :**
   * Le volant suit la **photo réelle** partagée par David : branches pleines noires, moyeu circulaire rond et rembourré, boutons latéraux, pas d'habillage ajouré.
   * La galerie RenderBlade fixe les proportions générales, la planche d'instruments, les rétroviseurs et l'enveloppe extérieure.
3. **Livraison d'essai 0.2.77 :**
   * Volant et cadrans réalignés, FOV par défaut passé à **70° vertical**, glaces de rétroviseurs réorientées, flux pluie/neige calmé dos au vent, trois timbres de klaxons synthétiques.
   * Version publiée sur `main` spécifiquement pour l'essai utilisateur (*« push main je veux test puis continue le projet »*).

---

## 3. Ordre d'exécution prioritaire

L'exécution autonome reprend selon le découpage suivant, par lots unitaires et branches dédiées :

| Priorité | Lot | Branche / Fiche | Objectif & Contenu |
|---|---|---|---|
| **P0 (Actif)** | **Carrosserie 126 CK** (0.2.78) | `codex/bitume-0278-carrosserie-126ck-20261121`<br>[`docs/reprise/OBJECTIF-126CK-2026-11-21.md`](docs/reprise/OBJECTIF-126CK-2026-11-21.md) | Reprise complète des formes extérieures dans `src/voiture.js` : nez aplati, pontons latéraux à arêtes vives, écopes de refroidissement, carénage moteur / arceau profilé, ailerons avant et arrière d'après les filaires 126 CK. Modèle monde unique partagé cockpit / extérieur. Physique p15 inchangée. |
| **P1** | **Réserve budget décor** | Fiche [`docs/reprise/OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md`](docs/reprise/OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md) | Résorber les pointes de construction de décor (> 150 ms strict observées sur Val-Brûlé / Haut-Col). Appliquer la piste d'allocation fixe des indices de nappes Route (19 323 couples temporaires) sans altération visuelle. |
| **P2** | **Mise en scène Arcade & Survol** | Fiche [`docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md`](docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md) | 1. Transitions de caméras continues (poursuite / arceau / cockpit sans coupure visuelle).<br>2. Panneaux de virage animés / clignotants.<br>3. Bandeaux LED de course (drapeaux, secteurs, tours).<br>4. Caméras aériennes : hélicoptère de retransmission et drones de tournage (portés depuis METAL). |
| **P3** | **Relief & Virages relevés** | Fiche [`docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md`](docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md) | Virages inclinés et dévers progressifs sur les tracés générés, surfaces raccordées et continuité de contact PhysX. |
| **P4** | **Pistes de course (satyam-fp/race)** | Fiche [`docs/reprise/REFERENCE-RACE-2026-11-21.md`](docs/reprise/REFERENCE-RACE-2026-11-21.md) | 8 pistes concrètes : netteté des contacts entre surfaces, simplification lointaine des silhouettes de forêt, sons de frottement pneu/carrosserie et dynamique de récupération après choc. |

---

## 4. Programme d'extension des circuits (Objectif 17 destinations)

Le catalogue s'étend pour passer des 9 circuits actuels à 17 destinations complètes, avec 4 saisons et météo dynamique pour chacune :

```
[Circuits Actuels (9)]
  ├── Port-Sable, Côte-d'Émeraude, Val-Brûlé, Plaine-du-Vent
  ├── Forêt-Noire, Piste-des-Oasis, Grand-Marais, Lac-Baïkal (13A/B)
  └── Route-des-Cimes (0.2.66 - 9,70 km, 3 couverts, viaduc)

[Extension Montagne & Villes Réelles (3)]
  ├── Haut-Col (22A) : rampes >10 %, corniche et second tunnel
  ├── Monaco (14A-F) : altimétrie qualifiée, passage sous tunnel, port, épingle
  └── Marseille (15A-F) : corridor urbain densifié, corniche et tabliers superposés

[Nouvelles Destinations Originales (5)]
  ├── Fjord-d'Argent (16A)
  ├── Crêtes-des-Carpates (16B)
  ├── Landes-d'Écosse (16C)
  ├── Sierra-Cuivrée (16D)
  ├── Baie-du-Corail (16E)
  └── Col-des-Andes (16F)
```

---

## 5. Chantiers système, conduite et réseau

1. **Conduite (Chantier 17 - Physique p16) :**
   * Calibrage à 521 ch à partir du socle p15.
   * ABS réglable par niveau d'aide, glisse progressive et transition adhérence/dérive.
   * Versionnage strict : conservation des chronos et fantômes sur la physique exacte du run.
2. **Multijoueur léger (Chantier 27) :**
   * Remplacement du serveur relais actuel par une signalisation P2P WebRTC légère sans infrastructure dédiée à maintenir pour David.
   * Maintien du salon existant jusqu'à qualification complète du système de remplacement.
3. **Profils d'exécution et fluidité :**
   * Profils dédiés machines modestes (Xbox One / iGPU Intel).
   * Cache IndexedDB intègre avec invalidation de version automatique (`SIZE.json`).
   * Détection graphique transparente avant le titre au premier lancement.

---

## 6. Règles de conduite de projet pour l'agent

* **Autonomie bornée :** Enchaînement des lots de la file [`docs/reprise/FILE-TRAVAIL.json`](docs/reprise/FILE-TRAVAIL.json) sans solliciter de validation intermédiaire si le contrat de test et les critères de clôture sont tenus.
* **Intégrité absolue du code :** Zéro régression sur les 182 suites Node et 8 tests Python. Moteur FERRO verrouillé au bit près (aucun patch local sans passage par le dépôt FERRO de référence).
* **Documentation & Reprise :** Mise à jour systématique de [`REPRISE.md`](REPRISE.md), [`docs/reprise/ETAT.json`](docs/reprise/ETAT.json) et du journal à chaque fin de lot publié.
* **Aucun asset externe :** Toutes les géométries, shaders, sons et logiques restent 100 % procéduraux et embarqués dans la page HTML unique.
