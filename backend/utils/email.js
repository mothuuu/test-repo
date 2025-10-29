const axios = require('axios');

/**
 * Send email using various providers
 * Configure your preferred email service in .env
 */

async function sendEmail({ to, subject, html, text }) {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  
  try {
    switch (provider) {
      case 'sendgrid':
        return await sendWithSendGrid({ to, subject, html, text });
      
      case 'mailgun':
        return await sendWithMailgun({ to, subject, html, text });
      
      case 'ses':
        return await sendWithSES({ to, subject, html, text });
      
      case 'gmail':  // ← ADD THIS
        return await sendWithGmail({ to, subject, html, text });
      
      case 'console':
      default:
        console.log('\n📧 ===== EMAIL (CONSOLE MODE) =====');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Body:', text || html);
        console.log('=====================================\n');
        return { success: true, provider: 'console' };
    }
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Gmail implementation using nodemailer
async function sendWithGmail({ to, subject, html, text }) {
  // First, install nodemailer: npm install nodemailer
  const nodemailer = require('nodemailer');
  
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;
  const FROM_NAME = process.env.FROM_NAME || 'AI Visibility Score';
  
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });
  
  // Send email
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: to,
    subject: subject,
    html: html,
    text: text
  });
  
  return { success: true, provider: 'gmail', messageId: info.messageId };
}

// SendGrid implementation
async function sendWithSendGrid({ to, subject, html, text }) {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
  const FROM_NAME = process.env.FROM_NAME || 'AI Visibility Score';
  
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY not configured');
  }
  
  const response = await axios.post(
    'https://api.sendgrid.com/v3/mail/send',
    {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: subject,
      content: [
        { type: 'text/html', value: html || text },
        ...(text ? [{ type: 'text/plain', value: text }] : [])
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return { success: true, provider: 'sendgrid', messageId: response.headers['x-message-id'] };
}

// Mailgun implementation
async function sendWithMailgun({ to, subject, html, text }) {
  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
  const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
  const FROM_EMAIL = process.env.FROM_EMAIL || `noreply@${MAILGUN_DOMAIN}`;
  const FROM_NAME = process.env.FROM_NAME || 'AI Visibility Score';
  
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error('MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
  }
  
  const formData = new URLSearchParams();
  formData.append('from', `${FROM_NAME} <${FROM_EMAIL}>`);
  formData.append('to', to);
  formData.append('subject', subject);
  if (html) formData.append('html', html);
  if (text) formData.append('text', text);
  
  const response = await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    formData,
    {
      auth: {
        username: 'api',
        password: MAILGUN_API_KEY
      }
    }
  );
  
  return { success: true, provider: 'mailgun', messageId: response.data.id };
}

// AWS SES implementation (requires AWS SDK)
async function sendWithSES({ to, subject, html, text }) {
  // Note: This requires installing @aws-sdk/client-ses
  // npm install @aws-sdk/client-ses
  
  try {
    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    
    const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    
    const client = new SESClient({ 
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: html ? { Data: html } : undefined,
          Text: text ? { Data: text } : undefined
        }
      }
    });
    
    const response = await client.send(command);
    return { success: true, provider: 'ses', messageId: response.MessageId };
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error('AWS SES SDK not installed. Run: npm install @aws-sdk/client-ses');
    }
    throw error;
  }
}

// ============================================
// AUTH-SPECIFIC EMAIL FUNCTIONS
// ============================================

/**
 * Send email verification email
 */
