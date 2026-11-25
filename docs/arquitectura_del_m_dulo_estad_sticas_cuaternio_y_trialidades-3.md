# Arquitectura del Módulo de Estadísticas — Trafigator

> **Principio rector:** La arquitectura lógica del motor se fundamenta en **3 Trialidades elevadas a Cuaternio (`ESPACIO | TIEMPO`)** sobre el Árbol del Estudio. Esta estructura gobierna las consultas, permisos y agregaciones por debajo para garantizar rigor matemático, cero redundancias y cero contradicciones; **el usuario final (creativo o creador de contenido) nunca ve esta teoría ni su vocabulario técnico**, sino atajos de 1 clic en lenguaje operativo cotidiano.

---

## 1. Fundamento Operativo: El Árbol del Estudio y la Máquina de Estados

El módulo de Estadísticas no inventa variables externas; se alimenta al 100% de las entidades, relaciones y ejes definidos en el **Árbol del Estudio** y en el **Modelo de Dominio**:

### 1.1. Estructura Superior (Contexto y Actores)

* **Estudio / Perfil (`ESPACIO` macro):** `Publicidad`, `Branding`, `Web`, `Software`, `Productora Contenido` (y modo `Personalizado` del Dominio).
* **Departamentos (`ESPACIO` operativo por Perfil — editables y reordenables):**
  * **Publicidad:** `Cuentas`, `Creativo`, `Medios`, `Producción`, `Cliente`, `Facturación`.
  * **Branding:** `Dirección`, `Estrategia`, `Identidad`, `Maquetación`, `Arte Final`, `Cliente`, `Facturación`.
  * **Web:** `Dirección`, `UX/UI`, `Maquetación`, `Contenido`, `Cliente`, `Facturación`.
  * **Software:** `Product`, `Frontend`, `Backend`, `QA`, `DevOps`, `Cliente`, `Facturación`.
  * **Productora Contenido:** `Preproducción`, `Rodaje`, `Edición`, `Color/Audio`, `Cliente`, `Facturación`.
* **Equipo (`Colaboradores` internos):** `Dueño` (`owner`) + colaboradores internos (`member`, ej. `Colaborador 01` a `Colaborador 04` o según puestos del plan).
* **Cliente (`DF` Cliente):** Directorio de clientes activos del Estudio (`Cliente 01`, `Cliente 02`, etc.) con su jerarquía interna `Cliente -> Marca -> Producto` y contactos `client` opcionales.

### 1.2. Regla de Nacimiento y Ciclo de Vida (Aplica igual a OTs y Tareas)

Tanto las **OTs** como las **Tareas** operan bajo dos ejes independientes —**`Etapa`** (tránsito, acuse de recibo y cobro) y **`Estados`** (condición real de ejecución)— con la siguiente secuencia determinista:

| Momento del ciclo | Disparador | `Etapa` | `Estado` |
| :--- | :--- | :--- | :--- |
| **1. Pre-apertura** | Se está llenando, pero el Responsable aún no firma | *(No existe todavía)* | *(No existe todavía)* |
| **2. Nacimiento y despacho** | El Responsable firma y envía a `Depto` + miembro del `Equipo` | **`Tráfico`** *(automático)* | **`Activa`** *(automático)* |
| **3. Acuse de recibo** | El receptor cambia manualmente la etapa a `Recibida` | **`Recibida`** *(manual)* | **`En Proceso`** *(automático)* |
| **4. Nuevos relevos (`De: -> Para:`)** | La OT o Tarea pasa a otro departamento o persona | Vuelve a **`Tráfico`** hasta nuevo acuse | Permanece **`En Proceso`** |
| **5. Tramo administrativo (solo OTs)** | Avance hacia cierre y cobro | **`Cerrar OT/Facturar` -> `Facturada` -> `Pagada`** | Permanece viva (**`En Proceso`**) hasta archivado manual |
| **6. Pausa o salida manual** | Cambio manual de condición operativa | Conserva su última etapa | **OTs:** `Suspendida`, `Cancelada`, `Archivada`<br>**Tareas:** `Suspendida`, `Cancelada`, `Terminada` |

> **Regla de existencia en Estadísticas:** Todo borrador sin firma del Responsable es invisible para el motor estadístico; solo existen registros que hayan cruzado el paso 2.

---

## 2. El Modelo Relacional: De las Trialidades al Cuaternio (`ESPACIO | TIEMPO`)

El motor organiza el universo completo de datos del Estudio como un **Cuaternio relacional**:

