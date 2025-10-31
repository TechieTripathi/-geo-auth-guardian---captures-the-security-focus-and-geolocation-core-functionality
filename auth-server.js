const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { evaluateLoginPair } = require("./utils/location-check");
const {
  getUserByUsername,
  addSession,
  getUserSessions,
  getActiveSessions,
  getRecentSessions,
  addLoginAttempt,
  getLoginAttempts,
  getAllUsers,
} = require("./db/memory-store");
const {
  notifySuspiciousLogin,
  notifyMultipleActiveLocations,
  testEmailConfiguration,
} = require("./utils/email-notifications");
const { scheduleDailySummary } = require("./utils/daily-summary");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  })
);


// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: "Authentication required" });
  }
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.session.userId && req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
}

// Add this AFTER app.use(session(...))
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).send("Internal Server Error");
});




// Login page
app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/dashboard");
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Secure Login</title>
  <style>
    body { font-family: Arial; padding: 20px; max-width: 400px; margin: 0 auto; }
    .form-group { margin: 15px 0; }
    label { display: block; margin-bottom: 5px; }
    input { width: 100%; padding: 8px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: red; margin: 10px 0; }
    .info { color: blue; margin: 10px 0; }
  </style>
</head>
<body>
  <h2>Secure Login</h2>
  <div id="locationStatus" class="info">Getting your location...</div>
  <form id="loginForm">
    <div class="form-group">
      <label>Email:</label>
      <input type="email" id="username" required>
    </div>
    <div class="form-group">
      <label>Password:</label>
      <input type="password" id="password" required>
    </div>
    <button type="submit">Login</button>
  </form>
  <div id="error" class="error"></div>
  
  <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h4>🧪 Test Accounts:</h4>
    <ul style="margin: 0; padding-left: 20px;">
      <li><strong>john@example.com</strong> / password123</li>
      <li><strong>jane@example.com</strong> / password456</li>
      <li><strong>alice@example.com</strong> / password789</li>
      <li><strong>bob@example.com</strong> / password000</li>
      <li><strong>admin@example.com</strong> / admin123 (Admin access)</li>
    </ul>
  </div>
  <p><a href="/admin">Admin Dashboard</a></p>

  <script>
    let currentLocation = null;
    
    // Get location on page load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          document.getElementById('locationStatus').textContent = 
            'Location obtained. You can now login.';
        },
        (error) => {
          document.getElementById('locationStatus').textContent = 
            'Location access denied. Login may be restricted.';
          console.error('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      if (!currentLocation) {
        errorDiv.textContent = 'Location is required for secure login.';
        return;
      }

      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            location: currentLocation
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          errorDiv.textContent = result.error || 'Login failed';
        }
      } catch (err) {
        errorDiv.textContent = 'Network error. Please try again.';
      }
    });
  </script>
