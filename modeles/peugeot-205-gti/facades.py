"""Original, curved front/rear panels for the 1989 Peugeot 205 GTI.

The large surfaces are sampled skins.  Lamp recesses, bumper returns and lens
curvature share those skins, rather than being independent rectangular boxes.
Coordinates are X forward, Y left and Z up, in metres.
"""
from __future__ import annotations

import math

from mathutils import Vector


def _outline(corners, radius=.008, edge_steps=5, corner_steps=5):
    """A rounded polygon in the (Y,Z) development of a curved panel."""
    corners = [Vector(p) for p in corners]
    edge_steps=min(edge_steps,8)
    out = []
    for i, p in enumerate(corners):
        prev, following = corners[i-1], corners[(i+1) % len(corners)]
        a = p + (prev-p).normalized() * min(radius, (prev-p).length*.28)
        b = p + (following-p).normalized() * min(radius, (following-p).length*.28)
        next_before = following + (p-following).normalized() * min(radius, (p-following).length*.28)
        for j in range(corner_steps):
            t = j/corner_steps
            out.append(tuple((1-t)**2*a + 2*t*(1-t)*p + t*t*b))
        for j in range(edge_steps):
            out.append(tuple(b.lerp(next_before, j/edge_steps)))
    return out


def _rect(y0, y1, z0, z1, radius=.008, edge_steps=5):
    return _outline([(y0,z0),(y1,z0),(y1,z1),(y0,z1)], radius, edge_steps)


def _scale(loop, scale, center=None):
    if center is None:
        center = (sum(p[0] for p in loop)/len(loop), sum(p[1] for p in loop)/len(loop))
    return [(center[0]+(p[0]-center[0])*scale,
             center[1]+(p[1]-center[1])*scale) for p in loop]


def _map(front, u, z, depth=0):
    """Upper fascia: slight crown across width, visibly swept outer corners."""
    if front:
        x = 1.835 - .065*(abs(u)/.72)**4 - .055*(z-.765)
        return (x+depth, u, z)
    x = 1.792 - .070*(abs(u)/.75)**4 - .050*(z-.72)
    return (-x-depth, u, z)


def _apron_map(front, u, z, depth=0):
    """The valance rolls under the body and round onto both front/rear wings."""
    a = abs(u)
    if front:
        face, corner = 1.842, 1.608
        lo, hi, tuck = .263, .536, .052
    else:
        face, corner = 1.786, 1.600
        lo, hi, tuck = .286, .507, .074
    if a <= .62:
        x = face-.018*(a/.62)**2
        y = a
    elif a <= .82:
        theta = (a-.62)/.20*math.pi/2
        x = corner + (face-.018-corner)*math.cos(theta)
        y = .62+.132*math.sin(theta)
    else:
        x, y = corner-(a-.82), .752
    t = max(0., min(1., (z-lo)/(hi-lo)))
    # The centre rolls under; the returns retain their wheel-arch clearance.
    return_taper=1-.88*max(0.,min(1.,(a-.62)/.24))
    x -= tuck*(1-t)**1.8*return_taper
    y *= .966+.034*t
    sign = 1 if front else -1
    return (sign*(x+depth), math.copysign(y,u), z)


def _normal(mapper, u, z, sign):
    e = .0001
    a = Vector(mapper(u+e,z))-Vector(mapper(u-e,z))
    b = Vector(mapper(u,z+e))-Vector(mapper(u,z-e))
    return tuple(a.cross(b).normalized()*sign)


def _plate_plane(mapper, zcenter, sign):
    """A real number plate stays planar while its surrounding valance curves."""
    center=mapper(0,zcenter,0)
    e=.0001
    slope=(mapper(0,zcenter+e,0)[0]-mapper(0,zcenter-e,0)[0])/(2*e)
    def plane(u,z,depth=0):
        return (center[0]+slope*(z-zcenter)+sign*depth,u,z)
    normal=tuple(Vector((sign,0,-slope*sign)).normalized())
    return plane,normal


