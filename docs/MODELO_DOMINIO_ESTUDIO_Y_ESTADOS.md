# Modelo de Dominio: Estudio, Perfiles, Áreas y Estados de OT

> Documento vivo de definición funcional para **Trafikeitor**. Registra únicamente lo ya acordado y marca explícitamente lo que sigue en análisis (`[POR DEFINIR]`).

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

## 3. Áreas / Departamentos por Perfil Operativo

Cada perfil precarga sus áreas base (editables, con opción de agregar nuevas áreas y asignar colores):

1. **`Diseño / Publicidad`:** `Cuentas`, `Tráfico`, `Creativos`, `Producción`, `Medios`, `Cliente`
2. **`Diseño / Branding`:** `Dirección`, `Estrategia`, `Identidad`, `Maquetación`, `Arte Final`, `Cliente` *(incluye Maquetación y Arte Final para editorial y packaging)*
3. **`Diseño / Web`:** `Dirección`, `UX/UI`, `Maquetación`, `Contenido`, `Cliente`
4. **`Desarrollo de Software`:** `Product`, `Frontend`, `Backend`, `QA`, `DevOps`, `Cliente`
5. **`Productora / Contenido`:** `Preproducción`, `Rodaje`, `Edición`, `Color/Audio`, `Cliente`
6. **`Personalizado`:** áreas definidas libremente por el estudio.

---

## 4. Etapas (Ciclo / Flujo de la OT)

Secuencia principal del recorrido y facturación de la OT (5 etapas):

`Tráfico` → `Recibida` → `Cerrar OT y Facturar` → `Facturada` → `Pagada`

---

## 5. Estados (Condición Operativa de la OT)

Situación operativa actual de la OT *(aún pendiente de ubicar en el layout)*:

- `Activa`
- `En proceso`
- `Suspendida`
- `Cancelada`
- `Archivada`

---

## 6. Reglas de Archivo en el Menú Principal

- Las OTs en estado **`Archivada`** y las OTs en **`Cancelada`** van ambas a **`OTs Archivadas`** en el menú principal.

---

## 7. Inspector de OT, Historial de Actividad y Mensajería Externa (WhatsApp / Slack)

- **Historial de Actividad (*Activity Log*):** Todas las acciones realizadas sobre una OT (subida de archivos, cambios de etapa/estado/responsable, marcación de urgente, etc.) se registran automáticamente con **usuario + fecha y hora** dentro del **Inspector derecho** de la OT (no en el enlace público de Revisión Colaborativa para clientes).
- **Sin chat intranet independiente:** En lugar de construir un chat general paralelo, Trafikeitor se conecta con **WhatsApp / Slack** en dos vías:
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
