"""Curved upper body of the 1989 three-door 205, authored from photo references.

The side sheets and screen surrounds have real window openings. All curves are
geometry; dimensions are metres in Blender's X-forward / Z-up frame.
"""
from __future__ import annotations

import math
import bpy
import bmesh
from mathutils import Vector

PI = math.pi
TAU = math.tau


def side_y(z):
    h = min(1, max(0, (z - .896) / .412))
    return .718 - .096 * h + .004 * math.sin(PI * h)


def round_loop(points, radius=.02, step=.028, corner_steps=6):
    """Round in the drawing plane, sampling straight runs as well as corners."""
    corners = []
    for i, co in enumerate(points):
        p, a, b = Vector(co), Vector(points[i-1]), Vector(points[(i+1) % len(points)])
        r = min(radius, .36 * (a-p).length, .36 * (b-p).length)
        before = p + (a-p).normalized() * r
        after = p + (b-p).normalized() * r
        curve = [(1-t)**2 * before + 2*(1-t)*t*p + t*t*after
                 for t in [j/corner_steps for j in range(corner_steps+1)]]
        corners.append(curve)
    out = []
    for i, curve in enumerate(corners):
        out.extend(tuple(p) for p in curve)
        a, b = curve[-1], corners[(i+1) % len(corners)][0]
        n = max(1, math.ceil((b-a).length/step))
        out.extend(tuple(a.lerp(b, j/n)) for j in range(1, n))
    return out


