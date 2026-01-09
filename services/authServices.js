const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const sendEmail = require('../utils/mailer');
const User = require('../models/User');
const { generateResetToken, verifyResetToken } = require("../config/jsonWebToken");
const { verificationEmailSentTemplate, welcomeToAppTemplate, resetPasswordTemplate } = require("../utils/templates");

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
    const { email, password } = body;
    
    try {
      // Validation
      if ( !email || !password) {
        return {
          success: false,
          error: 'Missing required fields',
          statusCode: 400
        };
      }
      const username = `user-${uuidv4()}`;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          error: 'Email is already taken',
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

  static async authenticateAPI(email, password) {
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await User.updateLastLogin(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
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
      await this.loginToSession(user, req);
      return { user };
    }
  }

  // ==================== EMAIL VERIFICATION ====================
  static async requestEmailVerification(email, baseUrl) {
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        return {
          success: false,
          error: 'User with this email does not exist',
          statusCode: 404
        };
      }

      if (user.is_email_verified) {
        return {
          success: false,
          error: 'This user email is already verified',
          statusCode: 400,
          alreadyVerified: true
        };
      }

      const token = generateResetToken(email);
      const tokenExpires = new Date(Date.now() + 3600000);

      const updateResults = await pool.query(
        `UPDATE users SET token_expires = $1, token = $2 WHERE id = $3`,
        [tokenExpires, token, user.id]
      );

      if (updateResults.rowCount < 1) {
        return {
          success: false,
          error: 'Unknown error occurred when requesting email token',
          statusCode: 500
        };
      }

      const resetLink = `${baseUrl}/auth/verify-email?token=${token}`;

      let emailDone = false;
      try {
        await sendEmail(
          email,
          "Verify your Email",
          verificationEmailSentTemplate(resetLink)
        );
        emailDone = true;
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      return {
        success: true,
        data: {
          message: emailDone
            ? 'Check your mail inbox or spam to activate your account'
            : 'Failed to send verification email. Please try again.',
          emailSent: emailDone,
          email: user.email
        }
      };

    } catch (error) {
      console.error('Email verification request error:', error);
      return {
        success: false,
        error: 'An error occurred while processing your request',
        statusCode: 500
      };
    }
  }

  static async verifyEmailCallback(token) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'Verification token is required',
          statusCode: 400
        };
      }

      const { rows: userResult } = await pool.query(
        'SELECT id, email, username, token_expires FROM users WHERE token = $1',
        [token]
      );

      if (userResult.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired token',
          statusCode: 400
        };
      }

      const user = userResult[0];

      if (new Date(user.token_expires) < new Date()) {
        return {
          success: false,
          error: 'Token has expired!',
          statusCode: 400
        };
      }

      // Verify JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.email !== user.email) {
          return {
            success: false,
            error: 'Token email mismatch',
            statusCode: 400
          };
        }
      } catch (jwtError) {
        return {
          success: false,
          error: 'Invalid token signature',
          statusCode: 400
        };
      }

      const updateResult = await pool.query(
        `UPDATE users 
         SET is_email_verified = true, token = NULL, token_expires = NULL 
         WHERE email = $1`,
        [user.email]
      );

      if (updateResult.rowCount < 1) {
        return {
          success: false,
          error: 'Failed to update user verification status',
          statusCode: 500
        };
      }

      sendEmail(user.email, "Welcome to unsaid", welcomeToAppTemplate(user))
        .catch(err => console.error('Welcome email failed:', err));

      return {
        success: true,
        data: {
          message: 'Email verified successfully',
          user: {
            id: user.id,
            email: user.email,
            username: user.username
          }
        }
      };

    } catch (error) {
      console.error('Email verification callback error:', error);
      return {
        success: false,
        error: error.message || 'An error occurred during email verification',
        statusCode: 500
      };
    }
  }

  static async checkEmailVerificationStatus(email) {
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      return {
        success: true,
        data: {
          email: user.email,
          isVerified: user.is_email_verified,
          fullName: user.username
        }
      };

    } catch (error) {
      console.error('Check verification status error:', error);
      return {
        success: false,
        error: 'Failed to check verification status',
        statusCode: 500
      };
    }
  }

  // ==================== PASSWORD RESET ====================
  static async requestPasswordReset(email, baseUrl) {
    try {
      if (!email) {
        return {
          success: false,
          error: 'Email is required',
          statusCode: 400
        };
      }

      const user = await User.findByEmail(email);

      if (!user) {
        return {
          success: false,
          error: 'Email not found in our records',
          statusCode: 404
        };
      }

      const token = generateResetToken(email);

      await pool.query(
        `UPDATE users SET token = $1, token_expires = $2 WHERE email = $3`,
        [token, new Date(Date.now() + 3600000), email]
      );

      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

      let emailSent = false;
      try {
        await sendEmail(
          email,
          'Password Reset Link',
          resetPasswordTemplate(resetLink)
        );
        emailSent = true;
      } catch (emailError) {
        console.error('Password reset email error:', emailError);
      }

      return {
        success: true,
        data: {
          message: emailSent
            ? 'Password reset instructions sent to your email'
            : 'Failed to send email. Please try again.',
          emailSent,
          email: user.email || email
        }
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        error: 'An error occurred while processing your request',
        statusCode: 500
      };
    }
  }

  static async verifyResetToken(token) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'Reset token is required',
          statusCode: 400
        };
      }

      const decoded = verifyResetToken(token);

      if (!decoded || !decoded.email) {
        return {
          success: false,
          error: 'Invalid or expired reset token',
          statusCode: 400
        };
      }

      const { rows } = await pool.query(
        `SELECT id, email FROM users WHERE email = $1`,
        [decoded.email]
      );

      if (rows.length === 0) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      return {
        success: true,
        data: {
          email: decoded.email,
          isValid: true
        }
      };

    } catch (error) {
      console.error('Token verification error:', error);
      return {
        success: false,
        error: 'Invalid reset token',
        statusCode: 400
      };
    }
  }

  static async changePasswordWithToken(token, password, confirmPassword) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'Reset token is required',
          statusCode: 400
        };
      }

      if (!password || !confirmPassword) {
        return {
          success: false,
          error: 'Password and confirmation are required',
          statusCode: 400
        };
      }

      if (password !== confirmPassword) {
        return {
          success: false,
          error: 'Passwords do not match',
          statusCode: 400
        };
      }

      if (password.length < 6) {
        return {
          success: false,
          error: 'Password must be at least 6 characters',
          statusCode: 400
        };
      }

      const decoded = verifyResetToken(token);

      if (!decoded || !decoded.email) {
        return {
          success: false,
          error: 'Invalid or expired reset token',
          statusCode: 400
        };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { rowCount } = await pool.query(
        `UPDATE users SET password_hash = $1, token = NULL, token_expires = NULL WHERE email = $2`,
        [hashedPassword, decoded.email]
      );

      if (rowCount === 0) {
        return {
          success: false,
          error: 'User not found or password update failed',
          statusCode: 404
        };
      }

      return {
        success: true,
        data: {
          message: 'Password changed successfully',
          email: decoded.email
        }
      };

    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        error: 'Failed to change password',
        statusCode: 500
      };
    }
  }
}

module.exports = AuthServices;