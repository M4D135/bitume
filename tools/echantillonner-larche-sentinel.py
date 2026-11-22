"""Fabriquer deux modulations du pigment sur la grille du MNT, avec NumPy et Rasterio."""
from contextlib import ExitStack
from pathlib import Path
from urllib.request import Request, urlopen
import base64
import hashlib
import json

import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds


SOURCES = Path(__file__).resolve().parents[1] / "docs/references/larche-vinadio-2026/sources"
BUCKET = "https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/N44/"
TUILES = {
    "N44E006": "957eedd4cb65157db7568333cd0ec769-73",
    "N44E007": "f7841e805984cb38de293682b7745e1d-70",
}


def somme_locale(a, rayon):
    """Fenêtre carrée tronquée en bordure, avec une seule somme intégrale."""
    p = np.pad(a, rayon, mode="constant")
    cumul = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    n = 2 * rayon + 1
    return cumul[n:, n:] - cumul[:-n, n:] - cumul[n:, :-n] + cumul[:-n, :-n]


def extraire():
    g = json.loads((SOURCES / "piemonte-dtm5-samples.json").read_text())["valleyOverview100m"]
    x, y, pas, nx, nz = (g[k] for k in ("originE", "originN", "resM", "width", "height"))
    emprise = (x, y-nz*pas, x+nx*pas, y)
    urls = [BUCKET + f"ESA_WorldCover_10m_2021_v200_{id}_S2RGBNIR.tif" for id in TUILES]
    with ExitStack() as stack:
        stack.enter_context(rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3"))
        for url, attendu in zip(urls, TUILES.values()):
            with urlopen(Request(url, method="HEAD"), timeout=30) as reponse:
                if reponse.headers["ETag"].strip('"') != attendu:
                    raise ValueError(f"Révision du produit à actualiser pour {url}")
        sources = [stack.enter_context(rasterio.open(url)) for url in urls]
        a, b, c, d = transform_bounds("EPSG:32632", sources[0].crs, *emprise, densify_pts=33)
        # Fusionner les deux côtés du méridien avant de moyenner les cellules qui le traversent.
        mos, transfo = merge(sources, bounds=(a-.001, b-.001, c+.001, d+.001),
                            indexes=[1, 2, 3], res=tuple(v*4 for v in sources[0].res),
                            resampling=Resampling.average, nodata=0)
        rgb = np.zeros((3, nz, nx), dtype="float32")
        reproject(mos, rgb, src_transform=transfo, src_crs=sources[0].crs, src_nodata=0,
                  dst_transform=from_origin(x, y, pas, pas), dst_crs="EPSG:32632",
                  resampling=Resampling.average)
    rgb *= .0001
    # Intensité moyenne des trois bandes visibles et excès relatif de vert (B03).
    # Les ombres profondes et la neige de la mosaïque annuelle gardent la palette saisonnière du jeu.
    visible = rgb.mean(axis=0)
    valide = (rgb.min(axis=0) > .015) & (visible < .27)
    log = np.log(np.maximum(visible, .001))
    poids = somme_locale(valide.astype("float64"), 8)
    fond = somme_locale(np.where(valide, log, 0).astype("float64"), 8) / np.maximum(1, poids)
    residu = np.where(valide & (poids >= 12), np.clip(log - fond, -.7, .7), 0)
    vert = np.where(valide, np.clip(rgb[1] / np.maximum(.001, visible) - 1, -.28, .28), 0)
    indices = np.stack((128 + np.rint(125*residu/.7), 128 + np.rint(125*vert/.28)), axis=-1).astype("uint8")
    octets = indices.tobytes()
    return dict(produit="ESA WorldCover Annual Cloudless Mosaic RGBNIR 2021 v200", sources=urls,
                etags=list(TUILES.values()), licence="https://creativecommons.org/licenses/by/4.0/",
                attribution="© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
                crs="EPSG:32632", originE=x, originN=y, pas=pas, nx=nx, nz=nz,
                canaux=["contraste_visible_local", "exces_vert"], neutre=128,
                cellulesExploitees=int((valide & (poids>=12)).sum()), sha256=hashlib.sha256(octets).hexdigest(),
                nuancesU8=base64.b64encode(octets).decode("ascii"))


if __name__ == "__main__":
    resultat = extraire()
    (SOURCES / "sentinel-mosaique-2021.json").write_text(json.dumps(resultat, ensure_ascii=False, indent=2)+"\n")
    print(f"{resultat['cellulesExploitees']} cellules exploitables sur {resultat['nx'] * resultat['nz']}, {resultat['sha256']}")
