const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

class AuthServices {
  // ==================== PAGE RENDERING ====================
  static async registerPage(req) {
    let userActive = false;
    return { userActive };
  }

  static async loginPage(req) {
    let userActive = false;
    return { userActive };
  }

  // ==================== USER REGISTRATION ====================
  static async createUser(body) {
    const { email, username, password } = body;
    
    try {
      // Validation
      if ( !username || !password) {
        return {
          success: false,
          error: 'Missing required fields',
          statusCode: 400
        };
      }

      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return {
          success: false,
          message: 'username is already taken',
          statusCode: 409
        };
      }
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return {
          success: false,
          message: 'email is already is registered already',
          statusCode: 409
        };
      }

      // Create user
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        id: uuidv4(),
        username,
        email,
        passwordHash: hashedPassword,
        newWallet: uuidv4()
      });


      return {
        success: true,
        user
      };

    } catch (error) {
      console.error('Service error:', error);
      return {
        success: false,
        error: 'Something went wrong. Please try again.',
        statusCode: 500
      };
    }
  }

  // ==================== AUTHENTICATION ====================
  static async authenticateLocal(email, password, req) {
    return new Promise((resolve, reject) => {
      passport.authenticate('local', (err, user, info) => {
        if (err) {
          return reject(err);
        }
        if (!user) {
          const message = info?.message || 'Invalid email or password';
          return reject(new Error(message));
        }
        resolve(user);
      })(req);
    });
  }

  static async authenticateAPI(username, password) {
    try {
      const user = await User.findByUsername(username);

      if (!user) {
        throw new Error('Invalid username or password');
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid username or password');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      

      return {
        user,
        token
      };

    } catch (error) {
      throw error;
    }
  }

  static async loginToSession(user, req) {
    return new Promise((resolve, reject) => {
      req.login(user, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static async login(credentials, req) {
    const { email, password } = credentials;

    if (req.isAPI) {
      return await this.authenticateAPI(email, password);
    } else {
      const user = await this.authenticateLocal(email, password, req);
      // console.log(user);
      
      await this.loginToSession(user, req);
      return { user };
    }
  }



}

module.exports = AuthServices;