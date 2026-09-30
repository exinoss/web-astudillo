@echo off
rem Doble clic: levanta el entorno local en Docker con iniciar.ps1 (sin cambiar la politica de ejecucion).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"
