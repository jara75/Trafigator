# Modelo de Dominio: Estudio, Perfiles, Áreas y Estados de OT

> Documento vivo de definición funcional para **Trafigator**. Registra únicamente lo ya acordado y marca explícitamente lo que sigue en análisis (`[POR DEFINIR]`).

---

## 1. Viaje del Usuario y Menú de Configuración

1. **Alta / Prueba:** El usuario entra, abre una cuenta y dispone de **14 días de prueba**.
2. **Acceso a Configuración:** Hace clic en el botón **"Nombre del Estudio"** ubicado en el pie del panel izquierdo.
3. **Comportamiento de navegación:** El menú de Configuración **desplaza al menú principal** dentro de la misma barra lateral izquierda (no quedan dos columnas de menú visibles al mismo tiempo).

### Estructura del Menú de Configuración

- **ESTUDIO**
  - `Perfil del Estudio` *(en definición)*
  - `Miembros del Equipo`
  - `Clientes`
  - `Membresía y Facturación`
  - `API Keys y Datos` *(estado inicial / por madurar)*
- **APLICACIÓN**
  - `Preferencias`
  - `Ayuda`
  - `Documentación`
  - `Legal`
  - `Otros Productos` *(`[POR DEFINIR]` si pertenece aquí)*

---

## 2. Perfil del Estudio — Identidad

- **Nombre del Estudio** *(editable)*
- **Iniciales**
- **Jornada diaria**
- **Perfil Operativo (Tipo de Estudio):**
  - `Diseño / Publicidad`
  - `Diseño / Branding`
  - `Diseño / Web`
  - `Desarrollo de Software`
  - `Productora / Contenido`
  - `Personalizado`

---

## 3. Áreas / Departamentos por Espacio (Perfil Operativo)

Cada espacio base precarga sus áreas de fábrica (con `Cliente` y `Facturación` incluidos en todos, y personalización de color 7×5):

1. **`Diseño / Publicidad` (`Publicidad`):** `Cuentas`, `Creativos`, `Medios`, `Producción`, `Cliente`, `Facturación`
2. **`Diseño / Branding` (`Branding`):** `Dirección`, `Estrategia`, `Identidad`, `Maquetación`, `Arte Final`, `Cliente`, `Facturación` *(incluye Maquetación y Arte Final para editorial y packaging)*
3. **`Diseño / Web` (`Web`):** `Dirección`, `UX/UI`, `Maquetación`, `Contenido`, `Cliente`, `Facturación`
4. **`Desarrollo de Software` (`Software`):** `Product`, `Frontend`, `Backend`, `QA`, `DevOps`, `Cliente`, `Facturación`
5. **`Productora / Contenido` (`Contenido`):** `Preproducción`, `Rodaje`, `Edición`, `Color/Audio`, `Cliente`, `Facturación`
6. **`Personalizado` *(Fase futura / Space Packs)*:** espacios definidos por industria o a medida.

---

## 4. Árbol del Estudio y Relaciones de Dominio

```text
Estudio
├── Perfil (Unidades operativas — cada una con sus propios Deptos)
│   ├── Publicidad            → Depto: Cuentas, Creativos, Medios, Producción, Cliente, Facturación
│   ├── Branding              → Depto: Dirección, Estrategia, Identidad, Maquetación, Arte Final, Cliente, Facturación
│   ├── Web                   → Depto: Dirección, UX/UI, Maquetación, Contenido, Cliente, Facturación
│   ├── Software              → Depto: Product, Frontend, Backend, QA, DevOps, Cliente, Facturación
│   └── Productora Contenido  → Depto: Preproducción, Rodaje, Edición, Color/Audio, Cliente, Facturación
│
├── Equipo (transversal al Estudio — puede participar en uno o varios Perfiles)
│   ├── Dueño
│   └── Colaboradores (01..N)
│
├── Cliente (transversal al Estudio — puede tener OTs en uno o varios Perfiles)
│   └── Cliente 01..N → Marca → Producto
│
└── Operación (vive dentro de un Perfil y pertenece a un Cliente)
    └── OTs
        ├── Etapa (5): Tráfico → Recibida → Cerrar OT y Facturar → Facturada → Pagada
        ├── Estado (5): Activa, En Proceso, Suspendida, Cancelada, Archivada
        ├── Prioridad: Urgente (sí/no)
        ├── Tiempo: Fecha entrada · Tiempo asignado · Fecha Entrega
        └── Tareas (hijas de una OT; heredan Perfil y Cliente)
            ├── Etapa (2): Tráfico → Recibida
            ├── Estado (5): Activa, En Proceso, Suspendida, Cancelada, Terminada
            ├── Prioridad: Urgente (sí/no)
            └── Tiempo: Fecha entrada · Tiempo asignado · Fecha Entrega
```

