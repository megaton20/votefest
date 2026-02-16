
const router = require('express').Router();
const userController = require('../controllers/userController')



router.get('/', userController.dashboard);
router.get('/me/:id', userController.me)






module.exports = router