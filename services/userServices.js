const Contestant = require("../models/Contestant");
const Queries = require('../config/queries');
const User = require("../models/User");

class userServices {

  static async dashboard(req) {
    try {

      const user = await User.findById(req.user.id);
      const dashboard = await User.getDashboard(user.id);
      const recentVotes = await User.getRecentVotes(user.id);

      return { userActive: true, dashboard, recentVotes, success: true, user }
    } catch (error) {
      return { message: 'Error geting dashboard page', success: false, error }

    }
  }


  static async viewContestantPage(id, req) {
    try {
      let userActive = false;

      const contestant = await Contestant.findById(id);


      if (!contestant || contestant == null) {
        return { userActive, success: false, message: 'Contestant not found' };
      }

      const comments = await Queries.getCommentsByContestant(contestant.id);
      const contestants = await Contestant.findAll();



      if (req.user) {
        userActive = true;
      }

      return {
        success: true,
        userActive,
        contestant,
        comments,
        contestants
      }
    } catch (error) {
      return { message: 'Error geting single contestant', error }

    }
  }


}

module.exports = userServices;