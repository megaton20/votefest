const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth");




const indexRoutes =  require('../routes/index')
const authRouter = require('../routes/authRoutes')
const adminRouter = require('../routes/adminRoutes')
const userRouter = require('../routes/userRouter')

router.use('/', indexRoutes)
router.use('/auth', authRouter)
router.use('/dashboard',ensureAuthenticated, userRouter)
router.use('/admin',ensureAuthenticated, adminRouter)


router.use('/vote', require('../routes/votes'));
router.use('/wallet',ensureAuthenticated, require('../routes/wallet'));
router.use('/tickets',ensureAuthenticated, require('../routes/tickets'));


module.exports = router