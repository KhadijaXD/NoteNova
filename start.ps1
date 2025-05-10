# Script to start the Smart Note Organizer application
Write-Host "Starting Smart Note Organizer..." -ForegroundColor Cyan

# Check if port 5000 is already in use and stop it if needed
$portInUse = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 5000 is already in use. Stopping the process..." -ForegroundColor Yellow
    try {
        $process = Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            $process | Stop-Process -Force
            Write-Host "Process stopped successfully." -ForegroundColor Green
        }
    } catch {
        Write-Host "Could not stop the process. Please stop it manually." -ForegroundColor Red
    }
}

# Define paths for the backend and frontend
$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

# Use the node_modules/.bin/concurrently from the root directory
$concurrentlyPath = Join-Path $PSScriptRoot "node_modules/.bin/concurrently"

# Check if concurrently is installed
if (-Not (Test-Path $concurrentlyPath)) {
    Write-Host "Concurrently not found. Installing it..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot
    npm install concurrently --save-dev
}

# Set location to the script directory
Set-Location $PSScriptRoot

# Start both servers with concurrently
Write-Host "Starting servers..." -ForegroundColor Green
npx concurrently "cd backend && npm run dev" "cd frontend && npm start" 