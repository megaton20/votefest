const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const sendEmail = async (to, subject, html) => {
  const mailData = {
    sender: {
      name: "True Series Academy",
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

    console.log(`Email sent, message ID: ${response.data.messageId}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.response?.data || err.message);
    return false;
  }
};

module.exports = sendEmail;