1. Resumen Ejecutivo y Visión del Producto
Encore es una plataforma digital integral diseñada para revolucionar la experiencia social y operativa en bares, pubs y restaurantes. Nuestra visión es transformar el ambiente pasivo de un local en un ecosistema interactivo y gamificado, donde los clientes no son meros consumidores, sino participantes activos en la creación de la atmósfera del lugar.
El sistema fusiona una moderna rockola digital controlada por el cliente con un innovador sistema de menús 3D y un programa de lealtad basado en puntos, todo accesible a través de un simple escaneo de código QR.
Objetivo Principal: Incrementar la rentabilidad de los establecimientos asociados a través de tres pilares fundamentales:
1.	Aumento del Consumo Promedio (Ticket): Incentivar pedidos adicionales mediante un sistema de recompensas directo y divertido.
2.	Mejora de la Experiencia del Cliente (Fidelización): Crear una experiencia única y memorable que fomente las visitas recurrentes y la publicidad orgánica.
3.	Optimización de la Gestión Operativa (Eficiencia): Digitalizar y automatizar procesos clave como la toma de pedidos y la gestión del ambiente musical.
2. Lógica Funcional y Flujo de Interacción
La plataforma opera bajo dos roles principales con flujos de trabajo distintos pero interconectados: el Cliente y el Administrador (dueño/mesero/DJ).
2.1 Flujo del Cliente (La Experiencia Interactiva)
El viaje del cliente está diseñado para ser intuitivo, rápido y sin fricciones, comenzando desde el momento en que se sienta en la mesa.
1.	Acceso Instantáneo:
•	El cliente escanea un código QR único ubicado en su mesa.
•	Automáticamente, se abre una Progressive Web App (PWA) en el navegador de su móvil, sin necesidad de descargar nada. La PWA lo asocia a su número de mesa.
2.	El Hub del Cliente:
•	Se le presenta una interfaz principal elegante y sencilla con cuatro secciones clave: Música, Menú, Cola y Puntos.
•	Visualiza su saldo inicial de puntos (si el bar ofrece un bono de bienvenida) y su número de mesa.
3.	La Rockola Digital en su Bolsillo (Sección Música):
•	El cliente puede buscar en un catálogo musical casi infinito (provisto por YouTube y/o Spotify).
•	Puede filtrar por artista, canción, género o ver playlists populares curadas por el bar.
•	Para añadir una canción a la cola de reproducción del local, debe "pagar" con los puntos acumulados. Por ejemplo, una canción puede costar 5 puntos.
•	Función "Priority Play" (Juego de Poder): ¿Quiere que su canción suene a continuación? Puede gastar una cantidad mayor de puntos (o realizar un micropago) para saltar la cola.
4.	El Menú del Futuro (Sección Menú):
•	Navega por el menú digital. En el plan Premium, los platos se presentan como modelos 3D interactivos. Puede rotarlos 360°, hacer zoom y ver una representación fotorrealista de lo que va a pedir.
•	Cada ítem del menú muestra su precio y, crucialmente, la cantidad de puntos que otorga. "Pide esta hamburguesa y gana 20 puntos para tu próxima canción".
•	Añade productos a su carrito de compras virtual.
5.	Acumulación de Puntos (El Círculo Virtuoso):
•	Cuando el cliente realiza un pedido a través de la app (o cuando el mesero confirma su consumo), los puntos se acreditan automáticamente a su perfil.
•	El ciclo es simple: Consumir -> Ganar Puntos -> Gastar Puntos en Música -> Querer más música -> Consumir más.
6.	Transparencia y Control (Secciones Cola y Puntos):
•	En la sección "Cola", puede ver en tiempo real qué canción está sonando, cuál es la siguiente y en qué posición de la lista se encuentra la suya.
•	En la sección "Puntos", puede ver su saldo actual y un historial de cómo ha ganado y gastado sus puntos.
2.2 Flujo del Administrador (El Centro de Control)
El administrador tiene acceso a un panel de control potente y responsive, accesible desde una tablet, un portátil o incluso un móvil.
1.	Dashboard General:
•	Una vista de pájaro del estado del local: número de mesas activas, ingresos generados a través de la app, canciones en cola y los productos más vendidos del día.
2.	Gestión de la Cola Musical (El DJ Digital):
•	Visualiza la cola de reproducción completa con las peticiones de todas las mesas.
•	Tiene control total: puede aprobar, rechazar o eliminar cualquier canción solicitada. Esto es vital para mantener la coherencia del ambiente musical del bar.
•	Puede reordenar la cola con una simple función de arrastrar y soltar (drag-and-drop), creando sets de música fluidos.
•	Puede inyectar canciones directamente desde el panel, sin que provengan de una petición de cliente, para rellenar huecos o cambiar el ritmo.
3.	Administración del Menú y Puntos:
•	Puede editar el menú en tiempo real: cambiar precios, marcar un producto como "agotado", añadir especiales del día.
•	Panel de Estrategia de Puntos: Aquí define la economía del sistema. Puede configurar cuántos puntos otorga cada producto y cuántos puntos cuesta una canción. ¿Noche de rock? Puede poner las canciones de rock a mitad de puntos para incentivar.
4.	Inteligencia de Negocios (Analytics):
•	Accede a reportes detallados sobre las canciones más solicitadas, los artistas más populares, los géneros preferidos por horas y los productos más consumidos para obtener puntos.
•	Esta información es oro puro para tomar decisiones de negocio, desde qué música poner en horas bajas hasta qué promociones de bebidas lanzar.
3. Componentes Clave y Lógica Interna
•	Sistema de Identidad Única: Cada mesa tiene un QR único que genera una sesión de usuario anónima pero persistente. Esto permite el seguimiento sin necesidad de un registro engorroso.
•	Motor de Gamificación: El núcleo del sistema. No es solo "ganar puntos", es un motor de reglas que puede ser configurado para "Happy Hours" (puntos dobles), "Bonos por racha" (si pides 3 bebidas, la siguiente te da el triple de puntos), etc.
•	Flexibilidad de Proveedor Musical: El administrador puede elegir en la configuración si su catálogo se nutre de YouTube (con video) o de Spotify (audio de alta calidad), adaptándose a la infraestructura y licencia del local.
•	Comunicación en Tiempo Real: Mediante WebSockets, cualquier cambio realizado por el administrador (ej. aprobar una canción) o un cliente (ej. añadir una canción a la cola) se refleja instantáneamente en todas las pantallas conectadas al sistema, creando una experiencia viva y dinámica.
4. Definición Final del Producto
Encore no es una aplicación, es una plataforma de experiencia como servicio (EaaS) para el sector de la hostelería. Trasciende la simple digitalización de un menú o una rockola para convertirse en una herramienta de gestión de ambiente, marketing y ventas. Empodera al cliente dándole un rol activo y proporciona al dueño del negocio las herramientas para aumentar sus ingresos y crear una marca memorable. Es el puente entre el consumo tradicional y la economía de la interacción digital.





