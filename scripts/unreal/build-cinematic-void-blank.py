import unreal

MAP_PATH = "/Game/Levels/Universe_01"
TEXTURE_SOURCE = r"C:\Users\princ\Documents\jarvis\docs\unreal\reference\gauntlet-void-plate.png"
TEXTURE_DIR = "/Game/JarvisGauntlet/Textures"
MATERIAL_DIR = "/Game/JarvisGauntlet/Materials"
TEXTURE_ASSET = f"{TEXTURE_DIR}/T_GauntletVoidPlate"
MATERIAL_ASSET = f"{MATERIAL_DIR}/M_GauntletVoidPlate"


def try_set_editor_property(target, property_name, value):
    try:
        target.set_editor_property(property_name, value)
        return True
    except Exception:
        return False


def look_at_rotation(origin, target):
    return unreal.MathLibrary.find_look_at_rotation(origin, target)


def make_rotator(pitch=0.0, yaw=0.0, roll=0.0):
    rotator = unreal.Rotator()
    rotator.set_editor_property("pitch", pitch)
    rotator.set_editor_property("yaw", yaw)
    rotator.set_editor_property("roll", roll)
    return rotator


asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
unreal.EditorAssetLibrary.make_directory(TEXTURE_DIR)
unreal.EditorAssetLibrary.make_directory(MATERIAL_DIR)

if unreal.EditorAssetLibrary.does_asset_exist(MATERIAL_ASSET):
    unreal.EditorAssetLibrary.delete_asset(MATERIAL_ASSET)

if not unreal.EditorAssetLibrary.does_asset_exist(TEXTURE_ASSET):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", TEXTURE_SOURCE)
    task.set_editor_property("destination_path", TEXTURE_DIR)
    task.set_editor_property("destination_name", "T_GauntletVoidPlate")
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("automated", True)
    task.set_editor_property("save", True)
    asset_tools.import_asset_tasks([task])

plate_texture = unreal.load_asset(TEXTURE_ASSET)
if not plate_texture:
    raise RuntimeError(f"Unable to import {TEXTURE_SOURCE}")

try_set_editor_property(plate_texture, "mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
try_set_editor_property(plate_texture, "compression_settings", unreal.TextureCompressionSettings.TC_DEFAULT)
try_set_editor_property(plate_texture, "adjust_brightness", 2.8)
try_set_editor_property(plate_texture, "adjust_saturation", 1.12)
unreal.EditorAssetLibrary.save_loaded_asset(plate_texture)

material_factory = unreal.MaterialFactoryNew()
plate_material = asset_tools.create_asset(
    "M_GauntletVoidPlate",
    MATERIAL_DIR,
    unreal.Material,
    material_factory,
)
try_set_editor_property(plate_material, "two_sided", True)
try_set_editor_property(plate_material, "shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
texture_sample = unreal.MaterialEditingLibrary.create_material_expression(
    plate_material,
    unreal.MaterialExpressionTextureSample,
    -400,
    0,
)
texture_sample.set_editor_property("texture", plate_texture)
unreal.MaterialEditingLibrary.connect_material_property(
    texture_sample,
    "RGB",
    unreal.MaterialProperty.MP_EMISSIVE_COLOR,
)
unreal.MaterialEditingLibrary.recompile_material(plate_material)
unreal.EditorAssetLibrary.save_loaded_asset(plate_material)

if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    unreal.EditorAssetLibrary.delete_asset(MAP_PATH)

if not unreal.EditorLevelLibrary.new_level(MAP_PATH):
    raise RuntimeError(f"Unable to create blank map at {MAP_PATH}")

plane_mesh = unreal.load_asset("/Engine/BasicShapes/Plane.Plane")
if not plane_mesh:
    raise RuntimeError("Unable to load built-in plane mesh")

plate_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.StaticMeshActor,
    unreal.Vector(60000.0, 0.0, 0.0),
    make_rotator(pitch=90.0),
)
plate_actor.set_actor_label("GAUNTLET_Cinematic_Void_Reference_Plate")
plate_actor.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("CinematicVoid"), unreal.Name("ReadOnlyVisual")])
plate_component = plate_actor.get_component_by_class(unreal.StaticMeshComponent)
plate_component.set_static_mesh(plane_mesh)
plate_component.set_material(0, plate_material)
plate_component.set_editor_property("cast_shadow", False)
plate_actor.set_actor_scale3d(unreal.Vector(1463.0, 2600.0, 1.0))

camera_location = unreal.Vector(-38000.0, 0.0, 0.0)
camera_target = unreal.Vector(60000.0, 0.0, 0.0)
camera_rotation = look_at_rotation(camera_location, camera_target)
camera_class = getattr(unreal, "CineCameraActor", unreal.CameraActor)
camera = unreal.EditorLevelLibrary.spawn_actor_from_class(camera_class, camera_location, camera_rotation)
camera.set_actor_label("GAUNTLET_Overview_Camera")
camera.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseCamera"), unreal.Name("CineCamera")])
camera_component = camera.get_editor_property("camera_component")
if camera_component:
    try_set_editor_property(camera_component, "field_of_view", 70.0)
    try_set_editor_property(camera_component, "current_focal_length", 28.0)
    try_set_editor_property(camera_component, "current_aperture", 3.2)
    try_set_editor_property(camera_component, "manual_focus_distance", 72000.0)

player_start = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PlayerStart, camera_location, camera_rotation)
player_start.set_actor_label("GAUNTLET_Viewport_PlayerStart")
player_start.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseViewportStart")])

post_process = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.PostProcessVolume,
    unreal.Vector(0.0, 0.0, 0.0),
    make_rotator(),
)
post_process.set_actor_label("GAUNTLET_DarkVoid_PostProcess")
for unbound_property in ["b_unbound", "unbound"]:
    if try_set_editor_property(post_process, unbound_property, True):
        break
post_process.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("DarkVoidMood")])
settings = post_process.get_editor_property("settings")
for property_name, value in [
    ("override_auto_exposure_bias", True),
    ("auto_exposure_bias", -0.15),
    ("override_auto_exposure_min_brightness", True),
    ("auto_exposure_min_brightness", 0.35),
    ("override_auto_exposure_max_brightness", True),
    ("auto_exposure_max_brightness", 1.0),
    ("override_bloom_intensity", True),
    ("bloom_intensity", 0.95),
    ("override_bloom_threshold", True),
    ("bloom_threshold", 0.08),
    ("override_vignette_intensity", True),
    ("vignette_intensity", 0.22),
    ("override_film_slope", True),
    ("film_slope", 0.96),
    ("override_film_toe", True),
    ("film_toe", 0.56),
]:
    try_set_editor_property(settings, property_name, value)

fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.ExponentialHeightFog,
    unreal.Vector(0.0, 0.0, -12000.0),
    make_rotator(),
)
fog.set_actor_label("GAUNTLET_Cinematic_Void_Fog")
fog_component = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
if fog_component:
    for property_name, value in [
        ("fog_density", 0.000002),
        ("fog_height_falloff", 0.18),
        ("fog_max_opacity", 0.08),
        ("start_distance", 10000.0),
        ("fog_in_scattering_color", unreal.LinearColor(0.02, 0.035, 0.08, 1.0)),
        ("volumetric_fog", True),
    ]:
        try_set_editor_property(fog_component, property_name, value)

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log("JARVIS cinematic blank-canvas void map updated.")