| Componente del Cuaternio | Variable en el Árbol del Estudio | Rol estructural en el motor |
| :--- | :--- | :--- |
| **Centro Nodal** | `Estudio / Perfil` (`organizationId`) | Contenedor aislado y contexto del oficio operativo. |
| **3 `DF` (Entidades base)** | `Cliente` · `Colaborador` (`Equipo`) · `OT/Tarea` | Los tres vértices en tensión: *para quién*, *quién ejecuta* y *qué se entrega*. |
| **3 `rf` (Operadores móviles)** | `prioridad` · `etapa` · `estado` | Calificadores dinámicos sobre cualquier cruce (`Urgente`, `Tráfico -> Pagada`, `Activa -> Archivada/Terminada`). |
| **Eje `ESPACIO`** | `Perfil` y `Depto` | La **posición** dentro del taller: en qué línea y estación exacta está parada o transitando cada `OT/Tarea` (incluyendo `Cliente` y `Facturación`). |
| **Eje `TIEMPO`** | `Fecha entrada` · `Tiempo asignado` · `Fecha Entrega` | La **cinemática** del sistema: cuándo entra, cuánto esfuerzo horario consume y cuándo vence. |

### Regla clave: `rf` móviles (no estáticas)

Las tres relaciones fundamentales (`prioridad`, `etapa`, `estado`) **no están atadas de forma rígida a una sola intersección**. La geometría es referencial: cualquier cruce binario entre `DF` (por ejemplo, `Cliente` y `Colaborador`, o `Cliente` y `OT/Tarea`) puede leerse simultáneamente bajo `prioridad`, `etapa` y `estado`, así como proyectarse sobre `ESPACIO` y `TIEMPO`.

---

## 3. Las 3 Trialidades (Un Solo Motor, 3 Puntos de Vista)

No existen módulos estadísticos separados. Existe **una sola matriz de coordenadas** y lo que cambia es el **Punto de Vista (Ancla)**: una o más dimensiones quedan fijas y todas las demás quedan libres para proyectarse alrededor de ellas.

