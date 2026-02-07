const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');


router.get('/', cmsController.getCMS);
router.put('/', [verifyToken, isAdmin], cmsController.saveCMS);

module.exports = router;