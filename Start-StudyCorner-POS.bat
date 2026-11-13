@echo off
title Study Corner POS ^& Ledger Hub
cd /d "%~dp0"
echo Starting Study Corner POS ^& Ledger Hub Server on port 8787...
start "" "http://localhost:8787"
npm start
pause
