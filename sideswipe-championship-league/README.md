# VELOX Sideswipe Championship League (SCL) Website

A comprehensive tournament management system for the Sideswipe Championship League, featuring team standings, match schedules, player statistics, predictions, and administrative tools.

## Features

- **Team Standings** - Live league table with points, wins, and goal differential
- **Match Schedule** - View upcoming and completed matches by matchday
- **Player Leaderboard** - Track top performers by goals, assists, saves, and wins
- **Match Predictions** - Users can predict match results and earn points
- **Admin Dashboard** - Complete management interface for teams, players, and matches
- **Discord Integration** - Automatic match result notifications via webhooks
- **Social Media Links** - Quick access to Discord, Twitter, Instagram, and YouTube

## Getting Started

### Prerequisites

The system runs on Replit with:
- Node.js
- PostgreSQL database (automatically configured)
- Express.js backend
- Static HTML/CSS/JS frontend

### Running the Application

1. Click the "Run" button in Replit
2. The system starts both frontend (port 5000) and backend API (port 4300)
3. Access the website through the Webview panel

## How to Use

### For Regular Users

#### Viewing Information
- **Home** (`/index.html`) - Landing page with league overview
- **Standings** (`/standings.html`) - Current league standings
- **Matches** (`/matches.html`) - Match schedule and results
- **Teams** (`/teams.html`) - All registered teams
- **Leaderboard** (`/leaderboard.html`) - Player statistics rankings
- **Register** (`/register.html`) - Team registration form

#### Making Predictions
1. Navigate to **Predictions** (`/predictions.html`)
2. Click "Register" to create an account
3. Log in with your credentials
4. View upcoming matches under "Upcoming Matches" tab
5. Enter your predicted scores or select a winner
6. Submit your predictions before matches start
7. Check your points and ranking in the "Leaderboard" tab

**Scoring System:**
- Exact score prediction: **5 points**
- Correct winner prediction: **2 points**
- Points are automatically calculated when match scores are updated

### For Administrators

#### Initial Setup

1. **Create Admin Account**
   - Register a user through the predictions page
   - Manually set `isAdmin = true` in the database for that user
   - Or use SQL: `UPDATE "User" SET "isAdmin" = true WHERE username = 'yourusername';`

2. **Access Admin Panel**
   - Navigate to **Admin** (`/admin.html`)
   - Log in with your admin credentials

#### Managing Teams

1. Go to Admin Dashboard → "Teams" tab
2. **Add Team:**
   - Fill in team name, short name, tag
   - Optional: Add logo URL, region, Toornament ID
   - Click "Add Team"
3. **Edit/Delete Teams:**
   - Click "Edit" next to any team to modify
   - Click "Delete" to remove (warning: deletes all associated data)

#### Managing Players

1. Go to "Players" tab
2. **Add Player:**
   - Enter Discord ID, display name
   - Select team from dropdown
   - Choose role (PLAYER, LEADER, STAFF)
   - Optionally set initial stats (goals, assists, saves, wins, losses)
   - Click "Add Player"
3. **Update Stats:**
   - Edit any player to update their statistics
   - Stats will appear on the public leaderboard

#### Managing Matches

1. Go to "Matches" tab
2. **Add Match:**
   - Select home and away teams
   - Set matchday number
   - Choose status (PLANNED, ONGOING, COMPLETED)
   - Optionally set scheduled date/time
   - Click "Add Match"
3. **Update Scores:**
   - Click "Update Score" next to any match
   - Enter home and away team scores
   - Click "Update Score"
   - **This triggers:**
     - Match status changes to COMPLETED
     - All user predictions are scored automatically
     - Discord webhook notification is sent (if configured)

#### Discord Webhook Setup

1. Go to "Webhooks" tab
2. **Add Webhook:**
   - Enter a name for the webhook
   - Paste your Discord webhook URL
   - Set enabled status
   - Click "Add Webhook"

**To get a Discord webhook URL:**
1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Choose a channel for notifications
5. Copy the webhook URL
6. Paste it in the admin panel

**When scores are updated:**
- An embed message is automatically sent to Discord with:
  - Match result (Team A vs Team B)
  - Final score
  - Matchday number
  - Match status

## API Endpoints

### Public Endpoints

```
GET  /api/teams              - Get all teams
GET  /api/standings          - Get league standings
GET  /api/matches            - Get all matches
GET  /api/players            - Get all players
GET  /api/leaderboard/players?sortBy=goals - Get player leaderboard
GET  /api/predictions/upcoming-matches - Get matches available for predictions
```

### Authentication

```
POST /api/auth/register      - Register new user
     Body: { username, password, email? }
     
POST /api/auth/login         - Login
     Body: { username, password }
     Returns: { token, username, id, isAdmin }
```

### Predictions (Requires Authentication)

```
POST /api/predictions        - Submit/update prediction
     Headers: Authorization: Bearer <token>
     Body: { matchId, predictedScoreHome?, predictedScoreAway?, predictedWinner? }
     
GET  /api/predictions/user/:id - Get user's predictions
GET  /api/predictions/match/:id - Get predictions for a match
GET  /api/predictions/leaderboard - Get prediction points leaderboard
```

### Admin Endpoints (Requires Admin Token)

```
Teams:
POST   /api/admin/teams      - Create team
PUT    /api/admin/teams/:id  - Update team
DELETE /api/admin/teams/:id  - Delete team

Players:
POST   /api/admin/players    - Create player
PUT    /api/admin/players/:id - Update player
DELETE /api/admin/players/:id - Delete player

Matches:
POST   /api/admin/matches    - Create match
PUT    /api/admin/matches/:id - Update match
DELETE /api/admin/matches/:id - Delete match
PUT    /api/admin/matches/:id/score - Update match score

Webhooks:
GET    /api/admin/webhooks   - List webhooks
POST   /api/admin/webhooks   - Create webhook
PUT    /api/admin/webhooks/:id - Update webhook
```

## Database Schema

### Main Models

- **SclTeam** - Teams with logos, regions, and identifiers
- **SclPlayer** - Players with stats (goals, assists, saves, wins, losses)
- **SclMatch** - Matches with scores and status
- **SclStanding** - League standings calculated from match results
- **User** - User accounts with authentication
- **Prediction** - User predictions with points
- **DiscordWebhook** - Webhook configurations for Discord

## File Structure

```
/
├── api-scl/              # Backend API
│   └── index.js         # Express server with all routes
├── website-scl/          # Frontend
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript files
│   ├── index.html       # Landing page
│   ├── standings.html   # Standings page
│   ├── matches.html     # Matches page
│   ├── teams.html       # Teams page
│   ├── leaderboard.html # Player leaderboard
│   ├── predictions.html # Predictions system
│   ├── admin.html       # Admin dashboard
│   └── register.html    # Registration form
├── prisma/              # Database
│   └── schema.prisma    # Database schema
├── frontend-server.js   # Frontend server with API proxy
└── start.js             # Entry point
```

## Development

### Database Migrations

When schema changes are made:
```bash
npx prisma migrate dev --name migration_name
```

### Regenerate Prisma Client
```bash
npx prisma generate
```

## Deployment

The system is configured for Replit deployment:
- **Deployment Type:** VM (always running)
- **Run Command:** `node start.js`
- **Port:** 5000 (frontend with API proxy)

Click the "Deploy" button in Replit to publish your site with a public URL.

## Support

For issues or questions:
- Check the Discord community
- Review the API documentation above
- Contact the VELOX team through social media links in the footer

## License

Built for VELOX Sideswipe Championship League
