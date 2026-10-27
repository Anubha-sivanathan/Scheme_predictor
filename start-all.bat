@echo off
rem Starts every part of the app for a demo. MongoDB runs as a Windows service (start it if stopped: net start MongoDB).
cd /d "%~dp0"

start "OCR service (5002)" cmd /k "cd ai-services\ocr-service && python app.py"
start "Recommendation service (5001)" cmd /k "cd ai-services\recommendation-service && python app.py"
start "Backend (8080)" cmd /k "cd backend && java -jar target\scheme-predictor-backend-1.0.0.jar"
start "Frontend (5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Wait about 30 seconds (the first OCR request is slower while the model loads), then open http://localhost:5173
