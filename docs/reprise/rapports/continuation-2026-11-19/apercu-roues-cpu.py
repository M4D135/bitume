"""Aperçu CPU des vrais triangles. Ce dessin ne valide pas le rendu FERRO/WebGL."""
import json,sys,numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
meshes=json.load(open(sys.argv[1]));fig=plt.figure(figsize=(10,10),facecolor='#10151e')
labels={'slicks':'Slick neuf — surface lisse','inter':'Intermédiaire — canaux espacés','pluie':'Pluie — sculptures ouvertes','neige':'Neige — blocs et lamelles'}
light=np.array([-.5,-.7,1.]);light/=np.linalg.norm(light)
for i,(kind,parts) in enumerate(meshes.items(),1):
 ax=fig.add_subplot(2,2,i,projection='3d');ax.set_facecolor('#10151e')
 for p in parts:
  raw=np.array(p['tri']);v=raw[:,:3,:]*np.array(p['taille'])+np.array(p['decale'])
  n=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-14)
  shade=.30+.70*np.maximum(0,n@light)
  base=np.array(p['couleur']);base=np.sqrt(base)*.88
  colors=np.clip(base[None,:]*shade[:,None]+.018,0,1)
  ax.add_collection3d(Poly3DCollection(v,facecolors=colors,edgecolors='none',linewidths=0,zsort='average'))
 ax.set(xlim=(-.40,.40),ylim=(-.40,.40),zlim=(-.40,.40));ax.set_box_aspect((1,1,1));ax.view_init(elev=18,azim=-57);ax.set_proj_type('ortho');ax.set_axis_off()
 ax.set_title(labels[kind],color='#e9eef7',fontsize=12,pad=-4)
fig.suptitle('BITUME · géométrie réelle des roues',color='white',fontsize=19,y=.96)
fig.text(.5,.035,'Inspection CPU des maillages · éclairage de diagnostic · ne constitue pas une capture WebGL',ha='center',color='#a9b8cc',fontsize=10)
fig.subplots_adjust(left=.015,right=.985,bottom=.07,top=.92,wspace=-.08,hspace=.02)
fig.savefig(sys.argv[2],dpi=140,facecolor=fig.get_facecolor());print(sys.argv[2])
