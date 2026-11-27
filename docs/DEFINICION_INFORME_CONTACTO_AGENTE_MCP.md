# Definición Funcional — Informe de Contacto, Asistente Agente y Conectividad MCP

> **Estado:** Definición conceptual y funcional.
> **Filosofía rectora:** **Un clic o menos.** El software hace el trabajo administrativo pesado por el usuario; la IA entra solo donde multiplica el valor real, sin obligar a nadie a configurar llaves técnicas ni pagar tokens dobles.

---

## 1. Plugin Oficial: Informe de Contacto (Formato McCann)

### 1.1. Propósito y Empaquetado Comercial
El **Informe de Contacto** se diseña como un **Plugin oficial activable** dentro del ecosistema de Trafigator —no como una carga obligatoria en el núcleo.
* Quien trabaja solo o en flujos sin actas formales mantiene su Trafigator liviano e implacable (Tablero, Tráfico, OTs, Stripboard, Corcho y Revisión).
* Quien gestiona relación formal con clientes (Publicidad, Branding, Cuentas, Estudios) enciende el plugin para convertir cada reunión en un respaldo contractual que además dispara trabajo en Tráfico.

### 1.2. Principios Rectores del Informe
1. **Responsabilidad exclusiva de la Agencia / Estudio:** El Informe de Contacto **nunca nace del Cliente**. Siempre lo levanta, revisa y emite la Agencia/Estudio tras cada reunión. El Cliente únicamente lo recibe, lo revisa y, si corresponde, envía observaciones dentro del plazo.
2. **Blindaje bilateral:** Protege a ambas partes por igual. Respalda a la Agencia si el Cliente desconoce un trabajo o fecha solicitada (por ejemplo, un aviso de prensa programado para un domingo), y protege al Cliente si solicitó un cambio de fecha y la Agencia incumplió.
3. **Inmutabilidad real:** Una vez enviado (y especialmente tras su aceptación expresa o por vencimiento de plazo), el Informe queda congelado en modo solo lectura para ambas partes. Ni el Dueño puede alterar fechas o puntos a escondidas. Cualquier corrección dentro del plazo queda como observación/aclaración registrada; cambios posteriores generan un nuevo Informe de Contacto.

### 1.3. Estructura Estándar del Documento
* **Encabezado:**
  * Consecutivo automático (ej. `IC-26-001`).
  * Cliente / Marca.
  * Fecha de la reunión.
  * Lugar / Canal (*Presencial / Oficinas del Cliente, Virtual / Meet, Chat / WhatsApp, Llamada telefónica, etc.*).
  * Asistentes: **Por el Cliente** y **Por la Agencia**.
* **Cuerpo (Tema → Punto):**
  * **Tema 01, Tema 02...:** Cada tema se vincula a una OT existente (seguimiento) o identifica un frente/proyecto nuevo.
  * **Punto 01, Punto 02...:** Registro concreto de lo presentado, lo aprobado, los cambios solicitados y los compromisos con fecha y hora (tanto del Cliente como de la Agencia).
* **Cierre:**
  * Firma automática de quien levantó el informe por la Agencia/Estudio.
  * **Cláusula / Disclaimer legal** (editable por el Dueño en la configuración de su Estudio según su abogado o país).

### 1.4. Redacción Base del Disclaimer Legal
> *El presente Informe de Contacto forma parte integral como anexo del acuerdo o contrato de prestación de servicios vigente entre el Cliente y la Agencia/Estudio. Si transcurridos tres (3) días hábiles desde su recepción el Cliente no manifiesta por escrito observaciones, aclaraciones o correcciones, su contenido se entenderá aceptado en todas sus partes, constituyendo autorización expresa y vinculante para la ejecución, producción, publicación y posterior facturación de los trabajos, fechas y alcances aquí consignados.*

