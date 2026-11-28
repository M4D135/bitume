#!/usr/bin/env python3
"""Peugeot 205 GTI 1.9, 1989 — original, texture-free procedural model.

Run with Blender 4.3+: blender -b --python generer.py -- --output <directory>
Blender coordinates: X forward, Y left, Z up, metres. Origin: ground / axle midpoint.
No game files are imported or modified. The export remains an independent asset.
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

PI = math.pi
TAU = math.tau
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, default=HERE)
    p.add_argument('--render', action='store_true', help='Render actual model views after export')
    p.add_argument('--samples', type=int, default=40)
    p.add_argument('--resolution', type=int, default=1600)
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def material(name, color, roughness=.4, metallic=0, coat=0, alpha=1):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, alpha)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = .15
    bsdf.inputs['Alpha'].default_value = alpha
    m.diffuse_color = (*color, alpha)
    if alpha < 1:
        m.surface_render_method = 'DITHERED'
        m.use_transparency_overlap = False
    return m


def empty(name, parent=None, location=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.empty_display_type = 'PLAIN_AXES'
    o.empty_display_size = .08
    o.parent = parent
    o.location = location
    return o


def mesh(name, verts, faces, mat, parent=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    me.materials.append(mat)
    for f in me.polygons:
        f.use_smooth = smooth
    return ob


def apply_modifier(ob, mod):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bevel(ob, width=.005, segments=3):
    mod = ob.modifiers.new('Manufactured edge radii', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    apply_modifier(ob, mod)
    for f in ob.data.polygons:
        f.use_smooth = True
    mod = ob.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    apply_modifier(ob, mod)
    return ob


def box(name, loc, size, mat, parent=None, radius=.005, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    ob.parent = parent
    if radius:
        bevel(ob, min(radius, min(size) * .44), segments)
    return ob


def cylinder(name, loc, radius, depth, mat, parent=None, axis='Y', vertices=48, edge=.001):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    if axis == 'Y':
        ob.rotation_euler.x = PI / 2
    elif axis == 'X':
        ob.rotation_euler.y = PI / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.data.materials.append(mat)
    ob.parent = parent
    if edge:
        bevel(ob, edge, 2)
    else:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def tube(name, points, radius, mat, parent=None, cyclic=False, sides=6):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = max(0, (sides - 4) // 4)
    curve.resolution_u = 1
    curve.use_fill_caps = True
    s = curve.splines.new('POLY')
    s.points.add(len(points) - 1)
    for p, co in zip(s.points, points):
        p.co = (*co, 1)
    s.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    ob.parent = parent
    return ob


def ribbon(name, rings, mat, parent, smooth=True):
    n = len(rings[0])
    verts = [p for ring in rings for p in ring]
    faces = [(i*n+j, i*n+j+1, (i+1)*n+j+1, (i+1)*n+j)
             for i in range(len(rings)-1) for j in range(n-1)]
    return mesh(name, verts, faces, mat, parent, smooth)


def panel(name, points, mat, parent, thickness=.008, edge=.003):
    ob = mesh(name, points, [tuple(range(len(points)))], mat, parent)
    if thickness:
        mod = ob.modifiers.new('Panel thickness', 'SOLIDIFY')
        mod.thickness = thickness
        mod.offset = 0
        apply_modifier(ob, mod)
    if edge:
        bevel(ob, edge, 2)
    return ob


def rounded_polygon(points, fraction=.08, subdivisions=4):
    """Round polygon corners in its own surface, without subdivision shrinkage."""
    out = []
    for i, p in enumerate(points):
        a, b, c = Vector(points[i-1]), Vector(p), Vector(points[(i+1) % len(points)])
        before, after = b.lerp(a, fraction), b.lerp(c, fraction)
        for j in range(subdivisions + 1):
            t = j / subdivisions
            out.append(tuple((1-t)**2*before + 2*(1-t)*t*b + t*t*after))
    return out


def text_mesh(name, text, loc, size, mat, parent, normal, right, width=None):
    """Blender's bundled outline font, converted to geometry before export."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body, cu.align_x, cu.align_y = text, 'CENTER', 'CENTER'
    cu.size, cu.extrude, cu.bevel_depth = size, .00035, 0
    cu.resolution_u = 2
    cu.bevel_resolution = 0
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.location, ob.parent = loc, parent
    r, n = Vector(right).normalized(), Vector(normal).normalized()
    u = n.cross(r).normalized()
    ob.rotation_euler = Matrix((r, u, n)).transposed().to_euler()
    cu.materials.append(mat)
    bpy.context.view_layer.update()
    if width:
        if cu.body and ob.bound_box:
            actual = max(p[0] for p in ob.bound_box) - min(p[0] for p in ob.bound_box)
            if actual > 0:
                ob.scale.x = width / actual
    return ob


def lerp_table(x, table):
    for (a, va), (b, vb) in zip(table, table[1:]):
        if a <= x <= b:
            return va + (vb-va)*(x-a)/(b-a)
    return table[0][1] if x < table[0][0] else table[-1][1]


def belt_z(x):
    return lerp_table(x, [(-1.79,.891),(-1.50,.915),(-.70,.917),(.35,.913),(.73,.912),(1.25,.87),(1.65,.837),(1.84,.807)])


def width_at(x, z):
    width = lerp_table(x, [(-1.79,.699),(-1.63,.744),(-1.2,.757),(-.65,.755),(.5,.752),(1.20,.754),(1.64,.737),(1.84,.702)])
    return width + .012*math.sin(PI*min(1,max(0,(z-.25)/.67))) - .028*max(0,(.38-z)/.16)


def arch_bottom(x):
    for c in (-1.21, 1.21):
        dx = abs(x-c)
        if dx <= .334:
            return .2875 + .347*math.sqrt(max(0,1-(dx/.334)**2))
    return .235


def side_y(z):
    return .718 - .104*min(1,max(0,(z-.91)/.407))


