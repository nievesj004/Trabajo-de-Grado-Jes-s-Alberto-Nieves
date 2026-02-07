const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error fatal: No se pudo conectar a la Base de Datos.');
        console.error('Código de error:', err.code);
    } else {
        console.log('Conexión a la Base de Datos exitosa.');
        connection.release();
    }
});

module.exports = pool.promise();