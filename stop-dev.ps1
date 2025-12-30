# Script para detener servicios de Encore de forma limpia
# Uso: .\stop-dev.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deteniendo Servicios Encore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Puertos utilizados por los servicios
$ports = @(3001, 3002, 3003, 3004, 3005, 3006)

Write-Host "Deteniendo servicios en puertos: $($ports -join ', ')" -ForegroundColor Yellow
Write-Host ""

$totalStopped = 0

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        
        foreach ($pid in $pids) {
            if ($pid -ne 0 -and $pid -ne 4) {  # No matar System Idle o System
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Puerto $port - Deteniendo: $($process.Name) (PID: $pid)" -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        $totalStopped++
                    }
                } catch {
                    Write-Host "  Puerto $port - Error al detener PID $pid" -ForegroundColor Red
                }
            }
        }
    }
}

Write-Host ""
if ($totalStopped -gt 0) {
    Write-Host "✓ $totalStopped proceso(s) detenido(s)" -ForegroundColor Green
} else {
    Write-Host "✓ No hay servicios corriendo" -ForegroundColor Green
}

Write-Host ""
Write-Host "Esperando 2 segundos para liberar recursos..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host "✓ Servicios detenidos correctamente" -ForegroundColor Green