def build_body(body, glass, mats):
    paint, trim, rubber = mats['paint'], mats['trim'], mats['rubber']
    xs = set(-1.79 + i*(3.63/90) for i in range(91))
    for c in (-1.21,1.21):
        xs.update(c+.334*math.cos(PI*i/32) for i in range(33))
        xs.update([c-.336,c+.336])
    xs = sorted(xs)
    for side, label in [(1,'L'),(-1,'R')]:
        rings=[]
        for x in xs:
            lo, hi = arch_bottom(x), belt_z(x)
            ring=[]
            for k in range(7):
                z = lo+(hi-lo)*k/6
                ring.append((x,side*width_at(x,z),z))
            rings.append(ring)
        ob = ribbon('body_side_'+label,rings,paint,body)
        mod=ob.modifiers.new('Steel skin','SOLIDIFY'); mod.thickness=.009; mod.offset=-1
        apply_modifier(ob,mod)
        shoulders=[]
        for i in range(65):
            x=-1.79+2.525*i/64
            z=belt_z(x);w=width_at(x,z)
            shoulders.append([(x,side*w,z),(x,side*min(.714,w-.012),z+.002)])
        ribbon('belt_shoulder_'+label,shoulders,paint,body)
        # Genuine wheel openings and separate moulded extensions, with a returned inner lip.
        for c, axle in [(1.21,'front'),(-1.21,'rear')]:
            arches=[]
            for i in range(65):
                a = -.14 + (PI+.28)*i/64
                ca, sa=math.cos(a),math.sin(a)
                inner=(c+.334*ca,.2875+.347*sa)
                outer=(c+.384*ca,.2875+.397*sa)
                arches.append([
                    (inner[0],side*.745,inner[1]),
                    (inner[0],side*.787,inner[1]),
                    ((inner[0]+outer[0])/2,side*.7945,(inner[1]+outer[1])/2),
                    (outer[0],side*.775,outer[1]),
                    (outer[0],side*(width_at(outer[0],outer[1])+.002),outer[1])])
            ob=ribbon('arch_'+axle+'_'+label,arches,trim,body)
            mod=ob.modifiers.new('Arch thickness','SOLIDIFY'); mod.thickness=.004
            apply_modifier(ob,mod)
            # Dark inner wheel tub; no painted slab across the wheel opening.
            well=[]
            for i in range(49):
                a=PI*i/48
                well.append([(c+.326*math.cos(a),side*y,.2875+.339*math.sin(a)) for y in (.49,.73)])
            ribbon('wheelwell_'+axle+'_'+label,well,rubber,body)
            wall=[(c,side*.49,.28)]+[(c+.328*math.cos(PI*i/48),side*.49,.2875+.344*math.sin(PI*i/48)) for i in range(49)]
            panel('wheelwell_inner_wall_'+axle+'_'+label,wall,rubber,body,.004,0)
        # Door, sill and continuous period rub strip between wheel arches.
        for k,(a,b) in enumerate([(-1.78,-1.565),(-.870,.870),(1.565,1.82)]):
            xx=[a+(b-a)*i/18 for i in range(19)]
            rings=[]
            for x in xx:
                rings.append([(x,side*(width_at(x,z)+d),z) for z,d in [(.515,.002),(.526,.013),(.587,.017),(.609,.009)]])
            ob=ribbon('rubstrip_'+label+str(k),rings,trim,body)
            mod=ob.modifiers.new('Moulding thickness','SOLIDIFY');mod.thickness=.007;apply_modifier(ob,mod)
            tube('red_inlay_'+label+str(k),[(x,side*(width_at(x,.585)+.020),.585) for x in xx],.0052,mats['stripe'],body)
        sill=box('sill_'+label,(-.02,side*.722,.246),(1.71,.055,.055),paint,body,.016)
        tube('sill_seam_'+label,[(-.83,side*.749,.268),(.79,side*.747,.268)],.0023,trim,body)
        seam=[(.746,.906),(.789,.847),(.834,.693),(.827,.405),(.758,.277),(-.641,.277),(-.700,.334),(-.728,.72),(-.702,.917)]
        tube('door_gap_'+label,[(x,side*(width_at(x,z)+.004),z) for x,z in seam],.0025,mats['gap'],body)
        box('door_handle_recess_'+label,(-.57,side*.764,.821),(.164,.011,.052),mats['gap'],body,.015)
        box('door_handle_'+label,(-.573,side*.776,.825),(.142,.022,.033),trim,body,.011)
        cylinder('door_lock_'+label,(-.596,side*.779,.774),.008,.005,mats['metal'],body,vertices=20)
        # Tiny amber fender repeater.
        box('side_indicator_bezel_'+label,(.93,side*.775,.768),(.069,.012,.028),trim,body,.009)
        box('side_indicator_'+label,(.93,side*.784,.768),(.055,.007,.020),mats['amber'],body,.005)

    # Crown of the bonnet and the front fender shoulders.
    bonnet=[]
    for i in range(25):
        x=.733+(1.839-.733)*i/24
        z=belt_z(x)
        w=width_at(x,z)
        bonnet.append([(x,w*t,z+.025*(1-t*t)) for t in [-1+j/14 for j in range(29)]])
    ob=ribbon('bonnet',bonnet,paint,body)
    sol=ob.modifiers.new('Bonnet panel','SOLIDIFY');sol.thickness=.012;sol.offset=-1;apply_modifier(ob,sol)
    for side in (1,-1):
        tube('bonnet_shutline_'+str(side),[(x,side*width_at(x,belt_z(x))*.93,belt_z(x)+.006) for x in [.76+i*1.075/42 for i in range(43)]],.0018,mats['gap'],body)
    tube('bonnet_rear_gap',[(.747,-.7,.924),(.747,0,.939),(.747,.7,.924)],.0022,mats['gap'],body)

    # Roof is a broad gently crowned steel pressing, with thin rain gutters.
    roof=[]
    for i in range(25):
        x=-1.178+1.366*i/24
        q=i/24
        roof.append([(x,(.621+.006*math.sin(PI*q))*t,1.322+.025*(1-t*t)+.008*math.sin(PI*q)) for t in [-1+j/12 for j in range(25)]])
    ob=ribbon('roof',roof,paint,body)
    sol=ob.modifiers.new('Roof skin','SOLIDIFY');sol.thickness=.015;sol.offset=-1;apply_modifier(ob,sol)
    for side,label in [(1,'L'),(-1,'R')]:
        # A-pillar, door frame, B-pillar and large characteristic red C-pillar.
        panel('A_pillar_'+label,[(x,side*side_y(z),z) for x,z in [(.782,.907),(.180,1.333),(.102,1.307),(.664,.907)]],paint,body,.032,.006)
        panel('roof_rail_'+label,[(x,side*side_y(z),z) for x,z in [(.17,1.333),(-1.189,1.329),(-1.239,1.275),(.10,1.282)]],paint,body,.025,.005)
        panel('B_pillar_'+label,[(x,side*(side_y(z)+.003),z) for x,z in [(-.635,.910),(-.624,1.308),(-.705,1.308),(-.731,.910)]],trim,body,.024,.004)
        panel('C_pillar_'+label,[(x,side*side_y(z),z) for x,z in [(-1.162,1.327),(-1.789,.891),(-1.269,.908),(-1.217,1.267)]],paint,body,.025,.005)
        # Window polygons are inset into the pillars, with actual clear openings.
        door=[(.662,.923),(.103,1.285),(-.606,1.296),(-.633,.924)]
        quarter=[(-.744,.925),(-.721,1.293),(-1.104,1.281),(-1.167,1.246),(-1.216,1.135),(-1.245,.985),(-1.216,.927)]
        for typ,pts in [('door',door),('quarter',quarter)]:
            pts3=rounded_polygon([(x,side*(side_y(z)+.004),z) for x,z in pts],.19 if typ=='quarter' else .055,7 if typ=='quarter' else 5)
            panel('glass_'+typ+'_'+label,pts3,mats['glass'],glass,.003,0)
            tube('window_seal_'+typ+'_'+label,pts3,.0095,rubber,body,True,8)
            # Inner satin edge gives the window seal a believable double profile.
        tube('gutter_'+label,[(.17,side*.641,1.327),(-.44,side*.643,1.346),(-1.18,side*.637,1.325)],.005,trim,body)
        tube('window_sill_'+label,[(.704,side*.73,.913),(-.72,side*.733,.916),(-1.29,side*.729,.912)],.006,trim,body)
        # Badges live on the red C-pillar; the right side includes the filler cap.
        for name,txt,x,z,w in [('engine','1.9',-1.407,1.083,.122),('model','GTI',-1.461,1.009,.160)]:
            box('badge_back_'+name+'_'+label,(x,side*(side_y(z)+.015),z),(w+.022,.009,.040),trim,body,.012)
            text_mesh('badge_'+name+'_'+label,txt,(x,side*(side_y(z)+.021),z),.031,mats['stripe'],body,(0,side,0),(-side,0,0),w)
        if side == -1:
            # Filler lock is integrated at the rear end of the lower GTI plaque.
            z=1.009;x=-1.566;y=-(side_y(z)+.011)
            tube('fuel_filler_joint',[(x+.044*math.cos(TAU*i/40),y,z+.044*math.sin(TAU*i/40)) for i in range(40)],.0017,mats['gap'],body,True,4)
            box('fuel_filler_badge_extension',(x,-(side_y(z)+.015),z),(.069,.010,.040),trim,body,.013)
            cylinder('fuel_filler_lock',(x,-(side_y(z)+.022),z),.008,.003,mats['badge'],body,vertices=16,edge=.0007)

    # Curved windshield and rear glass, surrounded by separate rubber and bodywork.
    def screen(name, bottom_x,bottom_z,bottom_w,top_x,top_z,top_w):
        rings=[]
        for i in range(15):
            v=i/14
            x=bottom_x*(1-v)+top_x*v
            z=bottom_z*(1-v)+top_z*v
            w=bottom_w*(1-v)+top_w*v
            rings.append([(x+.014*(1-t*t)*(1 if bottom_x>0 else -1),w*t,z+.009*(1-t*t)) for t in [-1+j/18 for j in range(37)]])
        ob=ribbon(name,rings,mats['glass'],glass)
        sol=ob.modifiers.new('Glass thickness','SOLIDIFY');sol.thickness=.003;apply_modifier(ob,sol)
        outline=rings[0]+[r[-1] for r in rings[1:]]+list(reversed(rings[-1][:-1]))+[r[0] for r in reversed(rings[1:-1])]
        tube(name+'_seal',outline,.014,rubber,body,True,8)
    screen('glass_windscreen',.725,.934,.670,.137,1.292,.593)
    screen('glass_tailgate',-1.701,.966,.657,-1.215,1.291,.580)
    # Cowl, hatch upper/lower and rear frame.
    panel('scuttle',[(.73,-.705,.927),(.73,.705,.927),(.795,.702,.918),(.795,-.702,.918)],trim,body,.018,.002)
    for side in (-1,1):
        for i in range(15):
            y=side*(.12+i*.031)
            box('cowl_vent',(.766,y,.933),(.027,.009,.002),mats['gap'],body,.001)
    panel('tailgate_upper', [(-1.199,-.615,1.326),(-1.199,.615,1.326),(-1.243,.621,1.274),(-1.243,-.621,1.274)],paint,body,.016,.003)
    panel('tailgate_lower',[(-1.713,-.685,.961),(-1.713,.685,.961),(-1.786,.701,.813),(-1.786,-.701,.813)],paint,body,.018,.004)
    for side in (-1,1):
        panel('tailgate_side_'+str(side),[(-1.198,side*.614,1.322),(-1.794,side*.722,.881),(-1.713,side*.665,.945),(-1.23,side*.593,1.294)],paint,body,.022,.004)
    spoiler=box('roof_spoiler',(-1.213,0,1.322),(.088,1.269,.028),trim,body,.010)
    spoiler.rotation_euler.y=-.13
    # Slim defroster filaments follow the sloped rear screen.
    for i in range(8):
        v=.14+i*.095
        x=-1.701*(1-v)-1.215*v-.006
        z=.966*(1-v)+1.291*v+.006
        w=.657*(1-v)+.580*v
        tube('heated_rear_window_'+str(i),[(x,-w*.91,z),(x-.010,0,z+.008),(x,w*.91,z)],.00065,mats['heater'],glass)
    # Front wipers and rear wiper are actual small assemblies.
    for label,y in [('L',.35),('R',-.25)]:
        base=Vector((.712,y,.953)); mid=Vector((.579,y+.11,1.009)); end=Vector((.508,y+.22,1.051))
        cylinder('wiper_pivot_'+label,base,.012,.016,trim,body,axis='Z',vertices=20)
        tube('wiper_arm_'+label,[tuple(base),tuple(mid),tuple(end)],.0042,trim,body)
        tube('wiper_blade_'+label,[(.552,y+.02,1.019),(.493,y+.31,1.061)],.007,trim,body)
    tube('rear_wiper_arm',[(-1.737,.02,.943),(-1.668,-.10,1.009),(-1.635,-.24,1.029)],.004,trim,body)
    tube('rear_wiper_blade',[(-1.666,-.025,1.013),(-1.637,-.34,1.028)],.007,trim,body)
    cylinder('rear_wiper_pivot',(-1.739,.02,.945),.014,.017,trim,body,axis='X',vertices=20)
    # Aerial and roof foot. Kept out of nominal body-height metadata.
    box('aerial_foot',(.07,0,1.351),(.066,.045,.018),trim,body,.011)
    tube('aerial',[(.07,0,1.358),(-.10,0,1.48),(-.32,0,1.60)],.0018,trim,body)
    # Simple functional underbody, exhaust and rear silencer.
    box('underbody',(-.03,0,.247),(2.99,1.27,.052),mats['underbody'],body,.025)
    box('engine_sump',(1.13,0,.225),(.42,.59,.105),mats['underbody'],body,.033)
    cylinder('rear_silencer',(-1.48,.45,.24),.078,.33,mats['steel'],body,axis='X',vertices=32,edge=.006)
    tube('exhaust_pipe',[(-.50,.22,.205),(-1.1,.27,.20),(-1.52,.43,.20),(-1.793,.49,.225)],.026,mats['steel'],body,sides=12)
    cylinder('exhaust_tip',(-1.797,.49,.225),.033,.035,mats['metal'],body,axis='X',vertices=32,edge=.001)
    cylinder('exhaust_dark_bore',(-1.816,.49,.225),.026,.001,mats['gap'],body,axis='X',vertices=32,edge=0)


