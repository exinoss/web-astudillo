#Requires -Version 5.1
<#
  Levanta el proyecto completo en Docker para probarlo en esta PC, sin instalar Bun ni PostgreSQL.
  Uso: doble clic en server-local\iniciar.cmd (o: powershell -ExecutionPolicy Bypass -File server-local\iniciar.ps1).
  Todo lo que usa está en esta carpeta (server-local); el proyecto es la carpeta de arriba.

  1. Comprueba que existan y estén completos backend/.env y frontend/.env.
  2. Instala Docker Desktop si falta (con winget) y lo arranca si está apagado.
  3. Construye las imágenes, levanta PostgreSQL y aplica las migraciones.
  4. Levanta backend, sitio (http://localhost:4321) y publicador (y Mailpit si el correo es local).
  5. La primera vez pide los datos del admin maestro.
  6. Muestra los registros. Ctrl+C detiene todo; cerrar la ventana con la X lo deja encendido.
  Si se vuelve a abrir, se salta lo que ya está hecho (o ya está encendido) y continúa. Los datos se conservan.
#>
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'Carlos Astudillo · entorno local (no cierres esta ventana)'

$ComposeFile = Join-Path $PSScriptRoot 'compose.local.yml'
$Proyecto = Split-Path -Parent $PSScriptRoot
$Profiles = @()

function Paso([string]$texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Aviso([string]$texto) { Write-Host "    $texto" -ForegroundColor Yellow }
function Falla([string]$texto) {
  Write-Host "`n[X] $texto" -ForegroundColor Red
  Read-Host "`nPulsa Enter para cerrar"
  exit 1
}

# Ejecuta docker compose con el archivo local y los perfiles activos; si falla, muestra los últimos registros.
function Compose {
  & docker compose -f $ComposeFile @Profiles @args
  if ($LASTEXITCODE -ne 0) {
    & docker compose -f $ComposeFile @Profiles logs --tail 40
    Falla "Falló: docker compose $($args -join ' '). Revisa los mensajes de arriba."
  }
}

# Lee un .env sencillo (CLAVE=valor, # comentarios) a una tabla.
function Leer-Env([string]$ruta) {
  $valores = @{}
  foreach ($linea in Get-Content -LiteralPath $ruta -Encoding UTF8) {
    if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $valores[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $valores
}

# Se intenta conectar: los puertos que publica Docker Desktop no siempre salen en Get-NetTCPConnection.
function Puerto-Ocupado([int]$puerto) {
  $cliente = New-Object System.Net.Sockets.TcpClient
  try { return $cliente.ConnectAsync('127.0.0.1', $puerto).Wait(500) -and $cliente.Connected }
  catch { return $false }
  finally { $cliente.Dispose() }
}

# En PowerShell 5.1, redirigir los errores de un programa con 'Stop' lanza una excepción: aquí solo se comprueba.
function Docker-Listo {
  $ErrorActionPreference = 'Continue'
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  & docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Servicio-Activo([string]$servicio) {
  $ErrorActionPreference = 'Continue'
  $id = & docker compose -f $ComposeFile @Profiles ps --status running -q $servicio 2> $null
  return [bool]$id
}

# ---------- 1. Archivos .env ----------
Paso 'Comprobando la configuración (.env)'
$backendEnv = Join-Path $Proyecto 'backend\.env'
$frontendEnv = Join-Path $Proyecto 'frontend\.env'
foreach ($ruta in @($backendEnv, $frontendEnv)) {
  if (-not (Test-Path -LiteralPath $ruta)) {
    Falla "Falta $ruta. Cópialo de $ruta.example (o pídelo al equipo), complétalo y vuelve a ejecutar."
  }
}
$be = Leer-Env $backendEnv
$fe = Leer-Env $frontendEnv
# APP_ORIGIN no se pide: en Docker el sitio siempre está en http://localhost:4321.
$faltan = @('DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_FROM_NAME') |
  Where-Object { -not $be[$_] }
if ($faltan) { Falla "En backend\.env faltan valores: $($faltan -join ', ')." }
if ($be['JWT_SECRET'].Length -lt 32) { Falla 'En backend\.env, JWT_SECRET debe tener al menos 32 caracteres aleatorios.' }
if ($be['SMTP_PORT'] -notmatch '^\d+$') { Falla 'En backend\.env, SMTP_PORT debe ser un número.' }
# PostgreSQL se crea con el usuario, la clave y la base de DATABASE_URL; dentro de Docker el servidor es «db».
try { $dbUrl = [Uri]$be['DATABASE_URL'] } catch { Falla 'En backend\.env, DATABASE_URL no es una dirección válida.' }
$credenciales = $dbUrl.UserInfo -split ':', 2
$dbNombre = [Uri]::UnescapeDataString($dbUrl.AbsolutePath.TrimStart('/'))
if ($dbUrl.Scheme -notin @('postgres', 'postgresql') -or $credenciales.Count -lt 2 -or -not $credenciales[0] -or -not $dbNombre) {
  Falla 'En backend\.env, DATABASE_URL debe ser como postgresql://usuario:clave@localhost:5432/nombre_base.'
}
$env:ASTUDILLO_DB_USER = [Uri]::UnescapeDataString($credenciales[0])
$env:ASTUDILLO_DB_PASSWORD = [Uri]::UnescapeDataString($credenciales[1])
$env:ASTUDILLO_DB_NAME = $dbNombre
$env:ASTUDILLO_DATABASE_URL = "$($dbUrl.Scheme)://$($dbUrl.UserInfo)@db:5432$($dbUrl.AbsolutePath)$($dbUrl.Query)"
if (-not $fe['PUBLIC_GOOGLE_CLIENT_ID']) {
  Aviso 'frontend\.env no tiene PUBLIC_GOOGLE_CLIENT_ID: el botón de Google no estará disponible.'
} elseif ($fe['PUBLIC_GOOGLE_CLIENT_ID'] -ne $be['GOOGLE_CLIENT_ID']) {
  Aviso 'PUBLIC_GOOGLE_CLIENT_ID (frontend) y GOOGLE_CLIENT_ID (backend) no coinciden: Google no funcionará.'
}
Write-Host '    Configuración completa.'

# ---------- 2. Docker ----------
Paso 'Comprobando Docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Falla 'Docker no está instalado y esta PC no tiene winget. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a ejecutar.'
  }
  Aviso 'Docker no está instalado: se instalará Docker Desktop (Windows pedirá permiso de administrador).'
  & winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Falla 'No se pudo instalar Docker Desktop. Instálalo a mano y vuelve a ejecutar.' }
  # El instalador añade docker al PATH del sistema; esta ventana aún no lo ve.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  Aviso 'Docker Desktop instalado. Si Windows pide reiniciar, reinicia y vuelve a abrir server-local\iniciar.cmd.'
}
if (-not (Docker-Listo)) {
  $escritorio = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path -LiteralPath $escritorio) { Start-Process -FilePath $escritorio }
  Write-Host '    Arrancando Docker Desktop (la primera vez puede pedir aceptar sus condiciones)' -NoNewline
  $limite = (Get-Date).AddMinutes(4)
  while (-not (Docker-Listo) -and (Get-Date) -lt $limite) { Start-Sleep -Seconds 3; Write-Host '.' -NoNewline }
  Write-Host ''
  if (-not (Docker-Listo)) {
    $ErrorActionPreference = 'Continue'
    & wsl.exe --status *> $null
    if ($LASTEXITCODE -ne 0) {
      Aviso 'Docker necesita WSL 2 y no está instalado. Se instalará (pedirá permiso de administrador).'
      Start-Process -FilePath 'wsl.exe' -ArgumentList '--install', '--no-distribution' -Verb RunAs -Wait
      Falla 'WSL 2 instalado. Reinicia la PC y vuelve a abrir server-local\iniciar.cmd.'
    }
    Falla 'Docker no terminó de arrancar. Abre Docker Desktop, espera a que diga que está en marcha y vuelve a ejecutar.'
  }
}
Write-Host '    Docker en marcha.'

# ---------- 3. Correo y puertos ----------
# Un SMTP local (Mailpit en la PC) no existe dentro de Docker: se levanta un Mailpit propio.
if ($be['SMTP_HOST'] -in @('localhost', '127.0.0.1', 'mailpit')) {
  $Profiles = @('--profile', 'correo')
  $env:ASTUDILLO_SMTP_HOST = 'mailpit'
  $env:ASTUDILLO_SMTP_PORT = '1025'
  # Si ya corre, se conserva su puerto (cambiarlo obligaría a recrearlo); si no, el primero libre desde 8025.
  $puertoCorreo = 0
  if (Servicio-Activo 'mailpit') {
    $ErrorActionPreference = 'Continue'
    $publicado = & docker compose -f $ComposeFile @Profiles port mailpit 8025 2> $null
    $ErrorActionPreference = 'Stop'
    if ("$publicado" -match ':(\d+)\s*$') { $puertoCorreo = [int]$Matches[1] }
  }
  if (-not $puertoCorreo) { $puertoCorreo = 8025; while (Puerto-Ocupado $puertoCorreo) { $puertoCorreo++ } }
  $env:ASTUDILLO_MAILPIT_PORT = "$puertoCorreo"
} else {
  $env:ASTUDILLO_SMTP_HOST = $be['SMTP_HOST']
  $env:ASTUDILLO_SMTP_PORT = $be['SMTP_PORT']
}
# El sitio tiene que estar en 4321: es el origen que aceptan la API y Google.
if (-not (Servicio-Activo 'frontend') -and (Puerto-Ocupado 4321)) {
  Falla 'El puerto 4321 está ocupado (¿un «bun run dev» del frontend abierto?). Ciérralo y vuelve a ejecutar.'
}

# ---------- 4. Construir, base de datos y migraciones ----------
Paso 'Preparando las imágenes (la primera vez tarda varios minutos)'
Compose build
Paso 'Levantando PostgreSQL y aplicando migraciones'
Compose up -d --wait db
Compose run --rm --no-deps backend bun run db:migrate

# ---------- 5. Resto de servicios ----------
Paso 'Levantando backend, sitio y publicador'
Compose up -d --wait

# ---------- 6. Admin maestro (solo la primera vez) ----------
$maestros = (& docker compose -f $ComposeFile @Profiles exec -T db psql -U $env:ASTUDILLO_DB_USER -d $env:ASTUDILLO_DB_NAME -tAc 'SELECT count(*) FROM tb_usuarios WHERE es_maestro' | Out-String).Trim()
if ($maestros -eq '0') {
  Paso 'Crea el admin maestro (la contraseña no se ve al escribirla)'
  & docker compose -f $ComposeFile @Profiles exec backend bun run admin:crear
  if ($LASTEXITCODE -ne 0) { Aviso 'No se creó el admin maestro. Vuelve a ejecutar iniciar.cmd para intentarlo de nuevo.' }
}

# ---------- 7. En marcha ----------
Write-Host ''
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host '   Todo en marcha' -ForegroundColor Green
Write-Host '   Sitio:  http://localhost:4321' -ForegroundColor Green
Write-Host '   Panel:  http://localhost:4321/cuenta/panel/  (con el admin maestro)' -ForegroundColor Green
if ($Profiles) { Write-Host "   Correos: http://localhost:$env:ASTUDILLO_MAILPIT_PORT  (bandeja de Mailpit)" -ForegroundColor Green }
Write-Host '   Ctrl+C detiene todo. Si cierras la ventana, todo sigue encendido' -ForegroundColor Green
Write-Host '   y al volver a abrir iniciar.cmd continúa donde estaba.' -ForegroundColor Green
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host ''
Start-Process 'http://localhost:4321'

# Muestra los registros en un proceso aparte: cerrar la ventana lo corta a él, no a los contenedores.
$argumentos = @('compose', '-f', "`"$ComposeFile`"") + $Profiles + @('logs', '-f', '--tail', '20')
$registros = Start-Process -FilePath 'docker' -ArgumentList $argumentos -NoNewWindow -PassThru
if ([Console]::IsInputRedirected) {
  # Sin teclado (por ejemplo, lanzado desde otro programa): solo acompaña a los registros.
  $registros.WaitForExit()
  exit 0
}
# Ctrl+C se lee como tecla y no como señal: así solo esta combinación detiene los contenedores.
[Console]::TreatControlCAsInput = $true
try {
  while ($true) {
    if ([Console]::KeyAvailable) {
      $tecla = [Console]::ReadKey($true)
      if ($tecla.Key -eq 'C' -and ($tecla.Modifiers -band [ConsoleModifiers]::Control)) { break }
    }
    Start-Sleep -Milliseconds 200
  }
} finally {
  [Console]::TreatControlCAsInput = $false
}
if (-not $registros.HasExited) { Stop-Process -Id $registros.Id -Force -ErrorAction SilentlyContinue }
Paso 'Deteniendo el entorno (los datos se conservan)'
& docker compose -f $ComposeFile @Profiles stop
Write-Host '    Detenido. Vuelve a abrir iniciar.cmd para levantarlo de nuevo.'
