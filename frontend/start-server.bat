@echo off
echo ============================================
echo  6/7 Counter — Servidor HTTPS (LAN)
echo  IP: 192.168.3.10
echo  Signaling: wss://192.168.3.10:8765
echo  Frontend:  https://192.168.3.10:5173
echo ============================================
echo.
cd /d "%~dp0server"
python -m uvicorn server:app --host 0.0.0.0 --port 8765 --reload --ssl-certfile cert.pem --ssl-keyfile key.pem
pause