def build_faces(body,mats):
    paint,trim=mats['paint'],mats['trim']
    # Wraparound bumpers formed in plan, not oversized straight bars.
    for front in (True,False):
        sign=1 if front else -1
        xface=1.865 if front else -1.788
        z=.572 if front else .548
        plan=[(xface-.215*sign,-.758),(xface-.080*sign,-.774),(xface-.008*sign,-.725),(xface+.025*sign,-.60),(xface+.025*sign,.60),(xface-.008*sign,.725),(xface-.080*sign,.774),(xface-.215*sign,.758)]
        rings=[]
        for x,y in plan:
            rings.append([(x-.025*sign,y*.985,z-.059),(x,y,z-.045),(x,y,z+.041),(x-.012*sign,y*.99,z+.062)])
        ob=ribbon(('front' if front else 'rear')+'_bumper',rings,trim,body)
        sol=ob.modifiers.new('Bumper return','SOLIDIFY');sol.thickness=.018;apply_modifier(ob,sol)
        tube(('front' if front else 'rear')+'_bumper_red',[(x+.002*sign,y,z+.020) for x,y in plan],.005,mats['stripe'],body)
        tube(('front' if front else 'rear')+'_bumper_upper',[(x-.010*sign,y*.99,z+.060) for x,y in plan],.003,mats['gap'],body)
    # Front steel nose and distinctive red grille with open black slots.
    box('front_nose',(1.817,0,.724),(.050,1.431,.183),paint,body,.013)
    box('grille_recess',(1.851,0,.737),(.018,.853,.158),mats['gap'],body,.007)
    for i in range(4):
        box('grille_red_slat_'+str(i),(1.866,0,.682+i*.035),(.026,.845,.014),paint,body,.004)
    box('grille_emblem_back',(1.884,0,.739),(.012,.061,.117),trim,body,.005)
    # A small original relief silhouette of the period standing lion.
    lion=[(-.011,-.041),(.003,-.030),(.010,-.014),(.001,-.005),(.013,.004),(.019,.025),(.006,.032),(.004,.045),(-.008,.041),(-.014,.029),(-.007,.018),(-.022,.011),(-.025,-.005),(-.014,-.014),(-.017,-.028),(-.025,-.037)]
    panel('grille_lion',[(1.894,y,.737+z) for y,z in lion],mats['badge'],body,.002,0)
    tube('lion_tail',[(1.896,-.009,.719),(1.896,-.029,.732),(1.896,-.025,.757)],.0023,mats['badge'],body)
    for side,label in [(1,'L'),(-1,'R')]:
        # Rectangular ribbed-glass headlights, amber corner indicators.
        yy=side*.566
        box('headlight_gasket_'+label,(1.839,yy,.720),(.020,.278,.175),trim,body,.008)
        box('headlight_reflector_'+label,(1.851,yy,.720),(.009,.257,.157),mats['reflector'],body,.006)
        box('headlight_lens_'+label,(1.858,yy,.720),(.005,.248,.149),mats['headlamp'],body,.004)
        for j in range(15):
            y=yy-.115+j*.0164
            tube('headlight_flute_'+label+str(j),[(1.862,y,.654),(1.863,y,.786)],.00065,mats['lens_rib'],body,sides=4)
        for j in range(3):
            z=.672+j*.041
            tube('headlight_optics_'+label+str(j),[(1.862,yy-.117,z),(1.862,yy+.117,z)],.00055,mats['lens_rib'],body,sides=4)
        box('indicator_gasket_'+label,(1.819,side*.728,.720),(.043,.075,.175),trim,body,.008)
        box('indicator_front_'+label,(1.842,side*.730,.720),(.012,.060,.157),mats['amber'],body,.006)
        # Red lower apron is sculpted around the two rectangular yellow driving lamps.
        box('front_apron_outer_'+label,(1.800,side*.706,.397),(.105,.126,.244),paint,body,.021)
        box('front_apron_inner_'+label,(1.820,side*.344,.408),(.070,.145,.224),paint,body,.012)
        box('driving_lamp_bezel_'+label,(1.827,side*.540,.407),(.034,.216,.130),trim,body,.011)
        box('driving_lamp_reflector_'+label,(1.845,side*.540,.407),(.010,.186,.104),mats['reflector'],body,.009)
        box('driving_lamp_yellow_'+label,(1.853,side*.540,.407),(.005,.177,.094),mats['yellow_lens'],body,.007)
        for j in range(7):
            y=side*.540-.074+j*.0247
            tube('fog_flute_'+label+str(j),[(1.857,y,.366),(1.857,y,.448)],.0007,mats['yellow_rib'],body,sides=4)
    box('front_apron_lower',(1.809,0,.286),(.093,1.416,.047),paint,body,.012)
    box('front_apron_upper',(1.824,0,.493),(.068,1.39,.045),paint,body,.008)
    box('front_valance_shadow',(1.810,0,.362),(.045,.575,.110),mats['gap'],body,.005)
    box('front_plate_mount',(1.859,0,.466),(.032,.497,.115),trim,body,.007)
    box('front_numberplate',(1.878,0,.466),(.009,.458,.092),mats['plate_front'],body,.003)
    text_mesh('front_plate_text','205 GTI',(1.884,0,.466),.063,mats['plate_ink'],body,(1,0,0),(0,1,0),.342)
    box('front_lower_lip',(1.77,0,.255),(.12,1.42,.026),trim,body,.008)

    # Tailgate, ribbed rear applique and old-pattern lamps.
    box('rear_panel',(-1.760,0,.713),(.055,1.426,.237),paint,body,.012)
    box('rear_applique',(-1.798,0,.723),(.018,1.111,.163),trim,body,.004)
    for i in range(8):
        box('tailgate_rib_'+str(i),(-1.812,0,.654+i*.019),(.008,1.098,.0045),mats['trim_edge'],body,.001)
    for side,label in [(1,'L'),(-1,'R')]:
        y=side*.644
        box('tail_lamp_gasket_'+label,(-1.800,y,.726),(.031,.172,.195),mats['gap'],body,.007)
        box('tail_red_'+label,(-1.820,y,.686),(.016,.152,.090),mats['red_lens'],body,.006)
        box('tail_amber_'+label,(-1.820,y+side*.038,.779),(.016,.072,.092),mats['amber'],body,.004)
        box('tail_upper_red_'+label,(-1.820,y-side*.039,.791),(.016,.068,.068),mats['red_lens'],body,.004)
        box('tail_reverse_'+label,(-1.821,y-side*.039,.739),(.017,.067,.034),mats['headlamp'],body,.002)
        for j in range(8):
            box('tail_prism_'+label+str(j),(-1.830,y-.064+j*.018,.690),(.003,.003,.073),mats['red_rib'],body,.0006)
    text_mesh('rear_peugeot','PEUGEOT',(-1.827,.345,.766),.038,mats['badge'],body,(-1,0,0),(0,-1,0),.320)
    text_mesh('rear_205','205',(-1.827,-.307,.766),.044,mats['badge'],body,(-1,0,0),(0,-1,0),.162)
    text_mesh('rear_gti','GTI',(-1.828,-.465,.766),.039,mats['stripe'],body,(-1,0,0),(0,-1,0),.119)
    cylinder('tailgate_lock',(-1.833,0,.725),.018,.012,mats['metal'],body,axis='X',vertices=24)
    cylinder('tailgate_keyhole',(-1.840,0,.725),.005,.002,mats['gap'],body,axis='X',vertices=16,edge=0)
    box('rear_apron',(-1.744,0,.397),(.085,1.399,.187),paint,body,.018)
    box('rear_plate_recess',(-1.796,0,.402),(.027,.516,.123),trim,body,.008)
    box('rear_numberplate',(-1.814,0,.403),(.009,.467,.099),mats['plate_rear'],body,.004)
    text_mesh('rear_plate_text','205 GTI',(-1.820,0,.403),.066,mats['plate_ink'],body,(-1,0,0),(0,-1,0),.344)
    for side in (-1,1):
        box('rear_fog_bezel_'+str(side),(-1.798,side*.400,.408),(.024,.137,.083),trim,body,.008)
        box('rear_fog_'+str(side),(-1.813,side*.400,.408),(.013,.113,.061),mats['red_lens'],body,.007)


