' Arranca el puente de impresion OCULTO (sin ventana) y avisa si quedo funcionando.
' Se puede usar desde un ACCESO DIRECTO (escritorio o carpeta Inicio: Win+R -> shell:startup).
' Si ya esta corriendo, solo avisa (no abre otro). Los mensajes quedan en puente.log.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = dir & "\iniciar-puente.bat"
logf = dir & "\puente.log"

If Not fso.FileExists(bat) Then
  MsgBox "No encuentro iniciar-puente.bat en:" & vbCrLf & dir & vbCrLf & vbCrLf & _
    "Este archivo tiene que quedarse en la carpeta del puente." & vbCrLf & _
    "En el escritorio pon un ACCESO DIRECTO (clic derecho > Enviar a > Escritorio), no una copia.", 16, "Puente de impresion"
  WScript.Quit
End If

' Ya corriendo? Puede estar trabado (o ser una version vieja): se ofrece reiniciarlo.
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe' AND CommandLine LIKE '%server.js%'")
If procs.Count > 0 Then
  r = MsgBox("El puente ya esta abierto." & vbCrLf & vbCrLf & _
    "Si no esta imprimiendo, presione SI para reiniciarlo.", 36, "Puente de impresion")
  If r <> 6 Then WScript.Quit
  ' Primero el ciclo del .bat (si no, lo vuelve a levantar) y luego node.
  For Each p In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='cmd.exe' AND CommandLine LIKE '%iniciar-puente%'")
    p.Terminate
  Next
  For Each p In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe' AND CommandLine LIKE '%server.js%'")
    p.Terminate
  Next
  WScript.Sleep 2000
End If

sh.CurrentDirectory = dir
sh.Run "cmd /c """ & bat & """", 0, False

' Esperar a que conecte y avisar como quedo (revisa lo ultimo de puente.log).
WScript.Sleep 10000
msg = "No se pudo leer puente.log."
If fso.FileExists(logf) Then
  Set f = fso.OpenTextFile(logf, 1)
  txt = f.ReadAll
  f.Close
  p = InStrRev(txt, "Iniciando puente")
  If p > 0 Then txt = Mid(txt, p)
  If InStr(txt, "conectado al servidor") > 0 Then
    sh.Popup "Puente de impresion funcionando.", 5, "Puente de impresion", 64
    WScript.Quit
  End If
  msg = Right(txt, 800)
End If
' Al prender la compu el internet puede tardar: el puente sigue reintentando solo.
sh.Popup "El puente todavia no se conecta al servidor (si la compu recien prendio, puede tardar un poco; sigue intentando solo)." & vbCrLf & _
  "Si no imprime, esto dice puente.log:" & vbCrLf & vbCrLf & msg, 30, "Puente de impresion", 48
