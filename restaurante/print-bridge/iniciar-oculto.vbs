' Arranca el puente de impresion OCULTO (sin ventana). Los mensajes quedan en puente.log.
' Poner un acceso directo a este archivo en la carpeta de Inicio (Win+R -> shell:startup).
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run "cmd /c """"" & dir & "\iniciar-puente.bat"" >> """ & dir & "\puente.log"" 2>&1""", 0, False