</body>
</html>
  `);
});



// Login endpoint
app.post("/login", async (req, res) => {
  const { username, password, location } = req.body;

  if (!username || !password || !location) {
    return res
      .status(400)
      .json({ error: "Username, password, and location are required" });
  }

  const user = getUserByUsername(username);
  if (!user || user.password !== password) {
    addLoginAttempt({
      username,
      success: false,
      reason: "Invalid credentials",
      location,
      timestamp: Date.now(),
      ip: req.ip,
    });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Check for suspicious location activity against recent sessions
  const recentSessions = getRecentSessions(user.userId, 24); // Last 24 hours
  let suspicious = false;
  let suspiciousReason = "";
  let maxSuspiciousScore = 0;

  // Check against all recent sessions, not just the last one
  for (const session of recentSessions) {
    const evaluation = evaluateLoginPair(
      session.location.latitude,
      session.location.longitude,
      session.location.accuracy,
      session.timestamp,
      location.latitude,
      location.longitude,
      location.accuracy,
      Date.now()
    );

    if (evaluation.suspicious) {
      // Use the most suspicious case
      if (evaluation.requiredKmh > maxSuspiciousScore) {
        suspicious = true;
        suspiciousReason = evaluation.reason;
        maxSuspiciousScore = evaluation.requiredKmh;
      }
    }
  }

  // Additional check: Count active sessions from different locations
  const activeSessions = getActiveSessions(user.userId);
  const activeLocations = activeSessions.filter((session) => {
    const distance = require("./utils/location-check").haversineKm(
      session.location.latitude,
      session.location.longitude,
      location.latitude,
      location.longitude
    );
    return distance > 1; // More than 1km apart
  });

  // If there are multiple active sessions from different locations, flag as suspicious
  if (activeLocations.length >= 2) {
    suspicious = true;
    suspiciousReason = `Multiple active sessions detected from ${
      activeLocations.length + 1
    } different locations`;
  }

  // Log the login attempt
  addLoginAttempt({
    username,
    success: true,
    suspicious,
    suspiciousReason,
    location,
    timestamp: Date.now(),
    ip: req.ip,
  });

  if (suspicious) {
    // Send email notification to admin
    notifySuspiciousLogin({
      username,
      timestamp: Date.now(),
      reason: suspiciousReason,
      ip: req.ip,
      currentLocation: location,
      previousLocation:
        recentSessions.length > 0
          ? {
              latitude:
                recentSessions[recentSessions.length - 1].location.latitude,
              longitude:
                recentSessions[recentSessions.length - 1].location.longitude,
              timestamp: recentSessions[recentSessions.length - 1].timestamp,
            }
          : null,
    }).catch((err) => console.error("Email notification failed:", err));

    return res.status(403).json({
      error:
        "Suspicious login detected: " +
        suspiciousReason +
        ". Please contact administrator.",
    });
  }

  // Create session
  const sessionData = {
    sessionId: Date.now() + Math.random(),
    location,
    timestamp: Date.now(),
    ip: req.ip,
  };

  addSession(user.userId, sessionData);

  // Check for multiple active locations after successful login
  const updatedActiveSessions = getActiveSessions(user.userId);
  const uniqueLocations = [];

  updatedActiveSessions.forEach((session) => {
    const isDuplicate = uniqueLocations.some((loc) => {
      const distance = require("./utils/location-check").haversineKm(
        loc.lat,
        loc.lng,
        session.location.latitude,
        session.location.longitude
      );
      return distance < 1; // Less than 1km apart
    });

    if (!isDuplicate) {
      uniqueLocations.push({
        lat: session.location.latitude,
        lng: session.location.longitude,
        timestamp: session.timestamp,
      });
    }
  });

  // Notify admin if user has multiple active locations
  if (uniqueLocations.length >= 2) {
    notifyMultipleActiveLocations({
      username,
      activeSessionCount: updatedActiveSessions.length,
      locationCount: uniqueLocations.length,
      locations: uniqueLocations,
    }).catch((err) => console.error("Email notification failed:", err));
  }

  req.session.userId = user.userId;
  req.session.username = username;
  req.session.isAdmin = username === "admin@example.com"; // Simple admin check

  res.json({ success: true, message: "Login successful" });
});

// User dashboard
app.get("/dashboard", requireAuth, (req, res) => {
  const sessions = getUserSessions(req.session.userId);

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .session { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
    .current { background-color: #e8f5e8; }
    button { padding: 8px 16px; background: #dc3545; color: white; border: none; cursor: pointer; }
    button:hover { background: #c82333; }
    .location-link { color: #007bff; text-decoration: none; }
    .location-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Welcome, ${req.session.username}</h2>
    <button onclick="logout()">Logout</button>
  </div>
  
  <h3>Your Recent Sessions</h3>
  <div id="sessions">
    ${sessions
      .map(
        (session, index) => `
      <div class="session ${index === sessions.length - 1 ? "current" : ""}">
        <strong>${
          index === sessions.length - 1 ? "Current Session" : "Previous Session"
        }</strong><br>
        <strong>Time:</strong> ${new Date(
          session.timestamp
        ).toLocaleString()}<br>
        <strong>Location:</strong> 
        <a href="https://www.google.com/maps?q=${session.location.latitude},${
          session.location.longitude
        }" 
           target="_blank" class="location-link">
          ${session.location.latitude.toFixed(
            6
          )}, ${session.location.longitude.toFixed(6)}
        </a><br>
        <strong>Accuracy:</strong> ${Math.round(
          session.location.accuracy
        )} meters<br>
        <strong>IP:</strong> ${session.ip}
      </div>
    `
      )
      .join("")}
  </div>

  <script>
    async function logout() {
      const response = await fetch('/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/';
      }
    }
  </script>
</body>
</html>
  `);
});

