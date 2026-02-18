const router = require('express').Router();
const adminController = require('../controllers/adminController');
const {ensureAdmin} = require('../middleware/auth');

router.use(ensureAdmin)


router.get('/',  adminController.adminDashboard);
router.get('/users',  adminController.getAllUsers);
router.get('/users/:id',  adminController.findOneUsers);
router.delete('/users/delete/:id',  adminController.deleteUser);


router.get('/contenders',  adminController.getAllContenders);
router.get('/contenders/:id',  adminController.findOneContender);
// add
// update                                   
router.delete('/contenders/delete/:id',  adminController.deleteContender);




module.exports = router;
