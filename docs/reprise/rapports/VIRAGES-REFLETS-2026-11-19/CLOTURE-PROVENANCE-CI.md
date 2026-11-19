# Clôture documentaire 0.2.54 — provenance et CI

La tête de code `10f71ff1ad6c9ae5ae26fbe761c8bfa7332c3c30` est publiée dans la PR [n°8](https://github.com/M4D135/bitume/pull/8), encore ouverte. Main reste à `f03a99cc…` tant que la fusion n’est pas constatée. Cette clôture ne change ni source, ni test, ni build.

## Provenance réellement publiée

FERRO main est `a22b738fbe2aa2b36b659fca94527acc2ffcd635`, arbre `c858dea55ae3b38c307910124936394671cfbf74`. Les preuves sont sous `docs/reflets-0312/` ; le chemin `docs/ferro-reference/ssr-0312-2026-11-19/` n’existe pas dans cet arbre. Les copies annexées sont exactes et leurs empreintes figurent dans `RECONCILIATION-PROVENANCE.json`.

Le canon établit 194 tests réussis, aucun échec et un TODO hérité. EMPRISE a été contrôlé sur **11 contrats ciblés : 9 réussis, deux échecs hérités reproduits avec 0.3.11, aucun nouvel échec** ; 88 scripts valides et 34 modules exacts. Le build complet a réellement été tenté, puis bloqué par `src/city-data.js` indisponible via le connecteur. Aucune donnée n’a été substituée ; aucune scène complète ni cadence matérielle n’a été qualifiée.

Le rapport de la tête concurrente annonçait EMPRISE 11/17 et deux builds hôte identiques. Ces déclarations ne sont pas étayées par le canon publié. Le rapport original reste conservé, octet pour octet, dans `archives-10f71ff1/qualification-finale.json` ; aucun journal brut, aucune revue ni preuve concurrente n’est effacé. Le rapport courant corrige la provenance sans réinterpréter ces traces en résultats acquis.

## CI complète et qualification ciblée

Les deux CI rattachées à la tête de code terminent à **109/111**, en `failure`. Leurs journaux complets et empreintes sont sous `github/`.

| Run / job | Réussies | Réserve décor | Réserve traces |
|---|---:|---|---|
| 44572852026 / 135732349014 | 109/111 | Val-Brûlé : 161 ms, budget 150 ms | signature héritée identique |
| 44572720938 / 135731872927 | 109/111 | Val-Brûlé : 166 ms, budget 150 ms | signature héritée identique |

Aucune comparaison base/candidat n’a été réalisée dans ces deux runs : les temps observés n’établissent ni régression ni gain. La qualification locale ciblée reste **38/39**, avec les seules traces héritées et la reprise chaussée enrichie **12/12**. Les 20 lois/oracles p13, 54 scripts, 50 contrôles de repères et deux builds identiques sont conservés.

Build : **14 089 230 octets**, SHA-256 `db24f69a55bd6ac6778009e9511dbb901f82e62628adfbaab8e11980a467d3a3`. Aucun test local ni build n’a été relancé pour cette clôture. Aucun déploiement, scène navigateur complète ou FPS matériel validé.

## Reprise demandée

Le prochain lot porte sur **PhysX avec une nouvelle version physique**, les sols hors-route enrichis par shader entièrement procédural, et l’animation extérieure de la tête/bras et du passage de rapport du pilote. 13B Baïkal reste demandé, différé. La fusion de la PR n°8 appartient à l’orchestrateur après contrôle final.