// Admin dashboard
app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Admin Dashboard</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .suspicious { background-color: #ffebee; }
    .success { background-color: #e8f5e8; }
    .failed { background-color: #ffebee; }
    button { padding: 8px 16px; margin: 5px; cursor: pointer; }
    .refresh { background: #28a745; color: white; border: none; }
    .location-link { color: #007bff; text-decoration: none; }
    .tabs { margin: 20px 0; }
    .tab { display: inline-block; padding: 10px 20px; background: #f8f9fa; border: 1px solid #ddd; cursor: pointer; }
    .tab.active { background: #007bff; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Admin Dashboard</h2>
    <div>
      <button class="refresh" onclick="location.reload()">Refresh</button>
      <button onclick="window.location.href='/'">Back to Login</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="showTab('attempts')">Login Attempts</div>
    <div class="tab" onclick="showTab('users')">Users</div>
    <div class="tab" onclick="showTab('email')">Email Settings</div>
  </div>

  <div id="attempts" class="tab-content active">
    <h3>Recent Login Attempts</h3>
    <div id="attemptsTable">Loading...</div>
  </div>

  <div id="users" class="tab-content">
    <h3>User Overview</h3>
    <div id="usersTable">Loading...</div>
  </div>

  <div id="email" class="tab-content">
    <h3>Email Notification Settings</h3>
    <div id="emailSettings">
      <div style="background: white; padding: 20px; border: 1px solid #ddd; margin: 10px 0;">
        <h4>Current Configuration</h4>
        <div id="currentSettings">Loading...</div>
        
        <h4 style="margin-top: 20px;">Test Email</h4>
        <button onclick="testEmail()" style="background: #28a745; color: white; border: none; padding: 8px 16px; cursor: pointer;">
          Send Test Email
        </button>
        <div id="testResult" style="margin-top: 10px;"></div>
        
        <h4 style="margin-top: 20px;">Email Setup Instructions</h4>
        <div style="background: #f8f9fa; padding: 15px; border: 1px solid #ddd;">
          <p><strong>To enable email notifications:</strong></p>
          <ol>
            <li>Set environment variables:
              <ul>
                <li><code>EMAIL_USER=your-email@gmail.com</code></li>
                <li><code>EMAIL_PASS=your-app-password</code></li>
              </ul>
            </li>
            <li>For Gmail, create an App Password in your Google Account settings</li>
            <li>Restart the server after setting environment variables</li>
          </ol>
          <p><strong>Current Status:</strong> <span id="emailStatus">Checking...</span></p>
        </div>
      </div>
    </div>
  </div>

  <script>
    function showTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      if (tabName === 'attempts') loadAttempts();
      if (tabName === 'users') loadUsers();
      if (tabName === 'email') loadEmailSettings();
    }

    async function loadAttempts() {
      try {
        const response = await fetch('/admin/login-attempts');
        const attempts = await response.json();
        
        const html = \`
          <table>
            <tr>
              <th>Time</th>
              <th>Username</th>
              <th>Status</th>
              <th>Location</th>
              <th>IP</th>
              <th>Notes</th>
            </tr>
            \${attempts.map(attempt => \`
              <tr class="\${attempt.suspicious ? 'suspicious' : (attempt.success ? 'success' : 'failed')}">
                <td>\${new Date(attempt.timestamp).toLocaleString()}</td>
                <td>\${attempt.username}</td>
                <td>\${attempt.success ? (attempt.suspicious ? 'BLOCKED' : 'SUCCESS') : 'FAILED'}</td>
                <td>
                  \${attempt.location ? \`
                    <a href="https://www.google.com/maps?q=\${attempt.location.latitude},\${attempt.location.longitude}" 
                       target="_blank" class="location-link">
                      \${attempt.location.latitude.toFixed(4)}, \${attempt.location.longitude.toFixed(4)}
                    </a>
                  \` : 'N/A'}
                </td>
                <td>\${attempt.ip}</td>
                <td>\${attempt.reason || attempt.suspiciousReason || ''}</td>
              </tr>
            \`).join('')}
          </table>
        \`;
        
        document.getElementById('attemptsTable').innerHTML = html;
      } catch (err) {
        document.getElementById('attemptsTable').innerHTML = 'Error loading data';
      }
    }

    async function loadUsers() {
      try {
        const response = await fetch('/admin/users');
        const users = await response.json();
        
        const html = \`
          <table>
            <tr>
              <th>User ID</th>
              <th>Username</th>
              <th>Total Sessions</th>
              <th>Active Sessions</th>
              <th>Active Locations</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
            \${users.map(user => \`
              <tr class="\${user.activeSessions > 1 ? 'suspicious' : ''}">
                <td>\${user.userId}</td>
                <td>\${user.username}</td>
                <td>\${user.totalSessions}</td>
                <td>\${user.activeSessions}</td>
                <td>
                  \${user.locations.map(loc => \`
                    <a href="https://www.google.com/maps?q=\${loc.lat},\${loc.lng}" 
                       target="_blank" class="location-link" 
                       title="Login at \${new Date(loc.timestamp).toLocaleString()}">
                      \${loc.lat.toFixed(3)}, \${loc.lng.toFixed(3)}
                    </a>
                  \`).join('<br>')}
                </td>
                <td>\${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                <td>
                  <button onclick="viewUserDetails('\${user.userId}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; cursor: pointer;">
                    Details
                  </button>
                </td>
              </tr>
            \`).join('')}
          </table>
        \`;
        
        document.getElementById('usersTable').innerHTML = html;
      } catch (err) {
        document.getElementById('usersTable').innerHTML = 'Error loading data';
      }
    }

    async function viewUserDetails(userId) {
      try {
        const response = await fetch(\`/admin/user-details/\${userId}\`);
        const details = await response.json();
        
        const popup = window.open('', '_blank', 'width=800,height=600');
        popup.document.write(\`
          <html>
            <head><title>User Details - \${details.username}</title></head>
            <body style="font-family: Arial; padding: 20px;">
              <h2>User Details: \${details.username}</h2>
              <h3>Recent Sessions (Last 50)</h3>
              <table border="1" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <th>Time</th>
                  <th>Location</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
                \${details.sessions.map(session => \`
                  <tr>
                    <td>\${new Date(session.timestamp).toLocaleString()}</td>
                    <td>
                      <a href="https://www.google.com/maps?q=\${session.location.latitude},\${session.location.longitude}" target="_blank">
                        \${session.location.latitude.toFixed(6)}, \${session.location.longitude.toFixed(6)}
                      </a>
                    </td>
                    <td>\${session.ip}</td>
                    <td>\${Date.now() - session.timestamp < 24*60*60*1000 ? 'Active' : 'Expired'}</td>
                  </tr>
                \`).join('')}
              </table>
            </body>
          </html>
        \`);
      } catch (err) {
        alert('Error loading user details');
      }
    }

    async function loadEmailSettings() {
      try {
        const response = await fetch('/admin/email-settings');
        const settings = await response.json();
        
        const html = \`
          <p><strong>Alert on Suspicious Activity:</strong> \${settings.alertOnSuspiciousActivity ? '✅ Enabled' : '❌ Disabled'}</p>
          <p><strong>Admin Emails:</strong> \${settings.adminEmails.join(', ')}</p>
          <p><strong>Email Configuration:</strong> \${settings.emailConfigured ? '✅ Configured' : '❌ Not Configured'}</p>
        \`;
        
        document.getElementById('currentSettings').innerHTML = html;
        document.getElementById('emailStatus').innerHTML = settings.emailConfigured ? 
          '<span style="color: green;">✅ Email is configured</span>' : 
          '<span style="color: red;">❌ Email not configured</span>';
      } catch (err) {
        document.getElementById('currentSettings').innerHTML = 'Error loading settings';
      }
    }

    async function testEmail() {
      const button = event.target;
      const resultDiv = document.getElementById('testResult');
      
      button.disabled = true;
      button.textContent = 'Sending...';
      resultDiv.innerHTML = '';
      
      try {
        const response = await fetch('/admin/test-email', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
          resultDiv.innerHTML = '<span style="color: green;">✅ Test email sent successfully!</span>';
        } else {
          resultDiv.innerHTML = \`<span style="color: red;">❌ Failed: \${result.message}</span>\`;
        }
      } catch (err) {
        resultDiv.innerHTML = '<span style="color: red;">❌ Network error</span>';
      } finally {
        button.disabled = false;
        button.textContent = 'Send Test Email';
      }
    }

    // Load initial data
    loadAttempts();
  </script>
</body>
</html>
  `);
});

// Admin API endpoints
app.get("/admin/login-attempts", (req, res) => {
  const attempts = getLoginAttempts().reverse(); // Most recent first
  res.json(attempts);
});

app.get("/admin/users", (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

app.get("/admin/user-details/:userId", (req, res) => {
  const { userId } = req.params;
  const sessions = getUserSessions(userId);
  const user = require("./db/memory-store").getUser(userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    userId,
    username: user.username,
    sessions: sessions.reverse(), // Most recent first
  });
});

// Test email configuration
app.post("/admin/test-email", async (req, res) => {
  try {
    const isValid = await testEmailConfiguration();
    if (isValid) {
      // Send a test email
      const { sendEmail } = require("./utils/email-notifications");
      const config = require("./config/settings");

      await sendEmail(config.admin.adminEmails, "suspiciousLogin", {
        username: "test@example.com",
        timestamp: Date.now(),
        reason: "This is a test email to verify email configuration",
        ip: "127.0.0.1",
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
        },
        previousLocation: {
          latitude: 34.0522,
          longitude: -118.2437,
          timestamp: Date.now() - 3600000,
        },
      });

      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Email configuration is invalid" });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send test email: " + error.message,
    });
  }
});

// Get email notification settings
app.get("/admin/email-settings", (req, res) => {
  const config = require("./config/settings");
  res.json({
    alertOnSuspiciousActivity: config.admin.alertOnSuspiciousActivity,
    adminEmails: config.admin.adminEmails,
    emailConfigured: !!process.env.EMAIL_USER,
  });
});

// Logout endpoint
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});


app.use((req, res) => {
  res.status(404).send("Page not found");
});



app.listen(port, () => {
  console.log(`🚀 Secure auth server running at http://localhost:${port}`);
  console.log(`📊 Admin dashboard: http://localhost:${port}/admin`);

  // Test email configuration on startup
  testEmailConfiguration().then((isValid) => {
    if (isValid) {
      console.log("✅ Email notifications are configured and ready");
      // Schedule daily summary emails
      scheduleDailySummary();
    } else {
      console.log(
        "⚠️ Email not configured. Set EMAIL_USER and EMAIL_PASS environment variables to enable notifications"
      );
    }
  });
});

