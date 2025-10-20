const axios = require('axios');

/**
 * Send email using various providers
 * Configure your preferred email service in .env
 */

async function sendEmail({ to, subject, html, text }) {
  const provider = process.env.EMAIL_PROVIDER || 'console'; // console, sendgrid, mailgun, ses
  
  try {
    switch (provider) {
      case 'sendgrid':
        return await sendWithSendGrid({ to, subject, html, text });
      
      case 'mailgun':
        return await sendWithMailgun({ to, subject, html, text });
      
      case 'ses':
        return await sendWithSES({ to, subject, html, text });
      
      case 'console':
      default:
        // For development - just log to console
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

// Export all functions
module.exports = {
  sendEmail,
  sendWithSendGrid,
  sendWithMailgun,
  sendWithSES,
  sendVerificationEmail,
  sendPasswordResetEmail
};