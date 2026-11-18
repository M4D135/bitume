/* BITUME — lot 22F : le constructeur de tracés par partitions (génération 3) vit désormais dans le jeu, dans
   src/circuit.js (B.circuit.creer(graine, { partition }) et B.circuit.trace). Ce module le recharge tel quel pour les
   outils de l'étude (plans, profils, captures, vérifications) : une seule source, en Node comme dans la page.

   TRACE.construire(partition, options) rend le circuit (champs de circuit.js, plus lieux, couverts, ponts, bords,
   rampes, croisements, vitesseP9, vitesseP10, kv, mesures) ; TRACE.controler(c, attentes) la liste des problèmes ;
   TRACE.esquisse(partition) le tour sans fermeture en position, pour écrire une partition. */
import { createRequire } from 'node:module';

createRequire(import.meta.url)('../src/circuit.js');
export const TRACE = globalThis.BITUME.circuit.trace;
