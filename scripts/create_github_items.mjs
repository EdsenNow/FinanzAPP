/**
 * Script de Automatización para la creación de los 20 Requerimientos / Historias de Usuario
 * como Issues en GitHub con Criterios de Aceptación, Prioridades y Etiquetas.
 * 
 * Uso en PowerShell:
 *   $env:GITHUB_TOKEN="tu_personal_access_token"
 *   node scripts/create_github_items.mjs
 */

import https from 'https';

const OWNER = 'EdsenNow';
const REPO = 'FinanzAPP';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.log('⚠️ No se encontró GITHUB_TOKEN en las variables de entorno.');
  console.log('Puedes ejecutar este script pasando tu Token de GitHub de la siguiente forma:');
  console.log('  $env:GITHUB_TOKEN="tu_token_aqui"; node scripts/create_github_items.mjs');
  console.log('\nTodos los 20 requerimientos están documentados en documentacion/REQUERIMIENTOS_GITHUB_PROJECTS.md.');
  process.exit(0);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'NodeJS-Script',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) })
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(resBody ? JSON.parse(resBody) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${resBody}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const labelsToCreate = [
  { name: 'requerimiento', color: '0075ca', description: 'Requerimiento funcional del sistema' },
  { name: 'historia-usuario', color: '0e8a16', description: 'Historia de usuario estándar' },
  { name: 'bug', color: 'd73a4a', description: 'Error o fallo reportado' },
  { name: 'auth', color: 'a2eeef', description: 'Módulo de Autenticación' },
  { name: 'dashboard', color: '7f8c8d', description: 'Módulo de Panel Principal y Transacciones' },
  { name: 'presupuestos', color: 'fef2c0', description: 'Módulo de Control Presupuestario' },
  { name: 'estadisticas', color: 'd4c5f9', description: 'Módulo de Gráficos y Métricas' },
  { name: 'configuracion', color: 'bfd4f2', description: 'Módulo de Ajustes y PWA' },
  { name: 'backend', color: '1d76db', description: 'Servicios de Firebase y Firestore' }
];

const userStories = [
  {
    title: 'HU-01: Registro de nuevo usuario',
    body: `**Historia de Usuario:**
Como nuevo usuario, quiero registrarme con correo electrónico y contraseña, para tener una cuenta personal y segura donde guardar mis finanzas.

**Criterios de Aceptación:**
1. El formulario solicita correo válido y contraseña de al menos 6 caracteres.
2. Valida que el correo no esté registrado previamente en Firebase Auth.
3. Muestra mensaje de confirmación exitosa y redirige al Dashboard.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'auth']
  },
  {
    title: 'HU-02: Inicio de sesión (Login)',
    body: `**Historia de Usuario:**
Como usuario registrado, quiero iniciar sesión con mis credenciales, para acceder a mi información financiera guardada.

**Criterios de Aceptación:**
1. Permite ingresar correo y contraseña registrados.
2. Valida las credenciales mediante Firebase Authentication.
3. Si la autenticación es correcta, redirige al Dashboard principal.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'auth']
  },
  {
    title: 'HU-03: Autenticación con Google (OAuth)',
    body: `**Historia de Usuario:**
Como usuario, quiero iniciar sesión utilizando mi cuenta de Google, para ingresar rápidamente sin recordar una contraseña adicional.

**Criterios de Aceptación:**
1. Incluye un botón visible "Iniciar sesión con Google".
2. Despliega la ventana emergente oficial de Google OAuth.
3. Crea el perfil de usuario en la base de datos si es la primera vez que ingresa.

**Prioridad:** Media
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'auth']
  },
  {
    title: 'HU-04: Cierre de sesión (Logout)',
    body: `**Historia de Usuario:**
Como usuario autenticado, quiero cerrar mi sesión en la aplicación, para proteger mis datos personales cuando finalice de usar la plataforma.

**Criterios de Aceptación:**
1. Botón de cierre de sesión accesible en la barra superior o menú de configuración.
2. Limpia los tokens y la sesión activa del cliente.
3. Redirige inmediatamente a la pantalla de inicio de sesión.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'auth']
  },
  {
    title: 'HU-05: Registro de nuevo gasto',
    body: `**Historia de Usuario:**
Como usuario, quiero registrar un nuevo gasto especificando monto, categoría y fecha, para llevar el control de mis salidas de dinero.

**Criterios de Aceptación:**
1. Campos obligatorios: Monto (> 0), Categoría y Fecha.
2. Campo opcional: Descripción o nota adicional.
3. Actualiza el saldo total y la lista de movimientos inmediatamente tras guardar.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'dashboard']
  },
  {
    title: 'HU-06: Registro de nuevo ingreso',
    body: `**Historia de Usuario:**
Como usuario, quiero registrar un nuevo ingreso especificando origen y monto, para incrementar mi balance disponible en la aplicación.

**Criterios de Aceptación:**
1. Permite seleccionar tipo "Ingreso" en el formulario de registro.
2. Asigna categorías de ingreso (ej. Salario, Inversiones, Freelance).
3. Suma el monto registrado al saldo global del usuario.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'dashboard']
  },
  {
    title: 'HU-07: Listado e historial de transacciones',
    body: `**Historia de Usuario:**
Como usuario, quiero visualizar una lista con mi historial de transacciones recientes, para revisar los movimientos pasados de mi cuenta.

**Criterios de Aceptación:**
1. Muestra los movimientos ordenados por fecha descendente.
2. Diferencia visualmente gastos (rojo) e ingresos (verde).
3. Muestra ícono de categoría, fecha, monto y descripción.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'dashboard']
  },
  {
    title: 'HU-08: Edición de transacciones existentes',
    body: `**Historia de Usuario:**
Como usuario, quiero editar un registro de transacción previo, para corregir equivocaciones en el monto, fecha o categoría.

**Criterios de Aceptación:**
1. Opción "Editar" en cada ítem del historial.
2. Abre un formulario emergente prellenado con los datos actuales.
3. Al guardar los cambios, recalcula automáticamente el saldo global.

**Prioridad:** Media
**Estado sugerido:** En proceso`,
    labels: ['historia-usuario', 'requerimiento', 'dashboard']
  },
  {
    title: 'HU-09: Eliminación de transacciones',
    body: `**Historia de Usuario:**
Como usuario, quiero borrar un registro de gasto o ingreso, para eliminar movimientos duplicados o erróneos.

**Criterios de Aceptación:**
1. Botón "Eliminar" con modal de confirmación antes de procesar.
2. Remueve el registro de Firestore / Almacenamiento Local.
3. Actualiza en tiempo real los totales sin requerir recargar la página.

**Prioridad:** Media
**Estado sugerido:** En proceso`,
    labels: ['historia-usuario', 'requerimiento', 'dashboard']
  },
  {
    title: 'HU-10: Creación de presupuestos por categoría',
    body: `**Historia de Usuario:**
Como usuario, quiero definir un tope de gasto mensual para una categoría, para no excederme de mi presupuesto planificado.

**Criterios de Aceptación:**
1. Permite seleccionar una categoría y asignar un monto máximo límite.
2. Muestra una barra de progreso que indica el porcentaje gastado actual.
3. No permite duplicar presupuestos para la misma categoría en el mismo periodo.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'presupuestos']
  },
  {
    title: 'HU-11: Alertas visuales de presupuesto excedido',
    body: `**Historia de Usuario:**
Como usuario, quiero recibir avisos visuales cuando mis gastos alcancen el límite presupuestado, para tomar decisiones de consumo oportunas.

**Criterios de Aceptación:**
1. Cambia el color de la barra de presupuesto a amarillo al alcanzar el 80%.
2. Cambia a rojo brillante y muestra aviso de "Límite Excedido" al llegar o pasar el 100%.

**Prioridad:** Media
**Estado sugerido:** En revisión`,
    labels: ['historia-usuario', 'requerimiento', 'presupuestos']
  },
  {
    title: 'HU-12: Gestión de categorías personalizadas',
    body: `**Historia de Usuario:**
Como usuario, quiero crear y personalizar mis propias categorías con nombres y colores distintivos, para adaptar la app a mis necesidades.

**Criterios de Aceptación:**
1. Formulario para añadir nueva categoría especificando Nombre, Icono y Color.
2. Valida que el nombre de la categoría sea único por usuario.

**Prioridad:** Baja
**Estado sugerido:** Pendiente`,
    labels: ['historia-usuario', 'requerimiento', 'presupuestos']
  },
  {
    title: 'HU-13: Gráfico de distribución de gastos (Categorías)',
    body: `**Historia de Usuario:**
Como usuario, quiero ver un gráfico circular de la distribución de mis gastos, para comprender visualmente en qué rubros gasto más dinero.

**Criterios de Aceptación:**
1. Renderiza un gráfico tipo dona/pastel con desglose por porcentajes.
2. Permite interactuar pasando el cursor para ver montos exactos por categoría.
3. Se actualiza automáticamente al cambiar el mes seleccionado.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'estadisticas']
  },
  {
    title: 'HU-14: Gráfico de tendencia (Ingresos vs. Gastos)',
    body: `**Historia de Usuario:**
Como usuario, quiero comparar mis ingresos totales frente a mis gastos mediante un gráfico de barras, para analizar mi capacidad de ahorro.

**Criterios de Aceptación:**
1. Presenta barras comparativas mensuales (Ingresos vs Gastos).
2. Calcula y muestra el saldo o ahorro neto del periodo seleccionado.

**Prioridad:** Media
**Estado sugerido:** En revisión`,
    labels: ['historia-usuario', 'requerimiento', 'estadisticas']
  },
  {
    title: 'HU-15: Filtros de fecha en reportes estadísticos',
    body: `**Historia de Usuario:**
Como usuario, quiero filtrar las estadísticas por un rango de fechas personalizado, para evaluar periodos específicos (ej. quincenas o vacaciones).

**Criterios de Aceptación:**
1. Selector de fecha inicial y fecha final.
2. Filtra y recalcula al instante todos los gráficos y resúmenes estadísticos.

**Prioridad:** Media
**Estado sugerido:** Pendiente`,
    labels: ['historia-usuario', 'requerimiento', 'estadisticas']
  },
  {
    title: 'HU-16: Alternancia de tema Claro / Oscuro (Dark Mode)',
    body: `**Historia de Usuario:**
Como usuario, quiero cambiar entre el tema claro y tema oscuro, para mejorar la comodidad visual según el entorno de iluminación.

**Criterios de Aceptación:**
1. Interruptor (toggle) en la vista de configuración.
2. Almacena la preferencia en localStorage para recordar la selección.
3. Aplica estilos CSS oscuros/claros de forma fluida sin parpadear.

**Prioridad:** Baja
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'configuracion']
  },
  {
    title: 'HU-17: Exportación de datos a CSV',
    body: `**Historia de Usuario:**
Como usuario, quiero descargar mi historial de transacciones en archivo CSV, para guardar un respaldo o realizar análisis externos en Excel.

**Criterios de Aceptación:**
1. Botón "Exportar a CSV" en la vista de configuración o estadísticas.
2. Genera y descarga un archivo .csv con columnas: Fecha, Tipo, Categoría, Monto, Descripción.

**Prioridad:** Baja
**Estado sugerido:** Pendiente`,
    labels: ['historia-usuario', 'requerimiento', 'configuracion']
  },
  {
    title: 'HU-18: Soporte Offline y PWA (Service Worker)',
    body: `**Historia de Usuario:**
Como usuario, quiero poder abrir y utilizar la aplicación sin conexión a internet, para consultar mis registros locales en cualquier lugar.

**Criterios de Aceptación:**
1. Registra un Service Worker que almacena en caché los assets (HTML, CSS, JS).
2. Permite abrir la app en modo offline sin mostrar pantallas de error de red.

**Prioridad:** Media
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'configuracion']
  },
  {
    title: 'HU-19: Sincronización en la Nube con Firestore',
    body: `**Historia de Usuario:**
Como usuario, quiero que mis movimientos financieros se sincronicen en FirestoreDB, para no perder mi información y acceder desde múltiples dispositivos.

**Criterios de Aceptación:**
1. Guarda todas las transacciones vinculadas al uid del usuario autenticado.
2. Recupera los datos de Firestore automáticamente al iniciar sesión en un dispositivo nuevo.

**Prioridad:** Alta
**Estado sugerido:** Completado`,
    labels: ['historia-usuario', 'requerimiento', 'backend']
  },
  {
    title: 'BUG-20: Corrección de actualización dinámica de saldos',
    body: `**Historia de Usuario / Bug:**
Como usuario, al eliminar un gasto, quiero que el balance general se recalcule al instante, para evitar discrepancias en la pantalla sin recargar.

**Criterios de Aceptación:**
1. Tras confirmar la eliminación, remueve la transacción del estado global.
2. Actualiza la tarjeta de balance del Dashboard de inmediato sin producir valores NaN.

**Prioridad:** Alta
**Estado sugerido:** En proceso`,
    labels: ['bug', 'requerimiento', 'dashboard']
  }
];

async function main() {
  console.log(`🏷️ Creando Etiquetas (Labels) en ${OWNER}/${REPO}...`);
  for (const label of labelsToCreate) {
    try {
      await request('POST', `/repos/${OWNER}/${REPO}/labels`, label);
      console.log(`  └─ Label creada: ${label.name}`);
    } catch (e) {
      console.log(`  └─ Label ya existente o notificada: ${label.name}`);
    }
  }

  console.log(`\n🚀 Creando los 20 Issues en ${OWNER}/${REPO}...`);
  for (const item of userStories) {
    try {
      const created = await request('POST', `/repos/${OWNER}/${REPO}/issues`, {
        title: item.title,
        body: item.body,
        labels: item.labels,
        assignees: [OWNER]
      });
      console.log(`✅ Issue #${created.number} creado: ${created.title}`);
    } catch (err) {
      console.error(`❌ Error en "${item.title}":`, err.message);
    }
  }
  console.log('\n🎉 ¡Los 20 requerimientos e historias de usuario se procesaron correctamente!');
}

main();
