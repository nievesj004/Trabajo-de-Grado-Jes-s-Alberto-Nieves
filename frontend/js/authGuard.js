(function() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // 1. Verificar si existe token
    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Verificar si es Admin
    const user = JSON.parse(userStr);
    if (user.role !== 'Admin') {
        alert("No tienes permisos de administrador.");
        window.location.href = 'index.html';
        return;
    }

    // Si pasa ambas pruebas, dejamos que se cargue la página
})();