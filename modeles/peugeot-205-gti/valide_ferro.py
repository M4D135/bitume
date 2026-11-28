#!/usr/bin/env python3
"""Contrôle autonome de la géométrie FERRO et comparaison avec le GLB.

Python standard uniquement. Compare les transformations de groupes, pivots,
triangles, normales et boîtes englobantes globales et pièce par pièce.

Usage : python valide_ferro.py --output validation-ferro.json modele.ferro.json.gz modele.glb
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import sys


IDENTITY = [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]


def finite(values):
    return all(isinstance(x, (int, float)) and math.isfinite(x) for x in values)


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def position(m, p):
    return [sum(m[i][j] * p[j] for j in range(3)) + m[i][3] for i in range(3)]


def column_matrix(v):
    if len(v) != 16 or not finite(v):
        raise ValueError('Invalid matrix')
    return [[v[4*j+i] for j in range(4)] for i in range(4)]


def gltf_matrix(node):
    if 'matrix' in node:
        return column_matrix(node['matrix'])
    x,y,z,w = node.get('rotation', [0,0,0,1])
    sx,sy,sz = node.get('scale', [1,1,1])
    tx,ty,tz = node.get('translation', [0,0,0])
    return [[(1-2*(y*y+z*z))*sx, 2*(x*y-z*w)*sy, 2*(x*z+y*w)*sz,tx],
            [2*(x*y+z*w)*sx,(1-2*(x*x+z*z))*sy,2*(y*z-x*w)*sz,ty],
            [2*(x*z-y*w)*sx,2*(y*z+x*w)*sy,(1-2*(x*x+y*y))*sz,tz],
            [0,0,0,1]]


class AABB:
    def __init__(self):
        self.lo = [math.inf] * 3
        self.hi = [-math.inf] * 3
    def add(self, p):
        if not finite(p):
            raise ValueError('Non-finite position')
        for k in range(3):
            self.lo[k] = min(self.lo[k],p[k])
            self.hi[k] = max(self.hi[k],p[k])
    def result(self):
        return {'min':self.lo,'max':self.hi,'dimensions':[b-a for a,b in zip(self.lo,self.hi)]}


def glb_measure(path):
    raw=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',raw,0)
    assert magic==b'glTF' and version==2 and length==len(raw)
    offset=12; data=None; binary=None
    while offset<len(raw):
        size,kind=struct.unpack_from('<I4s',raw,offset);offset+=8
        chunk=raw[offset:offset+size];offset+=size
        if kind==b'JSON':data=json.loads(chunk)
        if kind==b'BIN\x00':binary=chunk
    assert data is not None and binary is not None
    def accessor(index):
        a=data['accessors'][index];v=data['bufferViews'][a['bufferView']]
        assert v['buffer']==0 and 'sparse' not in a
        fmt,size={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        start=v.get('byteOffset',0)+a.get('byteOffset',0)
        stride=v.get('byteStride',size*width)
        return [struct.unpack_from('<'+fmt*width,binary,start+i*stride) for i in range(a['count'])]
    count=0;box=AABB();world={};shapes={}
    def visit(index,parent):
        nonlocal count
        n=data['nodes'][index];m=mul(parent,gltf_matrix(n));name=n.get('name',str(index))
        world[name]=m
        if 'mesh' in n:
            nodebox=AABB();nodecount=0
            for primitive in data['meshes'][n['mesh']]['primitives']:
                assert primitive.get('mode',4)==4
                points=accessor(primitive['attributes']['POSITION'])
                indices=[p[0] for p in accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(points)))
                assert len(indices)%3==0
                count+=len(indices)//3;nodecount+=len(indices)//3
                for i in set(indices):
                    p=position(m,points[i]);box.add(p);nodebox.add(p)
            shapes[name]={'triangles':nodecount,'aabb':nodebox.result()}
        for child in n.get('children',[]):visit(child,m)
    for root in data['scenes'][data.get('scene',0)]['nodes']:visit(root,IDENTITY)
    return {'triangles':count,'aabb':box.result(),'world':world,'shapes':shapes}


def check(ferro_path,glb_path):
    with gzip.open(ferro_path,'rt') as f:data=json.load(f)
    errors=[];warnings=[];world={};pending=set();counts={};box=AABB()
    groups={g['name']:g for g in data['groups']}
    if len(groups)!=len(data['groups']):errors.append('Duplicate group names')
    def resolve(name):
        if name in world:return world[name]
        if name in pending:raise ValueError('Parent cycle: '+name)
        pending.add(name);g=groups[name];m=column_matrix(g['matrix'])
        parent=g.get('parent')
        if parent is not None:m=mul(resolve(parent),m)
        world[name]=m;pending.remove(name);return m
    pivot_errors={}
    for name,g in groups.items():
        m=resolve(name);p=position(m,[0,0,0]);target=g['pivot_world']
        delta=math.dist(p,target);pivot_errors[name]=delta
        if delta>1e-6:errors.append('Matrix/pivot_world mismatch: '+name)
    expected={'wheel_FL':[1.21,.2875,-.68],'wheel_FR':[1.21,.2875,.68],
              'wheel_RL':[-1.21,.2875,-.68],'wheel_RR':[-1.21,.2875,.68]}
    for name,p in expected.items():
        if name not in world:errors.append('Missing pivot: '+name)
        elif math.dist(position(world[name],[0,0,0]),p)>.002:errors.append('Incorrect pivot: '+name)
    if 'steering_wheel' not in groups:errors.append('Missing steering pivot')
    elif groups['steering_wheel'].get('rotation_axis_local')!='Y':errors.append('Steering local axis is not glTF Y')
    max_normal_error=0;max_normalized_coord=0;min_area=math.inf;degenerates=0;count=0
    min_size=math.inf;shape_metrics={}
    for shape in data['shapes']:
        name=shape['name'];group=shape['group'];m=world[group]
        centre=shape['centre'];size=shape['taille'];localbox=AABB()
        assert len(centre)==len(size)==3 and finite(centre+size) and min(size)>0
        min_size=min(min_size,min(size));counts[group]=counts.get(group,0)+len(shape['triangles'])
        if shape['material'] not in data['materials']:errors.append('Missing material: '+name)
        for tri in shape['triangles']:
            assert len(tri)==6
            decoded=[]
            for p in tri[:3]:
                assert len(p)==3 and finite(p)
                max_normalized_coord=max(max_normalized_coord,max(abs(x) for x in p))
                q=position(m,[p[k]*size[k]+centre[k] for k in range(3)])
                box.add(q);localbox.add(q);decoded.append(q)
            for n in tri[3:]:
                assert len(n)==3 and finite(n)
                length=math.sqrt(sum(x*x for x in n))
                if length<1e-8:errors.append('Zero normal: '+name)
                max_normal_error=max(max_normal_error,abs(length-1))
                real_normal=[n[k]/size[k] for k in range(3)]
                assert finite(real_normal) and sum(x*x for x in real_normal)>0
            a,b,c=decoded;u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            area=math.sqrt(sum(x*x for x in cross))*.5
            min_area=min(min_area,area);degenerates+=area<=1e-12;count+=1
        shape_metrics[name]={'triangles':len(shape['triangles']),'aabb':localbox.result()}
    if max_normalized_coord>.500001:errors.append('Position outside normalized cube')
    if max_normal_error>1e-5:errors.append('Normals not unit length')
    if degenerates:errors.append('Degenerate triangles after FERRO quantization: '+str(degenerates))
    glb=glb_measure(glb_path)
    bound_error=max(abs(a-b) for bound in ('min','max') for a,b in zip(box.result()[bound],glb['aabb'][bound]))
    if bound_error>1e-5:errors.append('FERRO/GLB AABB mismatch')
    if count!=glb['triangles']:errors.append('FERRO/GLB triangle count mismatch')
    group_deltas={}
    for name,m in world.items():
        if name not in glb['world']:errors.append('Group absent from GLB: '+name);continue
        gm=glb['world'][name]
        difference=max(abs(m[i][j]-gm[i][j]) for i in range(4) for j in range(4))
        group_deltas[name]=difference
        if difference>2e-6:errors.append('Group transform differs from GLB: '+name)
    # Compare every exported shape separately, so a swapped left/right pair is
    # not hidden by the symmetric whole-car bounds.
    shape_deltas={}
    for name,metric in shape_metrics.items():
        glb_name=name.rsplit('_',1)[0]
        if glb_name not in glb['shapes']:
            errors.append('FERRO shape absent from GLB: '+name);continue
        other=glb['shapes'][glb_name]
        difference=max(abs(a-b) for bound in ('min','max') for a,b in zip(metric['aabb'][bound],other['aabb'][bound]))
        shape_deltas[name]=difference
        if difference>1e-5:errors.append('Shape AABB differs from GLB: '+name)
        if metric['triangles']!=other['triangles']:errors.append('Shape triangles differ from GLB: '+name)
    return {'valid':not errors,'errors':errors,'warnings':warnings,
            'ferro_triangles':count,'glb_triangles':glb['triangles'],'groups':len(groups),'shapes':len(data['shapes']),
            'ferro_aabb_world_m':box.result(),'glb_aabb_world_m':glb['aabb'],
            'max_aabb_difference_m':bound_error,'max_shape_aabb_difference_m':max(shape_deltas.values(),default=0),
            'max_group_matrix_difference':max(group_deltas.values(),default=0),
            'max_matrix_pivot_difference_m':max(pivot_errors.values(),default=0),
            'max_normal_length_error':max_normal_error,'max_normalized_coordinate':max_normalized_coord,
            'minimum_triangle_area_m2':min_area,'degenerate_triangles':degenerates,
            'triangles_by_group':counts,'shape_aabb_differences_m':shape_deltas,
            'pivots_world_m':{name:position(world[name],[0,0,0]) for name in (*expected,'steering_wheel') if name in world}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ferro',type=Path,help='Export FERRO .json.gz')
    parser.add_argument('glb',type=Path,help='Export GLB de la même géométrie')
    parser.add_argument('--output',type=Path,help='Rapport JSON ; stdout par défaut')
    args=parser.parse_args()
    try:
        report=check(args.ferro,args.glb)
        report['files']={
            'ferro':{'name':args.ferro.name,'bytes':args.ferro.stat().st_size,
                     'sha256':hashlib.sha256(args.ferro.read_bytes()).hexdigest()},
            'glb':{'name':args.glb.name,'bytes':args.glb.stat().st_size,
                   'sha256':hashlib.sha256(args.glb.read_bytes()).hexdigest()},
        }
    except (OSError, ValueError, KeyError, IndexError, TypeError, AssertionError,
            struct.error, EOFError) as exc:
        report={'valid':False,'errors':[str(exc) or 'Structure géométrique incohérente'],
                'warnings':[]}
    payload=json.dumps(report,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(payload,encoding='utf-8')
        summary={k:v for k,v in report.items() if k not in
                 ('shape_aabb_differences_m','triangles_by_group','pivots_world_m','files')}
        summary['report']=str(args.output)
        print(json.dumps(summary,indent=2,ensure_ascii=False))
    else:
        print(payload,end='')
    return 0 if report['valid'] else 1


if __name__=='__main__':sys.exit(main())
