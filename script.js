document.addEventListener('DOMContentLoaded', (event) => {
    const acceptButton = document.getElementById('accept-cookies');
    const denyButton = document.getElementById('deny-cookies');
    const cookieModal = document.getElementById('cookie-modal-overlay');

    const cookieAccepted = localStorage.getItem('cookieAccepted');

    if (cookieAccepted !== 'true') {
        cookieModal.style.display = 'flex';
    }

    acceptButton.addEventListener('click', () => {
        localStorage.setItem('cookieAccepted', 'true');
        cookieModal.style.display = 'none';
    });

    denyButton.addEventListener('click', () => {
        // En un caso real, aquí pondrías la lógica para denegar las cookies
        // y eliminar las que ya existan. Por ahora, solo cerramos el modal.
        cookieModal.style.display = 'none';
    });
});
