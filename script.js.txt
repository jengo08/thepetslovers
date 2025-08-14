document.addEventListener('DOMContentLoaded', () => {
    const cookieModalOverlay = document.getElementById('cookie-modal-overlay');
    const acceptButton = document.getElementById('accept-cookies');
    const denyButton = document.getElementById('deny-cookies');

    // Comprobar si el usuario ya ha aceptado las cookies
    if (localStorage.getItem('cookies-accepted') === 'true') {
        cookieModalOverlay.style.display = 'none';
    } else {
        cookieModalOverlay.style.display = 'flex';
    }

    // Ocultar el modal al hacer clic en "Aceptar"
    acceptButton.addEventListener('click', () => {
        localStorage.setItem('cookies-accepted', 'true');
        cookieModalOverlay.style.display = 'none';
    });
    
    // Ocultar el modal al hacer clic en "Denegar"
    denyButton.addEventListener('click', () => {
        cookieModalOverlay.style.display = 'none';
    });
});