def _surface(api, name, verts, faces, mat, body, sign=1, normals=None):
    if sign < 0:
        faces = [tuple(reversed(f)) for f in faces]
    ob = api.mesh(name, verts, faces, mat, body, smooth=True)
    if normals:
        ob.data.normals_split_custom_set_from_vertices(normals)
    return ob


def _patch(api, name, loop, mapper, mat, body, depth=0, crown=0, sign=1):
    """A filled curved lens/plate with sufficient topology for its true crown."""
    n = len(loop)
    cy, cz = (sum(p[k] for p in loop)/n for k in (0,1))
    verts = [mapper(cy,cz,depth+crown)]
    for scale in (.5,1.):
        for u,z in loop:
            verts.append(mapper(cy+(u-cy)*scale,cz+(z-cz)*scale,
                                depth+crown*(1-scale*scale)))
    faces = [(0,1+j,1+(j+1)%n) for j in range(n)]
    for ring in range(1):
        a,b = 1+ring*n,1+(ring+1)*n
        faces += [(a+j,b+j,b+(j+1)%n,a+(j+1)%n) for j in range(n)]
    return _surface(api,name,verts,faces,mat,body,sign)


def _ring(api, name, outer, inner, mapper, mat, body, depths=(0,0), sign=1):
    n = len(outer)
    assert len(inner) == n
    verts = [mapper(u,z,depths[0]) for u,z in outer] + [mapper(u,z,depths[1]) for u,z in inner]
    faces = [(j,(j+1)%n,n+(j+1)%n,n+j) for j in range(n)]
    return _surface(api,name,verts,faces,mat,body,sign)


def _ray_polygon(center, angle, polygon):
    """Intersection used to tile a continuous surface around a real aperture."""
    dx,dy = math.cos(angle),math.sin(angle)
    best = None
    for i,a in enumerate(polygon):
        b = polygon[(i+1)%len(polygon)]
        ex,ey = b[0]-a[0],b[1]-a[1]
        det = dx*ey-dy*ex
        if abs(det)<1e-10:
            continue
        ax,ay = a[0]-center[0],a[1]-center[1]
        t = (ax*ey-ay*ex)/det
        v = (ax*dy-ay*dx)/det
        if t >= 0 and -.00001 <= v <= 1.00001 and (best is None or t<best):
            best=t
    if best is None:
        raise ValueError('Aperture contour does not contain its centre')
    return (center[0]+dx*best, center[1]+dy*best)


def _skin(api, name, cells, mapper, mat, body, sign=1):
    """One mesh containing rectangular cells, some with rounded through-holes.

    Analytic surface normals keep adjoining cells visually continuous even
    where different aperture contours need different edge subdivisions.
    """
    verts,faces,normals = [],[],[]
    def point(uv):
        verts.append(mapper(*uv))
        normals.append(_normal(mapper,*uv,sign))
        return len(verts)-1
    for bounds,hole in cells:
        u0,u1,z0,z1 = bounds
        if hole is None:
            n,m = max(3,int((u1-u0)/.035)),max(1,int((z1-z0)/.05))
            first=len(verts)
            for i in range(n+1):
                for j in range(m+1):
                    point((u0+(u1-u0)*i/n,z0+(z1-z0)*j/m))
            for i in range(n):
                for j in range(m):
                    a=first+i*(m+1)+j
                    faces.append((a,a+m+1,a+m+2,a+1))
        else:
            center=(sum(p[0] for p in hole)/len(hole),sum(p[1] for p in hole)/len(hole))
            outer=[]
            corners=[(u0,z0),(u1,z0),(u1,z1),(u0,z1)]
            for i,p in enumerate(corners):
                q=corners[(i+1)%4]
                for j in range(6):
                    outer.append((p[0]+(q[0]-p[0])*j/6,p[1]+(q[1]-p[1])*j/6))
            angles=sorted(set(round(math.atan2(p[1]-center[1],p[0]-center[0]),10) for p in hole+outer))
            inner=[_ray_polygon(center,a,hole) for a in angles]
            boundary=[_ray_polygon(center,a,outer) for a in angles]
            n=len(angles);first=len(verts)
            for t in (0.,.5,1.):
                for a,b in zip(inner,boundary):
                    point((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))
            for ring in range(2):
                for j in range(n):
                    a=first+ring*n+j;b=first+ring*n+(j+1)%n
                    faces.append((a,a+n,b+n,b))
    return _surface(api,name,verts,faces,mat,body,sign,normals)