def sheet(api, name, outer, holes, mapping, mat, parent, thickness=.009, cuts=2,
          outward=(0, 1, 0)):
    """Fill nested planar loops, then bend the complete sheet onto its surface."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.resolution_u = 1
    for loop in [outer] + holes:
        spline = cu.splines.new('POLY')
        spline.points.add(len(loop)-1)
        for p, (a, b) in zip(spline.points, loop):
            p.co = (a, b, 0, 1)
        spline.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    cu.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts,
                                 use_grid_fill=True)
    # Collinear samples along a window may leave zero-area fill triangles.
    # Remove them while the sheet is still planar: bending first can turn a
    # null triangle into a thin sliver with a wholly incorrect surface normal.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    null_faces = [face for face in bm.faces if face.calc_area() < 1e-10]
    if null_faces:
        bmesh.ops.delete(bm, geom=null_faces, context='FACES_ONLY')
    loose_edges = [edge for edge in bm.edges if not edge.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context='EDGES')
    loose_verts = [vert for vert in bm.verts if not vert.link_faces]
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')
    direction = Vector(outward)
    analytic_normals = {}
    for v in bm.verts:
        a, b = v.co.x, v.co.y
        # Central differences describe the intended continuous surface, not
        # the arbitrary triangulation chosen to fill the surrounding sheet.
        step = 1e-5
        tangent_a = Vector(mapping(a+step, b)) - Vector(mapping(a-step, b))
        tangent_b = Vector(mapping(a, b+step)) - Vector(mapping(a, b-step))
        normal = tangent_a.cross(tangent_b).normalized()
        if normal.dot(direction) < 0:
            normal.negate()
        analytic_normals[v] = normal
        v.co = mapping(a, b)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if sum(f.normal.dot(direction)*f.calc_area() for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.verts.index_update()
    vertices = [v.co.copy() for v in bm.verts]
    normals = [analytic_normals[v] for v in bm.verts]
    faces = [tuple(v.index for v in face.verts) for face in bm.faces]
    boundary = []
    for edge in bm.edges:
        if len(edge.link_faces) == 1:
            loop = edge.link_loops[0]
            boundary.append((loop.vert.index, loop.link_loop_next.vert.index))
    bm.free()

    # Extrude with the analytic normal. SOLIDIFY used averaged mesh normals
    # and could push narrow window returns sideways through their black seals.
    front_count, vertex_count = len(faces), len(vertices)
    if thickness:
        vertices += [p-thickness*n for p, n in zip(vertices, normals)]
        faces += [tuple(i+vertex_count for i in reversed(face))
                  for face in faces[:front_count]]
        faces += [(b, a, a+vertex_count, b+vertex_count) for a, b in boundary]
    ob.data.clear_geometry()
    ob.data.from_pydata(vertices, [], faces)
    ob.data.update()
    for i, face in enumerate(ob.data.polygons):
        face.use_smooth = i < front_count * (2 if thickness else 1)
    sharp_pairs = {tuple(sorted(pair)) for pair in boundary}
    if thickness:
        sharp_pairs.update(tuple(sorted((a+vertex_count, b+vertex_count)))
                           for a, b in boundary)
    for edge in ob.data.edges:
        if tuple(sorted(edge.vertices)) in sharp_pairs:
            edge.use_edge_sharp = True
    loop_normals = []
    for i, face in enumerate(ob.data.polygons):
        for vertex_index in face.vertices:
            if i < front_count:
                normal = normals[vertex_index]
            elif thickness and i < front_count * 2:
                normal = -normals[vertex_index-vertex_count]
            else:
                normal = face.normal
            loop_normals.append(tuple(normal))
    ob.data.normals_split_custom_set(loop_normals)
    return ob


def window(api, name, outline, mapping, mats, body, glass, outward):
    sheet(api, name, outline, [], mapping, mats['glass'], glass,
          thickness=.0025, cuts=2, outward=outward)
    api.tube(name+'_rubber', [mapping(a,b) for a,b in outline], .0065,
             mats['rubber'], body, True, 8)


def roof_edge_z(x):
    q = min(1, max(0, (.175-x)/1.170))
    return 1.303 + .005 * math.sin(PI*q)**2


def roof_section_z(u, edge_z=1.303, centre_z=1.341):
    """Shared section for the roof and both headers: no detached roof edges."""
    w = side_y(edge_z)
    y = abs(u)*w
    if y <= .558:
        return centre_z-.012*(y/.558)**2
    angle = math.asin(min(1.,(y-.558)/(w-.558)*math.sin(1.35)))
    return centre_z-.012-(centre_z-.012-edge_z)*(1-math.cos(angle))/(1-math.cos(1.35))


def rear_mapping(u, v):
    z = .825 + .478*v
    if z < .889:
        t = (z-.825)/.064
        x = -1.728 + .008*t
        crown = -.05875*(1-u**4)*(1-t)-.020*(1-u*u)*t
    else:
        x = -1.720 + .725*(z-.889)/.414
        crown = -.020*(1-u*u)
    return (x+crown, side_y(z)*u,
            z + v*v*(roof_section_z(u)-1.303))


def front_mapping(u, v):
    z = .896 + .407*v
    return (.765-.590*v + (.020+.005*math.sin(PI*v))*(1-u*u),
            side_y(z)*u, z + .025*(1-u*u)*(1-v)
            + v*(roof_section_z(u)-1.303))


def build_cabin(api, body, glass, mats):
    paint, trim, rubber = mats['paint'], mats['trim'], mats['rubber']
    # A shorter roof and correctly placed B pillars give the original 3-door
    # proportions. The outer roof shoulder rolls into the side, not a flat lid.
    roof_rows = []
    roof_sections = [('curl', -1, j/9) for j in range(9, 0, -1)]
    roof_sections += [('centre', 0, -1+2*j/28) for j in range(29)]
    roof_sections += [('curl', 1, j/9) for j in range(1, 10)]
    for i in range(39):
        q = i/38
        x_edge = .175 - 1.170*q
        edge_z = roof_edge_z(x_edge)
        centre_z = 1.341 + .014*math.sin(PI*q)**2
        w = side_y(edge_z)
        row = []
        for kind, side, a in roof_sections:
            if kind == 'centre':
                y, z = .558*a, centre_z-.012*a*a
            else:
                angle = 1.35*a
                y = side*(.558+(w-.558)*math.sin(angle)/math.sin(1.35))
                z = centre_z-.012-(centre_z-.012-edge_z)*(1-math.cos(angle))/(1-math.cos(1.35))
            t = y/w
            x = x_edge + .020*(1-t*t)*(1-2*q)
            row.append((x,y,z))
        roof_rows.append(row)
    roof = api.ribbon('double_curvature_roof', roof_rows, paint, body)
    mod = roof.modifiers.new('Roof steel return', 'SOLIDIFY')
    mod.thickness, mod.offset = .010, -1
    api.apply_modifier(roof, mod)

    door = round_loop([(.666,.910),(.111,1.264),(-.390,1.277),(-.425,.910)],
                      radius=.018)
    quarter = round_loop([(-.508,.910),(-.490,1.276),(-.864,1.263),
                          (-.990,1.205),(-1.054,.963),(-1.013,.911)],
                         radius=.058, corner_steps=9)
    # Outline includes the rounded upper side rail and the wide triangular C
    # pillar. Both window contours are holes in this continuous steel sheet.
    outer = [(.770,.888),(.765,.896),(.209,1.282),(.175,1.303)]
    outer += [(x,roof_edge_z(x)) for x in [.175-1.170*j/38 for j in range(1,39)]]
    outer += [(-1.020,1.288),(-1.720,.889),(-1.720,.881)]
    for side, label in [(1,'L'),(-1,'R')]:
        def mapping(x,z, side=side):
            return (x,side*side_y(z),z)
        sheet(api,'curved_cabin_sheet_'+label,outer,[door,quarter],mapping,
              paint,body,.011,2,(0,side,0))
        window(api,'glass_door_'+label,door,mapping,mats,body,glass,(0,side,0))
        window(api,'glass_quarter_'+label,quarter,mapping,mats,body,glass,(0,side,0))
        b_loop = round_loop([(-.429,.895),(-.394,1.302),(-.479,1.302),(-.508,.895)],
                            radius=.004,step=.030,corner_steps=3)
        sheet(api,'B_pillar_'+label,b_loop,[],
              lambda x,z: (x,side*(side_y(z)+.0035),z),
              mats['trim_edge'],body,.004,2,(0,side,0))
        api.tube('gutter_'+label,
                 [(x,side*(side_y(roof_edge_z(x))+.002),roof_edge_z(x)+.002)
                  for x in [.173-1.167*j/44 for j in range(45)]],
                 .0028,trim,body,sides=6)
        api.tube('window_sill_'+label,
                 [(x,side*(side_y(.901)+.002),.901)
                  for x in [.687-1.763*j/44 for j in range(45)]],
                 .0043,trim,body,sides=6)
        # Period inserts sit on the broad C-pillar. The fuel cap is part of the
        # right lower plaque, as on the original car.
        for name,txt,x,z,w in [('engine','1.9',-1.237,1.070,.120),
                               ('model','GTI',-1.294,.999,.158)]:
            api.box('badge_back_'+name+'_'+label,(x,side*(side_y(z)+.009),z),
                    (w+.022,.009,.034),trim,body,.012,4)
            api.text_mesh('badge_'+name+'_'+label,txt,(x,side*(side_y(z)+.015),z),
                          .026,mats['stripe'],body,(0,side,0),(-side,0,0),w)
        if side == -1:
            x,z = -1.399,.999
            api.tube('fuel_filler_joint',
                     [(x+.042*math.cos(TAU*j/48),-(side_y(z+.042*math.sin(TAU*j/48))+.001),
                       z+.042*math.sin(TAU*j/48)) for j in range(48)],
                     .0013,mats['gap'],body,True,4)
            api.box('fuel_filler_badge_extension',(x,-(side_y(z)+.009),z),
                    (.069,.009,.034),trim,body,.012,4)
            api.cylinder('fuel_filler_lock',(x,-(side_y(z)+.016),z),.007,.003,
                         mats['badge'],body,vertices=20,edge=.0006)

    # Front frame, rear hatch and glass use the same curved parametrisation on
    # each surface: the seals cannot float above flat panels.
    surround = round_loop([(-1,0),(1,0),(1,1),(-1,1)],radius=.008,step=.045)
    windscreen = round_loop([(-.932,.054),(.932,.054),(.947,.925),(-.947,.925)],
                            radius=.035,step=.040,corner_steps=8)
    rear_screen = round_loop([(-.921,.275),(.921,.275),(.936,.932),(-.936,.932)],
                             radius=.050,step=.040,corner_steps=8)
    sheet(api,'curved_windscreen_surround',surround,[windscreen],front_mapping,
          paint,body,.010,2,(1,0,1))
    window(api,'glass_windscreen',windscreen,front_mapping,mats,body,glass,(1,0,1))
    sheet(api,'curved_tailgate_surround',surround,[rear_screen],rear_mapping,
          paint,body,.010,2,(-1,0,1))
    window(api,'glass_tailgate',rear_screen,rear_mapping,mats,body,glass,(-1,0,1))

    # Cowl is a curved, thin inset along the lower windscreen edge.
    api.ribbon('scuttle',[[front_mapping(u,v) for u in [-.94+1.88*j/44 for j in range(45)]]
                         for v in [.012,.030,.045]],trim,body)
    for side in (-1,1):
        for i in range(14):
            u=side*(.17+i*.047)
            api.tube('cowl_vent',[front_mapping(u-.003,.018),front_mapping(u-.003,.037)],
                     .0018,mats['gap'],body,sides=4)

    # A slim moulded spoiler follows the transverse roof crown.
    spoiler_rows=[]
    for j in range(49):
        u=-.98+1.96*j/48
        x,y,z=rear_mapping(u,1)
        spoiler_rows.append([(x+.021,y,z-.004),(x+.018,y,z+.010),
                             (x-.024,y,z+.012),(x-.043,y,z+.004),
                             (x-.040,y,z-.008),(x+.021,y,z-.004)])
    api.ribbon('curved_roof_spoiler',spoiler_rows,trim,body)
    # Defroster filaments follow the actual glass curvature.
    for i in range(8):
        v=.34+i*.072
        pts=[]
        for j in range(31):
            x,y,z=rear_mapping(-.85+1.70*j/30,v)
            pts.append((x-.0012,y,z+.0015))
        api.tube('heated_rear_window_'+str(i),pts,.00055,mats['heater'],glass,sides=4)
    # Thin separate wipers lie on the glass, not above the bonnet.
    for label,u in [('L',.48),('R',-.36)]:
        def wp(uu,vv):
            x,y,z=front_mapping(uu,vv)
            return (x+.006,y,z+.006)
        base=wp(u,.065)
        api.cylinder('wiper_pivot_'+label,base,.010,.011,trim,body,axis='Z',vertices=20)
        api.tube('wiper_arm_'+label,[base,wp(u+.13,.19),wp(u+.26,.27)],.0031,trim,body)
        api.tube('wiper_blade_'+label,[wp(u-.02,.19),wp(u+.40,.27)],.0050,trim,body)
    def rp(u,v):
        x,y,z=rear_mapping(u,v)
        return (x-.007,y,z+.006)
    api.cylinder('rear_wiper_pivot',rp(.015,.23),.012,.012,trim,body,axis='X',vertices=20)
    api.tube('rear_wiper_arm',[rp(.015,.23),rp(-.13,.34),rp(-.33,.40)],.0031,trim,body)
    api.tube('rear_wiper_blade',[rp(-.035,.35),rp(-.52,.40)],.0050,trim,body)
    api.box('aerial_foot',(.070,0,1.350),(.058,.038,.013),trim,body,.008)
    api.tube('aerial',[(.070,0,1.355),(-.10,0,1.48),(-.32,0,1.60)],.0015,trim,body)


def build_underbody(api,body,mats):
    api.box('underbody',(-.03,0,.247),(2.99,1.27,.052),mats['underbody'],body,.025)
    api.box('engine_sump',(1.13,0,.225),(.42,.59,.105),mats['underbody'],body,.033)
    api.cylinder('rear_silencer',(-1.48,.45,.24),.078,.33,mats['steel'],body,
                 axis='X',vertices=32,edge=.006)
    api.tube('exhaust_pipe',[(-.50,.22,.205),(-1.1,.27,.20),(-1.52,.43,.20),(-1.785,.49,.225)],
             .026,mats['steel'],body,sides=12)
    api.cylinder('exhaust_tip',(-1.790,.49,.225),.033,.034,mats['metal'],body,
                 axis='X',vertices=32,edge=.001)
    api.cylinder('exhaust_dark_bore',(-1.808,.49,.225),.026,.001,mats['gap'],body,
                 axis='X',vertices=32,edge=0)
