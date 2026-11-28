"""205 GTI lower body: pressed steel surfaces and moulded arch extensions.

The shell is constructed directly as smooth meshes, in metres, +X forward,
+Y left, +Z up. No textures, reference photographs or external geometry are used.
The public section functions also define the interfaces of the glazing/fascias.
"""
from __future__ import annotations

import math

PI = math.pi
X_REAR, X_FRONT = -1.72, 1.77
AXLES = (-1.21, 1.21)
HUB_Z = .2875


def _clamp(v, a=0., b=1.):
    return max(a, min(b, v))


def _smooth(v):
    v=_clamp(v)
    return v*v*(3-2*v)


def _table(points):
    """Shape-preserving cubic Hermite interpolation, with quiet end tangents."""
    p = tuple(points)
    slopes = [(b[1]-a[1])/(b[0]-a[0]) for a, b in zip(p, p[1:])]
    m = [0.]
    for i in range(1, len(p)-1):
        a, b = slopes[i-1], slopes[i]
        if a*b <= 0:
            m.append(0.)
        else:
            h0, h1 = p[i][0]-p[i-1][0], p[i+1][0]-p[i][0]
            w0, w1 = 2*h1+h0, h1+2*h0
            m.append((w0+w1)/(w0/a+w1/b))
    m.append(0.)
    return p, m


def _curve(x, tab):
    p, slopes = tab
    if x <= p[0][0]:
        return p[0][1]
    if x >= p[-1][0]:
        return p[-1][1]
    for i, ((xa, ya), (xb, yb)) in enumerate(zip(p, p[1:])):
        if xa <= x <= xb:
            h = xb-xa
            t = (x-xa)/h
            return ((2*t**3-3*t*t+1)*ya + (t**3-2*t*t+t)*h*slopes[i]
                    + (-2*t**3+3*t*t)*yb + (t**3-t*t)*h*slopes[i+1])
    raise ValueError(x)


_BELT = _table([(-1.72,.889),(-1.48,.896),(-.96,.896),(-.40,.896),
                (.30,.896),(.73,.896),(1.02,.876),(1.32,.856),
                (1.60,.846),(1.729,.843)])
_WIDTH = _table([(-1.72,.747),(-1.59,.751),(-1.30,.756),(-.93,.754),
                 (-.45,.751),(.25,.752),(.73,.754),(1.17,.757),
                 (1.48,.753),(1.66,.746),(1.77,.744)])
_TOP_WIDTH = _table([(-1.72,.720),(-1.48,.722),(-1.02,.722),(-.5,.718),
                     (.30,.718),(.73,.718),(1.12,.722),(1.55,.720),
                     (1.77,.720)])
_BELLY = _table([(0.,-.038),(.07,-.024),(.25,-.009),(.46,.001),
                 (.70,.007),(1.,.005)])


def belt_z(x):
    """Top of the painted side panel, including the rounded front fender nose."""
    if x >= X_FRONT:
        return .815
    if x > 1.729:
        t = _clamp((x-1.729)/.041)
        return .815 + .028*math.sqrt(max(0., 1-t*t))
    return _curve(x, _BELT)


def width_at(x, z):
    """Positive outside Y of the side skin at (X,Z), excluding GTI mouldings.

    The upper 80 mm are an elliptical shoulder. Its horizontal tangent at the
    belt is shared by the bonnet/cowl; the door is gently convex and tucks in
    below the rub strip instead of being a vertical slab.
    """
    top, base = belt_z(x), _curve(x, _WIDTH)
    shoulder_z = top-.080
    yt = _curve(x, _TOP_WIDTH)
    if z >= top-1.e-12:
        return yt
    if z >= shoulder_z:
        q = _clamp((z-shoulder_z)/.080)
        return yt + (base+.005-yt)*math.sqrt(max(0., 1-q*q))
    h = _clamp((z-.235)/(shoulder_z-.235))
    return base + _curve(h, _BELLY)


def arch_bottom(x):
    """Upper edge of each actual wheel opening; the shell never spans a tire."""
    for c in AXLES:
        dx = abs(x-c)
        if dx <= .334:
            return HUB_Z+.347*math.sqrt(max(0., 1-(dx/.334)**2))
        if dx < .337:
            return .235 + (.2875-.235)*(1-(dx-.334)/.003)
    return .235