def _bumper(api, front, body, mats):
    sign = 1 if front else -1
    prefix = 'front' if front else 'rear'
    face = 1.883 if front else 1.811
    # Both corners finish behind the wheel opening.  The shorter rear overhang
    # needs a tighter curve followed by a straight side return, otherwise its
    # red insert meets the body moulding halfway around the corner.
    corner = face-.233 if front else 1.650
    half=[]
    for j in range(9):
        y=.56*j/8
        half.append((face-.017*(y/.56)**2,y))
    for j in range(1,13):
        a=math.pi/2*j/12
        half.append((corner+(face-.017-corner)*math.cos(a),.56+.20*math.sin(a)))
    for j in range(1,4):
        half.append((corner+(1.57-corner)*j/3,.760+(-.006 if front else .007)*j/3))
    plan=[(sign*x,-y) for x,y in reversed(half[1:])] + [(sign*x,y) for x,y in half]
    profile=[(-.032,-.050),(-.015,-.051),(-.003,-.045),(.003,-.035),
             (.004,.028),(.001,.043),(-.007,.053),(-.022,.057),
             (-.044,.052),(-.052,.038),(-.052,-.034),(-.043,-.047)]
    zcenter = .584 if front else .544
    verts, faces, stripe_low, stripe_high, upper = [],[],[],[],[]
    for i,(x,y) in enumerate(plan):
        before=Vector(plan[max(0,i-1)]);after=Vector(plan[min(len(plan)-1,i+1)])
        tangent=(after-before).normalized()
        outward=Vector((tangent.y,-tangent.x))*sign
        turn=max(0.,min(1.,(abs(y)-.68)/.08))
        vertical=(-.020 if front else .018)*turn
        shrink=1-(.10 if front else .16)*turn
        for d,dz in profile:
            verts.append((x+outward.x*d,y+outward.y*d,zcenter+vertical+dz*shrink))
        # The body-side insert resumes at Z .585 / Y .772.  Its first few
        # centimetres sit behind this return; the visible line reaches that
        # same height continuously before the two pieces meet.
        insert_rise=0. if front else .016*max(0.,min(1.,(1.65-abs(x))/.08))
        for collection,dz,d in [(stripe_low,.008+insert_rise,.005),
                                (stripe_high,.015+insert_rise,.005),(upper,.050,-.005)]:
            collection.append((x+outward.x*d,y+outward.y*d,zcenter+vertical+dz*shrink))
    n=len(profile)
    for i in range(len(plan)-1):
        for j in range(n):
            faces.append((i*n+j,(i+1)*n+j,(i+1)*n+(j+1)%n,i*n+(j+1)%n))
    faces += [tuple(reversed(range(n))),tuple((len(plan)-1)*n+j for j in range(n))]
    _surface(api,prefix+'_continuous_wraparound_bumper',verts,faces,mats['trim'],body)
    api.ribbon(prefix+'_recessed_red_bumper_insert',list(zip(stripe_low,stripe_high)),mats['stripe'],body)
    api.tube(prefix+'_bumper_upper_seal',upper,.0018,mats['gap'],body,sides=4)


