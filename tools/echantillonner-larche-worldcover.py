"""Agrège une tuile catégorielle locale ESA WorldCover (rasterio et NumPy)."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import Window, from_bounds

TU = "ESA_WorldCover_10m_2021_v200_N42E006_Map.tif"
SHA = "a96ec5d86f42920bdd29ac8b6214388c2df1e3229b9efb8c283bcd44480c8c20"
BBOX = (331000, 4905000, 357000, 4923000)
EPSG = "EPSG:32632"
PAS = 200
SORTIE = Path(__file__).resolve().parents[1] / "docs/references/larche-vinadio-2026/sources/worldcover-2021.json"


def extraire(tuile):
    with tuile.open("rb") as f:
        if hashlib.file_digest(f, "sha256").hexdigest() != SHA:
            raise ValueError("Empreinte de la tuile 2021 v200 différente de la référence")
    ouest, sud, est, nord = BBOX
    nx, nz = (est-ouest)//PAS, (nord-sud)//PAS
    resultat = np.empty((nz, nx, 3), dtype="uint8")
    with rasterio.open(tuile) as ds:
        minx, miny, maxx, maxy = transform_bounds(EPSG, ds.crs, *BBOX, densify_pts=32)
        fenetre = from_bounds(minx, miny, maxx, maxy, ds.transform)
        # Garder les pixels partiellement intersectés par la reprojection.
        x0, y0 = int(fenetre.col_off)-2, int(fenetre.row_off)-2
        fenetre = Window(x0, y0, int(fenetre.width)+6, int(fenetre.height)+6)
        classes = ds.read(1, window=fenetre)
        if np.any(classes == 0):
            raise ValueError("Valeurs sans données dans l’emprise")
        for canal, classe in enumerate([10, 30, 60]):
            proportions = np.zeros((nz, nx), dtype="float32")
            reproject((classes == classe).astype("float32"), proportions,
                      src_transform=ds.window_transform(fenetre), src_crs=ds.crs,
                      dst_transform=from_origin(ouest, nord, PAS, PAS), dst_crs=EPSG,
                      resampling=Resampling.average)
            resultat[:, :, canal] = np.rint(255*proportions).astype("uint8")
    return dict(
        produit="ESA WorldCover 10 m 2021 v200", tuile=TU, sha256Tuile=SHA,
        attribution="© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
        licence="https://creativecommons.org/licenses/by/4.0/", doi="https://doi.org/10.5281/zenodo.7254221",
        crs=EPSG, originE=ouest, originN=nord, pas=PAS, nx=nx, nz=nz,
        classes=[10, 30, 60], note="Moyennes surfaciques forêt, prairie, sol nu ou à végétation clairsemée. Les autres classes restent dans le dénominateur.",
        fractionsU8=base64.b64encode(resultat.tobytes()).decode("ascii"))


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("tuile", type=Path)
    args.add_argument("--sortie", type=Path, default=SORTIE)
    options = args.parse_args()
    options.sortie.write_text(json.dumps(extraire(options.tuile), ensure_ascii=False, indent=2)+"\n")
