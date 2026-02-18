document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN API ---
    // Si tu backend corre en otro puerto, cámbialo aquí.
    const API_URL = 'http://localhost:3000/api';

    const THEME_VARIABLES = [
        { key: '--primary-color', label: 'Color Principal', default: '#2D3A95' },
        { key: '--secondary-color', label: 'Color Secundario', default: '#4facfe' },
        { key: '--accent-color', label: 'Color Acento', default: '#FF6B6B' },
        { key: '--bg-color', label: 'Fondo Pantalla', default: '#F9FAFB' },
        { key: '--card-bg', label: 'Fondo Tarjetas', default: '#FFFFFF' },
        { key: '--text-dark', label: 'Texto Títulos', default: '#1F2937' },
        { key: '--hero-text-color', label: 'Texto Hero Banner', default: '#ffffff' },
        { key: '--text-gray', label: 'Texto Secundario', default: '#6B7280' },
        { key: '--border-color', label: 'Bordes', default: '#E5E7EB' }
    ];

    // --- FUNCIÓN FALTANTE: APLICAR TEMA ---
    function applyThemeToDashboard() {
        // Verifica si hay colores guardados en cmsData
        if (cmsData.colors) {
            Object.entries(cmsData.colors).forEach(([key, val]) => {
                // Aplica cada color a las variables CSS del documento (:root)
                document.documentElement.style.setProperty(key, val);
            });
        }
    }

    // --- VARIABLES GLOBALES (Se llenan desde el Backend) ---
    let productsDB = [];
    let ordersDB = [];
    let usersDB = [];
    let cmsData = {
        store_name: "FarmaVida",
        hero: { title: "", text: "", img: "", bg_img: "" },
        carousel_title: "Lo Más Vendido",
        catalog_title: "Catálogo",
        categories: [],
        colors: {},
        carousel: []
    };

    // --- FUNCIÓN HELPER PARA PETICIONES CON TOKEN ---
    async function authFetch(url, options = {}) {
        const token = localStorage.getItem('token');

        // Si no hay token, forzamos salida (seguridad extra)
        if (!token) {
            window.location.href = 'login.html';
            return null;
        }

        // Configuramos las cabeceras (headers) automáticamente
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Aquí va la "llave"
            ...(options.headers || {})
        };

        const response = await fetch(url, { ...options, headers });

        // Si el servidor dice "401" (No autorizado) o "403" (Prohibido)
        if (response.status === 401 || response.status === 403) {
            alert("Tu sesión ha expirado o no tienes permisos.");
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }

        return response;
    }

    // ==========================================
    //  LÓGICA DEL MODAL "RESTAURAR COLORES"
    // ==========================================

    // 1. Elementos del Modal
    const resetModal = document.getElementById('reset-colors-modal');
    const btnConfirmReset = document.getElementById('btn-confirm-reset');
    const btnCancelReset = document.getElementById('btn-cancel-reset');
    const btnResetColors = document.getElementById('btn-reset-colors')

    // 2. Abrir el modal al hacer clic en "Restaurar Default"
    if (btnResetColors) {
        btnResetColors.addEventListener('click', (e) => {
            e.preventDefault(); // Evita recargas
            if (resetModal) resetModal.classList.add('active');
        });
    }

    // 3. Botón "Cancelar" (Cierra el modal)
    if (btnCancelReset) {
        btnCancelReset.addEventListener('click', () => {
            if (resetModal) resetModal.classList.remove('active');
        });
    }

    // 4. Botón "Sí, Restaurar" (Aplica la lógica)
    if (btnConfirmReset) {
        btnConfirmReset.addEventListener('click', async () => {
            // A. Restaurar datos en memoria (cmsData)
            const resetColors = {};
            THEME_VARIABLES.forEach(v => resetColors[v.key] = v.default);
            cmsData.colors = resetColors;

            // B. Actualizar Inputs Visuales
            renderCMSColors();

            // C. Actualizar Variables CSS (:root)
            Object.entries(resetColors).forEach(([key, val]) => {
                document.documentElement.style.setProperty(key, val);
            });

            // D. Restaurar Gráfico de Ventas (si existe)
            if (typeof salesChart !== 'undefined') {
                const defaultPrimary = resetColors['--primary-color'];
                salesChart.data.datasets[0].borderColor = defaultPrimary;
                salesChart.data.datasets[0].backgroundColor = hexToRgba(defaultPrimary, 0.1);
                salesChart.update();
            }

            // E. Guardar en Base de Datos
            await saveCMSData();

            // F. Cerrar Modal y Mostrar Éxito
            resetModal.classList.remove('active');
        });
    }

    // --- CARGA INICIAL DE DATOS ---
    async function loadAllData() {
        console.log("Iniciando carga de datos del servidor...");
        try {
            await Promise.all([
                fetchCMS(),
                fetchProducts(),
                fetchOrders(),
                fetchUsers()
            ]);
            applyThemeToDashboard();
            fetchSalesStats()
            updateDashboardKPIs();
            renderCMSColors();

            populateCategorySelects();
            console.log("Datos cargados correctamente.");
        } catch (error) {
            console.error("Error crítico cargando datos:", error);
            alert("No se pudo conectar con el servidor (Backend). Asegúrate de que esté encendido en el puerto 3000.");
        }
    }

    // --- 1. CMS (CONFIGURACIÓN) ---
    async function fetchCMS() {
        try {
            const res = await fetch(`${API_URL}/cms`);
            if (res.ok) {
                const data = await res.json();

                // PARSEO SEGURO: Si falla el parseo, usamos un array/objeto vacío para no romper la web
                let parsedColors = {};
                let parsedCats = [];
                let parsedCarousel = [];

                try { parsedColors = typeof data.colors_json === 'string' ? JSON.parse(data.colors_json) : data.colors_json; } catch (e) { }
                try { parsedCats = typeof data.categories_json === 'string' ? JSON.parse(data.categories_json) : data.categories_json; } catch (e) { }
                try { parsedCarousel = typeof data.carousel_json === 'string' ? JSON.parse(data.carousel_json) : data.carousel_json; } catch (e) { }

                cmsData = {
                    // USAMOS store_name (igual que en BD)
                    store_name: data.store_name || "FarmaVida",
                    store_logo: data.store_logo || "",
                    currency_rate: data.currency_rate || 0,
                    hero: {
                        title: data.hero_title || "",
                        text: data.hero_text || "",
                        img: data.hero_img || "",
                        bg_img: data.hero_bg_img || ""
                    },
                    carousel_title: data.carousel_title || "Lo Más Vendido",
                    catalog_title: data.catalog_title || "Catálogo",
                    colors: parsedColors || {},
                    categories: parsedCats || [],
                    carousel: parsedCarousel || []
                };

                updateDashboardLogo(cmsData.store_name);
            }
        } catch (error) {
            console.error("Error cargando CMS:", error);
        }
    }

    // --- FUNCIÓN MAESTRA PARA GUARDAR (ACTUALIZADA) ---
    async function saveCMSData() {
        try {
            const finalLogo = storeLogoBase64 && storeLogoBase64 !== "" ? storeLogoBase64 : cmsData.store_logo;

            const payload = {
                store_name: cmsData.store_name,
                store_logo: finalLogo,
                currency_rate: cmsData.currency_rate, // <--- ¡ASEGÚRATE DE QUE ESTA LÍNEA ESTÉ AQUÍ!
                hero_title: cmsData.hero.title,
                hero_text: cmsData.hero.text,
                hero_img: cmsData.hero.img,
                hero_bg_img: cmsData.hero.bg_img,
                carousel_title: cmsData.carousel_title,
                catalog_title: cmsData.catalog_title,
                colors_json: JSON.stringify(cmsData.colors || {}),
                categories_json: JSON.stringify(cmsData.categories || []),
                carousel_json: JSON.stringify(cmsData.carousel || [])
            };
            console.log("Enviando datos al servidor:", payload); // Para depuración

            await authFetch(`${API_URL}/cms`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            // Opcional: Actualizar logo localmente por si cambió el nombre
            updateDashboardLogo(cmsData.store_name);

        } catch (error) {
            console.error("Error guardando CMS:", error);
            alert("Error al guardar configuración.");
        }
    }

    // --- 2. PRODUCTOS (CRUD) ---
    async function fetchProducts() {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();

        // Convertimos los nombres de la BD a lo que usa tu dashboard
        productsDB = data.map(p => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            stock: parseInt(p.stock),
            category: p.category,
            desc: p.description,
            img: p.img_url || "https://via.placeholder.com/150",
            has_discount: p.has_discount,
            discount_percent: p.discount_percent,
            discount_ends_at: p.discount_ends_at
        }));

        // Si la vista de productos está activa, refrescamos la tabla
        const prodSection = document.getElementById('view-products');
        if (prodSection && prodSection.style.display === 'block') {
            renderProducts(productsDB);
        }
    }

    // --- 3. PEDIDOS (READ & UPDATE) ---
    async function fetchOrders() {
        try {
            const res = await fetch(`${API_URL}/orders`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();

            ordersDB = data.map(o => {
                const d = new Date(o.created_at);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateFilterStr = `${year}-${month}-${day}`;

                return {
                    id: o.id,
                    client: o.user_name || "Cliente Desconocido",
                    email: o.user_email || "Sin correo",
                    phone: o.user_phone || "",
                    date: d.toLocaleDateString(),
                    dateFilter: dateFilterStr,
                    tracking: o.tracking_number || "Pendiente",
                    total: parseFloat(o.total),
                    status: o.status,
                    // NUEVO: Guardamos la tasa histórica
                    exchange_rate: parseFloat(o.exchange_rate_snapshot) || 0,
                    items: o.items || []
                };
            });

            const orderSection = document.getElementById('view-orders');
            if (orderSection && orderSection.style.display === 'block') {
                filterOrders();
            }

        } catch (error) {
            console.error("Error cargando pedidos:", error);
        }
    }

    // --- 4. USUARIOS (CRUD) ---
    async function fetchUsers() {
        try {
            const res = await fetch(`${API_URL}/users`);
            const data = await res.json();

            usersDB = data.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                status: u.status,
                img: u.img_url || "https://via.placeholder.com/40"
            }));

            // --- ESTA ES LA PARTE QUE FALTABA ---
            // Si la sección de usuarios está visible, repintamos la tabla automáticamente
            const userSection = document.getElementById('view-users');
            if (userSection && userSection.style.display === 'block') {
                // Usamos filterUsers() para mantener el filtro si estás buscando algo
                if (typeof filterUsers === 'function') {
                    filterUsers();
                } else {
                    renderUsers(usersDB);
                }
            }
            // ------------------------------------

        } catch (error) {
            console.error("Error cargando usuarios:", error);
        }
    }

    // INICIAR TODO
    loadAllData();


    // =========================================================
    //      LÓGICA DE INTERFAZ (UI) - IDÉNTICA A TU DISEÑO
    // =========================================================

    // --- NAVEGACIÓN SPA ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            sections.forEach(sec => sec.style.display = 'none');
            const targetSection = document.getElementById(targetId);
            const currencyWidget = document.getElementById('currency-widget');
            const currencyInput = document.getElementById('cms-currency-rate');
            if (targetSection) targetSection.style.display = 'block';

            if (targetId === 'view-dashboard') {
                pageTitle.innerText = "Resumen General";
                if (currencyWidget) currencyWidget.style.display = 'none'; // Ocultar
                updateDashboardKPIs();
            }
            if (targetId === 'view-products') {
                pageTitle.innerText = "Inventario de Productos";

                // --- MOSTRAR WIDGET Y PONER VALOR ---
                if (currencyWidget && currencyInput) {
                    currencyWidget.style.display = 'flex';
                    currencyInput.value = cmsData.currency_rate || "";
                }

                populateCategorySelects();
                renderProducts(productsDB);
            } else if (targetId !== 'view-products' && currencyWidget) {
                // Asegurar que se oculte en cualquier otra sección
                currencyWidget.style.display = 'none';
            }
            if (targetId === 'view-orders') {
                pageTitle.innerText = "Gestión de Pedidos";
                renderTable(ordersDB);
            }
            if (targetId === 'view-users') {
                pageTitle.innerText = "Usuarios Registrados";
                renderUsers(usersDB);
            }

            // CMS SECTIONS
            if (targetId === 'view-cms-hero') { pageTitle.innerText = "CMS > Hero Banner"; renderCMSHero(); }
            if (targetId === 'view-cms-carousel') { pageTitle.innerText = "CMS > Carrusel Destacado"; populateCategorySelects(); renderCMSCarousel(); }
            if (targetId === 'view-cms-categories') { pageTitle.innerText = "CMS > Categorías"; renderCMSCategories(); }
            if (targetId === 'view-cms-colors') { pageTitle.innerText = "CMS > Colores"; renderCMSColors(); }
        });
    });

    // --- KPI ---
    const LOW_STOCK_THRESHOLD = 15;
    function updateDashboardKPIs() {
        document.getElementById('total-products').innerText = productsDB.length;
        document.getElementById('low-stock').innerText = productsDB.filter(p => p.stock < LOW_STOCK_THRESHOLD).length;
        const totalInvest = productsDB.reduce((acc, p) => acc + (p.price * p.stock), 0);
        document.getElementById('total-investment').innerText = '$' + totalInvest.toLocaleString('en-US', { minimumFractionDigits: 2 });
    }

    // --- GRÁFICO DE VENTAS (CARGA DINÁMICA) ---
    const ctx = document.getElementById('salesChart').getContext('2d');
    let salesChart; // Variable para controlar el gráfico

    // Función para dibujar el gráfico con datos
    // Función para dibujar el gráfico con datos
    // Función para dibujar el gráfico con datos
    function initChart(dataValues) {
        if (salesChart) {
            salesChart.destroy();
        }

        // 1. LEER EL COLOR DE LA VARIABLE CSS
        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color').trim() || '#2D3A95';

        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: [{
                    label: 'Ventas Mensuales ($)',
                    data: dataValues,
                    // 2. USAR EL COLOR DINÁMICO
                    borderColor: primaryColor,
                    backgroundColor: hexToRgba(primaryColor, 0.1), // Usamos la herramienta nueva
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: function (value) { return '$' + value; } }
                    }
                }
            }
        });
    }

    // Inicializamos el gráfico en 0 mientras carga
    initChart(new Array(12).fill(0));

    // Función que pide los datos al Backend
    async function fetchSalesStats() {
        try {
            const res = await fetch(`${API_URL}/orders/stats`);
            if (res.ok) {
                const stats = await res.json();

                // Preparamos un array de 12 ceros (Ene-Dic)
                const monthlyTotals = new Array(12).fill(0);

                // Llenamos el array según los datos que llegaron
                stats.forEach(item => {
                    // item.month viene como '2026-01'. Extraemos el mes (01)
                    const monthIndex = parseInt(item.month.split('-')[1]) - 1; // Restamos 1 porque el array empieza en 0
                    if (monthIndex >= 0 && monthIndex < 12) {
                        monthlyTotals[monthIndex] = parseFloat(item.total);
                    }
                });

                // Actualizamos el gráfico
                initChart(monthlyTotals);
            }
        } catch (error) {
            console.error("Error cargando gráfico:", error);
        }
    }

    // --- HELPER: CATEGORÍAS ---
    const prodCatFilter = document.getElementById('prod-cat-filter');
    const prodCatInput = document.getElementById('prod-cat-input');
    // NUEVA REFERENCIA
    const cmsCarouselCatFilter = document.getElementById('cms-carousel-cat-filter');

    function populateCategorySelects() {
        // 1. Limpiar y preparar opciones base
        prodCatFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
        prodCatInput.innerHTML = '';

        if (cmsCarouselCatFilter) {
            cmsCarouselCatFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
        }

        // 2. Llenar con las categorías de cmsData
        cmsData.categories.forEach(cat => {
            // Para el filtro de productos
            const optFilter = document.createElement('option');
            optFilter.value = cat; optFilter.textContent = cat;
            prodCatFilter.appendChild(optFilter);

            // Para el input de crear producto
            const optInput = document.createElement('option');
            optInput.value = cat; optInput.textContent = cat;
            prodCatInput.appendChild(optInput);

            // NUEVO: Para el filtro del Carrusel
            if (cmsCarouselCatFilter) {
                const optCarousel = document.createElement('option');
                optCarousel.value = cat; optCarousel.textContent = cat;
                cmsCarouselCatFilter.appendChild(optCarousel);
            }
        });
    }

    // --- PRODUCTOS: RENDER ---
    const productsContainer = document.getElementById('products-list-container');
    const prodSearch = document.getElementById('prod-search');
    const prodStockFilter = document.getElementById('prod-stock-filter');
    const noProdMsg = document.getElementById('no-products-msg');

    // --- FUNCIÓN DE RENDERIZADO (CON LÓGICA VISUAL DE DESCUENTOS) ---
    // --- FUNCIÓN DE RENDERIZADO (CON LÓGICA VISUAL DE DESCUENTOS) ---
    // --- FUNCIÓN DE RENDERIZADO (CON LÓGICA VISUAL DE DESCUENTOS) ---
    function renderProducts(data) {
        productsContainer.innerHTML = '';

        if (!data || data.length === 0) {
            noProdMsg.style.display = 'block';
            return;
        }
        noProdMsg.style.display = 'none';

        const exchangeRate = parseFloat(cmsData.currency_rate) || 0;

        data.forEach(prod => {
            // Lógica de Stock
            let stockClass = prod.stock === 0 ? 'out' : (prod.stock < 15 ? 'low' : 'ok');
            let stockText = prod.stock === 0 ? `Agotado` : (prod.stock < 15 ? `Bajo Stock (${prod.stock})` : `Disponible (${prod.stock})`);

            // --- LÓGICA DE PRECIOS Y MATEMÁTICA ---
            const priceWithTax = parseFloat(prod.price); // Precio Base (con IVA incluido)
            let priceHTML = '';

            // 1. Verificamos si el descuento es válido (Activo = 1 Y Fecha Vencimiento > Ahora)
            const now = new Date();
            // Aseguramos que la fecha sea válida, si viene null usamos una fecha pasada
            const endDate = prod.discount_ends_at ? new Date(prod.discount_ends_at) : new Date(0);

            // Nota: En MySQL los booleanos suelen venir como 1 o 0
            const hasActiveDiscount = (prod.has_discount == 1) && (prod.discount_percent > 0) && (endDate > now);

            if (hasActiveDiscount) {
                // A. CALCULAR PRECIO CON DESCUENTO
                const discountAmount = priceWithTax * (prod.discount_percent / 100);
                const finalPrice = priceWithTax - discountAmount;

                // B. HTML DÓLARES (Tachado + Nuevo + Etiqueta %)
                priceHTML = `
                    <div style="line-height: 1.2;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="text-decoration: line-through; color: #999; font-size: 0.85rem;">$${priceWithTax.toFixed(2)}</span>
                            
                            <span style="background: #FFEBEE; color: var(--accent-color); font-size: 0.75rem; padding: 1px 5px; border-radius: 4px; font-weight:bold;">
                                -${prod.discount_percent}%
                            </span>
                        </div>
                        <div style="color: var(--accent-color); font-weight: bold; font-size: 1.2rem;">$${finalPrice.toFixed(2)}</div>
                    </div>
                `;

                // C. HTML BOLÍVARES (Tachado + Nuevo)
                if (exchangeRate > 0) {
                    const oldBs = (priceWithTax * exchangeRate).toFixed(2);
                    const newBs = (finalPrice * exchangeRate).toFixed(2);
                    priceHTML += `
                        <div style="font-size: 0.8rem; color: #666; margin-top: 4px; border-top: 1px dashed #eee; padding-top: 4px;">
                        <span style="color: #333; font-weight: 600;">Bs. ${newBs}</span>
                        <span style="text-decoration: line-through; font-size: 0.75rem; margin-right: 5px;">Bs. ${oldBs}</span>
                        </div>
                    `;
                }
            } else {
                // D. PRECIO NORMAL (Sin descuento o descuento vencido)
                priceHTML = `<div style="font-weight: bold; font-size: 1.1rem; color: var(--primary-color);">$${priceWithTax.toFixed(2)}</div>`;

                if (exchangeRate > 0) {
                    const priceBs = (priceWithTax * exchangeRate).toFixed(2);
                    priceHTML += `<div style="font-size: 0.85rem; color: #666;">Bs. ${priceBs}</div>`;
                }
            }
            // -----------------------------------------

            // Construir Tarjeta HTML
            const card = document.createElement('div');
            card.classList.add('admin-product-card');

            card.innerHTML = `
                <div class="prod-img-box">
                    <img src="${prod.img}" onerror="this.src='https://via.placeholder.com/150'">
                    ${hasActiveDiscount ? '<div style="position:absolute; top:8px; right:8px; background: var(--accent-color); color:white; font-size:0.7rem; padding:3px 8px; border-radius:4px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">OFERTA</div>' : ''}
                </div>
                <div class="prod-info">
                    <span class="category">${prod.category}</span>
                    <h4 style="margin: 5px 0;">${prod.name}</h4>
                    
                    <div class="price-container" style="margin: 8px 0; min-height: 55px; display:flex; flex-direction:column; justify-content:center;">
                        ${priceHTML}
                    </div>

                    <span class="stock-badge ${stockClass}">${stockText}</span>
                </div>
                <div class="prod-card-actions">
                    <button class="btn-edit-prod" onclick="openProductModal(${prod.id})">
                        <i class='bx bx-edit-alt'></i> Editar
                    </button>
                    <button class="btn-delete-prod" onclick="confirmDeleteProduct(${prod.id})">
                        <i class='bx bx-trash'></i> Borrar
                    </button>
                </div>
            `;
            productsContainer.appendChild(card);
        });
    }

    // --- LÓGICA DE FILTRADO MEJORADA (Con opción "Sin Stock") ---
    function filterProducts() {
        const term = prodSearch.value.toLowerCase();
        const cat = prodCatFilter.value;
        const stockMode = prodStockFilter.value;

        const filtered = productsDB.filter(p => {
            // 1. Filtro Texto
            const matchText = p.name.toLowerCase().includes(term);

            // 2. Filtro Categoría
            const matchCat = cat === 'all' || p.category === cat;

            // 3. Filtro Stock (LÓGICA ACTUALIZADA)
            let matchStock = true;
            if (stockMode === 'available') matchStock = p.stock >= 15;        // Verde: 15 o más
            if (stockMode === 'low') matchStock = p.stock > 0 && p.stock < 15; // Amarillo: Entre 1 y 14
            if (stockMode === 'out') matchStock = p.stock === 0;              // Rojo: Exactamente 0

            return matchText && matchCat && matchStock;
        });

        renderProducts(filtered);
    }

    // --- EVENTOS (LISTENERS) ---

    // 1. Buscador: Si escribes, reinicia los filtros para evitar confusión
    prodSearch.addEventListener('keyup', (e) => {
        if (e.target.value.trim().length > 0) {
            prodCatFilter.value = 'all';
            prodStockFilter.value = 'all';
        }
        filterProducts();
    });

    // 2. Selects: Al cambiar, ejecutan el filtro
    prodCatFilter.addEventListener('change', filterProducts);
    prodStockFilter.addEventListener('change', filterProducts);

    // --- PRODUCTOS: ELIMINAR ---
    const deleteModal = document.getElementById('delete-modal');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    let productToDeleteId = null;

    window.confirmDeleteProduct = function (id) {
        productToDeleteId = id;
        deleteModal.classList.add('active');
    };

    btnCancelDelete.addEventListener('click', () => { deleteModal.classList.remove('active'); });

    btnConfirmDelete.addEventListener('click', async () => {
        if (productToDeleteId !== null) {
            try {
                await authFetch(`${API_URL}/products/${productToDeleteId}`, { method: 'DELETE' });
                await fetchProducts();
                updateDashboardKPIs();
                deleteModal.classList.remove('active');
                successMsgElement.innerText = "Producto eliminado correctamente.";
                successModal.classList.add('active');
            } catch (error) {
                alert("Error eliminando producto");
            }
            productToDeleteId = null;
        }
    });

    // --- PRODUCTOS: AGREGAR/EDITAR ---
    const addModal = document.getElementById('add-product-modal');
    const closeAddModal = document.getElementById('close-add-modal');
    const btnOpenAdd = document.getElementById('btn-open-add-modal');
    const btnSaveProd = document.getElementById('btn-save-product');
    const modalTitle = document.getElementById('modal-product-title');

    const inputId = document.getElementById('prod-id-input');
    const inputName = document.getElementById('prod-name-input');
    const inputCat = document.getElementById('prod-cat-input');
    const inputPrice = document.getElementById('prod-price-input');
    const inputStock = document.getElementById('prod-stock-input');
    const inputDesc = document.getElementById('prod-desc-input');
    const inputImgFile = document.getElementById('prod-img-file');
    const uploadTrigger = document.getElementById('upload-trigger-zone');
    const imgPreview = document.getElementById('prod-img-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder-content');
    const inputDiscountCheck = document.getElementById('prod-discount-active');
    const inputDiscountPercent = document.getElementById('prod-discount-percent');
    const inputDiscountDuration = document.getElementById('prod-discount-duration');
    const discountSettingsDiv = document.getElementById('discount-settings');

    if (inputDiscountCheck) {
        inputDiscountCheck.addEventListener('change', (e) => {
            discountSettingsDiv.style.display = e.target.checked ? 'flex' : 'none';
        });
    }

    // --- BOTÓN GUARDAR (LÓGICA ACTUALIZADA) ---
    if (btnSaveProd) btnSaveProd.addEventListener('click', async (e) => {
        e.preventDefault();

        // 1. Validaciones básicas
        if (inputName.value.trim() === '' || inputPrice.value === '' || inputStock.value === '') {
            alert("Completa los campos obligatorios.");
            return;
        }

        let finalImage = existingImage || "https://via.placeholder.com/150";
        if (currentImageBase64 !== "") finalImage = currentImageBase64;

        // 2. Calcular Precio con IVA (16%)
        const basePrice = parseFloat(inputPrice.value);
        const priceWithTax = basePrice * 1.16;

        // 3. --- LÓGICA NUEVA: PREPARAR DATOS DEL DESCUENTO ---
        let isDiscount = inputDiscountCheck.checked ? 1 : 0; // Convertir true/false a 1/0 para la BD
        let discountPercent = isDiscount ? parseInt(inputDiscountPercent.value) : 0;
        let discountEndsAt = null;

        // Si hay descuento, calculamos la fecha de vencimiento
        // CÓDIGO NUEVO (SOLUCIÓN)
        if (isDiscount === 1 && discountPercent > 0) {
            const hours = parseInt(inputDiscountDuration.value); 
            
            // 1. Calculamos la fecha futura normal
            const targetDate = new Date(Date.now() + (hours * 60 * 60 * 1000));

            // 2. CORRECCIÓN DE ZONA HORARIA (VENEZUELA)
            // Obtenemos la diferencia en minutos entre tu PC y la hora UTC (Ej: 240 min)
            const offsetMs = targetDate.getTimezoneOffset() * 60000;
            
            // Creamos una nueva fecha restando esa diferencia para "engañar" al ISOString
            const localDate = new Date(targetDate.getTime() - offsetMs);

            // 3. Ahora .toISOString() nos dará la hora local exacta porque le restamos el offset
            discountEndsAt = localDate.toISOString().slice(0, 19).replace('T', ' ');

            console.log("Hora Local a guardar:", discountEndsAt); // Míralo en la consola (F12)
        } else {
            // ... (el resto del else queda igual)
            isDiscount = 0;
            discountPercent = 0;
            discountEndsAt = null;
        }
        // -----------------------------------------------------

        const id = inputId.value;

        // 4. CREAR EL OBJETO CON TODOS LOS DATOS (INCLUYENDO LOS NUEVOS)
        const newProdData = {
            name: inputName.value,
            category: inputCat.value,
            price: priceWithTax,
            stock: parseInt(inputStock.value),
            description: inputDesc.value,
            img: finalImage,

            // Aquí enviamos las nuevas columnas al Backend:
            has_discount: isDiscount,
            discount_percent: discountPercent,
            discount_ends_at: discountEndsAt
        };

        try {
            let url = `${API_URL}/products`;
            let method = 'POST';

            if (id) {
                url = `${API_URL}/products/${id}`;
                method = 'PUT';
            }

            // Enviamos la petición
            const res = await authFetch(url, {
                method: method,
                body: JSON.stringify(newProdData)
            });

            if (res && res.ok) {
                await fetchProducts();      // Recargar lista
                updateDashboardKPIs();      // Actualizar contadores
                addModal.classList.remove('active'); // Cerrar modal

                // Limpiar formulario manual (opcional, para que no quede basura)
                inputDiscountCheck.checked = false;
                inputDiscountPercent.value = '';
            } else {
                alert("Hubo un error en la respuesta del servidor.");
            }

        } catch (error) {
            console.error(error);
            alert("Error de conexión al guardar.");
        }
    });


    // --- LÓGICA VISUAL DEL IVA EN INPUT DE PRECIO ---
    if (inputPrice) {
        const taxHint = document.createElement('small');
        taxHint.id = 'prod-tax-hint'; // <--- AGREGAMOS UN ID PARA ENCONTRARLO LUEGO
        taxHint.style.color = '#666';
        taxHint.style.display = 'block';
        taxHint.style.marginTop = '5px';
        taxHint.style.fontWeight = '500';

        inputPrice.parentNode.appendChild(taxHint);

        inputPrice.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);

            // Validamos que sea un número Y que el campo no esté vacío (espacios en blanco)
            if (!isNaN(val) && inputPrice.value.trim() !== '') {
                const final = (val * 1.16).toFixed(2);
                taxHint.innerText = `Precio Final con IVA (16%): $${final}`;
                taxHint.style.color = '#2E7D32';
            } else {
                // Si el campo está vacío o no es un número, borramos el texto
                taxHint.innerText = '';
            }
        });
    }

    let currentImageBase64 = "";
    let existingImage = "";

    uploadTrigger.addEventListener('click', () => inputImgFile.click());

    inputImgFile.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                currentImageBase64 = event.target.result;
                imgPreview.src = currentImageBase64;
                imgPreview.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    });

    btnOpenAdd.addEventListener('click', () => {
        populateCategorySelects();
        
        // --- AGREGA ESTAS LÍNEAS AQUÍ ---
        // Buscamos el texto del IVA por su ID y lo vaciamos
        const taxHint = document.getElementById('prod-tax-hint');
        if (taxHint) taxHint.innerText = ''; 
        // --------------------------------

        inputId.value = '';
        inputName.value = '';
        inputPrice.value = '';
        inputStock.value = '';
        inputDesc.value = '';
        inputImgFile.value = '';
        currentImageBase64 = "";
        existingImage = "";
        imgPreview.src = "";
        imgPreview.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';

        if (inputDiscountCheck) {
            inputDiscountCheck.checked = false;
            discountSettingsDiv.style.display = 'none';
            inputDiscountPercent.value = '';
            inputDiscountDuration.value = '24';
        }

        modalTitle.innerText = "Nuevo Producto";
        addModal.classList.add('active');
    });

    // Variable auxiliar para recordar la fecha original al editar
    let editingDiscountDate = null;

    window.openProductModal = function (id) {
        populateCategorySelects();
        const prod = productsDB.find(p => p.id === id);
        if (!prod) return;

        inputId.value = prod.id;
        inputName.value = prod.name;
        inputCat.value = prod.category;

        // Precio SIN IVA
        inputPrice.value = (prod.price / 1.16).toFixed(2);

        inputStock.value = prod.stock;
        inputDesc.value = prod.desc || "";
        existingImage = prod.img;
        currentImageBase64 = "";
        inputImgFile.value = '';
        imgPreview.src = prod.img;
        imgPreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';

        // --- CARGAR DATOS DESCUENTO ---
        // Usamos comparación laxa (== 1) porque la BD puede devolver "1" string o 1 int
        const isActive = (prod.has_discount == 1);

        // Guardamos la fecha original en memoria
        editingDiscountDate = prod.discount_ends_at;

        if (inputDiscountCheck) {
            inputDiscountCheck.checked = isActive;

            // Mostrar/Ocultar div (validando que exista)
            if (discountSettingsDiv) discountSettingsDiv.style.display = isActive ? 'flex' : 'none';

            if (isActive) {
                inputDiscountPercent.value = prod.discount_percent;
                // Dejamos el select en 24h por defecto, pero al guardar usaremos lógica inteligente
                inputDiscountDuration.value = '24';
            } else {
                inputDiscountPercent.value = '';
            }
        }
        // ------------------------------

        modalTitle.innerText = "Editar Producto";
        addModal.classList.add('active');
    };

    closeAddModal.addEventListener('click', () => addModal.classList.remove('active'));

    // --- PEDIDOS (TABLA) ---
    const tableBody = document.getElementById('orders-table-body');
    const searchInput = document.getElementById('order-search');
    const dateInput = document.getElementById('order-date-filter');
    const clearDateBtn = document.getElementById('clear-date-btn');
    const noResultsMsg = document.getElementById('no-results');

    // --- FUNCIÓN RENDER TABLE ACTUALIZADA (Con colores en la Guía) ---
    function renderTable(data) {
        const tableBody = document.getElementById('orders-table-body');
        const noResultsMsg = document.getElementById('no-results');

        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            noResultsMsg.style.display = 'block';
            return;
        }
        noResultsMsg.style.display = 'none';

        data.forEach(order => {
            let trackingClass = order.status === 'Entregado' ? 'delivered' : 'pending';

            // --- CAMBIO: SOLO MOSTRAMOS DÓLARES ---
            // Eliminamos la lógica de cálculo de Bs. y el HTML extra.
            let priceDisplay = `$${order.total.toFixed(2)}`;
            // --------------------------------------

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="order-id-badge">#${order.id}</span></td>
                <td>
                    <div style="font-weight: 500;">${order.client}</div>
                    <div style="font-size: 0.8rem; color: #999;">${order.email || ''}</div>
                </td>
                <td>${order.date}</td>
                <td>
                    <span class="tracking-badge ${trackingClass}">
                        ${order.tracking || 'Pendiente'}
                    </span>
                </td>
                <td style="font-weight: 700;">${priceDisplay}</td>
                <td>
                    <button class="btn-view" onclick="openTrackingModal('${order.id}')">
                        <i class='bx bx-show'></i>
                    </button>
                </td>`;
            tableBody.appendChild(row);
        });
    }

    // --- REFERENCIA AL NUEVO SELECT ---
    const orderStatusFilter = document.getElementById('order-status-filter');

    // --- FUNCIÓN DE FILTRADO DE PEDIDOS ACTUALIZADA ---
    function filterOrders() {
        const searchTerm = searchInput.value.toLowerCase();
        const dateTerm = dateInput.value;
        const statusTerm = orderStatusFilter.value; // <--- Valor del nuevo select

        const filtered = ordersDB.filter(order => {
            // 1. Filtro Texto (Nombre o Guía)
            const matchText = (order.client || '').toLowerCase().includes(searchTerm) || (order.tracking || '').includes(searchTerm);

            // 2. Filtro Fecha
            const matchDate = dateTerm === '' || order.dateFilter === dateTerm;

            // 3. Filtro Estado (LÓGICA NUEVA)
            let matchStatus = true;
            if (statusTerm === 'pending') {
                // Muestra todo lo que NO sea "Entregado" (Pendiente, Enviado, etc.)
                matchStatus = order.status !== 'Entregado';
            }
            if (statusTerm === 'delivered') {
                // Muestra SOLO lo que sea "Entregado"
                matchStatus = order.status === 'Entregado';
            }

            return matchText && matchDate && matchStatus;
        });

        renderTable(filtered);
    }

    // 1. Buscador: Al escribir, limpiamos la FECHA pero RESPETAMOS el ESTADO
    searchInput.addEventListener('keyup', (e) => {
        if (e.target.value.trim().length > 0) {
            dateInput.value = '';  // Borramos la fecha (para buscar en todo el historial)
            // ELIMINAMOS LA LÍNEA QUE RESETEABA EL ESTADO
            // Así se mantiene el filtro "Por Entregar" o "Entregados" si estaba activo
        }
        filterOrders();
    });

    // 2. Selects e Inputs (Se mantienen igual)
    dateInput.addEventListener('change', filterOrders);
    orderStatusFilter.addEventListener('change', filterOrders);

    // 3. Botón Limpiar (Manual)
    clearDateBtn.addEventListener('click', () => {
        dateInput.value = '';
        filterOrders();
    });

    // --- USUARIOS (TABLA) ---
    const usersTableBody = document.getElementById('users-table-body');
    const userSearchInput = document.getElementById('user-search');
    const userRoleFilter = document.getElementById('user-role-filter');
    const noUsersMsg = document.getElementById('no-users-msg');

    // --- FUNCIÓN RENDER USERS MEJORADA ---
    // --- FUNCIÓN RENDER USERS CORREGIDA (Sin dañar los datos) ---
    function renderUsers(data) {
        usersTableBody.innerHTML = '';
        if (!data || data.length === 0) {
            noUsersMsg.style.display = 'block';
            return;
        }
        noUsersMsg.style.display = 'none';

        // 1. OBTENER ID DEL USUARIO ACTUAL
        const currentUserData = localStorage.getItem('user');
        const loggedUser = currentUserData ? JSON.parse(currentUserData) : null;

        // 2. ORDENAR: Mover al usuario logueado al principio (sin tocar los datos originales)
        const sortedData = [...data].sort((a, b) => {
            if (loggedUser && a.id === loggedUser.id) return -1;
            if (loggedUser && b.id === loggedUser.id) return 1;
            return 0;
        });

        sortedData.forEach(user => {
            const statusClass = user.status === 'active' ? 'active' : 'inactive';
            const statusText = user.status === 'active' ? 'Activo' : 'Inactivo';
            const row = document.createElement('tr');

            // --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
            // Creamos una variable TEMPORAL para visualizar, NO tocamos user.name
            let displayName = user.name;

            if (loggedUser && user.id === loggedUser.id) {
                row.classList.add('current-user-row');
                // Agregamos el (Tú) solo a esta variable visual, y en negrita
                displayName = `${user.name} <b style="color: #F57F17;">(Tú)</b>`;
            }

            row.innerHTML = `
                <td><span style="font-weight:600; color:#666;">#${user.id}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.img}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight: 500; color: var(--text-dark);">${displayName}</div>
                            <div style="font-size: 0.8rem; color: #999;">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge">${user.role}</span></td>
                <td>
                    <button class="btn-view" onclick="openUserModal(${user.id})">
                        <i class='bx bx-show'></i>
                    </button>
                </td>
            `;
            usersTableBody.appendChild(row);
        });
    }

    function filterUsers() {
        const term = userSearchInput.value.toLowerCase();
        const role = userRoleFilter.value;
        const filtered = usersDB.filter(user => {
            const matchText = user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
            const matchRole = role === 'all' || user.role === role;
            return matchText && matchRole;
        });
        renderUsers(filtered);
    }
    userSearchInput.addEventListener('keyup', filterUsers);
    userRoleFilter.addEventListener('change', filterUsers);

    // --- MODALES USUARIOS ---
    const userModal = document.getElementById('user-modal');
    const closeUserModal = document.getElementById('close-user-modal');
    const btnSaveUser = document.getElementById('btn-save-user');
    const btnDeleteUserTrigger = document.getElementById('btn-delete-user-trigger');
    const userDeleteModal = document.getElementById('delete-user-modal');
    const btnConfirmDeleteUser = document.getElementById('btn-confirm-delete-user');
    const btnCancelDeleteUser = document.getElementById('btn-cancel-delete-user');
    const btnOpenCreateUser = document.getElementById('btn-open-create-user');

    const userModalTitle = document.getElementById('user-modal-title');
    const userIdDisplay = document.getElementById('user-modal-id-display');
    const userIdInput = document.getElementById('user-id-input');
    const userNameInput = document.getElementById('user-name-input');
    const userEmailInput = document.getElementById('user-email-input');
    const userRoleInput = document.getElementById('user-role-input');
    const userPassInput = document.getElementById('user-pass-input');

    const userImgFile = document.getElementById('user-img-file');
    const userUploadTrigger = document.getElementById('user-upload-trigger');
    const userImgPreview = document.getElementById('user-img-preview');
    const userUploadPlaceholder = document.getElementById('user-upload-placeholder');
    let currentUserImageBase64 = "";
    let existingUserImage = "";
    let userToDeleteId = null;

    // --- VARIABLES DEL MODAL DE ADVERTENCIA ---
    const warningModal = document.getElementById('warning-modal');
    const warningMsgElement = document.getElementById('warning-message');
    const btnCloseWarning = document.getElementById('btn-close-warning');
    const userPassConfirmInput = document.getElementById('user-pass-confirm-input'); // Referencia al nuevo input

    // Función para mostrar la alerta igual que en la tienda
    function showWarningAlert(msg) {
        if (warningMsgElement) warningMsgElement.innerText = msg;
        if (warningModal) warningModal.classList.add('active');
    }

    // Cerrar la alerta
    if (btnCloseWarning) {
        btnCloseWarning.addEventListener('click', () => {
            warningModal.classList.remove('active');
        });
    }

    userUploadTrigger.addEventListener('click', () => userImgFile.click());
    userImgFile.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                currentUserImageBase64 = event.target.result;
                userImgPreview.src = currentUserImageBase64;
                userImgPreview.style.display = 'block';
                userUploadPlaceholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    });

    btnOpenCreateUser.addEventListener('click', () => {
        userRoleInput.disabled = false
        userIdInput.value = '';
        userIdDisplay.innerText = "ID: Nuevo";
        userModalTitle.innerText = "Nuevo Usuario";
        userNameInput.value = '';
        userEmailInput.value = '';
        userRoleInput.value = 'Cliente';
        userPassInput.value = '';
        userPassConfirmInput.value = '';
        userPassConfirmInput.value = '';
        existingUserImage = "https://via.placeholder.com/40";
        currentUserImageBase64 = "";
        userImgFile.value = '';
        userImgPreview.src = "";
        userImgPreview.style.display = 'none';
        userUploadPlaceholder.style.display = 'flex';
        btnDeleteUserTrigger.style.display = 'none';
        userModal.classList.add('active');
    });

    // --- ABRIR MODAL DE EDICIÓN (Protección Rol + Borrar) ---
    window.openUserModal = function (id) {
        const user = usersDB.find(u => u.id === id);
        if (!user) return;

        // Llenado de datos normal...
        userIdInput.value = user.id;
        userIdDisplay.innerText = "ID: #" + user.id;
        userModalTitle.innerText = "Editar Usuario";
        userNameInput.value = user.name;
        userEmailInput.value = user.email;
        userRoleInput.value = user.role;
        userPassInput.value = '';
        userPassConfirmInput.value = '';

        // Imagen...
        existingUserImage = user.img;
        currentUserImageBase64 = "";
        userImgFile.value = '';
        userImgPreview.src = user.img;
        userImgPreview.style.display = 'block';
        userUploadPlaceholder.style.display = 'none';

        // --- SEGURIDAD DE SESIÓN ---
        const currentUserData = localStorage.getItem('user');
        const loggedUser = currentUserData ? JSON.parse(currentUserData) : null;

        if (loggedUser && loggedUser.id === id) {
            // ES MI USUARIO:
            btnDeleteUserTrigger.style.display = 'none'; // 1. Ocultar botón borrar
            userRoleInput.disabled = true;               // 2. BLOQUEAR select de Rol
        } else {
            // ES OTRO USUARIO:
            btnDeleteUserTrigger.style.display = 'block';
            userRoleInput.disabled = false;              // Habilitar select de Rol
        }

        userModal.classList.add('active');
    };

    closeUserModal.addEventListener('click', () => userModal.classList.remove('active'));

    // --- GUARDAR USUARIO (CREAR O EDITAR) ---
    btnSaveUser.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = userIdInput.value;

        // 1. Validación de campos básicos
        if (userNameInput.value.trim() === '' || userEmailInput.value.trim() === '') {
            showWarningAlert('Por favor complete el nombre y el correo.');
            return;
        }

        // 2. VALIDACIÓN DE CONTRASEÑAS (IGUAL A LA TIENDA)
        const password = userPassInput.value;
        const confirmPassword = userPassConfirmInput.value;

        // Solo validamos si el usuario escribió una contraseña nueva
        if (password !== "") {
            if (password !== confirmPassword) {
                // AQUÍ USAMOS TU MODAL PERSONALIZADO
                showCustomAlert("Las contraseñas no coinciden.");
                return; // Detenemos el proceso para que no guarde
            }
            if (password.length < 6) {
                showCustomAlert("La contraseña debe tener al menos 6 caracteres.");
                return;
            }
        }

        // Manejo de imagen
        let finalImage = existingUserImage;
        if (currentUserImageBase64 !== "") finalImage = currentUserImageBase64;

        // Preparamos los datos
        const userData = {
            name: userNameInput.value,
            email: userEmailInput.value,
            role: userRoleInput.value,
            status: 'active',
            password: password,
            img_url: finalImage
        };

        try {
            let url = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;
            let method = id ? 'PUT' : 'POST';

            await authFetch(url, {
                method: method,
                body: JSON.stringify(userData)
            });

            await fetchUsers();
            userModal.classList.remove('active');

            // Usamos el modal de éxito existente
            successMsgElement.innerText = "Usuario guardado correctamente.";
            successModal.classList.add('active');

        } catch (error) {
            console.error(error);
            showWarningAlert("Error al conectar con el servidor.");
        }
    });

    btnDeleteUserTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const id = userIdInput.value;
        if (id) {
            userToDeleteId = id;
            userDeleteModal.classList.add('active');
        }
    });

    btnCancelDeleteUser.addEventListener('click', () => {
        userDeleteModal.classList.remove('active');
        userToDeleteId = null;
    });

    btnConfirmDeleteUser.addEventListener('click', async () => {
        if (userToDeleteId) {
            try {
                await authFetch(`${API_URL}/users/${userToDeleteId}`, {
                    method: 'DELETE'
                });
                await fetchUsers();
                userDeleteModal.classList.remove('active');
                userModal.classList.remove('active');
                successMsgElement.innerText = "Usuario eliminado correctamente.";
                successModal.classList.add('active');
            } catch (error) {
                alert("Error eliminando usuario");
            }
            userToDeleteId = null;
        }
    });

    // ==========================================
    //  CMS LOGIC (Identidad y Hero Banner)
    // ==========================================

    // 1. DEFINICIÓN DE VARIABLES (IMPORTANTE: Deben estar aquí arriba)
    let heroImageBase64 = ""; // Variable para imagen derecha
    let heroBgBase64 = "";    // Variable para imagen fondo <--- ESTA FALTABA O ESTABA MAL UBICADA
    let storeLogoBase64 = "";

    // 2. REFERENCIAS A INPUTS
    const storeNameInput = document.getElementById('cms-store-name');

    // NUEVAS REFERENCIAS PARA EL LOGO
    const logoPreview = document.getElementById('logo-preview');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const logoFile = document.getElementById('logo-file');
    const logoUploadTrigger = document.getElementById('logo-upload-trigger');
    const btnDeleteLogo = document.getElementById('btn-delete-logo');

    const carouselTitleInput = document.getElementById('cms-carousel-title');
    const catalogTitleInput = document.getElementById('cms-catalog-title');
    const heroTitleInput = document.getElementById('cms-hero-title');
    const heroTextInput = document.getElementById('cms-hero-text');

    // Referencias DOM Imagen Derecha
    const heroImgPreview = document.getElementById('hero-img-preview');
    const heroUploadPlaceholder = document.getElementById('hero-upload-placeholder');
    const heroImgFile = document.getElementById('hero-img-file');
    const heroUploadTrigger = document.getElementById('hero-upload-trigger');

    // Referencias DOM Imagen Fondo
    const heroBgPreview = document.getElementById('hero-bg-preview');
    const heroBgPlaceholder = document.getElementById('hero-bg-placeholder');
    const heroBgFile = document.getElementById('hero-bg-file');
    const heroBgTrigger = document.getElementById('hero-bg-trigger');

    // Referecnia Boton de Reset Imagenes
    const btnDeleteHeroImg = document.getElementById('btn-delete-hero-img');
    const btnDeleteHeroBg = document.getElementById('btn-delete-hero-bg');

    // 3. FUNCIÓN PARA PINTAR DATOS EN LOS INPUTS
    function renderCMSHero() {
        // Textos
        if (storeNameInput) storeNameInput.value = cmsData.store_name || "";
        if (carouselTitleInput) carouselTitleInput.value = cmsData.carousel_title || "";
        if (catalogTitleInput) catalogTitleInput.value = cmsData.catalog_title || "";
        if (heroTitleInput) heroTitleInput.value = cmsData.hero.title || "";
        if (heroTextInput) heroTextInput.value = cmsData.hero.text || "";

        const currentLogo = storeLogoBase64 || cmsData.store_logo;
        if (currentLogo && currentLogo.trim() !== "") {
            logoPreview.src = currentLogo;
            logoPreview.style.display = 'block';
            logoPlaceholder.style.display = 'none';
            if (btnDeleteLogo) btnDeleteLogo.style.display = 'block';
        } else {
            logoPreview.style.display = 'none';
            logoPreview.src = "";
            logoPlaceholder.style.display = 'flex';
            if (btnDeleteLogo) btnDeleteLogo.style.display = 'none';
        }

        // --- IMAGEN DERECHA ---
        // Verificamos si hay imagen (ya sea en memoria cmsData o en la variable temporal heroImageBase64)
        const currentHeroImg = heroImageBase64 || cmsData.hero.img;

        if (currentHeroImg && currentHeroImg.trim() !== "") {
            heroImgPreview.src = currentHeroImg;
            heroImgPreview.style.display = 'block';
            heroUploadPlaceholder.style.display = 'none';
            // Mostrar botón eliminar
            if (btnDeleteHeroImg) btnDeleteHeroImg.style.display = 'block';
        } else {
            // Reset visual
            heroImgPreview.style.display = 'none';
            heroImgPreview.src = "";
            heroUploadPlaceholder.style.display = 'flex';
            // Ocultar botón eliminar
            if (btnDeleteHeroImg) btnDeleteHeroImg.style.display = 'none';
        }

        // --- IMAGEN FONDO ---
        const currentHeroBg = heroBgBase64 || cmsData.hero.bg_img;

        if (currentHeroBg && currentHeroBg.trim() !== "") {
            heroBgPreview.src = currentHeroBg;
            heroBgPreview.style.display = 'block';
            heroBgPlaceholder.style.display = 'none';
            // Mostrar botón eliminar
            if (btnDeleteHeroBg) btnDeleteHeroBg.style.display = 'block';
        } else {
            // Reset visual
            heroBgPreview.style.display = 'none';
            heroBgPreview.src = "";
            heroBgPlaceholder.style.display = 'flex';
            // Ocultar botón eliminar
            if (btnDeleteHeroBg) btnDeleteHeroBg.style.display = 'none';
        }
    }

    // 4. EVENTOS DE UPLOAD (Subir archivos)

    // A. Imagen Derecha
    if (heroUploadTrigger) {
        heroUploadTrigger.addEventListener('click', () => heroImgFile.click());
    }
    if (heroImgFile) {
        heroImgFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    heroImageBase64 = event.target.result; // Actualizamos variable
                    heroImgPreview.src = heroImageBase64;
                    heroImgPreview.style.display = 'block';
                    heroUploadPlaceholder.style.display = 'none';
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // B. Imagen Fondo
    if (heroBgTrigger) {
        heroBgTrigger.addEventListener('click', () => heroBgFile.click());
    }
    if (heroBgFile) {
        heroBgFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    heroBgBase64 = event.target.result; // Actualizamos variable
                    heroBgPreview.src = heroBgBase64;
                    heroBgPreview.style.display = 'block';
                    heroBgPlaceholder.style.display = 'none';
                }
                reader.readAsDataURL(file);
            }
        });
    }


    // A. LÓGICA DE SUBIDA DEL LOGO
    if (logoUploadTrigger) {
        logoUploadTrigger.addEventListener('click', () => logoFile.click());
    }
    if (logoFile) {
        logoFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    storeLogoBase64 = event.target.result; // Actualizamos variable temporal
                    logoPreview.src = storeLogoBase64;
                    logoPreview.style.display = 'block';
                    logoPlaceholder.style.display = 'none';
                    if (btnDeleteLogo) btnDeleteLogo.style.display = 'block'; // Mostrar borrar
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // B. LÓGICA PARA BORRAR EL LOGO (Usa tu modal existente)
    if (btnDeleteLogo) {
        btnDeleteLogo.addEventListener('click', (e) => {
            e.preventDefault();
            heroImageTypeToDelete = 'logo'; // Usamos una nueva clave 'logo'
            if (deleteHeroModal) deleteHeroModal.classList.add('active');
        });
    }

    const deleteHeroModal = document.getElementById('delete-hero-modal');
    const btnCancelDeleteHero = document.getElementById('btn-cancel-delete-hero');
    const btnConfirmDeleteHero = document.getElementById('btn-confirm-delete-hero');

    // Variable temporal para recordar qué estamos borrando ('main' o 'bg')
    let heroImageTypeToDelete = null;

    // 2. Al hacer clic en "Eliminar" (Imagen Principal) -> ABRIR MODAL
    if (btnDeleteHeroImg) {
        btnDeleteHeroImg.addEventListener('click', (e) => {
            e.preventDefault();
            heroImageTypeToDelete = 'main'; // Marcamos: queremos borrar la principal
            if (deleteHeroModal) deleteHeroModal.classList.add('active'); // Mostrar modal
        });
    }

    // 3. Al hacer clic en "Eliminar" (Fondo) -> ABRIR MODAL
    if (btnDeleteHeroBg) {
        btnDeleteHeroBg.addEventListener('click', (e) => {
            e.preventDefault();
            heroImageTypeToDelete = 'bg'; // Marcamos: queremos borrar el fondo
            if (deleteHeroModal) deleteHeroModal.classList.add('active'); // Mostrar modal
        });
    }

    // 4. Botón "Cancelar" del modal -> CERRAR SIN HACER NADA
    if (btnCancelDeleteHero) {
        btnCancelDeleteHero.addEventListener('click', () => {
            if (deleteHeroModal) deleteHeroModal.classList.remove('active');
            heroImageTypeToDelete = null; // Limpiar memoria
        });
    }

    // 5. Botón "Sí, Quitar" del modal -> EJECUTAR BORRADO
    if (btnConfirmDeleteHero) {
        btnConfirmDeleteHero.addEventListener('click', () => {

            if (heroImageTypeToDelete === 'main') {
                // --- BORRAR IMAGEN PRINCIPAL ---
                cmsData.hero.img = "";
                heroImageBase64 = "";
                if (heroImgFile) heroImgFile.value = "";

            } else if (heroImageTypeToDelete === 'bg') {
                // --- BORRAR IMAGEN DE FONDO ---
                cmsData.hero.bg_img = "";
                heroBgBase64 = "";
                if (heroBgFile) heroBgFile.value = "";
            } else if (heroImageTypeToDelete === 'logo') {
                // --- NUEVO CASO: BORRAR LOGO ---
                cmsData.store_logo = "";    // Borrar de memoria
                storeLogoBase64 = "";       // Borrar temporal
                if (logoFile) logoFile.value = ""; // Limpiar input
            }

            // Actualizar la vista y cerrar el modal
            renderCMSHero();
            if (deleteHeroModal) deleteHeroModal.classList.remove('active');
            heroImageTypeToDelete = null;
        });
    }

    // Cerrar modal al hacer clic en el fondo oscuro
    if (deleteHeroModal) {
        deleteHeroModal.addEventListener('click', (e) => {
            if (e.target === deleteHeroModal) {
                deleteHeroModal.classList.remove('active');
                heroImageTypeToDelete = null;
            }
        });
    }

    // 5. BOTÓN GUARDAR TODO
    const btnSaveHero = document.getElementById('btn-save-hero');
    if (btnSaveHero) {
        btnSaveHero.addEventListener('click', async () => {
            // 1. Actualizamos la memoria (cmsData) con lo que hay en los inputs
            cmsData.store_name = storeNameInput.value;
            cmsData.carousel_title = carouselTitleInput.value;
            cmsData.catalog_title = catalogTitleInput.value;
            cmsData.hero.title = heroTitleInput.value;
            cmsData.hero.text = heroTextInput.value;

            // Solo actualizamos imágenes si hay nuevas o ya existían
            if (heroImageBase64) cmsData.hero.img = heroImageBase64;
            if (heroBgBase64) cmsData.hero.bg_img = heroBgBase64;
            if (storeLogoBase64) cmsData.store_logo = storeLogoBase64;

            // 2. Llamamos a la función maestra para guardar TODO
            await saveCMSData();

            successMsgElement.innerText = "Identidad y Hero Banner actualizados.";
            successModal.classList.add('active');
        });
    }

    // Función auxiliar para logo
    function updateDashboardLogo(name) {
        const logoLink = document.querySelector('.sidebar-header .logo'); // Selector ajustado
        if (!logoLink) return;

        // Si hay un logo gráfico en memoria, lo mostramos
        const logoUrl = storeLogoBase64 || cmsData.store_logo;

        if (logoUrl && logoUrl.trim() !== "") {
            // Modo Imagen + Texto
            const half = Math.ceil(name.length / 2);
            const part1 = name.slice(0, half);
            const part2 = name.slice(half);

            // Insertamos imagen antes del texto
            logoLink.innerHTML = `
                <img src="${logoUrl}" style="height: 35px; width: auto; margin-right: 8px; vertical-align: middle;">
                ${part1}<span>${part2}</span><span class="dot">.</span>
            `;
        } else {
            // Modo Solo Texto (Tu código anterior)
            const half = Math.ceil(name.length / 2);
            const part1 = name.slice(0, half);
            const part2 = name.slice(half);
            logoLink.innerHTML = `${part1}<span>${part2}</span><span class="dot">.</span>`;
        }
    }

    // 2. CAROUSEL
    // =========================================================
    //      2. LÓGICA DEL CARRUSEL (CON BUSCADOR Y MEMORIA)
    // =========================================================

    const cmsCarouselSearch = document.getElementById('cms-carousel-search');

    // Función de renderizado que acepta un filtro de texto
    // Función de renderizado actualizada con doble filtro
    // Función de renderizado del Carrusel (Con lógica inteligente de "Todos")
    function renderCMSCarousel() {
        const tbody = document.getElementById('cms-carousel-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // 1. Obtener valores de los filtros
        const searchTerm = cmsCarouselSearch ? cmsCarouselSearch.value.toLowerCase() : '';
        const catFilter = cmsCarouselCatFilter ? cmsCarouselCatFilter.value : 'all';

        // 2. Filtrar productos
        const filteredProducts = productsDB.filter(prod => {
            const matchText = prod.name.toLowerCase().includes(searchTerm) ||
                prod.category.toLowerCase().includes(searchTerm);
            const matchCat = catFilter === 'all' || prod.category === catFilter;
            return matchText && matchCat;
        });

        // --- NUEVA FUNCIÓN AUXILIAR ---
        // Verifica si todos los checkboxes visibles están marcados y actualiza el maestro
        const updateMasterCheckboxState = () => {
            const masterCheck = document.getElementById('cms-carousel-select-all');
            const allVisibleChecks = tbody.querySelectorAll('.carousel-check');

            if (masterCheck) {
                if (allVisibleChecks.length > 0) {
                    // Si TODOS los visibles están checked, marcamos el maestro. Si falta uno, lo desmarcamos.
                    const allChecked = Array.from(allVisibleChecks).every(input => input.checked);
                    masterCheck.checked = allChecked;
                } else {
                    masterCheck.checked = false;
                }
            }
        };
        // ------------------------------

        filteredProducts.forEach(prod => {
            if (!Array.isArray(cmsData.carousel)) cmsData.carousel = [];

            const isChecked = cmsData.carousel.includes(prod.id) ? 'checked' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${prod.img}" style="width:30px; height:30px; object-fit:contain;">
                        <span>${prod.name}</span>
                    </div>
                </td>
                <td>${prod.category}</td>
                <td style="text-align: center;">
                    <input type="checkbox" class="carousel-check" value="${prod.id}" ${isChecked} style="width:18px; height:18px; cursor:pointer;">
                </td>
            `;

            // Evento individual
            const checkbox = tr.querySelector('.carousel-check');
            checkbox.addEventListener('change', (e) => {
                const id = parseInt(e.target.value);

                // Actualizar memoria
                if (e.target.checked) {
                    if (!cmsData.carousel.includes(id)) cmsData.carousel.push(id);
                } else {
                    cmsData.carousel = cmsData.carousel.filter(itemId => itemId !== id);
                }

                // --- NUEVO: Al cambiar uno individual, verificamos el estado del maestro ---
                updateMasterCheckboxState();
            });

            tbody.appendChild(tr);
        });

        if (filteredProducts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #999;">No se encontraron productos.</td></tr>';
        }

        // --- NUEVO: Verificar estado inicial al cargar o filtrar ---
        // (Por si filtraste una categoría donde YA tenías todos seleccionados)
        updateMasterCheckboxState();
    }

    const carouselSelectAll = document.getElementById('cms-carousel-select-all');

    if (carouselSelectAll) {
        carouselSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;

            // 1. Averiguamos qué productos se están viendo actualmente (respetando filtros)
            const searchTerm = cmsCarouselSearch ? cmsCarouselSearch.value.toLowerCase() : '';
            const catFilter = cmsCarouselCatFilter ? cmsCarouselCatFilter.value : 'all';

            const visibleProducts = productsDB.filter(prod => {
                const matchText = prod.name.toLowerCase().includes(searchTerm) ||
                    prod.category.toLowerCase().includes(searchTerm);
                const matchCat = catFilter === 'all' || prod.category === catFilter;
                return matchText && matchCat;
            });

            // 2. Actualizamos la memoria (cmsData.carousel)
            if (!Array.isArray(cmsData.carousel)) cmsData.carousel = [];

            visibleProducts.forEach(prod => {
                if (isChecked) {
                    // MODO MARCAR: Si no está en la lista, lo agregamos
                    if (!cmsData.carousel.includes(prod.id)) {
                        cmsData.carousel.push(prod.id);
                    }
                } else {
                    // MODO DESMARCAR: Lo sacamos de la lista
                    cmsData.carousel = cmsData.carousel.filter(id => id !== prod.id);
                }
            });

            // 3. Volvemos a pintar la tabla para ver los cambios visualmente
            renderCMSCarousel();

            // Truco visual: Mantener el checkbox maestro marcado si acabamos de marcar todo
            // (renderCMSCarousel podría resetearlo visualmente, así que lo forzamos aquí)
            carouselSelectAll.checked = isChecked;
        });
    }

    // --- EVENTO DEL BUSCADOR ---
    if (cmsCarouselSearch) {
        cmsCarouselSearch.addEventListener('keyup', (e) => {
            renderCMSCarousel(e.target.value);
        });
    }

    if (cmsCarouselCatFilter) {
        cmsCarouselCatFilter.addEventListener('change', () => {
            renderCMSCarousel();
        });
    }

    // --- BOTÓN GUARDAR (CORREGIDO) ---
    const btnSaveCarousel = document.getElementById('btn-save-carousel');
    if (btnSaveCarousel) {
        btnSaveCarousel.addEventListener('click', async () => {

            // ¡IMPORTANTE! 
            // Ya NO usamos 'querySelectorAll' aquí. 
            // Confiamos en 'cmsData.carousel' que ya se actualizó automáticamente arriba.

            await saveCMSData();

            successMsgElement.innerText = "Carrusel de productos actualizado correctamente.";
            successModal.classList.add('active');
        });
    }

    // 3. CATEGORIES
    function renderCMSCategories() {
        const list = document.getElementById('cms-categories-list');
        list.innerHTML = '';
        cmsData.categories.forEach(cat => {
            const div = document.createElement('div');
            div.classList.add('cat-item');
            div.innerHTML = `
                <span class="cat-name">${cat}</span>
                <button class="btn-del-cat" onclick="deleteCMSCategory('${cat}')"><i class='bx bx-trash'></i></button>
            `;
            list.appendChild(div);
        });
    }

    document.getElementById('btn-add-cat').addEventListener('click', async () => {
        const input = document.getElementById('new-cat-input');
        const val = input.value.trim();
        if (val && !cmsData.categories.includes(val)) {
            cmsData.categories.push(val);
            await saveCMSData();
            input.value = '';
            renderCMSCategories();
            populateCategorySelects();
        }
    });

    window.deleteCMSCategory = async function (cat) {
        if (confirm(`¿Eliminar la categoría "${cat}"?`)) {
            cmsData.categories = cmsData.categories.filter(c => c !== cat);
            await saveCMSData();
            renderCMSCategories();
            populateCategorySelects();
        }
    };

    // ==========================================
    //  4. GESTIÓN DE COLORES (CORREGIDO)
    // ==========================================
    function renderCMSColors() {
        const container = document.getElementById('dynamic-colors-container');

        // PROTECCIÓN: Si no encuentra el div en el HTML, no hace nada (evita el error)
        if (!container) {
            console.error("Error: No se encontró el div 'dynamic-colors-container' en el HTML.");
            return;
        }

        container.innerHTML = ''; // Limpiar contenido previo
        const currentColors = cmsData.colors || {};

        THEME_VARIABLES.forEach(variable => {
            // Usamos el color guardado o el default
            const value = currentColors[variable.key] || variable.default;

            const div = document.createElement('div');
            div.className = 'color-picker-group';
            div.innerHTML = `
                <label style="display:block; margin-bottom:5px; font-size:0.8rem;">${variable.label}</label>
                <div class="picker-wrapper" style="display:flex; align-items:center; gap:10px; justify-content:center;">
                    <input type="color" class="theme-color-input" 
                        data-var="${variable.key}" 
                        value="${value}" 
                        style="width:50px; height:50px; cursor:pointer; border:none; background:none;">
                    <span class="hex-code" style="font-family:monospace;">${value}</span>
                </div>
            `;
            container.appendChild(div);
        });

        // Eventos para Vista Previa en Tiempo Real
        const inputs = container.querySelectorAll('.theme-color-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const varName = e.target.getAttribute('data-var');
                const newVal = e.target.value;

                // 1. Actualizar texto HEX y CSS Variable
                e.target.nextElementSibling.innerText = newVal;
                document.documentElement.style.setProperty(varName, newVal);

                // 2. --- NUEVO: ACTUALIZAR GRÁFICO EN VIVO ---
                // Si cambiamos el 'Primary Color' y el gráfico existe...
                if (varName === '--primary-color' && typeof salesChart !== 'undefined') {
                    salesChart.data.datasets[0].borderColor = newVal;
                    salesChart.data.datasets[0].backgroundColor = hexToRgba(newVal, 0.1);
                    salesChart.update(); // ¡Repintar gráfico!
                }
            });
        });
    }

    // --- EVENTO GUARDAR ---
    const btnSaveColors = document.getElementById('btn-save-colors');
    const saveSuccessModal = document.getElementById('save-success-modal');
    const btnCloseSaveModal = document.getElementById('btn-close-save-modal');

    // Lógica del botón "Guardar Tema"
    if (btnSaveColors) {
        btnSaveColors.addEventListener('click', async () => {
            // 1. Recopilar colores de los inputs
            const inputs = document.querySelectorAll('.theme-color-input');
            const newColors = {};
            inputs.forEach(input => {
                newColors[input.getAttribute('data-var')] = input.value;
            });

            // 2. Actualizar memoria
            cmsData.colors = newColors;

            // 3. Guardar usando la función maestra
            await saveCMSData();

            if (saveSuccessModal) saveSuccessModal.classList.add('active');
        });
    }

    // Lógica para cerrar el modal de éxito
    if (btnCloseSaveModal) {
        btnCloseSaveModal.addEventListener('click', () => {
            if (saveSuccessModal) {
                saveSuccessModal.classList.remove('active');
            }
        });
    }

    // --- MODALES COMPARTIDOS ---
    const trackModal = document.getElementById('tracking-modal-overlay');
    const closeTrackModal = document.getElementById('close-tracking-modal');
    const btnComplete = document.getElementById('btn-complete-order');
    const completeOrderModal = document.getElementById('complete-order-modal');
    const btnConfirmComplete = document.getElementById('btn-confirm-complete');
    const btnCancelComplete = document.getElementById('btn-cancel-complete');
    const successModal = document.getElementById('success-modal');
    const btnCloseSuccess = document.getElementById('btn-close-success');
    const successMsgElement = document.getElementById('success-message');
    let orderIdToComplete = null;

    // --- NUEVA ALERTA PERSONALIZADA (ESTILO TIENDA) ---
    const customAlert = document.getElementById('custom-alert');
    const customAlertMsg = document.getElementById('custom-alert-message');
    const btnCloseAlert = document.getElementById('btn-close-alert');

    function showCustomAlert(msg) {
        if (customAlert && customAlertMsg) {
            customAlertMsg.innerText = msg;
            customAlert.classList.add('active');
        } else {
            alert(msg); // Fallback por seguridad
        }
    }

    if (btnCloseAlert) {
        btnCloseAlert.addEventListener('click', () => {
            customAlert.classList.remove('active');
        });
    }

    // Cerrar al hacer clic fuera de la cajita (opcional)
    if (customAlert) {
        customAlert.addEventListener('click', (e) => {
            if (e.target === customAlert) customAlert.classList.remove('active');
        });
    }

    window.openTrackingModal = function (orderId) {
        // Nota: == permite comparar string con int por si acaso
        const order = ordersDB.find(o => o.id == orderId);
        if (!order) return;

        document.getElementById('tm-tracking-id').innerText = order.tracking || "PENDIENTE";
        document.getElementById('tm-user-name').innerText = order.client;
        document.getElementById('tm-user-email').innerText = order.email;
        document.getElementById('tm-user-phone').innerText = order.phone;

        const adminRateBox = document.getElementById('tm-rate-box');
        const adminRateValue = document.getElementById('tm-rate-value');

        if (order.exchange_rate > 0) {
            adminRateValue.innerText = `Bs. ${order.exchange_rate.toFixed(2)}`;
            adminRateBox.style.display = 'block';
        } else {
            adminRateBox.style.display = 'none';
        }

        // Mostrar Total en el Modal con conversión histórica
        const totalEl = document.getElementById('tm-total-price');
        let totalHTML = '$' + order.total.toFixed(2);

        if (order.exchange_rate > 0) {
            const totalBs = (order.total * order.exchange_rate).toFixed(2);
            totalHTML += ` <span style="font-size: 0.9rem; color: var(--text-dark);">(Bs. ${totalBs})</span>`;
        }
        totalEl.innerHTML = totalHTML;

        const listContainer = document.getElementById('tm-products-list');
        listContainer.innerHTML = '';

        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('tracking-item');
                div.innerHTML = `<span><strong>${item.quantity}x</strong>  ${item.name}</span><span>$${parseFloat(item.price).toFixed(2)}</span>`;
                listContainer.appendChild(div);
            });
        } else {
            listContainer.innerHTML = '<div style="color:#999; font-style:italic;">Sin detalles disponibles</div>';
        }

        const trackModal = document.getElementById('tracking-modal-overlay');
        const btnComplete = document.getElementById('btn-complete-order');

        trackModal.classList.add('active');
        btnComplete.setAttribute('data-current-order', orderId);

        if (order.status === 'Entregado') btnComplete.style.display = 'none';
        else btnComplete.style.display = 'flex';
    };

    closeTrackModal.addEventListener('click', () => trackModal.classList.remove('active'));
    trackModal.addEventListener('click', (e) => { if (e.target === trackModal) trackModal.classList.remove('active'); });

    btnComplete.addEventListener('click', () => {
        orderIdToComplete = btnComplete.getAttribute('data-current-order');
        completeOrderModal.classList.add('active');
    });

    btnCancelComplete.addEventListener('click', () => {
        completeOrderModal.classList.remove('active');
        orderIdToComplete = null;
    });

    btnConfirmComplete.addEventListener('click', async () => {
        if (orderIdToComplete) {
            try {
                // Actualizar estado en Backend
                await authFetch(`${API_URL}/orders/${orderIdToComplete}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'Entregado' })
                });

                await fetchOrders(); // Recargar tabla
                completeOrderModal.classList.remove('active');
                trackModal.classList.remove('active');
                successMsgElement.innerText = `La orden #${orderIdToComplete} ha sido entregada.`;
                successModal.classList.add('active');
            } catch (error) {
                alert("Error actualizando orden");
            }
            orderIdToComplete = null;
        }
    });

    btnCloseSuccess.addEventListener('click', () => {
        successModal.classList.remove('active');
    });

    completeOrderModal.addEventListener('click', (e) => { if (e.target === completeOrderModal) completeOrderModal.classList.remove('active'); });
    successModal.addEventListener('click', (e) => { if (e.target === successModal) successModal.classList.remove('active'); });

    // --- LÓGICA DE CERRAR SESIÓN (ADMIN) ---
    // --- LÓGICA DE CERRAR SESIÓN (MODAL ESTÉTICO) ---
    const btnAdminLogout = document.getElementById('btn-admin-logout');
    const logoutModal = document.getElementById('logout-modal');
    const btnCancelLogout = document.getElementById('btn-cancel-logout');
    const btnConfirmLogout = document.getElementById('btn-confirm-logout');

    if (btnAdminLogout) {
        btnAdminLogout.addEventListener('click', (e) => {
            e.preventDefault();
            // Abrimos el modal agregando la clase 'active'
            // (Esta clase ya está definida en tu CSS para mostrar los overlays)
            if (logoutModal) logoutModal.classList.add('active');
        });
    }

    // Botón Cancelar
    if (btnCancelLogout) {
        btnCancelLogout.addEventListener('click', () => {
            if (logoutModal) logoutModal.classList.remove('active');
        });
    }

    // Botón Confirmar Salida
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', () => {
            // 1. Borrar sesión
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // 2. Redirigir
            window.location.href = 'login.html';
        });
    }

    // Cerrar al hacer clic fuera del modal (Opcional, misma lógica que tus otros modales)
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target === logoutModal) logoutModal.classList.remove('active');
        });
    }


    // --- HERRAMIENTA AUXILIAR: Convertir HEX a RGBA ---
    function hexToRgba(hex, alpha) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length == 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex; // Si falla, retorna el original
    }

    const btnSaveCurrency = document.getElementById('btn-save-currency');
    const inputCurrency = document.getElementById('cms-currency-rate');

    if (btnSaveCurrency && inputCurrency) {
        btnSaveCurrency.addEventListener('click', async () => {
            const newRate = parseFloat(inputCurrency.value);

            if (isNaN(newRate) || newRate <= 0) {
                alert("Por favor ingresa una tasa válida mayor a 0.");
                return;
            }

            // Actualizamos la memoria
            cmsData.currency_rate = newRate;

            // Guardamos en BD
            await saveCMSData();

            renderProducts(productsDB);

            // Feedback visual
            const originalText = btnSaveCurrency.innerHTML;
            btnSaveCurrency.innerHTML = "<i class='bx bx-check'></i>";
            btnSaveCurrency.style.background = "#2E7D32";

            setTimeout(() => {
                btnSaveCurrency.innerHTML = originalText;
                btnSaveCurrency.style.background = ""; // Volver al color original
            }, 2000);
        });
    }
});