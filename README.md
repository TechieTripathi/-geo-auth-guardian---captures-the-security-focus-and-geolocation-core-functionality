# Geo Auth Guardian

A sophisticated location-based authentication system that prevents credential sharing and unauthorized access by analyzing travel patterns between login locations. The system detects impossible travel speeds and blocks suspicious login attempts in real-time.

## 🎯 Project Objectives

### Primary Security Goals
- **Eliminate Credential Sharing**: Prevent multiple users from sharing the same login credentials across different physical locations
- **Detect Account Compromise**: Identify when legitimate user accounts have been compromised and accessed from impossible locations
- **Real-time Threat Prevention**: Block suspicious login attempts instantly before unauthorized access occurs
- **Reduce Security Incidents**: Minimize data breaches caused by shared or stolen credentials

### Business Impact
- **Compliance Enhancement**: Meet regulatory requirements for access control and audit trails (SOX, GDPR, HIPAA)
- **Cost Reduction**: Prevent financial losses from security breaches and unauthorized access
- **User Accountability**: Ensure individual accountability by preventing credential sharing among team members
- **Risk Mitigation**: Reduce liability from insider threats and external attacks using stolen credentials

### Technical Innovation
- **Geospatial Security**: Pioneer the use of impossible travel detection in authentication systems
- **Behavioral Analytics**: Implement location-based behavioral patterns for enhanced security
- **Real-time Processing**: Demonstrate high-performance geolocation analysis with sub-second response times
- **Scalable Architecture**: Create a foundation for enterprise-grade location-aware security systems

### Use Cases
- **Corporate Environments**: Prevent employees from sharing VPN or system credentials
- **Educational Institutions**: Stop students from sharing online exam or course access credentials  
- **Financial Services**: Enhance security for banking and trading platform access
- **Healthcare Systems**: Protect patient data access with location-verified authentication
- **Remote Work Security**: Ensure distributed teams maintain individual account security
- **Subscription Services**: Prevent account sharing that violates terms of service

### Demonstration Value
- **Proof of Concept**: Showcase advanced geolocation security techniques for potential enterprise adoption
- **Research Foundation**: Provide a base for academic research in location-based cybersecurity
- **Developer Education**: Teach practical implementation of geospatial algorithms in security contexts
- **Industry Standards**: Contribute to best practices for location-aware authentication systems

## 🚀 Key Features

- **Impossible Travel Detection**: Automatically blocks logins requiring travel speeds >900 km/h
- **Real-time Location Tracking**: Uses browser geolocation API for precise coordinates
- **Multi-Session Monitoring**: Tracks concurrent sessions from different locations
- **Admin Dashboard**: Comprehensive monitoring with Google Maps integration
- **Email Alerts**: Automated notifications for suspicious activities
- **Daily Security Reports**: Regular summaries of security events

## 🔒 How It Works

1. **Location Capture**: User's precise location is captured during login
2. **Travel Analysis**: System calculates required travel speed from previous login
3. **Impossibility Check**: Blocks logins requiring >900 km/h travel speed
4. **Concurrent Monitoring**: Flags users with active sessions from multiple distant locations
5. **Real-time Alerts**: Immediate email notifications to administrators

## 🛠️ Quick Start

### Prerequisites
- Node.js 14+ 
- Gmail account (for email notifications)

### Installation

```bash
# Clone the repository
git clone https://github.com/TechieTripathi/geo-auth-guardian.git
cd geo-auth-guardian

# Install dependencies
npm install

# Configure email notifications (optional)
cp .env.example .env
# Edit .env with your email credentials

# Start the server
npm run auth
```

### Access Points
- **Login**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin

## 📧 Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate App Password: Google Account → Security → 2-Step Verification → App passwords
3. Set environment variables:
```bash
export EMAIL_USER=your-email@gmail.com
export EMAIL_PASS=your-16-character-app-password
```

## 🧪 Test Accounts

| Email | Password | Role |
|-------|----------|------|
| john@example.com | password123 | User |
| jane@example.com | password456 | User |
| admin@example.com | admin123 | Admin |

## 📊 Security Thresholds

- **Max Travel Speed**: 900 km/h (commercial jet speed)
- **Location Tolerance**: 1 km (same location threshold)
- **Active Session Window**: 24 hours
- **Max Concurrent Locations**: 2 different active locations

## 🔧 Configuration

Edit `config/settings.js` to customize:

```javascript
{
  sessions: {
    maxSessionsPerUser: 50,
    activeSessionWindow: 24,
    maxLoginAttempts: 500
  },
  location: {
    maxTravelSpeedKmh: 900,
    maxConcurrentLocations: 2,
    locationToleranceKm: 1
  }
}
```

## 📱 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | User authentication with location |
| GET | `/dashboard` | User session dashboard |
| GET | `/admin` | Admin monitoring interface |
| GET | `/admin/login-attempts` | Login attempts data (JSON) |
| POST | `/logout` | Session termination |

## 🏗️ Architecture

```
├── auth-server.js              # Main Express server
├── utils/
│   ├── location-check.js       # Haversine distance & travel analysis
│   ├── email-notifications.js  # Email alert system
│   └── daily-summary.js        # Automated reporting
├── db/memory-store.js          # In-memory data storage
├── config/settings.js          # System configuration
└── package.json               # Dependencies
```

## 🚨 Security Features

- **Session-based Authentication**: Secure session management
- **GPS Accuracy Handling**: Accounts for location precision
- **Activity Logging**: Complete audit trail
- **Real-time Monitoring**: Live threat detection
- **Email Notifications**: Immediate security alerts

## 📈 Production Considerations

- [ ] Replace in-memory storage with persistent database (PostgreSQL/MongoDB)
- [ ] Implement proper password hashing (bcrypt/argon2)
- [ ] Add HTTPS/SSL support
- [ ] Implement rate limiting
- [ ] Add mobile geolocation enhancements
- [ ] Set up proper logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<!-- ## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details. -->

## 🙏 Acknowledgments

- Haversine formula implementation for accurate distance calculations
- Express.js for robust web server framework
- Nodemailer for reliable email notifications

---

**⚠️ Security Notice**: This system is designed for demonstration purposes. For production use, implement proper password hashing, database storage, and additional security measures.