| Trialidad | Familia de Foco | Punto de Vista FIJO (Ancla) | Qué queda LIBRE (Variables que se cruzan y proyectan) | Lectura estadística y operativa que habilita |
| :--- | :--- | :--- | :--- | :--- |
| **1. ESTUDIO**<br>*(Lo General)* | **Totalidad** | **`Estudio`** *(sin recortes)* | **Todos** los `Perfiles` y `Deptos` (`ESPACIO`), **todos** los `Clientes`, **todos** los `Colaboradores` activos, **todas** las `OTs` y `Tareas`, **todas** las `rf` (`prioridad`, `etapa`, `estado`) y **todo** el `TIEMPO` (`Fecha entrada`, `Tiempo asignado`, `Fecha Entrega`). | Radiografía integral del estudio: volumen total vivo vs. histórico, balance entre Espacios/Perfiles, cartera de cobro, ocupación global de horas y cuellos de botella generales. |
| **2. LO PARTICULAR**<br>*(Rotación de vértice)* | **2A. Por `DF` (Actores)** | **`Cliente` particular**<br>*(ej. `Cliente 01`)* | Todas las `OTs` y `Tareas` de ese cliente (con desglose opcional por `Marca/Producto`) · todos los `Perfiles` y `Deptos` (`ESPACIO`) · todos los `Colaboradores` que lo atienden · todas las `rf` · todo el `TIEMPO`. | Peso real de una cuenta: demanda que genera, qué perfiles/colaboradores absorbe, qué tiene pendiente en `Depto: Cliente`, cuánto acumula en `Cerrar OT/Facturar` y cumplimiento de entregas. |
| **2. LO PARTICULAR** | **2A. Por `DF` (Actores)** | **`Colaborador` particular**<br>*(Dueño o `Colaborador 01-04`)* | Todas las `OTs` y `Tareas` asignadas a esa persona · de todos los `Clientes` · en todos los `Perfiles` y `Deptos` (`ESPACIO`) donde participa · en todas las `rf` · todo su `TIEMPO` (`Fecha entrada`, `Tiempo asignado` vs. jornada, `Fecha Entrega`). | Carga real y desempeño individual: qué tiene sin recibir (`Tráfico + Activa`), qué está ejecutando (`En Proceso`), horas comprometidas por día/semana y ritmo de cierre. |
| **2. LO PARTICULAR** | **2B. Por `ESPACIO`** | **`Perfil / Espacio` particular**<br>*(`Publicidad`, `Branding`, `Web`, `Software`, `Productora Contenido`)* | Todos los `Deptos` propios de ese perfil · todos los `Clientes` atendidos en esa línea · todos los `Colaboradores` que operan ahí · todas las `OTs` y `Tareas` del perfil · todas las `rf` · todo el `TIEMPO`. | Comportamiento de una línea de negocio aislada: qué departamento dentro del perfil frena el flujo, qué clientes dominan ese espacio, carga horaria y flujo de facturación del perfil. |
| **2. LO PARTICULAR** | **2B. Por `ESPACIO`** | **`Depto` particular**<br>*(ej. `Creativo`, `UX/UI`, `Backend`, `Rodaje`, `Cliente`, `Facturación`)* | Todas las `OTs` y `Tareas` paradas o transitando por esa estación · de todos los `Clientes` · en manos de los `Colaboradores` de ese depto · en todas las `rf` · todo el `TIEMPO`. | Mapa de cuellos de botella por estación: saturación de un área específica, volumen detenido en `Depto: Cliente` esperando aprobación o acumulado en `Depto: Facturación`. |
| **2. LO PARTICULAR** | **2C. Por `rf` (Operadores)** | **`Prioridad` particular**<br>*(`Urgente` vs. Estándar)* | Todas las `OTs` y `Tareas` con esa prioridad · de todos los `Clientes` · asignadas a todos los `Colaboradores` · en todos los `Perfiles` y `Deptos` (`ESPACIO`) · en cualquier `etapa` y `estado` · todo el `TIEMPO`. | Radar de presión y riesgo: qué clientes o perfiles generan más urgencias, qué colaboradores absorben el fuego y cuántas horas de la semana se van en urgentes. |
| **2. LO PARTICULAR** | **2C. Por `rf` (Operadores)** | **`Etapa` particular**<br>*(`Tráfico`, `Recibida`, `Cerrar OT/Facturar`, `Facturada`, `Pagada`)* | Todas las `OTs` (y `Tareas` cuando aplique `Tráfico`/`Recibida`) en esa etapa · de todos los `Clientes` · de todos los `Colaboradores` · en todos los `Perfiles` y `Deptos` (`ESPACIO`) · bajo cualquier `prioridad` y `estado` · todo el `TIEMPO`. | Control de tránsito y caja: en `Tráfico` muestra relevos sin acuse de recibo; en `Cerrar OT/Facturar`, `Facturada` y `Pagada` muestra el embudo de cobro. |
| **2. LO PARTICULAR** | **2C. Por `rf` (Operadores)** | **`Estado` particular**<br>*(`Activa`, `En Proceso`, `Suspendida`, `Cancelada`, `Archivada`, `Terminada`)* | Todas las `OTs` y/o `Tareas` bajo esa condición operativa · de todos los `Clientes` · de todos los `Colaboradores` · en todos los `Perfiles` y `Deptos` (`ESPACIO`) · con cualquier `prioridad` y última `etapa` · todo el `TIEMPO`. | Auditoría de salud operativa: cuánta obra está viva sin arrancar (`Activa`), ejecutándose (`En Proceso`), congelada (`Suspendida`), abortada (`Cancelada`) o cerrada (`Terminada`/`Archivada`). |
| **2. LO PARTICULAR** | **2D. Por `TIEMPO`** | **`Fecha Entrega` (Horizonte)**<br>*(`Vencidas`, `Hoy`, `Mañana`, `Esta semana`, `Próxima semana`, rango)* | Todas las `OTs` y `Tareas` que vencen en ese horizonte · de todos los `Clientes` · asignadas a todos los `Colaboradores` · en todos los `Perfiles` y `Deptos` (`ESPACIO`) · con sus `rf` · su `Fecha entrada` y `Tiempo asignado`. | Tráfico de compromisos: quién entrega qué en cada ventana futura o atrasada, detectando picos de entregas antes de que colapsen la semana. |
| **2. LO PARTICULAR** | **2D. Por `TIEMPO`** | **`Fecha entrada` (Período de ingreso)**<br>*(`Hoy`, `Esta semana`, `Este mes`, rango)* | Todas las `OTs` y `Tareas` abiertas en esa ventana · por `Cliente`, `Perfil`/`Depto` (`ESPACIO`), `Colaborador`, `rf`, `Tiempo asignado` y `Fecha Entrega`. | Pulso de demanda: ritmo de trabajo nuevo que entra al estudio, estacionalidad por cliente o perfil y velocidad de entrada vs. salida/cierre. |
| **2. LO PARTICULAR** | **2D. Por `TIEMPO`** | **`Tiempo asignado` (Capacidad / Carga)**<br>*(Horas presupuestadas por día, semana o rango)* | Suma y distribución de horas asignadas cruzadas contra `Colaboradores` (vs. jornada estándar), `Perfiles`/`Deptos` (`ESPACIO`), `Clientes`, `OTs`/`Tareas`, `rf` y `Fecha Entrega`. | Capacidad real del taller: días/personas con holgura o sobrecarga, esfuerzo horario consumido por cliente/perfil y base para contraste futuro contra tiempo real (EgoMaker). |
| **3. OTs / TAREAS**<br>*(El Objeto Operativo)* | **3A. Macro (`OTs`)** | **Conjunto de `OTs`**<br>*(`Todas las OTs` / `Mis OTs`)* | Ciclo completo de OT (`Tráfico -> Pagada`) y sus 5 estados (`Activa` a `Archivada`) + `Prioridad` (`Urgente`), cruzados con `Cliente`, `Colaborador`, `ESPACIO` y `TIEMPO`. | Vista maestra de órdenes del estudio o propias: volumen activo, ritmo de apertura-cierre-facturación, cumplimiento de fechas compromiso y distribución por cliente/perfil. |
| **3. OTs / TAREAS** | **3B. Zoom (`1 OT`)** | **Una `OT` particular**<br>*(ej. `OT 26-001`)* | Su `Cliente`, su `Perfil` y recorrido de `Deptos` (`ESPACIO`), **todas sus `Tareas` / Sub-OTs hijas**, todos los `Colaboradores` que intervienen, las `rf` de la OT y de cada hija, y su `TIEMPO` completo. | Anatomía completa de un proyecto específico: avance real de sus tareas, dónde está frenado el relevo, horas asignadas totales y margen frente a la entrega final. |
| **3. OTs / TAREAS** | **3C. Micro (`Tareas`)** | **Conjunto de `Tareas`**<br>*(`Todas las Tareas` / `Mis Tareas`)* | Ciclo operativo de Tarea (`Tráfico -> Recibida`) y sus 5 estados (`Activa` a `Terminada`) + `Prioridad` (`Urgente`), cruzados con su `OT` madre, `Cliente`, `Colaborador`, `ESPACIO` y `TIEMPO`. | Vista pura de ejecución diaria: quién hace qué tarea y cuándo la entrega, tareas pendientes de acuse (`Tráfico + Activa`), avance de terminadas y ocupación en el Stripboard. |
| **3. OTs / TAREAS** | **3D. Zoom (`1 Tarea`)** | **Una `Tarea` particular**<br>*(ej. `OT 26-001-1`)* | Su `OT` madre, `Cliente`, `Colaborador` asignado, `Perfil` y `Depto` (`ESPACIO`), sus `rf` y su tríada de `TIEMPO`. | Unidad atómica de seguimiento: estado de acuse y ejecución, tiempo presupuestado vs. fecha límite interna y posición dentro de la OT madre. |

