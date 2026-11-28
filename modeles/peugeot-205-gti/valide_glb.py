#!/usr/bin/env python3
"""Valide le modèle GLB autonome de la 205 GTI, sans dépendance Python.

Usage : python valide_glb.py --output rapport.json peugeot-205-gti.glb

Les mesures utilisent les transformations complètes de la scène glTF : X vers
l'avant, Y vers le haut, Z vers la droite ; unité : mètre. Les cotes hors
antennes/rétroviseurs sont des références, pas une boîte englobante imposée à
tous les détails. Les pivots des roues sont contrôlés indépendamment.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import math
from pathlib import Path
import struct
import sys


COMPONENTS = {
    5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
    5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4),
}
ELEMENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
            "MAT2": 4, "MAT3": 9, "MAT4": 16}
IDENTITY = (1., 0., 0., 0., 0., 1., 0., 0.,
            0., 0., 1., 0., 0., 0., 0., 1.)
EXPECTED_PIVOTS = {
    "wheel_FL": (1.21, .2875, -.68),
    "wheel_FR": (1.21, .2875, .68),
    "wheel_RL": (-1.21, .2875, -.68),
    "wheel_RR": (-1.21, .2875, .68),
}


class InvalidGLB(ValueError):
    """Structure GLB/glTF incohérente ou non prise en charge."""


def finite(values):
    return all(isinstance(x, (int, float)) and math.isfinite(x) for x in values)


def mmul(a, b):
    """Produit de matrices colonne glTF, stockées colonne par colonne."""
    return tuple(sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
                 for c in range(4) for r in range(4))


def point(matrix, xyz):
    return tuple(sum(matrix[k * 4 + r] * xyz[k] for k in range(3))
                 + matrix[12 + r] for r in range(3))


def local_matrix(node):
    if "matrix" in node:
        m = node["matrix"]
        if len(m) != 16 or not finite(m):
            raise InvalidGLB("Matrice de nœud non finie ou de dimension incorrecte")
        if any(key in node for key in ("translation", "rotation", "scale")):
            raise InvalidGLB("Un nœud contient simultanément matrix et TRS")
        if any(abs(m[i]) > 1e-7 for i in (3, 7, 11)) or abs(m[15] - 1) > 1e-7:
            raise InvalidGLB("Matrice de nœud non affine")
        return tuple(m)
    t = node.get("translation", [0, 0, 0])
    q = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    if len(t) != 3 or len(q) != 4 or len(s) != 3 or not finite(t + q + s):
        raise InvalidGLB("Transformation TRS de nœud incorrecte")
    if any(abs(x) < 1e-12 for x in s):
        raise InvalidGLB("Échelle de nœud nulle")
    norm = math.sqrt(sum(x * x for x in q))
    if abs(norm - 1) > 1e-4:
        raise InvalidGLB("Quaternion de nœud non unitaire")
    x, y, z, w = (v / norm for v in q)
    return (
        (1 - 2 * (y*y + z*z)) * s[0], 2 * (x*y + z*w) * s[0],
        2 * (x*z - y*w) * s[0], 0.,
        2 * (x*y - z*w) * s[1], (1 - 2 * (x*x + z*z)) * s[1],
        2 * (y*z + x*w) * s[1], 0.,
        2 * (x*z + y*w) * s[2], 2 * (y*z - x*w) * s[2],
        (1 - 2 * (x*x + y*y)) * s[2], 0.,
        t[0], t[1], t[2], 1.,
    )


def bounds(points):
    if not points:
        return None
    lo = [min(p[k] for p in points) for k in range(3)]
    hi = [max(p[k] for p in points) for k in range(3)]
    return {"min": [round(x, 7) for x in lo],
            "max": [round(x, 7) for x in hi],
            "dimensions": [round(hi[k] - lo[k], 7) for k in range(3)]}


class Document:
    def __init__(self, raw):
        if len(raw) < 20:
            raise InvalidGLB("En-tête GLB incomplet")
        magic, version, length = struct.unpack_from("<4sII", raw)
        if magic != b"glTF" or version != 2 or length != len(raw):
            raise InvalidGLB("Signature, version ou longueur GLB incorrecte")
        chunks, offset = [], 12
        while offset < len(raw):
            if offset + 8 > len(raw):
                raise InvalidGLB("En-tête de chunk tronqué")
            size, kind = struct.unpack_from("<I4s", raw, offset)
            offset += 8
            if size % 4 or offset + size > len(raw):
                raise InvalidGLB("Chunk tronqué ou non aligné sur 4 octets")
            chunks.append((kind, raw[offset:offset + size]))
            offset += size
        if not chunks or chunks[0][0] != b"JSON":
            raise InvalidGLB("Le premier chunk doit contenir le JSON")
        if sum(kind == b"JSON" for kind, _ in chunks) != 1:
            raise InvalidGLB("Plusieurs chunks JSON")
        bins = [content for kind, content in chunks if kind == b"BIN\0"]
        if len(bins) != 1:
            raise InvalidGLB("Un unique chunk binaire embarqué est attendu")
        self.data = json.loads(chunks[0][1].decode("utf-8"))
        if self.data.get("asset", {}).get("version") != "2.0":
            raise InvalidGLB("asset.version doit être 2.0")
        self.buffers = []
        for i, item in enumerate(self.data.get("buffers", [])):
            uri = item.get("uri")
            if uri is None:
                if i:
                    raise InvalidGLB("Seul le buffer 0 peut référencer le chunk BIN")
                content = bins[0]
            elif uri.startswith("data:") and ";base64," in uri:
                content = base64.b64decode(uri.split(",", 1)[1], validate=True)
            else:
                raise InvalidGLB("Buffer externe interdit : " + str(uri))
            required = item.get("byteLength", -1)
            if not isinstance(required, int) or required < 0 or required > len(content):
                raise InvalidGLB("Longueur de buffer hors limites")
            if uri is None and len(content) - required > 3:
                raise InvalidGLB("Padding binaire GLB supérieur à 3 octets")
            self.buffers.append(content[:required])
        if not self.buffers:
            raise InvalidGLB("Aucun buffer géométrique")
        self.cache = {}
        for i in range(len(self.data.get("bufferViews", []))):
            self.view(i)
        for image in self.data.get("images", []):
            uri = image.get("uri")
            if uri is not None and not uri.startswith("data:"):
                raise InvalidGLB("Texture/image externe interdite : " + str(uri))
            if uri is None:
                if "bufferView" not in image:
                    raise InvalidGLB("Image sans données embarquées")
                self.view(image["bufferView"])

    def view(self, index):
        views = self.data.get("bufferViews", [])
        if not isinstance(index, int) or not 0 <= index < len(views):
            raise InvalidGLB("Indice de bufferView hors limites")
        view = views[index]
        b = view.get("buffer", -1)
        if not isinstance(b, int) or not 0 <= b < len(self.buffers):
            raise InvalidGLB("Indice de buffer hors limites")
        start, size = view.get("byteOffset", 0), view.get("byteLength", -1)
        if (not isinstance(start, int) or not isinstance(size, int)
                or start < 0 or size < 0 or start + size > len(self.buffers[b])):
            raise InvalidGLB("bufferView hors du buffer embarqué")
        return memoryview(self.buffers[b])[start:start + size], view

    def unpack(self, view_id, offset, count, component, width, packed=False):
        content, view = self.view(view_id)
        code, size = COMPONENTS[component]
        element_size = width * size
        stride = element_size if packed else view.get("byteStride", element_size)
        if (not isinstance(offset, int) or offset < 0 or offset % size
                or not isinstance(stride, int) or stride < element_size or stride % size):
            raise InvalidGLB("Offset/stride d'accessor incorrect")
        stop = offset + (count - 1) * stride + element_size if count else offset
        if stop > len(content):
            raise InvalidGLB("Accessor hors de sa bufferView")
        decoder = struct.Struct("<" + code * width)
        return [decoder.unpack_from(content, offset + i * stride) for i in range(count)]

    def accessor(self, index):
        if index in self.cache:
            return self.cache[index]
        accessors = self.data.get("accessors", [])
        if not isinstance(index, int) or not 0 <= index < len(accessors):
            raise InvalidGLB("Indice d'accessor hors limites")
        a = accessors[index]
        kind, component, count = a.get("type"), a.get("componentType"), a.get("count")
        if kind not in ELEMENTS or component not in COMPONENTS:
            raise InvalidGLB("Type d'accessor non pris en charge")
        if not isinstance(count, int) or count < 0:
            raise InvalidGLB("Nombre d'éléments d'accessor incorrect")
        width = ELEMENTS[kind]
        # Les attributs de ce modèle sont scalaires/vecteurs. Les matrices de
        # petits entiers glTF exigeraient un padding par colonne distinct.
        if kind.startswith("MAT") and COMPONENTS[component][1] < 4:
            raise InvalidGLB("Accessor matriciel entier non pris en charge")
        values = (self.unpack(a["bufferView"], a.get("byteOffset", 0), count,
                              component, width) if "bufferView" in a
                  else [(0,) * width for _ in range(count)])
        if "sparse" in a:
            sparse = a["sparse"]
            n = sparse.get("count", -1)
            if not isinstance(n, int) or not 0 <= n <= count:
                raise InvalidGLB("Nombre d'éléments sparse incorrect")
            si, sv = sparse["indices"], sparse["values"]
            if si.get("componentType") not in (5121, 5123, 5125):
                raise InvalidGLB("Type des indices sparse incorrect")
            indices = self.unpack(si["bufferView"], si.get("byteOffset", 0), n,
                                  si["componentType"], 1, packed=True)
            updates = self.unpack(sv["bufferView"], sv.get("byteOffset", 0), n,
                                  component, width, packed=True)
            last = -1
            for (j,), update in zip(indices, updates):
                if not last < j < count:
                    raise InvalidGLB("Indices sparse non croissants ou hors limites")
                values[j], last = update, j
        if a.get("normalized"):
            if component == 5120:
                values = [tuple(max(x / 127, -1) for x in v) for v in values]
            elif component == 5122:
                values = [tuple(max(x / 32767, -1) for x in v) for v in values]
            elif component in (5121, 5123):
                limit = 255 if component == 5121 else 65535
                values = [tuple(x / limit for x in v) for v in values]
            else:
                raise InvalidGLB("Normalisation interdite pour ce componentType")
        if any(not finite(v) for v in values):
            raise InvalidGLB("Accessor %s : valeur NaN ou infinie" % index)
        self.cache[index] = values
        return values


def triangles(indices, mode):
    if mode == 4:
        if len(indices) % 3:
            raise InvalidGLB("Nombre d'indices non multiple de trois")
        return [tuple(indices[i:i + 3]) for i in range(0, len(indices), 3)]
    if mode == 5:
        return [(indices[i], indices[i+1], indices[i+2]) if i % 2 == 0
                else (indices[i+1], indices[i], indices[i+2])
                for i in range(len(indices) - 2)]
    if mode == 6:
        return [(indices[0], indices[i], indices[i+1]) for i in range(1, len(indices) - 1)]
    raise InvalidGLB("Ce modèle doit contenir uniquement des primitives triangulées")


def validate(path):
    report = {"valid": False, "file": path.name, "bytes": path.stat().st_size,
              "units": "metres", "axes": {"forward": "+X", "up": "+Y", "right": "+Z"},
              "errors": [], "warnings": [], "reference_dimensions_m": {
                  "length": 3.705, "body_width_with_arches": 1.589,
                  "height_without_antenna": 1.355, "wheelbase": 2.42,
                  "tyre_radius": .2875}}
    try:
        doc = Document(path.read_bytes())
        data = doc.data
        # Toutes les valeurs binaires sont inspectées, y compris les attributs
        # non employés dans le calcul de la boîte englobante.
        for i in range(len(data.get("accessors", []))):
            doc.accessor(i)
        meshes, nodes = data.get("meshes", []), data.get("nodes", [])
        mesh_data, unique_triangles, unique_vertices = [], 0, 0
        normal_drift = 0
        for mi, mesh in enumerate(meshes):
            prepared = []
            for pi, primitive in enumerate(mesh.get("primitives", [])):
                attr = primitive.get("attributes", {})
                if "POSITION" not in attr or "NORMAL" not in attr:
                    raise InvalidGLB("Maillage %s/%s : POSITION et NORMAL requis" % (mi, pi))
                positions, normals = doc.accessor(attr["POSITION"]), doc.accessor(attr["NORMAL"])
                if not positions or len(positions) != len(normals):
                    raise InvalidGLB("Maillage vide ou nombre de normales incorrect")
                if any(len(p) != 3 for p in positions + normals):
                    raise InvalidGLB("POSITION/NORMAL doivent être VEC3")
                for semantic, accessor in attr.items():
                    if len(doc.accessor(accessor)) != len(positions):
                        raise InvalidGLB("Nombre d'attributs %s incohérent" % semantic)
                for n in normals:
                    length = math.sqrt(sum(x*x for x in n))
                    if length < 1e-8:
                        raise InvalidGLB("Normale nulle")
                    normal_drift += abs(length - 1) > .005
                if "indices" in primitive:
                    a = data["accessors"][primitive["indices"]]
                    if a["type"] != "SCALAR" or a["componentType"] not in (5121, 5123, 5125):
                        raise InvalidGLB("Les indices doivent être des entiers non signés")
                    indices = [v[0] for v in doc.accessor(primitive["indices"])]
                else:
                    indices = list(range(len(positions)))
                if any(i < 0 or i >= len(positions) for i in indices):
                    raise InvalidGLB("Indice de sommet hors limites")
                faces = triangles(indices, primitive.get("mode", 4))
                material = primitive.get("material")
                if material is not None and not 0 <= material < len(data.get("materials", [])):
                    raise InvalidGLB("Indice de matériau hors limites")
                prepared.append((positions, faces))
                unique_triangles += len(faces)
                unique_vertices += len(positions)
            mesh_data.append(prepared)
        if normal_drift:
            report["warnings"].append("%s normales s'écartent de la longueur unitaire de plus de 0,5 %%" % normal_drift)
        scene_id = data.get("scene", 0)
        scenes = data.get("scenes", [])
        if not 0 <= scene_id < len(scenes):
            raise InvalidGLB("Scène principale absente ou incorrecte")
        scene_roots = scenes[scene_id].get("nodes", [])
        world, parents, active, points_all = {}, {}, set(), []
        node_metrics, scene_triangles, degenerate, min_area = [], 0, [], math.inf
        degenerate_count = 0

        def walk(index, parent_matrix, ancestry):
            nonlocal scene_triangles, min_area, degenerate_count
            if not isinstance(index, int) or not 0 <= index < len(nodes):
                raise InvalidGLB("Indice de nœud hors limites")
            if index in ancestry:
                raise InvalidGLB("Cycle dans la hiérarchie des nœuds")
            if index in active:
                raise InvalidGLB("Un nœud possède plusieurs parents dans la scène")
            active.add(index)
            node = nodes[index]
            matrix = mmul(parent_matrix, local_matrix(node))
            if not finite(matrix):
                raise InvalidGLB("Transformation monde non finie")
            world[index] = matrix
            if ancestry:
                parents[index] = ancestry[-1]
            name = node.get("name", "node_%s" % index)
            vertices, count = [], 0
            if "skin" in node:
                raise InvalidGLB("Un modèle rigide sans skin est attendu")
            if "mesh" in node:
                mesh_index = node["mesh"]
                if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(mesh_data):
                    raise InvalidGLB("Indice de maillage hors limites")
                for positions, faces in mesh_data[mesh_index]:
                    transformed = [point(matrix, p) for p in positions]
                    if any(not finite(p) for p in transformed):
                        raise InvalidGLB("Position monde non finie")
                    vertices.extend(transformed)
                    for a, b, c in faces:
                        u = tuple(transformed[b][k] - transformed[a][k] for k in range(3))
                        v = tuple(transformed[c][k] - transformed[a][k] for k in range(3))
                        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
                        area = .5 * math.sqrt(sum(x*x for x in cross))
                        min_area = min(min_area, area)
                        if area <= 1e-12:
                            degenerate_count += 1
                            if len(degenerate) < 20:
                                degenerate.append({"node": name, "indices": [a, b, c], "area_m2": area})
                        count += 1
                scene_triangles += count
                points_all.extend(vertices)
                node_metrics.append({"node": name, "triangles": count,
                                     "vertices": len(vertices), "aabb_world_m": bounds(vertices)})
            for child in node.get("children", []):
                walk(child, matrix, ancestry + (index,))

        for index in scene_roots:
            walk(index, IDENTITY, ())
        if not points_all or not scene_triangles:
            raise InvalidGLB("La scène ne contient aucun triangle")
        if degenerate:
            report["errors"].append("Triangles dégénérés présents (surface ≤ 1e-12 m²)")
            report["degenerate_triangle_examples"] = degenerate
        names = {}
        for i in active:
            names.setdefault(nodes[i].get("name", ""), []).append(i)
        expected = ("peugeot_205_gti", *EXPECTED_PIVOTS, "steering_wheel")
        for name in expected:
            if len(names.get(name, [])) != 1:
                report["errors"].append("Nœud requis absent ou non unique : " + name)
        root_ids = names.get("peugeot_205_gti", [])
        pivots = {}
        for name in (*EXPECTED_PIVOTS, "steering_wheel"):
            ids = names.get(name, [])
            if len(ids) != 1:
                continue
            i = ids[0]
            origin = point(world[i], (0., 0., 0.))
            pivot = {"world_m": [round(x, 7) for x in origin],
                     "children": len(nodes[i].get("children", []))}
            pending, descendants_with_mesh = [i], 0
            while pending:
                descendant = nodes[pending.pop()]
                descendants_with_mesh += "mesh" in descendant
                pending.extend(descendant.get("children", []))
            pivot["mesh_nodes_in_subtree"] = descendants_with_mesh
            if not descendants_with_mesh:
                report["errors"].append("Pivot sans géométrie attachée : " + name)
            if name in EXPECTED_PIVOTS:
                error = math.dist(origin, EXPECTED_PIVOTS[name])
                pivot["expected_world_m"] = list(EXPECTED_PIVOTS[name])
                pivot["error_m"] = round(error, 9)
                if error > .002:
                    report["errors"].append("Pivot %s : écart de %.6f m > 2 mm" % (name, error))
            if len(root_ids) == 1:
                ancestor, under_root = i, False
                while ancestor in parents:
                    ancestor = parents[ancestor]
                    under_root |= ancestor == root_ids[0]
                pivot["under_model_root"] = under_root
                if not under_root:
                    report["errors"].append("Pivot hors de la racine du modèle : " + name)
            pivots[name] = pivot
        if len(root_ids) == 1:
            origin = point(world[root_ids[0]], (0., 0., 0.))
            report["model_origin_world_m"] = list(origin)
            if math.dist(origin, (0., 0., 0.)) > 1e-6:
                report["errors"].append("La racine du modèle n'est pas à l'origine du sol")
        scene_bounds = bounds(points_all)
        if scene_bounds["min"][1] < -.003:
            report["errors"].append("Géométrie située à plus de 3 mm sous le sol")
        if abs(scene_bounds["min"][1]) > .003:
            report["warnings"].append("La boîte englobante ne repose pas au sol à 3 mm près")
        report.update({"glb_version": 2, "asset_generator": data.get("asset", {}).get("generator"),
                       "scene": scene_id, "scene_root_count": len(scene_roots),
                       "nodes": len(nodes), "active_nodes": len(active), "meshes": len(meshes),
                       "materials": len(data.get("materials", [])),
                       "images": len(data.get("images", [])),
                       "buffers_embedded": True, "external_dependencies": [],
                       "triangles_unique_meshes": unique_triangles,
                       "triangles_scene": scene_triangles, "vertices_unique_meshes": unique_vertices,
                       "degenerate_triangles": degenerate_count,
                       "minimum_triangle_area_m2": min_area,
                       "aabb_world_m": scene_bounds, "pivots": pivots,
                       "mesh_nodes": node_metrics})
    except (InvalidGLB, ValueError, KeyError, IndexError, TypeError,
            struct.error, UnicodeError, binascii.Error) as exc:
        report["errors"].append(str(exc))
    report["valid"] = not report["errors"]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="Modèle binaire glTF 2.0 (.glb)")
    parser.add_argument("--output", type=Path, help="Chemin du rapport JSON")
    args = parser.parse_args()
    try:
        report = validate(args.model)
    except OSError as exc:
        parser.exit(2, "Erreur de lecture : %s\n" % exc)
    payload = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
        summary = {"valid": report["valid"], "report": str(args.output),
                   "triangles": report.get("triangles_scene"),
                   "aabb_world_m": report.get("aabb_world_m"),
                   "errors": report["errors"], "warnings": report["warnings"]}
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(payload, end="")
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
