#!/usr/bin/env python3
"""Conservative capsule clearances against exact rendered BITUME triangles."""
from pathlib import Path
import argparse,json,numpy as np

def euler(r):
 x,y,z=r;cx,cy,cz=np.cos(r);sx,sy,sz=np.sin(r)
 return np.array([[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]])

def point_segment(p,a,b):
 d=b-a;t=np.clip(((p-a)*d).sum(axis=1)/np.maximum((d*d).sum(axis=1),1e-30),0,1)
 return ((p-a-t[:,None]*d)**2).sum(axis=1)

def point_triangle(p,t):
 a,b,c=t[:,0],t[:,1],t[:,2];ab=b-a;ac=c-a;n=np.cross(ab,ac);n2=(n*n).sum(axis=1)
 off=((p-a)*n).sum(axis=1);proj=p-off[:,None]*n/np.maximum(n2[:,None],1e-30)
 v=proj-a;d00=(ab*ab).sum(axis=1);d01=(ab*ac).sum(axis=1);d11=(ac*ac).sum(axis=1)
 d20=(v*ab).sum(axis=1);d21=(v*ac).sum(axis=1);den=d00*d11-d01*d01
 u=(d11*d20-d01*d21)/np.maximum(den,1e-30);w=(d00*d21-d01*d20)/np.maximum(den,1e-30)
 inside=(u>=0)&(w>=0)&(u+w<=1)&(n2>1e-24)
 return np.minimum(np.where(inside,off*off/np.maximum(n2,1e-30),np.inf),np.minimum(point_segment(p,a,b),np.minimum(point_segment(p,b,c),point_segment(p,c,a))))

def segment_triangle(a,b,t):
 out=np.minimum(point_triangle(a,t),point_triangle(b,t));v=b-a;vv=np.dot(v,v)
 for i in range(3):
  c=t[:,i];d=t[:,(i+1)%3];w=d-c;q=a-c;ww=(w*w).sum(axis=1);vw=(w*v).sum(axis=1)
  vq=(q*v).sum(axis=1);wq=(q*w).sum(axis=1);den=vv*ww-vw*vw
  s=(vw*wq-ww*vq)/np.maximum(den,1e-30);u=(vv*wq-vw*vq)/np.maximum(den,1e-30)
  inner=(s>=0)&(s<=1)&(u>=0)&(u<=1)&(den>1e-24)
  ds=((q+s[:,None]*v-u[:,None]*w)**2).sum(axis=1)
  out=np.minimum(out,np.where(inner,ds,np.inf))
  out=np.minimum(out,np.minimum(point_segment(c,np.broadcast_to(a,c.shape),np.broadcast_to(b,c.shape)),point_segment(d,np.broadcast_to(a,d.shape),np.broadcast_to(b,d.shape))))
 # Segment/triangle plane intersection, with inside barycentric coordinates.
 ab=t[:,1]-t[:,0];ac=t[:,2]-t[:,0];pvec=np.cross(np.broadcast_to(v,ab.shape),ac);det=(ab*pvec).sum(axis=1)
 ok=np.abs(det)>1e-15;inv=np.where(ok,1/np.where(ok,det,1),0);tv=a-t[:,0]
 u=(tv*pvec).sum(axis=1)*inv;qvec=np.cross(tv,ab);w=(qvec*v).sum(axis=1)*inv;s=(qvec*ac).sum(axis=1)*inv
 return np.where(ok&(u>=0)&(w>=0)&(u+w<=1)&(s>=0)&(s<=1),0,out)

def triangles(obj,shapes):
 values=obj['values'];t=np.array(shapes[obj['shape']]).reshape((-1,3,6))[:,:,:3]
 return (t*np.array(values[4:7]))@euler(values[8:11]).T+values[:3]

def check(data):
 first=next(c for c in data['cases'] if c['detail']=='complet');shapes=data['shapes']
 names={'bitume-goutte','bitume-goutte-dedans','bitume-jonc','bitume-cuve','bitume-pontons','bitume-quille','bitume-fleche','bitume-moteur','bitume-bulle'}
 colliders={o['shape']:triangles(o,shapes) for o in first['objects'] if o['shape'] in names}
 results=[]
 for case in data['cases']:
  if case['detail']!='complet':continue
  A=np.array(case['joints']).reshape((2,3,3));dynamic={o['shape']:triangles(o,shapes) for o in case['objects'] if o['shape'] in ['bitume-jante','bitume-branches']}
  row={'case':case['name'],'clearances':[]}
  for h in range(2):
   for bone,radius in [(0,.0375),(1,.0325)]:
    a,b=A[h,bone],A[h,bone+1]
    for name,t in (colliders|dynamic).items():
     select=np.all(t.max(axis=1)>=np.minimum(a,b)-radius-.02,axis=1)&np.all(t.min(axis=1)<=np.maximum(a,b)+radius+.02,axis=1)
     if not np.any(select):continue
     distance=float(np.sqrt(segment_triangle(a,b,t[select]).min()))-radius
     row['clearances'].append({'arm':h,'bone':bone,'shape':name,'metres':distance})
  results.append(row)
 return results

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);parser.add_argument('--output',type=Path)
 args=parser.parse_args();result=check(json.loads(args.input.read_text()))
 if args.output:args.output.write_text(json.dumps(result,indent=2)+'\n')
 values=[dict(case=row['case'],**v) for row in result for v in row['clearances']]
 collisions=[v for v in values if v['metres']<0]
 print(json.dumps({'cases':len(result),'close_pairs':len(values),'collisions':len(collisions),'minimum':min(values,key=lambda v:v['metres']) if values else None}))
 assert not collisions, f'{len(collisions)} capsule/triangle penetrations: '+str(collisions[:8])
