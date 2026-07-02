' Orbit Agent - hidden launcher (started by the OrbitAgent scheduled task via wscript.exe)
'
' Why this exists: under pythonw there is no console, so sys.stdout is None and
' uvicorn's log formatter crashes on sys.stdout.isatty(). Redirecting stdout+stderr
' to a log file gives the process a real stdout handle, so uvicorn starts cleanly.
' Window style 0 keeps everything completely hidden (no console flash).
Option Explicit
Dim sh, fso, base, logdir, logfile, cmd
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base = fso.GetParentFolderName(WScript.ScriptFullName)   ' the agent\ folder
logdir = base & "\logs"
If Not fso.FolderExists(logdir) Then fso.CreateFolder(logdir)
logfile = logdir & "\orbit-agent.log"

sh.CurrentDirectory = base
cmd = "cmd /c """"" & base & "\venv\Scripts\pythonw.exe"" src\tray.py >> """ & logfile & """ 2>&1"""
sh.Run cmd, 0, False
