# Unreal MCP Setup

## Purpose

This document defines the local Unreal Editor control lane for Codex on `unreal-gauntlet-lab`. The lane controls Unreal Editor only; it does not call, mutate, or bridge into JARVIS runtime, governance, approval, memory, router, model, voice, agent, council, Google, Telegram, or API contracts.

The first safe operating mode is read-only/status inspection plus screenshot feedback. Actor creation, deletion, property mutation, Blueprint mutation, and UMG mutation remain gated by explicit task scope.

## Current MCP status

The previous `chongdashu/unreal-mcp` plugin remains blocked by UE 5.7 compile errors and is held outside the compiled Unreal project:

```text
tools\unreal-mcp-plugin-hold\UnrealMCP
```

Known compile failures from that held plugin:

- `MCPServerRunnable.cpp`: global `BufferSize` collides with UE 5.7 `StringConv.h`, producing `error C4459: declaration of 'BufferSize' hides global declaration`.
- `UnrealMCPBlueprintCommands.cpp`: `ANY_PACKAGE` is undeclared in UE 5.7, producing `error C2065: 'ANY_PACKAGE': undeclared identifier`.
- `UnrealMCPBlueprintNodeCommands.cpp`: `ANY_PACKAGE` is undeclared in UE 5.7, producing `error C2065: 'ANY_PACKAGE': undeclared identifier`.

The preferred replacement candidate is now `remiphilippe/mcp-unreal`, vendored under:

```text
tools\mcp-unreal-remiphilippe
```

Local status:

- License: Apache-2.0.
- Upstream commit: `a12bca3be3ec9e539c6dcf72b82131b001ae62a9`.
- UE support claim: upstream README and source identify Unreal Engine 5.7 as the target version.
- Go runtime: Go 1.26.4 installed through `winget`; upstream requires Go 1.25+.
- MCP server binary: locally built at `tools\mcp-unreal-remiphilippe\bin\mcp-unreal.exe`.
- Unreal editor plugin source: present at `tools\mcp-unreal-remiphilippe\plugin`.
- Project plugin activation: active as source under `unreal\JarvisGauntlet\Plugins\MCPUnreal`.
- Project plugin compile-test: passed for `JarvisGauntletEditor Win64 Development`.
- Build warning: UBT reports that plugin `MCPUnreal` depends on module `Fab` but does not list plugin `Fab` as a dependency. No Fab assets were installed; this is upstream plugin metadata to review before hardening.
- MCP runtime status: verified with Unreal Editor open on `JarvisGauntlet - Unreal Editor`.
- MCP plugin endpoint: online at `http://127.0.0.1:8090/api/status`.
- Remote Control API endpoint: offline at `http://127.0.0.1:30010/remote/info`; this is only needed for RC-backed property tools.
- MCP read-only/status smoke test: passed through stdio with `plugin_online: true`.
- MCP read-only editor tools verified: `status`, `project_ops get_info`, `level_ops get_current`, and `get_level_actors`.
- MCP screenshot capture verified: `capture_viewport` wrote `docs\unreal\screenshots\mcp-latest.png`.

## Architecture

```text
Codex MCP client
  -> remiphilippe mcp-unreal Go binary
  -> stdio JSON-RPC MCP transport
  -> optional UE Remote Control API on localhost:30010
  -> MCPUnreal editor plugin on localhost:8090 after Unreal Editor loads it
  -> Unreal Editor 5.7 opened on unreal\JarvisGauntlet\JarvisGauntlet.uproject
```

The Go binary can provide headless project/status/doc tools without a running editor. Advanced editor operations and viewport screenshots require the `MCPUnreal` editor plugin to be loaded by Unreal Editor. Runtime verification has passed for plugin-backed read-only/status and screenshot capture tools.

Screenshot feedback remains a separate verification rule:

```text
Codex visual change
  -> MCP capture_viewport or Unreal Python screenshot request
  -> docs\unreal\screenshots\mcp-latest.png
  -> image inspection
  -> targeted follow-up edit
```

## Candidate Installation

Source package:

```text
https://github.com/remiphilippe/mcp-unreal
commit a12bca3be3ec9e539c6dcf72b82131b001ae62a9
```

Vendored locations:

```text
tools\mcp-unreal-remiphilippe
tools\mcp-unreal-remiphilippe\UPSTREAM.md
tools\mcp-unreal-remiphilippe\plugin
unreal\JarvisGauntlet\Plugins\MCPUnreal
```

Local binary path:

```text
tools\mcp-unreal-remiphilippe\bin\mcp-unreal.exe
```

The binary is a generated local build artifact and is ignored by git. Rebuild it from the repo root with:

