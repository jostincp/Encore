# Checklist de Validación Integral - Plataforma Encore

Este documento sirve como guía para validar el funcionamiento end-to-end de la plataforma Encore. Está basado en la arquitectura actual de microservicios y los flujos de usuario implementados.

**Leyenda de Prioridad:**
- 🔴 **Alta:** Bloqueante. La funcionalidad core no funciona sin esto.
- 🟡 **Media:** Importante. Afecta la experiencia pero hay workarounds o no es crítico para el flujo principal.
- 🟢 **Baja:** Mejora visual, texto o caso borde poco frecuente.

**Leyenda de Estado:**
- ✅ Correcto
- ❌ Fallido
- ⚠️ Parcial / Inestable
- ⏸️ No Implementado

---

## 1. Registro de Usuarios y Dueños de Bar (Auth Service)

| ID | Funcionalidad | Paso a Verificar | Resultado Esperado | Prioridad | Estado | Observaciones |
|----|---------------|------------------|--------------------|-----------|--------|---------------|
| 1.1 | Registro Bar Owner | Ir a `/auth/register-bar-owner`. Llenar formulario con email válido y contraseña segura. | Redirección exitosa o mensaje de "Cuenta creada". Datos guardados en BD `users` y `bars`. | 🔴 |✅ | |
| 1.2 | Validación Email | Intentar registrar con email sin formato (ej: `test.com`). | Mensaje de error: "Formato de email inválido". No envía petición. | 🟡 | ✅| |
| 1.3 | Validación Teléfono | Ingresar teléfono con espacios o guiones (ej: `+57 300 123`). | El sistema debe limpiarlo a formato E.164 (`+57300123`) internamente o validarlo correctamente. | 🔴 |✅ | *Recién implementado* |
| 1.4 | Contraseñas | Ingresar contraseñas que no coinciden en "Confirmar contraseña". | Error visual inmediato: "Las contraseñas no coinciden". Botón deshabilitado. | 🟡 | ✅| |
| 1.5 | Duplicidad | Intentar registrar un email ya existente. | Error del servidor: "El usuario ya existe" (409 Conflict). | 🔴 | ✅| |
| 1.6 | Registro Guest | Escanear QR (simulado) para entrar como invitado. | Creación de sesión temporal/anónima sin pedir credenciales completas. | 🔴 |✅ | Para ingresar a la URL tengo que generar el código QR, leerlo en mi celular y luego me dice copiar la url y no abriral, la copio para enviar a mi chat de WahtsApp, despues lo abro desde el computado para estran como temporal sin pedir credenciales, adicional si refresco la página donde generé el QR, el desaprecen los QR generados.|

## 2. Login y Autenticación

| ID | Funcionalidad | Paso a Verificar | Resultado Esperado | Prioridad | Estado | Observaciones |
|----|---------------|------------------|--------------------|-----------|--------|---------------|
| 2.1 | Login Exitoso | Ingresar credenciales correctas en `/admin`. | Acceso al Dashboard. Token JWT almacenado en cookies/storage. | 🔴 |❌ |No está creado el usuario |
| 2.2 | Login Fallido | Ingresar contraseña incorrecta. | Mensaje "Credenciales inválidas". No permite acceso. | 🔴 |✅ | |
| 2.3 | Persistencia | Recargar la página (F5) estando logueado. | La sesión se mantiene activa (no pide login de nuevo). | 🔴 | ✅| |
| 2.4 | Logout | Clic en botón "Cerrar Sesión" o "Salir". | Redirección al Login. Token eliminado/invalidado. | 🟡 | ⏸️|No está el botón Cerrar Sesión |
| 2.5 | Protección Rutas | Intentar acceder a `/admin` sin estar logueado. | Redirección automática a `/auth/login`. | 🔴 | ⏸️| |

## 3. Funcionalidades Intermedias (Dashboard & Perfil)

| ID | Funcionalidad | Paso a Verificar | Resultado Esperado | Prioridad | Estado | Observaciones |
|----|---------------|------------------|--------------------|-----------|--------|---------------|
| 3.1 | Carga Dashboard | Entrar al Dashboard Admin recién creado. | Muestra "Sin datos" o contadores en 0. No muestra errores rojos de conexión. | 🔴 |✅ | *Recién arreglado* |
| 3.2 | Datos del Bar | Verificar nombre y detalles del bar en el header/perfil. | Coinciden con los ingresados en el registro. | 🟡 |⚠️ |No muestra el email y usuario ID |
| 3.3 | Configuración | Intentar cambiar ajustes (ej: descripción, horario). | Se guardan los cambios y se reflejan al recargar. | 🟡 | ⚠️|Al dar clic en el botón de configuración se cierra sesión |

## 4. Funcionalidades Avanzadas (Música y Menú)

| ID | Funcionalidad | Paso a Verificar | Resultado Esperado | Prioridad | Estado | Observaciones |
|----|---------------|------------------|--------------------|-----------|--------|---------------|
| 4.1 | Buscar Canción | (Vista Cliente) Usar barra de búsqueda de canciones. | Resultados relevantes de YouTube/Spotify. | 🔴 |❌ | No muestra las canciones|
| 4.2 | Solicitar Canción | Seleccionar canción y confirmar pedido. | Canción aparece en "Cola de Solicitudes" del Admin y Cliente. | 🔴 | ⚠️| No se peude probar porque no muestra las canciones|
| 4.3 | Aprobar Canción | (Vista Admin) Aprobar una canción de la cola. | Canción pasa a "Cola de Reproducción" o "Aceptadas". | 🔴 | ⚠️|No se puede probar porque no muestra las canciones |
| 4.4 | Crear Producto | (Vista Admin) Menú -> Nuevo Producto. Llenar nombre, precio, imagen. | Producto aparece en la lista del menú. | 🔴 |❌ | La sección configuración no funciona, se cierra sesión |
| 4.5 | Categorías | Crear una categoría (ej: "Bebidas"). | La categoría está disponible para asignar productos. | 🟡 | ❌| La sección configuración no funciona, se cierra sesión|
| 4.6 | Ver Menú | (Vista Cliente) Navegar al menú digital. | Se ven los productos creados con sus precios correctos. | 🔴 | ❌| La sección configuración no funciona, se cierra sesión |

## 5. Generación y Gestión de QR

| ID | Funcionalidad | Paso a Verificar | Resultado Esperado | Prioridad | Estado | Observaciones |
|----|---------------|------------------|--------------------|-----------|--------|---------------|
| 5.1 | Generar QR Mesa | (Admin) Generar QR para Mesa 1. | Se muestra/descarga imagen QR válida. | 🔴 |⚠️ | *Controller arreglado* |
| 5.2 | Datos del QR | Escanear QR con lector genérico. | URL contiene `barId` correcto y `table=1`. | 🔴 |✅ | |
| 5.3 | Acceso QR | Abrir URL del QR en navegador móvil. | Abre la app cliente vinculada a ese Bar y esa Mesa específica. | 🔴 |✅ | |
| 5.4 | Generación Masiva | Generar QRs para 10 mesas simultáneamente. | Descarga archivo ZIP con las 10 imágenes. | 🟡 | ✅| |
| 5.5 | Validación | Intentar usar QR de un bar inactivo. | Mensaje de error o redirección a home genérico. | 🟢 |✅ | |

---

## Resumen de Ejecución

**Fecha:** _______________
**Tester:** _______________
**Versión:** _______________

| Total Tests | Aprobados ✅ | Fallidos ❌ | Pendientes ⚠️ |
|-------------|--------------|-------------|---------------|
| 27          |              |             |               |
