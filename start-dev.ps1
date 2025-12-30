# Script para limpiar puertos y iniciar servicios de Encore
# Uso: .\start-dev.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Encore - Limpieza de Puertos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Puertos utilizados por los servicios
$ports = @(3001, 3002, 3003, 3004, 3005, 3006)

Write-Host "Verificando puertos en uso..." -ForegroundColor Yellow

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    
    if ($connections) {
        Write-Host "  Puerto $port en uso - Liberando..." -ForegroundColor Yellow
        
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        
        foreach ($procId in $pids) {
            if ($procId -ne 0 -and $procId -ne 4) {  # No matar System Idle o System
                try {
                    $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "    Deteniendo proceso: $($process.Name) (PID: $procId)" -ForegroundColor Gray
                        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    }
                } catch {
                    Write-Host "    No se pudo detener PID $procId" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "  Puerto $port disponible" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Esperando 2 segundos para liberar puertos..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Servicios" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Iniciar npm run dev
npm run dev