Filosofía Arquitectónica Central
Construiremos bajo 4 principios clave:
1.	Microservicios: Cada función principal es un servicio independiente. Esto permite escalar, mantener y actualizar partes del sistema sin afectar al resto.
2.	API-First: El backend expone una API clara y documentada. Esto permite que el frontend (y futuras aplicaciones, como una app nativa) se conecte de manera desacoplada.
3.	Headless: El frontend está completamente separado del backend. Son dos mundos que se comunican, lo que da una flexibilidad total en el diseño.
4.	Cost-Effective Scalability: Elegimos tecnologías que ofrecen un rendimiento excepcional sin los costos prohibitivos de los gigantes de la nube tradicionales, permitiendo empezar con un costo casi nulo y escalar de manera predecible.
________________________________________
Arquitectura Detallada por Capas
1. Frontend (La Interfaz de Usuario)
Aquí es donde viven la aplicación del cliente (móvil-first) y el dashboard del administrador (responsive).
•	Framework Principal: React 19 con Next.js 15.
•	Por qué: Renderizado del lado del servidor (SSR) para velocidad, generación de sitios estáticos (SSG) para landing pages, y la mejor experiencia de desarrollo con su App Router. Es el estándar de oro para aplicaciones web modernas.
•	Diseño y UI:
•	Styling: Tailwind CSS. Para un desarrollo de UI ultra-rápido y consistente.
•	Componentes: Shadcn UI o Radix UI. Proveen componentes base (menús, diálogos, etc.) sin estilos y 100% accesibles, que se personalizan con Tailwind.
•	Animaciones: Framer Motion. Para animaciones fluidas y complejas con una sintaxis simple.
•	Gestión de Estado: Zustand.
•	Por qué: Extremadamente ligero y simple. Perfecto para manejar estados globales (como datos del usuario, estado de la cola) sin la complejidad de Redux.
•	Renderizado 3D (Menú Interactivo):
•	Motor: Google model-viewer. Web Components estándar para renderizar modelos 3D interactivos en la web.
•	Por qué: Permite integrar modelos glTF/GLB con rotación 360°, zoom y carga optimizada sin depender de librerías externas pesadas. Funciona de forma nativa en navegadores modernos.
•	Plataforma Final: Progressive Web App (PWA).
•	Por qué: Permite que la aplicación sea "instalable" en el escritorio o pantalla de inicio del móvil, funcionar offline (para ver el menú sin conexión, por ejemplo) y enviar notificaciones push, todo sin pasar por las tiendas de aplicaciones.
2. Backend (El Cerebro del Sistema)
Compuesto por múltiples servicios pequeños que se comunican entre sí.
•	Lenguaje y Runtime: Node.js (v20+) con TypeScript.
•	Por qué: TypeScript ofrece seguridad de tipos, lo que reduce errores en producción y mejora la colaboración en equipo. Node.js es perfecto para aplicaciones I/O intensivas como esta.
•	Desglose de Microservicios:
•	Servicio de Autenticación: Gestiona registro de usuarios/bares, inicio de sesión y la generación/validación de Tokens JWT.
•	Servicio de Música: Se comunica con las APIs externas (YouTube y Spotify). Busca canciones, obtiene metadatos y devuelve las URLs de reproducción.
•	Servicio de Cola (Queue): El corazón en tiempo real. Gestiona el estado de la cola de reproducción usando WebSockets. Notifica a todos los clientes instantáneamente cuando una canción es añadida, movida o está sonando.
•	Servicio de Puntos y Pagos: Maneja toda la lógica de negocio de los puntos. Se integra con Stripe para procesar los micropagos de la función "Priority Play".
•	Servicio de Menú: Proporciona los endpoints CRUD (Crear, Leer, Actualizar, Borrar) para que el administrador gestione los productos del menú.
•	Servicio de Analíticas: Recopila datos de eventos (canciones pedidas, productos vendidos) y los procesa para mostrarlos en el dashboard.
3. Capa de Datos e Infraestructura
La fundación donde todo se ejecuta y almacena.
•	Base de Datos Principal: PostgreSQL.
•	Por qué: Es increíblemente robusto, escalable y su soporte para JSONB nos da la flexibilidad de un NoSQL con la consistencia de una base de datos relacional. Ideal para manejar transacciones de puntos y pedidos.
•	Hosting de Base de Datos: Supabase o Railway.
•	Por qué: Ofrecen instancias de PostgreSQL gestionadas y económicas, con backups automáticos y escalabilidad sencilla. Supabase además añade APIs automáticas sobre tu base de datos, lo que puede acelerar el desarrollo inicial.
•	Hosting Frontend: Vercel.
•	Por qué: Está hecho por los creadores de Next.js. Ofrece despliegues atómicos, CDN global por defecto y una integración perfecta. Es la mejor opción, sin discusión.
•	Hosting Backend (Microservicios): Railway o Fly.io.
•	Por qué: Permiten desplegar cada microservicio en su propio contenedor Docker. El modelo de pago por uso es mucho más económico que reservar instancias en AWS/GCP, y escalan automáticamente según la demanda.
•	Caché: Redis.
•	Por qué: Para almacenar datos de acceso frecuente (como la sesión de un usuario o las canciones más populares del día), reduciendo la carga sobre PostgreSQL y haciendo que la app se sienta instantánea.
•	Comunicación en Tiempo Real: WebSockets (con la librería Socket.IO).
•	Por qué: Es la tecnología estándar para comunicación bidireccional y en tiempo real, esencial para la sincronización de la cola de reproducción.
4. Servicios Externos y APIs
•	Música: YouTube Data API v3 (para el MVP) y Spotify Web API (como funcionalidad Premium).
•	Pagos: Stripe. La mejor documentación y facilidad de integración para procesar pagos online de forma segura.
•	Monitorización de Errores: Sentry. Te alertará en tiempo real si algo falla en producción, tanto en el frontend como en el backend.
•	CI/CD (Integración y Despliegue Continuo): GitHub Actions.
•	Por qué: Se integra directamente en tu repositorio de código. Automatizará los tests y el despliegue a Vercel/Railway cada vez que hagas un cambio en el código, asegurando un flujo de trabajo profesional.
