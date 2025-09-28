# Visión del Producto - Encore

## Resumen Ejecutivo

Encore es una plataforma de música interactiva para bares y restaurantes que permite a los clientes seleccionar y votar por la música que se reproduce en el establecimiento. Los usuarios pueden ganar y gastar puntos para influir en la cola de reproducción, creando una experiencia musical colaborativa y gamificada.

El producto resuelve el problema de la selección musical en establecimientos comerciales, permitiendo que los clientes participen activamente en la atmósfera musical mientras los propietarios mantienen el control sobre su establecimiento. Dirigido a bares, restaurantes, cafeterías y sus clientes, Encore transforma la experiencia musical de pasiva a interactiva.

## Objetivo Principal

Crear una nueva categoría de entretenimiento social que incremente el tiempo de permanencia de los clientes y genere ingresos adicionales a través de la gamificación y el engagement.

## Características Principales

### Sistema de Roles Unificado

| Rol | Constante | Método de Registro | Permisos Principales |
|-----|-----------|-------------------|---------------------|
| **Invitado** | `UserRole.GUEST` | Acceso directo via QR sin registro | Puede ver la cola actual, información del bar, acceso limitado sin interacción |
| **Miembro** | `UserRole.MEMBER` | Registro por email o conversión desde invitado | Puede buscar música, agregar canciones a la cola, gastar puntos, ver menú, participar en gamificación |
| **Propietario de Bar** | `UserRole.BAR_OWNER` | Registro por email con verificación de negocio | Puede gestionar su bar, controlar la cola, ver analytics, gestionar menú, configurar sistema de puntos, generar códigos QR |
| **Super Administrador** | `UserRole.SUPER_ADMIN` | Invitación del sistema con permisos especiales | Acceso completo a todos los bares, usuarios, configuraciones globales, métricas del sistema, gestión de roles |

### Módulos Principales

1. **Página Principal**: selección de modo (cliente/administrador), información del bar, acceso rápido via QR
2. **Interfaz de Cliente**: búsqueda de música, cola de reproducción en tiempo real, sistema de puntos, menú del bar
3. **Panel de Administración**: dashboard con métricas, control de cola, gestión de menú, configuraciones del bar
4. **Página de Analytics**: reportes detallados, métricas de uso, análisis de preferencias musicales
5. **Generador QR**: códigos QR personalizados para acceso rápido de clientes
6. **Modo Offline**: funcionalidad PWA para uso sin conexión

## Flujos de Usuario Principales

### Flujo de Cliente Regular:
1. El cliente escanea el código QR en la mesa o accede via web
2. Selecciona el modo "Cliente" en la página principal
3. Busca canciones usando la función de búsqueda
4. Agrega canciones a la cola (opcionalmente gastando puntos para prioridad)
5. Ve la cola en tiempo real y su posición
6. Gana puntos por tiempo de permanencia y interacciones
7. Puede ver el menú del bar y realizar pedidos

### Flujo de Propietario de Bar:
1. Inicia sesión en el panel de administración
2. Ve el dashboard con métricas en tiempo real
3. Controla la cola de reproducción (saltar, pausar, reordenar)
4. Gestiona el menú del establecimiento
5. Configura parámetros del sistema (límites, precios, géneros)
6. Revisa analytics y reportes de uso
7. Genera códigos QR personalizados para mesas

## Funcionalidades Técnicas Clave

### Progressive Web App (PWA)
- Instalación nativa en dispositivos
- Funcionamiento offline básico
- Notificaciones push
- Sincronización en background
- Cache inteligente de contenido

### Tiempo Real
- WebSockets para actualizaciones instantáneas
- Sincronización de cola entre todos los clientes
- Notificaciones en vivo de cambios
- Estado compartido entre dispositivos

### Gamificación
- Sistema de puntos dinámico
- Niveles y badges de usuario
- Leaderboards por bar
- Recompensas y promociones
- Challenges semanales

### Integraciones Externas
- Spotify Web API para catálogo musical
- YouTube Data API para videos musicales
- Stripe para procesamiento de pagos
- APIs de mapas para localización

## Roadmap de Desarrollo

### Fase 1: MVP (Semanas 1-4)
- ✅ Autenticación básica
- ✅ Búsqueda y cola de música
- ✅ Sistema de puntos básico
- ✅ Panel de administración
- ✅ PWA básica

### Fase 2: Mejoras Core (Semanas 5-8)
- 🔄 Integraciones con Spotify/YouTube
- 📊 Analytics básicos
- 🎮 Gamificación avanzada
- 💳 Sistema de pagos
- 🔔 Notificaciones push

### Fase 3: Funcionalidades Avanzadas (Semanas 9-12)
- 🤖 Recomendaciones con IA
- 📱 App móvil nativa
- 🏪 Marketplace de bares
- 🎉 Eventos y promociones
- 📈 Analytics avanzados

### Fase 4: Escalabilidad (Semanas 13-16)
- ☁️ Migración a microservicios
- 🌍 Soporte multi-región
- 🔧 API pública para terceros
- 📊 Business Intelligence
- 🤝 Integraciones con POS

## Métricas de Éxito

### Métricas de Usuario
- **Usuarios Activos Diarios (DAU):** >1000 usuarios/día
- **Tiempo de Sesión Promedio:** >15 minutos
- **Retención 7 días:** >40%
- **Canciones Agregadas por Sesión:** >3
- **Puntos Gastados por Usuario:** >50/semana

### Métricas de Negocio
- **Bares Activos:** >50 establecimientos
- **Ingresos por Puntos:** >$5000/mes
- **Tiempo de Permanencia en Bares:** +25%
- **Satisfacción del Cliente:** >4.5/5
- **NPS (Net Promoter Score):** >50

### Métricas Técnicas
- **Uptime:** >99.9%
- **Tiempo de Respuesta API:** <200ms
- **Error Rate:** <0.1%
- **PWA Install Rate:** >30%
- **Offline Usage:** >10% del tiempo total

## Consideraciones Futuras

### Escalabilidad
- Arquitectura preparada para millones de usuarios
- CDN global para contenido estático
- Base de datos distribuida
- Cache distribuido con Redis Cluster
- Load balancing automático

### Monetización
- Freemium con límites de canciones
- Suscripciones premium para bares
- Comisiones por ventas de menú
- Publicidad contextual
- Partnerships con plataformas musicales

### Expansión
- Soporte para eventos y festivales
- Integración con sistemas de karaoke
- Funcionalidades de DJ virtual
- Marketplace de música independiente
- Plataforma de descubrimiento musical

---

*Para más detalles técnicos, consulte la [Arquitectura Técnica](ARCHITECTURE/technical_architecture.md)*
*Para el plan de implementación, consulte el [Plan de Unificación](ARCHITECTURE/unification_cleanup_plan.md)*