def _headlamp_reflector(api,name,loop,mapper,body,mats):
    """A shallow optical bowl and bulb shield remain visible through the glass."""
    cy,cz=(sum(p[k] for p in loop)/len(loop) for k in (0,1))
    verts=[];faces=[];segments=40
    for ry,rz,depth in ((.100,.057,-.003),(.080,.048,-.009),
                        (.047,.032,-.014),(.016,.016,-.007)):
        for j in range(segments):
            a=math.tau*j/segments
            verts.append(mapper(cy+ry*math.cos(a),cz+rz*math.sin(a),depth))
    for ring in range(3):
        for j in range(segments):
            a=ring*segments+j;b=ring*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    _surface(api,name+'_concave_optical_reflector',verts,faces,mats['reflector'],body)
    shield=_rect(cy-.017,cy+.017,cz-.008,cz+.008,.005,3)
    _patch(api,name+'_small_bulb_shield',shield,mapper,mats['steel'],body,-.004,.003)


def _headlamp_glass(mats):
    # This is still the original, texture-free material.  Lower opacity exposes
    # the actual reflector instead of making each lamp a featureless white tile.
    glass=mats['headlamp'].copy()
    glass.name='Headlamp_clear_fluted_crystal'
    node=glass.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(.58,.65,.60,.34)
    node.inputs['Alpha'].default_value=.34
    node.inputs['Roughness'].default_value=.14
    node.inputs['Metallic'].default_value=.06
    glass.diffuse_color=(.58,.65,.60,.34)
    return glass


def _lens(api, name, loop, mapper, lens_mat, body, mats, sign=1,
          recess=-.005, frame_width=.94, crown=.002, reflector=True):
    inner=_scale(loop,frame_width)
    _ring(api,name+'_flush_gasket',loop,inner,mapper,mats['rubber'],body,(.002,recess),sign)
    if reflector:
        _patch(api,name+'_reflector_bowl',_scale(inner,.985),mapper,mats['reflector'],body,recess-.009,-.009,sign)
        if name.startswith('headlamp_'):
            _headlamp_reflector(api,name,inner,mapper,body,mats)
    _patch(api,name+'_curved_glass',inner,mapper,lens_mat,body,recess,crown,sign)
    return inner


def _flutes(api,name,loop,mapper,mat,body,depth,count=14,horizontal=2):
    u0,u1=min(p[0] for p in loop),max(p[0] for p in loop)
    z0,z1=min(p[1] for p in loop),max(p[1] for p in loop)
    # Intersections clip every flute to the trapezoid and its rounded corners.
    def intersections(value,axis):
        result=[]
        for i,a in enumerate(loop):
            b=loop[(i+1)%len(loop)]
            if (a[axis] <= value < b[axis]) or (b[axis] <= value < a[axis]):
                t=(value-a[axis])/(b[axis]-a[axis])
                result.append(a[1-axis]+t*(b[1-axis]-a[1-axis]))
        return (min(result),max(result)) if len(result)>=2 else None
    for j in range(count):
        u=u0+(u1-u0)*(j+1)/(count+1)
        hit=intersections(u,0)
        if hit:
            a,b=hit
            pts=[mapper(u,a+.003+(b-a-.006)*k/2,depth) for k in range(3)]
            api.tube(name+'_vertical_'+str(j),pts,.00042,mat,body,sides=4)
    for j in range(horizontal):
        z=z0+(z1-z0)*(j+1)/(horizontal+1)
        hit=intersections(z,1)
        if hit:
            a,b=hit
            pts=[mapper(a+.003+(b-a-.006)*k/4,z,depth) for k in range(5)]
            api.tube(name+'_horizontal_'+str(j),pts,.00036,mat,body,sides=4)


