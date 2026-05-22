// Enrutador básico SPA
function navigate(targetViewId) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });
    
    // Mostrar la vista objetivo
    const target = document.getElementById(targetViewId);
    target.classList.remove('hidden');
    target.classList.add('active');
}