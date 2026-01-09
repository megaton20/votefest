const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const sendVerificationEmail = async (email, token, req, res) => {
  const verificationUrl = `${process.env.LIVE_DIRR || 'http://localhost:2000'}/auth/verify-email?token=${token}`;
  
  const mailData = {
    sender: {
      name: "TSA",
      email: process.env.EMAIL,
    },
    to: [
      {
        email: email,
      }
    ],
    subject: 'Confirm Your Email Address',
    htmlContent: `
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #ffffff; background-color: #41afa5; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>If you did not create an account with us, please disregard this email.</p>
    `
  };

  try {
    const response = await axios.post(BREVO_API_URL, mailData, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
    });

    console.log(`Verification email sent to ${email}, message ID: ${response.data.messageId}`);
    req.flash('success_msg', `Check your mail inbox or spam to activate your account`);
    return res.redirect('/auth/verify-email-sent');
    
  } catch (err) {
    console.error(`Error sending verification email to ${email}:`, err.response?.data || err.message);
    req.flash('error_msg', `Error from our server... try to verify your email again after 30 minutes`);
    return res.redirect('/auth/verify-alert');
  }
};

// If you want to keep the general sendEmail function too:
const sendEmail = async (to, subject, html) => {
  const mailData = {
    sender: {
      name: "TSA",
      email: process.env.EMAIL
    },
    to: [
      {
        email: to,
      }
    ],
    subject: subject,
    htmlContent: html,
  };

  try {
    const response = await axios.post(BREVO_API_URL, mailData, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
    });

    console.log(`Email sent to ${to}, message ID: ${response.data.messageId}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.response?.data || err.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendEmail
};