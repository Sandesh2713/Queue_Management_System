const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const emailTemplates = require('./src/email_templates');

// Load Env
const envPath = path.join(__dirname, '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

console.log('SMTP Config:', {
    user: smtpUser ? 'Set' : 'Missing',
    pass: smtpPass ? 'Set' : 'Missing'
});

if (!smtpUser || !smtpPass) {
    console.error('CRITICAL: SMTP Credentials Missing. Email will NOT send.');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
});

async function testSend() {
    console.log('Generating OTP content...');
    const content = emailTemplates.otp('123456');
    console.log('Content Type:', typeof content);
    console.log('Content Length:', content.length);
    console.log('Content Preview:', content.substring(0, 50));

    const htmlContent = content;

    // Fallback logic
    const textContent = htmlContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    console.log('Text Fallback Preview:', textContent.substring(0, 50));

    const mailOptions = {
        from: `"GetEzi Debug" <${smtpUser}>`,
        to: smtpUser, // Send to self
        subject: 'Debug Email Test',
        html: htmlContent,
        text: textContent
    };

    console.log('Sending via Nodemailer...');
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('SUCCESS: Email sent!', info.messageId);
    } catch (err) {
        console.error('FAILURE: Error sending email:', err);
    }
}

testSend();
