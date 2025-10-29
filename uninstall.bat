@echo off
REM Uninstallation script for Japanese Homework CLI (jphw) on Windows

setlocal enabledelayedexpansion

echo ================================================
echo Japanese Homework CLI (jphw) Uninstallation
echo ================================================
echo.

REM Remove executable wrapper
set "BIN_DIR=%USERPROFILE%\.local\bin"
set "WRAPPER_PATH=%BIN_DIR%\jphw.bat"

if exist "%WRAPPER_PATH%" (
    echo [INFO] Removing jphw executable...
    del /q "%WRAPPER_PATH%"
    if %errorlevel% equ 0 (
        echo [SUCCESS] Removed %WRAPPER_PATH%
    ) else (
        echo [ERROR] Failed to remove %WRAPPER_PATH%
    )
) else (
    echo [INFO] jphw executable not found at %WRAPPER_PATH%
)

REM Ask about removing from PATH
echo.
echo [INFO] Found jphw PATH configuration
set /p REMOVE_PATH="Do you want to remove %BIN_DIR% from PATH? (y/N): "
if /i "!REMOVE_PATH!"=="y" (
    echo [INFO] Removing from user PATH...
    powershell -Command "$path = [Environment]::GetEnvironmentVariable('Path', 'User'); $newPath = ($path.Split(';') | Where-Object { $_ -ne '%BIN_DIR%' }) -join ';'; [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')"
    if !errorlevel! equ 0 (
        echo [SUCCESS] Removed %BIN_DIR% from user PATH
    ) else (
        echo [WARNING] Failed to remove from PATH automatically
    )
) else (
    echo [INFO] Keeping PATH configuration
)

REM Ask about removing Deno
echo.
echo [WARNING] Note: This script does not automatically remove Deno
echo [INFO] Deno may be used by other applications
echo.
set /p REMOVE_DENO="Do you want to remove Deno? (y/N): "

if /i "!REMOVE_DENO!"=="y" (
    echo [INFO] To remove Deno, please use the appropriate method:
    echo.
    
    REM Check npm
    where npm >nul 2>&1
    if !errorlevel! equ 0 (
        npm list -g deno >nul 2>&1
        if !errorlevel! equ 0 (
            echo [INFO] Deno was installed via npm:
            echo   npm uninstall -g deno
            echo.
        )
    )
    
    REM Check chocolatey
    where choco >nul 2>&1
    if !errorlevel! equ 0 (
        choco list --local-only deno >nul 2>&1
        if !errorlevel! equ 0 (
            echo [INFO] Deno was installed via Chocolatey:
            echo   choco uninstall deno
            echo.
        )
    )
    
    REM Check scoop
    where scoop >nul 2>&1
    if !errorlevel! equ 0 (
        scoop list deno >nul 2>&1
        if !errorlevel! equ 0 (
            echo [INFO] Deno was installed via Scoop:
            echo   scoop uninstall deno
            echo.
        )
    )
    
    REM Check winget
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget list DenoLand.Deno >nul 2>&1
        if !errorlevel! equ 0 (
            echo [INFO] Deno was installed via winget:
            echo   winget uninstall DenoLand.Deno
            echo.
        )
    )
    
    REM Check official installer
    if exist "%USERPROFILE%\.deno" (
        echo [INFO] Deno was installed via official installer:
        echo   rmdir /s /q "%USERPROFILE%\.deno"
        echo [INFO] And remove Deno PATH configuration from your environment variables
        echo.
    )
) else (
    echo [INFO] Keeping Deno installed
)

REM Success message
echo.
echo ================================================
echo Uninstallation completed!
echo ================================================
echo.
echo [INFO] jphw has been removed from your system
echo [INFO] You may need to restart your command prompt for changes to take effect
echo.
pause
exit /b 0
