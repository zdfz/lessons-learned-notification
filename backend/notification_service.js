// notification_service.js
// Node.js script for scheduled email notifications based on lesson deadlines
// Requirements: npm install mongodb @sendgrid/mail moment-timezone dotenv

require('dotenv').config();
const { MongoClient } = require('mongodb');
const sgMail = require('@sendgrid/mail');
const moment = require('moment-timezone');
const express = require('express');
const cors = require('cors');

// --- CONFIG ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dahomy991:XoN2XiEBbSsT8sJY@lessonlearned.aeouwdr.mongodb.net/?retryWrites=true&w=majority&appName=LessonLearned';
const DB_NAME = process.env.DB_NAME || 'LessonLearned';
const COLLECTION = process.env.COLLECTION || 'lessons';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM;
const RECIPIENTS = [
//   'hlemah.AlFaraj@starlinks-me.com',
//   'Daren.AbuGhoush@starlinks-me.com',
  'AbdulrhmanAlshehri.ai@gmail.com',
];
const TIMEZONE = 'Asia/Riyadh';

sgMail.setApiKey(SENDGRID_API_KEY);

// --- EXPRESS ENDPOINT FOR TIMELINE CHANGE ---
const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/notify-timeline-change', async (req, res) => {
  console.log('Received timeline change notification:', req.body);
  const lesson = req.body;
  if (!lesson || !lesson.Customer || !lesson.Timeline) {
    return res.status(400).json({ error: 'Missing lesson data' });
  }

  const subject = `Timeline Changed: ${lesson.Customer}, ${lesson.Issue || ''}`;
  const body =
    `The timeline for the following lesson has been changed:\n\n` +
    `Customer: ${lesson.Customer}\n` +
    `Platform: ${lesson.Platform || ''}\n` +
    `Issue: ${lesson.Issue || ''}\n` +
    `Detailed Description: ${lesson['Detailed Description'] || ''}\n` +
    `Impact Level: ${lesson['Impact Level'] || ''}\n` +
    `Liable Stakeholder: ${lesson['Liable Stakeholder'] || ''}\n` +
    `Preventive Action: ${lesson['Preventive Action'] || ''}\n` +
    `Lessons Learned: ${lesson['Lessons Learned'] || ''}\n` +
    `Status: ${lesson.Status || ''}\n` +
    `Timeline: ${lesson.Timeline}`;

  // Improved HTML email
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f6faf8; padding: 24px; color: #234c36;">
      <h2 style="color: #1f6a4a;">Timeline Changed for a Lesson</h2>
      <p style="font-size: 1.1em;">The timeline for the following lesson has been <b>changed</b>:</p>
      <table style="border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(31,106,74,0.06);">
        <tbody>
          <tr><td style="padding:8px 16px; font-weight:600;">Customer</td><td style="padding:8px 16px;">${lesson.Customer}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Platform</td><td style="padding:8px 16px;">${lesson.Platform || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Issue</td><td style="padding:8px 16px;">${lesson.Issue || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Detailed Description</td><td style="padding:8px 16px;">${lesson['Detailed Description'] || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Impact Level</td><td style="padding:8px 16px;">${lesson['Impact Level'] || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Liable Stakeholder</td><td style="padding:8px 16px;">${lesson['Liable Stakeholder'] || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Preventive Action</td><td style="padding:8px 16px;">${lesson['Preventive Action'] || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Lessons Learned</td><td style="padding:8px 16px;">${lesson['Lessons Learned'] || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600;">Status</td><td style="padding:8px 16px;">${lesson.Status || ''}</td></tr>
          <tr><td style="padding:8px 16px; font-weight:600; background:#e4ede9;">Timeline</td><td style="padding:8px 16px; background:#e4ede9; font-weight:600; color:#1f6a4a;">${lesson.Timeline}</td></tr>
        </tbody>
      </table>
      <p style="margin-top: 24px; color: #256c3a; font-size: 1em;">This is an automated notification from the Lessons Learned system.<br>If you have any questions, please contact your administrator.</p>
    </div>
  `;

  try {
    await sgMail.send({
      to: RECIPIENTS,
      from: SENDGRID_FROM,
      subject,
      text: body,
      html: htmlBody,
    });
    console.log('Timeline change notification email sent for:', lesson.Customer, '| Timeline:', lesson.Timeline);
    res.json({ success: true });
  } catch (err) {
    console.error('SendGrid error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Notification server running on port ${PORT}`));
}

// --- MAIN LOGIC ---
async function main() {
  const now = moment.tz(TIMEZONE);
  const targetDate = now.clone().add(3, 'days').startOf('day');

  const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(DB_NAME);
  const lessons = db.collection(COLLECTION);

  // Find lessons with Timeline exactly 3 days from now, not yet notified
  const query = {
    notified: { $ne: true },
    Timeline: { $exists: true, $ne: '' },
  };
  const all = await lessons.find(query).toArray();
  const toNotify = all.filter(lesson => {
    const timeline = moment.tz(lesson.Timeline, TIMEZONE);
    return timeline.isValid() && timeline.isSame(targetDate, 'day');
  });

  if (toNotify.length === 0) {
    console.log('No lessons to notify.');
    await client.close();
    return;
  }

  for (const lesson of toNotify) {
    const subject = `${lesson.Customer || 'Unknown'}, ${lesson.Issue || 'No Issue'}`;
    const body =
`This is a reminder that the deadline for the following lesson is in 3 days.\n\n` +
`Customer: ${lesson.Customer || ''}\n` +
`Platform: ${lesson.Platform || ''}\n` +
`Issue: ${lesson.Issue || ''}\n` +
`Detailed Description: ${lesson['Detailed Description'] || ''}\n` +
`Impact Level: ${lesson['Impact Level'] || ''}\n` +
`Liable Stakeholder: ${lesson['Liable Stakeholder'] || ''}\n` +
`Preventive Action: ${lesson['Preventive Action'] || ''}\n` +
`Lessons Learned: ${lesson['Lessons Learned'] || ''}\n` +
`Status: ${lesson.Status || ''}\n` +
`Timeline: ${lesson.Timeline || ''}`;

    try {
      await sgMail.send({
        to: RECIPIENTS,
        from: SENDGRID_FROM,
        subject,
        text: body,
      });
      // Mark as notified
      await lessons.updateOne({ _id: lesson._id }, { $set: { notified: true, notifiedAt: new Date() } });
      console.log(`Notification sent for lesson: ${subject}`);
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }
  await client.close();
}

/*
INSTRUCTIONS:
1. Create a .env file with:
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM=abdulrhmanalshehri.ai@gmail.com
2. Deploy this script as a cron job on Render (https://render.com/docs/cronjobs)
   - Set schedule: 0 8 * * *
   - Set timezone: Asia/Riyadh
   - Command: node notification_service.js
3. Ensure your MongoDB URI and collection are correct.
*/ 