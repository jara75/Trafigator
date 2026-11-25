# Contrato de Diseño y Operación — Módulo Estudio (`Perfil del Estudio`)

> **Rama objetivo:** `ui/sketch-exp-2` (`src/sketch/settings.js`, `src/sketch/store.js`, `src/sketch/new-ot.js`, `src/sketch/ot-detail.js`)  
> **Sistema de Diseño:** `trafigator-ui` (Obsidian — `#191919` / `#202020` / `#2A2A2A` / `#f59e0b`)  
> **Estado:** Aprobado para diseño y maquetación

---

## 1. Principios del Cambio de Modelo

1. **Separación de Puertas de Entrada (Estudio vs. Ajustes de App):**
   - Clic en **`EM · El Marcante`** (`#btn-studio-footer`) $\rightarrow$ abre directo en **`Perfil del Estudio`** mostrando el bloque `ESTUDIO` (*Perfil del Estudio, Miembros del Equipo, Clientes, Membresía y Facturación, API Keys y Datos*).
   - Clic en **`14 días`** (`#btn-trial-badge`) $\rightarrow$ abre directo en **`Membresía y Facturación`**.
   - Clic en **Piñón** (`#btn-settings-menu`) $\rightarrow$ abre directo en **`Preferencias`** (*Preferencias, Ayuda y Legal, Otros Productos*).

2. **El Perfil del Estudio define el Modo Operativo (Preset de Oficio):**
   - En lugar de un desplegable aislado que solo escupe etiquetas, el estudio elige su **Modo Operativo** entre 4 perfiles:
     1. `Agencia / Publicidad`
     2. `Diseño / Branding`
     3. `Web / Software`
     4. `Productora / Contenido`
   - Elegir o cambiar el Modo Operativo precarga de forma coherente tanto la secuencia de **Departamentos (`De:` $\rightarrow$ `Para:`)** como el vocabulario de las **Etapas del Pipeline de Estados**.

3. **Departamentos con Orden de Flujo y Selector de Color en Popover (No rotación a ciegas):**
   - Los departamentos representan la secuencia real por la que viaja una OT en los selectores `De:` y `Para:` de `Nueva OT` y `Detalle de OT`.
   - Se muestran como una grilla/fila de tarjetas compactas numeradas o reordenables (`1. Cuentas`, `2. Tráfico`, `3. Creativos`...).
   - **Prohibido rotar colores a ciegas haciendo clic múltiples veces:** hacer clic en el círculo de color de un departamento abre un **mini-popover con los 8 colores curados de Obsidian** (`amber`, `sky`, `violet`, `emerald`, `rose`, `orange`, `teal`, `slate`) para elegir el color en un solo clic.

4. **Pipeline de Estados Estructurado por Fase (Con Color Semántico Blindado):**
   - Los estados de la OT **no** son una bolsa de etiquetas sueltas ni permiten colores arbitrarios que confundan la salud del tráfico (un estado `Cerrada` nunca puede ser rojo y un `Cancelada` nunca puede ser verde).
   - Se organizan visualmente como un **Pipeline de 5 Fases Operativas + 2 Terminales**, donde cada fase tiene su **color semántico fijo** y el estudio puede personalizar el nombre de los estados dentro de cada fase:

| Fase del Ciclo | Semántica en Mesa | Color Semántico Fijo (Obsidian) | Estados por Defecto (Agencia / Software) | Regla |
| :--- | :--- | :--- | :--- | :--- |
| **1. Entrada** | Pedido recibido / por iniciar | Gris (`#8C8C8C` / `zinc-400`) | `Tráfico`, `Recibido` / `Backlog` | Editable |
| **2. En Taller** | Producción activa del equipo | Ámbar (`#f59e0b` / `amber-400`) | `Activa`, `Desarrollo` / `In Progress` | `Activa` protegido 🔒 |
| **3. En Revisión** | En cancha del cliente / QA | Cyan (`#38bdf8` / `sky-400`) | `Cliente` / `QA / Staging` | Editable |
| **4. Rebote / Cierre** | Ajustes o Facturación | Violeta (`#a78bfa` / `violet-400`) | `Ajustes`, `Facturación` | Editable |
| **5. Salida** | Trabajo aprobado / cerrado | Verde (`#34d399` / `emerald-400`) | `Entregado`, `Cerrada` | `Cerrada` protegido 🔒 |
| **6. Terminales** | Fuera de mesa activa | Rojo (`#fb7185`) / Gris (`#5a6169`) | `Cancelada` 🔒, `Archivada` 🔒 | Protegidos 🔒 |