def build_mirrors(body,mats):
    for side,label in [(1,'L'),(-1,'R')]:
        panel('mirror_triangle_'+label,[(.642,side*.736,.920),(.506,side*.711,1.009),(.437,side*.740,.922)],mats['trim'],body,.024,.007)
        box('mirror_stalk_'+label,(.492,side*.770,.927),(.070,.105,.043),mats['trim'],body,.016)
        ob=box('mirror_housing_'+label,(.463,side*.865,.957),(.155,.168,.093),mats['trim'],body,.032,5)
        ob.rotation_euler.z=side*.12
        box('mirror_seal_'+label,(.382,side*.872,.957),(.012,.136,.071),mats['rubber'],body,.021,4)
        box('mirror_glass_'+label,(.374,side*.872,.957),(.004,.119,.059),mats['mirror'],body,.017,5)


def lathe_y(name, profile, mat, parent, segments=72):
    verts=[]
    for axial,radius in profile:
        for i in range(segments):
            a=TAU*i/segments
            verts.append((radius*math.sin(a),axial,radius*math.cos(a)))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments):
            n=(i+1)%segments
            faces.append((j*segments+i,j*segments+n,(j+1)*segments+n,(j+1)*segments+i))
    return mesh(name,verts,faces,mat,parent,True)


