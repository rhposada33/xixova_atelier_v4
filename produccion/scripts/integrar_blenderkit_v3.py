"""Reaplica la colocacion aprobada de activos BlenderKit ya descargados.

No descarga ni redistribuye activos. Debe ejecutarse sobre una copia que ya los
contenga; falla de forma explicita si falta alguno.
"""
import bpy


PLACEMENTS = {
    "Modern King Bed": ((5.849748, 2.242885, 0.0), (0, 0, 0), 0.828),
    "Modern King Bed - secundaria": ((10.179793, 2.351645, 0.0), (0, 0, 0), 0.68),
    "Toilet geberit selnova": ((8.591555, 2.570364, 0.000813), (0, 0, 0), 1.0),
    "Toilet geberit selnova - secundario": ((10.04, 4.84, 0.000813), (0, 0, 0), 1.0),
    "Modern Black Bathroom Faucet": ((8.2, 3.019734, 0.84), (0, 0, 0), 1.0),
    "Modern Black Bathroom Faucet - secundario": ((9.65, 5.5, 0.84), (0, 0, 0), 1.0),
    "Kitchen sink with faucet": ((0.256268, 4.636467, 0.925002), (0, 0, 1.570796), 0.78),
    "Electric oven": ((0.6618, 3.080001, 0.45304), (1.570796, 0, 1.570796), 1.0),
    "Refrigerator Consul CRM44": ((0.38, 2.020259, 0.00003), (0, 0, 0), 1.1),
}

HIDE_PREFIXES = (
    "XVA3_Cama_king_", "XVA3_Cama_doble_", "XVA3_wc_", "XVA3_tap_",
    "XVA3_sink", "XVA3_faucet", "XVA3_oven_", "XVA3_fridge",
)


def main():
    missing = [name for name in PLACEMENTS if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError("Faltan activos BlenderKit ya importados: " + ", ".join(missing))
    for name, (location, rotation, scale) in PLACEMENTS.items():
        obj = bpy.data.objects[name]
        obj.location = location
        obj.rotation_euler = rotation
        obj.scale = (scale,) * 3
        obj["xva_uniform_scale"] = scale
    for obj in bpy.data.objects:
        if obj.name.startswith(HIDE_PREFIXES):
            obj.hide_render = True
            obj.hide_viewport = True
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print(f"BLENDERKIT_INTEGRADO={len(PLACEMENTS)}")


if __name__ == "__main__":
    main()
