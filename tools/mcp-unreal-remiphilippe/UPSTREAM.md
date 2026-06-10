# remiphilippe/mcp-unreal upstream note

Source: https://github.com/remiphilippe/mcp-unreal

Commit inspected: `a12bca3be3ec9e539c6dcf72b82131b001ae62a9`

License: Apache-2.0, with `LICENSE` included in the upstream tree.

Local status:

- Source is vendored under `tools/mcp-unreal-remiphilippe`.
- The Go MCP server builds locally to `tools/mcp-unreal-remiphilippe/bin/mcp-unreal.exe`; that binary is a local build artifact and is ignored by git.
- The upstream Unreal editor plugin remains in `tools/mcp-unreal-remiphilippe/plugin`.
- The plugin has not been copied into `unreal/JarvisGauntlet/Plugins`, so it is not part of the repo-local Unreal project build yet.
- The previous `chongdashu/unreal-mcp` plugin remains held at `tools/unreal-mcp-plugin-hold/UnrealMCP`.