def make_wheel_template(mats):
    template=empty('_wheel_template')
    rubber,metal=mats['rubber'],mats['wheel_metal']
    # 185/55 R15-like envelope, smooth round shoulders, physically open centre.
    profile=[(-.086,.188),(-.093,.208),(-.094,.244),(-.085,.269),(-.069,.282),(-.046,.2875),(.046,.2875),(.069,.282),(.085,.269),(.094,.244),(.093,.208),(.086,.188),(-.086,.188)]
    tire=lathe_y('tire',profile,rubber,template,72)
    # Four fine circumferential grooves and paired diagonal tread sipes.
    for y in (-.046,-.017,.017,.046):
        pts=[(.2878*math.sin(TAU*i/96),y,.2878*math.cos(TAU*i/96)) for i in range(96)]
        tube('tire_longitudinal_groove',pts,.0011,mats['tread'],template,True,4)
    for i in range(44):
        a=TAU*i/44
        for side in (-1,1):
            pts=[]
            for j in range(4):
                y=side*(.027+j*.014)
                rr=.2876-.004*(j/3)**2
                aa=a+side*(j-1.5)*.014
                pts.append((rr*math.sin(aa),y,rr*math.cos(aa)))
            tube('tire_sipe',pts,.0013,mats['tread'],template,sides=4)
    lathe_y('rim_barrel',[(-.081,.177),(-.081,.191),(.080,.191),(.092,.188),(.098,.181),(.091,.175),(-.081,.177)],metal,template)
    # Speedline face: eight real apertures cut through the dished alloy plate.
    disc=cylinder('speedline_face',(0,.080,0),.178,.021,metal,template,vertices=64,edge=0)
    for i in range(8):
        a=TAU*i/8+PI/8
        x,z=.139*math.sin(a),.139*math.cos(a)
        cutter=cylinder('_hole',(x,.081,z),.0285,.08,metal,None,vertices=16,edge=0)
        cutter.scale.x=1.05
        cutter.scale.z=1.05
        boolean=disc.modifiers.new('Speedline aperture','BOOLEAN')
        boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter
        apply_modifier(disc,boolean)
        bpy.data.objects.remove(cutter,do_unlink=True)
    bevel(disc,.002,2)
    # Cast-alloy crown: the hub is slightly proud of the aperture circle.
    for v in disc.data.vertices:
        radius=math.hypot(v.co.x,v.co.z)
        v.co.y += .011*max(0,1-(radius/.178)**2)
    disc.data.update()
    lathe_y('polished_rim_lip',[(.092,.174),(.098,.179),(.096,.186),(.089,.190),(.085,.188),(.092,.174)],mats['polished'],template,96)
    cylinder('centre_hub',(0,.094,0),.061,.018,metal,template,vertices=48,edge=.003)
    cylinder('centre_cap',(0,.106,0),.025,.006,mats['polished'],template,vertices=40,edge=.001)
    for i in range(4):
        a=TAU*i/4+PI/4
        x,z=.046*math.sin(a),.046*math.cos(a)
        cylinder('lug_well',(x,.105,z),.011,.003,mats['gap'],template,vertices=20,edge=.001)
        cylinder('lug_bolt',(x,.109,z),.0068,.008,mats['steel'],template,vertices=6,edge=.0006)
    # Disc rotor is visibly recessed behind the wheel holes.
    cylinder('brake_disc',(0,.042,0),.121,.012,mats['brake'],template,vertices=64,edge=.001)
    cylinder('brake_disc_hub',(0,.050,0),.044,.018,mats['steel'],template,vertices=32,edge=.001)
    valve=cylinder('valve',(.123,.108,.113),.004,.015,mats['gap'],template,vertices=10,edge=.0006)
    # Subtle raised sidewall inscription, real geometry, never a loaded bitmap.
    text_mesh('tire_size','185/55 R15',(0,.095,-.245),.017,mats['rubber_letters'],template,(0,1,0),(-1,0,0),.145)
    return template


