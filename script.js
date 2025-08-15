document.addEventListener('DOMContentLoaded', function() {
    const cookieModal = document.getElementById('cookie-modal-overlay');
    const acceptButton = document.getElementById('accept-cookies');
    const denyButton = document.getElementById('deny-cookies');
    const cookieAccepted = localStorage.getItem('cookies-accepted');

    // Si el usuario no ha aceptado ni denegado las cookies, mostramos el modal.
    if (!cookieAccepted) {
        cookieModal.style.display = 'flex';
    }

    // Función para ocultar el modal y guardar la preferencia.
    function hideModalAndSetPreference(preference) {
        localStorage.setItem('cookies-accepted', preference);
        cookieModal.style.display = 'none';
    }

    // Evento para el botón de aceptar
    if (acceptButton) {
        acceptButton.addEventListener('click', function() {
            hideModalAndSetPreference('true');
        });
    }

    // Evento para el botón de denegar
    if (denyButton) {
        denyButton.addEventListener('click', function() {
            hideModalAndSetPreference('false');
        });
    }
});
