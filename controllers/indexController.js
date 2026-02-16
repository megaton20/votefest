const indexservices = require('../services/indexServices')




exports.landingPage = async (req, res) => {


  try {

    const { user, contestants } = await indexservices.landingPage(req)
    const joinCommunityModal = !req.session.showJoinCommunity

    if (req.isAPI) {
      return res.json({
        success: true,
        data: {
          user,
          contestants,
          joinCommunityModal
        }
      })
    }

    res.render('index', {
      joinCommunityModal,
      user,
      contestants
    })

  } catch (error) {
    console.error(`Error fetching landing: ${error}`);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/');
  }
}

exports.eventPage = async (req, res) => {

  try {

    const {contestants, user } = await indexservices.landingPage(req)


    const joinCommunityModal = !req.session.showJoinCommunity

    if (req.isAPI) {
      return res.json({
        success: true,
        data: {
          user,
          contestants,
          totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0),
          joinCommunityModal
        }
      })
    }

    res.render('home', {
      joinCommunityModal,
      user,
      contestants,
      totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0)
    })

  } catch (error) {
    console.error(`Error fetching landing: ${error}`);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/');
  }
}

exports.viewContestantPage = async (req, res) => {


  try {

    const result = await indexservices.viewContestantPage(req.params.id, req)
    if (result.success) {

      const { user, contestants, contestant } = result

      if (req.isAPI) {
        return res.json({
          success: true,
          data: {
            user,
            contestants,
            contestant,
            totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0)

          }
        })
      }

     return res.render('contestant', {
        user,
        contestants,
        contestant,
        totalVotes: contestants.reduce((sum, c) => sum + c.votes, 0)
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
    console.error(`Error fetching landing: ${error}`);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/');
  }
}



