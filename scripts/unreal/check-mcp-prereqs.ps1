$ErrorActionPreference = "Continue"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ProjectPath = Join-Path $RepoRoot "unreal\JarvisGauntlet\JarvisGauntlet.uproject"
$ChongdashuPluginPath = Join-Path $RepoRoot "unreal\JarvisGauntlet\Plugins\UnrealMCP"
$HeldChongdashuPluginPath = Join-Path $RepoRoot "tools\unreal-mcp-plugin-hold\UnrealMCP"
$ChongdashuServerPath = Join-Path $RepoRoot "tools\unreal-mcp\Python"
$RemiphilippePath = Join-Path $RepoRoot "tools\mcp-unreal-remiphilippe"
$RemiphilippePluginSource = Join-Path $RemiphilippePath "plugin\MCPUnreal.uplugin"
$RemiphilippeProjectPlugin = Join-Path $RepoRoot "unreal\JarvisGauntlet\Plugins\MCPUnreal"
$RemiphilippeBinary = Join-Path $RemiphilippePath "bin\mcp-unreal.exe"
$ScreenshotScript = Join-Path $RepoRoot "scripts\unreal\capture-mcp-screenshot.py"
$SetupDoc = Join-Path $RepoRoot "docs\unreal\UNREAL_MCP_SETUP.md"

function Write-Check {
    param(
        [string]$Status,
        [string]$Message
    )

    Write-Host "[$Status] $Message"
}

function Get-GoCommand {
    $go = Get-Command go -ErrorAction SilentlyContinue
    if ($go) {
        return $go.Source
    }

    $defaultGo = "C:\Program Files\Go\bin\go.exe"
    if (Test-Path -LiteralPath $defaultGo) {
        return $defaultGo
    }

    return $null
}

