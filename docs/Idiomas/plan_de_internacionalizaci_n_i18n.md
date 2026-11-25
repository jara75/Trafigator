# Plan de Internacionalización (`i18n`) — Trafigator (`ES` / `EN` / `PT`)

> **Idioma base:** Español (`es`) — fuente de verdad validada en `sketch-ot.html` y `src/sketch/`.  
> **Idiomas objetivo:** Inglés (`en`) y Portugués (`pt`).  
> **Momento de ejecución:** Post-cableado de producción (cuando los textos de interfaz estén 100% cerrados).

---

## 1. Arquitectura Sin Duplicar Vistas (`src/i18n/`)

Para mantener intacto el sistema de diseño **Obsidian** y evitar librerías externas pesadas en un stack **Vanilla JS ES Modules + Vite + Hono**, se implementa un motor ligero basado en diccionarios JSON y atributos `data-i18n`:

```text
src/
└── i18n/
    ├── index.js        # Motor ligero: t(key, vars), setLanguage(lang), applyTranslations(root)
    ├── es.json         # Español (texto base actual validado 1:1)
    ├── en.json         # Inglés
    └── pt.json         # Portugués
```

---

## 2. Convenciones de Diccionarios y Dominio

### Estructura de claves (`es.json` / `en.json` / `pt.json`)
Las claves se organizan por módulo funcional:

```json
// src/i18n/es.json
{
  "nav.new_ot": "Nueva OT",
  "nav.traffic": "Tráfico",
  "nav.my_ots": "Mis OTs",
  "nav.my_tasks": "Mis Tareas",
  "nav.archive": "Archivo",
  "ot.route.from": "De:",
  "ot.route.to": "Para:",
  "ot.route.sign": "Firma",
  "review.approve": "Aprobar Pieza",
  "review.changes": "Solicitar Cambios"
}
```

```json
// src/i18n/en.json
{
  "nav.new_ot": "New WO",
  "nav.traffic": "Traffic",
  "nav.my_ots": "My WOs",
  "nav.my_tasks": "My Tasks",
  "nav.archive": "Archive",
  "ot.route.from": "From:",
  "ot.route.to": "To:",
  "ot.route.sign": "Sign-off",
  "review.approve": "Approve Asset",
  "review.changes": "Request Changes"
}
```

```json
// src/i18n/pt.json
{
  "nav.new_ot": "Nova OS",
  "nav.traffic": "Tráfego",
  "nav.my_ots": "Minhas OSs",
  "nav.my_tasks": "Minhas Tarefas",
  "nav.archive": "Arquivo",
  "ot.route.from": "De:",
  "ot.route.to": "Para:",
  "ot.route.sign": "Assinatura",
  "review.approve": "Aprovar Peça",
  "review.changes": "Solicitar Ajustes"
}
```

### Reglas de Dominio en Traducción
- **Siglas de Orden de Trabajo:** En interfaz visible, **OT** (Orden de Trabajo) se traduce como **WO** (*Work Order*) en inglés y **OS** (*Ordem de Serviço*) en portugués. Los códigos técnicos almacenados en SQLite (`OT-26-001`) permanecen inmutables.
- **Terminología oficial:** Mantener siempre la distinción **Detalle de OT / Tarea** (`ot-detail.js`), **Firma** y **Aprobado / Ajustes**.

---

## 3. Motor Vanilla JS (`src/i18n/index.js`)

```javascript
import es from './es.json';
import en from './en.json';
import pt from './pt.json';

const dictionaries = { es, en, pt };
let currentLang = localStorage.getItem('trafigator_lang') || 'es';

// 1. Traducción en plantillas dinámicas JS: ${t('nav.traffic')}
export function t(key, vars = {}) {
  let text = dictionaries[currentLang]?.[key] || dictionaries.es[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

// 2. Traducción automática de nodos DOM estáticos
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll('[data-i18n-tip]').forEach((el) => {
    const key = el.getAttribute('data-i18n-tip');
    if (key) el.setAttribute('data-tip', t(key));
  });
}

// 3. Cambio de idioma en caliente (sin recargar página)
export function setLanguage(lang) {
  if (!dictionaries[lang]) return;
  currentLang = lang;
  localStorage.setItem('trafigator_lang', lang);
  document.documentElement.lang = lang;
  applyTranslations(document);
  window.dispatchEvent(new CustomEvent('trafigator:lang-changed', { detail: { lang } }));
}
```

---

## 4. Puntos de Integración en la Aplicación

1. **HTML Estático (`index.html` y `review.html`):**
   - Etiquetas de texto: `<span data-i18n="nav.traffic">Tráfico</span>`
   - Placeholders: `<input data-i18n-placeholder="search.placeholder" placeholder="Buscar OT...">`
   - Tooltips Obsidian: `<button data-i18n-tip="nav.settings" data-tip="Ajustes">`
2. **Módulos JS (`traffic.js`, `ot-detail.js`, `stripboard.js`, `review-viewer.js`):**
   - Reemplazar cadenas literales dentro de template strings por `${t('clave')}`.
   - Suscribir el re-render de las vistas activas al evento `trafigator:lang-changed`.
   - Usar `Intl.DateTimeFormat(currentLang)` para fechas cortas y relativas sin lógica manual.
3. **Persistencia de Preferencia y Visor Público (`/review/:token`):**
   - **Usuario interno:** Selector `ES` / `EN` / `PT` en **Ajustes → Preferencias**, guardado en `localStorage` (`trafigator_lang`) y sincronizado con la preferencia del usuario en SQLite.
   - **Cliente externo (`/review/:token`):** Soporta parámetro opcional `?lang=en|pt|es` al compartir el enlace o detección automática mediante `navigator.language`.