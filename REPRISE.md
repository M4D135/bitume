# BITUME — reprise courte

## Candidat 0.2.87 — faune proche et démos des circuits

Base `main` : `7fb5dcc` / 0.2.85. Physique p15 et FERRO 0.3.15 conservés.
Branche locale de réception : `codex/bitume-faune-demos-validation-20261121`.
Source du runtime : `5e89033`, conservée à l’identique.

- **F1/F2 préparés** : habitats proches des bords, animaux proches visibles en Légère,
  sommeil hors des champs utiles, horloge locale sans rattrapage au réveil.
- **J1/J2 et rétros** : six champs persistants, mêmes caméras réfléchies que le rendu ;
  les glaces désactivées ne réactivent plus largement les animaux derrière la voiture.
- **D1/D2 préparés** : démos route/course, tracé et lieux réels des neuf circuits ;
  plans herbe/faune/flore et gros plans détachés du circuit retirés.
- **Préparation cinéma** : réutilisation des formes procédurales, catalogue des
  primitives construit au plus une fois par décor ; gardes de caméra maintenues.

Les 81 images des neuf circuits de .86 sont reçues : route/tracé/lieu cadrés aux
trois instants, sans refus visuel. La revue a détecté une coupure à la portée des
animaux. **.87 ajoute le fondu réel FERRO et son budget FX déclaré au chargement.**

Build .87 reconstruit à l’identique. Les deux bancs encore refusés dans la CI .86
sont corrigés : Baïkal contrôle le vrai dégagement et anime les groupes observés
pendant 90 s ; le cycle PhysX charge le raccord des champs de faune. La qualification
locale complète réussit : **203/203 suites Node et 8/8 contrôles Python**. Aucun changement du jeu ni du numéro de version.

**Publication .87 encore bloquée par le contrôle automatique d’autorisation.**
Le dépôt public cible est `M4D135/bitume`, branche indiquée ci-dessus ; aucun push
de .87 n’a abouti. Le navigateur local échoue avant WebGL (`socket: EPERM`).
Les captures .86 ne qualifient donc toujours pas le rendu .87. Recevoir les images
proches low/high/off, les neuf démos et la transition opaque/FX de distance avant
intégration. Aucun FPS matériel annoncé.

[Fiche et progression](docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md)
· [Candidat exact](docs/reprise/rapports/FAUNE-DEMOS-2026-11-21/CANDIDAT-0287.json)
· [Réception locale](docs/reprise/rapports/FAUNE-DEMOS-2026-11-21/RECEPTION-LOCALE-0287.json)
· [État précédent .85](docs/reprise/rapports/FAUNE-DEMOS-2026-11-21/BASE-0285.md).

## Suite

1. Publier la branche de réception après déblocage de l’autorisation ; le commit
   de réception déclenche les deux workflows de captures et la CI complète.
2. Recevoir les résultats du commit exact, inspecter le fondu puis intégrer sur main.
3. Conserver les essais matériels Xbox/iOS et les autres lots ouverts.
4. Larche → Vinadio : poursuivre L3/L4, puis ajouter sa démo lors de l’entrée au catalogue.
