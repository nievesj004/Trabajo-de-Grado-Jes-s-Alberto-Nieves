const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createUser = async (req, res) => {
    const { name, email, role, status, password, img_url } = req.body;
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.query(
            'INSERT INTO users (name, email, role, status, password, img_url) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, role || 'Cliente', status || 'active', hashedPassword, img_url] // Guardamos la encriptada
        );
        res.status(201).json({ id: result.insertId, message: 'Usuario creado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, role, status, password, img_url } = req.body;

    try {
        let query = 'UPDATE users SET name=?, email=?, role=?, status=?, img_url=?';
        let params = [name, email, role, status, img_url];

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            query += ', password=?';
            params.push(hashedPassword);
        }

        query += ' WHERE id=?';
        params.push(id);

        await db.query(query, params);
        res.json({ message: 'Usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProfile = async (req, res) => {
    const userId = req.user.id; 
    const { name, email, phone, location, password, img_url } = req.body;

    try {
        let query = 'UPDATE users SET name = ?, email = ?, phone = ?, location = ?, img_url = ?';
        let params = [name, email, phone, location, img_url];

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(userId);

        await db.query(query, params);

        const updatedUser = {
            id: userId,
            name,
            email,
            phone,
            location,
            role: req.user.role,
            img_url
        };

        res.json({ message: 'Perfil actualizado correctamente', user: updatedUser });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar el perfil' });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        
        if (users.length > 0) {
            const user = users[0];
            res.json({ 
                success: true, 
                user: { id: user.id, name: user.name, role: user.role, img: user.img_url } 
            });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};