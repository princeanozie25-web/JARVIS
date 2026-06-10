import unreal
import random

MAP_PATH = "/Game/Levels/Universe_01"
FOUNDATION_CLASS = "/Script/JarvisGauntlet.JarvisUniverseFoundationActor"
FOGSHEET_MESH = "/Engine/EngineVolumetrics/Fogsheet/Mesh/S_EV_FogSheet_01.S_EV_FogSheet_01"
FOGSHEET_MATERIAL = "/Engine/EngineVolumetrics/Fogsheet/Materials/M_EV_FogSheet_2sided_Master_Addi.M_EV_FogSheet_2sided_Master_Addi"
VOID_PLATE_SOURCE = r"C:\Users\princ\Documents\jarvis\docs\unreal\reference\gauntlet-void-plate.png"
TEXTURE_DIR = "/Game/JarvisGauntlet/Textures"
MATERIAL_DIR = "/Game/JarvisGauntlet/Materials"
VOID_PLATE_TEXTURE = f"{TEXTURE_DIR}/T_GauntletVoidPlate"
VOID_PLATE_MATERIAL = f"{MATERIAL_DIR}/M_GauntletVoidPlate"


def try_set_editor_property(target, property_name, value):
    try:
        target.set_editor_property(property_name, value)
        return True
    except Exception:
        return False


def make_rotator(pitch=0.0, yaw=0.0, roll=0.0):
    rotator = unreal.Rotator()
    rotator.set_editor_property("pitch", pitch)
    rotator.set_editor_property("yaw", yaw)
    rotator.set_editor_property("roll", roll)
    return rotator


def look_at_rotation(origin, target):
    return unreal.MathLibrary.find_look_at_rotation(origin, target)


def make_rot_from_z(direction):
    try:
        return unreal.MathLibrary.make_rot_from_z(direction)
    except Exception:
        return make_rotator(pitch=90.0)


def destroy_previous_gauntlet_visuals():
    for actor in list(unreal.EditorLevelLibrary.get_all_level_actors()):
        label = actor.get_actor_label()
        actor_class = actor.get_class().get_name()
        if label.startswith("GAUNTLET_") or actor_class == "JarvisUniverseFoundationActor":
            unreal.EditorLevelLibrary.destroy_actor(actor)


def configure_cine_camera(camera):
    camera_component = camera.get_editor_property("camera_component")
    if not camera_component:
        return

    try_set_editor_property(camera_component, "field_of_view", 82.0)
    try_set_editor_property(camera_component, "current_focal_length", 24.0)
    try_set_editor_property(camera_component, "current_aperture", 3.5)
    try_set_editor_property(camera_component, "manual_focus_distance", 1200000.0)

    focus_settings = None
    try:
        focus_settings = camera_component.get_editor_property("focus_settings")
    except Exception:
        pass
    if focus_settings:
        try_set_editor_property(focus_settings, "focus_method", unreal.CameraFocusMethod.MANUAL)
        try_set_editor_property(focus_settings, "manual_focus_distance", 1200000.0)
        try_set_editor_property(camera_component, "focus_settings", focus_settings)

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


def configure_post_process(post_process):
    for unbound_property in ["b_unbound", "unbound"]:
        if try_set_editor_property(post_process, unbound_property, True):
            break

    settings = post_process.get_editor_property("settings")
    for property_name, value in [
        ("override_auto_exposure_bias", True),
        ("auto_exposure_bias", -0.82),
        ("override_auto_exposure_min_brightness", True),
        ("auto_exposure_min_brightness", 0.03),
        ("override_auto_exposure_max_brightness", True),
        ("auto_exposure_max_brightness", 0.62),
        ("override_bloom_intensity", True),
        ("bloom_intensity", 3.10),
        ("override_bloom_threshold", True),
        ("bloom_threshold", 0.018),
        ("override_vignette_intensity", True),
        ("vignette_intensity", 0.46),
        ("override_scene_color_tint", True),
        ("scene_color_tint", unreal.LinearColor(0.70, 0.82, 1.0, 1.0)),
        ("override_film_slope", True),
        ("film_slope", 0.92),
        ("override_film_toe", True),
        ("film_toe", 0.70),
    ]:
        try_set_editor_property(settings, property_name, value)


