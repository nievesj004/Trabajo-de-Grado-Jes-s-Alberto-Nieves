const db = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM products');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProductById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createProduct = async (req, res) => {
    // 1. Recibir los nuevos campos del body
    const { name, description, category, price, stock, img, has_discount, discount_percent, discount_ends_at } = req.body;
    
    try {
        const [result] = await db.query(
            // 2. Incluir las columnas en el INSERT
            'INSERT INTO products (name, description, category, price, stock, img_url, has_discount, discount_percent, discount_ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            // 3. Pasar los valores (con valores por defecto si vienen vacíos)
            [name, description, category, price, stock, img, has_discount || false, discount_percent || 0, discount_ends_at || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Producto creado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, category, price, stock, img, has_discount, discount_percent, discount_ends_at } = req.body;
    
    try {
        await db.query(
            // 4. Incluir las columnas en el UPDATE
            'UPDATE products SET name=?, description=?, category=?, price=?, stock=?, img_url=?, has_discount=?, discount_percent=?, discount_ends_at=? WHERE id=?',
            [name, description, category, price, stock, img, has_discount || false, discount_percent || 0, discount_ends_at || null, id]
        );
        res.json({ message: 'Producto actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Producto eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};