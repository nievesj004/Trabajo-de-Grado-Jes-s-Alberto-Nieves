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
    const { name, description, category, price, stock, img } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO products (name, description, category, price, stock, img_url) VALUES (?, ?, ?, ?, ?, ?)',
            [name, description, category, price, stock, img]
        );
        res.status(201).json({ id: result.insertId, message: 'Producto creado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, category, price, stock, img } = req.body;
    try {
        await db.query(
            'UPDATE products SET name=?, description=?, category=?, price=?, stock=?, img_url=? WHERE id=?',
            [name, description, category, price, stock, img, id]
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