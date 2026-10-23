# build_cpanel.ps1
# Compiles a clean, organized zip for cPanel deployment

Write-Host "Starting cPanel build process..." -ForegroundColor Cyan

# 1. Build the React frontend
Write-Host "`n[1/4] Building React frontend..." -ForegroundColor Yellow
npm run build

if (-not (Test-Path "dist")) {
    Write-Host "Error: Build failed! dist/ folder not found." -ForegroundColor Red
    exit 1
}

# 2. Create organized folder structure
Write-Host "`n[2/4] Organizing files into staging directory..." -ForegroundColor Yellow
$deployDir = "cpanel_deploy_temp"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null
New-Item -ItemType Directory -Path "$deployDir/backend" | Out-Null

# 2a. Copy frontend dist files
Write-Host "      Copying frontend files from dist/..."
Copy-Item -Path "dist\*" -Destination $deployDir -Recurse

# Remove any stray PHP files Vite may have copied from /public into dist
Get-ChildItem -Path $deployDir -Filter "*.php" -File | Remove-Item -Force

# 2b. Copy backend PHP files to /backend/
Write-Host "      Copying backend PHP scripts to /backend/..."
$backendFiles = @(
    "api.php",
    "auth_helper.php",
    "backup_handler.php",
    "cron_worker.php",
    "db.php",
    "mail_handler.php",
    "migrate.php",
    "migrate_images.php",
    "runpost.php",
    "clear_device_tickets.php",
    "diagnose_email.php",
    "upgrade.php",
    "upgrade_db.php",
    "upgrade_v2.php"
)

foreach ($file in $backendFiles) {
    if (Test-Path "cpanel\$file") {
        Copy-Item -Path "cpanel\$file" -Destination "$deployDir\backend\"
    } else {
        Write-Host "      [skip] cpanel\$file not found" -ForegroundColor DarkGray
    }
}

# Copy backend directories
$backendDirs = @("PHPMailer", "logs", "routes")
foreach ($dir in $backendDirs) {
    if (Test-Path "cpanel\$dir") {
        Copy-Item -Path "cpanel\$dir" -Destination "$deployDir\backend\" -Recurse
    }
}

# 2c. Copy root-level files
Write-Host "      Copying root configs (.htaccess, favicons, diagnose_email, etc)..."
$rootFiles = @(".htaccess", "meta.png", "password.html", "favicon.ico", "favicon.png", "clear_device_tickets.php", "diagnose_email.php")
foreach ($file in $rootFiles) {
    if (Test-Path "cpanel\$file") {
        Copy-Item -Path "cpanel\$file" -Destination $deployDir
    }
}

if (Test-Path "cpanel\.well-known") {
    Copy-Item -Path "cpanel\.well-known" -Destination $deployDir -Recurse
}

# 2d. Sync compiled assets to local cpanel/ directory as well
Write-Host "      Syncing latest bundle into local cpanel/ directory..."
Copy-Item -Path "dist\index.html" -Destination "cpanel\index.html" -Force
if (Test-Path "cpanel\assets") {
    Remove-Item -Recurse -Force "cpanel\assets\*"
} else {
    New-Item -ItemType Directory -Path "cpanel\assets" | Out-Null
}
Copy-Item -Path "dist\assets\*" -Destination "cpanel\assets\" -Recurse -Force

# 2e. Package updated cPanel production .env
if (Test-Path "cpanel\.env") {
    Write-Host "      Packaging verified cpanel/.env into root and /backend/..." -ForegroundColor Green
    Copy-Item -Path "cpanel\.env" -Destination "$deployDir\.env" -Force
    Copy-Item -Path "cpanel\.env" -Destination "$deployDir\backend\.env" -Force
    Copy-Item -Path "cpanel\.env" -Destination "$deployDir\.env.production" -Force
}


# 3. Create zip
Write-Host "`n[3/4] Compressing to deploy_cpanel.zip..." -ForegroundColor Yellow
$zipFile = "deploy_cpanel.zip"
if (Test-Path $zipFile) {
    Remove-Item -Force $zipFile
}

Start-Sleep -Seconds 1

Add-Type -AssemblyName System.IO.Compression.FileSystem
$deployDirAbs = Join-Path (Get-Location).Path $deployDir
$zipFileAbs   = Join-Path (Get-Location).Path $zipFile
[System.IO.Compression.ZipFile]::CreateFromDirectory($deployDirAbs, $zipFileAbs)

# 4. Clean up staging folder
Write-Host "`n[4/4] Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $deployDir

$zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "SUCCESS! deploy_cpanel.zip is ready ($zipSize MB)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Deploy steps:"
Write-Host "  1. Upload deploy_cpanel.zip to cPanel File Manager"
Write-Host "  2. Extract into your domain/subdomain root"
Write-Host "  3. KEEP the existing 'uploads' and 'backups' folders"
Write-Host "  4. If first deploy: visit /backend/api.php?action=upgrade (as staff)"
Write-Host "=======================================================" -ForegroundColor Green
