# Roles y Permisos en Encore

Este documento resume los roles soportados por la plataforma Encore y sus capacidades. Toda la aplicación usa exclusivamente estos roles:

```
export enum UserRole {
  ADMIN = 'admin',
  BAR_OWNER = 'bar_owner',
  STAFF = 'staff',
  USER = 'user',
  GUEST = 'guest'
}
```

## Descripción de Roles

### ADMIN (Super Administrador)
- Control total sobre la plataforma.
- Gestiona todos los bares registrados.
- Accede a métricas globales (ingresos totales, usuarios activos, etc.).
- Administra configuraciones a nivel de sistema.
- Da de alta/baja a `BAR_OWNER` y gestiona suscripciones.

### BAR_OWNER (Dueño del Bar)
- Administración completa de su establecimiento.
- Crea y edita el menú digital (precios, productos, fotos 3D).
- Configura reglas del negocio (costo de canciones en puntos, promociones).
- Ve analíticas de su bar (ventas, canciones populares, horas pico).
- Crea y gestiona cuentas de `STAFF`.
- Gestiona la suscripción y pagos a Encore.

### STAFF (Personal del Bar - Meseros/DJs)
- Valida pedidos y pagos si se requiere.
- Gestiona la cola musical (aprobar/rechazar canciones cuando el modo manual está activo).
- Pausa/reanuda la música.
- Sin acceso a configuraciones sensibles (precios, datos financieros del dueño).

### USER (Cliente Registrado)
- Escanea QRs para unirse a una mesa.
- Acumula y guarda puntos entre visitas.
- Guarda canciones favoritas y preferencias.
- Consulta historial de pedidos y reproducciones.

### GUEST (Cliente Invitado/Anónimo)
- Acceso temporal a rockola y menú durante la sesión actual.
- Puede pedir canciones y ver el menú.
- Puntos y preferencias se pierden al cerrar sesión o salir del bar.

## Guías de Implementación

- Middleware y rutas deben usar `UserRole.ADMIN`, `UserRole.BAR_OWNER`, `UserRole.STAFF`, `UserRole.USER`, `UserRole.GUEST`.
- Validaciones deben limitar roles a la lista anterior.
- Migraciones y seeds usan `admin` en sustitución de `super_admin`; `user` sustituye `member/customer`.
- Los servicios deben evitar referencias a roles antiguos: `SUPER_ADMIN`, `MEMBER`, `CUSTOMER`, `bar_admin`.

## Casos de Autorización (ejemplos)
- Gestión de bares: `BAR_OWNER` o `ADMIN`.
- Activar/Eliminar bar: `ADMIN`.
- Reordenar cola musical: `ADMIN`, `BAR_OWNER`, `STAFF`.
- Eliminar entradas de la cola: `ADMIN`, `BAR_OWNER`, `STAFF`.
- Endpoints de usuario: Perfil propio o `ADMIN`.

## Notas de Migración
- Si existen datos con roles antiguos, ejecutar migración para mapear:
  - `super_admin` -> `admin`
  - `bar_admin` -> `bar_owner`
  - `member`/`customer` -> `user`