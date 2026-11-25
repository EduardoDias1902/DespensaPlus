@echo off
title Smart Pantry Assistant MVP
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo ==============================================================
echo  Iniciando Smart Pantry Assistant MVP (Backend + Frontend)
echo ==============================================================

start "Smart Pantry Backend (3001)" cmd /k "set PATH=C:\Program Files\nodejs;%PATH% && npm --prefix backend run dev"
timeout /t 2 /nobreak >nul
start "Smart Pantry Frontend (5173)" cmd /k "set PATH=C:\Program Files\nodejs;%PATH% && npm --prefix frontend run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"
