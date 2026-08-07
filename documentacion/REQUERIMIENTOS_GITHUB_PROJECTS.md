# Documentación de Requerimientos e Historias de Usuario - FinanzApp

> **Proyecto:** Sistema de Gestión de Finanzas Personales (FinanzApp)  
> **Materia / Contexto:** Proyecto Escolar  
> **Objetivo:** Registro de 20 Requerimientos / Historias de Usuario, Clasificación por Labels y Organización en Tablero de GitHub Projects.

---

## 🔒 Nota de Seguridad y Privacidad (APIs y Keys)
* **Protección de Credenciales:** Archivos sensibles como `.env`, credenciales de Firebase, llaves de cuenta de servicio (`*-service-account*.json`) y carpetas `.firebase/` están excluidos mediante el archivo `.gitignore`.
* **Subida Segura:** Al subir tu repositorio a GitHub, solo se subirán el código fuente (`src/`, `public/`, `package.json`, etc.) y las plantillas de configuración pública (`.env.example`), garantizando que ninguna API Key o clave privada quede expuesta en internet.

---

## 📋 Lista de 20 Historias de Usuario y Requerimientos Funcionales

---

### Módulo 1: Autenticación y Gestión de Usuarios

#### HU-01: Registro de nuevo usuario
* **Historia de Usuario:** Como nuevo usuario, quiero registrarme con correo electrónico y contraseña, para tener una cuenta personal y segura donde guardar mis finanzas.
* **Criterios de Aceptación:**
  1. El formulario solicita correo válido y contraseña de al menos 6 caracteres.
  2. Valida que el correo no esté registrado previamente en Firebase Auth.
  3. Muestra mensaje de confirmación exitosa y redirige al Dashboard.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `auth`
* **Estado en Tablero:** `Completado`

#### HU-02: Inicio de sesión (Login)
* **Historia de Usuario:** Como usuario registrado, quiero iniciar sesión con mis credenciales, para acceder a mi información financiera guardada.
* **Criterios de Aceptación:**
  1. Permite ingresar correo y contraseña registrados.
  2. Valida las credenciales mediante Firebase Authentication.
  3. Si la autenticación es correcta, redirige al Dashboard principal.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `auth`
* **Estado en Tablero:** `Completado`

#### HU-03: Autenticación con Google (OAuth)
* **Historia de Usuario:** Como usuario, quiero iniciar sesión utilizando mi cuenta de Google, para ingresar rápidamente sin recordar una contraseña adicional.
* **Criterios de Aceptación:**
  1. Incluye un botón visible "Iniciar sesión con Google".
  2. Despliega la ventana emergente oficial de Google OAuth.
  3. Crea el perfil de usuario en la base de datos si es la primera vez que ingresa.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `auth`
* **Estado en Tablero:** `Completado`

#### HU-04: Cierre de sesión (Logout)
* **Historia de Usuario:** Como usuario autenticado, quiero cerrar mi sesión en la aplicación, para proteger mis datos personales cuando finalice de usar la plataforma.
* **Criterios de Aceptación:**
  1. Botón de cierre de sesión accesible en la barra superior o menú de configuración.
  2. Limpia los tokens y la sesión activa del cliente.
  3. Redirige inmediatamente a la pantalla de inicio de sesión.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `auth`
* **Estado en Tablero:** `Completado`

---

### Módulo 2: Gestor de Transacciones (Ingresos y Gastos)

#### HU-05: Registro de nuevo gasto
* **Historia de Usuario:** Como usuario, quiero registrar un nuevo gasto especificando monto, categoría y fecha, para llevar el control de mis salidas de dinero.
* **Criterios de Aceptación:**
  1. Campos obligatorios: Monto (> 0), Categoría y Fecha.
  2. Campo opcional: Descripción o nota adicional.
  3. Actualiza el saldo total y la lista de movimientos inmediatamente tras guardar.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `Completado`

#### HU-06: Registro de nuevo ingreso
* **Historia de Usuario:** Como usuario, quiero registrar un nuevo ingreso especificando origen y monto, para incrementar mi balance disponible en la aplicación.
* **Criterios de Aceptación:**
  1. Permite seleccionar tipo "Ingreso" en el formulario de registro.
  2. Asigna categorías de ingreso (ej. Salario, Inversiones, Freelance).
  3. Suma el monto registrado al saldo global del usuario.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `Completado`