def configure_fog(fog):
    fog_component = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if not fog_component:
        return

    for property_name, value in [
        ("fog_density", 0.0000022),
        ("fog_height_falloff", 0.20),
        ("fog_max_opacity", 0.075),
        ("start_distance", 90000.0),
        ("fog_in_scattering_color", unreal.LinearColor(0.012, 0.026, 0.070, 1.0)),
        ("volumetric_fog", True),
        ("volumetric_fog_scattering_distribution", 0.78),
        ("volumetric_fog_albedo", unreal.Color(18, 34, 72, 255)),
        ("volumetric_fog_emissive", unreal.LinearColor(0.0, 0.008, 0.020, 1.0)),
    ]:
        try_set_editor_property(fog_component, property_name, value)


def spawn_edge_light(label, location, color, intensity):
    light = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.PointLight,
        location,
        make_rotator(),
    )
    light.set_actor_label(label)
    light.set_editor_property(
        "tags",
        [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("ReadOnlyVisual")],
    )
    component = light.get_component_by_class(unreal.PointLightComponent)
    if component:
        component.set_editor_property("intensity", intensity)
        component.set_editor_property("attenuation_radius", 360000.0)
        component.set_editor_property("use_inverse_squared_falloff", False)
        component.set_editor_property("light_falloff_exponent", 1.0)
        component.set_editor_property("source_radius", 4200.0)
        component.set_editor_property("soft_source_radius", 16000.0)
        component.set_editor_property("light_color", color)
    return light


def ensure_void_plate_material():
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    unreal.EditorAssetLibrary.make_directory(TEXTURE_DIR)
    unreal.EditorAssetLibrary.make_directory(MATERIAL_DIR)

    if not unreal.EditorAssetLibrary.does_asset_exist(VOID_PLATE_TEXTURE):
        task = unreal.AssetImportTask()
        task.set_editor_property("filename", VOID_PLATE_SOURCE)
        task.set_editor_property("destination_path", TEXTURE_DIR)
        task.set_editor_property("destination_name", "T_GauntletVoidPlate")
        task.set_editor_property("replace_existing", True)
        task.set_editor_property("automated", True)
        task.set_editor_property("save", True)
        asset_tools.import_asset_tasks([task])

    texture = unreal.load_asset(VOID_PLATE_TEXTURE)
    if not texture:
        unreal.log_warning(f"Unable to load void plate texture: {VOID_PLATE_TEXTURE}")
        return None

    try_set_editor_property(texture, "mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
    try_set_editor_property(texture, "compression_settings", unreal.TextureCompressionSettings.TC_DEFAULT)
    try_set_editor_property(texture, "adjust_brightness", 1.32)
    try_set_editor_property(texture, "adjust_saturation", 1.14)
    unreal.EditorAssetLibrary.save_loaded_asset(texture)

    if unreal.EditorAssetLibrary.does_asset_exist(VOID_PLATE_MATERIAL):
        material = unreal.load_asset(VOID_PLATE_MATERIAL)
    else:
        material = asset_tools.create_asset(
            "M_GauntletVoidPlate",
            MATERIAL_DIR,
            unreal.Material,
            unreal.MaterialFactoryNew(),
        )
    if not material:
        return None

    try_set_editor_property(material, "two_sided", True)
    try_set_editor_property(material, "shading_model", unreal.MaterialShadingModel.MSM_UNLIT)

    try:
        unreal.MaterialEditingLibrary.delete_all_material_expressions(material)
    except Exception:
        pass

    try:
        texture_sample = unreal.MaterialEditingLibrary.create_material_expression(
            material,
            unreal.MaterialExpressionTextureSample,
            -620,
            0,
        )
        texture_sample.set_editor_property("texture", texture)
        boost = unreal.MaterialEditingLibrary.create_material_expression(
            material,
            unreal.MaterialExpressionMultiply,
            -250,
            0,
        )
        try_set_editor_property(boost, "const_b", 4.8)
        unreal.MaterialEditingLibrary.connect_material_expressions(texture_sample, "RGB", boost, "A")
        unreal.MaterialEditingLibrary.connect_material_property(
            boost,
            "",
            unreal.MaterialProperty.MP_EMISSIVE_COLOR,
        )
        unreal.MaterialEditingLibrary.recompile_material(material)
        unreal.EditorAssetLibrary.save_loaded_asset(material)
    except Exception as exc:
        unreal.log_warning(f"Unable to rebuild void plate material graph: {exc}")
    return material


def spawn_distant_nebula_matte(camera_location):
    plane_mesh = unreal.load_asset("/Engine/BasicShapes/Plane.Plane")
    material = ensure_void_plate_material()
    if not plane_mesh or not material:
        unreal.log_warning("Skipping distant nebula matte because mesh/material was unavailable.")
        return None

    plate_location = unreal.Vector(0.0, 1050000.0, -170000.0)
    plate_rotation = make_rotator(0.0, 0.0, 90.0)
    plate = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        plate_location,
        plate_rotation,
    )
    plate.set_actor_label("GAUNTLET_Void_Distant_Nebula_Matte")
    plate.set_actor_scale3d(unreal.Vector(76000.0, 42750.0, 1.0))
    plate.set_editor_property(
        "tags",
        [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("DistantNebulaMatte"), unreal.Name("ReadOnlyVisual")],
    )
    component = plate.get_component_by_class(unreal.StaticMeshComponent)
    if component:
        component.set_static_mesh(plane_mesh)
        component.set_material(0, material)
        try_set_editor_property(component, "collision_enabled", unreal.CollisionEnabled.NO_COLLISION)
        try_set_editor_property(component, "cast_shadow", False)
    return plate