---

## 4. Regla de Composición y Frontera UX (Motor vs. Usuario Final)

### 4.1. Fijación Múltiple (Composición de Anclas)

El motor admite encadenar anclas sobre el mismo modelo sin recalcular reglas ni crear consultas especiales:

* **1 ancla (Corte simple):** `Cliente 01` -> radiografía completa de esa cuenta.
* **2 anclas (Intersección binaria):** `Cliente 01` + `Perfil: Web` -> solo lo de ese cliente en el espacio Web.
* **3+ anclas (Coordenada exacta):** `Colaborador 02` + `Depto: Creativo` + `Etapa: Tráfico` + `Fecha Entrega: Esta semana` -> relevos sin acuse que esa persona entrega esta semana en Creativo.

### 4.2. Traducción Invisible para el Usuario Creativo

* **En el Backend / Motor:** Todo se resuelve como consultas sobre el Cuaternio (`anclas`, `universo`, `proyección`, `alcance RBAC`).
* **En la Interfaz (Escritorio y Estadísticas):** Nunca se muestran términos como *Trialidad*, *Cuaternio*, *DF* o *rf*. Cada barra, número o tarjeta es un **atajo operativo de 1 clic**: tocar una barra (ej. *"Esta semana"*, *"Creativo"* o *"Cliente 01"*) rota el ancla en silencio y baja directo a la lista viva de OTs o Tareas correspondientes.

---

## 5. Precisiones Técnicas de Implementación del Motor

Estas tres reglas cierran las ambigüedades de cálculo antes de escribir código.

### 5.1. Regla de No Duplicación de `Tiempo asignado` (Regla de Nodos Hoja)

El motor **nunca** suma horas del padre (OT) más horas de sus hijas (Tareas o Sub-OTs vinculadas por `parent_ot_id`):

1. **OT con 1 o más `Tareas` / Sub-OTs hijas:** Las horas nacen únicamente en las hojas. El `Tiempo asignado` de la OT padre es un **valor derivado** ($\sum \text{Tareas activas/terminadas}$), ignorando cualquier estimación manual previa en el padre al agregar.
2. **OT con `0` hijas:** La propia OT actúa como nodo hoja y el motor toma su `Tiempo asignado` directo (`estimatedHours`).
3. **Filtro por `Estado` al sumar horas:**
   * **`Cancelada`:** Nunca suma horas ni al total de la OT ni a la capacidad del colaborador.
   * **`Terminada`:** Sí suma al *esfuerzo total acumulado de la OT* (universo `THROUGHPUT`), pero **no** suma a la *carga pendiente / disponibilidad futura* del colaborador (universo `LIVE`).
   * **`Suspendida`:** No suma a la carga horaria diaria/semanal mientras permanezca pausada.

### 5.2. Universos de Consulta por Defecto (`LIVE` vs. `THROUGHPUT`)