```powershell
& "C:\Program Files\Go\bin\go.exe" build `
  -ldflags "-X main.Version=a12bca3" `
  -o "tools\mcp-unreal-remiphilippe\bin\mcp-unreal.exe" `
  ".\tools\mcp-unreal-remiphilippe\cmd\mcp-unreal"
```

## Codex MCP Config

Use an absolute path for this machine:

```toml
[mcp_servers.mcp-unreal]
command = "C:\\Users\\princ\\Documents\\jarvis\\tools\\mcp-unreal-remiphilippe\\bin\\mcp-unreal.exe"
args = []
tool_timeout_sec = 120

[mcp_servers.mcp-unreal.env]
MCP_UNREAL_PROJECT = "C:\\Users\\princ\\Documents\\jarvis\\unreal\\JarvisGauntlet\\JarvisGauntlet.uproject"
UE_EDITOR_PATH = "D:\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe"
MCP_UNREAL_LOG_LEVEL = "info"
```

First test should always be read-only:

```text
status
```

Do not begin with actor spawning, deletion, Blueprint mutation, widget mutation, package/cook operations, or script execution.

## Manual Unreal Editor Steps

The remiphilippe editor plugin source is installed, compile-tested, and runtime-verified. To reproduce the runtime check:

1. Close Unreal Editor if it is already open.
2. Confirm the repo-local Unreal build is green:

   ```text
   JarvisGauntletEditor Win64 Development
   ```

3. Open `unreal\JarvisGauntlet\JarvisGauntlet.uproject` in Unreal Engine 5.7.
4. Restart the editor if Unreal prompts for newly compiled modules.
5. Confirm the plugin logs:

   ```text
   LogMCPUnreal: MCPUnreal plugin starting
   LogMCPUnreal: MCPUnreal HTTP server started on 127.0.0.1:8090
   ```

6. Test the local plugin endpoint:

   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8090/api/status"
   ```

7. Run MCP `status` and confirm `plugin_online: true`.
8. Run read-only checks first: `project_ops get_info`, `level_ops get_current`, and `get_level_actors`.

The built-in Unreal Remote Control API is separate. If it is needed for property reads, enable the built-in `Remote Control API` plugin in Unreal Editor and verify:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:30010/remote/info"
```

## Screenshot Bridge Workflow

Preferred MCP path after the remiphilippe plugin is active and online:

```text
capture_viewport(output_path="C:\Users\princ\Documents\jarvis\docs\unreal\screenshots\mcp-latest.png", world="editor")
```

Fallback Unreal Python path remains preserved:

```text
scripts\unreal\capture-mcp-screenshot.py
```

Deterministic output:

```text
docs\unreal\screenshots\mcp-latest.png
```

The Python script calls:

```python
unreal.AutomationLibrary.take_high_res_screenshot(
    1920,
    1080,
    r"C:\Users\princ\Documents\jarvis\docs\unreal\screenshots\mcp-latest.png",
)
```

The screenshot request is asynchronous. Wait at least 2 seconds, or tick the editor if supported, before reading the image.

Visual iteration loop:

1. Execute a visual edit.
2. Capture an Unreal screenshot through MCP `capture_viewport` or the Python bridge.
3. Inspect `docs\unreal\screenshots\mcp-latest.png`.
4. Describe what is visible and what is wrong.
5. Make one targeted change.
6. Screenshot again.
7. Do not mark visual work complete without a verified Unreal screenshot.

## Safe Operating Procedure

- Work only on `unreal-gauntlet-lab`.
- Treat Unreal as a read-only visual client of JARVIS.
- Start with `status` or another read-only/status call.
- Do not run mutation tools unless the active prompt explicitly asks for editor mutation.
- Do not create a JARVIS runtime bridge from Unreal MCP.
- Do not send secrets, prompts, private memory, approval payloads, or executable tool data into Unreal.
- Do not use Marketplace, Fab, MetaHuman, RealityCapture, or paid StraySpark for this lane.
- Do not track Unreal `Binaries`, `Intermediate`, `Saved`, `DerivedDataCache`, or plugin generated outputs.

## Rollback Path

If the remiphilippe plugin breaks compilation or editor startup:

1. Move:

```text
unreal\JarvisGauntlet\Plugins\MCPUnreal
```

to:

```text
tools\mcp-unreal-plugin-hold\MCPUnreal
```

2. Rebuild `JarvisGauntletEditor Win64 Development`.
3. Keep `tools\mcp-unreal-remiphilippe` as the source candidate unless a later task explicitly removes it.
4. Keep `tools\unreal-mcp-plugin-hold\UnrealMCP` held unless a later task explicitly patches it.

## What Remains Manual

- Enabling any required built-in Unreal plugins, especially Remote Control API.
- Opening Unreal Editor before editor-control MCP calls.
- Re-enabling or verifying Remote Control API if RC-backed property tools are needed.
