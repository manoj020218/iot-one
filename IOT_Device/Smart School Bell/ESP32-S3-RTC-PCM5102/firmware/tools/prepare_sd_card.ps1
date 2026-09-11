[CmdletBinding()]
param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\..\..\bells'),
  [Parameter(Mandatory = $true)]
  [string]$SdRoot
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDir).Path
$destination = (Resolve-Path -LiteralPath $SdRoot).Path
$audioFiles = @(Get-ChildItem -LiteralPath $source -File |
    Where-Object { $_.Extension.ToLowerInvariant() -in '.mp3', '.wav' } |
    Sort-Object Name)

if ($audioFiles.Count -eq 0) {
  throw "No MP3 or WAV files found in $source"
}

$soundsDir = Join-Path $destination 'sounds'
New-Item -ItemType Directory -Path $soundsDir -Force | Out-Null

$profiles = [ordered]@{
  'sd-mp3' = [ordered]@{
    name = 'Local SD Card MP3'
    source = 'sd-card'
    transport = 'file'
    format = 'mp3'
    enabled = $true
  }
  'sd-wav' = [ordered]@{
    name = 'Local SD Card WAV'
    source = 'sd-card'
    transport = 'file'
    format = 'wav'
    enabled = $true
  }
}

$sounds = [ordered]@{}
foreach ($audioFile in $audioFiles) {
  Copy-Item -LiteralPath $audioFile.FullName -Destination (Join-Path $soundsDir $audioFile.Name) -Force
  $profile = if ($audioFile.Extension.Equals('.mp3', [System.StringComparison]::OrdinalIgnoreCase)) {
    'sd-mp3'
  } else {
    'sd-wav'
  }
  $soundId = $audioFile.BaseName
  if ($sounds.Contains($soundId)) {
    throw "Duplicate sound id '$soundId' generated from $($audioFile.Name)"
  }
  $sounds[$soundId] = [ordered]@{
    profile = $profile
    file = "sounds/$($audioFile.Name)"
  }
}

$defaultFile = $audioFiles | Where-Object Name -EQ '00.mp3' | Select-Object -First 1
if ($null -eq $defaultFile) { $defaultFile = $audioFiles[0] }
$sounds.Insert(0, 'default', [ordered]@{
  profile = if ($defaultFile.Extension -ieq '.mp3') { 'sd-mp3' } else { 'sd-wav' }
  file = "sounds/$($defaultFile.Name)"
})

$assemblyFile = $audioFiles | Where-Object Name -EQ '16-Assembly.mp3' | Select-Object -First 1
if ($null -ne $assemblyFile) {
  $sounds.Insert(1, 'school', [ordered]@{
    profile = 'sd-mp3'
    file = "sounds/$($assemblyFile.Name)"
  })
}

$manifest = [ordered]@{ profiles = $profiles; sounds = $sounds }
$manifestPath = Join-Path $destination 'sounds_manifest.json'
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $utf8WithoutBom)

$sampleDir = Join-Path $PSScriptRoot 'sample_export'
foreach ($configName in 'device.json', 'schedules.json', 'schedule_profiles.json', 'holidays.json', 'bell_presets.json') {
  $configSource = Join-Path $sampleDir $configName
  if (Test-Path -LiteralPath $configSource) {
    Copy-Item -LiteralPath $configSource -Destination (Join-Path $destination $configName) -Force
  }
}

Write-Host "Prepared $($audioFiles.Count) audio files at $destination"
Write-Host "Manifest: $manifestPath"
