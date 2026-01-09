const adminServices = require('../services/adminServices');


exports.adminDashboard = async (req, res) => {

  try {
    const result = await adminServices.getDashboard(req);

    // handle errors

    if (!result.success) {
      if (req.isAPI) {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }
      req.flash('error_msg', result.message);
      return res.redirect(`/`);
    }

    // no error

    if (req.isAPI) {
      return res.json({
        success: true,
        data: result.data
      });
    }


    res.render('./admin/dashboard', {
      ...result.data
    });
  } catch (err) {
    console.error("Error loading admin dashboard:", err);


    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load admin dashboard:'
      });
    }

    req.flash('error_msg', 'Failed to load admin dashboard');
    return res.redirect('/');
  }
};


exports.getAllUsers = async (req, res) => {

  try {

    const result = await adminServices.getAllUsersPage(req);
    // handle errors

    if (!result.success) {
      if (req.isAPI) {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }
      req.flash('error_msg', result.message);
      return res.redirect(`/admin`);
    }

    // no error

    if (req.isAPI) {
      return res.json({
        success: true,
        data: result.data
      });
    }


    res.render('./admin/users',
      {
        ...result.data
      });
  } catch (err) {
    console.error("Error loading admin all users page:", err);


    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load all users page'
      });
    }

    req.flash('error_msg', 'Failed to load all users page');
    return res.redirect('/admin');
  }

};
exports.findOneUsers = async (req, res) => {

  const userId = req.params.id
  try {
    const result = await adminServices.getUser(userId);
    // handle errors

    if (!result.success) {
      if (req.isAPI) {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }
      req.flash('error_msg', result.message);
      return res.redirect(`/admin`);
    }

    // no error

    if (req.isAPI) {
      return res.json({
        success: true,
        data: result.data
      });
    }

    res.render('./admin/user',
      {
        ...result.data
      });

  } catch (err) {

    console.error("Error loading admin user view:", err);


    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load user view'
      });
    }

    req.flash('error_msg', 'Failed to load user view');
    return res.redirect('/admin');
  }

};
exports.deleteUser = async (req, res) => {
  const userID = req.params.id


  try {

    const result = await adminServices.deleteUser(userID);


    if (!result.success) {
      if (req.isAPI) {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }
      req.flash('error_msg', result.message);
      return res.redirect(`/admin`);
    }

    // no error

    if (req.isAPI) {
      return res.json({
        success: true,
        message: result.message
      });
    }

    req.flash('success_msg', result.message);
    return res.redirect('/admin/users')


  } catch (error) {
    console.error("server Error deleting from users:", err);


    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        message: 'server error deleting from user'
      });
    }

    req.flash('error_msg', 'server error deleting from user')
    return res.redirect('/admin');

  }
};


























