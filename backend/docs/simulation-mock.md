# Guía de Simulación Encore (Mock Data)

Esta guía permite simular el flujo completo de Encore usando datos mock, sin depender de base de datos ni APIs externas. Incluye los endpoints, ejemplos de JSON, respuestas esperadas y un script PowerShell opcional para reproducir los pasos de forma simulada.

## Prerrequisitos
- Servicios pueden estar apagados; esta simulación usa respuestas mock. Si decides arrancar servicios, ajusta los puertos según tu entorno.
- Tokens de acceso y IDs se simulan; no requieren persistencia real.

## URLs Base (ajustables)
- `AUTH_BASE`: `http://localhost:3002/api` (Auth Service en modo dev)
- `MENU_BASE`: `http://localhost:3005/api` (Menu Service)
- `MUSIC_BASE`: `http://localhost:3001/api/music` (Music Service)
- `QUEUE_BASE`: `http://localhost:3002/api` (Queue Service)
- `POINTS_BASE`: `http://localhost:3003/api` (Points Service)

Nota: Si hay conflicto de puertos, cambia las variables en el script y en los ejemplos.

## Identificadores Mock
- `barId`: `123e4567-e89b-12d3-a456-426614174000`
- `songId`: `321e4567-e89b-12d3-a456-426614174111`
- `categoryId`: `789e4567-e89b-12d3-a456-426614174999`
- `userId`: `456e4567-e89b-12d3-a456-426614174222`

## Flujo Paso a Paso

### 1. Registro de Negocio (Bar Owner)
- Endpoint: `POST {AUTH_BASE}/auth/register-bar-owner`
- Body:
```json
{
  "email": "owner@example.com",
  "password": "Password123!",
  "nombre_del_bar": "Bar Encore"
}
```
- Respuesta esperada (mock):
```json
{
  "success": true,
  "user": {
    "id": "aa0b1111-2222-3333-4444-555566667777",
    "email": "owner@example.com",
    "role": "bar_owner",
    "isEmailVerified": false,
    "isActive": true
  },
  "bar": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Bar Encore",
    "city": "Madrid",
    "country": "ES"
  },
  "accessToken": "mock_access_token_bar_owner",
  "refreshToken": "mock_refresh_token_bar_owner"
}
```

### 2. Login del Negocio
- Endpoint: `POST {AUTH_BASE}/auth/login`
- Body:
```json
{ "email": "owner@example.com", "password": "Password123!" }
```
- Respuesta esperada (mock):
```json
{
  "success": true,
  "accessToken": "mock_access_token_bar_owner",
  "refreshToken": "mock_refresh_token_bar_owner"
}
```

### 3. Creación de Categoría y Menú
- Crear categoría:
  - Endpoint: `POST {MENU_BASE}/bars/{barId}/categories`
  - Headers: `Authorization: Bearer mock_access_token_bar_owner`
  - Body:
```json
{ "name": "Bebidas", "description": "Refrescos y cócteles", "is_active": true }
```
  - Respuesta (mock):
```json
{ "success": true, "data": { "id": "789e4567-e89b-12d3-a456-426614174999", "name": "Bebidas" } }
```
- Crear item de menú:
  - Endpoint: `POST {MENU_BASE}/bars/{barId}/menu`
  - Headers: `Authorization: Bearer mock_access_token_bar_owner`
  - Body:
```json
{
  "name": "Mojito",
  "description": "Clásico con hierbabuena",
  "price": 8.5,
  "category_id": "789e4567-e89b-12d3-a456-426614174999",
  "tags": ["popular", "cocktail"],
  "is_available": true
}
```
  - Respuesta (mock):
```json
{ "success": true, "data": { "id": "item-001", "name": "Mojito", "is_available": true } }
```

