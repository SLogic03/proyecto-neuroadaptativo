// ==========================================
// Módulo de Captura Conductual Avanzada
// ==========================================

console.log("Módulo de telemetría conductual (con matemáticas) inicializado.");

// Conexión WebSocket al backend (a través de Nginx en puerto 80)
const ws = new WebSocket('ws://localhost/ws');
ws.onopen = () => console.log("WebSocket conectado al backend.");
ws.onerror = (err) => console.error("WebSocket error:", err);
ws.onclose = (e) => console.error(`WebSocket cerrado: code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);

let telemetryBuffer = [];

// Variables de estado para calcular deltas (diferencias)
let lastX = null, lastY = null, lastTimeMouse = null;
let lastVelocity = 0;
let lastKeyTime = null;
let hoverTimers = {}; // Diccionario para medir el Dwell Time

// 1. Cinemática del Ratón (Velocidad y Aceleración)
document.addEventListener('mousemove', (event) => {
    const currentTime = Date.now();
    let velocity = 0;
    let acceleration = 0;

    if (lastX !== null && lastTimeMouse !== null) {
        const deltaTime = currentTime - lastTimeMouse;

        if (deltaTime > 0) { // Evitamos divisiones por cero
            // Teorema de Pitágoras para la distancia euclidiana
            const distance = Math.sqrt(Math.pow(event.clientX - lastX, 2) + Math.pow(event.clientY - lastY, 2));

            velocity = distance / deltaTime; // px/ms
            acceleration = (velocity - lastVelocity) / deltaTime; // px/ms^2
        }
    }

    const mouseData = {
        type: 'mouse_kinematics',
        x: event.clientX,
        y: event.clientY,
        v: parseFloat(velocity.toFixed(4)), // Redondeamos para no saturar la BD
        a: parseFloat(acceleration.toFixed(6)),
        timestamp: currentTime
    };

    telemetryBuffer.push(mouseData);

    // Actualizamos el estado para el siguiente fotograma
    lastX = event.clientX;
    lastY = event.clientY;
    lastTimeMouse = currentTime;
    lastVelocity = velocity;
}, { passive: true });

// 2. Latencia de Teclado (Tiempo entre teclas)
document.addEventListener('keydown', (event) => {
    const currentTime = Date.now();
    let latency = 0;

    if (lastKeyTime !== null) {
        latency = currentTime - lastKeyTime; // Milisegundos desde la última tecla
    }

    const keyData = {
        type: 'keystroke_latency',
        key_code: event.code,
        latency_ms: latency,
        timestamp: currentTime
    };

    telemetryBuffer.push(keyData);
    console.log("Latencia de tipeo:", latency, "ms"); // Log de prueba

    lastKeyTime = currentTime;
}, { passive: true });

// 3. Dwell Time (Tiempo de duda/permanencia sobre botones e inputs)
// Detectamos cuando el usuario pone el ratón encima de un elemento interactivo
document.querySelectorAll('button, input').forEach(element => {

    // Inicia el cronómetro al entrar
    element.addEventListener('mouseenter', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';
        hoverTimers[targetId] = Date.now();
    }, { passive: true });

    // Detiene el cronómetro al salir y calcula el Dwell Time
    element.addEventListener('mouseleave', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';

        if (hoverTimers[targetId]) {
            const dwellTime = Date.now() - hoverTimers[targetId];

            const dwellData = {
                type: 'dwell_time',
                element_id: targetId,
                duration_ms: dwellTime,
                timestamp: Date.now()
            };

            telemetryBuffer.push(dwellData);
            console.log(`Dwell Time en [${targetId}]:`, dwellTime, "ms"); // Log de prueba

            delete hoverTimers[targetId]; // Limpiamos la memoria
        }
    }, { passive: true });
});

// ==========================================
// Envío por lotes al backend vía WebSocket
// ==========================================
setInterval(() => {
    if (telemetryBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(telemetryBuffer));
        telemetryBuffer = [];
    }
}, 500);