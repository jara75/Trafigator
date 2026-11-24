# Arquitectura de Plugins y Ecosistema — Trafigator

> Documento de definición arquitectónica para mantener el **Core de Trafigator** ligero, rápido y libre de burocracia, permitiendo activar herramientas especializadas y verticales de industria como **plugins desacoplados**.

---

## 1. Principio Rector: Core Pequeño, Ecosistema Modular

Trafigator nace para profesionales independientes y micro-estudios multidisciplinarios (1–3 personas). Su ventaja competitiva frente a herramientas enterprise es la **ligereza**.

Por eso se establece una frontera estricta entre el **Core** y los **Plugins**:

- **Qué vive siempre en el Core (nunca como plugin):**
  - `Estudio` (identidad, jornada diaria, clientes, equipo, suscripción).
  - Mecánica nativa de **`Espacios`** (`workspaceId` en OTs, barra superior estilo DaVinci Resolve, aislamiento de departamentos en Bitácora y filtrado).
  - **OTs y Tareas**, **Bitácora de Ruta** (con firma inmutable), **Galería + Versionado (`v1, v2, v3`)**, **Revisión Colaborativa**, **Stripboard** (presupuesto diario de horas), **Etapas** y **Estados**.
- **Qué vive como Plugin (opcional, activable a voluntad):**
  - Herramientas de nicho o de disciplina personal que no aplican a todos los usuarios (ej. **EgoMaker**).
  - **Space Packs** (verticales de industria que registran áreas y herramientas especializadas sobre el contenedor nativo de Espacios).
  - Integraciones o apps satélite del ecosistema (ej. **PanOptik**).

---

## 2. Contrato Técnico de un Plugin (Desacoplamiento en 3 Capas)

Un plugin real **se conecta, no se fusiona** con el código central:

1. **Base de datos aislada (Drizzle / SQLite):**
   - Cada plugin define sus propias tablas (ej. `egomaker_sessions`) referenciando únicamente llaves externas del Core (`organizationId`, `userId`, `otId`, `taskIndex`).
   - **Regla:** Prohibido añadir columnas específicas de un plugin a `work_orders` o `route_entries`. Si el plugin se desactiva, el esquema central ni se entera.
2. **Backend encapsulado (Hono):**
   - Sus endpoints viven bajo un prefijo aislado (`/api/plugins/<plugin-id>/*`), protegidos por el mismo middleware de sesión de **Better Auth** y aislamiento multi-tenant por `organizationId` usado en `/api/studio/*`.
3. **Frontend bajo demanda (ES Modules):**
   - Vive en su propia carpeta (`src/plugins/<plugin-id>/`) y se carga mediante `import()` dinámico **solo** si el Estudio o el Usuario tienen el plugin encendido.
   - Se hidrata leyendo OTs/tiras desde `data-bridge.js` / `core-state.js` y escuchando eventos del `EventBus`, sin acoplarse ni modificar la lógica interna de `Tráfico` ni del `Stripboard`.

---

## 3. Plugin Piloto #1: `EgoMaker` (Time-Box Competitivo)

### Propósito y Filosofía
Inspirado en la **Hoja de Tiempos invertida** (asignar el presupuesto de tiempo desde el lunes hacia adelante en lugar de inventar horas de memoria el viernes). `EgoMaker` convierte ese presupuesto en un **reto personal** (*"le asigné 2 horas a esta OT; voy a sacar mi mejor trabajo en menos tiempo"*).

Porque no todo el mundo tiene la disciplina ni el gusto por trabajar contra un reloj, **no pertenece al Core**: se activa o desactiva a voluntad.

### Arquitectura de `EgoMaker`
- **Tabla aislada:** `egomaker_sessions` (`id`, `organizationId`, `userId`, `otId`, `taskIndex`, `budgetMinutes`, `actualMinutes`, `startedAt`, `endedAt`, `status`, `createdAt`).
- **API:** `/api/plugins/egomaker/sessions` (iniciar, pausar, cerrar, ajustar tiempo manual, consultar KPIs por periodo/cliente).
- **Frontend:** `src/plugins/egomaker/` + punto de entrada opcional ligero `/egomaker` en Vite (mismo patrón multi-entrada de `review.html`).

