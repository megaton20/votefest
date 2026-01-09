const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require("./db");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const {v4:uuidv4} = require('uuid')
require('dotenv').config();
const User = require('../models/User');


let globalReferralCode;

// Passport session setup
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.getById(id);

    if (user.length === 0) {
      console.warn(`User with ID ${id} not found during deserialization.`);
      return done(null, false); // User not found, return false
    }

    done(null, user); // User found, return the user object
  } catch (err) {
    console.error(`Error during deserialization of user with ID ${id}:`, err);
    done(err, null); 
  }
});





// Local strategy for traditional login
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {

    
    // Query the database for a user with the provided email
    const user = await User.findByEmail(email);

    // Check if any user was found
    if (!user) {
      return done(null, false, { message: 'User does not exist' });
    }


    // Check if the user has a password set (indicating they did not sign up via Google)
    if (!user.password_hash) {
      return done(null, false, { message: 'Use Google to sign into that account' });
    }

    // Compare the provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return done(null, false, { message: 'Incorrect email or password' });
    }

    // If everything is okay, return the user object
    return done(null, user);
  } catch (err) {
    // Log any errors and return an error response
    console.error('Error during authentication:', err);
    return done(err);
  }
}));






module.exports = passport;
