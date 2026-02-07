const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.get('/user/:userId', orderController.getUserOrders);
router.put('/:id/status', orderController.updateOrderStatus);
router.get('/stats', orderController.getSalesStats);

module.exports = router;