def _skin_bottom(x):
    """Leave the lower rounded corners to the wraparound bumper/valance skin."""
    low=arch_bottom(x)
    if x > 1.55:
        if x < 1.568:
            low=max(low,.235+.280*_smooth((x-1.55)/.018))
        else:
            low=max(low,.515+.110*_smooth((x-1.568)/.202))
    elif x < -1.55:
        if x > -1.568:
            low=max(low,.235+.368*_smooth((-x-1.55)/.018))
        else:
            # The rear bumper wraps above Z .610. Stop the hidden wing skin
            # underneath that top edge, so it cannot poke through the black
            # moulding when its lateral return narrows around the corner.
            low=max(low,.603)
    return low


def _ribbon(api, name, rings, mat, parent, reverse=False, smooth=True):
    n = len(rings[0])
    verts = [p for ring in rings for p in ring]
    faces = [(i*n+j, i*n+j+1, (i+1)*n+j+1, (i+1)*n+j)
             for i in range(len(rings)-1) for j in range(n-1)]
    if reverse:
        faces = [f[::-1] for f in faces]
    return api.mesh(name, verts, faces, mat, parent, smooth)


def _path(points, subdivisions=7):
    """Catmull–Rom path with duplicated end knots, for pressed shut-lines."""
    out = []
    p = [points[0]]+list(points)+[points[-1]]
    for i in range(1, len(p)-2):
        a, b, c, d = p[i-1:i+3]
        for j in range(subdivisions):
            t = j/subdivisions
            out.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t
                         +(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t
                         +(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)
                         for k in range(len(b))))
    out.append(points[-1])
    return out


def _strip(api, name, points, width, mat, body, side, offset=.0017):
    """A nearly flush inset line on the skin, not a projecting round rod."""
    rings = []
    for i, (x, z) in enumerate(points):
        p0, p1 = points[max(0, i-1)], points[min(len(points)-1, i+1)]
        dx, dz = p1[0]-p0[0], p1[1]-p0[1]
        norm = max(1.e-9, math.hypot(dx,dz))
        ox, oz = -dz/norm*width/2, dx/norm*width/2
        rings.append([(xx, side*(width_at(xx,zz)+offset), zz)
                      for xx,zz in [(x-ox,z-oz),(x+ox,z+oz)]])
    return _ribbon(api,name,rings,mat,body,reverse=side<0)


def _arch(api, body, mats, side, label, c, axle):
    # Broad, nearly flat moulded face with narrow rolled edges and a returned lip.
    # Radial profile is 46 mm wide; its peak is exactly half the nominal 1.589 m.
    profile = [(-.009,.742), (0.,.775), (.004,.789), (.010,.793),
               (.022,.7945), (.034,.7935), (.041,.787), (.046,None)]
    rings, returned, well = [], [], []
    steps = 64
    for i in range(steps+1):
        a = -.145+(PI+.290)*i/steps
        ca, sa = math.cos(a), math.sin(a)
        row=[]
        for radial, y in profile:
            x, z = c+(.334+radial)*ca, HUB_Z+(.347+radial)*sa
            if y is None:
                y = width_at(x,z)+.0015
            row.append((x,side*y,z))
        rings.append(row)
        x,z=c+.334*ca,HUB_Z+.347*sa
        returned.append([(x,side*y,z) for y in (width_at(x,z)-.004,.735,.704)])
        well.append([(c+.328*ca,side*y,HUB_Z+.341*sa) for y in (.50,.615,.736)])
    _ribbon(api,'arch_'+axle+'_'+label,rings,mats['trim'],body,reverse=side<0)
    _ribbon(api,'body_arch_return_'+axle+'_'+label,returned,mats['paint'],body,reverse=side<0)
    _ribbon(api,'arch_inner_tub_'+axle+'_'+label,well,mats['rubber'],body,reverse=side>0)
    wall=[(c,side*.50,.238)]+[(c+.328*math.cos(PI*i/48),side*.50,
          HUB_Z+.341*math.sin(PI*i/48)) for i in range(49)]
    api.panel('arch_inner_wall_'+axle+'_'+label,wall,mats['rubber'],body,.004,0)
    # Close the two small moulded cut ends, outside the wheel opening.
    for k,ring in enumerate((rings[0],rings[-1])):
        api.panel('arch_end_'+axle+'_'+label+str(k),ring,mats['trim'],body,.002,0)


