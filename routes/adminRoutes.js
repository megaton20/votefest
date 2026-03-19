const router = require('express').Router();
const adminController = require('../controllers/adminController');
const {ensureAdmin} = require('../middleware/auth');
const {ensureAuthenticated} = require('../config/auth');

router.use(ensureAdmin)
router.use(ensureAuthenticated)


router.get('/',  adminController.adminDashboard);
// router.get('/users',  adminController.getAllUsers);
// router.get('/users/:id',  adminController.findOneUsers);
// router.delete('/users/delete/:id',  adminController.deleteUser);


router.get('/contestants',  adminController.getAllContenders);
router.get('/contestants/:id',  adminController.findOneContender);
                                
router.post('/contestants/',  adminController.addContender);
router.put('/contestants/:id',  adminController.updateContender);
router.delete('/contestants/:id',  adminController.deleteContender);








module.exports = router;
