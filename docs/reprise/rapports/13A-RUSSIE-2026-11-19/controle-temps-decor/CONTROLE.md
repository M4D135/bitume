# Contrôle comparatif du seuil CPU du décor

Après la qualification globale du lot 13A, une exécution du test inchangé a été lancée sur la base publiée, puis une sur le candidat. Aucun autre test ni build ne tournait. Le seuil reste **150 ms**.

| Version | Code | Mesure signalée pour Val-Brûlé | Durée totale du processus |
|---|---:|---:|---:|
| Base `18451e0e` | 1 | 205 ms | 0,389 s |
| Candidat 13A | 1 | 211 ms | 0,373 s |

Les deux exécutions échouent au même contrôle. Le dépassement du seuil est donc également reproductible sur la base publiée dans cet environnement. Une exécution par version ne permet pas de conclure à un écart de performance entre les versions.

Le test et ses dépendances ont conservé leurs empreintes pendant chaque exécution. Les commandes exactes, répertoires, dates, durées et SHA-256 figurent dans `comparaison.json` ; les deux fichiers `.log` conservent les sorties intégrales.

Aucun seuil, test ou fichier source du jeu modifié. Aucun gain de FPS mesuré.