5. **Autoguardado Silencioso (Cero botón gigante "Guardar Estudio"):**
   - Todo cambio en `Nombre del Estudio`, `Siglas` (`EM`) o `Jornada diaria` (`8h`) se guarda automáticamente en `change`/`blur`, actualiza en vivo la cabecera y el pie izquierdo (`EM · El Marcante`) y muestra un indicador discreto `Guardado ✓` en la esquina superior derecha.

---

## 2. Diagramación Exacta de la Vista (`Perfil del Estudio`)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CONFIGURACIÓN          │  [ EM ]  El Marcante · Agencia / Publicidad            Guardado ✓   ✕  │
│ Ajustes                │────────────────────────────────────────────────────────────────────────│
│                        │                                                                        │
│ ESTUDIO                │  1. IDENTIDAD Y JORNADA                                                │
│ ● Perfil del Estudio   │  Nombre del Estudio              Siglas     Jornada diaria (Stripboard)│
│ ○ Miembros del Equipo  │  [ El Marcante                ]  [ EM   ]   [  8  ] h / día (rango 4–14)│
│ ○ Clientes             │                                                                        │
│ ○ Membresía y Fact.    │  MODO OPERATIVO DEL ESTUDIO (Define el flujo base de áreas y estados)  │
│ ○ API Keys y Datos     │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌────────┐ │
│                        │  │ ● Agencia / Pub. │ │ ○ Diseño / Brand │ │ ○ Web / Soft │ │ ○ Prod │ │
│ APLICACIÓN             │  └──────────────────┘ └──────────────────┘ └──────────────┘ └────────┘ │
│ ○ Preferencias         │────────────────────────────────────────────────────────────────────────│
│ ○ Ayuda y Legal        │  2. FLUJO DE DEPARTAMENTOS (Orden en selectores De: → Para:)           │
│ ○ Otros Productos      │                                                                        │
│                        │  [1 ● Cuentas ×]  [2 ● Tráfico ×]  [3 ● Creativos ×]  [4 ● Producción ×]│
│                        │  [5 ● Desarrollo ×]  [6 ● Medios ×]  [7 ● Cliente ×]  [+ Departamento ↵]│
│                        │   └─► Al tocar "●" abre mini-popover de 8 colores curados:             │
│                        │       ( 🟠 🔵 🟣 🟢 🔴 🟡 🩵 ⚪ )                                       │
│                        │────────────────────────────────────────────────────────────────────────│
│                        │  3. PIPELINE DE ESTADOS DE OT (Color semántico fijo por etapa)         │
│                        │                                                                        │
│                        │  FASE 1 · ENTRADA        ⚪ [ Tráfico × ]  [ Recibido × ]  [ + ]       │
│                        │  FASE 2 · EN TALLER      🟠 [ Activa 🔒 ]  [ Desarrollo × ] [ + ]      │
│                        │  FASE 3 · EN REVISIÓN    🔵 [ Cliente × ]  [ + ]                       │
│                        │  FASE 4 · AJUSTES/ADMIN  🟣 [ Facturación × ]  [ + ]                   │
│                        │  FASE 5 · SALIDA         🟢 [ Entregado × ]  [ Cerrada 🔒 ] [ + ]      │
│                        │  TERMINALES (Archivo)    🔴 [ Cancelada 🔒 ]  ⚫ [ Archivada 🔒 ]      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