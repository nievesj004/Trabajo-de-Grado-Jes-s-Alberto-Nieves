document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/auth';
    
    // Definimos la URL del CMS manualmente porque API_URL apunta a 'auth'
    const CMS_URL = 'http://localhost:3000/api/cms'; 

    // --- 1. NUEVA FUNCIÓN: CARGAR COLORES DEL TEMA ---
    async function loadTheme() {
        try {
            const res = await fetch(CMS_URL);
            if (res.ok) {
                const data = await res.json();
                
                // --- 1. ACTUALIZAR NOMBRE (LOGO) ---
                if (data.store_name) {
                    const name = data.store_name;

                    // Actualizar Título de la Pestaña
                    document.title = `Iniciar Sesión - ${name}`;

                    // Actualizar la etiqueta <a> con clase "logo"
                    const logoElement = document.querySelector('.logo');
                    
                    if (logoElement) {
                        const name = data.store_name || "FarmaVida";
                        const half = Math.ceil(name.length / 2);
                        
                        // 1. Envolvemos el texto en un div para que no se separe
                        let textHTML = `
                            <div style="display: flex; align-items: baseline;">
                                ${name.slice(0, half)}<span>${name.slice(half)}</span><span class="dot">.</span>
                            </div>
                        `;

                        // 2. Verificamos si hay logo en la base de datos
                        if (data.store_logo && data.store_logo.trim() !== "") {
                            // Inyectamos la imagen y luego el texto
                            logoElement.innerHTML = `
                                <img src="${data.store_logo}" alt="Logo" style="height: 50px; width: auto; object-fit: contain;">
                                ${textHTML}
                            `;
                        } else {
                            logoElement.innerHTML = textHTML;
                        }
                    }
                }

                // --- 2. ACTUALIZAR COLORES ---
                if (data.colors_json) {
                    const colors = typeof data.colors_json === 'string' 
                        ? JSON.parse(data.colors_json) 
                        : data.colors_json;

                    Object.entries(colors).forEach(([key, val]) => {
                        document.documentElement.style.setProperty(key, val);
                    });
                }
            }
        } catch (error) {
            console.error("No se pudo cargar el tema personalizado en Login:", error);
        }
    }
    // Ejecutamos la carga de colores INMEDIATAMENTE
    loadTheme();

    // Elementos del DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const formTitle = document.getElementById('form-title');
    
    // Elementos de la Alerta Personalizada
    const customAlert = document.getElementById('custom-alert');
    const customAlertMsg = document.getElementById('custom-alert-message');
    const btnCloseAlert = document.getElementById('btn-close-alert');

    // --- FUNCIÓN PARA MOSTRAR ALERTA ---
    function showCustomAlert(msg, type = 'error') {
        const iconElement = customAlert.querySelector('.alert-icon i');
        const titleElement = customAlert.querySelector('h3');
        const btnElement = document.getElementById('btn-close-alert');

        customAlertMsg.innerText = msg;

        if (type === 'success') {
            // MODO ÉXITO (Verde)
            iconElement.className = 'bx bx-check-circle';
            iconElement.style.color = '#2E7D32';
            titleElement.innerText = "¡Excelente!";
            titleElement.style.color = '#2E7D32';
            btnElement.style.backgroundColor = '#2E7D32'; // Botón verde
        } else {
            // MODO ERROR (Rojo)
            iconElement.className = 'bx bx-error-circle';
            iconElement.style.color = '#e63d3d';
            titleElement.innerText = "¡Atención!";
            titleElement.style.color = '#e63d3d';
            btnElement.style.backgroundColor = '#e63d3d'; // Botón rojo
        }

        customAlert.classList.add('active');
    }

    // CERRAR ALERTA
    if(btnCloseAlert){
        btnCloseAlert.addEventListener('click', () => {
            customAlert.classList.remove('active');
        });
    }

    // Cerrar al hacer clic fuera
    customAlert.addEventListener('click', (e) => {
        if(e.target === customAlert) customAlert.classList.remove('active');
    });

    
    // --- TOGGLE ENTRE LOGIN Y REGISTRO ---
    document.getElementById('to-register').addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        formTitle.innerText = "Crear Cuenta";
        registerForm.reset(); // Limpiar campos
    });

    document.getElementById('to-login').addEventListener('click', () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        formTitle.innerText = "Iniciar Sesión";
        loginForm.reset(); // Limpiar campos
    });


    // --- MANEJAR LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                // AQUÍ USAMOS LA ALERTA EN VEZ DE TEXTO
                showCustomAlert(data.message || "Credenciales incorrectas", "error");
                return;
            }

            // GUARDAR SESIÓN
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (data.user.role === 'Admin') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error(error);
            showCustomAlert('No se pudo conectar con el servidor', "error");
        }
    });


    // --- MANEJAR REGISTRO ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // 1. Validar contraseñas
        if (password !== confirmPassword) {
            showCustomAlert("Las contraseñas no coinciden.", "error");
            return; 
        }

        // 2. Validar longitud
        if (password.length < 6) {
            showCustomAlert("La contraseña debe tener al menos 6 caracteres.", "error");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone, location: '' })
            });

            const data = await res.json();

            if (!res.ok) {
                showCustomAlert(data.message || "Error al registrar", "error");
                return;
            }

            // ÉXITO AL REGISTRAR
            showCustomAlert('Cuenta creada con éxito. Ya puedes iniciar sesión.', 'success');
            
            // Volver al login automáticamente
            document.getElementById('to-login').click();

        } catch (error) {
            console.error(error);
            showCustomAlert('Error de conexión al intentar registrarse', "error");
        }
    });
    

    // --- REFERENCIAS NUEVAS ---
    const recoveryForm = document.getElementById('recovery-form');
    const toRecoveryBtn = document.getElementById('to-recovery');
    const backToLoginRecBtn = document.getElementById('back-to-login-from-rec');
    
    // Pasos
    const step1Email = document.getElementById('step-1-email');
    const step2Code = document.getElementById('step-2-code');
    const step3Pass = document.getElementById('step-3-pass'); // Nuevo paso
    
    // Botones
    const btnSendCode = document.getElementById('btn-send-code');
    const btnVerifyStep = document.getElementById('btn-verify-step'); // Nuevo botón intermedio
    
    // --- NAVEGACIÓN ---
    toRecoveryBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        recoveryForm.classList.remove('hidden');
        formTitle.innerText = "Recuperar Contraseña";
        
        // Reset visual
        step1Email.classList.remove('hidden');
        step2Code.classList.add('hidden');
        step3Pass.classList.add('hidden');
    });

    backToLoginRecBtn.addEventListener('click', () => {
        recoveryForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        formTitle.innerText = "Iniciar Sesión";
    });

    // --- LÓGICA DE RECUPERACIÓN ---

    // 1. PASO 1 -> 2: Enviar Código
    btnSendCode.addEventListener('click', async () => {
        const email = document.getElementById('rec-email').value;
        if(!email) {
            showCustomAlert("Por favor ingresa tu correo.", "error");
            return;
        }

        // Bloquear botón para evitar doble click
        btnSendCode.disabled = true;
        btnSendCode.innerText = "Enviando...";

        try {
            const res = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if(res.ok) {
                showCustomAlert(data.message, "success");
                step1Email.classList.add('hidden');
                step2Code.classList.remove('hidden');
            } else {
                showCustomAlert(data.message, "error");
            }
        } catch (error) {
            showCustomAlert("Error al enviar código.", "error");
        } finally {
            btnSendCode.disabled = false;
            btnSendCode.innerText = "Enviar Código";
        }
    });

    // 2. PASO 2 -> 3: Verificar Código (VALIDACIÓN CON BACKEND)
    btnVerifyStep.addEventListener('click', async () => {
        const email = document.getElementById('rec-email').value;
        const code = document.getElementById('rec-code').value;

        if(!code) {
            showCustomAlert("Ingresa el código.", "error");
            return;
        }

        btnVerifyStep.disabled = true;
        btnVerifyStep.innerText = "Verificando...";

        try {
            // Llamamos a la nueva ruta que creamos en el Paso 1
            const res = await fetch(`${API_URL}/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();

            if(res.ok) {
                // Si el backend dice OK, pasamos al paso 3
                step2Code.classList.add('hidden');
                step3Pass.classList.remove('hidden');
            } else {
                showCustomAlert(data.message, "error");
            }

        } catch (error) {
            console.error(error);
            showCustomAlert("Error de conexión.", "error");
        } finally {
            btnVerifyStep.disabled = false;
            btnVerifyStep.innerText = "Verificar Código";
        }
    });

    // 3. PASO 3: Cambio Final
    recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('rec-email').value;
        const code = document.getElementById('rec-code').value; // Necesitamos enviar el código de nuevo para validar el cambio
        const newPassword = document.getElementById('rec-new-pass').value;
        const confirmPassword = document.getElementById('rec-confirm-pass').value;

        if(!newPassword || !confirmPassword) {
            showCustomAlert("Completa los campos.", "error");
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showCustomAlert("Las contraseñas no coinciden.", "error");
            return;
        }

        if(newPassword.length < 6) {
            showCustomAlert("Mínimo 6 caracteres.", "error");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            const data = await res.json();

            if(res.ok) {
                showCustomAlert("¡Contraseña restablecida! Inicia sesión.", "success");
                setTimeout(() => {
                    location.reload(); // Recargar para limpiar todo
                }, 2000);
            } else {
                showCustomAlert(data.message, "error");
            }
        } catch (error) {
            showCustomAlert("Error al cambiar contraseña.", "error");
        }
    });
});