def _rubstrip(api, body, mats, side, label):
    # The trim meets the arches at their intersections with the belt moulding.
    # Profile is intentionally flat across its broad face, with 3 mm edge rolls.
    section=[(.515,.001),(.519,.007),(.525,.012),(.543,.014),
             (.572,.014),(.583,.0135),(.589,.0135),(.603,.011),(.608,.004)]
    def endpoints(k, z):
        dx=.380*math.sqrt(max(0.,1-((z-HUB_Z)/.393)**2))
        # Six millimetres of overlap disappear under each profiled arch edge.
        return [(-1.610,-1.21-dx+.006),
                (-1.21+dx-.006,1.21-dx+.006),
                (1.21+dx-.006,1.610)][k]
    def point(k, t, z, d):
        endblend=0.
        if k==0:
            endblend=1-_smooth(t/.25)
            z-=.012*endblend
        elif k==2:
            endblend=1-_smooth((1-t)/.25)
            z-=.008*endblend
        a,b=endpoints(k,z)
        x=a+(b-a)*t
        d*=1-.7*endblend
        return (x,side*(width_at(x,z)+d),z)
    for k in range(3):
        rings, red, bottom = [], [], []
        count=45 if k==1 else 13
        for i in range(count):
            t=i/(count-1)
            rings.append([point(k,t,z,d) for z,d in section])
            red.append([point(k,t,z,.0151) for z in (.581,.589)])
            bottom.append([point(k,t,z,.0144) for z in (.535,.537)])
        _ribbon(api,'body_rubstrip_'+label+str(k),rings,mats['trim'],body,reverse=side<0)
        _ribbon(api,'body_red_inlay_'+label+str(k),red,mats['stripe'],body,reverse=side<0)
        _ribbon(api,'body_rubstrip_lower_ridge_'+label+str(k),bottom,mats['trim_edge'],body,reverse=side<0)
        # End returns turn back onto the steel and remain hidden under arch edges.
        for end, ring in enumerate((rings[0],rings[-1])):
            cap=ring+[point(k,end,z,0) for z in (.608,.515)]
            api.panel('body_rubstrip_end_'+label+str(k)+str(end),cap,mats['trim'],body,.001,0)


def _rear_corner(api, body, mats, side, label):
    """Roll the upper rear wing into the narrower lower tailgate edge.

    At the lamp tops the wing is 33 mm wider than the tailgate surround; leaving
    these independent edges unconnected makes a visible triangular hole. This
    short curved return shares the exact lower-hatch interface from pavillon:
    X -1.728 -> -1.720, Y .718, Z .825 -> .889. The first row overlaps the fascia
    by 2.5 mm. Its tangent turns from the side skin towards the rear panel.
    """
    rings=[]
    for i in range(17):
        z=.8225+(.889-.8225)*i/16
        h=_clamp((z-.825)/.064)
        xs,ys=X_REAR,width_at(X_REAR,z)
        xh,yh=-1.728+.008*h,.718
        dx,dy=xs-xh,ys-yh
        controls=[(xs,ys),(xs-.55*dx,ys),(xh,yh+.55*dy),(xh,yh)]
        row=[]
        for j in range(9):
            t=j/8;u=1-t
            weights=(u**3,3*u*u*t,3*u*t*t,t**3)
            x=sum(w*p[0] for w,p in zip(weights,controls))
            y=sum(w*p[1] for w,p in zip(weights,controls))
            row.append((x,side*y,z))
        rings.append(row)
    _ribbon(api,'body_rear_shoulder_corner_'+label,rings,mats['paint'],body,reverse=side<0)


def _bonnet(api, body, mats):
    # The nose rolls down as an elliptical pressing. Its leading boundary is
    # curved in plan; the corners sit 65 mm behind the centre of the nose.
    across=[-1+j/20 for j in range(41)]
    rings=[]
    long_steps=34
    def crown(v):
        return .025+.003*math.sin(PI*v)-.001*v
    for i in range(long_steps+1):
        v=i/long_steps
        xe=.73+.999*v
        w=_curve(xe,_TOP_WIDTH)
        ring=[]
        for t in across:
            x=xe+.065*(1-abs(t)**6)*v*v
            z=belt_z(xe)+crown(v)*(1-t*t)**2
            ring.append((x,w*t,z))
        rings.append(ring)
    for i in range(1,9):
        theta=(PI/2)*i/8
        ring=[]
        for t in across:
            x=1.729+.041*math.sin(theta)+.065*(1-abs(t)**6)
            z=.815+(.028+crown(1)*(1-t*t)**2)*math.cos(theta)
            ring.append((x,.720*t,z))
        rings.append(ring)
    ob=_ribbon(api,'bonnet_pressing',rings,mats['paint'],body,reverse=True)
    sol=ob.modifiers.new('Bonnet steel return','SOLIDIFY')
    sol.thickness=.008;sol.offset=-1
    api.apply_modifier(ob,sol)
    # Thin panel gaps sit inside the crown, between bonnet and wing tops.
    for side,label in [(1,'L'),(-1,'R')]:
        seam=[]
        t=side*.866
        for i in range(long_steps+1):
            v=i/long_steps;xe=.73+.999*v;w=_curve(xe,_TOP_WIDTH)
            seam.append((xe+.065*(1-abs(t)**6)*v*v,w*t,
                         belt_z(xe)+crown(v)*(1-t*t)**2+.0011))
        for i in range(1,9):
            th=(PI/2)*i/8
            seam.append((1.729+.041*math.sin(th)+.065*(1-abs(t)**6),
                         .720*t,.815+(.028+crown(1)*(1-t*t)**2)*math.cos(th)+.0011))
        api.tube('bonnet_panel_gap_'+label,seam,.00135,mats['gap'],body,sides=4)
    rear=[]
    for i in range(33):
        t=-1+2*i/32
        rear.append((.730,.718*t,.896+.025*(1-t*t)**2+.0011))
    api.tube('bonnet_cowl_gap',rear,.00145,mats['gap'],body,sides=4)