### Reglas estructurales del árbol
- **`Depto`** pertenece estrictamente a cada **`Perfil`** (no se mezclan áreas de un perfil con otro al filtrar por perfil).
- **`Equipo`** y **`Cliente`** son transversales al **`Estudio`**.
- **Diferencia `OTs` vs `Tareas`:**
  - Las **`OTs`** recorren las 5 etapas (incluyendo cierre, facturación y pago) y cierran en estado `Archivada` (o `Cancelada`).
  - Las **`Tareas`** solo tienen 2 etapas operativas (`Tráfico` y `Recibida`) porque no se facturan por separado, y cierran en estado **`Terminada`** (o `Cancelada`) mientras su OT puede seguir abierta.

---

## 5. Etapas y Estados (Resumen Operativo)

### Etapas
- **OTs (5):** `Tráfico` → `Recibida` → `Cerrar OT y Facturar` → `Facturada` → `Pagada`
- **Tareas (2):** `Tráfico` → `Recibida`

### Estados
- **OTs (5):** `Activa`, `En proceso`, `Suspendida`, `Cancelada`, `Archivada`
- **Tareas (5):** `Activa`, `En proceso`, `Suspendida`, `Cancelada`, `Terminada`

---

## 6. Reglas de Archivo en el Menú Principal

- Las OTs en estado **`Archivada`** y las OTs en **`Cancelada`** van ambas a **`OTs Archivadas`** en el menú principal.

---

## 7. Inspector de OT, Historial de Actividad y Mensajería Externa (WhatsApp / Slack)

- **Historial de Actividad (*Activity Log*):** Todas las acciones realizadas sobre una OT (subida de archivos, cambios de etapa/estado/responsable, marcación de urgente, etc.) se registran automáticamente con **usuario + fecha y hora** dentro del **Inspector derecho** de la OT (no en el enlace público de Revisión Colaborativa para clientes).
- **Sin chat intranet independiente:** En lugar de construir un chat general paralelo, Trafigator se conecta con **WhatsApp / Slack** en dos vías:
  - **Salida:** Envío automático de notificaciones/alertas sobre una OT o pieza.
  - **Entrada:** Las respuestas y mensajes vinculados a una OT desde WhatsApp/Slack quedan guardados en orden cronológico junto al aviso enviado dentro del **Inspector** de esa OT.

---

## 8. Módulo de Usuario vs. Ajustes del Estudio (Reglas UX)

**Regla de frontera:** Todo lo que afecta **solo a la persona** vive en **Configuración de Usuario**; todo lo que afecta **al estudio completo** (equipo, clientes, roles, permisos, departamentos del estudio, facturación) vive en **Ajustes del Estudio**.

### Qué encuentra y qué puede hacer el usuario en `Configuración de Usuario`
1. **Identidad visible y firma operativa *(Editable)*:**
   - **Avatar** con 3 modos: `Iniciales`, `Ícono` (selección vectorial) o `Subir foto` (con opción de cambiar/quitar).
   - **Color personal** (paleta de swatches) para identificar al usuario en avatares, firmas y actividad.
   - **Nombre completo**, **Firma corta** (nombre que aparece en rutas, Revisión Colaborativa e Historial de Actividad) y **correo / contraseña**.
2. **Papel y alcance en el estudio *(Solo lectura)*:**
   - **Rol** (`Dueño`, `Tráfico`, `Creativo`, `Producción`, etc.), **Alcance** (`Todo el estudio` o clientes asignados) y **Departamentos asignados** bajo modelo **multi-departamento** (`string[]`: el Dueño o un estudio unipersonal trabaja en **Todos los departamentos**, y cualquier miembro puede pertenecer a uno o varios departamentos simultáneamente).
   - El usuario solo los consulta aquí; su asignación corresponde al administrador en **Ajustes del Estudio → Miembros del Equipo**.
