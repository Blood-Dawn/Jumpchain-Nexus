@echo off
setlocal
set "NODE_HOME=%~dp0tools\node\node-v22.12.0-win-x64"
"%NODE_HOME%\node.exe" %*
