// ==========================================
// Módulo de Inducción (Shepherd.js)
// ==========================================

console.log("Módulo de inducción (Tour) inicializado.");

// 1. Inicializar el Tour con opciones por defecto
const tour = new Shepherd.Tour({
    useModalOverlay: true, // Oscurece el fondo para resaltar el elemento
    defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shadow-md bg-white',
        scrollTo: { behavior: 'smooth', block: 'center' }
    }
});

// 2. Definir los pasos del recorrido
tour.addStep({
    id: 'paso-1-bienvenida',
    title: '¡Hola!',
    text: 'Bienvenido al sistema de inducción. Haz clic en este botón para iniciar tu registro.',
    attachTo: {
        element: '#btn-start',
        on: 'bottom' // La viñeta aparecerá debajo del botón
    },
    buttons: [
        {
            text: 'Entendido',
            action: tour.next
        }
    ]
});

tour.addStep({
    id: 'paso-2-formulario',
    title: 'Tus Datos',
    text: 'Aquí deberás ingresar tu nombre completo antes de continuar.',
    attachTo: {
        element: '#form-input',
        on: 'top'
    },
    // Como este paso está en otra pantalla, necesitamos decirle a Shepherd que 
    // cambie la vista antes de mostrar la viñeta.
    beforeShowPromise: function () {
        return new Promise(function (resolve) {
            navigate('view-form'); // Llamamos a nuestra función de app.js
            setTimeout(resolve, 300); // Pequeña pausa para que el DOM se actualice
        });
    },
    buttons: [
        { text: 'Atrás', action: tour.back, secondary: true },
        { text: 'Siguiente', action: tour.next }
    ]
});

tour.addStep({
    id: 'paso-3-normas',
    title: 'Lectura Importante',
    text: 'Asegúrate de leer todo el código de ética en esta sección. Es fundamental.',
    attachTo: {
        element: '#text-rules',
        on: 'bottom'
    },
    beforeShowPromise: function () {
        return new Promise(function (resolve) {
            navigate('view-instructions');
            setTimeout(resolve, 300);
        });
    },
    buttons: [
        { text: 'Finalizar Tour', action: tour.complete }
    ]
});

// 3. Iniciar el tour automáticamente al cargar la página (solo para pruebas)
// Más adelante, lo activaremos con un botón o tras un evento específico.
setTimeout(() => {
    tour.start();
}, 1000);