def build_wheels(root,body,mats):
    template=make_wheel_template(mats)
    bpy.context.view_layer.update()
    parts=list(template.children)
    for tag,x,side in [('FL',1.21,1),('FR',1.21,-1),('RL',-1.21,1),('RR',-1.21,-1)]:
        pivot=(x,side*.680,.2875)
        if tag[0]=='F':
            steer=empty('steer_'+tag,root,pivot)
            steer['axis_blender']='Z';steer['axis_gltf']='Y'
            wheel=empty('wheel_'+tag,steer)
        else:
            wheel=empty('wheel_'+tag,root,pivot)
        wheel['axis_blender']='Y';wheel['axis_gltf']='Z';wheel['radius_m']=.2875
        R=Matrix.Rotation(PI,4,'Z') if side<0 else Matrix.Identity(4)
        for ob in parts:
            dup=ob.copy()
            bpy.context.collection.objects.link(dup)
            dup.name=tag+'_'+ob.name
            dup.parent=wheel
            dup.matrix_local=R@ob.matrix_local
        cal=box('caliper_'+tag,(x+.083,side*.708,.318),(.066,.050,.126),mats['steel'],body,.012)
    for ob in parts:
        bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.objects.remove(template,do_unlink=True)


def convert_geometry(root):
    for ob in list(bpy.data.objects):
        if ob.type in {'CURVE','FONT'}:
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active=ob
            bpy.ops.object.convert(target='MESH')
    bpy.context.view_layer.update()


def descendants(root):
    out=[]
    for child in root.children:
        out.append(child)
        out.extend(descendants(child))
    return out


def merge_static_parts(root):
    """One mesh per rigid assembly/material, preserving wheel and steering pivots."""
    parents=[root]+[o for o in descendants(root) if o.type=='EMPTY']
    for parent in parents:
        groups={}
        for ob in list(parent.children):
            if ob.type!='MESH':continue
            key=tuple(m.name for m in ob.data.materials)
            groups.setdefault(key,[]).append(ob)
        for key,objects in groups.items():
            if len(objects)==1:continue
            bpy.ops.object.select_all(action='DESELECT')
            for ob in objects:ob.select_set(True)
            bpy.context.view_layer.objects.active=objects[0]
            bpy.ops.object.join()
            ob=bpy.context.object
            ob.name=parent.name+'__'+key[0]


def clean_meshes(root):
    for ob in descendants(root):
        if ob.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(ob.data)
        # Cap tessellation from curved outline lettering can have numerical slivers.
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
        bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9)
        bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
        def area64(face):
            a,b,c=[tuple(v.co) for v in face.verts]
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
            return .5*math.sqrt(sum(c*c for c in cross))
        bad=[f for f in bm.faces if area64(f) <= 1e-10]
        if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
        bm.normal_update()
        bm.to_mesh(ob.data);bm.free();ob.data.update()
    bpy.context.view_layer.update()


