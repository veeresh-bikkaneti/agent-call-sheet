# make_models.py — build the Tactical Operations GLB models with Blender (headless).
# Usage: blender -b -P make_models.py -- <output_dir>
# Produces: container.glb (20ft corrugated container), crane.glb (gantry crane).
# Run from any directory; only bpy + stdlib are used. Exported Y-up, origin at ground center.
import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = argv[0]
os.makedirs(OUTDIR, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic=0.0, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    return m


def box(name, loc, dims, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if material:
        o.data.materials.append(material)
    if bevel > 0:
        mod = o.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def cylinder(name, loc, radius, depth, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if material:
        o.data.materials.append(material)
    mod = o.modifiers.new('bev', 'BEVEL')
    mod.width = 0.01
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def build_container():
    """20ft-style corrugated container. W=2.44 (x), L=6.06 (y), H=2.6 (z), base at z=0."""
    W, L, H = 2.44, 6.06, 2.6
    paint = mat('container_paint', (0.48, 0.25, 0.11), metallic=0.55, rough=0.5)
    dark = mat('container_dark', (0.15, 0.09, 0.05), metallic=0.4, rough=0.75)
    objs = []
    objs.append(box('floor', (0, 0, 0.06), (W, L, 0.12), dark, 0.02))
    objs.append(box('roof', (0, 0, H - 0.06), (W, L, 0.12), paint, 0.02))
    # corrugated long walls: inset panel + vertical ribs
    ribs = 18
    for side in (-1, 1):
        objs.append(box(f'wall_{side}', (side * (W / 2 - 0.04), 0, H / 2), (0.08, L, H), paint, 0.02))
        for i in range(ribs):
            y = -L / 2 + (i + 0.5) * (L / ribs)
            objs.append(box(f'rib_{side}_{i}', (side * (W / 2 + 0.01), y, H / 2),
                            (0.10, L / ribs * 0.5, H - 0.24), paint, 0.015))
    # plain front end (y = -L/2)
    objs.append(box('front', (0, -L / 2 + 0.04, H / 2), (W, 0.08, H), paint, 0.02))
    for i in range(6):
        x = -W / 2 + (i + 0.5) * (W / 6)
        objs.append(box(f'frib_{i}', (x, -L / 2 - 0.01, H / 2), (W / 6 * 0.5, 0.10, H - 0.24), paint, 0.015))
    # door end (y = +L/2): door slab + 4 locking rods + handles
    objs.append(box('door', (0, L / 2 - 0.04, H / 2), (W - 0.08, 0.08, H - 0.2), dark, 0.02))
    for i in range(4):
        x = -W / 2 + 0.35 + i * (W - 0.7) / 3
        objs.append(cylinder(f'rod_{i}', (x, L / 2 + 0.02, H / 2), 0.035, H - 0.6, dark))
        objs.append(box(f'handle_{i}', (x, L / 2 + 0.09, H * 0.45), (0.06, 0.08, 0.5), paint, 0.01))
    # corner castings
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(box(f'cast_{sx}_{sy}', (sx * (W / 2 - 0.05), sy * (L / 2 - 0.05), 0.12),
                            (0.2, 0.2, 0.24), dark, 0.02))
    return objs


def build_crane():
    """Gantry crane: two legs at x=+-4.6, beam along x at z=14.2, trolley, cable, hook."""
    steel = mat('crane_steel', (0.18, 0.18, 0.21), metallic=0.85, rough=0.35)
    accent = mat('crane_accent', (1.0, 0.55, 0.0), metallic=0.4, rough=0.5)
    objs = []
    for side in (-1, 1):
        objs.append(box(f'leg_{side}', (side * 4.6, 0, 7), (0.8, 0.8, 14), steel, 0.04))
        # cross braces between legs (X shape approximated by two rotated thin boxes)
        for zc in (3.5, 10.5):
            brace = box(f'brace_{side}_{zc}', (side * 2.3, 0, zc), (4.9, 0.12, 0.12), steel, 0.01)
            brace.rotation_euler[2] = math.radians(38 if side > 0 else -38)
    objs.append(box('beam', (0, 0, 14.2), (11.0, 1.2, 0.9), steel, 0.05))
    objs.append(box('beam_top', (0, 0, 14.85), (11.2, 1.4, 0.25), accent, 0.03))
    objs.append(box('trolley', (0, 0, 13.4), (1.6, 1.6, 1.1), accent, 0.06))
    objs.append(cylinder('cable', (0, 0, 10.8), 0.04, 5.0, steel))
    objs.append(box('hook_block', (0, 0, 8.2), (0.9, 0.9, 0.7), steel, 0.05))
    hook = cylinder('hook', (0, 0, 7.7), 0.16, 0.12, accent, rot=(math.pi / 2, 0, 0))
    objs.append(hook)
    # end stops
    for side in (-1, 1):
        objs.append(box(f'stop_{side}', (side * 5.4, 0, 14.2), (0.3, 1.2, 1.1), accent, 0.03))
    return objs


def export(objs, filename):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUTDIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True)
    print('EXPORTED', path, os.path.getsize(path), 'bytes')


reset()
export(build_container(), 'container.glb')
reset()
export(build_crane(), 'crane.glb')
print('DONE')
