# Cinematic Pipeline Preflight

This preflight records the source-controlled Unreal plugin state for the JARVIS Gauntlet cinematic/VFX pipeline. The Unreal project remains a read-only visual client; no JARVIS runtime, governance, API, test, or Universe_01 assets are part of this slice.

## Project

- Project file: `unreal/JarvisGauntlet/JarvisGauntlet.uproject`
- Engine association: `5.7`
- Verified engine path: `D:\UE_5.7`
- Build target: `JarvisGauntletEditor Win64 Development`

## Enabled Plugins

The following descriptor-backed plugins are available locally and enabled in `JarvisGauntlet.uproject`:

| Plugin                | Local descriptor                                                                      | Restart required                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MovieRenderPipeline` | `D:\UE_5.7\Engine\Plugins\MovieScene\MovieRenderPipeline\MovieRenderPipeline.uplugin` | Yes. Restart Unreal Editor after changing this plugin state so Movie Render Queue editor/runtime modules load from the project descriptor. |
| `Niagara`             | `D:\UE_5.7\Engine\Plugins\FX\Niagara\Niagara.uplugin`                                 | Yes. Restart Unreal Editor after changing this plugin state so Niagara runtime/editor modules and shader hooks load cleanly.               |

`MovieRenderPipelineRenderPasses` is available as a runtime module inside the `MovieRenderPipeline` plugin, not as a standalone `.uplugin` descriptor. Enabling `MovieRenderPipeline` is the source-controlled activation point for that module in this installed engine tree.

## Unavailable Built-In Plugin Descriptors

These requested plugin descriptors were not present under `D:\UE_5.7\Engine\Plugins` and were not added to the project descriptor:

| Requested plugin                  | Status                                                                            | Restart required                                            |
| --------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `MovieRenderPipelineRenderPasses` | Module-only under `MovieRenderPipeline`; no standalone `.uplugin` exists locally. | No separate restart item. Covered by `MovieRenderPipeline`. |
| `HeterogeneousVolumes`            | No `.uplugin` descriptor found locally.                                           | No. Not enabled.                                            |
| `PathTracer`                      | No `.uplugin` descriptor found locally.                                           | No. Not enabled.                                            |
| `PathTracing`                     | No `.uplugin` descriptor found locally.                                           | No. Not enabled.                                            |

## External Or Manual Installs

- `ZibraVDB` was not enabled because no local project or engine plugin descriptor was found. It remains a manual/external install decision.
- If `ZibraVDB` is installed and explicitly enabled later, restart Unreal Editor after the descriptor change before using the plugin in Gauntlet cinematic work.

## Verification Commands

Run these checks after plugin or preflight edits:

```powershell
git branch --show-current
git status --short
powershell -ExecutionPolicy Bypass -File scripts/unreal/verify-unreal.ps1
& "D:\UE_5.7\Engine\Build\BatchFiles\Build.bat" JarvisGauntletEditor Win64 Development "C:\Users\princ\Documents\jarvis\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -WaitMutex
git diff --check
npx tsc --noEmit
npm test
npm run lint
```
