docker compose down
if ($LASTEXITCODE -eq 0) {
    Write-Output "Application stopped."
}