#### HU-07: Listado e historial de transacciones
* **Historia de Usuario:** Como usuario, quiero visualizar una lista con mi historial de transacciones recientes, para revisar los movimientos pasados de mi cuenta.
* **Criterios de Aceptación:**
  1. Muestra los movimientos ordenados por fecha descendente (más recientes primero).
  2. Diferencia visualmente gastos (color rojo/signo negativo) e ingresos (color verde/signo positivo).
  3. Muestra ícono de categoría, fecha, monto y descripción.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `Completado`

#### HU-08: Edición de transacciones existentes
* **Historia de Usuario:** Como usuario, quiero editar un registro de transacción previo, para corregir equivocaciones en el monto, fecha o categoría.
* **Criterios de Aceptación:**
  1. Opción "Editar" en cada ítem del historial.
  2. Abre un formulario emergente prellenado con los datos actuales.
  3. Al guardar los cambios, recalcula automáticamente el saldo global.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `En proceso`

#### HU-09: Eliminación de transacciones
* **Historia de Usuario:** Como usuario, quiero borrar un registro de gasto o ingreso, para eliminar movimientos duplicados o erróneos.
* **Criterios de Aceptación:**
  1. Botón "Eliminar" con modal de confirmación antes de procesar.
  2. Remueve el registro de Firestore / Almacenamiento Local.
  3. Actualiza en tiempo real los totales sin requerir recargar la página.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `En proceso`

---

### Módulo 3: Presupuestos y Control Financiero

#### HU-10: Creación de presupuestos por categoría
* **Historia de Usuario:** Como usuario, quiero definir un tope de gasto mensual para una categoría, para no excederme de mi presupuesto planificado.
* **Criterios de Aceptación:**
  1. Permite seleccionar una categoría y asignar un monto máximo límite.
  2. Muestra una barra de progreso que indica el porcentaje gastado actual.
  3. No permite duplicar presupuestos para la misma categoría en el mismo periodo.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `presupuestos`
* **Estado en Tablero:** `Completado`

#### HU-11: Alertas visuales de presupuesto excedido
* **Historia de Usuario:** Como usuario, quiero recibir avisos visuales cuando mis gastos alcancen el límite presupuestado, para tomar decisiones de consumo oportunas.
* **Criterios de Aceptación:**
  1. Cambia el color de la barra de presupuesto a amarillo al alcanzar el 80%.
  2. Cambia a rojo brillante y muestra aviso de "Límite Excedido" al llegar o pasar el 100%.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `presupuestos`
* **Estado en Tablero:** `En revisión`

#### HU-12: Gestión de categorías personalizadas
* **Historia de Usuario:** Como usuario, quiero crear y personalizar mis propias categorías con nombres y colores distintivos, para adaptar la app a mis necesidades.
* **Criterios de Aceptación:**
  1. Formulario para añadir nueva categoría especificando Nombre, Icono y Color.
  2. Valida que el nombre de la categoría sea único por usuario.
* **Prioridad:** Baja
* **Labels:** `historia-usuario`, `requerimiento`, `presupuestos`
* **Estado en Tablero:** `Pendiente`

---

### Módulo 4: Estadísticas, Gráficos y Reportes

#### HU-13: Gráfico de distribución de gastos (Categorías)
* **Historia de Usuario:** Como usuario, quiero ver un gráfico circular de la distribución de mis gastos, para comprender visualmente en qué rubros gasto más dinero.
* **Criterios de Aceptación:**
  1. Renderiza un gráfico tipo dona/pastel con desglose por porcentajes.
  2. Permite interactuar pasando el cursor para ver montos exactos por categoría.
  3. Se actualiza automáticamente al cambiar el mes seleccionado.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `estadisticas`
* **Estado en Tablero:** `Completado`

#### HU-14: Gráfico de tendencia (Ingresos vs. Gastos)
* **Historia de Usuario:** Como usuario, quiero comparar mis ingresos totales frente a mis gastos mediante un gráfico de barras, para analizar mi capacidad de ahorro.
* **Criterios de Aceptación:**
  1. Presenta barras comparativas mensuales (Ingresos vs Gastos).
  2. Calcula y muestra el saldo o ahorro neto del periodo seleccionado.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `estadisticas`
