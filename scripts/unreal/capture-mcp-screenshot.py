from pathlib import Path

import unreal

OUTPUT_PATH = Path(
    r"C:\Users\princ\Documents\jarvis\docs\unreal\screenshots\mcp-latest.png"
)

try:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
except Exception as exc:
    unreal.log_warning(f"Unable to ensure screenshot directory exists: {exc}")

unreal.AutomationLibrary.take_high_res_screenshot(
    1920,
    1080,
    str(OUTPUT_PATH),
)

unreal.log(f"Requested asynchronous MCP screenshot: {OUTPUT_PATH}")
unreal.log(
    "Screenshot completion is asynchronous; wait at least 2 seconds or tick the editor before reading the file."
)