function Test-LocalHttp {
    param([string]$Uri)

    try {
        Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

Push-Location $RepoRoot
try {
    Write-Host "JARVIS Unreal MCP prerequisite check"
    Write-Host "Repository: $RepoRoot"

    $branch = (git branch --show-current 2>$null).Trim()
    if ($branch -eq "unreal-gauntlet-lab") {
        Write-Check "OK" "Branch: $branch"
    } else {
        Write-Check "WARN" "Branch is '$branch'; expected unreal-gauntlet-lab"
    }

    if (Test-Path -LiteralPath $ProjectPath) {
        Write-Check "OK" "Repo-local project: $ProjectPath"
    } else {
        Write-Check "MISSING" "Repo-local project not found: $ProjectPath"
    }

    $engineCandidates = @(
        "D:\UE_5.7",
        "C:\Program Files\Epic Games\UE_5.7"
    )

    foreach ($root in @("D:\Epic Games", "C:\Program Files\Epic Games")) {
        if (Test-Path -LiteralPath $root) {
            $engineCandidates += Get-ChildItem -LiteralPath $root -Directory -Filter "UE_*" -ErrorAction SilentlyContinue |
                ForEach-Object { $_.FullName }
        }
    }

    $enginePath = $engineCandidates |
        Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ "Engine\Binaries\Win64\UnrealEditor.exe")) } |
        Select-Object -First 1

    if ($enginePath) {
        Write-Check "OK" "Unreal Engine path: $enginePath"
        Write-Check "OK" "UnrealEditor.exe: $(Join-Path $enginePath "Engine\Binaries\Win64\UnrealEditor.exe")"
        Write-Check "OK" "Build.bat: $(Join-Path $enginePath "Engine\Build\BatchFiles\Build.bat")"
    } else {
        Write-Check "MISSING" "No Unreal Engine editor detected under D:\UE_5.7, D:\Epic Games, or C:\Program Files\Epic Games"
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        $pythonVersion = (& python --version 2>&1)
        Write-Check "OK" "Python: $pythonVersion"
    } else {
        Write-Check "MISSING" "Python is not on PATH. Install Python 3.10+ or use the Python bundled with your toolchain."
    }

    $uv = Get-Command uv -ErrorAction SilentlyContinue
    if ($uv) {
        $uvVersion = (& uv --version 2>&1)
        Write-Check "OK" "uv: $uvVersion"
    } else {
        Write-Check "MISSING" "uv is not on PATH. Install with: powershell -ExecutionPolicy Bypass -c `"irm https://astral.sh/uv/install.ps1 | iex`""
        Write-Check "ALT" "winget may also work: winget install --id Astral.UV -e"
    }

    $goCommand = Get-GoCommand
    if ($goCommand) {
        $goVersion = (& $goCommand version 2>&1)
        Write-Check "OK" "Go: $goVersion"
    } else {
        Write-Check "MISSING" "Go is not on PATH and was not found at C:\Program Files\Go\bin\go.exe. Install with: winget install --id GoLang.Go -e"
    }

    if (Test-Path -LiteralPath $ChongdashuPluginPath) {
        Write-Check "ACTIVE" "chongdashu UnrealMCP plugin is inside the compiled project: $ChongdashuPluginPath"
        Write-Check "WARN" "This plugin is known to fail UE 5.7 compilation until patched."
    } else {
        Write-Check "OK" "chongdashu UnrealMCP plugin is not active in the compiled project."
    }

    if (Test-Path -LiteralPath $HeldChongdashuPluginPath) {
        Write-Check "HELD" "chongdashu UnrealMCP plugin held outside compiled project: $HeldChongdashuPluginPath"
    } else {
        Write-Check "MISSING" "Held chongdashu UnrealMCP plugin not found: $HeldChongdashuPluginPath"
    }

    if (Test-Path -LiteralPath (Join-Path $ChongdashuServerPath "unreal_mcp_server.py")) {
        Write-Check "OK" "Legacy Python MCP server preserved: $ChongdashuServerPath"
    } else {
        Write-Check "MISSING" "Legacy Python MCP server missing: $ChongdashuServerPath"
    }

    if (Test-Path -LiteralPath $RemiphilippePath) {
        Write-Check "OK" "remiphilippe/mcp-unreal source: $RemiphilippePath"
    } else {
        Write-Check "MISSING" "remiphilippe/mcp-unreal source missing: $RemiphilippePath"
    }

    if (Test-Path -LiteralPath $RemiphilippeBinary) {
        Write-Check "OK" "remiphilippe MCP binary: $RemiphilippeBinary"
    } else {
        Write-Check "MISSING" "remiphilippe MCP binary missing. Rebuild with Go from tools\mcp-unreal-remiphilippe."
    }

    if (Test-Path -LiteralPath $RemiphilippePluginSource) {
        Write-Check "OK" "remiphilippe editor plugin source: $RemiphilippePluginSource"
    } else {
        Write-Check "MISSING" "remiphilippe editor plugin source missing: $RemiphilippePluginSource"
    }

    if (Test-Path -LiteralPath $RemiphilippeProjectPlugin) {
        Write-Check "ACTIVE" "remiphilippe MCPUnreal plugin is inside the compiled project: $RemiphilippeProjectPlugin"
        $generatedPluginDirs = Get-ChildItem -LiteralPath $RemiphilippeProjectPlugin -Recurse -Directory -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -in @("Binaries", "Intermediate", "Saved", "DerivedDataCache", ".vs") }
        if ($generatedPluginDirs) {
            Write-Check "INFO" "remiphilippe plugin generated build outputs exist locally and must remain ignored by git."
        }
    } else {
        Write-Check "OK" "remiphilippe MCPUnreal plugin is not active in the compiled project."
    }

    if (Test-Path -LiteralPath $ScreenshotScript) {
        Write-Check "OK" "Screenshot bridge script: $ScreenshotScript"
    } else {
        Write-Check "MISSING" "Screenshot bridge script missing: $ScreenshotScript"
    }

    if (Test-Path -LiteralPath $SetupDoc) {
        Write-Check "OK" "MCP setup documentation: $SetupDoc"
    } else {
        Write-Check "MISSING" "MCP setup documentation missing: $SetupDoc"
    }

    if (Test-LocalHttp "http://127.0.0.1:30010/remote/info") {
        Write-Check "ONLINE" "Unreal Remote Control API is reachable on localhost:30010"
    } else {
        Write-Check "OFFLINE" "Unreal Remote Control API is not reachable on localhost:30010"
    }

    $pluginEndpointOnline = Test-LocalHttp "http://127.0.0.1:8090/api/status"
    if ($pluginEndpointOnline) {
        Write-Check "ONLINE" "remiphilippe MCPUnreal plugin endpoint is reachable on localhost:8090"
    } else {
        Write-Check "OFFLINE" "remiphilippe MCPUnreal plugin endpoint is not reachable on localhost:8090"
    }

    Write-Host ""
    Write-Host "Current safe state:"
    if (Test-Path -LiteralPath $RemiphilippeProjectPlugin) {
        Write-Host "- remiphilippe/mcp-unreal is active in the project and must keep JarvisGauntletEditor compiling."
    } else {
        Write-Host "- Build should be green while no MCP plugin is active under unreal\JarvisGauntlet\Plugins."
    }
    if ($pluginEndpointOnline) {
        Write-Host "- Runtime plugin endpoint is reachable; MCP status should report plugin_online=true."
    } else {
        Write-Host "- Editor control is not complete until MCP status reports plugin_online=true against an open Unreal Editor."
    }
    Write-Host "- Screenshot bridge docs/scripts remain available for manual Unreal Python use."
    Write-Host ""
    Write-Host "Next manual steps for remiphilippe/mcp-unreal:"
    Write-Host "1. Close Unreal Editor if it is open."
    if (Test-Path -LiteralPath $RemiphilippeProjectPlugin) {
        Write-Host "2. Open unreal\JarvisGauntlet\JarvisGauntlet.uproject in Unreal Engine 5.7."
        Write-Host "3. Restart the editor if Unreal asks to load newly compiled modules."
        Write-Host "4. Enable Remote Control API in Edit > Plugins if property-read tools are needed."
    } else {
        Write-Host "2. Copy tools\mcp-unreal-remiphilippe\plugin to unreal\JarvisGauntlet\Plugins\MCPUnreal only when ready to compile-test it."
        Write-Host "3. Open unreal\JarvisGauntlet\JarvisGauntlet.uproject in Unreal Engine 5.7."
        Write-Host "4. Enable MCPUnreal and Remote Control API in Edit > Plugins, then restart the editor when prompted."
    }
    Write-Host "5. Build the editor target if Unreal asks to rebuild modules."
    Write-Host "6. Register/start the MCP binary:"
    Write-Host "   $RemiphilippeBinary"
    Write-Host "7. Test the read-only MCP status tool first."
    Write-Host "8. For screenshots, prefer capture_viewport after the plugin is online; otherwise use scripts/unreal/capture-mcp-screenshot.py through Unreal Python."
}
finally {
    Pop-Location
}