async function sendVerificationEmail(email, token) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8000';
  const verificationUrl = `${FRONTEND_URL}/verify.html?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .token-box { background: white; padding: 15px; border-left: 4px solid #00B9DA; margin: 20px 0; font-family: monospace; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hello!</p>
          <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
          <center>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </center>
          <p>Or copy and paste this link into your browser:</p>
          <div class="token-box">${verificationUrl}</div>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>This link will expire in 24 hours.</p>
          <p>&copy; ${new Date().getFullYear()} AI Marketing Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Verify Your Email
    
    Thank you for signing up! Please verify your email address by visiting:
    ${verificationUrl}
    
    If you didn't create an account, you can safely ignore this email.
    
    This link will expire in 24 hours.
  `;
  
  return await sendEmail({
    to: email,
    subject: 'Verify Your Email Address',
    html,
    text
  });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8000';
  const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .token-box { background: white; padding: 15px; border-left: 4px solid #00B9DA; margin: 20px 0; font-family: monospace; word-break: break-all; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hello!</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>
          <p>Or copy and paste this link into your browser:</p>
          <div class="token-box">${resetUrl}</div>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
          </div>
        </div>
        <div class="footer">
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>&copy; ${new Date().getFullYear()} AI Marketing Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Reset Your Password
    
    We received a request to reset your password. Visit this link to create a new password:
    ${resetUrl}
    
    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
    
    This link will expire in 1 hour for security reasons.
  `;
  
  return await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text
  });
}

/**
 * Send waitlist confirmation email to user
 */
async function sendWaitlistConfirmationEmail(email, name, plan) {
  const planNames = {
    premium: 'Premium Plan ($99/month)',
    pro: 'Pro Plan ($99/month)',
    agency: 'Agency Plan ($499/month)'
  };

  const planFeatures = {
    premium: [
      'Track 15 pages with unlimited scans',
      '30+ detailed recommendations per scan',
      'Advanced FAQ generation & schema',
      'Competitive analysis reports',
      'Priority email support',
      'PDF & CSV export',
      'API access for integrations'
    ],
    pro: [
      'Track 15 pages with unlimited scans',
      '30+ detailed recommendations per scan',
      'Advanced FAQ generation & schema',
      'Competitive analysis reports',
      'Priority email support',
      'PDF & CSV export',
      'API access for integrations'
    ],
    agency: [
      'Track 50 pages across multiple domains',
      'White-label reporting',
      'Client management dashboard',
      'Advanced analytics & insights',
      'Dedicated account manager',
      'Custom integrations',
      'Reseller pricing available',
      'Priority phone & email support'
    ]
  };

  const planName = planNames[plan] || 'Premium Plan';
  const features = planFeatures[plan] || planFeatures.premium;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
        .content { background: #f9f9f9; padding: 40px 30px; }
        .plan-box { background: white; border: 2px solid #00B9DA; border-radius: 10px; padding: 25px; margin: 25px 0; }
        .plan-name { font-size: 24px; font-weight: bold; color: #00B9DA; margin-bottom: 15px; }
        .features { list-style: none; padding: 0; margin: 20px 0; }
        .features li { padding: 10px 0; padding-left: 30px; position: relative; }
        .features li:before { content: "✓"; position: absolute; left: 0; color: #00B9DA; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; padding: 20px; }
        .cta-box { background: #e7f3ff; border-left: 4px solid #00B9DA; padding: 20px; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="badge">COMING SOON</div>
          <h1 style="margin: 0; font-size: 32px;">You're on the Waitlist! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Thank you for your interest in the <strong>${planName}</strong>! We're excited to have you on our waitlist.</p>

          <div class="plan-box">
            <div class="plan-name">${planName}</div>
            <ul class="features">
              ${features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
          </div>

          <div class="cta-box">
            <h3 style="margin-top: 0; color: #00B9DA;">What happens next?</h3>
            <p style="margin-bottom: 8px;">✓ We'll email you as soon as the ${plan} plan launches</p>
            <p style="margin-bottom: 8px;">✓ You'll get exclusive early-bird pricing</p>
            <p style="margin-bottom: 0;">✓ Priority onboarding and dedicated support</p>
          </div>

          <p>In the meantime, if you have any questions or would like to learn more, feel free to reply to this email.</p>

          <p>Best regards,<br>
          The AI Visibility Score Team<br>
          <a href="mailto:aivisibility@xeo.marketing" style="color: #00B9DA;">aivisibility@xeo.marketing</a></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} AI Visibility Score by Xeo Marketing. All rights reserved.</p>
          <p><a href="https://xeo.marketing" style="color: #00B9DA; text-decoration: none;">xeo.marketing</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    You're on the Waitlist!

    Hi ${name},

    Thank you for your interest in the ${planName}! We're excited to have you on our waitlist.

    What's included in ${planName}:
    ${features.map(f => `• ${f}`).join('\n')}

    What happens next?
    ✓ We'll email you as soon as the ${plan} plan launches
    ✓ You'll get exclusive early-bird pricing
    ✓ Priority onboarding and dedicated support

    In the meantime, if you have any questions or would like to learn more, feel free to reply to this email.

    Best regards,
    The AI Visibility Score Team
    aivisibility@xeo.marketing
  `;

  return await sendEmail({
    to: email,
    subject: `You're on the ${planName} Waitlist! 🎉`,
    html,
    text
  });
}

