const getBaseUrl = () => {
  return process.env.LIVE_DIRR || process.env.NGROK || `http://localhost:${process.env.PORT}`;
};

const teaEmailWrapper = (subject, content) => `
  <div style="font-family: 'Segoe UI', sans-serif; background: #f4f4f4; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(90deg,rgba(17, 114, 49, 1),rgba(25, 200, 133, 1)); padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0;">True Series Academy</h1>
        <p style="margin: 0; font-size: 14px;">${subject}</p>
      </div>
      <div style="padding: 30px;">
        ${content}
      </div>
      <div style="background: #fafafa; text-align: center; font-size: 12px; padding: 20px; color: #888;">
        &copy; ${new Date().getFullYear()} True Series Academy – All rights reserved.
      </div>
    </div>
  </div>
`;

const paymentReminderTemplate = (user) => teaEmailWrapper(
  "Complete Your Payment",
  `
    <h3>Complete Your Payment</h3>
    <p>Hi ${user.full_name},</p>
    <p>We noticed you haven't completed your payment. Don't miss out on upcoming classes and materials!</p>
    <p><a href="${getBaseUrl()}/user">Click here to complete your payment</a></p>
    <p>– True Series Academy Team</p>
  `
);

const welcomeToClassTemplate = (user, session) => teaEmailWrapper(
  `Welcome to ${session.title}`,
  `
    <p>Hi ${user.full_name},</p>
    <p>You've successfully joined the class "<strong>${session.title}</strong>".</p>
    <p>Session Details:</p>
    <ul>
      <li><strong>Date & Time:</strong> ${new Date(session.scheduled_at).toLocaleString()}</li>
      <li><strong>Meeting Link:</strong> <a href="${session.meet_link}">Join Class</a></li>
    </ul>
    <p>Glad to have you on board!</p>
    <p>– True Series Academy Team</p>
  `
);

const dayBeforeTemplate = (user, sessions) => teaEmailWrapper(
  `Upcoming Class${sessions.length > 1 ? 'es' : ''} Reminder`,
  `
    <h3>Class Reminder: Upcoming Sessions</h3>
    <p>Hi ${user.full_name},</p>
    <p>This is a reminder that you have the following class${sessions.length > 1 ? 'es' : ''} scheduled for tomorrow:</p>
    <ul>
      ${sessions.map(session => `
        <li>
          <strong>${session.title}</strong><br/>
          <strong>Date:</strong> ${new Date(session.scheduled_at).toLocaleString()}<br/>
          <p><a href="${getBaseUrl()}/user">Read more...</a></p>
        </li>
      `).join('')}
    </ul>
    <p>Please be prepared and join on time.</p>
    <p>– True Series Academy Team</p>
  `
);
const dayReminderTemplate = (user, sessions) => teaEmailWrapper(
  `Upcoming Class${sessions.length > 1 ? 'es' : ''} Reminder`,
  `
    <h3>Class Reminder: Upcoming Sessions</h3>
    <p>Hi ${user.full_name},</p>
    <p>This is a reminder that you have the following class${sessions.length > 1 ? 'es' : ''} scheduled for today:</p>
    <ul>
      ${sessions.map(session => `
        <li>
          <strong>${session.title}</strong><br/>
          <strong>Date:</strong> ${new Date(session.scheduled_at).toLocaleString()}<br/>
          <p><a href="${getBaseUrl()}/user">Read more...</a></p>
        </li>
      `).join('')}
    </ul>
    <p>Please be prepared and join on time.</p>
    <p>– True Series Academy Team</p>
  `
);

const resetPasswordTemplate = (resetLink) => teaEmailWrapper(
  "Reset Your Password",
  `
    <p>Reset your password by clicking the button below:</p>
    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #41afa5; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>If you did not request this, please ignore this email.</p>
  `
);

const verificationEmailSentTemplate = (resetLink) => teaEmailWrapper(
  "Verify your email",
  `
    <p>Visit your dashboard by clicking the button below:</p>
    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #41afa5; text-decoration: none; border-radius: 5px;">Verify Email</a>
    <p>If you did not request this, please ignore this email.</p>
  `
);