Para evitar que el histórico infle la operación diaria —sin romper el progreso real de una OT ni el seguimiento de caja—, el motor opera con **2 presets de universo**:

* **`LIVE` (Default operativo):** Incluye `Activa`, `En Proceso`, `Suspendida`. Excluye `Archivada`, `Cancelada` y `Terminada`.
  * *Nota sobre `Suspendida`:* Entra en conteos y alertas operativas (porque permanece en mesa y no pasa a `OTs Archivadas`), pero queda excluida de la sobrecarga de horas diarias/semanales y de los vencimientos activos de entrega.
* **`THROUGHPUT` (Default de progreso, ritmo y caja):** Incluye `Activa`, `En Proceso`, `Suspendida`, `Terminada` y `Archivada`. Excluye `Cancelada` salvo ancla explícita en `Estado: Cancelada`. Se activa automáticamente al anclar **`1 OT`**, ventanas de **`Fecha entrada`**, **`Etapa: Pagada`** o métricas de **Ritmo / Cumplimiento**.

### 5.3. Tabla de Proyecciones Automáticas por Defecto según el Ancla

Para evitar que el usuario tenga que configurar un *"Agrupar por"* manual cada vez que selecciona un ancla, cada punto de vista trae su universo y proyección automática:

| Ancla fija (Punto de Vista) | Universo default | Proyección automática principal (`Agrupar por`) | Segunda lectura / desglose sugerido |
| :--- | :--- | :--- | :--- |
| **`Estudio`** *(General)* | `LIVE` | **`Perfil`** *(si opera 2+ perfiles)* o **`Depto`** *(si opera 1 perfil)* | `Colaborador` / `Fecha Entrega` |
| **`Cliente` particular** | `LIVE` | **`Etapa`** *(dónde va su trabajo y su cobro)* | `Colaborador` / `Marca` / `Perfil` |
| **`Colaborador` particular** | `LIVE` | **`Fecha Entrega`** *(horizonte: Urgente -> Próx. sem.)* | `Cliente` / `Tiempo asignado` |
| **`Perfil / Espacio` particular** | `LIVE` | **`Depto`** *(dónde está parada la pelota en esa línea)* | `Cliente` / `Etapa` |
| **`Depto` particular** | `LIVE` | **`Colaborador`** *(quién tiene carga en esa estación)* | `Fecha Entrega` / `Estado` |
| **`Prioridad` (`Urgente`)** | `LIVE` | **`Fecha Entrega`** *(vencidas, hoy, mañana...)* | `Colaborador` / `Cliente` |
| **`Etapa` particular** | `LIVE` *(`THROUGHPUT` en `Pagada`)* | **`Cliente`** *(en `Cerrar OT/Facturar`, `Facturada`, `Pagada`)* o **`Depto`** *(en `Tráfico`/`Recibida`)* | `Colaborador` / `Tiempo asignado` |
| **`Estado` particular** | Explícito *(el anclado)* | **`Cliente`** *(y en `Activa` / `En Proceso`, `Colaborador`)* | `Perfil` / `Fecha Entrega` |
| **`Fecha Entrega` (Horizonte)** | `LIVE` *(sin `Suspendida`)* | **`Colaborador`** *(quién entrega en esa ventana)* | `Cliente` / `Depto` |
| **`Fecha entrada` (Período)** | `THROUGHPUT` | **`Cliente`** *(qué cuentas impulsan la demanda)* | `Perfil` / `Etapa` |
| **`Tiempo asignado` (Capacidad)** | `LIVE` *(sin `Suspendida`)* | **`Colaborador`** *(horas vs. jornada estándar)* | `Perfil` / `Cliente` |
| **Conjunto de `OTs`** *(Todas / Mías)* | `LIVE` | **`Etapa`** *(pulso del ciclo completo)* | `Cliente` / `Fecha Entrega` |
| **Zoom `1 OT` particular** | `THROUGHPUT` | **`Estado` de sus `Tareas` / Sub-OTs** *(avance real)* | `Colaborador` / `Tiempo asignado` |
| **Conjunto de `Tareas`** *(Todas / Mías)* | `LIVE` | **`Fecha Entrega`** *(qué toca sacar primero)* | `Colaborador` / `Estado` |
| **Zoom `1 Tarea` particular** | Explícito | **Ficha directa** *(sin agrupación: `OT` madre, `Depto`, `rf`, `TIEMPO`)* | — |

---

## 6. Vistas Predeterminadas en Escritorio por Rol

El Escritorio no despliega todo el Cuaternio de golpe; inicializa un **preset predeterminado según el rol del usuario autenticado**, donde cada bloque es al mismo tiempo lectura estadística y atajo de 1 clic.

### 6.1. Dueño (`owner`) — Ancla Inicial: Trialidad 1 (`Estudio`)

