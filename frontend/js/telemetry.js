// ==========================================
// Módulo de Captura Conductual (web-user-behaviour)
// ==========================================

console.log("Módulo de telemetría conductual inicializado.");

// Este buffer guardará los eventos temporalmente. 
// En la Tarea 10 lo vaciaremos enviándolo por WebSocket.
let telemetryBuffer = [];

// 1. Captura Pasiva de Ratón (Movimiento)
// Usamos 'passive: true' para no bloquear el renderizado del DOM (clave para el rendimiento)
document.addEventListener('mousemove', (event) => {
    const mouseData = {
        type: 'mousemove',
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now()
    };
    telemetryBuffer.push(mouseData);

    // Nota: El console.log de mousemove está comentado por defecto 
    // porque genera miles de registros por segundo y saturaría tu consola.
    // console.log("Mouse movido:", mouseData); 
}, { passive: true });

// 2. Captura Pasiva de Ratón (Clics)
document.addEventListener('mousedown', (event) => {
    const clickData = {
        type: 'click',
        button: event.button, // 0 = Izquierdo, 1 = Medio, 2 = Derecho
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now()
    };
    telemetryBuffer.push(clickData);
    console.log("Clic registrado:", clickData); // Este sí lo mostramos para testear
}, { passive: true });

// 3. Captura Pasiva de Teclado
document.addEventListener('keydown', (event) => {
    // Por seguridad y ética, NO guardamos la tecla exacta que pulsa (ej: contraseñas),
    // solo guardamos el código físico de la tecla para medir ritmos y latencias.
    const keyData = {
        type: 'keypress',
        key_code: event.code,
        timestamp: Date.now()
    };
    telemetryBuffer.push(keyData);
    console.log("Tecla pulsada:", keyData);
}, { passive: true });