### 1.5. Mecánica Operativa (Molde "Software Primero, IA Opcional")
Inspirado en el flujo sin fricción de captura → normalización → desglose → aprobación en 1 clic:
1. **Entrada sin fricción:** El usuario redacta, pega apuntes/correos, dicta una nota de voz rápida o arrastra el audio/transcripción de la reunión.
2. **Normalización por software (base gratuita/incluida):** El software estructura el contenido en el molde oficial (*Encabezado → Tema → Punto → Cierre*) sin depender de IA.
3. **Corrección humana en 1 clic:** Si un punto quedó mal clasificado (compromiso del Cliente vs. compromiso de la Agencia, o comentario sin acción), el usuario lo reclasifica en 1 clic o subraya cualquier frase para convertirla en OT/Tarea.
4. **Desglose a Tráfico con trazabilidad bidireccional:** Cada punto operativo propone el borrador de OT nueva, ajuste en OT existente o pase en la Hoja de Ruta (`De: → Para:`). Cada OT generada conserva el vínculo directo al Informe y al Punto exacto donde nació.
5. **Aprobación y despacho en 1 clic:** El Dueño/Director revisa el borrador, desmarca lo que fue charla al aire y pulsa **Aprobar**. En ese instante nacen las OTs en Tráfico, salen las notificaciones internas y el Informe se despacha al Cliente con dos botones de 1 clic (**Aceptar informe** / **Enviar observación**) más el reloj automático de **3 días hábiles** (vencido el plazo sin observaciones, pasa a **Aceptado por plazo** y se congela).

---

## 2. Separación Clara: Notas de Voz vs. Asistente Agente

Las **Notas de voz** y el **Asistente Agente** son dos piezas independientes:

* **Notas de voz nativas (sin agente):** Función integrada en toda la app para grabar y guardar un audio rápido (en el Corcho, en una Nota o en una OT) sin intervención de IA.
* **Asistente Agente:** Copiloto operativo capaz de estructurar información y ejecutar instrucciones sobre la marcha dentro de Trafigator, escalado en tres niveles:

| Dimensión | Free | Básica *(incluida)* | PRO *(pago)* |
| :--- | :--- | :--- | :--- |
| **Notas de voz nativas** *(sin agente)* | Sí | Sí | Sí |
| **Entrada al Agente** | Solo **voz corta directa** (sin archivos externos). | Solo **nota de voz directa con instrucciones** (sin subir audios externos, PDFs ni textos). | **Cualquier fuente:** grabaciones de reuniones, audios de WhatsApp, PDFs, Word, correos, transcripciones o texto suelto. |
| **Consultas rápidas** | Sí (*"¿Qué me vence hoy?"*). | Sí. | Sí + cruces complejos (*"¿Qué clientes deben insumos desde la semana pasada?"*). |
| **Acciones en el Corcho** | Poner notas rápidas por voz. | Poner, archivar, compartir y mover a OT/Tarea. | Todo + procesar archivos o audios arrastrados al Corcho para extraer tareas/OTs. |
| **Operación en Tráfico y Stripboard** | **Solo lectura** (no crea ni modifica OTs). | **Instrucciones 1 a 1:** abrir una OT, cambiar estado, asignar responsable, pasar `De: → Para:`, programar un bloque en el Stripboard. | **Instrucciones en lote y encadenadas:** crear múltiples OTs/sub-OTs a la vez, reprogramar un día del Stripboard o actualizar varias OTs desde una misma fuente. |
| **Plugin Informe de Contacto** | No. | **Desde dictado directo** (al colgar la llamada dictas los acuerdos y arma el borrador de acta + propuesta de OTs). | **Desde cualquier fuente** (audio completo de reunión, transcripción o hilo): separa Tema/Punto, Cliente vs. Agencia, genera el acta y desglosa OTs en lote. |

---

## 3. Conectividad MCP ("Trae tu propia IA") y Operación en Reuniones

### 3.1. Qué resuelve MCP
En lugar de obligar a los usuarios a tramitar llaves técnicas de API o a que Trafigator absorba costos variables de tokens, Trafigator expone un conector **MCP (Model Context Protocol)** de conexión simple (sin CLI ni API Keys).
* Cada usuario conecta Trafigator directamente a la **suscripción de IA que ya paga** (Gemini, Claude, ChatGPT u otro cliente compatible).
* **Costo de tokens para Trafigator: $0**, independientemente del volumen de uso del estudio.

