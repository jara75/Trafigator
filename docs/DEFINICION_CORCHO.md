# Definición Funcional — Módulo **Corcho**

> **Estado:** Nueva definición conceptual y funcional (pantalla independiente).
> **Filosofía rectora:** **Un clic o menos.** Cero fricción, cero burocracia, máxima utilidad real.

---

## 1. Propósito y Concepto Rector

El **Corcho** es una **pantalla independiente** dentro de Trafigator —separada del **Tablero** *(antes Escritorio)*— concebida a partir de la lógica de un **tablero magnético físico**.

Existe para resolver una necesidad concreta del día a día: **tener un espacio libre donde dejar pegado todo lo que no se puede olvidar pero todavía no tiene orden, fecha ni prioridad establecida**, para consultarlo de un golpe de vista y ordenarlo, compartirlo o archivarlo después.

### Qué sí es
- Un espacio abierto para **retener y tener a la vista** cualquier elemento importante que aún no encaja (o no tiene por qué encajar) en una Orden de Trabajo.
- Un lugar válido tanto para asuntos cotidianos del estudio (*"Comprar café"*, *"Correo Impresor: impresor@imprenta.com"*) como para insumos transversales que atraviesan varias OTs (por ejemplo, un *Informe de entrevista* que necesitas consultar mientras revisas OT por OT).

### Qué no es (fronteras claras)
- **No es el Tablero:** el **Tablero** es el centro de control operativo diario (analogía al tablero de borrado rápido). El **Corcho** ya no vive comprimido en un cuadrante (`C04`) ni compite con la densidad del Tablero; respira en su propia pantalla.
- **No es Revisión Colaborativa:** Revisión Colaborativa (en sus dos instancias: **Revisión Interna** y **Revisión del Cliente**) es un módulo distinto con su propio propósito. El Corcho no intenta replicarlo ni reemplazarlo.
- **No es un gestor de Recordatorios:** las alarmas y recordatorios con hora de disparo son un tema aparte y no pertenecen al Corcho.

---

## 2. Qué se puede poner en el Corcho

**Cualquier cosa**, sin exigir categoría previa, cliente ni vínculo a una OT:

- Notas rápidas y datos sueltos (teléfonos, correos, pendientes informales como *"Comprar café"*).
- Archivos e insumos de consulta (PDFs, imágenes, documentos, informes transversales a varias OTs).
- Enlaces web y referencias.
- Ideas o borradores en bruto que todavía no están listos para convertirse en trabajo formal.

---

## 3. Acciones Fundamentales (Un clic o menos)

Todo elemento que vive en el Corcho responde a un ciclo simple de **7 acciones directas**, pensadas para ejecutarse en **un clic o menos**:

| Acción | Para qué sirve |
| :--- | :--- |
| **1. Poner** | Dejar pegado en el Corcho cualquier texto, dato, enlace o archivo al instante, sin formularios largos ni campos obligatorios. |
| **2. Consultar / Anotar en privado** | Ver el elemento a mano y registrar apuntes personales sobre él sin necesidad de abrir una OT ni exponerlo a terceros. |
| **3. Compartir** | Enviar el elemento a **quien sea** (equipo interno o externo), **por correo o por mensaje**, ya sea **para darlo a conocer** o **para revisarlo**. |
| **4. Mover a una OT o a una Tarea** | Cuando algo que nació suelto en el Corcho cobra forma operativa, promoverlo directamente a una OT existente o nueva, o convertirlo en una Tarea. |
| **5. Archivar (con Historial)** | Sacar del Corcho activo lo que ya se atendió para mantener el tablero despejado, conservándolo en un **Historial** consultable y recuperable cuando vuelva a hacer falta. |
| **6. Exportar** | Sacar el contenido o archivo fuera de Trafigator cuando se necesite usar en otro medio. |
| **7. Eliminar** | Borrar definitivamente lo efímero que ya cumplió su función y no necesita quedar en el historial (por ejemplo, *"Comprar café"*). |

---

## 4. Historias de Usuario Reales

### HU-01 · Retener un dato suelto y pasarlo en 1 clic
> *Colaborador:* "Director, no tengo el correo del impresor."
> *Director:* "Tengo que buscarlo y pasárselo; no se me puede olvidar."

1. El Director pone en el Corcho: `Correo Impresor — impresor@imprenta.com`.
2. Hace clic en **Compartir** → elige al Colaborador (por mensaje o correo) para dárselo a conocer.
3. **Fin.** Cuando ya no necesita tenerlo a la vista, lo **Archiva** para poder encontrarlo en el **Historial** meses después si alguien vuelve a pedirlo.

### HU-02 · Tener a la mano un insumo transversal a varias OTs
1. El usuario sube al Corcho un **Informe de entrevista** que aplica a varias OTs distintas, sin verse obligado a duplicarlo dentro de cada una.
2. Lo consulta y toma sus apuntes privados mientras recorre OT por OT.
3. Si un hallazgo puntual debe ejecutarse en una orden concreta, lo **mueve a esa OT o Tarea** o lo **comparte** con el responsable.

### HU-03 · Despejar la cabeza con cosas no operativas
1. El usuario anota en el Corcho un pendiente cotidiano del estudio (*"Comprar café"*).
2. Lo ve al entrar al Corcho sin contaminar el Tablero operativo ni las OTs.
3. Una vez resuelto, lo **Elimina** en 1 clic.

### HU-04 · Limpiar el Corcho sin perder la memoria
1. Al terminar la semana, el usuario **Archiva** las fichas que ya atendió para que el Corcho activo solo conserve lo vigente.
2. Semanas después, abre el **Historial**, recupera un dato archivado (como el contacto de un proveedor) y, si lo necesita de nuevo, lo devuelve al Corcho activo o lo comparte.

---

## 5. Criterios de Simplicidad (Reglas de Diseño de Producto)

1. **Un clic o menos:** poner, compartir, archivar o eliminar nunca debe requerir navegar por múltiples modales ni llenar metadatos obligatorios.
2. **Sin orden impuesto:** el Corcho no obliga a asignar prioridades, fechas límite ni responsables para poder guardar algo.
3. **Pantalla propia y aireada:** al vivir como pantalla independiente fuera del Tablero, el Corcho no sobrecarga el centro de control diario ni queda asfixiado en un cuadrante pequeño.
4. **Cero duplicidad de roles:** el Corcho retiene y agiliza lo suelto; cuando algo requiere control de entrega formal, pasa al flujo de **OT / Tarea** o a **Revisión Colaborativa**.