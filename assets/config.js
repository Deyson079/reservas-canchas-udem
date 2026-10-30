// =====================================================================
//  CONFIGURACIÓN DE LA PLATAFORMA · edita estos valores sin tocar el resto
// =====================================================================
window.UDEM_CONFIG = {
  // Correos con estos dominios son "Comunidad UdeM": no pagan y su reserva se confirma al instante.
  dominiosInstitucionales: ['udemedellin.edu.co', 'soyudemedellin.edu.co'],

  // Valor por hora para usuarios externos (COP). VALOR DE EJEMPLO: reemplazar por la tarifa oficial.
  tarifaExternosHora: 80000,

  // Horario de las franjas (hora de inicio de la primera y de la última franja de 1 hora). Por confirmar con Deportes.
  horaInicio: 7,
  horaFin: 20,

  // Cuántos días hacia adelante se puede reservar (incluye hoy). Por confirmar con Deportes.
  diasAnticipacion: 14,

  // Horas que tiene un externo para pagar antes de que se libere el horario. Por confirmar con Tesorería.
  horasParaPagar: 48,

  // Escenarios. Nombres y datos de ejemplo: reemplazar por el inventario real.
  canchas: [
    { id: 'A', nombre: 'Cancha polideportiva A', corto: 'Cancha A', deportes: 'Microfútbol · Baloncesto', ubicacion: '[Bloque / sector]', aforo: '[Aforo]', color: '#2B445F', linea: '#60A8A6' },
    { id: 'B', nombre: 'Cancha sintética B', corto: 'Cancha B', deportes: 'Fútbol', ubicacion: '[Bloque / sector]', aforo: '[Aforo]', color: '#1D5A51', linea: '#8CC0B3' },
    { id: 'C', nombre: 'Cancha de voleibol C', corto: 'Cancha C', deportes: 'Voleibol', ubicacion: '[Bloque / sector]', aforo: '[Aforo]', color: '#932428', linea: '#E3B3B5' }
  ],

  // Ocupación simulada de fondo para que el calendario no se vea vacío en la demostración.
  // Ponlo en false para ver solo las reservas hechas en la plataforma.
  ocupacionDeEjemplo: true,

  // Cuentas del personal que se crean automáticamente (cámbialas antes de compartir el enlace).
  personal: [
    { email: 'tesoreria@udemedellin.edu.co', clave: 'Tesoreria2026', nombre: 'Tesorería', rol: 'tesoreria' },
    { email: 'bienestar@udemedellin.edu.co', clave: 'Bienestar2026', nombre: 'Bienestar Universitario · Deportes', rol: 'bienestar' }
  ],

  contacto: '[Correo y extensión de Deportes]'
};
