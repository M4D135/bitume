"""Carte statique de conception ; lancer après capturer-trace.mjs depuis n'importe quel dossier."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as colors
from matplotlib.collections import LineCollection
import numpy as np

out = Path(__file__).resolve().parent
d = json.loads((out / 'trace-baikal.json').read_text())
p = d['points']
x, z, y, s = [np.array([q[k] for q in p]) for k in ['x', 'z', 'y', 's']]
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.labelcolor': '#42525a',
                     'text.color': '#1d333c', 'xtick.color': '#52656d', 'ytick.color': '#52656d'})
fig = plt.figure(figsize=(13.5, 8), facecolor='#f4f7f6')
gs = fig.add_gridspec(2, 3, left=.065, right=.95, top=.80, bottom=.12, wspace=.48, hspace=.36)
ax = fig.add_subplot(gs[:, :2])
profile = fig.add_subplot(gs[0, 2])
facts = fig.add_subplot(gs[1, 2])
fig.text(.065, .935, 'BITUME  /  BAÏKAL', size=26, weight='bold')
fig.text(.065, .885, '13A · Tracé original et relief de piste', size=14, color='#426875')
fig.text(.95, .93, 'RUSSIE', ha='right', size=13, weight='bold', color='#426875')
fig.text(.95, .88, 'Graine 179 · Conception procédurale', ha='right', size=10, color='#63777d')

coords = np.column_stack([x, z])
segments = np.stack([coords[:-1], coords[1:]], axis=1)
norm = colors.Normalize(vmin=0, vmax=max(y))
line = LineCollection(segments, cmap='viridis', norm=norm, linewidths=5.5, zorder=3)
line.set_array((y[:-1] + y[1:]) / 2)
ax.add_collection(line)
ax.autoscale(); ax.margins(.12); ax.set_aspect('equal')
ax.scatter([x[0]], [z[0]], s=100, facecolors='white', edgecolors='#1d333c', linewidths=2, zorder=5)
ax.annotate('DÉPART / STANDS', (x[0], z[0]), xytext=(14, -24), textcoords='offset points',
            fontsize=10, weight='bold', bbox={'boxstyle': 'round,pad=.3', 'fc': '#f4f7f6', 'ec': 'none'})
for fraction in [.25, .52, .82]:
    i = int(np.argmin(abs(s - fraction * d['longueur'])))
    j = min(i + 7, len(s) - 1)
    ax.annotate('', xy=(x[j], z[j]), xytext=(x[i], z[i]),
                arrowprops={'arrowstyle': '-|>', 'color': '#172f39', 'lw': 1.5}, zorder=4)
peak = int(np.argmax(y))
ax.annotate('PROMONTOIRE', (x[peak], z[peak]), xytext=(14, 17), textcoords='offset points',
            fontsize=10, weight='bold', bbox={'boxstyle': 'round,pad=.3', 'fc': '#f4f7f6', 'ec': 'none'})
ax.set_xlabel('X du monde (m)'); ax.set_ylabel('Z du monde (m)')
ax.set_title('Géométrie en plan · couleur = hauteur de piste', loc='left', fontsize=11, pad=15)
ax.grid(alpha=.15); ax.set_facecolor('#f4f7f6')
for spine in ax.spines.values(): spine.set_color('#cedbdc')
cb = fig.colorbar(line, ax=ax, orientation='horizontal', pad=.12, fraction=.045, shrink=.75)
cb.set_label('Hauteur relative à la ligne de départ (m)', fontsize=9)
cb.outline.set_visible(False)

profile.fill_between(s / 1000, y, color='#d5e7de')
profile.plot(s / 1000, y, color='#248675', linewidth=2.6)
profile.set_xlim(0, d['longueur'] / 1000); profile.set_ylim(-2, 72)
profile.set_xlabel('Distance sur le tour (km)'); profile.set_ylabel('Hauteur (m)')
profile.set_title('Profil altimétrique', loc='left', fontsize=12, weight='bold', pad=15)
profile.set_facecolor('#f4f7f6'); profile.grid(alpha=.16)
profile.spines[['top', 'right']].set_visible(False)
profile.spines[['left', 'bottom']].set_color('#cedbdc')

facts.axis('off')
facts.text(0, .98, '5,424 km', fontsize=27, weight='bold', va='top')
facts.text(0, .78, 'Longueur du tour', color='#63777d')
facts.text(0, .59, f"{d['denivele']:.1f} m".replace('.', ','), fontsize=23, weight='bold')
facts.text(0, .45, 'Dénivelé de piste', color='#63777d')
facts.text(0, .27, '6,8 % max  ·  816 m de droite', fontsize=11, weight='bold')
facts.text(0, .09, 'Route de 12 m · grille et stands plats', fontsize=10)
fig.text(.065, .04, 'Carte de conception calculée depuis le jeu. Le décor détaillé du lac et des berges relève du lot 13B.',
         fontsize=10, color='#63777d')
fig.savefig(out / 'carte-relief.png', dpi=170, facecolor=fig.get_facecolor())
plt.close(fig)
