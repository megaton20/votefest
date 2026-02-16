const Contestant = require("../models/Contestant");
const Queries = require('../config/queries');

class indexServices {

  static async landingPage(req) {
    try {
      let user = null
      const contestants = await Contestant.findAll();    

      

      if (req.user) {
    
        user = req.user
      }
      return {  contestants, user, success:true}
    } catch (error) {
      return { message: 'Error geting landing page', success:false }

    }
  }


  static async viewContestantPage(id, req) {
    try {
 
      let user = null;

      const contestant = await Contestant.findById(id);

      
      if (!contestant || contestant == null) {
        return { user,success:false, message: 'Contestant not found' };
      }
      const contestants = await Contestant.findAll();
      


      if (req.user) {
        user = req.user
      }

      return {
        success:true,
        user,
        contestant,
        contestants
      }
    } catch (error) {
      return { message: 'Error geting single contestant', error }

    }
  }


}

module.exports = indexServices;