| # | Estadística Predeterminada (`Estudio`) | Coordenada en el Cuaternio | Universo y Regla | Qué responde al Dueño | Rotación al hacer 1 clic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Horizonte de Entregas** | `OT/Tarea` $\times$ `Fecha Entrega` + `Urgente` | **`LIVE`** *(sin `Suspendida`)* | Volumen en **Vencidas/Urgentes · Hoy · Mañana · Esta semana · Próxima semana**. | Ancla `Fecha Entrega` o `Urgente` *(Trialidad 2C/2D)* |
| **2** | **Pulso de Acuse y Operación** | `OT/Tarea` $\times$ (`etapa` $\times$ `estado`) | **`LIVE`** | Separa **Sin recibir** (`Tráfico + Activa`), **En ejecución** (`En Proceso`, destacando relevos `Tráfico`) y **Detenidas** (`Suspendida`). | Ancla `Etapa` o `Estado` *(Trialidad 2C)* |
| **3** | **Capacidad y Carga del Estudio** | `Colaborador` $\times$ `Tiempo asignado` vs. `dailyHours` | **`LIVE`** *(Nodos Hoja; solo equipo interno activo; sin `Suspendida`)* | Horas comprometidas hoy y esta semana frente a la capacidad real del taller, mostrando holgura o sobrecarga por integrante. | Ancla `Colaborador` o `Tiempo asignado` *(Trialidad 2A/2D)* |
| **4** | **Distribución por Espacio y Cuellos de Botella** | `ESPACIO (Perfil / Depto)` $\times$ `OT/Tarea` | **`LIVE`** | Dónde está detenida la pelota: agrupa por `Perfil` (2+ perfiles) o `Depto` (1 perfil), destacando siempre lo retenido en `Depto: Cliente`. | Ancla `Perfil` o `Depto` *(Trialidad 2B)* |
| **5** | **Ritmo del Estudio y Ciclo de Facturación** | `OTs` $\times$ `Fecha entrada` + `Etapa` administrativa | **`THROUGHPUT`** *(corte: `Hoy` · `Esta semana` · `Este mes`)* | Contrasta **Abiertas nuevas** vs. **Cerradas/Archivadas** y expone la caja viva en OTs: **`Cerrar OT/Facturar` -> `Facturada` -> `Pagada`**. | Ancla `Fecha entrada` o `Etapa` administrativa *(Trialidad 2C/2D)* |
| **6** | **Concentración por Cliente** | `Cliente` $\times$ `OT/Tarea` + `Tiempo asignado` + `Urgente` | **`LIVE`** *(Nodos Hoja)* | Qué cuentas concentran más OTs activas, horas presupuestadas y urgencias. | Ancla `Cliente` particular *(Trialidad 2A)* |

#### Capa Derivada de Desempeño (Extensiones conectadas al motor)

* **7. Cumplimiento de Entregas (`% a tiempo vs. fuera de fecha`):** Universo `THROUGHPUT`. Compara `Fecha Entrega` comprometida contra el timestamp real de cierre (cuando una OT entra a `Cerrar OT/Facturar` / `Archivada`, o una Tarea pasa a `Terminada`). Se integra junto al bloque de Ritmo en cuanto el motor persista la fecha de cierre real.
* **8. OTs con más Cambios y Reprocesos:** Extensión de trazabilidad sobre `route_entries` y `review_threads` (conteo de regresos `De: Cliente` o decisiones `[ AJUSTES ]` emitidas desde `/review/:token`).
* **9. Tiempo Asignado vs. Tiempo Real (Futuro plugin EgoMaker):** Extensión opcional sobre el eje `TIEMPO` que cruza `Tiempo asignado` contra horas efectivamente registradas.

### 6.2. Colaborador (`member`) — Ancla Inicial: Trialidad 2A (`Colaborador = Yo`)