const welcomeToAppTemplate = (user) => teaEmailWrapper(
  `Welcome to True Series Academy`,
  `
    <p>Dear ${user.full_name},</p>
    
    <p>A very warm welcome to <strong>True Series Academy</strong>! We're absolutely delighted to have you join our learning community.</p>
    
    <p>Your account has been successfully activated, and you now have access to all the resources and features our platform has to offer.</p>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>🎯 What you can do now:</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Browse and enroll in courses/ programs</li>
        <li>Access your learning dashboard</li>
        <li>Track your progress</li>
        <li>Connect with instructors and peers in this community </li>
      </ul>
    </div>

    <p>We're committed to providing you with exceptional learning experiences that empower your growth and success.</p>
        
    <p>If you have any questions or need assistance, our support team is always here to help.</p>
    
    <p>Happy learning! 🎓</p>
    
    <p>Warm regards,<br>
    <strong>The True Series Academy Team</strong></p>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px;">
      <p>Need help? Contact us at support@trueseriesacademy.com</p>
    </div>
  `
);


const christmasWishesTemplate = (user) => teaEmailWrapper(
  "Season's Greetings from True Series Academy",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>As the year draws to a close, we wanted to take a moment to extend our warmest Christmas wishes to you and your loved ones. 🎄</p>
    
    <div style="text-align: center; margin: 25px 0;">
      <div style="color: #d63031; font-size: 18px; font-weight: bold; margin: 10px 0;">May this festive season fill your home with joy, your heart with love, and your life with laughter.</div>
    </div>
    
    <p>Thank you for being part of our learning community this year. We're grateful for your trust and dedication to growing with us.</p>
    
    <p>May the Christmas spirit bring you peace, the new year bring you hope, and the coming days bring you continued success in all your learning endeavors.</p>
    
    <p style="text-align: center; font-style: italic; color: #2d3436; margin: 25px 0;">
      Wishing you a Merry Christmas and a bright, prosperous New Year!
    </p>
    
    <p>Warmest regards,<br>
    <strong>The True Series Academy Team</strong></p>
    <p> Read more <a href="${getBaseUrl}">here</a> </p>
  `
);

const christmasBreakAnnouncementTemplate = (user, resumeDate) => teaEmailWrapper(
  "Holiday Break Schedule",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>As we approach the holiday season, we wanted to inform you about our Christmas break schedule.</p>
    
    <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0;"><strong>📅 Break Period:</strong></p>
      <p style="margin: 10px 0 0 0;">All classes will be paused from <strong>December 24th</strong> and will resume on <strong>${new Date(resumeDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>
    </div>
    
    <p><strong>During the break:</strong></p>
    <ul>
      <li>No live sessions will be scheduled</li>
      <li>Recorded materials remain accessible</li>
      <li>Support responses may be delayed</li>
      <li>Forum discussions will remain open</li>
    </ul>
    
    <p>We encourage you to use this time to:</p>
    <ol>
      <li>Review course materials at your own pace</li>
      <li>Complete any pending assignments</li>
      <li>Rest and recharge for the coming year</li>
    </ol>
    
    <p>Use this time to reflect on your learning journey and set goals for the new year!</p>
    
    <p>We look forward to continuing our educational journey together in January. Until then, stay safe and enjoy the festivities! 🎅</p>
    
    <p>Best wishes,<br>
    <strong>The True Series Academy Team</strong></p>
     <p> Read more <a href="${getBaseUrl}">here</a> </p>
  `
);

