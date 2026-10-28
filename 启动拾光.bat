@echo off
chcp 65001 >nul
title 拾光 · 每日心情手账
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  未检测到 Node.js，请先到 https://nodejs.org/ 安装后重试。
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo.
  echo  首次运行，正在安装依赖，大约需要 1-3 分钟……
  echo.
  call npm install --no-audit --no-fund
)

echo.
echo  拾光正在启动，浏览器将自动打开……
echo  提示：关闭本窗口即可停止网站。
echo.
node server.js
pause
