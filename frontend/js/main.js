// --- 1. VARIABLE GLOBAL PARA GUARDAR PEDIDOS ---
// Esto nos permite acceder a los datos desde cualquier parte sin pasarlos por HTML
window.misPedidosTemp = [];

document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://localhost:3000/api';

    // --- VARIABLES GLOBALES LOCALES ---
    let cart = [];
    let products = [];
    let user = JSON.parse(localStorage.getItem('user')) || null;
    let exchangeRate = 0;

    // --- GUARDIA DE ADMIN ---
    if (user && user.role === 'Admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    // --- ELEMENTOS DEL DOM ---
    const cartIcon = document.getElementById('cart-icon');
    const ordersIcon = document.getElementById('orders-icon');
    const accountBtn = document.getElementById('account');

    // Sidebars y Overlays
    const cartSidebar = document.getElementById('cart-sidebar');
    const accountSidebar = document.getElementById('account-sidebar');
    const ordersSidebar = document.getElementById('orders-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');

    // Botones de cierre
    const closeCartBtn = document.getElementById('close-cart');
    const closeAccountBtn = document.getElementById('close-account');
    const closeOrdersBtn = document.getElementById('close-orders');

    // Contenedores
    const cartItemsContainer = document.getElementById('cart-items');
    const totalPriceElement = document.getElementById('total-price');
    const cartCountElement = document.getElementById('cart-count');
    const productsGrid = document.getElementById('products-grid');
    const bestsellerTrack = document.getElementById('bestseller-track');
    const ordersList = document.getElementById('orders-list');

    // Elementos del Perfil
    const displayName = document.getElementById('display-name');
    const displayEmail = document.getElementById('display-email');
    const displayPhone = document.getElementById('display-phone');
    const displayLocation = document.getElementById('display-location');
    const displayAvatar = document.getElementById('display-avatar');
    const btnLogout = document.querySelector('.btn-logout');

    // ============================================================
    // 1. LÓGICA DE AUTENTICACIÓN
    // ============================================================
    function checkAuth() {
        if (!user) {
            accountBtn.innerHTML = `<i class='bx bx-log-in'></i> Ingresar`;
            accountBtn.classList.remove('icon-box');
            accountBtn.classList.add('btn-login-nav');
            accountBtn.href = "login.html";

            if (ordersIcon) ordersIcon.style.display = 'none';
            accountBtn.onclick = null;

        } else {
            accountBtn.innerHTML = `<i class='bx bx-user'></i>`;
            accountBtn.classList.add('icon-box');
            accountBtn.classList.remove('btn-login-nav');
            accountBtn.removeAttribute('style');
            accountBtn.removeAttribute('href');
            accountBtn.style.cursor = 'pointer';

            if (ordersIcon) ordersIcon.style.display = 'block';

            accountBtn.addEventListener('click', (e) => {
                e.preventDefault();
                fillProfileSidebar();
                accountSidebar.classList.add('active');
                cartOverlay.classList.add('active');
            });
        }
    }

    function fillProfileSidebar() {
        if (!user) return;
        displayName.innerText = user.name || "Usuario";
        displayEmail.innerText = user.email || "Sin correo";
        displayPhone.innerText = user.phone ? user.phone : "Sin teléfono registrado";
        displayLocation.innerText = user.location ? user.location : "Sin ubicación registrada";

        const defaultAvatarPath = 'assets/img/default-avatar.png';
        if (user.img_url && user.img_url.trim() !== '') {
            displayAvatar.src = user.img_url;
        } else {
            displayAvatar.src = defaultAvatarPath;
        }
        displayAvatar.style.objectFit = 'cover';
        displayAvatar.style.borderRadius = '50%';
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            user = null;
            location.reload(true);
        });
    }

    checkAuth();

    // ============================================================
    // 2. LÓGICA DE PEDIDOS PENDIENTES (SIDEBAR)
    // ============================================================

    // A. ABRIR SIDEBAR
    if (ordersIcon) {
        ordersIcon.addEventListener('click', () => {
            if (!user) {
                showCustomAlert("Debes iniciar sesión para ver tus pedidos.");
                return;
            }
            ordersSidebar.classList.add('active');
            cartOverlay.classList.add('active');
            fetchPendingOrders();
        });
    }

    // B. CERRAR SIDEBAR
    if (closeOrdersBtn) {
        closeOrdersBtn.addEventListener('click', () => {
            ordersSidebar.classList.remove('active');
            cartOverlay.classList.remove('active');
        });
    }

    // C. FUNCIÓN FETCH (Ir al servidor)
    async function fetchPendingOrders() {
        if (!ordersList) return;
        ordersList.innerHTML = '<p style="text-align:center; padding:20px;">Cargando pedidos...</p>';

        try {
            const response = await fetch(`${API_URL}/orders/user/${user.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                const allOrders = await response.json();

                // GUARDAMOS EN VARIABLE GLOBAL
                window.misPedidosTemp = allOrders;

                const pendingOrders = allOrders.filter(order => order.status === 'Pendiente');
                renderOrdersCards(pendingOrders);
            } else {
                ordersList.innerHTML = '<p style="text-align:center;">Error al cargar historial.</p>';
            }
        } catch (error) {
            console.error(error);
            ordersList.innerHTML = '<p style="text-align:center;">Error de conexión.</p>';
        }
    }

    // D. FUNCIÓN RENDER (Dibujar tarjetas)
    function renderOrdersCards(orders) {
        if (!ordersList) return;
        ordersList.innerHTML = '';

        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; color: #999;">
                    <i class='bx bx-check-circle' style="font-size: 3rem; margin-bottom:10px;"></i>
                    <p>No tienes pedidos pendientes.</p>
                </div>`;
            return;
        }

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString();

            const card = document.createElement('div');
            card.className = 'order-card';

            // CORRECCIÓN IMPORTANTE: Pasamos solo el ID a la función
            card.innerHTML = `
                <div style="background:white; border:1px solid #eee; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f0f0f0; padding-bottom:8px; margin-bottom:10px;">
                        <span style="font-weight:bold; color:#2D3A95;">Pedido #${order.id}</span>
                        <span style="font-size:0.85rem; color:#666;">${date}</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div>
                            <div style="font-weight:700; font-size:1.1rem;">$${parseFloat(order.total).toFixed(2)}</div>
                            <small style="color:#666;">${order.items ? order.items.length : 0} artículos</small>
                        </div>
                        <span style="background:#FFF3E0; color:#EF6C00; padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:500;">
                            ${order.status}
                        </span>
                    </div>

                    <button class="btn-track-order" onclick="window.openStoreOrderDetails(${order.id})">
                        <i class='bx bx-map-pin'></i> Ver Compra
                    </button>
                </div>
            `;
            ordersList.appendChild(card);
        });
    }

    // ============================================================
    // 3. LÓGICA DE TIENDA (PRODUCTOS, CARRITO, CMS)
    // ============================================================

    function renderCategoryFilters(categoriesData) {
        const container = document.getElementById('category-filters-container');
        if (!container) return;
        container.innerHTML = '';

        let categories = [];
        try {
            categories = typeof categoriesData === 'string' ? JSON.parse(categoriesData) : categoriesData;
        } catch (e) { categories = []; }

        const allBtn = document.createElement('button');
        allBtn.className = 'filter-pill active';
        allBtn.setAttribute('data-filter', 'all');
        allBtn.innerText = 'Todos';
        container.appendChild(allBtn);

        if (Array.isArray(categories)) {
            categories.forEach(catName => {
                const btn = document.createElement('button');
                btn.className = 'filter-pill';
                btn.setAttribute('data-filter', catName);
                btn.innerText = catName;
                container.appendChild(btn);
            });
        }

        const pills = container.querySelectorAll('.filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                const category = pill.getAttribute('data-filter');
                const items = document.querySelectorAll('.catalog-item');

                items.forEach(item => {
                    const itemCat = (item.getAttribute('data-category') || '').toLowerCase();
                    const filterCat = category.toLowerCase();
                    if (filterCat === 'all' || itemCat === filterCat) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }

    async function loadStoreData() {
        try {
            // 1. Cargar productos y CMS en paralelo
            const [prodRes, cmsRes] = await Promise.all([
                fetch(`${API_URL}/products`),
                fetch(`${API_URL}/cms`)
            ]);

            const productsData = await prodRes.json();

            // Si el CMS falla o viene vacío, usamos un objeto vacío para no romper todo
            let cmsData = {};
            if (cmsRes.ok) {
                cmsData = await cmsRes.json();
                
                // --- NUEVO: GUARDAR LA TASA EN LA VARIABLE GLOBAL ---
                exchangeRate = parseFloat(cmsData.currency_rate) || 0;
            }

            // 2. Renderizar Productos (Lo hacemos PRIMERO para asegurar que se vean)
            products = productsData.map(p => ({
                id: p.id,
                name: p.name,
                price: parseFloat(p.price),
                stock: parseInt(p.stock),
                category: p.category,
                desc: p.description,
                img: p.img_url || "https://via.placeholder.com/150"
            })).filter(p => p.stock > 0);

            if (typeof renderCatalog === 'function') renderCatalog(products);

            // 3. Aplicar CMS (Dentro de un try-catch interno para que si falla, no quite los productos)
            try {
                // Títulos y Textos (Usamos || "" para evitar undefined)
                // ... dentro de loadStoreData ...
                if (cmsData.store_name) {
                    document.title = cmsData.store_name;
                    const logo = document.querySelector('.logo');

                    if (logo) {
                        const name = cmsData.store_name;
                        const half = Math.ceil(name.length / 2);

                        // 1. Construimos el HTML del nombre (Texto)
                        let logoHTML = `${name.slice(0, half)}<span>${name.slice(half)}</span><span class="dot">.</span>`;

                        // 2. SI HAY IMAGEN DE LOGO, la agregamos AL PRINCIPIO de la variable logoHTML
                        if (cmsData.store_logo && cmsData.store_logo.trim() !== "") {
                            // Inyectamos la imagen antes del texto
                            logoHTML = `<img src="${cmsData.store_logo}" alt="Logo">` + logoHTML;
                        }

                        // 3. Insertamos todo junto en el HTML
                        logo.innerHTML = logoHTML;
                    }
                }

                // Hero
                const heroTitle = document.querySelector('.hero-text h1');
                const heroText = document.querySelector('.hero-text p');
                const heroImg = document.querySelector('.hero-image-container img'); // Verifica que este selector coincida con tu HTML
                const heroSection = document.querySelector('.hero');

                // 1. Textos
                if (heroTitle && cmsData.hero_title) heroTitle.innerHTML = cmsData.hero_title.replace(/\n/g, '<br>');
                if (heroText && cmsData.hero_text) heroText.innerText = cmsData.hero_text;

                // 2. Lógica INTELIGENTE para la Imagen Principal (Derecha)
                if (heroImg) {
                    if (cmsData.hero_img && cmsData.hero_img.trim() !== "") {
                        // Si hay imagen: La ponemos y aseguramos que se vea
                        heroImg.src = cmsData.hero_img;
                        heroImg.style.display = 'block';
                    } else {
                        // Si NO hay imagen (se eliminó): Ocultamos la etiqueta img por completo
                        heroImg.style.display = 'none';
                        heroImg.src = '';
                    }
                }

                // 3. Lógica INTELIGENTE para el Fondo (Imagen o Gradiente)
                if (heroSection) {
                    if (cmsData.hero_bg_img && cmsData.hero_bg_img.trim() !== "") {
                        // Caso A: El usuario subió una imagen de fondo
                        heroSection.style.backgroundImage = `url('${cmsData.hero_bg_img}')`;
                        heroSection.style.backgroundSize = 'cover';
                        heroSection.style.backgroundPosition = 'center';
                    } else {
                        // Caso B: El usuario borró la imagen -> Usamos Gradiente con los colores del tema
                        // Usamos las variables CSS --primary-color y --secondary-color que se definen más abajo
                        heroSection.style.backgroundImage = `linear-gradient(135deg, var(--primary-color), var(--secondary-color))`;
                    }
                }

                // Títulos de secciones
                const bestSellerH2 = document.querySelector('.section-title');
                if (bestSellerH2 && cmsData.carousel_title) bestSellerH2.innerText = cmsData.carousel_title;

                const catalogH2 = document.querySelector('.section-title.center');
                if (catalogH2 && cmsData.catalog_title) catalogH2.innerText = cmsData.catalog_title;

                // Colores y Categorías
                renderCategoryFilters(cmsData.categories_json);

                if (cmsData.colors_json) {
                    let themeColors = typeof cmsData.colors_json === 'string' ? JSON.parse(cmsData.colors_json) : cmsData.colors_json;
                    Object.entries(themeColors).forEach(([key, value]) => {
                        document.documentElement.style.setProperty(key, value);
                    });
                }

                // Carrusel
                let carouselIds = cmsData.carousel_json;
                if (typeof carouselIds === 'string') carouselIds = JSON.parse(carouselIds);
                renderBestSellers(products, carouselIds);

            } catch (cmsError) {
                console.warn("Error aplicando estilos del CMS, pero los productos se cargaron.", cmsError);
            }

        } catch (error) {
            console.error("Error crítico cargando datos de la tienda:", error);
        }
    }

    function renderBestSellers(allProducts, carouselIds) {
        if (!bestsellerTrack) return;
        bestsellerTrack.innerHTML = '';

        let carouselItems = [];
        if (carouselIds && Array.isArray(carouselIds) && carouselIds.length > 0) {
            carouselItems = allProducts.filter(p => carouselIds.includes(p.id));
        } else {
            carouselItems = allProducts.slice(0, 6);
        }

        carouselItems.forEach(prod => {
            const card = createProductCard(prod, 'carousel-item');
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-btn')) return;
                openProductModalLocal(prod);
            });
            bestsellerTrack.appendChild(card);
        });

        attachAddEvents();
    }

    loadStoreData();

    function renderCatalog(items) {
        if (!productsGrid) return;
        productsGrid.innerHTML = '';

        items.forEach(prod => {
            const card = createProductCard(prod, 'catalog-item');
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-btn')) return;
                openProductModalLocal(prod);
            });
            productsGrid.appendChild(card);
        });

        attachAddEvents();
    }

    function createProductCard(prod, extraClass) {
        const div = document.createElement('div');
        div.className = `product-card ${extraClass}`;
        div.setAttribute('data-category', prod.category);
        div.setAttribute('data-name', prod.name);

        // --- LÓGICA DE PRECIO DOBLE ---
        let priceHTML = `$${prod.price.toFixed(2)}`; // Precio base en Dólares
        
        // Si la tasa es mayor a 0, agregamos los Bolívares
        if (exchangeRate > 0) {
            const priceBs = (prod.price * exchangeRate).toFixed(2);
            // Se verá así: $10.00 / Bs. 500.00
            priceHTML += `<span style="font-size:0.85rem; color: var(--text-gray);">/ Bs. ${priceBs}</span>`;
        }
        // ------------------------------

        div.innerHTML = `
            <div class="img-wrapper">
                <img src="${prod.img}" alt="${prod.name}">
            </div>
            <div class="card-details">
                <p class="cat-label">${prod.category}</p>
                <h3>${prod.name}</h3>
                <div class="price-row">
                    <span class="price">${priceHTML}</span>
                </div>
                <button class="add-btn" data-id="${prod.id}">Añadir <i class='bx bx-cart-add'></i></button>
            </div>
        `;
        return div;
    }

    function openProductModalLocal(data) {
        const productModalOverlay = document.getElementById('product-modal-overlay');
        const pmImg = document.getElementById('pm-img');
        const pmCategory = document.getElementById('pm-category');
        const pmTitle = document.getElementById('pm-title');
        const pmPrice = document.getElementById('pm-price');
        const pmStock = document.getElementById('pm-stock');
        const pmDesc = document.getElementById('pm-desc');
        const pmAddBtn = document.getElementById('pm-add-btn');

        if (productModalOverlay) {
            pmImg.src = data.img;
            pmCategory.innerText = data.category;
            pmTitle.innerText = data.name;

            let priceText = `$${data.price.toFixed(2)}`;
            
            if (exchangeRate > 0) {
                const priceBs = (data.price * exchangeRate).toFixed(2);
                priceText += ` / Bs. ${priceBs}`;
            }

            pmPrice.innerText = priceText;
            pmStock.innerText = data.stock;
            pmDesc.innerText = data.desc || "Sin descripción.";

            const newBtn = pmAddBtn.cloneNode(true);
            pmAddBtn.parentNode.replaceChild(newBtn, pmAddBtn);
            newBtn.addEventListener('click', () => {
                addToCart(data);
                productModalOverlay.classList.remove('active');
                cartSidebar.classList.add('active');
                cartOverlay.classList.add('active');
            });

            productModalOverlay.classList.add('active');
        }
    }

    function attachAddEvents() {
        const btns = document.querySelectorAll('.add-btn');
        btns.forEach(btn => {
            if (btn.classList.contains('event-added')) return;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                const product = products.find(p => p.id === id);
                if (product) {
                    addToCart(product);
                    if (cartSidebar) cartSidebar.classList.add('active');
                    if (cartOverlay) cartOverlay.classList.add('active');
                }
            });
            btn.classList.add('event-added');
        });
    }

    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        updateCartUI();
    }

    function updateCartUI() {
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-msg">
                    <i class='bx bx-shopping-bag'></i>
                    <p>Tu carrito está vacío</p>
                </div>`;
        } else {
            cart.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.classList.add('cart-item-box');
                itemElement.innerHTML = `
                    <img src="${item.img}" class="cart-img-preview">
                    <div class="cart-details">
                        <div class="cart-title">${item.name}</div>
                        <div class="cart-price">$${(item.price * item.quantity).toFixed(2)}</div>
                        <div class="cart-actions">
                            <input type="number" min="1" value="${item.quantity}" class="qty-input" data-id="${item.id}">
                            <i class='bx bxs-trash-alt trash-btn' data-id="${item.id}"></i>
                        </div>
                    </div>
                `;
                cartItemsContainer.appendChild(itemElement);
            });
        }

        document.querySelectorAll('.qty-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const newQty = parseInt(e.target.value);
                const item = cart.find(i => i.id === id);
                if (item) { item.quantity = newQty > 0 ? newQty : 1; }
                updateCartUI();
            });
        });

        document.querySelectorAll('.trash-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                cart = cart.filter(item => item.id !== id);
                updateCartUI();
            });
        });

        const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const count = cart.reduce((acc, item) => acc + item.quantity, 0);
        totalPriceElement.innerText = '$' + total.toFixed(2);
        cartCountElement.innerText = count;
    }

    const btnCheckout = document.querySelector('.btn-checkout');
    if (btnCheckout) {
        btnCheckout.addEventListener('click', async () => {
            if (cart.length === 0) {
                showCustomAlert("Tu carrito está vacío.", "error");
                return;
            }

            if (!user) {
                showCustomAlert("Debes iniciar sesión para realizar una compra.", "error");
                setTimeout(() => window.location.href = 'login.html', 2000);
                return;
            }

            const orderData = {
                user_id: user.id,
                total: cart.reduce((acc, item) => acc + (item.price * item.quantity), 0),
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    price: item.price
                }))
            };

            try {
                const res = await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(orderData)
                });

                const data = await res.json();

                if (res.ok) {
                    const successMsg = `
                        El pedido ha sido procesado correctamente.<br><br>
                        <b>ID de Orden:</b> #${data.orderId}<br>
                        <b>Guía de Rastreo:</b> <span style="font-size: 1.2rem; color: #2E7D32; font-weight: bold;">${data.trackingNumber}</span><br><br>
                        <span style="font-size: 0.9rem; color: #666;">Guarda este código para rastrear tu envío.</span>
                    `;
                    showCustomAlert(successMsg, 'success');

                    cart = [];
                    updateCartUI();
                    cartSidebar.classList.remove('active');
                    cartOverlay.classList.remove('active');
                } else {
                    if (data.errorType === 'STOCK_ERROR') {
                        const errorMsg = `
                            Stock insuficiente para:<br><br>
                            <span style="font-size: 1.1rem; color: #444; font-weight: bold;">${data.productName}</span><br>
                            <div style="margin-top: 8px; font-size: 0.95rem; color: #444; text-align: left; display: inline-block;">
                                • Disponible: <b>${data.available}</b><br>
                                • Solicitado: <b>${data.requested}</b>
                            </div>
                        `;
                        showCustomAlert(errorMsg, 'error');
                    } else {
                        showCustomAlert(data.message || "Ocurrió un error al procesar la solicitud.", 'error');
                    }
                }
            } catch (error) {
                console.error(error);
                showCustomAlert("Error de conexión con el servidor.", "error");
            }
        });
    }

    cartIcon.addEventListener('click', () => {
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
    });

    closeCartBtn.addEventListener('click', () => {
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
    });

    cartOverlay.onclick = (e) => {
        if (accountSidebar.classList.contains('active') && isEditing) {
            showCustomAlert("Tienes cambios sin guardar. Guarda o cancela para salir.", "danger");
            return;
        }

        cartSidebar.classList.remove('active');
        accountSidebar.classList.remove('active');
        if (ordersSidebar) ordersSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');

        const productModalOverlay = document.getElementById('product-modal-overlay');
        if (productModalOverlay) productModalOverlay.classList.remove('active');

        const storeTrackModal = document.getElementById('store-tracking-modal');
        if (storeTrackModal) storeTrackModal.classList.remove('active');
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            const pills = document.querySelectorAll('.filter-pill');
            pills.forEach(pill => {
                if (pill.getAttribute('data-filter') === 'all') pill.classList.add('active');
                else pill.classList.remove('active');
            });
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.catalog-item');
            items.forEach(item => {
                const name = item.getAttribute('data-name').toLowerCase();
                if (name.includes(term)) item.style.display = 'block';
                else item.style.display = 'none';
            });
        });
    }

    const closeProductModalBtn = document.getElementById('close-product-modal');
    const productModalOverlay = document.getElementById('product-modal-overlay');
    if (closeProductModalBtn) {
        closeProductModalBtn.addEventListener('click', () => {
            document.getElementById('product-modal-overlay').classList.remove('active');
        });
    }

    if (productModalOverlay) {
        productModalOverlay.addEventListener('click', (e) => {
            // Verificamos si el clic fue directamente en el fondo oscuro y no en la tarjeta blanca
            if (e.target === productModalOverlay) {
                productModalOverlay.classList.remove('active');
            }
        });
    }

    const closeStoreTrackBtn = document.getElementById('close-store-tracking');
    if (closeStoreTrackBtn) {
        closeStoreTrackBtn.addEventListener('click', () => {
            const modal = document.getElementById('store-tracking-modal');
            if (modal) modal.classList.remove('active');
        });
    }

    const profileViewMode = document.getElementById('profile-view-mode');
    const profileEditMode = document.getElementById('profile-edit-mode');
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const editName = document.getElementById('edit-name');
    const editEmail = document.getElementById('edit-email');
    const editPhone = document.getElementById('edit-phone');
    const editLocation = document.getElementById('edit-location');
    const editPassword = document.getElementById('edit-password');
    const editConfirmPass = document.getElementById('edit-confirm-password');
    const fileUpload = document.getElementById('file-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    let currentEditImageBase64 = "";
    let isEditing = false;

    const customAlert = document.getElementById('custom-alert');
    const customAlertMsg = document.getElementById('custom-alert-message');
    const btnCloseAlert = document.getElementById('btn-close-alert');

    function showCustomAlert(msg, type = 'error') {
        if (customAlert && customAlertMsg) {
            const iconElement = customAlert.querySelector('.alert-icon i');
            const titleElement = customAlert.querySelector('h3');
            customAlertMsg.innerHTML = msg;

            if (type === 'success') {
                iconElement.className = 'bx bx-check-circle';
                iconElement.style.color = '#2E7D32';
                titleElement.innerText = "¡Éxito!";
                titleElement.style.color = '#2E7D32';
            } else {
                iconElement.className = 'bx bx-error-circle';
                iconElement.style.color = '#C62828';
                titleElement.innerText = "¡Atención!";
                titleElement.style.color = '#C62828';
            }
            customAlert.classList.add('active');
        } else {
            alert(msg.replace(/<br>/g, '\n').replace(/<[^>]*>/g, ''));
        }
    }

    if (btnCloseAlert) {
        btnCloseAlert.addEventListener('click', () => customAlert.classList.remove('active'));
    }

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            if (!user) return;
            isEditing = true;
            editName.value = user.name || "";
            editEmail.value = user.email || "";
            editPhone.value = user.phone || "";
            editLocation.value = user.location || "";
            editPassword.value = '';
            editConfirmPass.value = '';

            const currentImg = user.img_url ? user.img_url : 'img/default-avatar.png';
            avatarPreview.style.backgroundImage = `url('${currentImg}')`;
            currentEditImageBase64 = user.img_url || "";

            profileViewMode.style.display = 'none';
            profileEditMode.style.display = 'block';
        });
    }

    if (avatarPreview) avatarPreview.addEventListener('click', () => fileUpload.click());
    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentEditImageBase64 = event.target.result;
                    avatarPreview.style.backgroundImage = `url('${currentEditImageBase64}')`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', () => {
            isEditing = false;
            profileEditMode.style.display = 'none';
            profileViewMode.style.display = 'block';
        });
    }

    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', async () => {
            if (editName.value.trim() === '' || editEmail.value.trim() === '') {
                showCustomAlert("El nombre y el correo son obligatorios.", "error");
                return;
            }

            const updatedData = {
                name: editName.value,
                email: editEmail.value,
                phone: editPhone.value,
                location: editLocation.value,
                img_url: currentEditImageBase64
            };

            const pass = editPassword.value;
            const confirm = editConfirmPass.value;
            if (pass !== '') {
                if (pass !== confirm) {
                    showCustomAlert("Las contraseñas no coinciden.", "error");
                    return;
                }
                if (pass.length < 6) {
                    showCustomAlert("La contraseña debe tener al menos 6 caracteres.", "error");
                    return;
                }
                updatedData.password = pass;
            }

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/users/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedData)
                });

                const data = await res.json();
                if (res.ok) {
                    user = data.user;
                    localStorage.setItem('user', JSON.stringify(user));
                    fillProfileSidebar();
                    checkAuth();
                    isEditing = false;
                    profileEditMode.style.display = 'none';
                    profileViewMode.style.display = 'block';
                    showCustomAlert("¡Perfil actualizado correctamente!", "success");
                } else {
                    showCustomAlert(data.message || "Error al actualizar", "error");
                }
            } catch (error) {
                console.error(error);
                showCustomAlert("Error de conexión con el servidor", "error");
            }
        });
    }

    if (closeAccountBtn) {
        const newCloseBtn = closeAccountBtn.cloneNode(true);
        closeAccountBtn.parentNode.replaceChild(newCloseBtn, closeAccountBtn);
        newCloseBtn.addEventListener('click', () => {
            if (isEditing) {
                showCustomAlert("Tienes cambios sin guardar. Guarda o cancela para salir.", "danger");
            } else {
                accountSidebar.classList.remove('active');
                cartOverlay.classList.remove('active');
            }
        });
    }

    if (prevBtn && nextBtn && bestsellerTrack) {
        nextBtn.addEventListener('click', () => {
            bestsellerTrack.scrollBy({ left: 320, behavior: 'smooth' });
        });
        prevBtn.addEventListener('click', () => {
            bestsellerTrack.scrollBy({ left: -320, behavior: 'smooth' });
        });
    }
});

// =========================================================
//  FUNCIÓN GLOBAL: ABRIR DETALLES (Corregida)
// =========================================================
window.openStoreOrderDetails = function (orderId) {
    try {
        // 1. Buscar el pedido en la memoria global usando el ID
        const order = window.misPedidosTemp.find(o => o.id === orderId);
        const modal = document.getElementById('store-tracking-modal');

        if (!modal) {
            console.error("No se encontró el modal");
            return;
        }
        if (!order) {
            console.error("Pedido no encontrado en memoria");
            return;
        }

        // 2. Obtener Usuario actualizado desde LocalStorage
        // Esto evita el error de scope porque lo leemos aquí mismo
        const userLocal = JSON.parse(localStorage.getItem('user')) || {};

        // 3. Llenar Encabezado
        document.getElementById('stm-tracking-id').innerText = order.tracking_number || "PENDIENTE";

        // 4. Llenar Datos del Cliente
        document.getElementById('stm-user-name').innerText = userLocal.name || "Usuario";
        document.getElementById('stm-user-email').innerText = userLocal.email || "---";
        document.getElementById('stm-user-phone').innerText = userLocal.phone || "---";

        // 5. Llenar Lista de Productos
        const list = document.getElementById('stm-products-list');
        list.innerHTML = '';

        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'tracking-item';
                div.innerHTML = `
                    <span><b>${item.quantity}x</b> ${item.name}</span>
                    <span>$${parseFloat(item.price).toFixed(2)}</span>
                `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<p style="text-align:center; color:#999;">Sin detalles.</p>';
        }

        // 6. Total y Estado
        document.getElementById('stm-total-price').innerText = '$' + parseFloat(order.total).toFixed(2);

        const statusEl = document.getElementById('stm-order-status');
        statusEl.innerText = order.status;
        statusEl.className = 'status-badge';

        if (order.status === 'Pendiente') statusEl.classList.add('status-pendiente');
        else if (order.status === 'Enviado') statusEl.classList.add('status-enviado');
        else if (order.status === 'Entregado') statusEl.classList.add('status-entregado');

        // 7. Mostrar Modal
        modal.classList.add('active');

        // Configurar cierre
        const closeBtn = document.getElementById('close-store-tracking');
        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');

        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove('active');
        }

    } catch (e) {
        console.error("Error al abrir modal:", e);
    }
};