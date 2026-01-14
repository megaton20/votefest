

class indexServices {

  static async landingPage(req) {
    let userActive = false;

    if (req.user) {
      userActive = true;

    }
    return { userActive }
  }


}

module.exports = indexServices;