const newYearResumptionTemplate = (user) => teaEmailWrapper(
  "Welcome Back! Classes Resume",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>Happy New Year! 🎉 We hope you had a wonderful holiday season filled with joy and relaxation.</p>
    
    <p>We're excited to welcome you back as we resume our regular class schedule starting today!</p>
    
    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0;"><strong>📚 What's Next:</strong></p>
      <p style="margin: 10px 0 0 0;">Check your dashboard for updated schedules and any new materials that have been added during the break.</p>
    </div>
    
    <p><strong>To help you get back on track:</strong></p>
    <ul>
      <li>Review your course progress before the next session</li>
      <li>Check for any announcements from your instructors</li>
      <li>Join our New Year goal-setting discussion in the forums</li>
      <li>Reach out if you need help catching up</li>
    </ul>
    
    <p>This new year brings fresh opportunities for learning and growth. Let's make it your most productive learning year yet!</p>
    
    <p>We're thrilled to continue supporting your educational journey in ${new Date().getFullYear()}.</p>
    
    <p>Here's to a year of new knowledge, skills, and achievements! 🚀</p>
    
    <p>Welcome back,<br>
    <strong>The True Series Academy Team</strong></p>
     <p> Read more <a href="${getBaseUrl}">here</a> </p>
  `
);

const easterWishesTemplate = (user) => teaEmailWrapper(
  "Happy Easter from True Series Academy",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>As spring blossoms around us, we wanted to extend our warmest Easter greetings to you and your family! 🐣</p>
    
    <div style="text-align: center; margin: 25px 0;">
      <div style="background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 20px; font-weight: bold; margin: 10px 0;">
        May this Easter season bring you renewed hope, fresh inspiration, and joyful learning moments.
      </div>
    </div>
    
    <p>Easter symbolizes new beginnings and renewal—perfect timing to revisit your learning goals and celebrate the progress you've made.</p>
    
    <p>Remember that growth, like spring, happens one step at a time. Every lesson learned, every challenge overcome, brings you closer to your goals.</p>
    
    <p style="text-align: center; font-style: italic; color: #2d3436; margin: 25px 0;">
      Wishing you a blessed Easter filled with peace, joy, and meaningful connections.
    </p>
    
    <p>Warm regards,<br>
    <strong>The True Series Academy Team</strong></p>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; text-align: center;">
      <p>P.S. Don't forget to check for any special Easter-themed learning resources in your dashboard! 🎨</p>
    </div>
  `
);

const thanksgivingWishesTemplate = (user) => teaEmailWrapper(
  "Happy Thanksgiving from Our Learning Family",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>As we gather with loved ones to give thanks, we wanted to express our heartfelt gratitude for having you as part of our True Series Academy community. 🍂</p>
    
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; text-align: center; font-size: 16px;">
        <strong>We're thankful for:</strong><br>
        Your dedication to learning<br>
        Your curiosity and questions<br>
        Your presence in our community<br>
        The opportunity to be part of your growth journey
      </p>
    </div>
    
    <p>This Thanksgiving, we encourage you to reflect on:</p>
    <ul>
      <li>The knowledge you've gained this year</li>
      <li>The challenges you've overcome</li>
      <li>The connections you've made</li>
      <li>The growth you've experienced</li>
    </ul>
    
    <p>Every step in learning is worth celebrating, and we're grateful to walk this path with you.</p>
    
    <p>May your Thanksgiving be filled with warmth, good food, cherished company, and moments of reflection on all there is to be thankful for.</p>
    
    <p>With appreciation,<br>
    <strong>The True Series Academy Team</strong></p>
  `
);

const worldTeachersDayTemplate = (user) => teaEmailWrapper(
  "Celebrating World Teachers' Day",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>On this World Teachers' Day, we celebrate the incredible educators who light the path of knowledge and inspire growth every day. 👩‍🏫👨‍🏫</p>
    
    <div style="text-align: center; margin: 25px 0;">
      <div style="color: #0984e3; font-size: 18px; font-weight: bold; margin: 10px 0;">
        "Teachers plant seeds of knowledge that grow forever."
      </div>
    </div>
    
    <p>Today, we honor:</p>
    <ul>
      <li>Our dedicated instructors who go above and beyond</li>
      <li>Every mentor who provides guidance and support</li>
      <li>The teaching assistants who help light the way</li>
      <li>And <strong>YOU</strong>—because in our community, we all learn from each other</li>
    </ul>
    
    <p><strong>Special Initiative:</strong> We're featuring inspiring teacher stories on our platform this week. Share your learning experiences or thank a teacher who made a difference!</p>
    
    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>🎁 Student Appreciation:</strong><br>
      As our way of saying thank you for being part of our learning community, enjoy a special learning resource in your dashboard today!</p>
    </div>
    
    <p>Let's take a moment to appreciate the educators in our lives and the transformative power of teaching.</p>
    
    <p>With gratitude,<br>
    <strong>The True Series Academy Team</strong></p>
  `
);

