docker compose up --build -d
if ($LASTEXITCODE -eq 0) {
    Write-Output "Application started at http://localhost:8000"
}
