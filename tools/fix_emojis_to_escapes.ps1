# tools/fix_emojis_to_escapes.ps1
# Run from repo root:
#   PowerShell -ExecutionPolicy Bypass -File .\tools\fix_emojis_to_escapes.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$backupRoot = Join-Path $repoRoot ('.backup_fix_emojis_' + [int][double]::Parse((Get-Date -UFormat %s)))
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$targets = @(
  'src/renderer/components/PromptPanel.jsx',
  'src/renderer/components/ConfirmModal.jsx',
  'src/renderer/components/TopBar.jsx',
  'src/renderer/components/StatusBar.jsx'
) | Where-Object { Test-Path $_ }

if (-not $targets) {
  Write-Host "No target files found. Exiting."
  exit 0
}

function Backup-File($f) {
  $dest = Join-Path $backupRoot $f
  $d = Split-Path $dest -Parent
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  Copy-Item -Force -Path $f -Destination $dest
  Write-Host "Backed up $f -> $dest"
}

function Replace-InFile($f, $replacements) {
  $text = Get-Content -Raw -Path $f
  $orig = $text
  foreach ($pair in $replacements.GetEnumerator()) {
    $pattern = [regex]::Escape($pair.Key)
    $replacement = $pair.Value
    $text = [regex]::Replace($text, $pattern, $replacement)
  }
  if ($text -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $f).ProviderPath, $text, $enc)
    Write-Host "Patched: $f"
  } else {
    Write-Host "No change: $f"
  }
}

# Replacement map: literal emoji -> JS-safe string literal (unicode escapes inside quotes)
$map = @{
  '✨ AI Assistant' = "{'\\u2728 AI Assistant'}"
  '👤 You' = "'\\uD83D\\uDC64 You'"
  '🤖 Assistant' = "'\\uD83E\\uDD16 Assistant'"
  '"👤 You"' = "'\\uD83D\\uDC64 You'"
  '"🤖 Assistant"' = "'\\uD83E\\uDD16 Assistant'"
  '⏳' = "'\\u23F3'"
  '📤' = "'\\uD83D\\uDCE4'"
  '✕' = "'\\u2715'"
  '✅' = "'\\u2705'"
  '❌' = "'\\u274C'"
}

# Additional replacements where emoji appear adjacent to text nodes or inside JSX:
# Replace common header literal occurrences (handles small variations)
$extraMap = @{
  '✨' = "'\\u2728'"
  '🤖' = "'\\uD83E\\uDD16'"
  '👤' = "'\\uD83D\\uDC64'"
  '📤' = "'\\uD83D\\uDCE4'"
  '⏳' = "'\\u23F3'"
  '✕' = "'\\u2715'"
}

# Merge maps: prefer specific full-string replacements first
$replacements = New-Object 'System.Collections.Generic.Dictionary[string,string]'
foreach ($k in $map.Keys) { $replacements[$k] = $map[$k] }
foreach ($k in $extraMap.Keys) { if (-not $replacements.ContainsKey($k)) { $replacements[$k] = $extraMap[$k] } }

# Run patch
foreach ($file in $targets) {
  Backup-File $file
  Replace-InFile $file $replacements
}

Write-Host "`nDone. Backups at: $backupRoot"
Write-Host "Restart dev server: stop running processes and run `npm run dev`."