### Puntos de Anclaje en la UI (Mínima Invasión)
Cuando `EgoMaker` está encendido, solo inyecta dos puntos de contacto:
1. **Disparador puntual:** Botón discreto (`▶ Reto`) en la tira del **Stripboard** y en el **Sobre OT** que lanza el contador ya hidratado con cliente, código OT, título y horas presupuestadas.
2. **Superficie propia (Mini-ventana flotante o `/egomaker`):** Reloj compacto de cuenta regresiva contra el presupuesto asignado que acompaña al usuario en pantalla mientras trabaja fuera de Trafigator (Affinity, Figma, VS Code, edición de video).

### Comportamiento y KPIs
- **Un solo reloj activo por usuario:** iniciar una sesión pausa automáticamente la anterior.
- **Sin deuda de cronómetro:** si una tarea se marca terminada sin usar el reloj, no corrompe métricas (asume `Real = Asignado` o permite ajuste manual rápido).
- **KPIs propios de `EgoMaker`:**
  - **Índice de Efectividad Personal:** % de tareas completadas dentro del presupuesto y saldo neto de horas ganadas/perdidas frente a la estimación inicial.
  - **Horas Reales por Cliente / Marca / OT:** insumo directo para facturación por horas o análisis de rentabilidad de fees mensuales.

---

## 4. Evolución: `Space Packs` (Espacios de Trabajo como Plugins de Industria)

Con el contenedor de `Espacios` (`workspaceId`) ya estable en el Core, los **Space Packs** permiten escalar Trafigator a cualquier disciplina creativa o técnica sin sobrecargar la interfaz base:

- **Qué registra un `Space Pack`:**
  - Su definición de Espacio (`id`, `name`, `shortName`, `color`, `departments` base).
  - Opcionalmente, widgets o extensiones inyectadas en slots del Sobre OT o del Inspector.
- **Ejemplos de catálogo futuro:**
  - **Core incluido:** `Diseño / Publicidad`, `Diseño / Branding`, `Diseño / Web`, `Desarrollo de Software`, `Productora / Contenido`.
  - **Extensiones / Packs futuros:**
    - `Pack Productora Pro`: notas con timecode, escaleta / call sheet.
    - `Pack Software Pro`: enlace a PRs / commits / despliegues.
    - `Pack Arquitectura`: áreas (`Anteproyecto, Planimetría, Renders, Obra, Cliente, Facturación`) + listado de planos.
    - `Pack Diseño Industrial`: áreas (`Concepto, CAD/3D, Prototipo, Producción, Cliente, Facturación`) + ficha de materiales.

---

## 5. Modelo Comercial y Ecosistema

La arquitectura desacoplada habilita un catálogo limpio dentro de **`Ajustes → Otros Productos / Complementos`**:
- **Trafigator Core:** herramienta limpia y completa para gestionar OTs, Bitácora, Revisión Colaborativa, Galería Versionada y Stripboard.
- **Complementos activables** (por Estudio `organizationId` o por Usuario):
  - `EgoMaker` (incluido en plan superior o como add-on).
  - `Space Packs` especializados por industria.
  - Integraciones con otros productos del ecosistema (ej. **PanOptik**).

---

## 6. Hoja de Ruta Pragmática (Cuándo se Construye)

No se construye un motor abstracto de plugins antes de validar el producto en producción:

1. **Fase Actual (Cierre de Prototipo → Beta):**
   - Cerrar **Escritorio** (Scopes y métricas del Core).
   - Conectar la UI Obsidian al backend real SQLite/Hono (`src/server/`).
   - Lanzar la **Beta** con los 5 Espacios base en el Core.
2. **Fase 2 (Primer Plugin Piloto):**
   - Implementar **`EgoMaker`** como el primer plugin real para validar en producción el contrato de tablas aisladas, prefijo `/api/plugins/*`, `import()` dinámico y slots de UI.
3. **Fase 3 (Ecosistema de Packs):**
   - Replicar el contrato validado con `EgoMaker` para habilitar **`Space Packs`** de industria y complementos comerciales desde `Otros Productos`.
