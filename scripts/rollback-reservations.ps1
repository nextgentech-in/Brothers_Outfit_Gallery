param(
  [string]$BaseUrl = 'http://localhost:3001',
  [switch]$Apply
)

$resolved = [Uri]$BaseUrl
if ($resolved.Scheme -ne 'https' -and $resolved.Host -notin @('localhost', '127.0.0.1')) {
  throw 'Use HTTPS for remote rollback targets.'
}
if (-not $Apply) {
  Write-Output 'Dry run: disable ERP_RESERVATIONS_ENABLED in the website deployment, then run this script with -Apply to release active checkout holds. Accepted orders and stock movements remain intact.'
  exit 0
}
if (-not $env:CRON_SECRET) { throw 'CRON_SECRET must be set in this shell; it is never printed.' }
$uri = "$($BaseUrl.TrimEnd('/'))/api/jobs/drain-reservations"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
for ($page = 0; $page -lt 100; $page++) {
  $result = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -ErrorAction Stop
  if ($result.failed -gt 0) { throw 'Some holds could not be released. Review the response and retry; do not delete stock history.' }
  if ($result.inspected -eq 0) { Write-Output 'All active holds released; existing reserved fields are retained at zero.'; exit 0 }
  Write-Output "Released $($result.released) holds in batch $($page + 1)."
}
throw 'More than 100 batches remain. Inspect active holds and rerun after review.'
