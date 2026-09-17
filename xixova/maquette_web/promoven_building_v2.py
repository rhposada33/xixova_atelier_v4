"""Build the independent, illustrative Promoven marketing tower in Blender.

Send this source directly to Blender MCP's execute_blender_code tool.
Nothing in this file touches Xixova's building model or inventory.
"""

import math
import random
import bpy
from mathutils import Vector


ROOT = "/home/rafa/RenderCasa/xixova_atelier_v4/xixova/maquette_web"
OUTPUT = ROOT + "/public/building/promoven-building-v2.glb"
POSTER = ROOT + "/public/marketing/promoven-building-v2.png"
BLEND = ROOT + "/assets/promoven/promoven-building-v2.blend"

scene = bpy.data.scenes.new("PROMOVEN_BUILDING_V2")
bpy.context.window.scene = scene
for older in list(bpy.data.scenes):
    if older is not scene and older.name.startswith("PROMOVEN_BUILDING_V2"):
        bpy.data.scenes.remove(older)
scene.name = "PROMOVEN_BUILDING_V2"
if bpy.app.background:
    for other in list(bpy.data.scenes):
        if other is not scene:
            bpy.data.scenes.remove(other)
random.seed(33)


def material(name, color, *, metal=0, rough=0.65, alpha=1, emission=0):
    mat = bpy.data.materials.new("Promoven | " + name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Alpha"].default_value = alpha
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = emission
    if alpha < 1:
        mat.surface_render_method = "DITHERED"
        mat.use_transparency_overlap = False
    return mat


M = {
    "stone": material("warm limestone", (0.71, 0.68, 0.60)),
    "stone_light": material("light facade", (0.84, 0.81, 0.73)),
    "stone_dark": material("recessed stone", (0.31, 0.32, 0.28)),
    "bronze": material("bronze frames", (0.12, 0.13, 0.11), metal=0.66, rough=0.26),
    "bronze_light": material("sunlit bronze", (0.37, 0.28, 0.18), metal=0.58, rough=0.34),
    "glass": material("smoky reflective glass", (0.055, 0.10, 0.09), metal=0.28, rough=0.09, alpha=.34),
    "glass_light": material("window reflection", (0.16, 0.23, 0.22), metal=0.25, rough=0.11, alpha=.42),
    "glass_rail": material("balcony glass", (0.23, 0.35, 0.32), metal=0.15, rough=0.1, alpha=0.42),
    "interior": material("warm interior", (0.82, 0.52, 0.26), emission=0.4),
    "soil": material("planter soil", (0.19, 0.17, 0.13)),
    "leaf": material("deep green foliage", (0.16, 0.29, 0.16), rough=0.9),
    "leaf2": material("sage foliage", (0.29, 0.39, 0.23), rough=0.9),
    "leaf3": material("olive foliage", (0.36, 0.39, 0.21), rough=0.9),
    "trunk": material("tree bark", (0.26, 0.21, 0.15)),
    "paving": material("paving", (0.65, 0.63, 0.56)),
    "room": material("varied furnished rooms", (1, 1, 1), rough=.52),
    "canopy": material("photographic tree foliage", (1, 1, 1), rough=.86, alpha=.99),
}

# A CC0 Poly Haven concrete scan, warmed for the illustrative facade.
concrete = bpy.data.images.load(ROOT + "/assets/promoven/warm_concrete_1k.jpg", check_existing=True)
concrete.reload()
normal_image = bpy.data.images.load(ROOT + "/assets/promoven/brushed_concrete_nor_gl_1k.jpg", check_existing=True)
normal_image.colorspace_settings.name = "Non-Color"
rough_image = bpy.data.images.load(ROOT + "/assets/promoven/brushed_concrete_rough_1k.jpg", check_existing=True)
rough_image.colorspace_settings.name = "Non-Color"
for key in ("stone", "stone_light"):
    nodes = M[key].node_tree.nodes
    shader = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = concrete
    M[key].node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
    rough_node = nodes.new("ShaderNodeTexImage")
    rough_node.image = rough_image
    M[key].node_tree.links.new(rough_node.outputs["Color"], shader.inputs["Roughness"])
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.image = normal_image
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = .48
    M[key].node_tree.links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    M[key].node_tree.links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
room_image = bpy.data.images.load(ROOT + "/assets/promoven/window-atlas-optimized.jpg", check_existing=True)
room_shader = next(node for node in M["room"].node_tree.nodes if node.type == "BSDF_PRINCIPLED")
room_node = M["room"].node_tree.nodes.new("ShaderNodeTexImage")
room_node.image = room_image
M["room"].node_tree.links.new(room_node.outputs["Color"], room_shader.inputs["Base Color"])
canopy_image = bpy.data.images.load(ROOT + "/assets/promoven/tree-canopy-optimized.png", check_existing=True)
canopy_shader = next(node for node in M["canopy"].node_tree.nodes if node.type == "BSDF_PRINCIPLED")
canopy_node = M["canopy"].node_tree.nodes.new("ShaderNodeTexImage")
canopy_node.image = canopy_image
M["canopy"].node_tree.links.new(canopy_node.outputs["Color"], canopy_shader.inputs["Base Color"])
M["canopy"].node_tree.links.new(canopy_node.outputs["Alpha"], canopy_shader.inputs["Alpha"])

parts = {key: ([], []) for key in M}
room_vertices, room_faces, room_uvs = [], [], []
canopy_vertices, canopy_faces, canopy_uvs = [], [], []


def room_panel(x, y, z, width, height, variant, rear=False):
    base = len(room_vertices)
    room_vertices.extend(((x-width/2, y, z-height/2), (x+width/2, y, z-height/2),
                          (x+width/2, y, z+height/2), (x-width/2, y, z+height/2)))
    # The rear facade faces +Y, so its textured quad needs the opposite winding.
    room_faces.append((base+3, base+2, base+1, base) if rear else
                      (base, base+1, base+2, base+3))
    left = .006 + (variant % 2)*.5
    right = .494 + (variant % 2)*.5
    bottom = .506 if variant < 2 else .006
    top = .994 if variant < 2 else .494
    room_uvs.extend(((left, bottom), (right, bottom), (right, top), (left, top)))


def foliage_card(x, y, z, width, height, angle):
    base = len(canopy_vertices)
    dx = math.cos(angle)*width/2
    dy = math.sin(angle)*width/2
    canopy_vertices.extend(((x-dx, y-dy, z-height/2), (x+dx, y+dy, z-height/2),
                            (x+dx, y+dy, z+height/2), (x-dx, y-dy, z+height/2)))
    canopy_faces.append((base, base+1, base+2, base+3))
    canopy_uvs.extend(((0, 0), (1, 0), (1, 1), (0, 1)))


def box(mat, center, size):
    x, y, z = center
    w, d, h = size
    v, f = parts[mat]
    base = len(v)
    for dx, dy, dz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                       (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)):
        v.append((x + dx*w/2, y + dy*d/2, z + dz*h/2))
    for face in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                 (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        f.append(tuple(base + n for n in face))


def canopy(mat, center, radius):
    cx, cy, cz = center
    verts, faces = parts[mat]
    base = len(verts)
    rings, segments = 5, 9
    for row in range(rings + 1):
        phi = math.pi * row / rings
        for col in range(segments):
            theta = 2 * math.pi * col / segments
            distortion = 0.92 + 0.12 * random.random()
            verts.append((cx + math.sin(phi)*math.cos(theta)*radius*distortion,
                          cy + math.sin(phi)*math.sin(theta)*radius*distortion,
                          cz + math.cos(phi)*radius*0.78*distortion))
    for row in range(rings):
        for col in range(segments):
            a = base + row*segments + col
            b = base + row*segments + (col+1)%segments
            faces.append((a, b, b+segments, a+segments))


def shrub(x, y, z, scale=1):
    box("trunk", (x, y, z+0.26*scale), (0.06*scale, 0.06*scale, 0.52*scale))
    for ox, oy, oz, size in ((0, 0, .58, .38), (-.23, .06, .51, .27),
                             (.21, -.09, .49, .27), (.04, .19, .75, .25)):
        canopy(random.choice(("leaf", "leaf2", "leaf3")),
               (x+ox*scale, y+oy*scale, z+oz*scale), size*scale)


def tree(x, y, z, scale=1):
    box("trunk", (x, y, z+1.0*scale), (.13*scale, .13*scale, 2*scale))
    for angle in (0, math.pi/3, 2*math.pi/3):
        foliage_card(x, y, z+2.67*scale, 3.3*scale, 2.45*scale, angle)


# Architectural mass: a broad, detailed podium supports a slender residential tower.
box("paving", (0, 0, -.19), (24, 20, .38))
box("stone", (0, 0, 2.2), (17.8, 13.8, 4.4))
box("stone_light", (0, 0, 4.48), (18.2, 14.2, .3))
box("stone_dark", (0, -7.02, 2.1), (14.9, .14, 3.2))
box("stone_dark", (0, 7.02, 2.1), (14.9, .14, 3.2))
for facing in (-1, 1):
    for x in (-7.6, -4.9, -2.2, 2.2, 4.9, 7.6):
        box("stone_light", (x, facing*7.18, 2.25), (.48, .4, 4.15))
    for x in (-6.1, -3.5, 0, 3.5, 6.1):
        box("glass", (x, facing*7.13, 2.05), (2.1, .08, 2.9))
        box("bronze", (x, facing*7.23, 3.6), (2.15, .12, .09))
    box("bronze_light", (0, facing*7.47, 4.18), (8.2, 1.3, .23))

tower_base = 4.64
floors = 15
floor_h = 2.78
tower_h = floors*floor_h
box("stone_dark", (0, .15, tower_base+tower_h/2), (13.4, 9.55, tower_h))
box("stone_light", (-6.22, -.4, tower_base+tower_h/2), (1.05, 10.8, tower_h+.1))
box("stone_light", (6.22, -.4, tower_base+tower_h/2), (1.05, 10.8, tower_h+.1))
for facing in (-1, 1):
    for x in (-6.25, -3.1, 0, 3.1, 6.25):
        box("stone_light", (x, facing*5.82, tower_base+tower_h/2), (.43, 1.36, tower_h+.15))
        box("stone_dark", (x+.24, facing*5.85, tower_base+tower_h/2), (.055, 1.2, tower_h))

for floor in range(floors):
    z = tower_base + floor*floor_h
    box("stone_light", (0, -.16, z+.08), (13.85, 10.7, .25))
    for facing in (-1, 1):
        box("stone", (0, facing*5.44, z+.14), (13.6, .4, .31))
        box("stone_light", (0, facing*5.12, z+floor_h-.11), (13.9, .78, .26))
        for bay, x in enumerate((-4.65, -1.54, 1.54, 4.65)):
            # Both long elevations have the same recessed rooms and balconies.
            room_panel(x, facing*5.16, z+1.36, 2.5, 2.12,
                       (floor*3+bay+(2 if facing > 0 else 0))%4, rear=facing > 0)
            box("glass" if (floor+bay)%3 else "glass_light",
                (x, facing*5.35, z+1.38), (2.47, .045, 2.19))
            box("bronze", (x, facing*5.4, z+1.38), (.06, .08, 2.24))
            box("bronze", (x, facing*5.42, z+1.48), (2.5, .075, .055))
            box("stone", (x, facing*6.04, z+.24), (2.94, 1.46, .18))
            box("glass_rail", (x, facing*6.77, z+.83), (2.88, .075, 1.12))
            box("bronze", (x, facing*6.82, z+1.39), (2.93, .07, .055))
            box("bronze_light", (x, facing*6.79, z+.32), (2.91, .09, .055))
            for edge in (x-1.46, x+1.46):
                box("bronze", (edge, facing*6.75, z+.82), (.046, .075, 1.15))
            if (floor*3+bay)%4 == 0:
                box("soil", (x+.94, facing*6.15, z+.38), (.45, .56, .26))
                shrub(x+.94, facing*6.15, z+.5, .36)
        for edge in (-3.1, 0, 3.1):
            box("stone_light", (edge, facing*5.48, z+floor_h/2), (.27, .93, floor_h))
    # Side elevations get window rhythm and a few shallow balconies.
    for side in (-1, 1):
        x = side*6.77
        for y in (-3.45, -.4, 2.65):
            box("glass", (x, y, z+1.42), (.06, 1.85, 1.91))
            box("bronze", (x+side*.04, y, z+1.42), (.09, .06, 1.94))
            if y in (-3.45, -.4) and floor%2 == 0:
                box("stone", (x+side*.55, y, z+.22), (1.1, 2.1, .18))
                box("glass_rail", (x+side*1.08, y, z+.78), (.06, 2.06, 1.04))
                box("bronze", (x+side*1.12, y, z+1.31), (.07, 2.07, .06))

roof = tower_base+tower_h
box("stone_light", (0, -.25, roof+.12), (14.6, 11.15, .4))
box("stone", (0, -.25, roof+.73), (14.0, 10.5, .95))
for x in (-6.9, 6.9):
    box("bronze", (x, -.25, roof+1.28), (.12, 10.5, .72))
for x in (-4.5, -1.5, 1.5, 4.5):
    box("soil", (x, -4.3, roof+1.27), (2.4, .75, .4))
    for dx in (-.64, 0, .65):
        shrub(x+dx, -4.3, roof+1.48, .58)
for x, y in ((-5, 2), (5, 2), (-3, 3.4), (3, 3.4)):
    tree(x, y, roof+1.2, 1.03)

# Planted podium and entrance. Keep surroundings illustrative and compact.
for facing in (-1, 1):
    for x in (-8.5, 8.5):
        box("stone_light", (x, facing*6.4, 4.68), (1.0, 2.6, .45))
        box("soil", (x, facing*6.4, 4.96), (.8, 2.3, .16))
        for y in (5.7, 6.4, 7.1):
            shrub(x, facing*y, 5.04, .47)
    for x in (-10.4, -8.9, 8.9, 10.4):
        box("stone_light", (x, facing*8.05, .18), (1.2, 3.25, .38))
        box("soil", (x, facing*8.05, .41), (1.0, 2.95, .18))
        for y in (7.4, 8.2, 9.0):
            shrub(x, facing*y, .49, .72)
for x, y, scale in ((-9.3, -3, 1.95), (9.2, -2.2, 1.85), (-10.2, 4.1, 1.5), (10, 5, 1.55)):
    tree(x, y, .1, scale)
for facing in (-1, 1):
    for step in range(4):
        box("stone_light", (0, facing*(7.6+step*.62), .30-step*.065),
            (4.4+step*.4, .62, .15))

for name, (verts, faces) in parts.items():
    if name in ("room", "canopy"):
        continue
    if not verts:
        continue
    mesh = bpy.data.meshes.new("Promoven " + name)
    mesh.from_pydata(verts, [], faces)
    for vertex in mesh.vertices:
        vertex.co.x *= 2.25
        vertex.co.y *= 1.08
    uv = mesh.uv_layers.new(name="Facade UV")
    for polygon in mesh.polygons:
        normal = polygon.normal
        for loop_index in polygon.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if abs(normal.z) > .7:
                uv.data[loop_index].uv = (co.x/2.8, co.y/2.8)
            elif abs(normal.y) > .7:
                uv.data[loop_index].uv = (co.x/2.8, co.z/2.8)
            else:
                uv.data[loop_index].uv = (co.y/2.8, co.z/2.8)
    mesh.materials.append(M[name])
    mesh.update()
    obj = bpy.data.objects.new("Promoven | " + name, mesh)
    scene.collection.objects.link(obj)

room_mesh = bpy.data.meshes.new("Promoven furnished window atlas")
room_mesh.from_pydata(room_vertices, [], room_faces)
for vertex in room_mesh.vertices:
    vertex.co.x *= 2.25
    vertex.co.y *= 1.08
room_layer = room_mesh.uv_layers.new(name="Room atlas UV")
for index, coords in enumerate(room_uvs):
    room_layer.data[index].uv = coords
room_mesh.materials.append(M["room"])
room_mesh.update()
room_object = bpy.data.objects.new("Promoven | furnished rooms", room_mesh)
scene.collection.objects.link(room_object)

canopy_mesh = bpy.data.meshes.new("Promoven foliage cards")
canopy_mesh.from_pydata(canopy_vertices, [], canopy_faces)
for vertex in canopy_mesh.vertices:
    vertex.co.x *= 2.25
    vertex.co.y *= 1.08
canopy_layer = canopy_mesh.uv_layers.new(name="Foliage UV")
for index, coords in enumerate(canopy_uvs):
    canopy_layer.data[index].uv = coords
canopy_mesh.materials.append(M["canopy"])
canopy_mesh.update()
canopy_object = bpy.data.objects.new("Promoven | detailed tree canopies", canopy_mesh)
scene.collection.objects.link(canopy_object)

# Presentation-only objects are excluded from the GLB export.
world = bpy.data.worlds.new("Promoven warm daylight")
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs["Color"].default_value = (0.94, .88, .79, 1)
background.inputs["Strength"].default_value = .65
scene.world = world

light_data = bpy.data.lights.new("Promoven late afternoon", "AREA")
light = bpy.data.objects.new("Promoven late afternoon", light_data)
scene.collection.objects.link(light)
light.location = (-25, -25, 65)
light_data.energy = 3900
light_data.shape = "DISK"
light_data.size = 18
light.rotation_euler = (Vector((0, 0, 23))-light.location).to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("Promoven hero camera")
camera = bpy.data.objects.new("Promoven hero camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (30, -49, 24)
camera.rotation_euler = (Vector((0, 0, 24))-camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 67
scene.camera = camera

scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 920
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(POSTER)
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.color_mode = "RGBA"

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), copy=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", use_active_scene=True,
                          export_cameras=False, export_lights=False, export_apply=True)
bpy.ops.render.render(write_still=True)
print(f"PROMOVEN_READY objects={len(scene.objects)} glb={OUTPUT} poster={POSTER} blend={BLEND}")
