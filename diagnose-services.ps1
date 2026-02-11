# Diagnostic Script for Encore Services
# Checks why services are not responding

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Diagnostico de Servicios Encore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name = "Points Service"; Path = "backend/points-service"; Port = 3006 }
    @{Name = "Analytics Service"; Path = "backend/analytics-service"; Port = 3007 }
    @{Name = "Menu Service"; Path = "backend/menu-service"; Port = 3005 }
)

foreach ($service in $services) {
    Write-Host "Diagnosticando $($service.Name)..." -ForegroundColor Yellow
    Write-Host "  Ruta: $($service.Path)" -ForegroundColor Gray
    
    # Check if directory exists
    if (Test-Path $service.Path) {
        Write-Host "  OK Directorio existe" -ForegroundColor Green
        
        # Check if src/server.ts exists
        $serverPath = Join-Path $service.Path "src/server.ts"
        if (Test-Path $serverPath) {
            Write-Host "  OK src/server.ts existe" -ForegroundColor Green
        }
        else {
            Write-Host "  X src/server.ts NO existe" -ForegroundColor Red
        }
        
        # Check if package.json exists
        $packagePath = Join-Path $service.Path "package.json"
        if (Test-Path $packagePath) {
            Write-Host "  OK package.json existe" -ForegroundColor Green
            
            # Check dev script
            $packageContent = Get-Content $packagePath -Raw | ConvertFrom-Json
            if ($packageContent.scripts.dev) {
                Write-Host "  OK Script dev configurado: $($packageContent.scripts.dev)" -ForegroundColor Green
            }
            else {
                Write-Host "  X Script dev NO configurado" -ForegroundColor Red
            }
        }
        else {
            Write-Host "  X package.json NO existe" -ForegroundColor Red
        }
        
        # Check if node_modules exists
        $nodeModulesPath = Join-Path $service.Path "node_modules"
        if (Test-Path $nodeModulesPath) {
            Write-Host "  OK node_modules existe" -ForegroundColor Green
        }
        else {
            Write-Host "  X node_modules NO existe - ejecuta npm install" -ForegroundColor Red
        }
        
        # Check if .env exists
        $envPath = Join-Path $service.Path ".env"
        if (Test-Path $envPath) {
            Write-Host "  OK .env existe" -ForegroundColor Green
        }
        else {
            Write-Host "  ! .env NO existe (puede ser opcional)" -ForegroundColor Yellow
        }
        
        # Check if port is listening
        $portTest = Test-NetConnection -ComputerName localhost -Port $service.Port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($portTest) {
            Write-Host "  OK Puerto $($service.Port) esta escuchando" -ForegroundColor Green
        }
        else {
            Write-Host "  X Puerto $($service.Port) NO esta escuchando" -ForegroundColor Red
        }
        
    }
    else {
        Write-Host "  X Directorio NO existe" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verificando Dependencias Compartidas" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check shared directory
if (Test-Path "backend/shared") {
    Write-Host "OK backend/shared existe" -ForegroundColor Green
    
    # Check for config
    if (Test-Path "backend/shared/config") {
        Write-Host "OK backend/shared/config existe" -ForegroundColor Green
    }
    elseif (Test-Path "backend/shared/config.ts") {
        Write-Host "OK backend/shared/config.ts existe" -ForegroundColor Green
    }
    elseif (Test-Path "backend/shared/src/config") {
        Write-Host "OK backend/shared/src/config existe" -ForegroundColor Green
    }
    else {
        Write-Host "X backend/shared/config NO encontrado" -ForegroundColor Red
        Write-Host "  Los servicios pueden fallar al importar configuracion compartida" -ForegroundColor Yellow
    }
    
    # Check for utils
    if (Test-Path "backend/shared/utils") {
        Write-Host "OK backend/shared/utils existe" -ForegroundColor Green
    }
    elseif (Test-Path "backend/shared/src/utils") {
        Write-Host "OK backend/shared/src/utils existe" -ForegroundColor Green
    }
    else {
        Write-Host "X backend/shared/utils NO encontrado" -ForegroundColor Red
    }
}
else {
    Write-Host "X backend/shared NO existe" -ForegroundColor Red
    Write-Host "  Los servicios necesitan este directorio para funcionar" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Recomendaciones" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Si los servicios no estan respondiendo:" -ForegroundColor Yellow
Write-Host "  1. Verifica que npm run dev este ejecutandose en la raiz del proyecto" -ForegroundColor Gray
Write-Host "  2. Revisa los logs en la terminal donde ejecutaste npm run dev" -ForegroundColor Gray
Write-Host "  3. Si faltan node_modules, ejecuta npm install en cada servicio" -ForegroundColor Gray
Write-Host "  4. Si falta backend/shared, verifica la estructura del proyecto" -ForegroundColor Gray
Write-Host "  5. Verifica que las variables de entorno esten configuradas" -ForegroundColor Gray
Write-Host ""
