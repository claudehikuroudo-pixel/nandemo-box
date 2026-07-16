# itsukura demo video auto-edit pipeline (ASCII only; telop text lives in telops.json)
# usage: powershell -ExecutionPolicy Bypass -File make_demo.ps1 -In <video> [-Telops <json>] [-Bgm <audio>] [-Out <mp4>]
param(
  [Parameter(Mandatory=$true)][string]$In,
  [string]$Telops = "",
  [string]$Bgm = "",
  [string]$Out = ""
)
$ErrorActionPreference = "Stop"
$dir = "C:\Users\sugizaki\Desktop\nandemo-box\demo-video"

# ffmpeg/ffprobe executables (winget shim; PATH refresh not required)
$FF  = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\ffmpeg.exe"
$FFP = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\ffprobe.exe"
if (-not (Test-Path $FF))  { $FF = "ffmpeg" }
if (-not (Test-Path $FFP)) { $FFP = "ffprobe" }

if (-not (Test-Path $In)) { throw "input video not found: $In" }
if ([string]::IsNullOrEmpty($Out)) { $Out = Join-Path $dir ("output\demo_" + (Get-Date -Format "MMdd_HHmm") + ".mp4") }
if ([string]::IsNullOrEmpty($Telops)) { $Telops = Join-Path $dir "telops.json" }

# --- duration ---
$durStr = & $FFP -v error -show_entries format=duration -of csv=p=0 "$In"
if ([string]::IsNullOrWhiteSpace("$durStr")) { throw "ffprobe returned no duration" }
$dur = [math]::Floor([double]$durStr)

# --- telops: json array of {t, s, e}. s/e <= 1 are treated as ratio of duration ---
# NOTE: PowerShell vars are case-insensitive -> use a distinct name from param $Telops
$telopList = @()
if (Test-Path $Telops) {
  $raw = Get-Content $Telops -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($x in $raw) {
    $s = [double]$x.s; $e = [double]$x.e
    if ($s -le 1 -and $e -le 1) { $s = [math]::Floor($s*$dur); $e = [math]::Ceiling($e*$dur) }
    $telopList += ,@{ t = [string]$x.t; s = $s; e = $e }
  }
}

# --- bgm: default = first audio file in bgm/ ---
if ([string]::IsNullOrEmpty($Bgm)) {
  $bgmDir = Join-Path $dir "bgm"
  if (Test-Path $bgmDir) {
    $cand = Get-ChildItem -Path $bgmDir -File | Where-Object { $_.Extension -in ".mp3",".m4a",".wav" } | Select-Object -First 1
    if ($cand) { $Bgm = $cand.FullName }
  }
}

# --- build drawtext chain (utf-8 textfiles to avoid quoting issues) ---
$font = "C\:/Windows/Fonts/YuGothB.ttc"
$tmpDir = Join-Path $dir "_tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$fx = @("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x101018")
$i = 0
foreach ($tp in $telopList) {
  $tf = Join-Path $tmpDir ("t$i.txt")
  [System.IO.File]::WriteAllText($tf, [string]$tp.t, (New-Object System.Text.UTF8Encoding($false)))
  $tfEsc = ($tf -replace '\\','/') -replace ':','\:'
  $fx += "drawtext=fontfile='$font':textfile='$tfEsc':fontsize=64:fontcolor=white:borderw=4:bordercolor=black@0.6:x=(w-text_w)/2:y=h-330:enable='between(t,$($tp.s),$($tp.e))'"
  $i++
}
$vf = ($fx -join ",")

# --- run ffmpeg (ffmpeg logs to stderr; keep EAP relaxed + send log to file so PS5.1 does not treat it as error) ---
$log = Join-Path $tmpDir "ffmpeg.log"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
if (-not [string]::IsNullOrEmpty($Bgm) -and (Test-Path $Bgm)) {
  $fadeSt = [math]::Max(0, $dur - 2)
  & $FF -y -v warning -i "$In" -stream_loop -1 -i "$Bgm" -shortest `
    -filter_complex "[0:v]$vf[v];[1:a]volume=0.45,afade=t=out:st=${fadeSt}:d=2[a]" `
    -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -c:a aac -b:a 128k -t $dur "$Out" 2>$log
} else {
  Write-Warning "no BGM found (drop an mp3 into bgm/ once; silent demo is not recommended)"
  & $FF -y -v warning -i "$In" -vf "$vf" -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -an "$Out" 2>$log
}
$code = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($code -ne 0) { Get-Content $log -Tail 8 | Write-Output; throw "ffmpeg failed (exit $code)" }
Write-Output "DONE: $Out"
