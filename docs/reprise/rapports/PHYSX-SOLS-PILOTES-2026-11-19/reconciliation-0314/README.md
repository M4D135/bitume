# Reprises après FERRO 0.3.14

**12/12 suites ciblées réussies ; aucun fichier source, test ou fixture modifié pendant ces reprises.**

HEAD de départ : `9f25ec36e4dca86c43d5f0ba4946c948bc6fcac6` avec l’installation officielle FERRO 0.3.14 et les tests de la réconciliation. Les 234 empreintes détaillées avant/après sont identiques. VERSION, SIZE et dist, reconstruits en parallèle par l’orchestrateur, sont volontairement hors de ce gel.

| Suite | Résultat | Durée du processus |
|---|---|---|
| physique-voitures | 14 réussis, 0 échec | 2.574 s |
| physx-circuits | 14 réussis, 0 échec | 11.156 s |
| physx-stands | 11 réussis, 0 échec | 14.238 s |
| physx-cycle-vie | 2 réussis, 0 échec | 0.315 s |
| physique-cycle-seances | 4 réussis, 0 échec | 7.713 s |
| physx-autorite-reseau | 2 réussis, 0 échec | 0.365 s |
| determinisme-simulation | 3 cas / 54 empreintes exactes | 11.641 s |
| autoconfig-integration | 22 réussis, 0 échec | 0.115 s |
| russie | 9 réussis, 0 échec | 14.796 s |
| solides-physx-wasm | 23 réussis, 0 échec | 6.480 s |
| physx-monde | 6 réussis, 0 échec | 1.072 s |
| chargement | 9 réussis, 0 échec | 1.318 s |

Ces durées mesurent des processus de qualification ; ce ne sont pas des mesures FPS.

La fixture p14 existante est relue en mode normal, sans `--ecrire`. Les autres fixtures sont aussi inchangées. Tous les paramètres `BITUME_*` hérités ont été retirés ; aucun adaptateur PhysX alternatif ni mode géométrie seule pour la Russie. Les sorties de rapports sont dirigées uniquement vers ce dossier.

Le contrôle de déterminisme conserve ses 54 empreintes avec le nouvel adaptateur. Les gardes couvrent véhicules, surfaces/collisions des huit circuits, stands, autorité réseau, arrêt/restauration/préchauffe des séances et chargement.

Il ne s’agit pas d’un nouveau balayage intégral. La réserve historique de traces reste dans la qualification consolidée. Aucun essai navigateur, multi-machines ou FPS matériel n’est revendiqué.

Faits complets, codes retour, commandes, empreintes des journaux : `reprises.json`.