* **Estado en Tablero:** `En revisión`

#### HU-15: Filtros de fecha en reportes estadísticos
* **Historia de Usuario:** Como usuario, quiero filtrar las estadísticas por un rango de fechas personalizado, para evaluar periodos específicos (ej. quincenas o vacaciones).
* **Criterios de Aceptación:**
  1. Selector de fecha inicial y fecha final.
  2. Filtra y recalcula al instante todos los gráficos y resúmenes estadísticos.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `estadisticas`
* **Estado en Tablero:** `Pendiente`

---

### Módulo 5: Configuración, Almacenamiento, Offline y Calidad

#### HU-16: Alternancia de tema Claro / Oscuro (Dark Mode)
* **Historia de Usuario:** Como usuario, quiero cambiar entre el tema claro y tema oscuro, para mejorar la comodidad visual según el entorno de iluminación.
* **Criterios de Aceptación:**
  1. Interruptor (toggle) en la vista de configuración.
  2. Almacena la preferencia en `localStorage` para recordar la selección.
  3. Aplica estilos CSS oscuros/claros de forma fluida sin parpadear.
* **Prioridad:** Baja
* **Labels:** `historia-usuario`, `requerimiento`, `configuracion`
* **Estado en Tablero:** `Completado`

#### HU-17: Exportación de datos a CSV
* **Historia de Usuario:** Como usuario, quiero descargar mi historial de transacciones en archivo CSV, para guardar un respaldo o realizar análisis externos en Excel.
* **Criterios de Aceptación:**
  1. Botón "Exportar a CSV" en la vista de configuración o estadísticas.
  2. Genera y descarga un archivo `.csv` con columnas: Fecha, Tipo, Categoría, Monto, Descripción.
* **Prioridad:** Baja
* **Labels:** `historia-usuario`, `requerimiento`, `configuracion`
* **Estado en Tablero:** `Pendiente`

#### HU-18: Soporte Offline y PWA (Service Worker)
* **Historia de Usuario:** Como usuario, quiero poder abrir y utilizar la aplicación sin conexión a internet, para consultar mis registros locales en cualquier lugar.
* **Criterios de Aceptación:**
  1. Registra un Service Worker que almacena en caché los assets (HTML, CSS, JS).
  2. Permite abrir la app en modo offline sin mostrar pantallas de error de red.
* **Prioridad:** Media
* **Labels:** `historia-usuario`, `requerimiento`, `configuracion`
* **Estado en Tablero:** `Completado`

#### HU-19: Sincronización en la Nube con Firestore
* **Historia de Usuario:** Como usuario, quiero que mis movimientos financieros se sincronicen en FirestoreDB, para no perder mi información y acceder desde múltiples dispositivos.
* **Criterios de Aceptación:**
  1. Guarda todas las transacciones vinculadas al `uid` del usuario autenticado.
  2. Recupera los datos de Firestore automáticamente al iniciar sesión en un dispositivo nuevo.
* **Prioridad:** Alta
* **Labels:** `historia-usuario`, `requerimiento`, `backend`
* **Estado en Tablero:** `Completado`

#### BUG-20: Corrección de actualización dinámica de saldos al eliminar transacciones
* **Historia de Usuario / Bug:** Como usuario, al eliminar un gasto, quiero que el balance general se recalcule al instante, para evitar discrepancias en la pantalla sin recargar.
* **Criterios de Aceptación:**
  1. Tras confirmar la eliminación, remueve la transacción del estado global.
  2. Actualiza la tarjeta de balance del Dashboard de inmediato sin producir valores `NaN`.
* **Prioridad:** Alta
* **Labels:** `bug`, `requerimiento`, `dashboard`
* **Estado en Tablero:** `En proceso`

---

## 🛠️ Guía Paso a Paso para GitHub (Creación de Issues, Labels y Tablero)

### Paso 1: Subir tus cambios a GitHub de forma segura
Asegúrate de no incluir tus llaves privadas ejecutando en tu terminal:
```bash
git add .
git commit -m "docs: agregar 20 requerimientos e historias de usuario para entrega escolar"
git push origin main
```

