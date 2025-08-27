# Start test Postgres and run TypeORM migrations against it
$compose = Join-Path $PSScriptRoot 'docker-compose.test.yml'
Write-Host "Starting test Postgres..."
docker compose -f $compose up -d

# Wait for Postgres to become ready
Write-Host "Waiting for Postgres to be ready (max 60s)..."
$max = 60
for ($i=0; $i -lt $max; $i++) {
  try {
    $out = docker run --rm --network host alpine sh -c "apk add --no-cache postgresql-client >/dev/null 2>&1; pg_isready -h 127.0.0.1 -p 55432"
    if ($LASTEXITCODE -eq 0) { break }
  } catch {}
  Start-Sleep -Seconds 1
}

if ($i -eq $max-1) {
  Write-Error "Postgres did not become ready in time"
  exit 1
}

Write-Host "Running TypeORM migrations..."
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '55432'
$env:DB_USER = 'postgres'
$env:DB_PASSWORD = 'password'
$env:DB_NAME = 'fundshield_test'

npm run migrate

Write-Host "Migrations completed. You can stop the test DB with: docker compose -f $compose down"
