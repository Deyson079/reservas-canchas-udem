# UdeM Reservas · plataforma de reservas de canchas polideportivas

Aplicación web para reservar las canchas polideportivas de la Universidad de Medellín. Está lista para publicarse en GitHub Pages: no necesita instalar nada.

## Cómo funciona
- **Cuentas por dominio de correo.** Al crear la cuenta, la plataforma lee el correo:
  - `@udemedellin.edu.co` o `@soyudemedellin.edu.co` → **Comunidad UdeM**: sin pagos y con la reserva confirmada al instante.
  - Cualquier otro correo → **Usuario externo**: pide datos de facturación (tipo de persona, NIT o cédula, nombre o razón social, teléfono) y el RUT en PDF en la primera reserva.
- **Reservas.** Franjas de 1 hora durante los próximos 14 días, con estados libre / reservada / pendiente de pago / tu reserva / fuera de servicio. No se puede reservar una franja ocupada ni una hora que ya pasó. Si no hay cupo, la plataforma sugiere alternativas.
- **Externos.** Al confirmar se genera la factura automáticamente y el horario queda apartado 48 horas. Se paga en línea (pasarela **simulada**, no cobra nada) o subiendo el comprobante de una transferencia. **En ambos casos Tesorería valida el pago**; en cuanto lo aprueba, la reserva del externo pasa a *Confirmada* y le llega un aviso. Si se rechaza, el externo ve el motivo y tiene 24 horas para pagar de nuevo. Sin pago a tiempo, la reserva vence y libera el horario.
- **Mis reservas:** avisos (pago recibido, aprobado, rechazado, cancelación), detalle con seguimiento paso a paso, factura imprimible, cancelación y archivo `.ics` para el calendario.

### Tres perfiles independientes y conectados
Cada perfil tiene **su propia sesión**: en el mismo navegador puedes tener abiertos, en pestañas distintas, un usuario (comunidad o externo), Tesorería y Bienestar. Salir de uno no cierra los otros. Todos trabajan sobre los mismos datos, así que lo que hace uno lo ve el otro **al instante**, sin recargar.

| Perfil | Dónde entra | Qué hace |
|---|---|---|
| Usuario (comunidad o externo) | `ingresar.html` / `registro.html` | Reserva, paga (externos), recibe avisos |
| Tesorería | `personal.html` (tarjeta Tesorería) → `tesoreria.html` | Valida o rechaza pagos y registra pagos de caja |
| Bienestar | `personal.html` (tarjeta Bienestar) → `bienestar.html` | Indicadores, gráficas, lista y detalle de reservas, cancelaciones, asistencia, canchas |

En `personal.html` hay un ingreso para cada perfil, lado a lado. Puedes abrir las dos sesiones y usar **Abrir en otra pestaña** para tener Tesorería y Bienestar a la par. Mientras ambas estén abiertas, el menú de cada panel muestra el enlace al otro.

- Los correos del personal **no** pueden entrar por el ingreso de usuarios, y los usuarios **no** pueden entrar al acceso del personal.
- Tesorería no puede abrir el panel de Bienestar ni Bienestar el de Tesorería.

**Panel de Bienestar:**
- 6 indicadores: reservas, ocupación, ingresos validados, participantes, cancelaciones y asistencia;
- gráficas: reservas por día, demanda por hora, por cancha, por estado, por tipo de usuario y por actividad;
- filtros por periodo, cancha y tipo de usuario;
- lista con búsqueda y detalle de cada reserva;
- cancelar con motivo, registrar asistencia y poner canchas fuera de servicio;
- exportar a CSV y botón **Cargar datos de ejemplo**.

**Panel de Tesorería:**
- pagos por validar (validar, o rechazar con motivo) y pagos de caja;
- facturas sin pagar, validadas y todas;
- recaudo de 30 días con gráfica y pagos por medio;
- exportar facturas a CSV.