### 4. Configuración de Música Inicial (Búsqueda)
- Endpoint: `GET {MUSIC_BASE}/songs/search?q=queen&barId={barId}&limit=5`
- Headers: `Authorization: Bearer mock_access_token_bar_owner`
- Respuesta (mock):
```json
{ "success": true, "data": [ { "id": "321e4567-e89b-12d3-a456-426614174111", "title": "Bohemian Rhapsody", "artist": "Queen", "source": "spotify" } ] }
```

### 5. Registro de Cliente (Invitado)
- Endpoint: `POST {AUTH_BASE}/auth/register-guest`
- Respuesta (mock):
```json
{ "success": true, "user": { "id": "456e4567-e89b-12d3-a456-426614174222", "role": "guest", "isGuest": true }, "accessToken": "mock_access_token_guest" }
```

### 6. Upgrade a Miembro (Cliente)
- Endpoint: `POST {AUTH_BASE}/auth/register-user`
- Headers: `Authorization: Bearer mock_access_token_guest`
- Body:
```json
{ "email": "client@example.com", "password": "Password123!", "firstName": "Ana", "lastName": "Pérez" }
```
- Respuesta (mock):
```json
{ "success": true, "user": { "id": "456e4567-e89b-12d3-a456-426614174222", "email": "client@example.com", "role": "user" }, "accessToken": "mock_access_token_user", "refreshToken": "mock_refresh_token_user" }
```

### 7. Cliente explora el Menú
- Endpoint: `GET {MENU_BASE}/bars/{barId}/menu?is_available=true`
- Respuesta (mock):
```json
{ "success": true, "data": [ { "id": "item-001", "name": "Mojito", "price": 8.5 } ] }
```

### 8. Cliente pide una canción
- Endpoint: `POST {MUSIC_BASE}/queue/{barId}/add`
- Headers: `Authorization: Bearer mock_access_token_user`
- Body:
```json
{ "song_id": "321e4567-e89b-12d3-a456-426614174111", "priority_play": false, "notes": "Para celebrar" }
```
- Respuesta (mock):
```json
{ "success": true, "data": { "id": "queue-001", "status": "pending", "song_id": "321e4567-e89b-12d3-a456-426614174111" } }
```

### 9. Gestión de Cola de Reproducción
- Ver cola del bar (público): `GET {MUSIC_BASE}/queue/{barId}?status=pending,playing&include_details=true`
- Ver canción actual: `GET {MUSIC_BASE}/queue/{barId}/current`
- Siguiente canción: `GET {MUSIC_BASE}/queue/bars/{barId}/next` (según servicio)
- Reordenar cola (owner): `PATCH {MUSIC_BASE}/queue/bars/{barId}/reorder` Body:
```json
{ "queue_ids": ["queue-001"] }
```
- Respuestas (mock):
```json
{ "success": true }
```

### 10. Sistema de Puntos
- Balance del usuario: `GET {POINTS_BASE}/points/bars/{barId}/balance`
- Añadir puntos (admin/owner): `POST {POINTS_BASE}/points/transaction`
  - Headers: `Authorization: Bearer mock_access_token_bar_owner`
  - Body:
```json
{ "user_id": "456e4567-e89b-12d3-a456-426614174222", "bar_id": "123e4567-e89b-12d3-a456-426614174000", "type": "earn", "amount": 50, "description": "Compra de bebida" }
```
- Respuestas (mock):
```json
{ "success": true, "data": { "transaction": { "id": "txn-001", "type": "earn", "amount": 50 }, "balance": { "balance": 150 } } }
```

## Script PowerShell
Para ejecutar una simulación automática, usa `backend/scripts/simulate-encore-mock.ps1`. Este script NO llama a servicios reales por defecto (`DRY_RUN = $true`) y muestra las requests y respuestas mock.

## Notas
- Si decides activar servicios, usa los mismos endpoints con tokens reales.
- Algunos endpoints requieren rol específico (`bar_owner` o `admin`). En mock se asume validez del token.
- Ajusta puertos según tu entorno local.