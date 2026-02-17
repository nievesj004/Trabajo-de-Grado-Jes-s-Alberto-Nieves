const db = require('../config/db');

exports.getCMS = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM cms_settings WHERE id = 1');
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.json({}); 
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.saveCMS = async (req, res) => {
    const { 
        store_name,
        store_logo,
        currency_rate,
        hero_title, 
        hero_text, 
        hero_img, 
        hero_bg_img,
        carousel_title,
        catalog_title,
        colors_json, 
        categories_json, 
        carousel_json 
    } = req.body;

    try {
        const query = `
            UPDATE cms_settings SET
            store_name = ?,
            store_logo = ?,
            currency_rate = ?,
            hero_title = ?,
            hero_text = ?,
            hero_img = ?,
            hero_bg_img = ?,
            carousel_title = ?,
            catalog_title = ?,
            colors_json = ?,
            categories_json = ?,
            carousel_json = ?
            WHERE id = 1
        `;

        const [result] = await db.query(query, [
            store_name, 
            store_logo,
            currency_rate, 
            hero_title, 
            hero_text, 
            hero_img, 
            hero_bg_img, 
            carousel_title, 
            catalog_title, 
            colors_json, 
            categories_json, 
            carousel_json
        ]);

        if (result.affectedRows === 0) {
            await db.query(`
                INSERT INTO cms_settings (id, store_name) VALUES (1, 'FarmaVida')
            `);
            return exports.saveCMS(req, res);
        }
        
        res.json({ message: 'CMS actualizado correctamente' });
    } catch (err) {
        console.error("Error al guardar CMS:", err);
        res.status(500).json({ error: err.message });
    }
};