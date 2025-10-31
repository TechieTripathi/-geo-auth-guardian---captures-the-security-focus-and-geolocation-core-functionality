// utils/daily-summary.js
const { getLoginAttempts } = require('../db/memory-store');
const { sendDailySummary } = require('./email-notifications');

function generateDailySummary() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  const allAttempts = getLoginAttempts();
  const todayAttempts = allAttempts.filter(attempt => attempt.timestamp > oneDayAgo);
  
  const totalLogins = todayAttempts.filter(a => a.success).length;
  const suspiciousLogins = todayAttempts.filter(a => a.suspicious).length;
  const failedLogins = todayAttempts.filter(a => !a.success).length;
  
  // Find users with multiple suspicious attempts
  const suspiciousUsers = {};
  todayAttempts.forEach(attempt => {
    if (attempt.suspicious) {
      suspiciousUsers[attempt.username] = (suspiciousUsers[attempt.username] || 0) + 1;
    }
  });
  
  const topSuspiciousUsers = Object.entries(suspiciousUsers)
    .map(([username, count]) => ({ username, suspiciousCount: count }))
    .sort((a, b) => b.suspiciousCount - a.suspiciousCount)
    .slice(0, 5); // Top 5 suspicious users
  
  return {
    totalLogins,
    suspiciousLogins,
    failedLogins,
    topSuspiciousUsers,
    date: new Date().toDateString()
  };
}

async function sendDailySummaryEmail() {
  try {
    const summary = generateDailySummary();
    
    // Only send if there's activity or suspicious behavior
    if (summary.totalLogins > 0 || summary.suspiciousLogins > 0) {
      await sendDailySummary(summary);
      console.log('✅ Daily summary email sent');
    } else {
      console.log('ℹ️ No activity today, skipping daily summary');
    }
  } catch (error) {
    console.error('❌ Failed to send daily summary:', error);
  }
}

// Schedule daily summary at 9 AM
function scheduleDailySummary() {
  const now = new Date();
  const tomorrow9AM = new Date();
  tomorrow9AM.setDate(now.getDate() + 1);
  tomorrow9AM.setHours(9, 0, 0, 0);
  
  const msUntil9AM = tomorrow9AM.getTime() - now.getTime();
  
  setTimeout(() => {
    sendDailySummaryEmail();
    // Schedule for every 24 hours after that
    setInterval(sendDailySummaryEmail, 24 * 60 * 60 * 1000);
  }, msUntil9AM);
  
  console.log(`📅 Daily summary scheduled for ${tomorrow9AM.toLocaleString()}`);
}

module.exports = {
  generateDailySummary,
  sendDailySummaryEmail,
  scheduleDailySummary
};