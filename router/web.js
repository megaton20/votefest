const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth");




const indexRoutes =  require('../routes/index')
const authRouter = require('../routes/authRoutes')
const chatRoutes = require('../routes/chatRoutes');
const adminRouter = require('../routes/adminRoutes')

router.use('/', indexRoutes)
router.use('/auth', authRouter)
router.use('/admin',ensureAuthenticated, adminRouter)


router.use('/chat',ensureAuthenticated,  chatRoutes)


module.exports = router