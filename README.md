# Logseq Web Clipper

Extensión de Chrome para capturar y resaltar contenido web con opciones de exportación inteligentes, optimizada para Logseq.

## Estado Actual

| Aspecto | Estado |
|---------|--------|
| **Versión** | 0.3.0 |
| **Manifest** | v3 |
| **Repositorio** | Local (sin publicar) |
| **Uso** | Personal |

### Funcionalidades Implementadas

- Captura de página completa o selección
- Highlighting de texto con múltiples colores
- Conversión HTML → Markdown (Turndown.js)
- Formato compatible con Logseq (bullets, properties)
- Templates básicos personalizables
- Exportación a clipboard
- Almacenamiento de preferencias (chrome.storage)
- Popup UI con preview
- Página de opciones

### Estructura del Proyecto

```
Web Clipper/
├── manifest.json          # Config extensión (v3)
├── popup/                  # UI principal
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/                # Scripts inyectados en páginas
│   ├── content.js
│   └── content.css
├── background/             # Service worker
│   └── service-worker.js
├── options/                # Página de configuración
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/                    # Librerías y utilidades
│   ├── turndown.min.js     # HTML→Markdown
│   ├── logseq-formatter.js # Formato Logseq
│   ├── templates.js        # Sistema de templates
│   ├── storage.js          # Persistencia
│   └── filesystem.js       # Acceso a archivos
├── icons/                  # Iconos de la extensión
└── native-host/            # (Experimental) Conexión nativa
```

---

## Ideas Futuras

### 1. Captura Inteligente

**Objetivo**: Detectar automáticamente el tipo de contenido y extraer información relevante.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Auto-detect content type | Identificar si es artículo, video, tweet, receta, producto, código | Media |
| Metadata extraction | Extraer autor, fecha publicación, tiempo de lectura estimado | Baja |
| Content cleanup | Remover ads, popups, navegación, sidebars automáticamente | Media |
| Schema.org parsing | Usar datos estructurados cuando estén disponibles | Baja |

**Implementación sugerida**:
- Usar heurísticas por dominio (YouTube, Twitter, Medium, etc.)
- Parsear meta tags (og:, article:, schema.org)
- Readability.js para limpiar contenido

---

### 2. Templates Dinámicos

**Objetivo**: Templates inteligentes que se adaptan al contenido.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Domain-specific templates | Templates automáticos para YouTube, Twitter, GitHub, etc. | Media |
| Smart variables | `{{author}}`, `{{published_date}}`, `{{read_time}}`, `{{thumbnail}}` | Media |
| Template editor | UI para crear/editar templates en la extensión | Alta |
| Template sharing | Importar/exportar templates como JSON | Baja |

**Variables disponibles actualmente**:
- `{{title}}`, `{{url}}`, `{{date}}`, `{{selection}}`, `{{content}}`

**Variables propuestas**:
- `{{author}}` - Autor del contenido
- `{{published_date}}` - Fecha de publicación original
- `{{read_time}}` - Tiempo estimado de lectura
- `{{thumbnail}}` - URL de imagen destacada
- `{{domain}}` - Dominio de origen
- `{{tags}}` - Tags sugeridos

---

### 3. Anotaciones Avanzadas

**Objetivo**: Enriquecer highlights con contexto y conexiones.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Notes per highlight | Agregar comentario/nota a cada highlight individual | Media |
| Tags per highlight | Asignar tags específicos a cada resaltado | Media |
| Related pages | Sugerir páginas de Logseq relacionadas al contenido | Alta |
| Highlight colors | Asignar significado semántico a colores (ej: amarillo=importante) | Baja |

**Formato propuesto**:
```markdown
- {{highlight}}
  - nota:: Mi comentario sobre esto
  - tags:: #concepto #importante
```

---

### 4. Captura de Imágenes

**Objetivo**: Capturar y anotar contenido visual.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Area screenshot | Capturar región específica de la página | Media |
| Image annotation | Agregar flechas, círculos, texto sobre capturas | Alta |
| OCR | Extraer texto de imágenes capturadas | Alta |
| Image hosting | Subir a servicio y obtener URL (o guardar local) | Media |

