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


def build_body(body, glass, mats):
    from carrosserie import build_shell
    from pavillon import build_cabin, build_underbody
    api = sys.modules[__name__]
    build_shell(api, body, mats)
    build_cabin(api, body, glass, mats)
    build_underbody(api, body, mats)


def build_faces(body, mats):
    from facades import build_faces as build_curved_faces
    build_curved_faces(sys.modules[__name__], body, mats)


def build_mirrors(body, mats):
    from retroviseurs import build_mirrors as build_curved_mirrors
    build_curved_mirrors(globals(), body, mats)


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
    objects=[ob for ob in descendants(root) if ob.type in {'CURVE','FONT'}]
    if objects:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
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
            ns=[]
            for i in tri.loops:
                n=rot@(N@me.corner_normals[i].vector)
                # A welded, very thin outline can have cancelling smooth
                # corner normals. Use its real triangle normal, as a renderer
                # does, instead of serialising an undefined zero direction.
                if n.length_squared < 1e-20:
                    n=(p[1]-p[0]).cross(p[2]-p[0])
                ns.append(n.normalized())
            # Nine decimal places preserve the thin stamped-panel returns
            # when a whole body-sized mesh is normalised into one unit cube.
            pp=[[round((v[k]-center[k])/size[k],9) for k in range(3)] for v in p]
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
    root['description']='Original procedural Peugeot 205 GTI 1.9, 1989. Curved body revision. Unintegrated asset.'
    root['metres_per_unit']=1.0
    body=empty('body',root);glass=empty('glazing',root);cabin=empty('interior',root)
    # Create modifier-heavy assemblies before the larger body surfaces so
    # Blender does not repeatedly update those surfaces for small controls.
    print('BUILD interior',flush=True)
    from interieur import build_interior
    build_interior(cabin,mats)
    print('BUILD wheels',flush=True)
    build_wheels(root,body,mats)
    print('BUILD body',flush=True)
    build_body(body,glass,mats)
    print('BUILD faces and mirrors',flush=True)
    build_faces(body,mats)
    build_mirrors(body,mats)
    print('BUILD mesh conversion',flush=True)
    convert_geometry(root)
    merge_static_parts(root)
    clean_meshes(root)
    print('BUILD export',flush=True)
    spec=export_asset(root,args.output)
    print('ASSET_RESULT '+json.dumps(spec['ferro']))
    if args.render:render_views(args.output,args.samples,args.resolution)


if __name__=='__main__':main()
