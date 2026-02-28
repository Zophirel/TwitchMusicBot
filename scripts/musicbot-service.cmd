@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE_HOME=%ROOT%\tools\node"
set "PATH=%NODE_HOME%;%PATH%"
cd /d "%ROOT%"
call "%NODE_HOME%\npm.cmd" run start