**Dependencias potenciales**:
- html2canvas para screenshots
- Tesseract.js para OCR
- Canvas API para anotaciones

---

### 5. Integración Real con Logseq

**Objetivo**: Conexión directa con el grafo de Logseq.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Logseq API | Enviar contenido directo via plugin/API | Alta |
| Page autocomplete | Autocompletar `[[páginas]]` existentes del grafo | Alta |
| Auto backlinks | Detectar menciones a páginas existentes | Media |
| Graph browser | Mini-explorador del grafo en el popup | Muy Alta |

**Opciones de implementación**:
1. **Native Messaging** (parcialmente implementado en `/native-host/`)
2. **Logseq Plugin API** (requiere plugin companion)
3. **File system access** (ya existe en `/lib/filesystem.js`)

---

### 6. Productividad

**Objetivo**: Acelerar el flujo de trabajo de captura.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Keyboard shortcuts | `Alt+H` highlight, `Alt+S` save, `Alt+E` edit | Baja |
| Quick capture | Un click con settings predeterminados | Baja |
| Capture queue | Guardar múltiples capturas antes de exportar | Media |
| Recent captures | Historial de las últimas N capturas | Baja |
| Batch capture | Capturar todos los tabs abiertos | Media |

**Shortcuts propuestos**:
- `Alt+Shift+C` - Abrir popup
- `Alt+H` - Activar highlight mode
- `Alt+S` - Quick save con defaults
- `Alt+E` - Editar antes de guardar

---

### 7. Lectura y Research

**Objetivo**: Mejorar la experiencia de lectura antes de capturar.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Reader mode | Vista limpia sin distracciones | Media |
| AI summary | Resumen automático del contenido | Alta |
| Translation | Traducir contenido antes de guardar | Media |
| Table of contents | Generar índice de artículos largos | Baja |

**Dependencias**:
- Readability.js para reader mode
- API externa para AI/traducción (o local con WebLLM)

---

### 8. Organización

**Objetivo**: Mejor gestión de capturas y configuración.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Collections/Folders | Agrupar capturas por proyecto/tema | Media |
| Bulk actions | Acciones masivas sobre capturas | Media |
| Settings sync | Sincronizar config entre dispositivos | Baja |
| Export/Import | Backup completo de configuración | Baja |

---

### 9. UX Premium

**Objetivo**: Pulir la experiencia de usuario.

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| Onboarding | Tutorial interactivo para nuevos usuarios | Media |
| Theme variants | Más opciones de colores/temas | Baja |
| Usage stats | Estadísticas de capturas realizadas | Baja |
| Animations | Micro-interacciones y feedback visual | Baja |

---

## Próximos Pasos

### Prioridad Alta (Quick Wins)
1. [ ] Keyboard shortcuts básicos
2. [ ] Quick capture con un click
3. [ ] Más variables en templates (`{{author}}`, `{{domain}}`)

### Prioridad Media
4. [ ] Templates por dominio (YouTube, Twitter)
5. [ ] Historial de capturas recientes
6. [ ] Reader mode básico

### Prioridad Baja (Futuro)
7. [ ] Integración API Logseq
8. [ ] OCR para imágenes
9. [ ] AI summary

---

## Historial de Cambios

| Fecha | Versión | Cambios |
|-------|---------|---------|
| - | 0.3.0 | Versión actual con highlighting y templates |
| - | 0.2.0 | Agregado sistema de templates |
| - | 0.1.0 | Versión inicial con captura básica |

---

## Notas Técnicas

### Permisos requeridos
- `activeTab` - Acceso al tab actual
- `storage` - Guardar preferencias
- `clipboardWrite` - Copiar al portapapeles
- `scripting` - Inyectar content scripts

### Compatibilidad
- Chrome/Chromium (Manifest v3)
- Edge (compatible)
- Firefox (requiere adaptación)