const internationalDayOfEducationTemplate = (user) => teaEmailWrapper(
  "Celebrating International Day of Education",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>Today, on International Day of Education, we join the global community in celebrating the transformative power of learning! 📚🌍</p>
    
    <div style="background: linear-gradient(90deg, #00b4db, #0083b0); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 18px; font-weight: bold;">
        "Education is the most powerful weapon which you can use to change the world."<br>
        <span style="font-size: 14px; font-weight: normal;">- Nelson Mandela</span>
      </p>
    </div>
    
    <p><strong>Why This Day Matters:</strong></p>
    <ul>
      <li>Education is a fundamental human right</li>
      <li>Learning breaks cycles of poverty</li>
      <li>Knowledge promotes peace and understanding</li>
      <li>Education drives sustainable development</li>
    </ul>
    
    <p><strong>Our Commitment:</strong> At True Series Academy, we're proud to be part of your educational journey and contribute to making quality learning accessible.</p>
    
    <div style="border: 2px dashed #00b4db; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; text-align: center;">
        <strong>Join Our Celebration:</strong><br>
        Share what education means to you using #EducationDay on social media<br>
        Tag us for a chance to be featured!
      </p>
    </div>
    
    <p>Thank you for choosing to invest in your education. Every lesson learned contributes not only to your personal growth but to building a better world.</p>
    
    <p>Keep learning, keep growing,<br>
    <strong>The True Series Academy Team</strong></p>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 12px; text-align: center;">
      <p>Together, we're part of a global movement for education and lifelong learning.</p>
    </div>
  `
);

const worldBookDayTemplate = (user) => teaEmailWrapper(
  "Happy World Book Day!",
  `
    <p>Dear ${user.full_name},</p>
    
    <p>Happy World Book Day! Today we celebrate the magic of books and the joy of reading. 📖✨</p>
    
    <div style="background: #f5f5dc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #8b4513;">
      <p style="margin: 0; font-style: italic; text-align: center;">
        "A book is a dream that you hold in your hand."<br>
        <span style="font-size: 14px;">- Neil Gaiman</span>
      </p>
    </div>
    
    <p><strong>Celebrate With Us:</strong></p>
    <ul>
      <li>Share your favorite learning-related book in our community forum</li>
      <li>Check out our curated reading list in your dashboard</li>
      <li>Join our virtual book discussion this Friday</li>
      <li>Download a special World Book Day learning resource</li>
    </ul>
    
    <p><strong>Reading Recommendations from Our Team:</strong></p>
    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
      <div style="flex: 1; min-width: 200px; background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <strong>For Skill Development:</strong><br>
        • "Deep Work" by Cal Newport<br>
        • "Atomic Habits" by James Clear
      </div>
      <div style="flex: 1; min-width: 200px; background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <strong>For Inspiration:</strong><br>
        • "Educated" by Tara Westover<br>
        • "Mindset" by Carol Dweck
      </div>
    </div>
    
    <p>Whether you prefer physical books, e-books, or audiobooks, remember that every page turned is a step toward new understanding.</p>
    
    <p>Happy reading and learning!<br>
    <strong>The True Series Academy Team</strong></p>
    
    <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 5px; text-align: center;">
      <p style="margin: 0; font-size: 14px;">
        <strong>P.S.</strong> What book has influenced your learning journey the most?<br>
        Reply to this email and share your story—we'd love to hear!
      </p>
    </div>
  `
);



module.exports = {
  paymentReminderTemplate,
  welcomeToClassTemplate,
  dayReminderTemplate,
  dayBeforeTemplate,
  resetPasswordTemplate,
  verificationEmailSentTemplate,
  welcomeToAppTemplate,

    // Holiday templates
  christmasWishesTemplate,
  christmasBreakAnnouncementTemplate,
  newYearResumptionTemplate,
  easterWishesTemplate,
  thanksgivingWishesTemplate,
  // World Day templates
  worldTeachersDayTemplate,
  internationalDayOfEducationTemplate,
  worldBookDayTemplate
};