| # | Estadística Predeterminada (`Colaborador`) | Coordenada en el Cuaternio | Universo y Regla | Qué le responde en 1 vistazo | Rotación al hacer 1 clic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Mi Horizonte de Entregas** | `Colaborador (Yo)` $\times$ `OT/Tarea` $\times$ `Fecha Entrega` + `Urgente` | **`LIVE`** *(sin `Suspendida`)* | Compromisos **Vencidos/Urgentes · Hoy · Mañana · Esta semana · Próxima semana** (fechas selladas en la OT). | Filtra `Mis Tareas` / `Mis OTs` *(Trialidad 3)* |
| **2** | **Mi Bandeja de Acuse y Ejecución** | `Colaborador (Yo)` $\times$ `OT/Tarea` $\times$ (`etapa` $\times$ `estado`) | **`LIVE`** | Separa **Sin recibir** (`Tráfico + Activa`), **En ejecución** (`Recibida + En Proceso`) y **En pausa** (`Suspendida`). | Abre ítems por estado/etapa *(Trialidad 2C)* |
| **3** | **Mi Capacidad Horaria** | `Colaborador (Yo)` $\times$ `Tiempo asignado` vs. `dailyHours` | **`LIVE`** *(Nodos Hoja; sin `Suspendida`)* | Horas comprometidas hoy y esta semana frente a la jornada del estudio, enlazado a su Stripboard personal. | Abre `Stripboard` en día/semana *(Trialidad 2D)* |
| **4** | **Mi Distribución por Cliente y Depto** | `Colaborador (Yo)` $\times$ `Cliente` + `Depto` | **`LIVE`** *(Nodos Hoja; acotado a cuentas/deptos permitidos)* | Qué cuentas y áreas le absorben más esfuerzo. | Ancla `Cliente` o `Depto` permitido *(Trialidad 2A/2B)* |
| **5** | **Mi Ritmo de Cierre y Cumplimiento** | `Colaborador (Yo)` $\times$ `Estado: Terminada` + cumplimiento | **`THROUGHPUT`** *(corte: `Hoy` · `Esta semana` · `Este mes`)* | Tareas/OTs cerradas en el período y porcentaje entregado a tiempo (capa derivada personal). | Historial de cierres del período *(Trialidad 3)* |

* **Variante Colaborador con Visibilidad Global (`allowed_client_id = '*'`) o rol `Tráfico`:** Mantiene `Colaborador = Yo` como vista inicial, pero habilita el conmutador para consultar los bloques operativos de **`Estudio`** (horizontes globales, acuses sin recibir del equipo, carga por miembro y cuellos por `Depto`), **manteniendo oculto el tramo financiero de facturación** (`Cerrar OT/Facturar`, `Facturada`, `Pagada`) salvo permiso explícito del Dueño.

### 6.3. Cliente / Cuentas Colaborativo (`client`) — Ancla Inicial: Trialidad 2A (`Cliente = allowed_client_id`)

* Su Escritorio nace y permanece **bloqueado** en su cuenta (`allowed_client_id = 'c-xxx'`).
* Proyecta únicamente:
  1. **Horizonte de Entregas de su cuenta** (`LIVE`).
  2. **Estado de avance de sus OTs** (`Etapa` operativa / `Estado` en `LIVE`).
  3. **Pendientes en su cancha** (`Depto: Cliente` y piezas en revisión esperando su aprobación).
* Quedan ocultos: otros clientes, capacidad horaria interna del equipo, carga de colaboradores ajenos y estadísticas financieras internas del estudio.

### 6.4. Qué queda deliberadamente fuera de lo predeterminado

Para proteger la limpieza del Escritorio, no se fijan como vistas por defecto: zooms individuales (`1 OT` / `1 Tarea`), `Estado: Cancelada`, histórico bruto de `Archivada` fuera de ventanas de Ritmo/Cobro, ni cruces compuestos de 2 o más anclas (reservados para exploración bajo demanda).

---

## 7. Alineación e Integración con el Módulo Dominio y Gestión de Equipo

Para que el módulo de Estadísticas no choque con el modelo de dominio ni con las reglas ya implementadas de gobernanza del equipo (`MODELO_DOMINIO_ESTUDIO_Y_ESTADOS.md`, `PLAN_GESTION_EQUIPO_COLABORATIVO_2.md` y `definici_n_funcional_y_roles_de_trafigator.md`), el motor debe cumplir estrictamente estas reglas de frontera:

### 7.1. Reglas de Integración con el Módulo Dominio

1. **Aislamiento Total por Estudio (`organizationId`):**
   * Toda consulta del Cuaternio exige `WHERE organization_id = :activeOrgId` como filtro raíz inmutable.
   * Toda preferencia local de Estadísticas (último ancla, período seleccionado, ordenamiento) se guarda en `localStorage` usando el prefijo particionado (`getScopedStorageKey` con `organizationId` y `userId`) y se purga al cambiar de estudio o cerrar sesión.
2. **Jornada Estándar Dinámica (`dailyHours`):**
   * El denominador de capacidad horaria **nunca** se hardcodea a `8h`. Se lee dinámicamente desde `studioSettings.dailyHours` (rango `4h` a `14h`).
   * Capacidad diaria del estudio:
     $$\text{Capacidad}_{\text{día}} = \text{dailyHours} \times N_{\text{equipo interno activo}}$$
   * Capacidad individual:
     $$\text{Ocupación}_{i} = \frac{\sum \text{Horas LIVE Nodos Hoja}_{i}}{\text{dailyHours}}$$
