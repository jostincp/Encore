# Reglas de Documentación y Sincronización (Obsidian + Proyecto)

> **Verdad Única**: El CÓDIGO es la fuente de la verdad.
> **Jerarquía**: Código > Docs del Proyecto (`/docs`) > Obsidian (`/obsidian_docs`).

---

## 1. Modos de Operación

### A. Modo "Constructor" (Cuando Gemini escribe código)
Si generas o modificas código por petición del usuario:
1. Escribe el código.
2. Actualiza inmediatamente la documentación técnica en `/docs`.
3. Replica la actualización en `/obsidian_docs` usando los estándares de Obsidian (enlaces, tags).

### B. Modo "Auditor" (Cuando el Usuario escribe código)
Cuando el usuario solicite "Sincronizar documentación", "Auditar cambios" o "Documentar lo que hice", debes:
1. **Analizar**: Leer los archivos modificados recientemente o la carpeta indicada por el usuario.
2. **Comparar**: Verificar si la información en `/obsidian_docs` coincide con la realidad del código.
3. **Detectar**: Identificar discrepancias (nuevos endpoints, cambios de params, nuevas variables de entorno).
4. **Actualizar**: Reescribir las notas de Obsidian para reflejar el estado actual del código.

---

## 2. Estándares para Obsidian (`/obsidian_docs`)

### Metadata (Frontmatter)
Al inicio de cada archivo Markdown en Obsidian, incluye:
```yaml
---
tags: [proyecto/encore, tipo/doc]
ultima_actualizacion: YYYY-MM-DD
---
```

### Enlaces Internos
Usa la sintaxis `[[Concepto]]` para conectar ideas entre notas.
Ejemplo: "Este servicio usa [[Redis]] para caché y conecta con [[Auth-Service]]."

### Callouts (Bloques de Atención)
Usa callouts para destacar información crítica:
```markdown
> [!WARNING] Configuración Crítica
> Esta variable de entorno es obligatoria para producción.

> [!INFO] Nota de Implementación
> Este endpoint requiere autenticación JWT.
```

### Mapeo de Carpetas
| Tipo de Archivo (Código) | Destino Obsidian |
|--------------------------|------------------|
| `package.json` / Env Vars | `00-Start/` |
| Estructura / Diagramas | `10-Arquitectura/` |
| Microservicios / API | `20-Servicios/` |
| Utilidades / Libs | `30-Componentes/` |

---

## 3. Disparadores de Actualización

Cuando modifiques estos archivos, actualiza automáticamente la documentación:

| Archivo Modificado | Acción Requerida |
|-------------------|------------------|
| `package.json` | Actualizar `10-Arquitectura/11-Stack-Tecnologico.md` |
| Cualquier microservicio (`/backend/services/*`) | Actualizar `20-Servicios/21-Mapa-Servicios.md` y nota individual del servicio |
| Variables de entorno | Actualizar `00-Start/02-Guia-Inicio.md` |
| Nueva feature importante | Crear entrada en `30-DevLogs/YYYY-MM-DD-descripcion.md` |

---

## 4. Formato de Confirmación

Al terminar una tarea que involucre documentación, confirma de esta forma:
```
✅ Código implementado.
📝 Docs actualizados en `/docs/SERVICES/nuevo_servicio.md`.
🧠 Obsidian actualizado en `/obsidian_docs/20-Servicios/Nuevo-Servicio.md`.
```
