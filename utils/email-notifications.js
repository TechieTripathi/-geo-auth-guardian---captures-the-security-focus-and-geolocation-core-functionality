// utils/email-notifications.js
const nodemailer = require('nodemailer');
const config = require('../config/settings');
require("dotenv").config();

// Email transporter configuration
const transporter = nodemailer.createTransport({
  // Gmail configuration (you can change this to your email provider)
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your@gmail.com',
    pass: process.env.EMAIL_PASS || 'your - app -password'
  }
  
  // Alternative SMTP configuration
  // host: 'smtp.your-provider.com',
  // port: 587,
  // secure: false,
  // auth: {
  //   user: process.env.EMAIL_USER,
  //   pass: process.env.EMAIL_PASS
  // }
});

// Email templates
const emailTemplates = {
  suspiciousLogin: (data) => ({
    subject: `🚨 SECURITY ALERT: Suspicious Login Detected - ${data.username}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
          <h1>🚨 Security Alert</h1>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h2>Suspicious Login Detected</h2>
          
          <div style="background: white; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0;">
            <strong>User:</strong> ${data.username}<br>
            <strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}<br>
            <strong>Reason:</strong> ${data.reason}<br>
            <strong>IP Address:</strong> ${data.ip}
          </div>
          
          <h3>Location Details:</h3>
          <div style="background: white; padding: 15px; border: 1px solid #ddd; margin: 10px 0;">
            <strong>Current Login Location:</strong><br>
            Latitude: ${data.currentLocation.latitude}<br>
            Longitude: ${data.currentLocation.longitude}<br>
            Accuracy: ${data.currentLocation.accuracy} meters<br>
            <a href="https://www.google.com/maps?q=${data.currentLocation.latitude},${data.currentLocation.longitude}" 
               target="_blank" style="color: #007bff;">View on Google Maps</a>
          </div>
          
          ${data.previousLocation ? `
          <div style="background: white; padding: 15px; border: 1px solid #ddd; margin: 10px 0;">
            <strong>Previous Login Location:</strong><br>
            Latitude: ${data.previousLocation.latitude}<br>
            Longitude: ${data.previousLocation.longitude}<br>
            Time: ${new Date(data.previousLocation.timestamp).toLocaleString()}<br>
            <a href="https://www.google.com/maps?q=${data.previousLocation.latitude},${data.previousLocation.longitude}" 
               target="_blank" style="color: #007bff;">View on Google Maps</a>
          </div>
          ` : ''}
          
          <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7;">
            <strong>⚠️ Action Required:</strong><br>
            Please review this user's account immediately. Consider:
            <ul>
              <li>Contacting the user to verify the login attempt</li>
              <li>Temporarily suspending the account if necessary</li>
              <li>Reviewing recent account activity</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}" 
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              View Admin Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #6c757d; color: white; padding: 10px; text-align: center; font-size: 12px;">
          This is an automated security alert from your Location-Based Authentication System
        </div>
      </div>
    `
  }),

  multipleActiveLocations: (data) => ({
    subject: `⚠️ ALERT: Multiple Active Sessions - ${data.username}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ffc107; color: #212529; padding: 20px; text-align: center;">
          <h1>⚠️ Multiple Location Alert</h1>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h2>Multiple Active Sessions Detected</h2>
          
          <div style="background: white; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
            <strong>User:</strong> ${data.username}<br>
            <strong>Active Sessions:</strong> ${data.activeSessionCount}<br>
            <strong>Different Locations:</strong> ${data.locationCount}
          </div>
          
          <h3>Active Session Locations:</h3>
          ${data.locations.map((loc, index) => `
            <div style="background: white; padding: 10px; border: 1px solid #ddd; margin: 5px 0;">
              <strong>Location ${index + 1}:</strong> ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}<br>
              <strong>Last Active:</strong> ${new Date(loc.timestamp).toLocaleString()}<br>
              <a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank" style="color: #007bff;">View on Map</a>
            </div>
          `).join('')}
          
          <div style="margin: 20px 0; padding: 15px; background: #d1ecf1; border: 1px solid #bee5eb;">
            <strong>ℹ️ This could indicate:</strong>
            <ul>
              <li>Account sharing between multiple users</li>
              <li>Compromised credentials</li>
              <li>Legitimate use from multiple devices/locations</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}" 
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Investigate in Admin Dashboard
            </a>
          </div>
        </div>
      </div>
    `
  }),

  dailySummary: (data) => ({
    subject: `📊 Daily Security Summary - ${new Date().toDateString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
          <h1>📊 Daily Security Summary</h1>
          <p>${new Date().toDateString()}</p>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <div style="display: flex; justify-content: space-around; margin: 20px 0;">
            <div style="text-align: center; background: white; padding: 15px; border-radius: 8px; min-width: 120px;">
              <h3 style="color: #28a745; margin: 0;">${data.totalLogins}</h3>
              <p style="margin: 5px 0;">Total Logins</p>
            </div>
            <div style="text-align: center; background: white; padding: 15px; border-radius: 8px; min-width: 120px;">
              <h3 style="color: #dc3545; margin: 0;">${data.suspiciousLogins}</h3>
              <p style="margin: 5px 0;">Suspicious</p>
            </div>
            <div style="text-align: center; background: white; padding: 15px; border-radius: 8px; min-width: 120px;">
              <h3 style="color: #ffc107; margin: 0;">${data.failedLogins}</h3>
              <p style="margin: 5px 0;">Failed</p>
            </div>
          </div>
          
          ${data.topSuspiciousUsers.length > 0 ? `
          <h3>🚨 Users Requiring Attention:</h3>
          ${data.topSuspiciousUsers.map(user => `
            <div style="background: white; padding: 10px; border-left: 4px solid #dc3545; margin: 10px 0;">
              <strong>${user.username}</strong> - ${user.suspiciousCount} suspicious attempts
            </div>
          `).join('')}
          ` : '<p style="color: #28a745;">✅ No suspicious activity detected today</p>'}
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}" 
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              View Full Dashboard
            </a>
          </div>
        </div>
      </div>
    `
  })
};

// Send email function
async function sendEmail(to, template, data) {
  try {
    const emailContent = emailTemplates[template](data);
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'avngr2004hulk@gmail.com',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

// Notification triggers
async function notifySuspiciousLogin(loginData) {
  if (!config.admin.alertOnSuspiciousActivity) return;
  
  const adminEmails = config.admin.adminEmails;
  await sendEmail(adminEmails, 'suspiciousLogin', loginData);
}

async function notifyMultipleActiveLocations(userData) {
  if (!config.admin.alertOnSuspiciousActivity) return;
  
  const adminEmails = config.admin.adminEmails;
  await sendEmail(adminEmails, 'multipleActiveLocations', userData);
}

async function sendDailySummary(summaryData) {
  const adminEmails = config.admin.adminEmails;
  await sendEmail(adminEmails, 'dailySummary', summaryData);
}

// Test email function
async function testEmailConfiguration() {
  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error);
    return false;
  }
}

module.exports = {
  sendEmail,
  notifySuspiciousLogin,
  notifyMultipleActiveLocations,
  sendDailySummary,
  testEmailConfiguration
};