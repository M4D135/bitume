# Argentera sur la SS21

Dix-sept bâtiments longent la route jouée entre les km 6,296 et 6,564. Onze sont classés « abitativa », cinq « residenziale » et un d’usage inconnu. Leurs façades les plus proches se situent de 9,570 à 24,897 m de l’axe, avec une hauteur d’extrusion régionale de 3 à 8 m. La génération retient uniquement les édifices construits dont l’empreinte coïncide avec une unique unité volumétrique au sol de hauteur positive. Elle écarte les constructions trop proches des rails et celles qui s’enfonceraient dans le terrain de conduite.

L’extrait des services WFS de la BDTRE du 22 novembre 2026 contient 48 édifices, 51 unités volumétriques et huit tronçons portant le nom « SS21 DELLA MADDALENA ». Il conserve les coordonnées en EPSG:32632, les identifiants, les producteurs, les dates de mise à jour, les URL de requête et l’empreinte SHA-256 de chaque réponse. Les producteurs des objets sont Regione Piemonte, CSI Piemonte et ARPA Piemonte. Les services de la BDTRE sont publiés sous CC BY 4.0. BITUME sélectionne, projette, triangule et extrude ces données. [Extrait régional archivé](sources/bdtre-argentera.json) · [Portail officiel BDTRE et conditions de diffusion](https://igr.piemonte.it/scheda-informativa/bdtre-base-cartografica-riferimento) · [Licence Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

## Calage sur le tracé

Entre les km 6,180 et 6,920, 25 nœuds du relevé routier OpenStreetMap relient les coordonnées géographiques au chaînage du jeu. La translation mesurée vaut −63,782 m en X et +377,170 m en Z. L’erreur quadratique moyenne sur ces contrôles est de 0,254 m et le maximum de 0,702 m. Une comparaison indépendante mesure la distance entre 186 échantillons de l’axe du jeu et les segments de voirie régionale. Sa médiane est de 1,778 m, son 90e centile de 2,597 m et son maximum de 3,885 m. Les 17 contours restent à au moins 1,20 m au-delà de la limite latérale des segments routiers voisins. [Méthode et provenance du tracé](README.md)

## Volume et rendu

Les fondations suivent la surface de terrain de Larche. Le faîtage est posé à la hauteur « UN_VOL_AV » au-dessus du sol médian aux sommets. La forme du toit, la hauteur de gouttière, les baies, les volets et les teintes sont des interprétations. La neige emploie la couverture hivernale du jeu. Les résidences orientent leurs ouvertures vers la SS21.

Les bâtiments forment quatre îlots. À l’approche, chaque îlot regroupe façades, couvertures et vitrages. La qualité fine dispose aussi d’un maillage commun de volets. À distance, façades et couvertures suffisent à restituer les silhouettes. Les façades et toitures alimentent les collisions par triangles, et les polygones d’origine donnent les masques de sol. Les arbres et blocs rocheux évitent ces emprises. Le groupe de maisons fictives d’Argentera est remplacé au même emplacement dans le constructeur de Larche.

Pour régénérer les données à partir de l’extrait archivé et du terrain, lancer `python3 tools/preparer-pietraporzio.py --village argentera`. La génération est hors ligne. La réception visuelle et la conduite n’ont pas été effectuées pour ce lot.