def _front(api, body, mats):
    face=lambda u,z,d=0:_map(True,u,z,d)
    apron=lambda u,z,d=0:_apron_map(True,u,z,d)
    headlamp_glass=_headlamp_glass(mats)
    # The nose is a thin continuous steel panel, with a rolled leading edge.
    _skin(api,'front_steel_nose',[( (-.749,.749,.635,.815),None)],
          lambda u,z:face(u,z,-.023),mats['paint'],body)
    _skin(api,'bonnet_rolled_front_lip',[( (-.727,.727,.796,.815),None)],
          lambda u,z:face(u,z,.001*math.sin((z-.796)/.019*math.pi)),mats['paint'],body)
    _skin(api,'front_lower_fascia_lip',[( (-.744,.744,.635,.650),None)],
          face,mats['paint'],body)
    grille=_outline([(-.402,.650),(.402,.650),(.439,.792),(-.439,.792)],.005,9)
    _patch(api,'grille_deep_open_slots',grille,face,mats['gap'],body,-.006)
    # Four slightly crowned, flat red bars sit within the fascia, not outside it.
    for i,z in enumerate((.662,.697,.732,.767)):
        w=.400+(z-.650)/.142*.037
        slat=_rect(-w,w,z-.006,z+.006,.003,12)
        _patch(api,'grille_red_slat_'+str(i),slat,face,mats['paint'],body,.002,.001)
    crest=_rect(-.027,.027,.676,.784,.005,4)
    _patch(api,'grille_lion_black_mount',crest,face,mats['trim'],body,.006,.001)
    lion=[(-.011,-.041),(.003,-.030),(.010,-.014),(.001,-.005),(.013,.004),(.019,.025),(.006,.032),(.004,.045),(-.008,.041),(-.014,.029),(-.007,.018),(-.022,.011),(-.025,-.005),(-.014,-.014),(-.017,-.028),(-.025,-.037)]
    api.panel('grille_standing_lion',[face(y,.732+z,.010) for y,z in lion],mats['badge'],body,.0015,0)
    api.tube('grille_lion_tail',[face(-.009,.714,.012),face(-.029,.727,.012),face(-.025,.752,.012)],.0019,mats['badge'],body,sides=4)
    for side,label in ((1,'L'),(-1,'R')):
        base=[(.406,.647),(.688,.650),(.678,.793),(.446,.796)]
        loop=_outline([(side*y,z) for y,z in (base if side>0 else reversed(base))],.009,7)
        inner=_lens(api,'headlamp_'+label,loop,face,headlamp_glass,body,mats,recess=.002,crown=.003)
        _flutes(api,'headlamp_optics_'+label,_scale(inner,.98),face,mats['lens_rib'],body,.005,22,3)
        indicator=_outline([(side*y,z) for y,z in ([(.693,.652),(.746,.657),(.736,.788),(.685,.791)] if side>0 else reversed([(.693,.652),(.746,.657),(.736,.788),(.685,.791)]))],.006,6)
        inner=_lens(api,'amber_corner_indicator_'+label,indicator,face,mats['amber'],body,mats,recess=.001,crown=.0015,reflector=False)
        _flutes(api,'amber_indicator_prisms_'+label,_scale(inner,.96),face,mats['yellow_rib'],body,.003,5,7)
    lamps={}
    for side in (-1,1):
        lamps[side]=_rect(side*.54-.105,side*.54+.105,.348,.462,.015,6)
    vent=_outline([(-.262,.316),(.262,.316),(.291,.382),(-.291,.382)],.009,8)
    cells=[((-.86,-.69,.263,.536),None),((-.69,-.40,.263,.536),lamps[-1]),
           ((-.40,-.31,.263,.536),None),((-.31,.31,.263,.536),vent),
           ((.31,.40,.263,.536),None),((.40,.69,.263,.536),lamps[1]),
           ((.69,.86,.263,.536),None)]
    _skin(api,'front_one_piece_sculpted_valance',cells,apron,mats['paint'],body)
    _ring(api,'front_air_intake_recess',vent,_scale(vent,.94),apron,mats['paint'],body,(0,-.035))
    _patch(api,'front_air_intake_shadow',_scale(vent,.94),apron,mats['gap'],body,-.036)
    for side,label in ((1,'L'),(-1,'R')):
        opening=lamps[side]
        inner=_scale(opening,.94)
        _ring(api,'driving_lamp_recess_'+label,opening,inner,apron,mats['paint'],body,(0,-.014))
        lens=_lens(api,'yellow_driving_lamp_'+label,inner,apron,mats['yellow_lens'],body,mats,recess=-.010,crown=.002,frame_width=.89)
        _flutes(api,'driving_lamp_prisms_'+label,_scale(lens,.97),apron,mats['yellow_rib'],body,-.007,15,2)
        # Shallow concentric lens detail makes the small yellow projector read
        # as a real lamp instead of a flat yellow rectangle.
        cy=side*.54;cz=.405
        for radius in (.014,.027):
            pts=[apron(cy+radius*math.cos(a*math.tau/32),cz+radius*math.sin(a*math.tau/32),-.0065) for a in range(32)]
            api.tube('driving_lamp_fresnel_'+label+str(radius),pts,.00055,mats['yellow_rib'],body,cyclic=True,sides=4)
    mount=_rect(-.249,.249,.412,.520,.006,7)
    plate=_rect(-.230,.230,.421,.511,.004,7)
    plate_map,plate_normal=_plate_plane(apron,.466,1)
    _patch(api,'front_plate_surround',mount,plate_map,mats['trim'],body,.004)
    _patch(api,'front_numberplate',plate,plate_map,mats['plate_front'],body,.006)
    api.text_mesh('front_plate_text','205 GTI',plate_map(0,.466,.008),.063,mats['plate_ink'],body,plate_normal,(0,1,0),.342)
    lip=[]
    for j in range(81):
        u=-.85+1.70*j/80
        lip.append([apron(u,.263,-.008),apron(u,.257,-.023),apron(u,.251,-.038)])
    api.ribbon('front_curved_lower_air_lip',lip,mats['trim'],body)


