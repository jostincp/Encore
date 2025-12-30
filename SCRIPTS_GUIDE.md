# Scripts de Desarrollo - Encore

## 🎯 Propósito

Estos scripts facilitan el inicio y detención de los servicios de desarrollo, evitando problemas comunes con puertos ocupados.

## 📜 Scripts Disponibles

### 1. `start-dev.ps1` - Inicio Limpio de Servicios

**Uso:**
```powershell
.\start-dev.ps1
```

**Qué hace:**
- ✅ Verifica puertos 3001-3006
- ✅ Libera puertos ocupados automáticamente
- ✅ Espera 2 segundos para asegurar liberación
- ✅ Inicia `npm run dev`

**Cuándo usarlo:**
- Primera vez que inicias el proyecto
- Después de un cierre abrupto (Ctrl+C múltiple, terminal cerrada, etc.)
- Cuando `npm run dev` falla por "Port already in use"

---

### 2. `stop-dev.ps1` - Detención Limpia de Servicios

**Uso:**
```powershell
.\stop-dev.ps1
```

**Qué hace:**
- ✅ Encuentra todos los procesos en puertos 3001-3006
- ✅ Detiene los procesos de forma ordenada
- ✅ Espera 2 segundos para liberar recursos
- ✅ Confirma que todos los servicios están detenidos

**Cuándo usarlo:**
- Antes de cerrar tu sesión de trabajo
- Cuando quieres asegurarte de que no quedan procesos zombie
- Antes de reiniciar los servicios

---

### 3. `check-services.ps1` - Verificación de Estado

**Uso:**
```powershell
.\check-services.ps1
```

**Qué hace:**
- ✅ Verifica que todos los servicios respondan
- ✅ Muestra el estado de cada servicio (OK / No responde)
- ✅ Verifica Docker (Redis, PostgreSQL)
- ✅ Proporciona sugerencias de diagnóstico

---

## 🔄 Flujo de Trabajo Recomendado

### Inicio del Día
```powershell
# 1. Limpiar e iniciar servicios
.\start-dev.ps1

# 2. Verificar que todo esté corriendo
.\check-services.ps1
```

### Durante el Desarrollo
```powershell
# Si necesitas reiniciar:
# Ctrl+C en la terminal de npm run dev
# Espera 5 segundos
npm run dev

# O si hay problemas:
.\stop-dev.ps1
.\start-dev.ps1
```

### Fin del Día
```powershell
# Detener servicios limpiamente
.\stop-dev.ps1
```

---

## ❓ Preguntas Frecuentes

### ¿Por qué necesito estos scripts?

**Problema común:**
Cuando detienes `npm run dev` con Ctrl+C (especialmente múltiples veces), a veces los procesos de Node.js no se cierran correctamente y quedan ocupando los puertos.

**Síntomas:**
```
Error: Port 3001 is already in use
Error: listen EADDRINUSE: address already in use :::3001
```

**Solución:**
Usar `.\start-dev.ps1` que limpia los puertos automáticamente antes de iniciar.

---

### ¿Tengo que usar estos scripts siempre?

**No.** Solo cuando:
- Es la primera vez que inicias el proyecto
- Tuviste un cierre abrupto de servicios
- Ves errores de "Port already in use"

**Uso normal:**
```powershell
# Si todo está limpio, usa el comando estándar:
npm run dev
```

---

### ¿Qué pasa si `start-dev.ps1` no funciona?

**Solución manual:**
```powershell
# 1. Matar todos los procesos de Node
taskkill /F /IM node.exe

# 2. Esperar 5 segundos
Start-Sleep -Seconds 5

# 3. Iniciar servicios
npm run dev
```

---

### ¿Los scripts funcionan en Linux/Mac?

**No.** Estos scripts son específicos para Windows PowerShell.

**Para Linux/Mac:**
```bash
# Limpiar puertos manualmente
lsof -ti:3001,3002,3003,3004,3005,3006 | xargs kill -9

# Iniciar servicios
npm run dev
```

---

## 🛡️ Seguridad

Los scripts solo detienen procesos en los puertos específicos de Encore (3001-3006). No afectan otros servicios del sistema.

**Puertos gestionados:**
- 3001: Auth Service
- 3002: Music Service
- 3003: Queue Service
- 3004: Frontend (Next.js)
- 3005: Analytics Service
- 3006: Menu Service

---

## 📝 Notas Técnicas

### ¿Por qué quedan procesos zombie?

Cuando usas Ctrl+C en Windows, a veces:
1. La señal de interrupción no llega a todos los procesos hijos
2. `concurrently` no mata todos los subprocesos correctamente
3. Los procesos de Node quedan en estado "zombie" ocupando puertos

### ¿Cómo evitar el problema?

**Mejor práctica:**
1. Usa Ctrl+C **una sola vez**
2. Espera 5-10 segundos para que se cierren los procesos
3. Si necesitas forzar, usa `.\stop-dev.ps1`

---

## 🔧 Personalización

Si usas puertos diferentes, edita los scripts:

```powershell
# En start-dev.ps1 y stop-dev.ps1, línea 8:
$ports = @(3001, 3002, 3003, 3004, 3005, 3006)

# Cambia a tus puertos:
$ports = @(4001, 4002, 4003, 4004, 4005, 4006)
```

---

## 📞 Soporte

Si tienes problemas con los scripts:
1. Verifica que estás usando PowerShell (no CMD)
2. Ejecuta como administrador si es necesario
3. Revisa los logs de error
4. Usa la solución manual como fallback