---

### Paso 2: Crear las Labels (Etiquetas) en GitHub
1. En tu navegador, ve a tu repositorio de GitHub: `https://github.com/TU_USUARIO/TU_REPOSITTORIO`.
2. Haz clic en la pestaña **Issues**.
3. Haz clic en el botón **Labels** (a la derecha de la barra de búsqueda).
4. Crea las siguientes etiquetas dando clic en **New label**:
   * `requerimiento` (Color sugerido: Azul `#0075ca`)
   * `historia-usuario` (Color sugerido: Verde `#0e8a16`)
   * `bug` (Color sugerido: Rojo `#d73a4a`)
   * *(Opcionales)*: `auth`, `dashboard`, `presupuestos`, `estadisticas`, `configuracion`.

---

### Paso 3: Registrar los 20 Issues
1. En la pestaña **Issues**, haz clic en **New issue**.
2. **Título:** Copia el título (ejemplo: `HU-01: Registro de nuevo usuario`).
3. **Descripción:** Copia el texto completo de la Historia de Usuario y sus Criterios de Aceptación.
4. **Labels (menú lateral derecho):** Asigna las etiquetas correspondientes (ej. `historia-usuario`, `requerimiento`, `auth`).
5. Haz clic en **Submit new issue**.
6. Repite el proceso para los 20 requerimientos redactados arriba.

> 💡 **Tip Pro (Creación Automática con GitHub CLI `gh`):**
> Si tienes instalado GitHub CLI (`gh`), puedes ejecutar en PowerShell este comando para crear un issue en segundos:
> ```powershell
> gh issue create --title "HU-01: Registro de nuevo usuario" --body "Como nuevo usuario, quiero registrarme con correo y contraseña, para tener una cuenta personal y segura.`n`nCriterios de Aceptación:`n1. Solicita correo válido y contraseña de 6+ caracteres.`n2. Valida que el correo no exista.`n3. Muestra mensaje de confirmación." --label "historia-usuario,requerimiento"
> ```

---

### Paso 4: Crear y Organizar el Tablero en GitHub Projects
1. En la parte superior de tu repositorio en GitHub, haz clic en la pestaña **Projects**.
2. Haz clic en **New project** -> Elige la vista **Board** (Tablero Kanban).
3. Nombra tu proyecto, por ejemplo: **"Tablero de Requerimientos - FinanzApp"**.
4. Define las **4 columnas requeridas**:
   - 📌 **Pendiente** (To Do)
   - 🔄 **En proceso** (In Progress)
   - 🔍 **En revisión** (In Review)
   - ✅ **Completado** (Done)
5. Haz clic en **+ Add item** en la columna correspondiente o arrastra los issues creados desde la lista de GitHub para distribuirlos según el estado sugerido en el documento:
   * **Completado:** HU-01, HU-02, HU-03, HU-04, HU-05, HU-06, HU-07, HU-10, HU-13, HU-16, HU-18, HU-19.
   * **En proceso:** HU-08, HU-09, BUG-20.
   * **En revisión:** HU-11, HU-14.
   * **Pendiente:** HU-12, HU-15, HU-17.

---

### Paso 5: Armar el Documento de Entrega en PDF

Toma las **capturas de pantalla necesarias** solicitadas en las instrucciones:
1. 📸 **Repositorio actualizado:** Captura de la página principal del repositorio en GitHub con los archivos actualizados y commits recientes.
2. 📸 **Requerimientos redactados:** Captura de este documento o del código/markdown.
3. 📸 **Issues de requerimientos creados:** Captura de la pestaña *Issues* mostrando el listado de los 20 issues creados con sus números (#1, #2, etc.).
4. 📸 **Labels utilizados:** Captura de la sección *Labels* mostrando `requerimiento`, `historia-usuario`, `bug`, etc.
5. 📸 **Tablero de GitHub Projects:** Captura completa del tablero Kanban con los 20 issues organizados en las columnas (*Pendiente*, *En proceso*, *En revisión*, *Completado*).

Pega todas las capturas junto con la liga de tu repositorio en Word/Google Docs y exporta el archivo como **PDF**. ¡Listo para entregar! 🚀
