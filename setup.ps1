<#
.SYNOPSIS
    ANTARIX 2.O — Complete GPU Setup Script for Windows PowerShell.
    Sets up all three project tiers directly matching the GPU Dockerfile:
      1. AGENTIC-AI_GATEWAY (Python venv, Core API, PyTorch CUDA 12.4, ML/VLM, bitsandbytes, Geo, editable satquery)
      2. BACKEND (Node.js dependencies, Prisma client generation)
      3. frontend (React + Vite dependencies)

.DESCRIPTION
    1. Copies .env.example -> .env in all tiers.
    2. Sets up Python virtual environment in AGENTIC-AI_GATEWAY and installs all GPU dependencies.
    3. Sets up BACKEND and generates Prisma client.
    4. Sets up frontend with npm.

.PARAMETER RecreateVenv
    Force-recreate the Python virtual environment from scratch.

.PARAMETER ForceEnv
    Force-overwrite existing .env files from .env.example.

.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -RecreateVenv -ForceEnv
#>

[CmdletBinding()]
param (
    [switch]$RecreateVenv,
    [switch]$ForceEnv,
    [switch]$NoStart
)

function Print-Header {
    param ([string]$Msg)
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  $Msg" -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Print-Section {
    param ([string]$Msg)
    Write-Host ""
    Write-Host ">>> $Msg" -ForegroundColor Yellow
}

function Print-Success {
    param ([string]$Msg)
    Write-Host " [OK] $Msg" -ForegroundColor Green
}

function Print-Info {
    param ([string]$Msg)
    Write-Host " [INFO] $Msg" -ForegroundColor DarkCyan
}

function Print-Warn {
    param ([string]$Msg)
    Write-Host " [WARN] $Msg" -ForegroundColor Magenta
}

function Print-Err {
    param ([string]$Msg)
    Write-Host " [FAIL] $Msg" -ForegroundColor Red
}

$RootDir = $PSScriptRoot
Set-Location -LiteralPath $RootDir

Print-Header "ANTARIX 2.O - GPU Native Environment Setup"
Print-Info ("Project Root: " + $RootDir)

# ------------------------------------------------------------------------------
# Prerequisite Verification
# ------------------------------------------------------------------------------
Print-Section "Checking Prerequisites..."

# 1. Python Check
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Print-Err "Python is not installed or not in PATH."
    Write-Host "Please install Python 3.11+ and add it to PATH." -ForegroundColor Red
    exit 1
}
$pyVersion = (& python --version 2>&1).ToString().Trim()
Print-Success ("Found Python: " + $pyVersion + " at " + $pythonCmd.Source)

# 2. Node.js Check
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Print-Err "Node.js is not installed or not in PATH."
    Write-Host "Please install Node.js 18+ and add it to PATH." -ForegroundColor Red
    exit 1
}
$nodeVersion = (& node --version 2>&1).ToString().Trim()
Print-Success ("Found Node.js: " + $nodeVersion + " at " + $nodeCmd.Source)

# 3. npm Check
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Print-Err "npm is not installed or not in PATH."
    exit 1
}
$npmVersion = (& npm --version 2>&1).ToString().Trim()
Print-Success ("Found npm: v" + $npmVersion)

# ------------------------------------------------------------------------------
# STEP 1: Copy .env.example -> .env in all directories
# ------------------------------------------------------------------------------
Print-Section "Step 1: Setting up Environment Files (.env)..."

$envFolders = @(
    @{ Name = "Root"; Dir = $RootDir },
    @{ Name = "Agentic AI Gateway"; Dir = (Join-Path $RootDir "AGENTIC-AI_GATEWAY") },
    @{ Name = "Backend"; Dir = (Join-Path $RootDir "BACKEND") },
    @{ Name = "Frontend"; Dir = (Join-Path $RootDir "frontend") }
)

foreach ($item in $envFolders) {
    $folderName = $item.Name
    $folderDir = $item.Dir
    $exampleFile = Join-Path $folderDir ".env.example"
    $targetFile = Join-Path $folderDir ".env"

    if (Test-Path -LiteralPath $exampleFile) {
        $shouldCopy = $ForceEnv -or (-not (Test-Path -LiteralPath $targetFile))
        if ($shouldCopy) {
            Copy-Item -LiteralPath $exampleFile -Destination $targetFile -Force
            Print-Success ("Created .env for " + $folderName + " from .env.example")
        } else {
            Print-Info (".env already exists for " + $folderName + " (kept existing; use -ForceEnv to overwrite)")
        }
    } else {
        Print-Warn ("No .env.example found in " + $folderName)
    }
}

# ------------------------------------------------------------------------------
# STEP 2: Agentic AI Gateway GPU Setup (Matching AGENTIC-AI_GATEWAY/Dockerfile)
# ------------------------------------------------------------------------------
$gatewayDir = Join-Path $RootDir "AGENTIC-AI_GATEWAY"
Print-Section ("Step 2: Setting up Agentic AI Gateway with GPU support in " + $gatewayDir + "...")

