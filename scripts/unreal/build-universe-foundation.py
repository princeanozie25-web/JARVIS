import unreal

MAP_PATH = "/Game/Levels/Universe_01"
FOUNDATION_CLASS = "/Script/JarvisGauntlet.JarvisUniverseFoundationActor"


def find_actor(label):
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if actor.get_actor_label() == label:
            return actor
    return None


def delete_if_exists(label):
    actor = find_actor(label)
    if actor:
        unreal.EditorLevelLibrary.destroy_actor(actor)


def look_at_rotation(origin, target):
    return unreal.MathLibrary.find_look_at_rotation(origin, target)


unreal.EditorLoadingAndSavingUtils.load_map(MAP_PATH)

for label in [
    "GAUNTLET_UniverseFoundation_ReadOnly",
    "GAUNTLET_Overview_Camera",
    "GAUNTLET_Viewport_PlayerStart",
    "GAUNTLET_DarkVoid_PostProcess",
    "GAUNTLET_Minimal_SkyLight",
]:
    delete_if_exists(label)

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

camera_location = unreal.Vector(-88000.0, -76000.0, 42000.0)
camera_rotation = look_at_rotation(camera_location, unreal.Vector(0.0, 0.0, 0.0))
camera = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CameraActor, camera_location, camera_rotation)
camera.set_actor_label("GAUNTLET_Overview_Camera")
camera.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("UniverseCamera")])
camera_component = camera.get_editor_property("camera_component")
camera_component.set_editor_property("field_of_view", 62.0)

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

sky_light = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyLight,
    unreal.Vector(0.0, 0.0, 12000.0),
    unreal.Rotator(0.0, 0.0, 0.0),
)
sky_light.set_actor_label("GAUNTLET_Minimal_SkyLight")
sky_light.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("DarkVoidLighting")])
sky_component = sky_light.get_component_by_class(unreal.SkyLightComponent)
if sky_component:
    sky_component.set_editor_property("intensity", 0.04)

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log("JARVIS Universe foundation map updated.")