### 3.2. Historia de Usuario: Operación desde el Celular en Plena Reunión
1. **Consulta silenciosa:** Durante una reunión presencial o virtual, el usuario consulta desde su celular a su propia IA (*"¿En qué quedó la OT de Hotel X?"*) y obtiene fechas, estado y último pase de la Hoja de Ruta sin navegar tablas en una pantalla pequeña.
2. **Captura en caliente:** Mientras el cliente aprueba o pide cambios, el usuario envía una línea corta por texto (o foto de un boceto/pizarra):
   * *"Agrega al Informe de Contacto de hoy con Hotel X: Tema 1, aprobaron aviso para el domingo 6; entregar arte final el jueves a las 4 PM."*
   * *"Pega en el Corcho: pedir a la revista las medidas exactas del aviso."*
3. **Cierre en 1 clic:** Al terminar la reunión y abrir Trafigator, el Informe de Contacto y los borradores de OTs ya están armados esperando únicamente la validación final del Director.

### 3.3. Reglas de Seguridad y Permisos (Web y MCP)
1. **Alcance universal por rol:** El conector MCP no inventa permisos nuevos; hereda exactamente las mismas reglas de la interfaz web:
   * **Dueño (`owner`):** Control total del estudio (consultas globales, OTs, Stripboard, emisión y aprobación de Informes de Contacto).
   * **Colaborador (`member`):** Opera únicamente las cuentas asignadas o las OTs donde participa en la Hoja de Ruta (`De: → Para:`), salvo visibilidad global habilitada por el Dueño. Puede consultar pendientes, registrar avances, usar el Corcho y organizar su Stripboard, sin borrar OTs ni alterar fechas de entrega comprometidas.
   * **Cliente Colaborativo (`client`):** Aislado estrictamente a su marca; puede consultar sus piezas, solicitar OTs y revisar entregas sin ver jamás otros clientes del estudio.
2. **Frontera entre acción inmediata y borrador:**
   * **Inmediato (0 fricción):** Consultas y guardar elementos en el **Corcho**.
   * **Borrador con confirmación en 1 clic:** Abrir OTs definitivas en Tráfico, modificar fechas comprometidas o despachar un **Informe de Contacto** al cliente. Nada compromete al estudio hacia afuera sin confirmación explícita.

---

## 4. Integración con el Ecosistema Google (Infraestructura del Estudio)

Trafigator no revende ni subsidia almacenamiento ni suscripciones de terceros; en su lugar, se conecta en **1 clic** con el ecosistema de Google que el estudio ya utiliza (ya sea una suscripción compartida de **Google One AI Pro** hasta para 5 personas o **Google Workspace**):

* **Google Drive:** Vínculo directo desde el Media Pool de cada OT a las carpetas de editables pesados del estudio (manteniendo liviano el servidor de Trafigator) y respaldos automáticos.
* **Google Meet:** Las grabaciones y transcripciones de reuniones con clientes guardadas en Drive sirven como insumo directo para que el Agente (o Gemini vía MCP) redacte el Informe de Contacto y proponga las OTs.
* **Google Docs y Sheets:** Exportación en 1 clic de Informes de Contacto a Docs y de tablas de Tráfico / resúmenes a Sheets.
* **Gemini vía MCP:** Todo el equipo de un micro-estudio puede operar bajo un mismo ecosistema y suscripción compartida, evitando fuga de contexto entre modelos distintos y eliminando la fricción de que cada colaborador tenga que pagar una IA por separado.

---

## 5. Matriz Comercial Consolidada (Cupos y Alcance)

| Característica | Free | Básico | PRO |
| :--- | :--- | :--- | :--- |
| **Colaboradores internos** *(adicionales al Dueño)* | 0 (Solo Dueño) | **Hasta 5 colaboradores** | **Hasta 10 colaboradores** |
| **Clientes e Invitados de Revisión** | Ilimitados | Ilimitados | Ilimitados |
| **Notas de voz nativas** *(sin agente)* | Sí | Sí | Sí |
| **Asistente Agente nativo** | Consulta + Corcho | Voz directa (1 a 1 + Informe por dictado) | Cualquier fuente + operación en lote |
| **Conector MCP (suscripción propia IA)** | — | Sí (operación 1 a 1 por rol) | Sí (operación completa + lote por rol) |
| **Plugin Informes de Contacto (McCann)** | No | Dictado directo (básico) | Completo (cualquier fuente, desglose y blindaje 3 días hábiles) |
| **Integración Ecosistema Google** | Básica (enlaces) | Drive / Docs / Sheets | Completa (Drive, Meet, Docs, Sheets + Gemini MCP) |