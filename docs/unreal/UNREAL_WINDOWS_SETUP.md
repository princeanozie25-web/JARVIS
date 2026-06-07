# Unreal Windows Setup

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Scope

This branch prepares a dedicated Unreal Engine experimentation lane for JARVIS. The stable JARVIS roadmap remains authoritative on `main`, including Phase 1-21, Expansion Era v2, the UI Polish Program, and future Phase 22 work.

Unreal Engine work in this repository is experimental. It must remain a read-only visualization client and must not modify governance, approval, memory, routing, model, voice, tool, council, agent, Google, Telegram, or runtime contracts.

## Current Machine Status

| Area                           | Status                 | Notes                                                                                                 |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Branch                         | Ready                  | Active branch is `unreal-gauntlet-lab`, tracking `origin/unreal-gauntlet-lab`.                        |
| Git LFS                        | Installed              | `git-lfs/3.7.1`.                                                                                      |
| winget                         | Installed              | `v1.28.240`.                                                                                          |
| Visual Studio Community        | Installed              | Visual Studio Community 2026 is installed at `C:\Program Files\Microsoft Visual Studio\18\Community`. |
| Visual Studio 2022 Build Tools | Installed during setup | Installed at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`.                        |
| MSVC toolchain                 | Installed              | MSVC `14.44.35207` found under the VS 2022 Build Tools installation.                                  |
| Windows SDK                    | Installed              | Windows SDK `10.0.26100.0` detected.                                                                  |
| CMake tools                    | Installed              | Visual Studio CMake binary detected under the VS 2022 Build Tools installation.                       |
| Epic Games Launcher            | Installed              | Launcher detected at `C:\Program Files\Epic Games\Launcher`.                                          |
| Unreal Engine                  | Missing                | No `C:\Program Files\Epic Games\UE_*` installation was detected.                                      |

## Installed Tooling

- Git LFS: `git-lfs/3.7.1`.
- Visual Studio Community 2026: `C:\Program Files\Microsoft Visual Studio\18\Community`.
- Visual Studio Build Tools 2022: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`.
- MSVC compiler: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\cl.exe`.
- MSBuild: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe`.
- CMake: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe`.
- Developer command bootstrap: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\LaunchDevCmd.bat`.
- Windows SDK: `10.0.26100.0`.
- Epic Games Launcher: `C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe`.

`cl` and `msbuild` are not on the default PowerShell PATH. Use a Visual Studio Developer PowerShell or run `LaunchDevCmd.bat` before invoking Unreal C++ build commands directly.

## Missing Tooling

- Unreal Engine installed through Epic Games Launcher.

Do not use unofficial Unreal installation methods. Do not bypass Epic authentication.

## Unreal Installation Instructions

1. Launch Epic Games Launcher:

```text
C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe
```

2. Sign in with an Epic account.
3. In the launcher, open the Unreal Engine section.
4. Install an Unreal Engine 5.x version suitable for the target experiment.
5. Prefer the default Windows install root:

```text
C:\Program Files\Epic Games\UE_5.x
```

Expected engine files after installation:

```text
C:\Program Files\Epic Games\UE_5.x\Engine\Build\BatchFiles\Build.bat
C:\Program Files\Epic Games\UE_5.x\Engine\Binaries\Win64\UnrealEditor.exe
C:\Program Files\Epic Games\UE_5.x\Engine\Binaries\Win64\UnrealEditor-Cmd.exe
```

## Developer Shell

Before direct compiler checks, open a Developer PowerShell for VS 2022 or run:

```bat
"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\LaunchDevCmd.bat"
```

Then verify:

```bat
where cl
where msbuild
cl
msbuild -version
```

## Build.bat Examples

These examples assume a future Unreal project at `unreal\JarvisGauntlet\JarvisGauntlet.uproject` and an installed engine at `C:\Program Files\Epic Games\UE_5.x`.

Build the editor target:

```bat
"C:\Program Files\Epic Games\UE_5.x\Engine\Build\BatchFiles\Build.bat" JarvisGauntletEditor Win64 Development "%CD%\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -WaitMutex
```

Build a game target:

```bat
"C:\Program Files\Epic Games\UE_5.x\Engine\Build\BatchFiles\Build.bat" JarvisGauntlet Win64 Development "%CD%\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -WaitMutex
```

## UnrealEditor-Cmd Examples

Run a commandlet:

```bat
"C:\Program Files\Epic Games\UE_5.x\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "%CD%\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -run=ResavePackages -unattended -nop4
```

Run automation tests:

```bat
"C:\Program Files\Epic Games\UE_5.x\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "%CD%\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -ExecCmds="Automation RunTests Jarvis; Quit" -unattended -nop4 -NullRHI
```

Cook for Windows:

```bat
"C:\Program Files\Epic Games\UE_5.x\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "%CD%\unreal\JarvisGauntlet\JarvisGauntlet.uproject" -run=Cook -TargetPlatform=Windows -unattended -nop4
```

## Future Unreal/JARVIS Bridge Architecture

The bridge should be read-only from Unreal into JARVIS:

- JARVIS emits a sanitized event stream from existing approved runtime boundaries.
- A bridge adapter converts approved, non-sensitive event metadata into a visualization feed.
- Unreal subscribes to the feed and renders state, timelines, traces, and Gauntlet-style visual metaphors.
- Unreal does not call JARVIS tools.
- Unreal does not mutate memory, governance, routing, approvals, model state, voice state, agents, council state, Google state, Telegram state, or runtime contracts.
- Any future bridge schema must be additive, explicit, and reviewed as a visualization contract rather than a runtime control contract.

Suggested future local shape:

```text
jarvis runtime -> read-only event stream -> bridge adapter -> Unreal visualization client
```

The first Unreal project should live under `unreal/` and remain isolated from application runtime code.
