// db/memory-store.js
// Simple in-memory storage (replace with real database in production)

const config = require('../config/settings');

const users = new Map(); // userId -> { username, password, sessions: [] }
const loginAttempts = []; // Array of all login attempts for admin dashboard

// Sample users for testing
users.set('user1', {
  username: 'john@example.com',
  password: 'password123', // In production, use hashed passwords
  sessions: []
});

users.set('user2', {
  username: 'jane@example.com', 
  password: 'password456',
  sessions: []
});

function addUser(userId, username, password) {
  users.set(userId, {
    username,
    password,
    sessions: []
  });
}

function getUser(userId) {
  return users.get(userId);
}

function getUserByUsername(username) {
  for (let [userId, userData] of users) {
    if (userData.username === username) {
      return { userId, ...userData };
    }
  }
  return null;
}

function addSession(userId, sessionData) {
  const user = users.get(userId);
  if (user) {
    user.sessions.push(sessionData);
    // Keep only configured max sessions per user
    const maxSessions = config.sessions.maxSessionsPerUser;
    if (user.sessions.length > maxSessions) {
      user.sessions = user.sessions.slice(-maxSessions);
    }
  }
}

function getUserSessions(userId) {
  const user = users.get(userId);
  return user ? user.sessions : [];
}

function addLoginAttempt(attemptData) {
  loginAttempts.push(attemptData);
  // Keep only configured max login attempts
  const maxAttempts = config.sessions.maxLoginAttempts;
  if (loginAttempts.length > maxAttempts) {
    loginAttempts.shift();
  }
}

function getLoginAttempts() {
  return loginAttempts;
}

function getActiveSessions(userId) {
  const user = users.get(userId);
  if (!user) return [];
  
  const now = Date.now();
  const activeSessionWindow = config.sessions.activeSessionWindow * 60 * 60 * 1000; // Convert hours to ms
  
  return user.sessions.filter(session => 
    (now - session.timestamp) < activeSessionWindow
  );
}

function getRecentSessions(userId, hours = 24) {
  const user = users.get(userId);
  if (!user) return [];
  
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return user.sessions.filter(session => session.timestamp > cutoff);
}

function getAllUsers() {
  const result = [];
  for (let [userId, userData] of users) {
    const activeSessions = getActiveSessions(userId);
    result.push({
      userId,
      username: userData.username,
      totalSessions: userData.sessions.length,
      activeSessions: activeSessions.length,
      lastLogin: userData.sessions.length > 0 ? 
        userData.sessions[userData.sessions.length - 1].timestamp : null,
      locations: activeSessions.map(s => ({
        lat: s.location.latitude,
        lng: s.location.longitude,
        timestamp: s.timestamp
      }))
    });
  }
  return result;
}

module.exports = {
  addUser,
  getUser,
  getUserByUsername,
  addSession,
  getUserSessions,
  getActiveSessions,
  getRecentSessions,
  addLoginAttempt,
  getLoginAttempts,
  getAllUsers
};