if (-not (Test-Path -LiteralPath $gatewayDir)) {
    Print-Err ("Directory not found: " + $gatewayDir)
    exit 1
}

Push-Location -LiteralPath $gatewayDir
try {
    $venvDir = Join-Path $gatewayDir "venv"
    $venvPython = Join-Path $venvDir "Scripts\python.exe"
    $venvPip = Join-Path $venvDir "Scripts\pip.exe"
    $activateScript = Join-Path $venvDir "Scripts\Activate.ps1"

    # Remove existing venv if requested
    if ($RecreateVenv -and (Test-Path -LiteralPath $venvDir)) {
        Print-Info "Removing existing virtual environment..."
        Remove-Item -LiteralPath $venvDir -Recurse -Force
    }

    # Create venv
    if (-not (Test-Path -LiteralPath $venvPython)) {
        Print-Info "Creating Python virtual environment in AGENTIC-AI_GATEWAY\venv..."
        & python -m venv venv
        if ($LASTEXITCODE -ne 0) {
            Print-Err "Failed to create Python virtual environment."
            exit 1
        }
        Print-Success "Virtual environment created successfully."
    } else {
        Print-Info "Existing virtual environment found in AGENTIC-AI_GATEWAY\venv."
    }

    # Activate venv in this script context
    if (Test-Path -LiteralPath $activateScript) {
        Print-Info "Activating virtual environment..."
        & $activateScript
        $env:VIRTUAL_ENV = $venvDir
        $scriptsPath = Join-Path $venvDir "Scripts"
        $env:PATH = $scriptsPath + ";" + $env:PATH
        Print-Success "Virtual environment activated."
    }

    # 1. Upgrade pip, setuptools, wheel
    Print-Info "Upgrading pip, setuptools, and wheel..."
    & $venvPip install --upgrade pip setuptools wheel --quiet

    # 2. Install requirements.txt (Core API, FastAPI, LangGraph, LLM providers)
    $coreReq = Join-Path $gatewayDir "requirements.txt"
    if (Test-Path -LiteralPath $coreReq) {
        Print-Info "Installing core requirements from requirements.txt..."
        & $venvPip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) {
            Print-Err "Failed to install requirements.txt"
            exit 1
        }
        Print-Success "Core requirements installed successfully."
    }

    # 3. Install PyTorch & Torchvision with CUDA 12.4 (as in Gateway Dockerfile line 41)
    Print-Info "Installing PyTorch & Torchvision (CUDA 12.4 wheels from https://download.pytorch.org/whl/cu124)..."
    & $venvPip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
    if ($LASTEXITCODE -ne 0) {
        Print-Err "Failed to install PyTorch with CUDA 12.4. Verify network connection."
        exit 1
    }
    Print-Success "PyTorch and Torchvision with CUDA 12.4 installed successfully."

    # 4. Install requirements-ml.txt (Transformers, Accelerate, Qwen-VL-utils, SAM)
    $mlReq = Join-Path $gatewayDir "requirements-ml.txt"
    if (Test-Path -LiteralPath $mlReq) {
        Print-Info "Installing Vision / ML requirements from requirements-ml.txt..."
        & $venvPip install -r requirements-ml.txt
        if ($LASTEXITCODE -ne 0) {
            Print-Err "Failed to install requirements-ml.txt"
            exit 1
        }
        Print-Success "Vision / ML requirements installed successfully."
    }

    # 5. Install bitsandbytes (as in Gateway Dockerfile line 43 for 4-bit quantized VLM)
    Print-Info "Installing bitsandbytes for 4-bit quantized VLM inference..."
    & $venvPip install bitsandbytes
    if ($LASTEXITCODE -ne 0) {
        Print-Warn "bitsandbytes install returned code $LASTEXITCODE; please ensure an NVIDIA GPU and CUDA driver are configured."
    } else {
        Print-Success "bitsandbytes installed successfully."
    }

    # 6. Install requirements-geo.txt (Rasterio, Pyproj, STAC)
    $geoReq = Join-Path $gatewayDir "requirements-geo.txt"
    if (Test-Path -LiteralPath $geoReq) {
        Print-Info "Installing geospatial tools from requirements-geo.txt..."
        & $venvPip install -r requirements-geo.txt
        if ($LASTEXITCODE -ne 0) {
            Print-Warn "Geospatial requirements encountered an issue; Gateway will fallback to Pillow pixel-space."
        } else {
            Print-Success "Geospatial requirements installed successfully."
        }
    }

    # 7. Install satquery package in editable mode
    Print-Info "Installing satquery package in editable mode (pip install --no-deps -e .)..."
    & $venvPip install --no-deps -e .
    if ($LASTEXITCODE -ne 0) {
        Print-Warn "Editable install exited with code $LASTEXITCODE."
    } else {
        Print-Success "satquery package installed in editable mode."
    }

    Print-Success "Agentic AI Gateway GPU setup completed!"
}
finally {
    Pop-Location
}