def spawn_nebula_sheet(label, location, camera_location, scale, color, opacity, roll):
    fogsheet_mesh = unreal.load_asset(FOGSHEET_MESH)
    fogsheet_material = unreal.load_asset(FOGSHEET_MATERIAL)
    if not fogsheet_mesh:
        unreal.log_warning(f"Unable to load fogsheet mesh: {FOGSHEET_MESH}")
        return None

    rotation = look_at_rotation(location, camera_location)
    rotation.set_editor_property("roll", roll)

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        location,
        rotation,
    )
    actor.set_actor_label(label)
    actor.set_editor_property(
        "tags",
        [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("NebulaFogSheet"), unreal.Name("ReadOnlyVisual")],
    )
    actor.set_actor_scale3d(scale)

    component = actor.get_component_by_class(unreal.StaticMeshComponent)
    if component:
        component.set_static_mesh(fogsheet_mesh)
        try_set_editor_property(component, "collision_enabled", unreal.CollisionEnabled.NO_COLLISION)
        try_set_editor_property(component, "cast_shadow", False)
        if fogsheet_material:
            material = component.create_dynamic_material_instance(0, fogsheet_material)
            if material:
                for parameter in ["Color", "Tint", "EmissiveColor", "FogColor", "MainColor"]:
                    material.set_vector_parameter_value(parameter, color)
                for parameter in ["Opacity", "Alpha", "Intensity"]:
                    material.set_scalar_parameter_value(parameter, opacity)
            else:
                component.set_material(0, fogsheet_material)
    return actor


def spawn_nebula_sheet_cluster(prefix, color, center, tangent, vertical_bias, camera_location, count, seed):
    random.seed(seed)
    for index in range(count):
        alpha = (index / max(1, count - 1)) - 0.5
        width = random.uniform(-1.0, 1.0)
        depth_jitter = random.uniform(-72000.0, 72000.0)
        location = unreal.Vector(
            center.x + tangent.x * alpha + width * 52000.0,
            center.y + tangent.y * alpha + depth_jitter,
            center.z + vertical_bias * alpha + random.uniform(-54000.0, 54000.0),
        )
        scale = unreal.Vector(
            random.uniform(820.0, 1680.0),
            random.uniform(160.0, 460.0),
            1.0,
        )
        spawn_nebula_sheet(
            f"{prefix}_Sheet_{index:02d}",
            location,
            camera_location,
            scale,
            color,
            random.uniform(0.26, 0.52),
            random.uniform(-180.0, 180.0),
        )


if not unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    if not unreal.EditorLevelLibrary.new_level(MAP_PATH):
        raise RuntimeError(f"Unable to create {MAP_PATH}")
else:
    unreal.EditorLoadingAndSavingUtils.load_map(MAP_PATH)

destroy_previous_gauntlet_visuals()

foundation_class = unreal.load_class(None, FOUNDATION_CLASS)
if not foundation_class:
    raise RuntimeError(f"Unable to load {FOUNDATION_CLASS}. Build JarvisGauntletEditor first.")

foundation = unreal.EditorLevelLibrary.spawn_actor_from_class(
    foundation_class,
    unreal.Vector(0.0, 0.0, 0.0),
    make_rotator(),
)
foundation.set_actor_label("GAUNTLET_LivingVoid_ReadOnly")
foundation.set_editor_property(
    "tags",
    [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("ReadOnlyVisual")],
)
try_set_editor_property(foundation, "StarCount", 26000)
try_set_editor_property(foundation, "StarfieldRadius", 500000.0)
try_set_editor_property(foundation, "NebulaWispCount", 7200)
try_set_editor_property(foundation, "GalaxyAnchorDistance", 900000.0)
try_set_editor_property(foundation, "bShowDomainLabels", False)
try_set_editor_property(foundation, "bReadOnlyVisual", True)