def build_shell(api, body, mats):
    """Create the lower painted shell and trim; everything is parented to body."""
    xs=set(X_REAR+(X_FRONT-X_REAR)*i/108 for i in range(109))
    xs.update([.73,1.729,1.77,1.55,1.559,1.568,-1.55,-1.559,-1.568])
    xs.update(1.729+.041*math.sin(PI/2*i/8) for i in range(9))
    for c in AXLES:
        xs.update(c+.334*math.cos(PI*i/36) for i in range(37))
        xs.update((c-.337,c+.337))
    xs=sorted(set(round(x,9) for x in xs))
    for side,label in [(1,'L'),(-1,'R')]:
        rings=[]
        for x in xs:
            low, shoulder = _skin_bottom(x),belt_z(x)-.080
            zs=[low+(shoulder-low)*t for t in (0.,.08,.20,.36,.53,.70,.86,1.)]
            zs.extend(shoulder+.080*math.sin(PI/2*i/6) for i in range(1,7))
            rings.append([(x,side*width_at(x,z),z) for z in zs])
        _ribbon(api,'body_continuous_side_'+label,rings,mats['paint'],body,reverse=side<0)
        # Fold the painted sill back inward. The broad roll is part of the shell.
        sill=[]
        for i in range(45):
            x=-.876+1.752*i/44
            w=width_at(x,.235)
            sill.append([(x,side*y,z) for y,z in [(w+.001,.262),(w+.003,.245),
                         (w-.001,.233),(w-.012,.223),(w-.038,.221),(w-.050,.230)]])
        _ribbon(api,'body_sill_return_'+label,sill,mats['paint'],body,reverse=side>0)
        for c,axle in [(1.21,'front'),(-1.21,'rear')]:
            _arch(api,body,mats,side,label,c,axle)
        _rubstrip(api,body,mats,side,label)
        _rear_corner(api,body,mats,side,label)

        # Three-door shell: corrected short door and B-pillar at X≈−.44 m.
        door=[(.729,.895),(.755,.856),(.789,.764),(.811,.655),(.806,.439),
              (.769,.317),(.715,.279),(.20,.276),(-.366,.276),
              (-.454,.299),(-.485,.381),(-.492,.620),(-.487,.895)]
        seam=_path(door,6)
        _strip(api,'body_door_shutline_'+label,seam,.0032,mats['gap'],body,side)
        _strip(api,'body_sill_seam_'+label,[(-.85+i*1.70/40,.262) for i in range(41)],
               .0018,mats['gap'],body,side)
        # Door furniture follows the actual convex skin instead of floating flat.
        hx,hz=-.370,.809
        hy=width_at(hx,hz)
        api.box('body_handle_recess_'+label,(hx,side*(hy+.004),hz),
                (.147,.009,.047),mats['gap'],body,.009,4)
        api.box('body_door_handle_'+label,(hx+.003,side*(hy+.012),hz+.002),
                (.124,.022,.028),mats['trim'],body,.008,4)
        api.cylinder('body_door_lock_'+label,(hx-.025,side*(width_at(hx-.025,hz-.047)+.006),hz-.047),
                     .007,.006,mats['metal'],body,vertices=20)
        ix,iz=.939,.741
        iy=width_at(ix,iz)
        api.box('body_indicator_bezel_'+label,(ix,side*(iy+.004),iz),
                (.066,.010,.026),mats['trim'],body,.008,4)
        api.box('body_indicator_lens_'+label,(ix,side*(iy+.010),iz),
                (.053,.006,.018),mats['amber'],body,.006,4)
    _bonnet(api,body,mats)
