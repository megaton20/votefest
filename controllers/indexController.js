const axios = require('axios');
const indexservices = require('../services/indexServices')
const {v4:uuidv4} = require('uuid');




exports.landingPage = async (req, res) => {


  try {
    
  const {userActive} = await indexservices.landingPage(req)
  const joinCommunityModal = !req.session.showJoinCommunity

    if (req.isAPI){
     return res.json({
        success:true,
        data: {userActive, joinCommunityModal}
      })
    }

        res.render('index', {
            joinCommunityModal,
            userActive
        })

  } catch (error) {
    console.error(`Error fetching landing: ${error}`);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/');
  }
}





