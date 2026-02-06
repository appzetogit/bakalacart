# Clean Build Script for BakalaCart Frontend
# This script ensures a clean build by removing all caches and rebuilding

Write-Host "🧹 Cleaning build artifacts and caches..." -ForegroundColor Cyan

# Remove build output
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✓ Removed dist folder" -ForegroundColor Green
}

# Remove Vite cache
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "✓ Removed Vite cache" -ForegroundColor Green
}

# Remove node_modules (optional - uncomment if needed)
# if (Test-Path "node_modules") {
#     Remove-Item -Recurse -Force "node_modules"
#     Write-Host "✓ Removed node_modules" -ForegroundColor Green
# }

Write-Host "`n🔨 Rebuilding production bundle..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build completed successfully!" -ForegroundColor Green
    Write-Host "📦 Production files are in the 'dist' folder" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Build failed. Please check the errors above." -ForegroundColor Red
    exit 1
}
