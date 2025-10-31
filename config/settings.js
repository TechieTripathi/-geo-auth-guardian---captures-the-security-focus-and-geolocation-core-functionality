// config/settings.js
// Configuration for the location-based authentication system

module.exports = {
  // Session storage settings
  sessions: {
    maxSessionsPerUser: 50,        // Maximum sessions to store per user
    activeSessionWindow: 24,       // Hours to consider a session "active"
    maxLoginAttempts: 500,         // Maximum login attempts to store
  },

  // Location security settings
  location: {
    maxTravelSpeedKmh: 900,        // Maximum plausible travel speed (km/h)
    maxConcurrentLocations: 2,     // Max different locations for active sessions
    locationToleranceKm: 1,        // Distance to consider locations "same" (km)
  },

  // Admin settings
  admin: {
    adminEmails: ['admin@example.com'], // Admin user emails
    alertOnSuspiciousActivity: true,    // Send alerts for suspicious logins
  },

  // Security settings
  security: {
    sessionSecret: 'your-secret-key-change-in-production',
    sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    requireLocationForLogin: true,       // Require location data for all logins
  }
};