const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_secreto';

exports.register = async (req, res) => {
    const { name, email, password, phone, location } = req.body;

    try {
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.query(
            'INSERT INTO users (name, email, password, role, phone, location, status) VALUES (?, ?, ?, "Cliente", ?, ?, "active")',
            [name, email, hashedPassword, phone, location]
        );

        res.status(201).json({ message: 'Usuario registrado exitosamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor al registrar' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = users[0];

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Tu cuenta está inactiva. Contacta soporte.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,       
                location: user.location, 
                img_url: user.img_url 
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor al iniciar sesión' });
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'farmaciaonlinetesis@gmail.com',
        pass: 'mpuq vofl egac ougt'
    }
});

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'No existe una cuenta con ese correo.' });
        }

        const user = users[0];
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expireDate = new Date(Date.now() + 3600000); 

        await db.query('UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?', [code, expireDate, user.id]);

        const mailOptions = {
            from: 'FarmaciaOnline farmaciaonlinetesis@gmail.com',
            to: email,
            subject: 'Recuperación de Contraseña - FarmaciaOnline',
            text: `Tu código de recuperación es: ${code}. Este código expira en 1 hora.`
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Código enviado a tu correo.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al enviar el correo.' });
    }
};

exports.resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_expires > NOW()',
            [email, code]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Código inválido o expirado.' });
        }

        const user = users[0];

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.query(
            'UPDATE users SET password = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Contraseña actualizada con éxito.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar contraseña.' });
    }
};


exports.verifyCode = async (req, res) => {
    const { email, code } = req.body;

    try {
        // Verificamos si existe el usuario con ese email, ese código y que no haya expirado
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_expires > NOW()',
            [email, code]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Código inválido o expirado.' });
        }

        // Si encontramos usuario, el código es correcto
        res.status(200).json({ message: 'Código válido.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al verificar el código.' });
    }
};