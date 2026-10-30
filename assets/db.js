// =====================================================================
//  Lógica de la plataforma: cuentas, disponibilidad, reservas, pagos.
//  Guarda todo en el navegador (localStorage). Sin servidor.
// =====================================================================
(function () {
  var CFG = window.UDEM_CONFIG;
  // Cada repositorio de GitHub Pages comparte el dominio (usuario.github.io), así que los datos
  // se guardan con el nombre del repositorio para no mezclarse con otras versiones publicadas.
  var NS = (location.protocol === 'file:' ? 'local' : (location.pathname.split('/')[1] || 'raiz')).replace(/[^a-z0-9_-]/gi, '');
  var KEY = 'udem_' + NS + '_db_v2';
  // Una sesión independiente por perfil: usuario (comunidad/externo), Tesorería y Bienestar.
  // Comparten la misma base de datos, así que lo que hace uno lo ve el otro al instante.
  var SK = { usuario: 'udem_' + NS + '_sesion_usuario', tesoreria: 'udem_' + NS + '_sesion_tesoreria', bienestar: 'udem_' + NS + '_sesion_bienestar' };
  function portal() {
    var v = new URLSearchParams(location.search).get('vista');
    if (v === 'tesoreria' || v === 'bienestar') return v;
    return window.UDEM_PORTAL || 'usuario';
  }

  // ---------- SHA-256 (para no guardar contraseñas en texto plano) ----------
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, mw = mp(2, 32), result = '', words = [], bl = ascii.length * 8, hash = [], k = [], pc = 0, ic = {};
    for (var c = 2; pc < 64; c++) { if (!ic[c]) { for (var i = 0; i < 313; i += c) ic[i] = c; hash[pc] = (mp(c, .5) * mw) | 0; k[pc++] = (mp(c, 1 / 3) * mw) | 0; } }
    ascii = unescape(encodeURIComponent(ascii)); bl = ascii.length * 8; ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { var j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bl / mw) | 0); words[words.length] = (bl);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oh = hash; hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oh[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  function hashPass(email, pass) { return sha256('udem|' + email.toLowerCase() + '|' + pass); }

  // ---------- almacenamiento ----------
  var mem = null;
  function blank() { return { version: 1, users: [], reservas: [], notificaciones: [], seq: { res: 0, fac: 0 }, canchasFuera: { C: 'Mantenimiento programado (ejemplo)' } }; }
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { mem = blank(); }
    if (!mem.canchasFuera) mem.canchasFuera = {};
    if (!mem.notificaciones) mem.notificaciones = [];
    var staffEmails = CFG.personal.map(function (p) { return p.email.toLowerCase(); });
    mem.users = mem.users.filter(function (u) { return u.rol === 'usuario' || staffEmails.indexOf(u.email) !== -1; });
    CFG.personal.forEach(function (p) {
      var email = p.email.toLowerCase(), u = mem.users.filter(function (x) { return x.email === email; })[0];
      if (!u) { u = { id: 'staff-' + p.rol, creado: new Date().toISOString() }; mem.users.push(u); }
      u.email = email; u.rol = p.rol; u.tipo = 'interno'; u.nombre = p.nombre; u.hash = hashPass(email, p.clave); delete u.facturacion;
    });
    expirar(mem);
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); return true; } catch (e) { alert('No se pudo guardar: el almacenamiento del navegador está lleno. Usa archivos de comprobante más pequeños.'); return false; } }

  // ---------- utilidades ----------
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function dominio(email) { return (email.split('@')[1] || '').toLowerCase(); }
  function esInstitucional(email) { return CFG.dominiosInstitucionales.indexOf(dominio(email)) !== -1; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoyIso() { return isoDe(new Date()); }
  function fecha(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var DOWL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function diaCorto(iso) { var d = fecha(iso); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MES[d.getMonth()]; }
  function diaLargo(iso) { var d = fecha(iso); return DOWL[d.getDay()] + ' ' + d.getDate() + ' de ' + MESL[d.getMonth()] + ' de ' + d.getFullYear(); }
  function hora(h) { var p = h >= 12 ? 'p. m.' : 'a. m.'; var x = h > 12 ? h - 12 : h; return x + ':00 ' + p; }
  function franja(h) { return hora(h) + ' – ' + hora(h + 1); }
  function dinero(v) { return '$' + Math.round(v).toLocaleString('es-CO') + ' COP'; }
  function dineroCorto(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace('.', ',') + ' M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + ' mil' : '$' + v; }
  function horas() { var a = []; for (var h = CFG.horaInicio; h <= CFG.horaFin; h++) a.push(h); return a; }
  function dias() {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = 0; i < CFG.diasAnticipacion; i++) { var x = new Date(d); x.setDate(d.getDate() + i); var iso = isoDe(x); out.push({ iso: iso, dow: DOW[x.getDay()], num: x.getDate(), mes: MES[x.getMonth()], hoy: i === 0, corto: diaCorto(iso), largo: diaLargo(iso) }); }
    return out;
  }
  function cancha(id) { return CFG.canchas.filter(function (c) { return c.id === id; })[0] || CFG.canchas[0]; }
  function fueraDeServicio(id) { return load().canchasFuera[id] || null; }
  function hashNum(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // ---------- sesión ----------
  function usuarioActual() {
    var p = portal(); if (!SK[p]) return null;
    var id = null; try { id = localStorage.getItem(SK[p]); } catch (e) {}
    var u = id ? load().users.filter(function (x) { return x.id === id; })[0] || null : null;
    if (u && (p === 'usuario' ? u.rol !== 'usuario' : u.rol !== p)) return null;
    return u;
  }
  function iniciarSesion(u) { try { localStorage.setItem(SK[u.rol === 'usuario' ? 'usuario' : u.rol], u.id); } catch (e) {} }
  function cerrarSesion() { var p = portal(); try { if (SK[p]) localStorage.removeItem(SK[p]); } catch (e) {} }

  function registrar(f) {
    var db = load(), email = (f.email || '').trim().toLowerCase(), err = {};
    if (!EMAIL_RE.test(email)) err.email = 'Escribe un correo válido.';
    else if (CFG.personal.some(function (p) { return p.email.toLowerCase() === email; })) err.email = 'Este correo pertenece al personal (Tesorería o Bienestar): ingresa por «Acceso del personal».';
    else if (db.users.some(function (u) { return u.email === email; })) err.email = 'Ya existe una cuenta con este correo. Ingresa o recupera tu contraseña.';
    if (!f.nombre || !f.nombre.trim()) err.nombre = 'Escribe tu nombre.';
    if (!f.clave || f.clave.length < 8) err.clave = 'Usa al menos 8 caracteres.';
    else if (f.clave !== f.clave2) err.clave2 = 'Las contraseñas no coinciden.';
    var inst = EMAIL_RE.test(email) && esInstitucional(email);
    if (!inst) {
      if (!f.documento || !f.documento.trim()) err.documento = 'Necesario para la factura.';
      if (!f.razon || !f.razon.trim()) err.razon = 'Necesario para la factura.';
      if (!f.telefono || !/^[0-9 +()-]{7,}$/.test(f.telefono)) err.telefono = 'Escribe un teléfono válido.';
    }
    if (!f.acepta) err.acepta = 'Debes autorizar el tratamiento de datos.';
    if (Object.keys(err).length) return { ok: false, err: err };
    var u = {
      id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), email: email, hash: hashPass(email, f.clave),
      nombre: f.nombre.trim(), tipo: inst ? 'interno' : 'externo', rol: 'usuario', creado: new Date().toISOString()
    };
    if (!inst) u.facturacion = { tipoPersona: f.tipoPersona || 'Persona natural', documento: f.documento.trim(), razon: f.razon.trim(), correo: (f.correoFactura || email).trim(), telefono: f.telefono.trim(), rut: null };
    db.users.push(u); save(); iniciarSesion(u);
    return { ok: true, user: u };
  }
  function ingresar(email, clave, modo) {
    email = (email || '').trim().toLowerCase(); modo = modo || 'usuario';
    if (!EMAIL_RE.test(email)) return { ok: false, err: { email: 'Escribe un correo válido.' } };
    if (!clave) return { ok: false, err: { clave: 'Escribe tu contraseña.' } };
    var u = load().users.filter(function (x) { return x.email === email; })[0];
    if (!u) return { ok: false, err: { email: 'No hay una cuenta con este correo.' }, noAccount: true };
    if (modo === 'usuario' && u.rol !== 'usuario') return { ok: false, err: { email: 'Este correo es del personal. Ingresa por «Acceso del personal».' }, esPersonal: true };
    if (modo === 'personal' && u.rol === 'usuario') return { ok: false, err: { email: 'Este acceso es solo para los correos de Tesorería y Bienestar.' } };
    if (u.hash !== hashPass(email, clave)) return { ok: false, err: { clave: 'La contraseña no es correcta.' } };
    iniciarSesion(u); return { ok: true, user: u };
  }
  function restablecer(email, clave) {
    email = (email || '').trim().toLowerCase();
    var u = load().users.filter(function (x) { return x.email === email; })[0];
    if (!u) return { ok: false, err: { email: 'No hay una cuenta con este correo.' } };
    if (u.rol !== 'usuario') return { ok: false, err: { email: 'Las cuentas del personal se restablecen en assets/config.js.' } };
    if (!clave || clave.length < 8) return { ok: false, err: { clave: 'Usa al menos 8 caracteres.' } };
    u.hash = hashPass(email, clave); save(); return { ok: true };
  }
  function actualizarUsuario(cambios) { var u = usuarioActual(); if (!u) return; Object.keys(cambios).forEach(function (k) { u[k] = cambios[k]; }); save(); return u; }
  function cambiarClave(actual, nueva) {
    var u = usuarioActual();
    if (u.hash !== hashPass(u.email, actual)) return { ok: false, err: { actual: 'La contraseña actual no es correcta.' } };
    if (!nueva || nueva.length < 8) return { ok: false, err: { nueva: 'Usa al menos 8 caracteres.' } };
    u.hash = hashPass(u.email, nueva); save(); return { ok: true };
  }

  // ---------- reservas y disponibilidad ----------
  var ACTIVAS = ['confirmada', 'pendiente_pago', 'en_verificacion'];
  function activa(r) { return ACTIVAS.indexOf(r.estado) !== -1; }
  function expirar(db) {
    var now = Date.now(), cambio = false;
    db.reservas.forEach(function (r) {
      if (r.estado === 'pendiente_pago' && r.limitePago && now > new Date(r.limitePago).getTime()) { r.estado = 'vencida'; log(r, 'Se liberó el horario: no se registró el pago a tiempo.'); notif(db, r, 'Tu reserva ' + r.code + ' venció porque no se registró el pago a tiempo.', 'err'); cambio = true; }
    });
    if (cambio) { mem = db; save(); }
  }
  function log(r, msg, por) { (r.historial = r.historial || []).push({ t: new Date().toISOString(), msg: msg, por: por || '' }); }
  function notif(db, r, msg, tipo) { db.notificaciones.unshift({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: r.userId, code: r.code, msg: msg, tipo: tipo || 'info', t: new Date().toISOString(), leida: false }); }
  function staffNombre() { var u = usuarioActual(); return u ? (u.rol === 'tesoreria' ? 'Tesorería' : u.rol === 'bienestar' ? 'Bienestar' : u.nombre) + (u.rol !== 'usuario' ? ' (' + u.email + ')' : '') : ''; }
  function pasada(iso, h) { var d = fecha(iso); d.setHours(h, 0, 0, 0); return d.getTime() <= Date.now(); }
  function estadoFranja(id, iso, h, userId) {
    if (fueraDeServicio(id)) return 'fuera';
    if (pasada(iso, h)) return 'pasada';
    var r = load().reservas.filter(function (x) { return x.cancha === id && x.fecha === iso && x.hora === h && activa(x); })[0];
    if (r) return r.userId === userId ? 'mia' : (r.estado === 'confirmada' ? 'reservada' : 'pendiente');
    if (CFG.ocupacionDeEjemplo) { var v = hashNum(id + iso + h) % 10; if (v < 3) return 'reservada'; if (v === 3) return 'pendiente'; }
    return 'libre';
  }
  function libres(id, iso) { var u = usuarioActual(); return horas().filter(function (h) { return estadoFranja(id, iso, h, u && u.id) === 'libre'; }).length; }
  function alternativas(id, iso, n) {
    var out = [], u = usuarioActual();
    dias().forEach(function (d) {
      if (d.iso < iso) return;
      CFG.canchas.forEach(function (c) {
        horas().forEach(function (h) { if (out.length < n && estadoFranja(c.id, d.iso, h, u && u.id) === 'libre') out.push({ cancha: c.id, fecha: d.iso, hora: h }); });
      });
    });
    return out.slice(0, n);
  }
  function crearReserva(sel, datos) {
    var u = usuarioActual(); if (!u) return { ok: false, error: 'Tu sesión terminó. Ingresa de nuevo.' };
    if (estadoFranja(sel.cancha, sel.fecha, sel.hora, u.id) !== 'libre') return { ok: false, conflicto: true, error: 'Este horario ya no está disponible.' };
    var db = load(); db.seq.res++;
    var r = {
      code: 'RES-' + pad(new Date().getFullYear() % 100) + String(db.seq.res).padStart(4, '0'), userId: u.id, tipo: u.tipo,
      cancha: sel.cancha, fecha: sel.fecha, hora: sel.hora, actividad: datos.actividad, participantes: +datos.participantes, observaciones: datos.observaciones || '',
      creada: new Date().toISOString(), historial: []
    };
    log(r, 'Solicitud creada.');
    if (u.tipo === 'interno') { r.estado = 'confirmada'; r.valor = 0; log(r, 'Confirmada: comunidad UdeM, sin costo.'); }
    else {
      db.seq.fac++;
      r.estado = 'pendiente_pago'; r.valor = CFG.tarifaExternosHora;
      r.factura = { numero: 'FAC-' + String(db.seq.fac).padStart(5, '0'), emitida: new Date().toISOString(), datos: JSON.parse(JSON.stringify(u.facturacion)) };
      r.limitePago = new Date(Date.now() + CFG.horasParaPagar * 3600000).toISOString();
      log(r, 'Factura ' + r.factura.numero + ' generada con los datos de facturación (sin redigitar).');
    }
    db.reservas.unshift(r); save();
    return { ok: true, reserva: r };
  }
  function reserva(code) { return load().reservas.filter(function (r) { return r.code === code; })[0] || null; }
  function misReservas() { var u = usuarioActual(); if (!u) return []; return load().reservas.filter(function (r) { return r.userId === u.id; }); }
  function todas() { return load().reservas.slice(); }
  function usuario(id) { return load().users.filter(function (u) { return u.id === id; })[0] || null; }
  function pagarEnLinea(code, metodo) {
    var r = reserva(code); if (!r || r.estado !== 'pendiente_pago') return { ok: false };
    r.pago = { metodo: metodo + ' (pasarela simulada)', referencia: 'SIM-' + Date.now().toString().slice(-8), fecha: new Date().toISOString(), simulado: true };
    r.estado = 'en_verificacion'; r.rechazo = null;
    log(r, 'Pago registrado en la pasarela (' + metodo + ', simulado), ref. ' + r.pago.referencia + '. Pendiente de validación de Tesorería.');
    notif(load(), r, 'Recibimos tu pago de la reserva ' + r.code + '. Tesorería lo validará y te avisaremos aquí.', 'info');
    save(); return { ok: true, reserva: r };
  }
  function subirComprobante(code, archivo, nota) {
    var r = reserva(code); if (!r || r.estado !== 'pendiente_pago') return { ok: false };
    r.pago = { metodo: 'Comprobante de pago', fecha: new Date().toISOString(), archivo: archivo, nota: nota || '' };
    r.estado = 'en_verificacion'; r.rechazo = null;
    log(r, 'Comprobante cargado: ' + archivo.nombre + '. En verificación por Tesorería.');
    notif(load(), r, 'Recibimos tu comprobante de la reserva ' + r.code + '. Tesorería lo validará y te avisaremos aquí.', 'info');
    if (!save()) { r.pago.archivo.dataUrl = null; save(); }
    return { ok: true, reserva: r };
  }
  function verificarPago(code, aprobado, motivo) {
    var r = reserva(code); if (!r || r.estado !== 'en_verificacion') return { ok: false };
    var por = staffNombre(), db = load();
    if (aprobado) {
      r.estado = 'confirmada'; r.rechazo = null; r.pago.verificado = { t: new Date().toISOString(), por: por, nota: motivo || '' };
      log(r, 'Tesorería verificó el pago. Reserva confirmada.' + (motivo ? ' Nota: ' + motivo : ''), por);
      notif(db, r, 'Tesorería aprobó tu pago de la reserva ' + r.code + '. ¡Tu reserva está confirmada!', 'ok');
    } else {
      r.estado = 'pendiente_pago'; r.rechazo = motivo || 'El comprobante no pudo verificarse.'; r.limitePago = new Date(Date.now() + 24 * 3600000).toISOString();
      (r.rechazos = r.rechazos || []).push({ t: new Date().toISOString(), por: por, motivo: r.rechazo, archivo: r.pago && r.pago.archivo ? r.pago.archivo.nombre : '' });
      log(r, 'Tesorería rechazó el comprobante: ' + r.rechazo, por);
      notif(db, r, 'Tesorería rechazó el comprobante de la reserva ' + r.code + ': ' + r.rechazo + ' Tienes 24 horas para pagar de nuevo.', 'err');
    }
    save(); return { ok: true };
  }
  function cancelar(code, por) {
    var r = reserva(code); if (!r || !activa(r)) return { ok: false };
    r.estado = 'cancelada'; r.canceladaPor = por || 'usuario'; r.motivoCancelacion = arguments[2] || '';
    log(r, 'Cancelada por ' + (por || 'el usuario') + '.' + (arguments[2] ? ' Motivo: ' + arguments[2] + '.' : '') + (r.pago && r.pago.metodo ? ' Reembolso: [política por definir con Tesorería].' : ''), por ? staffNombre() : '');
    if (por) notif(load(), r, 'Bienestar canceló tu reserva ' + r.code + (arguments[2] ? ': ' + arguments[2] : '.'), 'err');
    save(); return { ok: true };
  }
  function registrarPagoManual(code, referencia) {
    var r = reserva(code); if (!r || r.estado !== 'pendiente_pago') return { ok: false };
    var por = staffNombre();
    r.pago = { metodo: 'Pago registrado por Tesorería', referencia: referencia || '', fecha: new Date().toISOString(), verificado: { t: new Date().toISOString(), por: por } };
    r.estado = 'confirmada'; r.rechazo = null;
    log(r, 'Tesorería registró el pago' + (referencia ? ' (ref. ' + referencia + ')' : '') + '. Reserva confirmada.', por);
    notif(load(), r, 'Tesorería registró tu pago de la reserva ' + r.code + '. ¡Tu reserva está confirmada!', 'ok');
    save(); return { ok: true };
  }
  function marcarAsistencia(code, asistio) {
    var r = reserva(code); if (!r) return { ok: false };
    r.asistencia = asistio; log(r, asistio ? 'Bienestar registró asistencia.' : 'Bienestar registró inasistencia.', staffNombre()); save(); return { ok: true };
  }
  function notificaciones(soloNoLeidas) { var u = usuarioActual(); if (!u) return []; return load().notificaciones.filter(function (n) { return n.userId === u.id && (!soloNoLeidas || !n.leida); }); }
  function marcarLeidas(code) { var u = usuarioActual(); if (!u) return; var c = false; load().notificaciones.forEach(function (n) { if (n.userId === u.id && !n.leida && (!code || n.code === code)) { n.leida = true; c = true; } }); if (c) save(); }
  function usuarios() { return load().users.slice(); }
  function csv(nombre, filas) {
    var txt = filas.map(function (f) { return f.map(function (c) { c = c === null || c === undefined ? '' : String(c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8' })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  }
  // ---------- datos de demostración para indicadores ----------
  function generarDemo() {
    var db = load(); borrarDemo(true);
    var nombres = ['Valentina Gómez', 'Santiago Restrepo', 'Mariana Ospina', 'Juan Pablo Arango', 'Daniela Zapata', 'Sebastián Montoya', 'Laura Cardona', 'Andrés Valencia', 'Camila Henao', 'Mateo Giraldo', 'Sara Mejía', 'Tomás Correa'];
    var ext = [['Club Deportivo Los Pinos (demo)', 'Persona jurídica', '900.111.222-3'], ['Liga Barrial El Poblado (demo)', 'Persona jurídica', '900.333.444-5'], ['Carlos Ruiz (demo)', 'Persona natural', '1.020.304.050'], ['Escuela de Fútbol Andes (demo)', 'Persona jurídica', '901.555.666-7'], ['Natalia Uribe (demo)', 'Persona natural', '1.036.789.012']];
    var users = [];
    nombres.forEach(function (n, i) { var u = { id: 'demo-i' + i, email: 'demo' + (i + 1) + (i % 2 ? '@soyudemedellin.edu.co' : '@udemedellin.edu.co'), hash: 'x', nombre: n + ' (demo)', tipo: 'interno', rol: 'usuario', creado: new Date(Date.now() - (40 - i) * 86400000).toISOString(), demo: true }; db.users.push(u); users.push(u); });
    ext.forEach(function (e, i) { var u = { id: 'demo-e' + i, email: 'externo' + (i + 1) + '@demo.co', hash: 'x', nombre: e[0], tipo: 'externo', rol: 'usuario', creado: new Date(Date.now() - (35 - i) * 86400000).toISOString(), demo: true, facturacion: { tipoPersona: e[1], documento: e[2], razon: e[0], correo: 'externo' + (i + 1) + '@demo.co', telefono: '300 000 00' + i, rut: { nombre: 'RUT_demo_' + (i + 1) + '.pdf', size: 120000 } } }; db.users.push(u); users.push(u); });
    var acts = ['Partido recreativo', 'Entrenamiento', 'Torneo o evento', 'Clase'];
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0); var ocup = {};
    for (var off = -30; off < CFG.diasAnticipacion; off++) {
      var d = new Date(hoy); d.setDate(hoy.getDate() + off); var iso = isoDe(d), dow = d.getDay();
      var n = Math.round((dow === 0 ? 2 : dow === 6 ? 6 : 4) * (off < 0 ? 1 : 0.6) + rnd() * 3);
      for (var k = 0; k < n; k++) {
        var cid = rnd() < 0.55 ? 'A' : 'B', h = CFG.horaInicio + Math.floor(Math.pow(rnd(), 0.6) * (CFG.horaFin - CFG.horaInicio + 1));
        if (h > CFG.horaFin) h = CFG.horaFin;
        if (ocup[cid + iso + h]) continue; ocup[cid + iso + h] = 1;
        var u = rnd() < 0.68 ? users[Math.floor(rnd() * 12)] : users[12 + Math.floor(rnd() * 5)];
        db.seq.res++;
        var creada = new Date(d); creada.setDate(d.getDate() - 1 - Math.floor(rnd() * 5)); creada.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60)); if (creada.getTime() > Date.now()) creada = new Date(Date.now() - (2 + rnd() * 48) * 3600000);
        var r = { code: 'RES-' + pad(hoy.getFullYear() % 100) + String(db.seq.res).padStart(4, '0'), userId: u.id, tipo: u.tipo, cancha: cid, fecha: iso, hora: h, actividad: acts[Math.floor(rnd() * 4)], participantes: 6 + Math.floor(rnd() * 16), observaciones: '', creada: creada.toISOString(), historial: [{ t: creada.toISOString(), msg: 'Solicitud creada.' }], demo: true };
        var past = off < 0, x = rnd();
        if (u.tipo === 'interno') { r.valor = 0; r.estado = x < 0.1 ? 'cancelada' : 'confirmada'; }
        else {
          db.seq.fac++; r.valor = CFG.tarifaExternosHora;
          r.factura = { numero: 'FAC-' + String(db.seq.fac).padStart(5, '0'), emitida: creada.toISOString(), datos: JSON.parse(JSON.stringify(u.facturacion)) };
          r.limitePago = new Date(creada.getTime() + CFG.horasParaPagar * 3600000).toISOString();
          var nowT = Date.now(), tPago = new Date(Math.min(creada.getTime() + (2 + rnd() * 20) * 3600000, nowT - (1 + rnd() * 20) * 3600000)), tVer = new Date(Math.min(tPago.getTime() + (1 + rnd() * 30) * 3600000, nowT - 1800000));
          if (past ? x < 0.12 : x < 0.06) r.estado = 'vencida';
          else if (x < 0.18) r.estado = 'cancelada';
          else if (!past && x < 0.32) { r.estado = 'pendiente_pago'; r.limitePago = new Date(Date.now() + (6 + rnd() * 40) * 3600000).toISOString(); }
          else if (!past && x < 0.45) { r.estado = 'en_verificacion'; r.pago = { metodo: 'Comprobante de pago', fecha: tPago.toISOString(), archivo: { nombre: 'comprobante_' + r.code + '.pdf', size: 90000 }, nota: 'Transferencia (demo)' }; }
          else if (x < 0.7) { r.estado = 'confirmada'; r.pago = { metodo: rnd() < 0.5 ? 'PSE' : 'Tarjeta', referencia: 'SIM-' + Math.floor(rnd() * 1e8), fecha: tPago.toISOString(), simulado: true, verificado: { t: tPago.toISOString(), por: 'Pasarela de pagos' } }; }
          else { r.estado = 'confirmada'; r.pago = { metodo: 'Comprobante de pago', fecha: tPago.toISOString(), archivo: { nombre: 'comprobante_' + r.code + '.pdf', size: 90000 }, verificado: { t: tVer.toISOString(), por: 'Tesorería (demo)' } }; }
        }
        if (past && r.estado === 'confirmada') r.asistencia = rnd() < 0.86;
        db.reservas.push(r);
      }
    }
    db.reservas.sort(function (a, b) { return b.creada.localeCompare(a.creada); });
    save(); return { ok: true };
  }
  function borrarDemo(noSave) {
    var db = load();
    db.users = db.users.filter(function (u) { return !u.demo; });
    db.reservas = db.reservas.filter(function (r) { return !r.demo; });
    if (!noSave) save();
  }
  function hayDemo() { return load().reservas.some(function (r) { return r.demo; }); }
  function ponerFuera(id, motivo) { var db = load(); if (motivo) db.canchasFuera[id] = motivo; else delete db.canchasFuera[id]; save(); }
  function reiniciar() { try { localStorage.removeItem(KEY); Object.keys(SK).forEach(function (k) { localStorage.removeItem(SK[k]); }); } catch (e) {} mem = null; }

  var ESTADOS = {
    confirmada: { txt: '✓ Confirmada', cls: 'c-ok' },
    pendiente_pago: { txt: '◷ Pendiente de pago', cls: 'c-pend' },
    en_verificacion: { txt: '◷ Pago en verificación', cls: 'c-pend' },
    cancelada: { txt: 'Cancelada', cls: 'c-res' },
    vencida: { txt: 'Vencida (sin pago)', cls: 'c-off' },
    finalizada: { txt: 'Finalizada', cls: 'c-res' }
  };
  function estadoVisible(r) { if (r.estado === 'confirmada' && pasada(r.fecha, r.hora + 1)) return 'finalizada'; return r.estado; }

  function ics(r) {
    var c = cancha(r.cancha), f = r.fecha.replace(/-/g, '');
    var s = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UdeM Reservas//ES\r\nBEGIN:VEVENT\r\nUID:' + r.code + '@udem-reservas\r\nDTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z\r\nDTSTART;TZID=America/Bogota:' + f + 'T' + pad(r.hora) + '0000\r\nDTEND;TZID=America/Bogota:' + f + 'T' + pad(r.hora + 1) + '0000\r\nSUMMARY:' + c.nombre + ' (' + r.code + ')\r\nLOCATION:Universidad de Medellín · ' + c.ubicacion + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([s], { type: 'text/calendar' })); a.download = r.code + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // datos para el encabezado de todas las páginas
  function comun() {
    var p = portal(), u = usuarioActual();
    var staffPortal = p !== 'usuario';
    var rolTxt = !u ? '' : u.rol === 'tesoreria' ? 'Tesorería' : u.rol === 'bienestar' ? 'Bienestar' : u.tipo === 'interno' ? 'Comunidad UdeM' : 'Externo';
    var nNoti = u && u.rol === 'usuario' ? load().notificaciones.filter(function (n) { return n.userId === u.id && !n.leida; }).length : 0;
    var nom = u ? (u.rol === 'usuario' ? u.nombre.split(' ').slice(0, 2).join(' ') : u.email) : '';
    return {
      portal: p, sesTes: !!sesionDe('tesoreria'), sesBie: !!sesionDe('bienestar'), showTes: p === 'tesoreria' || !!(staffPortal && sesionDe('tesoreria')), showBie: p === 'bienestar' || !!(staffPortal && sesionDe('bienestar')),
      u: u ? { logged: true, nombre: nom, rol: rolTxt, ini: u.nombre.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(), color: u.rol === 'tesoreria' ? '#1D5A51' : u.rol === 'bienestar' ? '#3A66AA' : u.tipo === 'interno' ? '#2B445F' : '#932428', staff: u.rol !== 'usuario', externo: u.tipo === 'externo' && u.rol === 'usuario', interno: u.tipo === 'interno' && u.rol === 'usuario' } : { logged: false },
      guest: !u && !staffPortal, staff: staffPortal, noStaff: !staffPortal, contacto: CFG.contacto, nNoti: nNoti, hayNoti: nNoti > 0,
      esTesoreria: p === 'tesoreria', esBienestar: p === 'bienestar', esUsuario: !!(u && u.rol === 'usuario'),
      panelHref: p === 'tesoreria' ? 'tesoreria.html' : p === 'bienestar' ? 'bienestar.html' : 'personal.html',
      perfilHref: staffPortal ? (p === 'tesoreria' ? 'tesoreria.html' : p === 'bienestar' ? 'bienestar.html' : 'personal.html') : 'perfil.html',
      salir: function () { cerrarSesion(); location.href = staffPortal ? 'personal.html' : 'index.html'; }
    };
  }
  function sesionDe(rol) {
    var id = null; try { id = localStorage.getItem(SK[rol]); } catch (e) {}
    var u = id ? load().users.filter(function (x) { return x.id === id; })[0] || null : null;
    return u && (rol === 'usuario' ? u.rol === 'usuario' : u.rol === rol) ? u : null;
  }
  function cerrarSesionDe(rol) { try { localStorage.removeItem(SK[rol]); } catch (e) {} window.dispatchEvent(new Event('udem-cambio')); }
  function exigirSesion(next) {
    if (usuarioActual()) return true;
    var dest = encodeURIComponent(next || location.pathname.split('/').pop() + location.search);
    location.replace((portal() === 'usuario' ? 'ingresar.html' : 'personal.html') + '?next=' + dest);
    return false;
  }
  function exigirRol(rol, pagina) {
    if (!exigirSesion(pagina)) return false;
    var u = usuarioActual(); return !!u && u.rol === rol;
  }
  function correoPersonal(rol) { var p = CFG.personal.filter(function (x) { return x.rol === rol; })[0]; return p ? p.email : ''; }
  function sel(v) { if (v === undefined) { try { return JSON.parse(sessionStorage.getItem('udem_sel')) || {}; } catch (e) { return {}; } } try { sessionStorage.setItem('udem_sel', JSON.stringify(v)); } catch (e) {} }

  window.addEventListener('storage', function (e) {
    if (e.key === KEY || Object.keys(SK).some(function (k) { return SK[k] === e.key; })) { mem = null; window.dispatchEvent(new Event('udem-cambio')); }
  });
  window.UdeM = {
    CFG: CFG, EMAIL_RE: EMAIL_RE, esInstitucional: esInstitucional, dominio: dominio,
    usuarioActual: usuarioActual, registrar: registrar, ingresar: ingresar, cerrarSesion: cerrarSesion, restablecer: restablecer,
    actualizarUsuario: actualizarUsuario, cambiarClave: cambiarClave, exigirSesion: exigirSesion, comun: comun, sel: sel,
    dias: dias, horas: horas, hoyIso: hoyIso, diaCorto: diaCorto, diaLargo: diaLargo, hora: hora, franja: franja, dinero: dinero, dineroCorto: dineroCorto,
    cancha: cancha, canchas: function () { return CFG.canchas; }, fueraDeServicio: fueraDeServicio, ponerFuera: ponerFuera,
    estadoFranja: estadoFranja, libres: libres, alternativas: alternativas,
    crearReserva: crearReserva, reserva: reserva, misReservas: misReservas, todas: todas, usuario: usuario,
    pagarEnLinea: pagarEnLinea, subirComprobante: subirComprobante, verificarPago: verificarPago, cancelar: cancelar,
    registrarPagoManual: registrarPagoManual, marcarAsistencia: marcarAsistencia, notificaciones: notificaciones, marcarLeidas: marcarLeidas,
    usuarios: usuarios, csv: csv, exigirRol: exigirRol, portal: portal, sesionDe: sesionDe, cerrarSesionDe: cerrarSesionDe, correoPersonal: correoPersonal, generarDemo: generarDemo, borrarDemo: borrarDemo, hayDemo: hayDemo, isoDe: isoDe, fecha: fecha, pasada: pasada,
    ESTADOS: ESTADOS, estadoVisible: estadoVisible, ics: ics, reiniciar: reiniciar,
    ir: function (u) { location.href = u; }, q: function (k) { return new URLSearchParams(location.search).get(k); }
  };
})();
