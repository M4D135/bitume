#!/usr/bin/env python3
"""Régressions de l'oracle PNG, sans GPU ni navigateur.

Les images synthétiques ont des translations connues ; le champ du jeu ne sert
jamais à fabriquer le résultat attendu. Lancer : python verifications/visiere-png.test.py
"""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('visiere_png', Path(__file__).resolve().parents[1] / 'tools/qualification/visiere-png.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)


def motif(graine):
    rng = np.random.default_rng(graine)
    y, x = np.mgrid[-8:9, -8:9]
    return (rng.random((17, 17)) * .7 + .3) * np.exp(-(x * x + y * y) / 55)


def champ(signe=1):
    a, b = np.zeros((400, 600)), np.zeros((400, 600))
    graine = 0
    for cote_x, xs in [(-1, [60, 110]), (1, [450, 500])]:
        for cote_y, ys in [(-1, [55, 100]), (1, [280, 330])]:
            for x in xs:
                for y in ys:
                    p = motif(graine)
                    graine += 1
                    a[y - 8:y + 9, x - 8:x + 9] = p
                    bx, by = x + signe * cote_x * 11, y + signe * cote_y * 9
                    b[by - 8:by + 9, bx - 8:bx + 9] = p * .55
    return a, b


def intervalle(a, b):
    # Données de transport volontairement incohérentes : seul le PNG est jugé.
    avant = {'suivi': {'image': 12, 'couche': 4, 'vitesse': 300 / 3.6, 'transport': [0, 999, -999, 0]}}
    apres = {'suivi': {'image': 48, 'couche': 4, 'vitesse': 300 / 3.6, 'transport': [-90, 0, 500, 1]}}
    ca = {'dimensions': [a.shape[1], a.shape[0]], 'alpha': a}
    cb = {'dimensions': [b.shape[1], b.shape[0]], 'alpha': b}
    return P.analyser_paire('synthetique', avant, apres, ca, cb, P.options())


class OraclePNG(unittest.TestCase):
    def test_translation_et_fondu_mesures_sans_transport(self):
        p = motif(6)
        image = np.zeros((96, 128))
        image[34:51, 47:64] = p * .4
        resultat = P.retrouver(p, image, [40, 33])
        self.assertIsNotNone(resultat)
        np.testing.assert_allclose(resultat['centre'], [55, 42], atol=.01)
        self.assertGreater(resultat['correlation'], .999)

    def test_transparence_et_motif_ambigu_ne_constituent_pas_une_preuve(self):
        p = motif(7)
        self.assertIsNone(P.retrouver(p, np.zeros((96, 128)), [40, 33]))
        image = np.zeros((96, 128))
        image[20:37, 20:37] = p
        image[20:37, 70:87] = p
        self.assertIsNone(P.retrouver(p, image, [40, 33]))

    def test_bord_de_nappe_centrale_ne_devient_pas_un_quadrant_exterieur(self):
        image = np.zeros((120, 200))
        y, x = np.mgrid[0:120, 0:200]
        image[((x - 45) / 20) ** 2 + ((y - 45) / 24) ** 2 < 1] = .8
        self.assertGreater(len(P.motifs(image)), 0)
        supports = [{'centre': [45, 45], 'boite': [25, 21, 65, 69]}]
        self.assertEqual(P.motifs(image, supports=supports), [])

    def test_quatre_quadrants_valides_et_mauvais_sens_refuse(self):
        a, b = champ()
        bon = intervalle(a, b)
        self.assertEqual(bon['statut'], 'conforme', bon['quadrants'])
        self.assertGreaterEqual(bon['mesuresHorsCentre'], 12)
        mauvais = intervalle(b, a)
        self.assertEqual(mauvais['statut'], 'non_conforme', mauvais['quadrants'])

    def test_disparition_opacite_sans_deplacement_ne_prouve_pas_evacuation(self):
        a, _ = champ()
        resultat = intervalle(a, a * .3)
        self.assertEqual(resultat['statut'], 'non_conforme', resultat['quadrants'])
        self.assertEqual(resultat['conformes'], 0)

    def test_absence_de_mesures_ne_peut_pas_reussir(self):
        resultat = intervalle(np.zeros((100, 100)), np.zeros((100, 100)))
        self.assertEqual(resultat['statut'], 'preuve_insuffisante')
        with tempfile.TemporaryDirectory() as dossier:
            (Path(dossier) / 'etats.json').write_text(json.dumps([]))
            self.assertFalse(P.analyser(dossier)['reussi'])

    def test_voisinages_perles_refusent_un_png_fige_malgre_le_transport_annonce(self):
        points = np.random.default_rng(90).uniform([30, 30], [570, 370], (220, 2))
        apres = (points - [300, 180]) * 1.08 + [300, 180]
        ca = {'dimensions': [600, 400], 'composantes': [{'centre': p.tolist()} for p in points]}
        cb = {'dimensions': [600, 400], 'composantes': [{'centre': p.tolist()} for p in apres]}
        a = {'suivi': {'image': 12, 'couche': 1, 'vitesse': 300 / 3.6, 'transport': [1, 0, 0, 1]}}
        b = {'suivi': {'image': 48, 'couche': 1, 'vitesse': 300 / 3.6, 'transport': [1.4, -.2, -.18, 1]}}
        bon = P.analyser_paire('perles', a, b, ca, cb, P.options())
        self.assertEqual(bon['statut'], 'conforme', bon['quadrants'])
        fige = P.analyser_paire('perles', a, b, ca, ca, P.options())
        self.assertEqual(fige['statut'], 'non_conforme', fige['quadrants'])
        self.assertEqual(fige['conformes'], 0)
        # Deux voisinages parfaitement indistinguables ne sont pas une identité.
        _, _, ratios = P.voisins_descripteurs(np.zeros((2, 12)), np.zeros((2, 12)))
        np.testing.assert_array_equal(ratios, [1, 1])

    def test_png_denses_immobiles_et_opacite_seule_refuses_apres_extraction(self):
        rng = np.random.default_rng(71)
        alpha = np.zeros((240, 320))
        yy, xx = np.mgrid[-4:5, -4:5]
        for y in range(20, 220, 12):
            for x in range(20, 300, 12):
                px, py = x + int(rng.integers(-2, 3)), y + int(rng.integers(-2, 3))
                rayon = rng.uniform(1.3, 2.1)
                alpha[py - 4:py + 5, px - 4:px + 5] = 230 * np.exp(-(xx * xx + yy * yy) / (rayon * rayon))
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            for mode, poids in [('repete', [1, 1, 1]), ('opacite', [1, .65, .4])]:
                etats = []
                for pas, facteur in zip([12, 48, 108], poids):
                    nom = f'{mode}-{pas}'
                    image = np.zeros((240, 320, 4), dtype='uint8')
                    image[:, :, 3] = (alpha * facteur).astype('uint8')
                    Image.fromarray(image).save(racine / (nom + '-overlay.png'))
                    etats.append({'nom': nom, 'suivi': {'groupe': mode, 'image': pas, 'couche': 1, 'vitesse': 300 / 3.6}})
                (racine / 'etats.json').write_text(json.dumps(etats))
                resultat = P.analyser(racine)
                self.assertFalse(resultat['reussi'], mode)
                self.assertTrue(all(r['statut'] != 'conforme' for r in resultat['intervalles']), mode)


if __name__ == '__main__':
    unittest.main()