# ------------------------------------------------------------------------------
# STEP 3: Setup Backend (Node.js + Prisma)
# ------------------------------------------------------------------------------
$backendDir = Join-Path $RootDir "BACKEND"
Print-Section ("Step 3: Setting up Backend Microservice in " + $backendDir + "...")

if (-not (Test-Path -LiteralPath $backendDir)) {
    Print-Err ("Directory not found: " + $backendDir)
    exit 1
}

Push-Location -LiteralPath $backendDir
try {
    Print-Info "Installing npm dependencies in BACKEND..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Print-Err "Failed to install backend npm dependencies."
        exit 1
    }
    Print-Success "Backend dependencies installed successfully."

    # Generate Prisma Client
    Print-Info "Generating Prisma client (npx prisma generate --config prisma7.config.ts)..."
    $prismaConfig = Join-Path $backendDir "prisma7.config.ts"
    if (Test-Path -LiteralPath $prismaConfig) {
        & npx prisma generate --config prisma7.config.ts
    } else {
        & npx prisma generate
    }
    if ($LASTEXITCODE -ne 0) {
        Print-Warn "Prisma generate exited with non-zero code. Verify your prisma schema."
    } else {
        Print-Success "Prisma client successfully generated in src/generated!"
    }

    Print-Success "Backend setup complete!"
}
finally {
    Pop-Location
}

# ------------------------------------------------------------------------------
# STEP 4: Setup Frontend (React + Vite)
# ------------------------------------------------------------------------------
$frontendDir = Join-Path $RootDir "frontend"
Print-Section ("Step 4: Setting up Frontend Web App in " + $frontendDir + "...")

if (-not (Test-Path -LiteralPath $frontendDir)) {
    Print-Err ("Directory not found: " + $frontendDir)
    exit 1
}

Push-Location -LiteralPath $frontendDir
try {
    Print-Info "Installing npm dependencies in frontend..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Print-Err "Failed to install frontend npm dependencies."
        exit 1
    }
    Print-Success "Frontend dependencies installed successfully."
    Print-Success "Frontend setup complete!"
}
finally {
    Pop-Location
}

# ------------------------------------------------------------------------------
# SUMMARY & AUTOMATIC SERVICE LAUNCH
# ------------------------------------------------------------------------------
Print-Header "GPU SETUP COMPLETED SUCCESSFULLY!"

Write-Host "All tiers are installed and configured for native high-speed GPU execution!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Ports and Endpoints:" -ForegroundColor Cyan
Write-Host "  1. Agentic AI Gateway : http://localhost:8000 (FastAPI / Qwen2-VL 4-bit GPU)"
Write-Host "  2. Backend REST/Socket: http://localhost:7000 (Express / Socket.IO)"
Write-Host "  3. Frontend Web App   : http://localhost:5173 or :3000 (React / Vite)"
Write-Host "  4. PostgreSQL         : localhost:5432 (database: satquery)"
Write-Host ""

if (-not $NoStart) {
    Print-Header "AUTOMATICALLY LAUNCHING ALL SERVICES..."
    Write-Host "Spawning all 3 services in separate live PowerShell windows..." -ForegroundColor Green
    Write-Host ""

    # 1. AI Gateway with GPU
    $gatewayCmd = "cd '$gatewayDir'; & .\venv\Scripts\Activate.ps1; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  AGENTIC AI GATEWAY (Port 8000)' -ForegroundColor White; Write-Host '========================================' -ForegroundColor Cyan; python -m satquery"
    Write-Host "  [1/3] Launching Agentic AI Gateway (http://localhost:8000)..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $gatewayCmd

    # 2. Backend
    $backendCmd = "cd '$backendDir'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  BACKEND REST & SOCKET (Port 7000)' -ForegroundColor White; Write-Host '========================================' -ForegroundColor Cyan; npm run dev"
    Write-Host "  [2/3] Launching Backend REST & Socket Server (http://localhost:7000)..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $backendCmd

    # 3. Frontend
    $frontendCmd = "cd '$frontendDir'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  FRONTEND WEB APP (Port 5173)' -ForegroundColor White; Write-Host '========================================' -ForegroundColor Cyan; npm run dev"
    Write-Host "  [3/3] Launching React Frontend (http://localhost:5173)..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $frontendCmd

    Write-Host ""
    Print-Success "All 3 services are now running in their own terminal windows!"
} else {
    Write-Host "Auto-start skipped (-NoStart was passed)." -ForegroundColor Yellow
}

