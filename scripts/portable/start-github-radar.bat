@echo off
chcp 65001 >nul
title GitHub Interest Radar
cd /d "%~dp0"

if not exist "runtime\python\python.exe" (
  echo.
  echo 没有找到内置 Python，请重新完整解压压缩包。
  echo.
  pause
  exit /b 1
)

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
"runtime\python\python.exe" "portable-launcher.py"

echo.
echo 服务已停止。按任意键关闭窗口。
pause >nul
