# Script de Verificacion de Servicios Encore
# Uso: .\check-services.ps1

$services = @(
    @{Name="Frontend (Next.js)"; Port=3000; Path="/"}
    @{Name="Auth Service"; Port=3001; Path="/health"}
    @{Name="Music Service"; Port=3002; Path="/health"}
    @{Name="Queue Service"; Port=3003; Path="/health"}
    @{Name="Points Service"; Port=3006; Path="/health"}
    @{Name="Analytics Service"; Port=3007; Path="/api/v1/health"}
    @{Name="Menu Service"; Port=3005; Path="/health"}
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verificacion de Servicios Encore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($service in $services) {
    $url = "http://localhost:$($service.Port)$($service.Path)"
    Write-Host "Verificando $($service.Name)..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host " OK" -ForegroundColor Green
            $successCount++
        }
        else {
            Write-Host " Error $($response.StatusCode)" -ForegroundColor Yellow
            $failCount++
        }
    }
    catch {
        Write-Host " No responde" -ForegroundColor Red
        Write-Host "  URL: $url" -ForegroundColor Gray
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
        $failCount++
    }
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Resumen: $successCount servicios OK | $failCount servicios con problemas" -ForegroundColor $(if ($failCount -gt 0) { "Yellow" } else { "Green" })
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Verificar Docker
Write-Host "Verificando contenedores Docker..." -ForegroundColor Cyan
try {
    $redisStatus = docker inspect -f '{{.State.Running}}' encore-redis 2>$null
    $postgresStatus = docker inspect -f '{{.State.Running}}' encore-postgres 2>$null
    
    if ($redisStatus -eq "true") {
        Write-Host "  Redis: Corriendo" -ForegroundColor Green
    }
    else {
        Write-Host "  Redis: Detenido" -ForegroundColor Red
    }
    
    if ($postgresStatus -eq "true") {
        Write-Host "  PostgreSQL: Corriendo" -ForegroundColor Green
    }
    else {
        Write-Host "  PostgreSQL: Detenido" -ForegroundColor Red
    }
}
catch {
    Write-Host "  No se pudo verificar Docker" -ForegroundColor Yellow
}

Write-Host ""

if ($failCount -eq 0) {
    Write-Host "Todos los servicios estan funcionando correctamente!" -ForegroundColor Green
}
else {
    Write-Host "Algunos servicios tienen problemas. Revisa los logs." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Sugerencias de diagnostico:" -ForegroundColor Cyan
    Write-Host "  1. Verifica que npm run dev este ejecutandose en la raiz del proyecto" -ForegroundColor Gray
    Write-Host "  2. Revisa los logs en la terminal donde ejecutaste npm run dev" -ForegroundColor Gray
    Write-Host "  3. Verifica que los archivos src/server.ts existan en cada servicio" -ForegroundColor Gray
    Write-Host "  4. Verifica las variables de entorno (.env)" -ForegroundColor Gray
}

Write-Host ""
