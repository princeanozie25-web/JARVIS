# Unreal Screenshot Feedback

Use this skill whenever a visual Unreal change needs verification.

1. Use MCP `execute_python` or the equivalent Unreal Python execution tool available in the active editor-control lane.
2. Execute `scripts/unreal/capture-mcp-screenshot.py`, or run the equivalent Python:

   ```python
   import unreal
   unreal.AutomationLibrary.take_high_res_screenshot(
       1920,
       1080,
       r"C:\Users\princ\Documents\jarvis\docs\unreal\screenshots\mcp-latest.png",
   )
   ```

3. Save the screenshot to:

   ```text
   docs/unreal/screenshots/mcp-latest.png
   ```

4. Wait at least 2 seconds after requesting the screenshot, or perform an editor tick if the MCP tool supports ticking.
5. Inspect the screenshot before making another visual edit.
6. Describe what is visible in the screenshot, including mismatches against the target reference.
7. Make one targeted visual change at a time.
8. Repeat the screenshot loop after every visual change.
9. Never mark visual work complete without screenshot verification from the actual Unreal viewport or camera.