def refine_envelope(body,glass):
    """Join roof/body shoulders and calibrate only the overhangs, preserving pivots."""
    parts=[o for p in (body,glass) for o in descendants(p) if o.type=='MESH']
    for ob in parts:
        M=ob.matrix_world.copy();I=M.inverted()
        for v in ob.data.vertices:
            p=M@v.co
            if p.x<-.62 and p.z>.905:
                p.x+=.12*min(1,(-p.x-.62)/.55)*min(1,(p.z-.905)/.39)
            if p.x<-1.55 and p.z>.875:
                cap=width_at(p.x,belt_z(p.x))-.002
                if abs(p.y)>cap:p.y=math.copysign(cap,p.y)
            v.co=I@p
        ob.data.update()
    bpy.context.view_layer.update()
    points=[ob.matrix_world@v.co for ob in parts for v in ob.data.vertices]
    xmin=min(p.x for p in points);xmax=max(p.x for p in points)
    for ob in parts:
        M=ob.matrix_world.copy();I=M.inverted()
        for v in ob.data.vertices:
            p=M@v.co
            if p.x>1.21:p.x=1.21+(p.x-1.21)*.680/(xmax-1.21)
            if p.x<-1.21:p.x=-1.21+(p.x+1.21)*.605/(-xmin-1.21)
            v.co=I@p
        ob.data.update()
    bpy.context.view_layer.update()


def pbr_values(mat):
    s=mat.node_tree.nodes.get('Principled BSDF')
    return {'name':mat.name,'baseColor':list(s.inputs['Base Color'].default_value),'roughness':s.inputs['Roughness'].default_value,'metallic':s.inputs['Metallic'].default_value,'coat':s.inputs['Coat Weight'].default_value}


def export_ferro(root,path):
    """Unintegrated FERRO triangle interchange; no engine or game dependency."""
    rot=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
    R=rot.to_4x4()
    data={'format':'bitume-procedural-mesh-1','name':'Peugeot 205 GTI 1.9 (1989)','units':'metre','axes':{'forward':'+X','up':'+Y','right':'+Z'},'origin':'ground at wheelbase midpoint','group_transform':'column-major matrix relative to parent; shapes in group-local space','materials':{},'groups':[],'shapes':[]}
    objects=[root]+descendants(root)
    for ob in objects:
        if ob.type=='EMPTY':
            pos=rot@ob.matrix_world.translation
            local=ob.parent.matrix_world.inverted()@ob.matrix_world if ob.parent else ob.matrix_world
            local=R@local@R.inverted()
            data['groups'].append({'name':ob.name,'parent':ob.parent.name if ob.parent else None,'matrix':[round(local[row][col],9) for col in range(4) for row in range(4)],'pivot_world':[round(v,7) for v in pos],'rotation_axis_local':ob.get('axis_gltf')})
    deps=bpy.context.evaluated_depsgraph_get()
    for ob in objects:
        if ob.type!='MESH':continue
        evaluated=ob.evaluated_get(deps)
        me=evaluated.to_mesh();me.calc_loop_triangles()
        group=ob.parent
        M=group.matrix_world.inverted()@ob.matrix_world if group else ob.matrix_world
        N=M.to_3x3().inverted().transposed()
        verts=[rot@(M@v.co) for v in me.vertices]
        lo=[min(float(v[k]) for v in verts) for k in range(3)]
        hi=[max(float(v[k]) for v in verts) for k in range(3)]
        center=[(lo[k]+hi[k])*.5 for k in range(3)]
        size=[max(1e-4,hi[k]-lo[k]) for k in range(3)]
        bymat={}
        for tri in me.loop_triangles:
            p=[verts[i] for i in tri.vertices]
            if (p[1]-p[0]).cross(p[2]-p[0]).length <= 2e-12:continue
            ns=[(rot@(N@me.corner_normals[i].vector)).normalized() for i in tri.loops]
            pp=[[round((v[k]-center[k])/size[k],7) for k in range(3)] for v in p]
            nn=[]
            for n in ns:
                n=Vector([n[k]*size[k] for k in range(3)]).normalized()
                nn.append([round(v,7) for v in n])
            bymat.setdefault(tri.material_index,[]).append(pp+nn)
        for index,triangles in bymat.items():
            mat=ob.data.materials[index]
            data['materials'][mat.name]=pbr_values(mat)
            data['shapes'].append({'name':ob.name+'_'+str(index),'group':group.name,'material':mat.name,'centre':[round(v,9) for v in center],'taille':[round(v,9) for v in size],'triangles':triangles})
        evaluated.to_mesh_clear()
    encoded=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode()
    with gzip.GzipFile(filename=str(path),mode='wb',mtime=0) as f:f.write(encoded)
    return {'shapes':len(data['shapes']),'triangles':sum(len(s['triangles']) for s in data['shapes']),'uncompressed_bytes':len(encoded)}