### Cuentas del personal (cámbialas en `assets/config.js`)
| Rol | Correo | Contraseña |
|---|---|---|
| Tesorería | tesoreria@udemedellin.edu.co | Tesoreria2026 |
| Bienestar | bienestar@udemedellin.edu.co | Bienestar2026 |

### Prueba rápida del flujo completo
1. **Pestaña 1:** crea una cuenta con un correo externo (ej. Gmail), reserva y paga en línea. Queda *Pago en validación*.
2. **Pestaña 2:** abre `personal.html` e ingresa en las dos tarjetas (Tesorería y Bienestar). Abre cada panel con **Abrir en otra pestaña**.
3. En la pestaña de **Tesorería** valida el pago: en la pestaña 1 la reserva pasa sola a *Confirmada* y aparece un aviso, y en **Bienestar** la reserva cambia de estado.
4. En **Bienestar** usa *Cargar datos de ejemplo* para llenar las gráficas.

## Configuración
Todo lo editable está en **`assets/config.js`**:
- dominios institucionales;
- tarifa por hora (hoy **$80.000 es un valor de ejemplo**);
- horario de las franjas;
- días de anticipación y horas para pagar;
- nombres de las canchas;
- ocupación de ejemplo;
- cuentas del personal;
- texto de contacto.

## Limitación importante
GitHub Pages solo publica archivos, así que **las cuentas y reservas se guardan en el navegador** (localStorage) de cada persona. Por eso:
- En otro computador o celular no aparecen tu cuenta ni tus reservas.
- Tesorería y Bienestar solo ven las reservas hechas **en el mismo navegador**. Para que vean las de todas las personas desde cualquier computador se necesita una base de datos en línea (por ejemplo Firebase).
- Las contraseñas se guardan cifradas con SHA-256 en el navegador, pero esto no reemplaza un servidor seguro.

Para usarlo de verdad con varios usuarios, se reemplaza `assets/db.js` por una conexión a una base de datos (por ejemplo Firebase o Supabase, o un servicio de la universidad) y la pasarela simulada por una real (Wompi, PayU, Mercado Pago). Las páginas no cambian, porque solo usan las funciones de `UdeM.*`.

## Publicar en GitHub Pages
1. Sube **todos los archivos** de esta carpeta a la raíz del repositorio: `index.html` debe verse en la página principal del repositorio, sin carpetas intermedias.
2. **Settings › Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.
3. En 1–2 minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Para probarlo sin publicar, abre `index.html` en el navegador.

## Archivos
| Archivo | Pantalla |
|---|---|
| `index.html` | Inicio |
| `registro.html` | Crear cuenta |
| `ingresar.html` | Ingresar |
| `recuperar.html` | Restablecer contraseña |
| `reservar.html` | Cancha, día y franja |
| `datos.html` | Datos de la reserva y RUT |
| `confirmar.html` | Confirmar reserva |
| `reserva.html` | Detalle, pago, comprobante, cancelación |
| `pago.html` | Pasarela simulada |
| `factura.html` | Factura (demostración) |
| `mis-reservas.html` | Mis reservas |
| `perfil.html` | Perfil, facturación y contraseña |
| `tesoreria.html` | Panel de Tesorería |
| `bienestar.html` | Panel de Bienestar |
| `personal.html` | Acceso del personal (Tesorería y Bienestar) |
| `panel.html` | Redirige al acceso del personal |
| `escenarios.html`, `ayuda.html`, `reglamento.html` | Información |
| `assets/config.js` | Configuración |
| `assets/db.js` | Lógica y datos |
| `assets/dc-runtime.js` | Motor de las pantallas |

## Filtros fijos
En **Reservar**, **Mis reservas**, **Escenarios** y en los paneles de **Bienestar** y **Tesorería**, la barra de filtros queda fija arriba al desplazarse. Siempre muestra qué se está viendo (*Viendo: …*) y, en Reservar, la franja elegida con el botón Continuar.
