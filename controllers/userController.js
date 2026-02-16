const indexservices = require('../services/indexServices')
const userServices = require('../services/userServices');


exports.dashboard = async (req, res) => {

  try {
    try {

      const result = await userServices.dashboard(req)

      if (result.success) {
        const { userActive, dashboard, recentVotes, success, user } = result

        if (req.isAPI) {
          return res.json({
            success,
            data: {
              user,
              userActive,
              dashboard,
              recentVotes: recentVotes.rows
            }
          })
        }

        return res.render('dashboard', {
          userActive,
          user,
          dashboard,
           recentVotes: recentVotes.rows
        })

      }

      // success is false

       if (req.isAPI) {
      return res.json({
        success: false,
        message:result.message
      })
    }

    console.log(result.error);
    
    req.flash('error_msg', `${result.message}`)
    return res.redirect('/')



    } catch (error) {
      console.error(`Error fetching dashboard: ${error}`);
      req.flash('error_msg', 'An error occurred');
      return res.redirect('/');
    }



  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'Failed to load dashboard' });
  }
}


exports.me = async (req, res) => {


  try {

    const result = await indexservices.viewContestantPage(req.params.id, req)
    if (result.success) {

      const { userActive, contestants, contestant, comments } = result

      if (req.isAPI) {
        return res.json({
          success: true,
          data: {
            userActive,
            contestants,
            contestant,
            comments,
            totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0)

          }
        })
      }

      return res.render('contestant', {
        userActive,
        contestants,
        contestant,
        comments,
        totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0)
      })

    }



    if (req.isAPI) {
      return res.json({
        success: false,
        message: result.message
      })
    }

    req.flash('error_msg', `${result.message}`)
    return res.redirect('/')

  } catch (error) {
    console.error(`Error fetching landing: ${error}`);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/');
  }
}



