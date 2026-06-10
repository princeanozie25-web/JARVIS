import unreal

MAP_PATH = "/Game/Levels/Universe_01"
FOUNDATION_CLASS = "/Script/JarvisGauntlet.JarvisUniverseFoundationActor"


def look_at_rotation(origin, target):
    return unreal.MathLibrary.find_look_at_rotation(origin, target)


def try_set_editor_property(target, property_name, value):
    try:
        target.set_editor_property(property_name, value)
        return True
    except Exception:
        return False


if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    unreal.EditorAssetLibrary.delete_asset(MAP_PATH)

if not unreal.EditorLevelLibrary.new_level(MAP_PATH):
    raise RuntimeError(f"Unable to create blank map at {MAP_PATH}")

foundation_class = unreal.load_class(None, FOUNDATION_CLASS)
if not foundation_class:
    raise RuntimeError(f"Unable to load {FOUNDATION_CLASS}. Build the project before running this script.")

foundation = unreal.EditorLevelLibrary.spawn_actor_from_class(
    foundation_class,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0),
)
foundation.set_actor_label("GAUNTLET_UniverseFoundation_ReadOnly")
foundation.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseFoundation"), unreal.Name("ReadOnlyVisual")])

camera_location = unreal.Vector(0.0, -188000.0, 36000.0)
camera_rotation = look_at_rotation(camera_location, unreal.Vector(0.0, 5000.0, 0.0))
camera_class = getattr(unreal, "CineCameraActor", unreal.CameraActor)
camera = unreal.EditorLevelLibrary.spawn_actor_from_class(camera_class, camera_location, camera_rotation)
camera.set_actor_label("GAUNTLET_Overview_Camera")
camera.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseCamera")])
camera_component = camera.get_editor_property("camera_component")
if camera_component:
    try_set_editor_property(camera_component, "field_of_view", 78.0)
    try_set_editor_property(camera_component, "current_focal_length", 28.0)
    try_set_editor_property(camera_component, "current_aperture", 3.2)
    try_set_editor_property(camera_component, "manual_focus_distance", 188000.0)
    filmback = None
    try:
        filmback = camera_component.get_editor_property("filmback")
    except Exception:
        pass
    if filmback:
        try:
            filmback.sensor_width = 24.89
            filmback.sensor_height = 18.66
            camera_component.set_editor_property("filmback", filmback)
        except Exception:
            pass

player_start = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PlayerStart, camera_location, camera_rotation)
player_start.set_actor_label("GAUNTLET_Viewport_PlayerStart")
player_start.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseViewportStart")])

post_process = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.PostProcessVolume,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0),
)
post_process.set_actor_label("GAUNTLET_DarkVoid_PostProcess")
for unbound_property in ["b_unbound", "unbound"]:
    try:
        post_process.set_editor_property(unbound_property, True)
        break
    except Exception:
        continue
post_process.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("DarkVoidMood")])
post_process_settings = post_process.get_editor_property("settings")
for property_name, value in [
    ("override_auto_exposure_bias", True),
    ("auto_exposure_bias", -0.45),
    ("override_auto_exposure_min_brightness", True),
    ("auto_exposure_min_brightness", 0.08),
    ("override_auto_exposure_max_brightness", True),
    ("auto_exposure_max_brightness", 1.20),
    ("override_bloom_intensity", True),
    ("bloom_intensity", 3.15),
    ("override_bloom_threshold", True),
    ("bloom_threshold", 0.018),
    ("override_vignette_intensity", True),
    ("vignette_intensity", 0.36),
    ("override_scene_color_tint", True),
    ("scene_color_tint", unreal.LinearColor(0.76, 0.84, 1.0, 1.0)),
    ("override_film_slope", True),
    ("film_slope", 0.95),
    ("override_film_toe", True),
    ("film_toe", 0.72),
]:
    try_set_editor_property(post_process_settings, property_name, value)

sky_light = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyLight,
    unreal.Vector(0.0, 0.0, 12000.0),
    unreal.Rotator(0.0, 0.0, 0.0),
)
sky_light.set_actor_label("GAUNTLET_Minimal_SkyLight")
sky_light.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("DarkVoidLighting")])
sky_component = sky_light.get_component_by_class(unreal.SkyLightComponent)
if sky_component:
    sky_component.set_editor_property("intensity", 0.0)

fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.ExponentialHeightFog,
    unreal.Vector(0.0, 0.0, -28000.0),
    unreal.Rotator(0.0, 0.0, 0.0),
)
fog.set_actor_label("GAUNTLET_Volumetric_Void_Fog")
fog.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("VoidAtmosphere")])
fog_component = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
if fog_component:
    for property_name, value in [
        ("fog_density", 0.000006),
        ("fog_height_falloff", 0.18),
        ("fog_max_opacity", 0.16),
        ("start_distance", 35000.0),
        ("fog_in_scattering_color", unreal.LinearColor(0.015, 0.035, 0.09, 1.0)),
        ("volumetric_fog", True),
        ("volumetric_fog_scattering_distribution", 0.72),
        ("volumetric_fog_albedo", unreal.Color(28, 45, 78, 255)),
        ("volumetric_fog_emissive", unreal.LinearColor(0.0, 0.012, 0.035, 1.0)),
    ]:
        try_set_editor_property(fog_component, property_name, value)

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log("JARVIS Universe foundation map updated.")
