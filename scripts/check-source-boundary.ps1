param()

$sourcePath = $null
$requiredTokens = @()
$forbiddenTokens = @()

$mode = $null
$knownFlags = @(
  "-SourcePath",
  "-RequiredToken",
  "-ForbiddenToken"
)

foreach ($arg in $args) {
  if ($knownFlags -contains $arg) {
    $mode = $arg
    continue
  }

  if ($mode -eq "-SourcePath") {
    if ($null -eq $sourcePath) {
      $sourcePath = $arg
      continue
    }

    Write-Output "UNEXPECTED_ARGUMENT: $arg"
    exit 1
  }

  if ($mode -eq "-RequiredToken") {
    $requiredTokens += $arg
    continue
  }

  if ($mode -eq "-ForbiddenToken") {
    $forbiddenTokens += $arg
    continue
  }

  Write-Output "UNEXPECTED_ARGUMENT: $arg"
  exit 1
}

$hasViolation = $false

if ([string]::IsNullOrWhiteSpace($sourcePath)) {
  Write-Output "SOURCE_UNREADABLE: "
  exit 1
}

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  Write-Output "SOURCE_UNREADABLE: $sourcePath"
  exit 1
}

try {
  $source = Get-Content -LiteralPath $sourcePath -Raw -ErrorAction Stop
} catch {
  Write-Output "SOURCE_UNREADABLE: $sourcePath"
  exit 1
}

$lowerSource = $source.ToLowerInvariant()

foreach ($token in $requiredTokens) {
  if (-not $source.Contains($token)) {
    Write-Output "MISSING_REQUIRED: $token"
    $hasViolation = $true
  }
}

foreach ($token in $forbiddenTokens) {
  if ($lowerSource.Contains($token.ToLowerInvariant())) {
    Write-Output "FOUND_FORBIDDEN: $token"
    $hasViolation = $true
  }
}

if ($hasViolation) {
  exit 1
}

exit 0