/**
 * Send admin notification email about new waitlist signup
 */
async function sendWaitlistAdminNotification(waitlistData) {
  const { name, email, plan, company, website, currentPlan, message } = waitlistData;

  const planNames = {
    premium: 'Premium Plan ($99/month)',
    pro: 'Pro Plan ($99/month)',
    agency: 'Agency Plan ($499/month)'
  };

  const planName = planNames[plan] || plan;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F31C7E 0%, #7030A0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; border-left: 4px solid #F31C7E; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; margin-bottom: 12px; }
        .info-label { font-weight: bold; min-width: 150px; color: #7030A0; }
        .info-value { color: #333; }
        .message-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🚀 New Waitlist Signup!</h1>
        </div>
        <div class="content">
          <p><strong>Someone just joined the ${planName} waitlist!</strong></p>

          <div class="info-box">
            <div class="info-row">
              <div class="info-label">Name:</div>
              <div class="info-value">${name}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value"><a href="mailto:${email}">${email}</a></div>
            </div>
            <div class="info-row">
              <div class="info-label">Plan:</div>
              <div class="info-value">${planName}</div>
            </div>
            ${company ? `
              <div class="info-row">
                <div class="info-label">Company:</div>
                <div class="info-value">${company}</div>
              </div>
            ` : ''}
            ${website ? `
              <div class="info-row">
                <div class="info-label">Website:</div>
                <div class="info-value"><a href="${website}" target="_blank">${website}</a></div>
              </div>
            ` : ''}
            ${currentPlan ? `
              <div class="info-row">
                <div class="info-label">Current Plan:</div>
                <div class="info-value">${currentPlan}</div>
              </div>
            ` : ''}
            <div class="info-row">
              <div class="info-label">Joined:</div>
              <div class="info-value">${new Date().toLocaleString()}</div>
            </div>
          </div>

          ${message ? `
            <div class="message-box">
              <strong>Their message:</strong>
              <p style="margin: 10px 0 0 0;">${message}</p>
            </div>
          ` : ''}

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            <strong>Action:</strong> Consider reaching out to high-value prospects or those with specific questions.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    New Waitlist Signup!

    Someone just joined the ${planName} waitlist!

    Details:
    Name: ${name}
    Email: ${email}
    Plan: ${planName}
    ${company ? `Company: ${company}` : ''}
    ${website ? `Website: ${website}` : ''}
    ${currentPlan ? `Current Plan: ${currentPlan}` : ''}
    Joined: ${new Date().toLocaleString()}

    ${message ? `Their message:\n${message}` : ''}

    Action: Consider reaching out to high-value prospects or those with specific questions.
  `;

  return await sendEmail({
    to: 'aivisibility@xeo.marketing',
    subject: `🚀 New ${planName} Waitlist Signup - ${name}`,
    html,
    text
  });
}

// Export all functions
module.exports = {
  sendEmail,
  sendWithSendGrid,
  sendWithMailgun,
  sendWithSES,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWaitlistConfirmationEmail,
  sendWaitlistAdminNotification
};