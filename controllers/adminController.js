const Contestant = require('../models/Contestant');
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




exports.getAllContenders = async (req, res) => {

  try {

    const result = await Contestant.findAll();    
    // handle errors

    if (!result.length === 0) {
      if (req.isAPI) {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }
     return res.json({ success: false, message: result.message });
    }

    // no error

    if (req.isAPI) {
      return res.json({
        success: true,
        contestants: result
      });
    }
    
  return  res.json({ success: true, contestants: result });

  } catch (err) {
    console.error("Error loading admin all contestants:", err);


    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load all contestants'
      });
    }

   return res.status(500).json({ success: false, error: err.message });

  }
};


exports.findOneContender = async (req, res) => {

  const id = req.params.id
  try{
    const contestant = await Contestant.findById(id);

  if (contestant.length === 0) {
            return res.status(404).json({ success: false, error: 'Contestant not found' });
        }
        res.json({ success: true, contestant: contestant });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }

};


exports.addContender = async (req, res) => {
 
  try {
  const result = await Contestant.addContender(req.body)

    if (result.length === 0) {
            return res.status(404).json({ success: false, error: 'Contestant not found' });
        }
        res.json({ success: true, contestant: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.updateContender = async (req, res) => {
  const id = req.params.id
  
  try {
  const result = await Contestant.editContestant(req.body, id)

    if (result.length === 0) {
            return res.status(404).json({ success: false, error: 'Contestant not found' });
        }
        res.json({ success: true, contestant: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.deleteContender = async (req, res) => {
  const id = req.params.id
  try {
  const result = await Contestant.deleteContestant(id);

    if (result.length === 0) {
            return res.status(404).json({ success: false, error: 'Contestant not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
