def export_asset(root,out):
    out.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for ob in descendants(root):ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(out/'peugeot-205-gti.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False)
    stats=export_ferro(root,out/'peugeot-205-gti.ferro.json.gz')
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'peugeot-205-gti.blend'),compress=True)
    spec={'name':'Peugeot 205 GTI 1.9','visual_reference':'1989 / phase 1.5, left-hand drive, red','scale':'1 unit = 1 metre','blender_axes':{'forward':'+X','left':'+Y','up':'+Z'},'gltf_ferro_axes':{'forward':'+X','up':'+Y','right':'+Z'},'origin':'ground, midway between axles','nominal_dimensions_m':{'length':3.705,'width_including_arch_extensions_excluding_mirrors':1.589,'roof_height':1.355,'wheelbase':2.42,'tire_radius':.2875},'wheel_centres_gltf':{'wheel_FL':[1.21,.2875,-.680],'wheel_FR':[1.21,.2875,.680],'wheel_RL':[-1.21,.2875,-.680],'wheel_RR':[-1.21,.2875,.680]},'wheel_spin_axis_gltf':'Z','front_steering_axis_gltf':'Y','steering_wheel':'separate steering_wheel node; rotate about its own local axis as documented in README','runtime_integration':False,'external_textures':False,'ferro':stats}
    (out/'modele.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
    return spec


def setup_render(samples,resolution):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=samples
    scene.cycles.use_denoising=False
    scene.cycles.max_bounces=8
    scene.cycles.transparent_max_bounces=12
    scene.render.resolution_x=resolution
    scene.render.resolution_y=round(resolution*.65)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.31,.37,.48,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    floor=material('studio_floor',(.052,.066,.086),.48)
    box('studio_floor',(0,0,-.042),(200,200,.08),floor,None,0)
    def area(name,loc,power,size,color,target):
        ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=color
        ob=bpy.data.objects.new(name,ld);bpy.context.collection.objects.link(ob);ob.location=loc
        ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    area('studio_key',(3.5,3.4,5.0),650,4.0,(1,.89,.78),(0,0,.7))
    area('studio_fill',(1,-4,3.1),520,3.0,(.75,.85,1),(0,0,.7))
    area('studio_rim',(-3,1.5,4.5),850,3.0,(.85,.92,1),(0,0,.8))
    area('studio_front',(4.6,-.5,1.7),130,2.2,(1,1,1),(0,0,.7))
    cam=bpy.data.cameras.new('inspection_camera');obj=bpy.data.objects.new('inspection_camera',cam)
    bpy.context.collection.objects.link(obj);scene.camera=obj;cam.lens=58
    return obj


def render_views(out,samples,resolution):
    # Inspect the exported GLB, not a separate decorative reconstruction.
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(out/'peugeot-205-gti.glb'))
    cam=setup_render(samples,resolution)
    views=[('avant',(5.4,4.6,2.55),(0,0,.70),58),('arriere',(-5.3,-4.7,2.35),(-.10,0,.70),58),('profil',(0,6.9,.78),(.05,0,.78),60)]
    dest=out/'apercus';dest.mkdir(exist_ok=True)
    for name,loc,target,lens in views:
        bpy.data.objects['studio_floor'].hide_render=(name=='profil')
        cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.lens=lens;cam.data.type='ORTHO' if name=='profil' else 'PERSP';cam.data.ortho_scale=4.7
        bpy.context.scene.render.filepath=str(dest/(name+'.png'))
        bpy.ops.render.render(write_still=True)


def main():
    args=parse_args()
    args.output=args.output.expanduser().resolve()
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for datablock in list(bpy.data.materials):bpy.data.materials.remove(datablock)
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene.unit_settings.scale_length=1
    mats={
        'paint':material('Rouge_Vallelunga',(.56,.008,.017),.235,.06,.5),
        'stripe':material('GTI_red_inlay',(.72,.014,.023),.29,.02,.15),
        'trim':material('Anthracite_mouldings',(.032,.038,.043),.49),
        'trim_edge':material('Moulding_ridges',(.050,.057,.064),.43),
        'rubber':material('Tire_and_seal_rubber',(.013,.016,.020),.75),
        'rubber_letters':material('Raised_tire_lettering',(.031,.034,.038),.77),
        'tread':material('Tread_grooves',(.005,.006,.008),.88),
        'gap':material('Recesses',(.004,.006,.008),.65),
        'metal':material('Bright_metal',(.55,.58,.61),.25,.85),
        'wheel_metal':material('Speedline_satin_alloy',(.54,.57,.61),.28,.72),
        'polished':material('Rim_edge_metal',(.70,.73,.76),.19,.85),
        'steel':material('Steel',(.16,.18,.20),.40,.75),
        'brake':material('Brake_rotor',(.27,.28,.29),.43,.82),
        'underbody':material('Underseal',(.018,.023,.025),.81),
        'glass':material('Slight_green_glazing',(.045,.075,.067),.10,.02,0,.25),
        'mirror':material('Mirror_silver',(.57,.66,.70),.08,1),
        'reflector':material('Lamp_reflector',(.70,.73,.75),.17,.84),
        'headlamp':material('Headlamp_glass',(.72,.77,.73),.18,.23,0,.86),
        'lens_rib':material('Headlamp_fluting',(.37,.43,.45),.27,.3),
        'amber':material('Amber_indicator',(.88,.18,.004),.21,.16,.35),
        'yellow_lens':material('Yellow_driving_lights',(.78,.58,.035),.17,.28,.45),
        'yellow_rib':material('Yellow_lens_fluting',(.39,.30,.035),.27,.18),
        'red_lens':material('Red_tail_lens',(.40,.006,.013),.21,.18,.45),
        'red_rib':material('Red_lens_prisms',(.61,.008,.017),.28,.12),
        'badge':material('Badge_silver',(.72,.75,.78),.26,.60),
        'heater':material('Heated_window_filament',(.12,.052,.018),.55,.20),
        'plate_front':material('Front_plate',(.80,.82,.77),.42),
        'plate_rear':material('Rear_plate',(.86,.63,.08),.42),
        'plate_ink':material('Plate_characters',(.008,.012,.015),.5),
    }
    root=empty('peugeot_205_gti')
    root['description']='Original procedural Peugeot 205 GTI 1.9, visual reference 1989. Unintegrated asset.'
    root['metres_per_unit']=1.0
    body=empty('body',root);glass=empty('glazing',root);cabin=empty('interior',root)
    print('BUILD body',flush=True)
    build_body(body,glass,mats)
    print('BUILD faces and mirrors',flush=True)
    build_faces(body,mats)
    build_mirrors(body,mats)
    print('BUILD wheels',flush=True)
    build_wheels(root,body,mats)
    print('BUILD interior',flush=True)
    from interieur import build_interior
    build_interior(cabin,mats)
    print('BUILD mesh conversion',flush=True)
    convert_geometry(root)
    refine_envelope(body,glass)
    merge_static_parts(root)
    clean_meshes(root)
    print('BUILD export',flush=True)
    spec=export_asset(root,args.output)
    print('ASSET_RESULT '+json.dumps(spec['ferro']))
    if args.render:render_views(args.output,args.samples,args.resolution)


if __name__=='__main__':main()