3. **Preferencias personales de operación *(Editable)*:**
   - **Jornada diaria personal** (horas disponibles por día para el cálculo de sobrecarga en su **Stripboard**).
   - **Vista inicial favorita** (`Lista`, `Kanban`, `Gantt`, `Día`, `Semana`, `Mes`).
   - **Notificaciones personales** (qué eventos recibir y por qué canal: WhatsApp / Correo).
4. **Control de sesión *(Menú rápido del avatar)*:**
   - Accesos a `Configuración de usuario`, `Cambiar de cuenta / estudio` y `Cerrar sesión`.

---

## 9. Ciclo de Vida de una OT y Mecánica de Firma en la Bitácora

1. **Creación en borrador (`Crear y Abrir OT`):**
   - `Cuentas` (u otro creador) llena el encabezado de la OT y abre la OT en modo edición.
   - Adjunta archivos/brief en la **Galería**, define el departamento y responsable destino, y redacta la primera fila en blanco de la **Bitácora de Ruta**:
     - `Fecha/Hora` (clic inserta fecha y hora actual), `DE` (ej. `Cuentas`), `PARA` (depto. destino), `Descripción` (brief), `Etapa: Tráfico`, `Estado: En proceso`, y `Firma: Sin firmar` por defecto.
   - **Regla de visibilidad:** Mientras la primera fila permanezca en **`Sin firmar`**, la OT aún **no está traficada** (no aparece en Tráfico ni genera notificaciones).
2. **Disparo al firmar (`Sin firmar` → Firma del usuario):**
   - La `Fecha/Hora` de la fila **se actualiza automáticamente a la fecha y hora exacta de la firma**.
   - La fila queda **bloqueada** (inmutable).
   - Se inserta automáticamente una **nueva fila en blanco** debajo para el siguiente pase.
   - La OT queda **traficada** (visible en `Tráfico` y en `Mis OTs` del asignado), se registra el evento en **Actividad** y se dispara la **notificación** al destinatario.
3. **Acuse de recibido:**
   - La persona asignada recibe la notificación, abre la OT y cambia la **Etapa** de **`Tráfico`** a **`Recibida`** (ese cambio queda registrado en **Actividad**).
4. **Ciclo iterativo entre departamentos:**
   - Cuando el responsable termina su entregable (ej. boceto en Galería), llena la siguiente fila en blanco (`DE: Creativos`, `PARA: Cuentas`, `Descripción: Adjunto boceto...`), selecciona su **Firma** (actualizando la hora a la de la firma, bloqueando la fila y abriendo otra en blanco), notifica al siguiente destinatario y el ciclo se repite hasta `Cerrar OT y Facturar → Facturada → Pagada`.

---

## 10. Arquitectura de Espacios por Perfil (Modelo DaVinci Resolve)

> **Principio rector:** *Juntos, pero no revueltos.* Pensado para estudios unipersonales y micro-estudios multidisciplinarios (1–3 personas) que operan varias disciplinas bajo un mismo techo sin querer mezclar departamentos ni perder visibilidad de su carga real.

### 1. Nivel Paraguas: `Estudio`
Pertenece al Estudio completo (nunca se duplica por Espacio):
- Identidad (`nombre`, `logo`, `iniciales`, `prefijo OT`, `jornada diaria`, `zona horaria`) y suscripción.
- **Clientes** (un mismo cliente puede tener OTs en distintos Espacios).
- **Equipo** (miembros internos del estudio).
- **Etapas base** (`Tráfico → Recibida → Cerrar OT y Facturar → Facturada → Pagada`) y **Estados** (`Activa`, `En proceso`, `Suspendida`, `Cancelada`, `Archivada`).
- **Vista panorámica `Estudio`:** consolida todas las OTs de todos los Espacios (mostrando la columna `Espacio` y permitiendo `Agrupar por: Espacio` en Lista y Kanban).

