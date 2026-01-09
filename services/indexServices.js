

class indexServices {

  static async landingPage(req) {
    let userActive = false;

    if (req.user) {
      userActive = true;

    }
    return { userActive }
  }


  static async termsPage(req) {
    let userActive = false;
    if (req.user) {
      userActive = true;
    }
    return { userActive }
  }
  static async readmorePage(req) {
    let userActive = false;
    if (req.user) {
      userActive = true;
    }
    return { userActive }
  }

  static async affiliateInfoPage(req) {
    let userActive = false;
    if (req.user) {
      userActive = true;
    }
    return { userActive }
  }


  static async affiliateTermsPage(req) {
    let userActive = false;
    if (req.user) {
      userActive = true;
    }
    return { userActive }
  }
  static async termsPage(req) {
    let userActive = false;
    if (req.user) {
      userActive = true;
    }
    return { userActive }
  }

  static async registerPage(req) {
    let userActive = false;

    const referrerCode = req.query.ref || null;

    if (referrerCode) {
      req.session.referrerCode = referrerCode
    }

    return { userActive, referrerCode }
  }
  static async forgetPage(req) {
    let userActive = false;

    return { userActive }
  }

}

module.exports = indexServices;