camera_location = unreal.Vector(0.0, -520000.0, 95000.0)
camera_target = unreal.Vector(0.0, 1200000.0, -190000.0)
camera_rotation = look_at_rotation(camera_location, camera_target)

spawn_distant_nebula_matte(camera_location)

camera_class = getattr(unreal, "CineCameraActor", None)
if not camera_class:
    camera_class = unreal.CameraActor
camera = unreal.EditorLevelLibrary.spawn_actor_from_class(camera_class, camera_location, camera_rotation)
camera.set_actor_label("GAUNTLET_Void_Cinematic_Camera")
camera.set_editor_property(
    "tags",
    [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("CineCamera"), unreal.Name("ReadOnlyVisual")],
)
configure_cine_camera(camera)

player_start = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PlayerStart, camera_location, camera_rotation)
player_start.set_actor_label("GAUNTLET_Viewport_PlayerStart")
player_start.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("LivingVoid")])

post_process = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.PostProcessVolume,
    unreal.Vector(0.0, 0.0, 0.0),
    make_rotator(),
)
post_process.set_actor_label("GAUNTLET_DarkVoid_PostProcess")
post_process.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("DarkVoidMood")])
configure_post_process(post_process)

fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.ExponentialHeightFog,
    unreal.Vector(0.0, 0.0, -42000.0),
    make_rotator(),
)
fog.set_actor_label("GAUNTLET_Volumetric_Void_Fog")
fog.set_editor_property("tags", [unreal.Name("JARVIS"), unreal.Name("LivingVoid"), unreal.Name("VoidAtmosphere")])
configure_fog(fog)

sky_light = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyLight,
    unreal.Vector(0.0, 0.0, 12000.0),
    make_rotator(),
)
sky_light.set_actor_label("GAUNTLET_Minimal_SkyLight")
sky_component = sky_light.get_component_by_class(unreal.SkyLightComponent)
if sky_component:
    sky_component.set_editor_property("intensity", 0.0)

spawn_edge_light(
    "GAUNTLET_Void_Nebula_Edge_A_Light",
    unreal.Vector(-430000.0, 640000.0, -150000.0),
    unreal.Color(180, 65, 255, 255),
    210000.0,
)
spawn_edge_light(
    "GAUNTLET_Void_Nebula_Edge_B_Light",
    unreal.Vector(450000.0, 680000.0, -120000.0),
    unreal.Color(45, 210, 255, 255),
    195000.0,
)
spawn_edge_light(
    "GAUNTLET_Void_Nebula_Edge_C_Light",
    unreal.Vector(260000.0, 820000.0, 210000.0),
    unreal.Color(255, 128, 44, 255),
    160000.0,
)

spawn_nebula_sheet_cluster(
    "GAUNTLET_Void_Nebula_Edge_A",
    unreal.LinearColor(3.2, 0.55, 5.5, 1.0),
    unreal.Vector(-460000.0, 690000.0, -190000.0),
    unreal.Vector(470000.0, 210000.0, 0.0),
    230000.0,
    camera_location,
    10,
    70601,
)
spawn_nebula_sheet_cluster(
    "GAUNTLET_Void_Nebula_Edge_B",
    unreal.LinearColor(0.42, 4.8, 6.2, 1.0),
    unreal.Vector(430000.0, 720000.0, -150000.0),
    unreal.Vector(420000.0, 190000.0, 0.0),
    200000.0,
    camera_location,
    10,
    70602,
)
spawn_nebula_sheet_cluster(
    "GAUNTLET_Void_Nebula_Edge_C",
    unreal.LinearColor(5.8, 2.1, 0.55, 1.0),
    unreal.Vector(300000.0, 880000.0, 290000.0),
    unreal.Vector(360000.0, 160000.0, 0.0),
    -230000.0,
    camera_location,
    8,
    70603,
)

unreal.EditorLevelLibrary.set_selected_level_actors([])
unreal.EditorLevelLibrary.set_level_viewport_camera_info(camera_location, camera_rotation)
unreal.EditorLevelLibrary.editor_invalidate_viewports()
unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log("JARVIS living cinematic void built for Universe_01.")
