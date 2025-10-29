@echo off
REM Installation script for Japanese Homework CLI (jphw) on Windows
REM Automatically detects and installs Deno, then sets up the CLI executable

setlocal enabledelayedexpansion

REM Project directory
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo ================================================
echo Japanese Homework CLI (jphw) Installation
echo ================================================
echo.

REM Check if Deno is already installed
where deno >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=2" %%i in ('deno --version ^| findstr "deno"') do set DENO_VERSION=%%i
    echo [SUCCESS] Deno is already installed (version !DENO_VERSION!)
    goto :install_playwright
)

echo [INFO] Deno is not installed
echo [INFO] Starting Deno installation...

REM Try npm first
where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Attempting to install Deno using npm...
    call npm install -g deno
    if %errorlevel% equ 0 (
        echo [SUCCESS] Deno installed successfully via npm
        goto :install_playwright
    ) else (
        echo [WARNING] Failed to install Deno via npm
    )
)

REM Try chocolatey
where choco >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Attempting to install Deno using Chocolatey...
    call choco install deno -y
    if %errorlevel% equ 0 (
        echo [SUCCESS] Deno installed successfully via Chocolatey
        goto :install_playwright
    ) else (
        echo [WARNING] Failed to install Deno via Chocolatey
    )
)

REM Try scoop
where scoop >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Attempting to install Deno using Scoop...
    call scoop install deno
    if %errorlevel% equ 0 (
        echo [SUCCESS] Deno installed successfully via Scoop
        goto :install_playwright
    ) else (
        echo [WARNING] Failed to install Deno via Scoop
    )
)

REM Try winget
where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Attempting to install Deno using winget...
    call winget install DenoLand.Deno
    if %errorlevel% equ 0 (
        echo [SUCCESS] Deno installed successfully via winget
        goto :install_playwright
    ) else (
        echo [WARNING] Failed to install Deno via winget
    )
)

REM Fallback to official installer using PowerShell
echo [INFO] Attempting to install Deno using the official installer...
powershell -Command "irm https://deno.land/install.ps1 | iex"
if %errorlevel% equ 0 (
    REM Add Deno to PATH for this session
    set "DENO_INSTALL=%USERPROFILE%\.deno"
    set "PATH=%DENO_INSTALL%\bin;%PATH%"
    echo [SUCCESS] Deno installed successfully via official installer
    goto :install_playwright
) else (
    echo [ERROR] Failed to install Deno using all available methods
    echo [ERROR] Please install Deno manually from https://deno.com/
    pause
    exit /b 1
)

:install_playwright
echo.
echo [INFO] Installing Playwright browsers...
call deno run -A npm:playwright install chromium
if %errorlevel% equ 0 (
    echo [SUCCESS] Playwright Chromium browser installed successfully
) else (
    echo [WARNING] Failed to install Playwright browsers automatically
    echo [WARNING] You may need to run 'deno run -A npm:playwright install chromium' manually later
)

:create_executable
echo.
echo [INFO] Creating jphw executable wrapper...

REM Create wrapper batch file in user's bin directory
set "BIN_DIR=%USERPROFILE%\.local\bin"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

set "WRAPPER_PATH=%BIN_DIR%\jphw.bat"

REM Create the wrapper batch file
(
    echo @echo off
    echo REM jphw - Japanese Homework CLI wrapper
    echo REM This script runs the CLI from the installation directory
    echo.
    echo set "JPHW_DIR=%PROJECT_DIR%"
    echo set "JPHW_DIR=%%JPHW_DIR:\=/%%"
    echo cd /d "%%JPHW_DIR%%" ^&^& deno task start %%*
) > "%WRAPPER_PATH%"

echo [SUCCESS] Created executable at %WRAPPER_PATH%

:add_to_path
echo.
echo [INFO] Adding jphw to PATH...

REM Check if BIN_DIR is already in PATH
echo %PATH% | findstr /C:"%BIN_DIR%" >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] %BIN_DIR% is already in PATH
    goto :check_deno_path
)

REM Add to user PATH using PowerShell
echo [INFO] Adding %BIN_DIR% to user PATH...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%BIN_DIR%', 'User')"
if %errorlevel% equ 0 (
    echo [SUCCESS] Added %BIN_DIR% to user PATH
    echo [WARNING] Please restart your command prompt or terminal to use jphw
) else (
    echo [WARNING] Failed to add to PATH automatically
    echo [WARNING] Please add %BIN_DIR% to your PATH manually
)

REM Add to current session
set "PATH=%BIN_DIR%;%PATH%"

:check_deno_path
REM Check if Deno is in PATH, if not add it
set "DENO_INSTALL=%USERPROFILE%\.deno"
if exist "%DENO_INSTALL%\bin" (
    echo %PATH% | findstr /C:"%DENO_INSTALL%\bin" >nul
    if !errorlevel! neq 0 (
        echo [INFO] Adding Deno to user PATH...
        powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%DENO_INSTALL%\bin', 'User')"
        if !errorlevel! equ 0 (
            echo [SUCCESS] Added Deno to user PATH
        )
        REM Add to current session
        set "PATH=%DENO_INSTALL%\bin;!PATH!"
    )
)

:success
echo.
echo ================================================
echo Installation completed successfully!
echo ================================================
echo.
echo [INFO] You can now use 'jphw' command from anywhere
echo [INFO] If the command is not found, please restart your command prompt
echo.
echo [INFO] To get started, run: jphw --help
echo.
pause
exit /b 0