3. **Perfiles Operativos y Departamentos Personalizados (Resiliencia Histórica):**
   * El Dominio permite editar, reordenar, colorear y crear departamentos personalizados, o cambiar de Perfil Operativo.
   * **Regla en `LIVE`:** Las barras de `ESPACIO` respetan el orden y catálogo actual de departamentos del Perfil activo.
   * **Regla en `THROUGHPUT` (Histórico):** Si un departamento fue renombrado o eliminado tras cerrar OTs antiguas, el motor conserva sus registros históricos sin descartarlos ni fallar, agrupándolos bajo su referencia histórica o etiqueta `(Depto archivado)`.
   * **Estudios híbridos / multi-perfil vs. mono-perfil:** Si el estudio opera 1 perfil, la proyección de `Estudio` en `ESPACIO` muestra directamente `Depto`; si opera 2 o más perfiles, muestra `Perfil` con desglose a `Depto`.
4. **Coexistencia con Sub-OTs (`parent_ot_id` / `OT-26-XXX-1`, `-2`) y `Cliente -> Marca -> Producto`:**
   * Las sub-OTs ligadas por `parent_ot_id` se comportan como nodos hoja bajo la OT madre a efectos de la **Sección 5.1**, garantizando que no se dupliquen horas ni se infle el conteo de proyectos macro en Trialidad 3A.
   * En Trialidad 2A (`Cliente`), la estructura `Cliente -> Marca -> Producto` del Dominio funciona como sub-agrupación opcional dentro de esa misma `DF`, sin alterar el número de vértices del Cuaternio.

### 7.2. Reglas de Integración con Gestión de Equipo y RBAC

1. **Matriz de Alcance RBAC Aplicada en Servidor (antes de agregar):**
   El motor de estadísticas hereda la capa de seguridad del middleware `/api/studio/*` antes de calcular cualquier métrica:

   | Actor (`memberRole` + `allowed_client_id`) | Acceso al Cuaternio | Tramo Financiero (`Cerrar OT/Facturar`, `Facturada`, `Pagada`) | Capacidad del Estudio |
   | :--- | :--- | :--- | :--- |
   | **`owner`** (Dueño) | Total (`Estudio`, Particular, `OTs/Tareas`) | **Sí** | **Sí** *(entra en denominador)* |
   | **`member` con `allowed_client_id = '*'`** | Arranca en `Colaborador = Yo`; puede rotar a vistas operativas de `Estudio` | **No** *(salvo permiso explícito)* | **Sí** *(entra en denominador)* |
   | **`member` con `allowed_client_id = 'c-xxx'`** | Solo `Colaborador = Yo` y registros donde `client_id = c-xxx` o participa en `De: -> Para:` | **No** | **No** ve capacidad global *(solo su propia jornada)* |
   | **`client` con `allowed_client_id = 'c-xxx'`** | Bloqueado en `Cliente = c-xxx` | **No** | **No** *(no entra al denominador interno)* |
   | **Invitado temporal (`share_token`)** | Sin acceso a Estadísticas ni Escritorio | **No** | **No** *(sus decisiones en `/review/:token` alimentan la métrica derivada de Reprocesos)* |

2. **Cupos y Denominador de Capacidad (`owner` + `member` activos únicamente):**
   * Los usuarios con `role = 'client'` (ilimitados, no consumen cupo del equipo) **jamás** se suman al denominador de capacidad horaria del estudio ni aparecen en el gráfico de carga interna del equipo.
   * Solo los integrantes internos (`role IN ('owner', 'member')`) con `members.status = 'active'` conforman la capacidad productiva disponible.
3. **Tratamiento de Miembros Desactivados (`members.status = 'deactivated'`):**
   * **En universo `LIVE`:** Un miembro desactivado **sale inmediatamente** del denominador de capacidad del estudio. Sin embargo, si todavía tiene OTs o Tareas vivas asignadas sin reasignar, el motor **no las oculta**: aparece como fila/barra de alerta etiquetada `(Inactivo)` para que el Dueño detecte trabajo huérfano y lo reasigne.
   * **En universo `THROUGHPUT`:** El miembro desactivado **se mantiene visible** en métricas históricas (cierres, cumplimiento, horas ejecutadas del mes/año) etiquetado como `(Inactivo)`, evitando distorsionar el historial del estudio.
4. **Impacto del Retiro y Reasignación Atómica (`POST /api/studio/team/member/reassign-and-delete`):**
   * Al transferir la carga viva (`status NOT IN ('Archivada', 'Cancelada', 'Terminada')`) de un miembro saliente a un miembro activo, las horas y entregas `LIVE` migran de inmediato a la capacidad del nuevo responsable.
   * Las OTs/Tareas ya cerradas conservan su firma/autoría histórica en `THROUGHPUT` para mantener íntegra la trazabilidad del desempeño pasado.
5. **Cruces con Departamentos Asignados por Miembro (`users.departments`):**
   * Dado que el Dueño asigna los departamentos operativos de cada colaborador desde su ficha individual (`#team-member-detail-modal`), el motor utiliza `users.departments` para validar la proyección `Depto -> Colaborador` (mostrando carga por área real de cada integrante y evitando reportar disponibilidad ociosa en departamentos que esa persona no opera).