### 2. Nivel Operativo: `Espacios` (`ON / OFF`)
- En `Estudio → Perfiles y Flujo`, el usuario enciende (`ON / OFF`, mínimo 1) qué Espacios opera su Estudio.
- Cuando hay **2 o más Espacios en `ON`**, aparece centrada en la fila superior del panel central la barra de navegación estilo DaVinci Resolve:
  `Estudio | ● Publicidad | ● Web | ● Software | ...`
  *(Se oculta automáticamente cuando el estudio solo tiene 1 Espacio activo).*
- Cada OT nace con un `workspaceId` (desde `Nueva OT` con selector `Espacio *` preseleccionado al espacio actual).
- Dentro de cualquier OT, su **Bitácora (`De:` / `Para:`)** únicamente muestra los departamentos de `ot.workspaceId`, incluso si fue abierta desde `Tráfico · Estudio`.
- Al entrar a un Espacio puntual (`Publicidad`, `Web`, `Software`), la columna `Espacio` se oculta, el filtro `Depto.` y el Kanban por Departamento muestran únicamente las áreas de ese Espacio, y `Tráfico`, `Todas las Tareas`, `Mis OTs`, `Galería` y `Escritorio` filtran solo ese Espacio.

### 3. Regla Física del `Stripboard` (Hoja de Tiempos Invertida)
- **Tu jornada diaria (ej. 8h/día) es una sola**, aunque tus OTs se separen por Espacio.
- En el **Stripboard** (`Mis Tareas`), el cálculo de horas diarias (`Día: Xh / 8h`) siempre suma la carga real total entre todos los Espacios para impedir la ceguera de sobrecarga.
- Dentro de un Espacio puntual (ej. `Web`), las tareas de otros Espacios permanecen visibles pero atenuadas (`opacity-45`), acompañadas del desglose `Día: Xh / 8h (Nh Web + Mh otros)`.
- **Filosofía de presupuesto de tiempo:** El usuario asigna horas *hacia adelante* desde el inicio de semana/día como presupuesto de enfoque (en lugar de llenar planillas de memoria al final de la semana). El tracking competitivo en tiempo real (`Asignado vs. Real`) se documenta como plugin desacoplado en [`ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md`](./ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md).

---

## 11. Presets de Escritorio y Estadísticas por Rol

El Escritorio comparte un único motor de consultas (`LIVE` vs. `THROUGHPUT` con Regla de Nodos Hoja; especificación completa en [`arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md`](./arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md)) y despliega un **preset inicial según el rol**:

| Rol | Ancla inicial | Bloques predeterminados | Restricciones de visibilidad |
| :--- | :--- | :--- | :--- |
| **Dueño (`owner`)** | `Estudio` *(Global, con conmutador a Personal)* | 1. Horizonte de Entregas (`LIVE`) · 2. Pulso de Acuse y Operación (`LIVE`) · 3. Capacidad y Carga del Estudio (`LIVE` vs. `dailyHours`) · 4. Distribución por Espacio y Cuellos (`LIVE`) · 5. Ritmo y Ciclo de Facturación (`THROUGHPUT`) · 6. Concentración por Cliente (`LIVE`). | Acceso total + tramo financiero (`Cerrar OT/Facturar → Facturada → Pagada`). |
| **Colaborador (`member`)** | `Colaborador = Yo` *(Personal)* | 1. Mi Horizonte de Entregas (`LIVE`) · 2. Mi Bandeja de Acuse y Ejecución (`LIVE`) · 3. Mi Capacidad Horaria (`LIVE` vs. `dailyHours`) · 4. Mi Distribución por Cliente y Depto (`LIVE`) · 5. Mi Ritmo de Cierre y Cumplimiento (`THROUGHPUT`). | Sin tramo financiero ni capacidad de terceros. Si tiene `allowed_client_id = '*'` o rol `Tráfico`, habilita conmutador operativo a `Estudio` sin tramo financiero (salvo permiso del Dueño). |
| **Cliente (`client`)** | `Cliente = allowed_client_id` *(Bloqueado)* | 1. Horizonte de Entregas de su cuenta (`LIVE`) · 2. Estado de avance de sus OTs (`LIVE`) · 3. Pendientes en su cancha (`Depto: Cliente` y piezas en revisión). | Sin acceso a otros clientes, capacidad interna del equipo ni estadísticas financieras del estudio. |
| **Invitado (`share_token`)** | — | Sin acceso a Escritorio ni Estadísticas. | Solo enlace `/review/:token`. |
