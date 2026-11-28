"""Rétroviseurs de 205 GTI : coques galbées, supports et glaces encastrées.

Géométrie procédurale sans texture. Repère Blender en mètres : X avant,
Y gauche, Z haut. ``api`` est le dictionnaire des helpers de ``generer.py``.
Ce module ne nettoie, n'exporte et ne sauvegarde jamais la scène.
"""

import math


def build_mirrors(api, body, mats):
    """Ajoute la paire de rétroviseurs à ``body`` et rend les objets créés.

    Les sections de coque roulent vers le nez et la lèvre arrière : les
    raccords visibles ne reposent pas sur le biseau d'une boîte. La glace et
    son logement utilisent le même repère légèrement orienté vers le pilote.
    """
    mesh = api['mesh']
    panel = api['panel']
    rounded_polygon = api['rounded_polygon']
    created = []
    segments = 32
    yaw = .15
    co, si = math.cos(yaw), math.sin(yaw)

    def outline(angle):
        # Rectangle à coins souples, un peu plus étroit en bas. L'extrémité
        # extérieure remonte de quelques millimètres comme la pièce moulée.
        c, s = math.cos(angle), math.sin(angle)
        u = math.copysign(abs(c) ** .61, c)
        v = math.copysign(abs(s) ** .61, s)
        return .077 * u * (.975 + .025 * v), .040 * v + .0035 * u

    contour = [outline(math.tau * i / segments) for i in range(segments)]

    for side, label in ((1, 'L'), (-1, 'R')):
        def world(depth, outward, height):
            return (.474 + co * depth - si * outward,
                    side * (.847 + si * depth + co * outward),
                    .943 + height)

        def ring(depth, width_scale=1., height_scale=1.):
            return [world(depth, u * width_scale, v * height_scale)
                    for u, v in contour]

        def loft(name, rings, material, cap_start=False, cap_end=False):
            verts = [point for section in rings for point in section]
            faces = []
            for k in range(len(rings) - 1):
                for j in range(segments):
                    n = (j + 1) % segments
                    faces.append((k * segments + j, k * segments + n,
                                  (k + 1) * segments + n,
                                  (k + 1) * segments + j))
            if cap_start:
                faces.append(tuple(range(segments - 1, -1, -1)))
            if cap_end:
                faces.append(tuple((len(rings) - 1) * segments + j
                                   for j in range(segments)))
            obj = mesh(name + '_' + label, verts, faces, material, body, True)
            created.append(obj)
            return obj

        # Plaque fine appliquée au coin avant du vitrage, sans gros coin rouge
        # ni embase massive dépassant du flanc.
        foot = [(.640, side * .721, .906),
                (.520, side * .697, .990),
                (.430, side * .722, .906)]
        obj = panel('mirror_triangle_' + label,
                    rounded_polygon(foot, .085, 3), mats['trim'],
                    body, .007, .0015)
        created.append(obj)

        # Bras court, section elliptique, qui rejoint la coque par-dessous.
        stations = [(.526, .723, .923, .027, .013),
                    (.522, .744, .927, .027, .014),
                    (.507, .770, .930, .024, .015),
                    (.493, .794, .936, .023, .017)]
        stem_segments = 12
        verts = []
        for x, y, z, rx, rz in stations:
            for j in range(stem_segments):
                a = math.tau * j / stem_segments
                verts.append((x + rx * math.cos(a), side * y,
                              z + rz * math.sin(a)))
        faces = []
        for k in range(len(stations) - 1):
            for j in range(stem_segments):
                n = (j + 1) % stem_segments
                faces.append((k * stem_segments + j, k * stem_segments + n,
                              (k + 1) * stem_segments + n,
                              (k + 1) * stem_segments + j))
        faces.append(tuple(range(stem_segments - 1, -1, -1)))
        faces.append(tuple((len(stations) - 1) * stem_segments + j
                           for j in range(stem_segments)))
        created.append(mesh('mirror_stalk_' + label, verts, faces,
                            mats['trim'], body, True))

        # Nez plein et convexe ; dos ouvert vers le conducteur. La dernière
        # section tourne à l'intérieur et forme une vraie lèvre de 5–7 mm.
        shell_sections = [(.067, .10, .14),
                          (.063, .44, .56),
                          (.053, .76, .83),
                          (.036, .94, .97),
                          (.010, 1., 1.),
                          (-.027, 1., 1.),
                          (-.049, .985, .975),
                          (-.058, .947, .924),
                          (-.059, .866, .770)]
        loft('mirror_housing', [ring(*section) for section in shell_sections],
             mats['trim'], cap_start=True)

        # Le joint est en retrait de la lèvre. Son fond ferme le logement et
        # reste derrière la glace, sans surface argentée posée sur la coque.
        loft('mirror_seal', [ring(-.0588, .867, .773),
                             ring(-.0528, .839, .729),
                             ring(-.0445, .835, .725)],
             mats['rubber'], cap_end=True)

        # Glace convexe très légère : centre 0,6 mm en avant du bord visible,
        # mais ensemble 5 mm en retrait de la lèvre extérieure. Deux anneaux
        # plus un centre évitent les longues facettes d'un simple n-gone.
        verts = [world(-.0541, 0., 0.)]
        for fraction in (.50, 1.):
            depth = -.0535 - .0006 * (1. - fraction * fraction)
            verts.extend(world(depth, u * .833 * fraction, v * .720 * fraction)
                         for u, v in contour)
        faces = [(0, 1 + j, 1 + (j + 1) % segments)
                 for j in range(segments)]
        for j in range(segments):
            n = (j + 1) % segments
            faces.append((1 + j, 1 + segments + j,
                          1 + segments + n, 1 + n))
        obj = mesh('mirror_glass_' + label, verts, faces,
                   mats['mirror'], body, True)
        # Une surface ouverte doit regarder l'arrière des deux côtés ; le
        # calcul de normales d'une coque fermée ne peut pas décider pour elle.
        if sum(face.normal.x for face in obj.data.polygons) > 0:
            for face in obj.data.polygons:
                face.flip()
            obj.data.update()
        created.append(obj)

    return created
