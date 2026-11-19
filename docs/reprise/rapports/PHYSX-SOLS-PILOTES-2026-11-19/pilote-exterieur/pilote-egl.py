#!/usr/bin/env python3
"""Inspect actual BITUME poses with exact FERRO procedural meshes/GLSL, software EGL.

The input comes from pilote-poses.mjs. No browser scene, postprocessing, hardware
performance, image asset or new renderer behaviour is claimed by this probe.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True)
parser.add_argument('--egl-base',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('egl_base',args.egl_base);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
data=json.loads(args.input.read_text());width,height=720,480
ctx=base.Context(width,height);g=ctx.gl
for name,result,types in [
 ('glUniform3f',None,[C.c_int,C.c_float,C.c_float,C.c_float]),
 ('glUniform4f',None,[C.c_int,C.c_float,C.c_float,C.c_float,C.c_float]),
 ('glViewport',None,[C.c_int,C.c_int,C.c_int,C.c_int]),
 ('glClearColor',None,[C.c_float,C.c_float,C.c_float,C.c_float]),
 ('glClear',None,[C.c_uint]),('glDepthMask',None,[C.c_ubyte]),
 ('glBlendFunc',None,[C.c_uint,C.c_uint]),
 ('glGenFramebuffers',None,[C.c_int,C.POINTER(C.c_uint)]),
 ('glBindFramebuffer',None,[C.c_uint,C.c_uint]),
 ('glGenRenderbuffers',None,[C.c_int,C.POINTER(C.c_uint)]),
 ('glBindRenderbuffer',None,[C.c_uint,C.c_uint]),
 ('glRenderbufferStorage',None,[C.c_uint,C.c_uint,C.c_int,C.c_int]),
 ('glFramebufferRenderbuffer',None,[C.c_uint,C.c_uint,C.c_uint,C.c_uint]),
 ('glCheckFramebufferStatus',C.c_uint,[C.c_uint]),
 ('glReadPixels',None,[C.c_int,C.c_int,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_void_p])]:ctx.fn(name,result,*types)
fbo=C.c_uint();buffers=(C.c_uint*2)();g.glGenFramebuffers(1,C.byref(fbo));g.glBindFramebuffer(0x8D40,fbo.value)
g.glGenRenderbuffers(2,buffers)
for i,(format,attachment) in enumerate([(0x8058,0x8CE0),(0x81A6,0x8D00)]):
 g.glBindRenderbuffer(0x8D41,buffers[i]);g.glRenderbufferStorage(0x8D41,format,width,height)
 g.glFramebufferRenderbuffer(0x8D40,attachment,0x8D41,buffers[i])
assert g.glCheckFramebufferStatus(0x8D40)==0x8CD5
shaders=data['shaders'];programs=[ctx.program(shaders['VERT'],shaders['FRAG'],()),ctx.program(shaders['FX_VERT'],shaders['FX_FRAG'],())]
eye=np.array(data['eye'],float);target=np.array(data['target'],float)
forward=(target-eye);forward/=np.linalg.norm(forward);right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward)
view=np.eye(4);view[:3,:3]=[right,up,-forward];view[:3,3]=-view[:3,:3]@eye
f=1/math.tan(math.radians(data['fov']/2));near,far=.03,50
proj=np.array([[f*height/width,0,0,0],[0,f,0,0],[0,0,(far+near)/(near-far),2*far*near/(near-far)],[0,0,-1,0]])
matrix=(proj@view).astype(np.float32).T.copy()
for p in programs:
 g.glUseProgram(p);loc=lambda name:g.glGetUniformLocation(p,name.encode())
 g.glUniformMatrix4fv(loc('uViewProjection'),1,0,matrix.ctypes.data_as(C.POINTER(C.c_float)))
 for name,value in [('uEye',eye),('uForward',forward),('uSunDirection',(.34,.85,.40)),('uSunColor',(1.05,1.02,.94)),('uAmbient',(.42,.46,.52)),('uSkyTop',(.25,.42,.66)),('uSkyBottom',(.75,.82,.90)),('uFogColor',(.1,.12,.15)),('uTorchPosition',(0,-1e6,0))]:g.glUniform3f(loc(name),*value)
 g.glUniform2f(loc('uEnvironment'),1,0);g.glUniform2f(loc('uResolution'),width,height)
 g.glUniform4f(loc('uWeather'),0,0,0,0);g.glUniform4f(loc('uShadowSettings'),0,0,0,0)
 g.glUniform1f(loc('uPbrReady'),0);g.glUniform1f(loc('uPhoto'),1)
 for unit,name in enumerate(['uPbrAlbedo','uPbrNormal','uPbrRough','uShadowMap','uVoile']):g.glUniform1i(loc(name),unit)
arrays={key:np.array(value,dtype=np.float32) for key,value in data['shapes'].items()}
g.glBindBuffer(0x8892,ctx.buffers[0]);g.glVertexAttribPointer(0,3,0x1406,0,24,None);g.glEnableVertexAttribArray(0)
g.glVertexAttribPointer(1,3,0x1406,0,24,C.c_void_p(12));g.glEnableVertexAttribArray(1)
g.glViewport(0,0,width,height);g.glEnable(0x0B71);g.glEnable(0x0B44)
images={};counts={}
for case in data['cases']:
 if case.get('capture') is False:continue
 g.glClearColor(.10,.12,.15,1);g.glDepthMask(1);g.glClear(0x4000|0x0100)
 for fx in [False,True]:
  g.glUseProgram(programs[int(fx)]);g.glDepthMask(0 if fx else 1)
  if fx:g.glEnable(0x0BE2);g.glBlendFunc(0x0302,0x0303)
  else:g.glDisable(0x0BE2)
  objects=[o for o in case['objects'] if o['fx']==fx]
  if fx:objects.sort(key=lambda o:sum((o['values'][k]-eye[k])**2 for k in range(3)),reverse=True)
  for obj in objects:
   vertices=arrays[obj['shape']];values=obj['values'];g.glBufferData(0x8892,vertices.nbytes,vertices.ctypes.data_as(C.c_void_p),0x88E4)
   for a in range(4):g.glVertexAttrib4f(a+2,*values[a*4:a*4+4])
   g.glDrawArrays(4,0,len(vertices)//6)
 raw=np.empty((height,width,4),np.uint8);g.glReadPixels(0,0,width,height,0x1908,0x1401,raw.ctypes.data_as(C.c_void_p));assert g.glGetError()==0
 image=np.flipud(raw[:,:,:3]).copy();Image.fromarray(image).save(args.output/(case['name']+'.png'));images[case['name']]=image
 counts[case['name']]={'instances':len(case['objects']),'sha256':hashlib.sha256(image.tobytes()).hexdigest()}
rows=['volant-centre','main-au-levier','retour-du-levier','virage-droite'];cols=['complet','moyen','simple']
montage=Image.new('RGB',(width*3,(height+28)*4),(22,26,32));draw=ImageDraw.Draw(montage)
for y,row in enumerate(rows):
 for x,col in enumerate(cols):
  top=y*(height+28);draw.text((x*width+10,top+7),row+' / '+col,fill=(245,245,240));montage.paste(Image.fromarray(images[row+'-'+col]),(x*width,top+28))
montage.save(args.output/'pilote-poses-egl.png')
differences={}
for col in cols:
 a=images['volant-centre-'+col]
 for row in rows[1:]:
  b=images[row+'-'+col];count=int(np.any(a!=b,axis=2).sum());assert count>20
  differences[row+'-'+col]=count
report={'scope':data['scope'],'environment':ctx.info,'sources':data['sources'],'resolution':[width,height],'cases':counts,'changedPixelsVsRest':differences,'texturesImported':0,'eglBaseSha256':hashlib.sha256(args.egl_base.read_bytes()).hexdigest()}
(args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'environment':ctx.info,'cases':len(counts),'changedPixelsVsRest':differences}))
