"""Habitacle procédural d'une Peugeot 205 GTI 1.9, sans texture externe.

Utilisé par generer.py dans Blender. Repère local : X avant, Y gauche,
Z haut ; dimensions en mètres. build_interior ne nettoie ni n'exporte la scène.
"""

import math

import bpy
from mathutils import Vector, Matrix


def build_interior(parent, materials):
    """Construit un habitacle et rend les objets créés + le pivot du volant."""
    created = []

    def material(key, color, roughness=0.7, metallic=0.0):
        if key in materials:
            return materials[key]
        mat = bpy.data.materials.new(key)
        mat.diffuse_color = (*color, 1)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        materials[key] = mat
        return mat

    plastic = material("cabin_anthracite_plastic", (0.018, 0.019, 0.021), 0.72)
    leather = material("cabin_black_bolsters", (0.011, 0.012, 0.014), 0.53)
    cloth = material("cabin_grey_cloth", (0.055, 0.058, 0.064), 0.96)
    carpet = material("cabin_carpet", (0.115, 0.005, 0.011), 1)
    red = material("cabin_red_weave", (0.36, 0.011, 0.017), 0.94)
    silver = material("cabin_brushed_metal", (0.31, 0.33, 0.34), 0.34, 0.75)
    dial = material("cabin_instrument_black", (0.004, 0.005, 0.006), 0.42)
    ivory = material("cabin_instrument_print", (0.69, 0.68, 0.62), 0.7)
    orange = material("cabin_instrument_needles", (0.65, 0.045, 0.006), 0.55)

    def mesh(name, verts, faces, mat, owner=None, smooth=False):
        data = bpy.data.meshes.new("cabin_" + name)
        data.from_pydata(verts, [], faces)
        data.materials.append(mat)
        data.update()
        obj = bpy.data.objects.new("cabin_" + name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent if owner is None else owner
        for poly in data.polygons:
            poly.use_smooth = smooth
        created.append(obj)
        return obj

    def bevel_box(name, pos, size, mat, radius=0.015, owner=None, rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        obj = bpy.context.object
        obj.name = "cabin_" + name
        obj.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if rot:
            obj.rotation_euler = rot
        if radius:
            bevel = obj.modifiers.new("Rounded upholstery edges", "BEVEL")
            bevel.width = radius
            bevel.segments = 3 if radius >= 0.035 else (2 if radius >= 0.012 else 1)
            bpy.ops.object.modifier_apply(modifier=bevel.name)
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
            normal = obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
            normal.keep_sharp = True
            bpy.ops.object.modifier_apply(modifier=normal.name)
        obj.data.materials.append(mat)
        obj.parent = parent if owner is None else owner
        created.append(obj)
        return obj

    def rod(name, a, b, radius, mat, sides=10, owner=None):
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, 1, 0))
        u = axis.cross(ref).normalized()
        v = axis.cross(u).normalized()
        verts = [tuple(p + radius * (u * math.cos(t * math.tau / sides)
                                    + v * math.sin(t * math.tau / sides)))
                 for p in (a, b) for t in range(sides)]
        faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides)
                 for i in range(sides)]
        faces.extend([tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))])
        return mesh(name, verts, faces, mat, owner, True)

    def loft(name, sections, mat, segments=16, exponent=3.0):
        # sections: z, x centre, y centre, demi-profondeur, demi-largeur.
        verts = []
        for z, x, y, dx, dy in sections:
            for i in range(segments):
                a = math.tau * i / segments
                c, s = math.cos(a), math.sin(a)
                verts.append((x + dx * math.copysign(abs(c) ** (2 / exponent), c),
                              y + dy * math.copysign(abs(s) ** (2 / exponent), s), z))
        faces = []
        for j in range(len(sections) - 1):
            for i in range(segments):
                k, n = j * segments + i, j * segments + (i + 1) % segments
                faces.append((k, n, n + segments, k + segments))
        faces.extend([tuple(reversed(range(segments))),
                      tuple(range((len(sections) - 1) * segments, len(sections) * segments))])
        return mesh(name, verts, faces, mat, smooth=True)

    def disk(name, x, y, z, radius, mat, segments=32):
        verts = [(x, y, z)] + [(x, y + radius * math.cos(i * math.tau / segments),
                               z + radius * math.sin(i * math.tau / segments))
                              for i in range(segments)]
        return mesh(name, verts, [(0, (i + 1) % segments + 1, i + 1)
                                  for i in range(segments)], mat)

    # Carpet and shallow centre tunnel: closed surfaces visible from any camera.
    bevel_box("carpet_floor", (-0.39, 0, 0.327), (2.22, 1.24, 0.045), carpet, 0.025)
    bevel_box("centre_tunnel", (-0.18, 0, 0.394), (1.12, 0.18, 0.12), plastic, 0.035)

    for y, side in [(0.34, "driver"), (-0.34, "passenger")]:
        # Long lower cushion, reclined backrest and four separate sculpted bolsters.
        bevel_box(side + "_seat_rail", (-0.25, y, 0.368), (0.47, 0.36, 0.045), leather, 0.009)
        bevel_box(side + "_seat_base", (-0.22, y, 0.453), (0.54, 0.46, 0.15), leather, 0.055)
        bevel_box(side + "_cushion_insert", (-0.192, y, 0.523), (0.435, 0.285, 0.036), cloth, 0.016)
        for side_sign in (-1, 1):
            by = y + side_sign * 0.188
            loft(side + "_cushion_bolster_" + str(side_sign), [
                (0.43, -0.225, by, 0.235, 0.045),
                (0.48, -0.225, by, 0.255, 0.052),
                (0.55, -0.225, by, 0.221, 0.052),
                (0.575, -0.23, by, 0.18, 0.028),
            ], leather, 12)
        back_sections = [
            (0.48, -0.455, y, 0.060, 0.212),
            (0.59, -0.474, y, 0.070, 0.231),
            (0.89, -0.540, y, 0.069, 0.225),
            (1.025, -0.574, y, 0.046, 0.177),
            (1.052, -0.580, y, 0.025, 0.136),
        ]
        loft(side + "_backrest_shell", back_sections, leather)
        def back_x(z):
            for lower, upper in zip(back_sections, back_sections[1:]):
                if lower[0] <= z <= upper[0]:
                    t = (z - lower[0]) / (upper[0] - lower[0])
                    return (lower[1] + lower[3]) * (1-t) + (upper[1] + upper[3]) * t + 0.004
            raise ValueError("Backrest point outside the upholstery")
        # The cloth is an inset surface following the inclination of the seat back.
        back_heights = (0.58, 0.59, 0.75, 0.89, 0.985)
        back_verts = [(back_x(z), y+offset, z) for z in back_heights for offset in (-0.135, 0.135)]
        mesh(side + "_backrest_insert", back_verts,
             [(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(back_heights)-1)], cloth)
        for side_sign in (-1, 1):
            by = y + side_sign * 0.183
            loft(side + "_backrest_bolster_" + str(side_sign), [
                (0.525, -0.406, by, 0.053, 0.043),
                (0.63, -0.426, by, 0.073, 0.052),
                (0.85, -0.48, by, 0.070, 0.054),
                (0.985, -0.535, y + side_sign * 0.168, 0.046, 0.041),
                (1.014, -0.551, y + side_sign * 0.160, 0.025, 0.025),
            ], leather, 12)
        # Original-looking red woven lines, explicitly modelled instead of decals.
        for offset in (-0.088, -0.044, 0, 0.044, 0.088):
            bevel_box(side + "_cushion_weave", (-0.192, y + offset, 0.543),
                      (0.398, 0.009, 0.002), red, 0)
            for z in (0.61, 0.655, 0.70, 0.745, 0.79, 0.835, 0.88, 0.925, 0.97):
                x = back_x(z) + 0.002
                bevel_box(side + "_backrest_weave", (x, y + offset, z),
                          (0.002, 0.009, 0.023), red, 0,
                          rot=(0, math.radians(-15.7), 0))
        for offset in (-0.082, 0.082):
            rod(side + "_headrest_stay", (-0.580, y + offset, 1.027),
                (-0.595, y + offset, 1.12), 0.009, silver, 8)
        bevel_box(side + "_headrest", (-0.605, y, 1.128),
                  (0.113, 0.29, 0.113), leather, 0.038,
                  rot=(0, math.radians(-8), 0))
        bevel_box(side + "_buckle", (-0.27, y - math.copysign(0.254, y), 0.50),
                  (0.048, 0.035, 0.075), leather, 0.009)
        bevel_box(side + "_buckle_button", (-0.269, y - math.copysign(0.254, y), 0.539),
                  (0.028, 0.023, 0.005), red, 0.002)

    # Rear bench, parcel shelf and period red patterned inserts.
    bevel_box("rear_bench_base", (-1.025, 0, 0.48), (0.42, 1.17, 0.16), leather, 0.052)
    bevel_box("rear_bench_back", (-1.285, 0, 0.77), (0.13, 1.14, 0.48), leather,
              0.047, rot=(0, math.radians(-9), 0))
    for y in (-0.31, 0.31):
        bevel_box("rear_bench_cloth", (-1.015, y, 0.564), (0.35, 0.40, 0.018), cloth, 0.008)
        bevel_box("rear_back_cloth", (-1.203, y, 0.79), (0.014, 0.40, 0.32), cloth,
                  0.006, rot=(0, math.radians(-9), 0))
        for off in (-0.13, -0.065, 0, 0.065, 0.13):
            bevel_box("rear_cushion_stripe", (-1.017, y + off, 0.575),
                      (0.326, 0.009, 0.002), red, 0)
            rod("rear_back_stripe", (-1.170, y + off, 0.65),
                (-1.215, y + off, 0.935), 0.0035, red, 6)
    bevel_box("parcel_shelf", (-1.46, 0, 0.93), (0.38, 1.12, 0.028), carpet, 0.012)

    # The faceted sloping fascia and instrument hood evoke the post-1987 dashboard.
    dash_profile = [(0.38, 0.65), (0.47, 0.65), (0.70, 0.72),
                    (0.73, 0.82), (0.68, 0.875), (0.44, 0.858), (0.38, 0.81)]
    dash_verts = [(x, y, z) for y in (-0.63, 0.63) for x, z in dash_profile]
    n = len(dash_profile)
    dash_faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    dash_faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    obj = mesh("dashboard_shell", dash_verts, dash_faces, plastic)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mod = obj.modifiers.new("Fascia edge radii", "BEVEL")
    mod.width, mod.segments = 0.012, 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    bevel_box("instrument_binnacle", (0.45, 0.34, 0.804), (0.16, 0.40, 0.158), plastic, 0.019)
    bevel_box("instrument_face", (0.363, 0.34, 0.799), (0.008, 0.365, 0.124), dial, 0.009)
    for j, y in enumerate((0.245, 0.435)):
        disk("instrument_rim", 0.357, y, 0.801, 0.055, silver)
        disk("instrument_dial", 0.355, y, 0.801, 0.0525, dial)
        for i in range(15):
            a = math.radians(-45 + i * 270 / 14)
            r0, r1 = (0.039, 0.048) if i % 2 == 0 else (0.044, 0.048)
            rod("instrument_tick", (0.353, y + r0 * math.cos(a), 0.801 + r0 * math.sin(a)),
                (0.353, y + r1 * math.cos(a), 0.801 + r1 * math.sin(a)),
                0.001, ivory, 4)
        a = math.radians(200 if j == 0 else 120)
        rod("instrument_needle", (0.349, y, 0.801),
            (0.349, y + 0.040 * math.cos(a), 0.801 + 0.040 * math.sin(a)),
            0.0012, orange, 6)
        disk("instrument_hub", 0.347, y, 0.801, 0.004, leather, 12)
        bevel_box("instrument_odometer", (0.348, y, 0.780), (0.003, 0.034, 0.010), ivory, 0.001)
        for off in (-0.011, -0.004, 0.004, 0.011):
            bevel_box("instrument_odometer_digit", (0.346, y+off, 0.780),
                      (0.001, 0.0035, 0.006), dial, 0)
    # Two centre air vents with actual louvers, stereo and manual heater controls.
    for y in (-0.056, 0.066, -0.545, 0.545):
        bevel_box("air_vent_recess", (0.372, y, 0.790), (0.016, 0.094, 0.052), dial, 0.006)
        for z in (0.773, 0.784, 0.795, 0.806):
            bevel_box("air_vent_louver", (0.360, y, z), (0.008, 0.083, 0.0028), plastic, 0.0008)
    bevel_box("centre_stack", (0.366, -0.025, 0.659), (0.08, 0.225, 0.16), plastic, 0.012)
    bevel_box("radio", (0.320, -0.025, 0.695), (0.013, 0.196, 0.038), dial, 0.004)
    bevel_box("radio_display", (0.312, -0.027, 0.701), (0.002, 0.09, 0.012), cloth, 0.001)
    for y in (-0.112, 0.062):
        rod("radio_dial", (0.310, y, 0.694), (0.300, y, 0.694), 0.011, leather, 12)
    for y in (-0.090, -0.025, 0.040):
        rod("heater_control", (0.318, y, 0.639), (0.302, y, 0.639), 0.016, leather, 16)
        bevel_box("heater_control_mark", (0.299, y, 0.650), (0.002, 0.002, 0.007), ivory, 0)
    bevel_box("glovebox_seam", (0.376, -0.372, 0.733), (0.002, 0.322, 0.0025), dial, 0)
    bevel_box("glovebox_handle", (0.367, -0.372, 0.749), (0.020, 0.074, 0.016), leather, 0.004)

    # Steering wheel in its own pivot, ready to animate independently.
    steering = bpy.data.objects.new("steering_wheel", None)
    bpy.context.collection.objects.link(steering)
    steering.parent = parent
    steering.location = (0.26, 0.34, 0.84)
    # local x=right, local y=up, local z=towards the driver (rear and slightly up).
    normal = Vector((-1, 0, 0.28)).normalized()
    up = Vector((0.28, 0, 1)).normalized()
    right = Vector((0, -1, 0))
    steering.rotation_euler = Matrix((right, up, normal)).transposed().to_euler()
    steering["axis_blender"] = "Z"
    steering["axis_gltf"] = "Y"
    steering["radius_m"] = 0.17
    created.append(steering)
    verts, faces = [], []
    major, minor = 56, 8
    for i in range(major):
        a = i * math.tau / major
        for j in range(minor):
            b = j * math.tau / minor
            r = 0.1535 + 0.0165 * math.cos(b)
            verts.append((r * math.cos(a), r * math.sin(a), 0.0165 * math.sin(b)))
    for i in range(major):
        for j in range(minor):
            faces.append((i*minor+j, ((i+1)%major)*minor+j,
                          ((i+1)%major)*minor+(j+1)%minor, i*minor+(j+1)%minor))
    mesh("steering_rim", verts, faces, leather, steering, True)
    # Wide factory-style moulded spokes, no holes or shiny aftermarket metal.
    for angle in (0, math.pi, -math.pi/2):
        points = [(0.037, -0.026), (0.149, -0.019), (0.149, 0.019), (0.037, 0.026)]
        vertices = []
        for z in (-0.009, 0.009):
            vertices += [(x*math.cos(angle)-y*math.sin(angle),
                          x*math.sin(angle)+y*math.cos(angle), z) for x,y in points]
        mesh("steering_spoke", vertices, [(3,2,1,0),(4,5,6,7),(0,1,5,4),
                                           (1,2,6,5),(2,3,7,6),(3,0,4,7)], leather, steering)
    bevel_box("steering_horn_pad", (0, -0.006, 0.013), (0.120, 0.089, 0.045),
              leather, 0.018, steering)
    bevel_box("steering_horn_inlay", (0, -0.006, 0.037), (0.054, 0.017, 0.002),
              plastic, 0.003, steering)
    rod("steering_column", (0.294, 0.34, 0.830), (0.469, 0.34, 0.782), 0.025, leather, 16)
    rod("indicator_stalk", (0.355, 0.375, 0.817), (0.330, 0.485, 0.830), 0.006, plastic)
    bevel_box("indicator_stalk_tip", (0.330, 0.485, 0.830), (0.037, 0.035, 0.023), plastic, 0.008)
    rod("wiper_stalk", (0.355, 0.305, 0.817), (0.330, 0.205, 0.830), 0.006, plastic)

    # Five-speed gear lever, concertina boot and mechanical hand brake.
    for k in range(5):
        bevel_box("gear_lever_boot", (0.005, 0, 0.449 + 0.011*k),
                  (0.115-0.014*k, 0.100-0.012*k, 0.014), leather, 0.010)
    rod("gear_lever_shaft", (0.005, 0, 0.494), (-0.035, 0, 0.641), 0.010, leather, 12)
    bevel_box("gear_knob", (-0.041, 0, 0.653), (0.051, 0.046, 0.055), leather, 0.018)
    bevel_box("gear_knob_cap", (-0.041, 0, 0.680), (0.026, 0.026, 0.002), plastic, 0.007)
    rod("handbrake_lever", (-0.40, -0.055, 0.424), (-0.18, -0.055, 0.475), 0.016, leather, 12)
    rod("handbrake_button", (-0.18, -0.055, 0.475), (-0.168, -0.055, 0.478), 0.009, silver, 10)
    for y in (0.23, 0.33, 0.43):
        rod("pedal_arm", (0.54, y, 0.56), (0.48, y, 0.412), 0.006, silver, 6)
        bevel_box("pedal_pad", (0.47, y, 0.421), (0.018, 0.048, 0.068), leather,
                  0.005, rot=(0, math.radians(-14), 0))

    # Door cards stay below the beltline and clear the bucket seats.
    for side in (-1, 1):
        y = side * 0.633
        bevel_box("door_card", (-0.025, y, 0.631), (1.13, 0.035, 0.43), plastic, 0.025)
        bevel_box("door_insert", (-0.03, y-side*0.021, 0.653), (0.86, 0.012, 0.19), cloth, 0.016)
        bevel_box("door_weave", (-0.03, y-side*0.029, 0.654), (0.79, 0.003, 0.018), red, 0.002)
        bevel_box("door_armrest", (0.022, y-side*0.043, 0.581), (0.30, 0.080, 0.051), leather, 0.014)
        bevel_box("door_handle_recess", (0.275, y-side*0.025, 0.715), (0.105, 0.014, 0.047), dial, 0.009)
        bevel_box("door_latch", (0.273, y-side*0.035, 0.713), (0.071, 0.014, 0.017), plastic, 0.004)
        bevel_box("door_pocket", (-0.03, y-side*0.04, 0.454), (0.68, 0.066, 0.078), leather, 0.012)
        # B-pillar belts: narrow visible cloth strips following the pillar.
        belt_y = side * 0.599
        bevel_box("seatbelt", (-0.623, belt_y, 0.8035), (0.024, 0.003, 0.687), carpet, 0)
        bevel_box("seatbelt_anchor", (-0.622, belt_y, 1.139), (0.043,0.023,0.037), plastic,0.007)

    # Merge by material and parent: many small details, few export nodes.
    groups = {}
    for obj in created:
        if obj.type == "MESH":
            groups.setdefault((obj.parent, obj.data.materials[0]), []).append(obj)
    merged = []
    bpy.ops.object.select_all(action="DESELECT")
    for (owner, mat), objects in groups.items():
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = ("cabin_steering_" if owner == steering else "cabin_") + mat.name.removeprefix("cabin_")
        obj.select_set(False)
        merged.append(obj)
    return {"objects": merged + [steering], "steering_wheel": steering}