def _rear(api, body, mats):
    face=lambda u,z,d=0:_map(False,u,z,d)
    apron=lambda u,z,d=0:_apron_map(False,u,z,d)
    _skin(api,'rear_curved_lower_tailgate',[( (-.749,.749,.596,.825),None)],
          lambda u,z:face(u,z,-.006),mats['paint'],body,-1)
    applique=_rect(-.548,.548,.637,.804,.006,14)
    _patch(api,'rear_flush_ribbed_applique',applique,face,mats['trim'],body,.001,0,-1)
    for i in range(8):
        z=.645+i*.0205
        loop=_rect(-.542,.542,z,z+.0030,.001,14)
        _patch(api,'rear_applique_rib_'+str(i),loop,face,mats['trim_edge'],body,.0035,0,-1)
    for side,label in ((1,'L'),(-1,'R')):
        cy=side*.645
        outer=_rect(cy-.094,cy+.094,.640,.800,.008,6)
        inner=_scale(outer,.947)
        _ring(api,'rear_lamp_flush_gasket_'+label,outer,inner,face,mats['rubber'],body,(.002,.002),-1)
        _patch(api,'rear_lamp_silver_backing_'+label,inner,face,mats['reflector'],body,0,0,-1)
        # Phase-1.5 combination: amber outboard; red stop/tail below;
        # red and white stacked inboard above, as on the original car.
        zbottom=.646;zmid=.714;ztop=.794
        lo,hi=cy-.086,cy+.086
        red=_rect(lo,hi,zbottom,zmid,.005,7)
        _patch(api,'rear_tail_red_'+label,red,face,mats['red_lens'],body,.003,.002,-1)
        inner_y=cy-side*.042
        outer_y=cy+side*.044
        amber=_rect(outer_y-.041,outer_y+.041,zmid+.002,ztop,.004,5)
        redtop=_rect(inner_y-.039,inner_y+.039,.754,ztop,.003,5)
        reverse=_rect(inner_y-.039,inner_y+.039,zmid+.002,.751,.002,5)
        _patch(api,'rear_tail_amber_'+label,amber,face,mats['amber'],body,.003,.0015,-1)
        _patch(api,'rear_tail_upper_red_'+label,redtop,face,mats['red_lens'],body,.003,.0015,-1)
        _patch(api,'rear_reverse_white_'+label,reverse,face,mats['headlamp'],body,.003,.0015,-1)
        _flutes(api,'rear_red_optics_'+label,_scale(red,.97),face,mats['red_rib'],body,.005,12,2)
        _flutes(api,'rear_amber_optics_'+label,_scale(amber,.94),face,mats['yellow_rib'],body,.005,5,3)
    api.text_mesh('rear_peugeot','PEUGEOT',face(.345,.767,.008),.034,mats['badge'],body,(-1,0,0),(0,-1,0),.297)
    api.text_mesh('rear_205','205',face(-.304,.767,.008),.039,mats['badge'],body,(-1,0,0),(0,-1,0),.150)
    api.text_mesh('rear_gti','GTI',face(-.455,.767,.008),.036,mats['stripe'],body,(-1,0,0),(0,-1,0),.112)
    api.cylinder('tailgate_lock',face(0,.724,.008),.015,.006,mats['metal'],body,axis='X',vertices=24,edge=.001)
    api.cylinder('tailgate_keyhole',face(0,.724,.012),.004,.001,mats['gap'],body,axis='X',vertices=12,edge=0)
    plate_hole=_rect(-.258,.258,.348,.470,.012,7)
    lamps={side:_rect(side*.40-.068,side*.40+.068,.370,.442,.009,6) for side in (-1,1)}
    cells=[((-.86,-.50,.286,.507),None),((-.50,-.31,.286,.507),lamps[-1]),
           ((-.31,.31,.286,.507),plate_hole),((.31,.50,.286,.507),lamps[1]),
           ((.50,.86,.286,.507),None)]
    _skin(api,'rear_one_piece_rolled_valance',cells,apron,mats['paint'],body,-1)
    _ring(api,'rear_plate_pressed_recess',plate_hole,_scale(plate_hole,.965),apron,mats['paint'],body,(0,-.013),-1)
    surround=_scale(plate_hole,.958)
    plate_map,plate_normal=_plate_plane(apron,.409,-1)
    _patch(api,'rear_plate_recess_shadow',surround,plate_map,mats['trim'],body,-.012,0,-1)
    plate=_rect(-.234,.234,.360,.458,.004,7)
    _patch(api,'rear_numberplate',plate,plate_map,mats['plate_rear'],body,-.009,0,-1)
    api.text_mesh('rear_plate_text','205 GTI',plate_map(0,.409,-.007),.066,mats['plate_ink'],body,plate_normal,(0,-1,0),.344)
    for side,label in ((1,'L'),(-1,'R')):
        opening=lamps[side]
        inner=_scale(opening,.95)
        _ring(api,'rear_fog_pressed_recess_'+label,opening,inner,apron,mats['paint'],body,(0,-.009),-1)
        lens=_lens(api,'rear_fog_reflector_'+label,inner,apron,mats['red_lens'],body,mats,sign=-1,recess=-.005,crown=.001,frame_width=.88,reflector=False)
        _flutes(api,'rear_fog_prisms_'+label,_scale(lens,.96),apron,mats['red_rib'],body,-.003,8,2)
    seam=[apron(-.84+1.68*j/72,.299,-.0005) for j in range(73)]
    api.tube('rear_valance_lower_pressing',seam,.0015,mats['paint'],body,sides=4)


def build_faces(api, body, mats):
    """Build both facades without touching the main shell or export setup."""
    _bumper(api,True,body,mats)
    _bumper(api,False,body,mats)
    _front(api,body,mats)
    _rear(api,body,mats)
