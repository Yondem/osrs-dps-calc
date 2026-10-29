@echo off
rem Opens the desktop app on the live dev server, so code changes show up without rebuilding.
cd /d "%~dp0"

rem Start the dev server in its own window, unless it's already running
curl -s -o nul http://localhost:37780/osrs-dps || start "DPS Calc dev server" cmd /k corepack yarn desktop:dev-server

rem Wait until it answers (the first page load also waits for it to compile)
:wait
curl -s -o nul http://localhost:37780/osrs-dps || (timeout /t 1 /nobreak >nul & goto wait)

corepack yarn desktop:dev
