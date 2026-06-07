$ErrorActionPreference = "Stop"

function Find-FirstExistingPath {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Paths
  )

  foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path) {
      return (Resolve-Path -LiteralPath $path).Path
    }
  }

  return $null
}

function Write-Check {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [AllowNull()]
    [string] $Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "[MISSING] $Name"
    return
  }

  Write-Host "[OK] $Name`: $Value"
}

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")

$engineCandidates = @(
  "D:\UE_5.7",
  "D:\UE_5.6",
  "D:\UE_5.5",
  "D:\UE_5.4",
  "D:\Epic Games\UE_5.7",
  "D:\Epic Games\UE_5.6",
  "D:\Epic Games\UE_5.5",
  "D:\Epic Games\UE_5.4",
  "C:\Program Files\Epic Games\UE_5.7",
  "C:\Program Files\Epic Games\UE_5.6",
  "C:\Program Files\Epic Games\UE_5.5",
  "C:\Program Files\Epic Games\UE_5.4"
)

$enginePath = Find-FirstExistingPath -Paths $engineCandidates

if (-not $enginePath) {
  $enginePath = Get-ChildItem -LiteralPath "D:\" -Directory -Filter "UE_*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $enginePath -and (Test-Path -LiteralPath "D:\Epic Games")) {
  $enginePath = Get-ChildItem -LiteralPath "D:\Epic Games" -Directory -Filter "UE_*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $enginePath -and (Test-Path -LiteralPath "C:\Program Files\Epic Games")) {
  $enginePath = Get-ChildItem -LiteralPath "C:\Program Files\Epic Games" -Directory -Filter "UE_*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

$repoProjectPath = Join-Path $repoRoot "unreal\JarvisGauntlet\JarvisGauntlet.uproject"
$externalProjectPath = "D:\JarvisGauntlet\JarvisGauntlet\JarvisGauntlet.uproject"

$uprojectCandidates = @(
  $repoProjectPath,
  "D:\JarvisGauntlet\JarvisGauntlet.uproject",
  $externalProjectPath
)

$uprojectPath = Find-FirstExistingPath -Paths $uprojectCandidates

$buildBatPath = $null
$unrealEditorPath = $null

if ($enginePath) {
  $buildBatPath = Find-FirstExistingPath -Paths @(
    (Join-Path $enginePath "Engine\Build\BatchFiles\Build.bat")
  )
  $unrealEditorPath = Find-FirstExistingPath -Paths @(
    (Join-Path $enginePath "Engine\Binaries\Win64\UnrealEditor.exe")
  )
}

Write-Host "JARVIS Unreal verification"
Write-Host "Repository: $repoRoot"
Write-Host "Project preference: repo-local unreal\JarvisGauntlet, then external fallback"
Write-Check -Name "Unreal Engine path" -Value $enginePath
Write-Check -Name "JarvisGauntlet.uproject" -Value $uprojectPath
Write-Check -Name "Build.bat" -Value $buildBatPath
Write-Check -Name "UnrealEditor.exe" -Value $unrealEditorPath

if ($buildBatPath -and $uprojectPath) {
  $buildCommand = "`"$buildBatPath`" JarvisGauntletEditor Win64 Development `"$uprojectPath`" -WaitMutex"
  Write-Host ""
  Write-Host "Editor build command:"
  Write-Host $buildCommand
} else {
  Write-Host ""
  Write-Host "Editor build command unavailable until both Build.bat and JarvisGauntlet.uproject are detected."
}

if ($unrealEditorPath -and $uprojectPath) {
  $editorCommand = "`"$unrealEditorPath`" `"$uprojectPath`""
  Write-Host ""
  Write-Host "Editor launch command:"
  Write-Host $editorCommand
}
