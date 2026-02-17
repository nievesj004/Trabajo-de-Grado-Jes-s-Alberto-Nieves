const pool = require('../config/db');

function generateTrackingNumber() {
    return Math.floor(10000000 + Math.random() * 90000000);
}

exports.createOrder = async (req, res) => {
    const { user_id, total, items } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log("--- INICIANDO TRANSACCIÓN DE PEDIDO ---");

        // 1. Obtener Tasa Snapshot
        const [settings] = await connection.query('SELECT currency_rate FROM cms_settings WHERE id = 1');
        const currentRate = settings.length > 0 ? settings[0].currency_rate : 0;

        let trackingNumber;
        let isUnique = false;

        while (!isUnique) {
            trackingNumber = generateTrackingNumber();
            const [existing] = await connection.query(
                'SELECT id FROM orders WHERE tracking_number = ?', 
                [trackingNumber]
            );
            if (existing.length === 0) {
                isUnique = true;
            }
        }
        console.log(`Guía generada: ${trackingNumber}`);

        // --- VALIDACIÓN DE STOCK Y OBTENCIÓN DE NOMBRES ---
        // Creamos un mapa para guardar los nombres y usarlos al insertar
        const productInfoMap = {}; 

        for (const item of items) {
            const quantitySolicitada = Number(item.quantity);
            const itemId = item.product_id;

            const [productRows] = await connection.query('SELECT stock, name FROM products WHERE id = ?', [itemId]);

            if (productRows.length === 0) {
                throw new Error(`Producto ID ${itemId} no encontrado.`);
            }

            const product = productRows[0];
            const stockActual = Number(product.stock);

            // Guardamos el nombre para congelarlo después
            productInfoMap[itemId] = product.name;

            if (stockActual < quantitySolicitada) {
                await connection.rollback();
                return res.status(400).json({ 
                    errorType: 'STOCK_ERROR',
                    productName: product.name,
                    available: stockActual,
                    requested: quantitySolicitada
                });
            }
        }

        // --- INSERTAR ORDEN ---
        const [orderResult] = await connection.query(
            'INSERT INTO orders (user_id, total, status, created_at, tracking_number, exchange_rate_snapshot) VALUES (?, ?, ?, NOW(), ?, ?)',
            [user_id, total, 'Pendiente', trackingNumber, currentRate]
        );
        const orderId = orderResult.insertId;

        // --- INSERTAR DETALLES (CON EL NOMBRE CONGELADO) ---
        for (const item of items) {
            const quantitySolicitada = Number(item.quantity);
            
            // Recuperamos el nombre que obtuvimos en la validación
            const frozenName = productInfoMap[item.product_id]; 

            // AQUÍ ESTÁ EL CAMBIO CLAVE: Insertamos 'product_name' directamente
            await connection.query(
                'INSERT INTO order_details (order_id, product_id, product_name, quantity, price_at_purchase) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.product_id, frozenName, quantitySolicitada, item.price]
            );

            // Descontar stock
            await connection.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [quantitySolicitada, item.product_id]
            );
        }

        await connection.commit();
        console.log(`Orden #${orderId} creada con tasa: ${currentRate}`);
        
        res.status(201).json({ 
            message: 'Orden creada exitosamente', 
            orderId: orderId,
            trackingNumber: trackingNumber 
        });

    } catch (error) {
        console.error("ERROR EN TRANSACCIÓN:", error);
        if (connection) await connection.rollback();
        
        if (error.code === '22003') { 
            return res.status(400).json({ message: 'Error crítico: Stock negativo bloqueado por BD.' });
        }

        res.status(500).json({ message: 'Error al procesar la orden', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const sql = `
            SELECT o.id, o.total, o.status, o.created_at, o.tracking_number, o.exchange_rate_snapshot,
            u.name as user_name, u.email as user_email, u.phone as user_phone
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query(sql);
        
        const ordersWithItems = await Promise.all(rows.map(async (order) => {
            // CAMBIO: Ya no hacemos JOIN con products.
            // Leemos product_name directamente de order_details.
            // Esto permite ver el pedido aunque el producto original haya sido borrado.
            const [items] = await pool.query(
                `SELECT quantity, price_at_purchase as price, product_name as name 
                FROM order_details 
                WHERE order_id = ?`,
                [order.id]
            );
            return { ...order, items };
        }));

        res.json(ordersWithItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo órdenes' });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        const { userId } = req.params;

        const query = `
            SELECT * FROM orders 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `;
        
        const [orders] = await pool.query(query, [userId]);

        const ordersWithDetails = await Promise.all(orders.map(async (order) => {
            // CAMBIO: Eliminado el JOIN con products.
            const [items] = await pool.query(
                `SELECT 
                    quantity, 
                    price_at_purchase as price, 
                    product_name as name 
                FROM order_details 
                WHERE order_id = ?`, 
                [order.id]
            );
            return { ...order, items };
        }));

        res.json(ordersWithDetails);

    } catch (error) {
        console.error("Error buscando pedidos del usuario:", error);
        res.status(500).json({ message: 'Error al obtener historial' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

        res.json({ message: 'Estado actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando orden' });
    }
};

exports.getSalesStats = async (req, res) => {
    try {
        const sql = `
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(total) as total
            FROM orders
            WHERE status = 'Entregado'
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `;
        
        const [rows] = await pool.query(sql);
        
        res.json(rows);
    } catch (error) {
        console.error("Error obteniendo estadísticas:", error);
        res.status(500).json({ message: 'Error al cargar reporte de ventas' });
    }
};