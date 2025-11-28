import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import toornamentClient from './toornament.js';
import { generateStandingsImage, generateLeaderboardImage } from './image-generator.js';
import { processMatchScreenshot, processMultipleScreenshots, aggregateMatchResults } from './ocr-processor.js';
import FormData from 'form-data';

config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.SCL_API_PORT || 4300;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "SCL API" });
});

/* ===========================================
   GET /api/teams  -> list of SCL teams
   =========================================== */
app.get("/api/teams", async (req, res) => {
  try {
    const teams = await prisma.sclTeam.findMany({
      orderBy: { name: "asc" }
    });

    res.json(teams);
  } catch (err) {
    console.error("Error fetching SCL teams:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/teams/:id  -> single team with full details
   =========================================== */
app.get("/api/teams/:id", async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await prisma.sclTeam.findUnique({
      where: { id: teamId },
      include: {
        players: {
          orderBy: { displayName: "asc" }
        },
        homeMatches: {
          include: {
            homeTeam: true,
            awayTeam: true
          },
          orderBy: { matchday: "asc" }
        },
        awayMatches: {
          include: {
            homeTeam: true,
            awayTeam: true
          },
          orderBy: { matchday: "asc" }
        },
        standing: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    const allMatches = [...team.homeMatches, ...team.awayMatches].sort(
      (a, b) => a.matchday - b.matchday
    );

    const matches = allMatches.map((m) => ({
      id: m.id,
      matchday: m.matchday,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      scoreHome: m.scoreHome,
      scoreAway: m.scoreAway,
      status: m.status,
      scheduledAt: m.scheduledAt
    }));

    let standingWithPosition = null;
    if (team.standing) {
      const allStandings = await prisma.sclStanding.findMany({
        orderBy: [
          { points: "desc" },
          { goalsFor: "desc" },
          { goalsAgainst: "asc" }
        ]
      });
      const position = allStandings.findIndex(s => s.teamId === teamId) + 1;
      
      standingWithPosition = {
        position: position > 0 ? position : null,
        played: team.standing.played,
        wins: team.standing.wins,
        draws: team.standing.draws,
        losses: team.standing.losses,
        goalsFor: team.standing.goalsFor,
        goalsAgainst: team.standing.goalsAgainst,
        goalDifference: team.standing.goalsFor - team.standing.goalsAgainst,
        points: team.standing.points
      };
    }

    const response = {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      tag: team.tag,
      logoUrl: team.logoUrl,
      region: team.region,
      players: team.players,
      matches: matches,
      standing: standingWithPosition
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching team details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/standings  -> standings with team names
   =========================================== */
app.get("/api/standings", async (req, res) => {
  try {
    const standings = await prisma.sclStanding.findMany({
      include: { team: true },
      orderBy: [
        { points: "desc" },
        { goalsFor: "desc" },
        { goalsAgainst: "asc" }
      ]
    });

    // Optional: map to cleaner payload
    const payload = standings.map((s, index) => ({
      position: index + 1,
      teamId: s.team.id,
      team: s.team.name,
      shortName: s.team.shortName,
      logoUrl: s.team.logoUrl,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalsFor - s.goalsAgainst,
      points: s.points
    }));

    res.json(payload);
  } catch (err) {
    console.error("Error fetching SCL standings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/matches  -> list of matches
   =========================================== */
app.get("/api/matches", async (req, res) => {
  try {
    const matches = await prisma.sclMatch.findMany({
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: [
        { matchday: "asc" },
        { id: "asc" }
      ]
    });

    const payload = matches.map((m) => ({
      id: m.id,
      matchday: m.matchday,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
      homeTeamLogo: m.homeTeam.logoUrl,
      awayTeamLogo: m.awayTeam.logoUrl,
      scoreHome: m.scoreHome,
      scoreAway: m.scoreAway,
      status: m.status,
      scheduledAt: m.scheduledAt,
      toornamentMatchId: m.toornamentMatchId
    }));

    res.json(payload);
  } catch (err) {
    console.error("Error fetching SCL matches:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/matches/:id  -> single match with full details
   =========================================== */
app.get("/api/matches/:id", async (req, res) => {
  try {
    const matchId = parseInt(req.params.id);
    
    if (isNaN(matchId)) {
      return res.status(400).json({ error: "Invalid match ID" });
    }

    const match = await prisma.sclMatch.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          include: {
            players: {
              orderBy: { displayName: "asc" }
            }
          }
        },
        awayTeam: {
          include: {
            players: {
              orderBy: { displayName: "asc" }
            }
          }
        }
      }
    });

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    const response = {
      id: match.id,
      matchday: match.matchday,
      scheduledAt: match.scheduledAt,
      status: match.status,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
        tag: match.homeTeam.tag,
        region: match.homeTeam.region,
        players: match.homeTeam.players
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
        tag: match.awayTeam.tag,
        region: match.awayTeam.region,
        players: match.awayTeam.players
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching match details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/leaderboard/players  -> player stats leaderboard
   =========================================== */
app.get("/api/leaderboard/players", async (req, res) => {
  try {
    const { sortBy = 'goals', limit = 50 } = req.query;
    
    const orderByField = ['goals', 'assists', 'saves', 'wins'].includes(sortBy) ? sortBy : 'goals';
    
    const players = await prisma.sclPlayer.findMany({
      include: { team: true },
      orderBy: { [orderByField]: 'desc' },
      take: parseInt(limit)
    });

    const payload = players.map((p, index) => ({
      position: index + 1,
      id: p.id,
      displayName: p.displayName,
      team: p.team.name,
      teamShortName: p.team.shortName,
      goals: p.goals,
      assists: p.assists,
      saves: p.saves,
      wins: p.wins,
      losses: p.losses
    }));

    res.json(payload);
  } catch (err) {
    console.error("Error fetching player leaderboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   AUTHENTICATION & USER MANAGEMENT
   =========================================== */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'scl-secret-key-change-in-production';

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Admin middleware - checks for ADMIN or STAFF role
const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.authAccount.findUnique({ where: { id: req.user.id } });
    if (!user || !['ADMIN', 'STAFF'].includes(user.role)) return res.sendStatus(403);
    next();
  } catch (err) {
    res.sendStatus(500);
  }
};

// Role-based access middleware
const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const user = await prisma.authAccount.findUnique({ where: { id: req.user.id } });
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      req.account = user;
      next();
    } catch (err) {
      res.sendStatus(500);
    }
  };
};

// Unified registration - supports role selection
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, role, teamId } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    // Validate role
    const validRoles = ['VIEWER', 'PLAYER', 'LEADER'];
    const selectedRole = validRoles.includes(role) ? role : 'VIEWER';
    
    // Player/Leader roles require a team
    if (['PLAYER', 'LEADER'].includes(selectedRole) && !teamId) {
      return res.status(400).json({ error: "Team selection required for Player/Leader roles" });
    }
    
    // Verify team exists if provided
    if (teamId) {
      const team = await prisma.sclTeam.findUnique({ where: { id: parseInt(teamId) } });
      if (!team) {
        return res.status(400).json({ error: "Selected team not found" });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const account = await prisma.authAccount.create({
      data: { 
        username, 
        email: email || null, 
        password: hashedPassword,
        role: selectedRole,
        teamId: teamId ? parseInt(teamId) : null
      },
      include: { team: true }
    });
    
    const token = jwt.sign({ 
      id: account.id, 
      username: account.username,
      role: account.role,
      teamId: account.teamId
    }, JWT_SECRET);
    
    res.json({ 
      token, 
      username: account.username, 
      id: account.id,
      role: account.role,
      teamId: account.teamId,
      teamName: account.team?.name || null
    });
  } catch (err) {
    console.error("Registration error:", err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const account = await prisma.authAccount.findUnique({ 
      where: { username },
      include: { team: true }
    });
    
    if (!account) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const validPassword = await bcrypt.compare(password, account.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Update last login
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { lastLogin: new Date() }
    });
    
    const token = jwt.sign({ 
      id: account.id, 
      username: account.username,
      role: account.role,
      teamId: account.teamId
    }, JWT_SECRET);
    
    res.json({ 
      token, 
      username: account.username, 
      id: account.id,
      role: account.role,
      teamId: account.teamId,
      teamName: account.team?.name || null,
      isAdmin: ['ADMIN', 'STAFF'].includes(account.role)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user info
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const account = await prisma.authAccount.findUnique({
      where: { id: req.user.id },
      include: { team: true }
    });
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    res.json({
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role,
      teamId: account.teamId,
      teamName: account.team?.name || null,
      isAdmin: ['ADMIN', 'STAFF'].includes(account.role)
    });
  } catch (err) {
    console.error("Error fetching account:", err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

/* ===========================================
   PREDICTIONS SYSTEM
   =========================================== */

app.get("/api/predictions/upcoming-matches", async (req, res) => {
  try {
    const matches = await prisma.sclMatch.findMany({
      where: {
        status: { in: ['PLANNED', 'ONGOING'] },
        scheduledAt: { gte: new Date() }
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledAt: 'asc' },
      take: 20
    });
    
    res.json(matches);
  } catch (err) {
    console.error("Error fetching upcoming matches:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/predictions", authenticateToken, async (req, res) => {
  try {
    const { matchId, predictedWinner, predictedScoreHome, predictedScoreAway } = req.body;
    
    const match = await prisma.sclMatch.findUnique({ where: { id: parseInt(matchId) } });
    
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    if (match.status !== 'PLANNED') {
      return res.status(400).json({ error: "Cannot predict for matches that have started or completed" });
    }
    
    const prediction = await prisma.prediction.upsert({
      where: {
        userId_matchId: {
          userId: req.user.id,
          matchId: parseInt(matchId)
        }
      },
      update: { predictedWinner, predictedScoreHome, predictedScoreAway },
      create: {
        userId: req.user.id,
        matchId: parseInt(matchId),
        predictedWinner,
        predictedScoreHome,
        predictedScoreAway
      }
    });
    
    res.json(prediction);
  } catch (err) {
    console.error("Error creating prediction:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/predictions/user/:userId", async (req, res) => {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { userId: parseInt(req.params.userId) },
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(predictions);
  } catch (err) {
    console.error("Error fetching user predictions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/predictions/leaderboard", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        predictions: true
      }
    });
    
    const leaderboard = users.map(user => ({
      username: user.username,
      totalPoints: user.predictions.reduce((sum, p) => sum + p.points, 0),
      totalPredictions: user.predictions.length
    }))
    .filter(u => u.totalPredictions > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);
    
    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching predictions leaderboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   ADMIN ENDPOINTS
   =========================================== */

// Teams CRUD
app.post("/api/admin/teams", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const team = await prisma.sclTeam.create({ data: req.body });
    res.json(team);
  } catch (err) {
    console.error("Error creating team:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/teams/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const team = await prisma.sclTeam.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(team);
  } catch (err) {
    console.error("Error updating team:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/teams/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.sclTeam.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting team:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Players CRUD
app.get("/api/players", async (req, res) => {
  try {
    const players = await prisma.sclPlayer.findMany({
      include: { team: true },
      orderBy: { displayName: 'asc' }
    });
    res.json(players);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   GET /api/players/:id  -> single player with full details
   =========================================== */
app.get("/api/players/:id", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    
    if (isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player ID" });
    }

    const player = await prisma.sclPlayer.findUnique({
      where: { id: playerId },
      include: {
        team: {
          include: {
            homeMatches: {
              include: {
                homeTeam: true,
                awayTeam: true
              },
              orderBy: { matchday: "asc" }
            },
            awayMatches: {
              include: {
                homeTeam: true,
                awayTeam: true
              },
              orderBy: { matchday: "asc" }
            }
          }
        }
      }
    });

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const allMatches = [
      ...player.team.homeMatches,
      ...player.team.awayMatches
    ].sort((a, b) => a.matchday - b.matchday);

    const matches = allMatches.map((m) => ({
      id: m.id,
      matchday: m.matchday,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      scoreHome: m.scoreHome,
      scoreAway: m.scoreAway,
      status: m.status,
      scheduledAt: m.scheduledAt
    }));

    const totalMatches = player.wins + player.losses;
    const winRate = totalMatches > 0 ? ((player.wins / totalMatches) * 100).toFixed(1) : 0;
    const goalsPerGame = totalMatches > 0 ? (player.goals / totalMatches).toFixed(2) : 0;
    const assistsPerGame = totalMatches > 0 ? (player.assists / totalMatches).toFixed(2) : 0;
    const savesPerGame = totalMatches > 0 ? (player.saves / totalMatches).toFixed(2) : 0;

    const response = {
      id: player.id,
      discordId: player.discordId,
      displayName: player.displayName,
      role: player.role,
      goals: player.goals,
      assists: player.assists,
      saves: player.saves,
      wins: player.wins,
      losses: player.losses,
      team: {
        id: player.team.id,
        name: player.team.name,
        shortName: player.team.shortName,
        tag: player.team.tag
      },
      matches: matches,
      performance: {
        totalMatches,
        winRate: parseFloat(winRate),
        goalsPerGame: parseFloat(goalsPerGame),
        assistsPerGame: parseFloat(assistsPerGame),
        savesPerGame: parseFloat(savesPerGame)
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching player details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/players", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const player = await prisma.sclPlayer.create({ data: req.body });
    res.json(player);
  } catch (err) {
    console.error("Error creating player:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/players/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const player = await prisma.sclPlayer.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(player);
  } catch (err) {
    console.error("Error updating player:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/players/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.sclPlayer.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting player:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Matches CRUD
app.post("/api/admin/matches", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const match = await prisma.sclMatch.create({ data: req.body });
    res.json(match);
  } catch (err) {
    console.error("Error creating match:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/matches/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const match = await prisma.sclMatch.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(match);
  } catch (err) {
    console.error("Error updating match:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/matches/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.sclMatch.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting match:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update match score (triggers Discord webhook and prediction scoring)
app.post("/api/admin/matches/:id/score", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { scoreHome, scoreAway } = req.body;
    
    const match = await prisma.sclMatch.update({
      where: { id: parseInt(req.params.id) },
      data: {
        scoreHome: parseInt(scoreHome),
        scoreAway: parseInt(scoreAway),
        status: 'COMPLETED',
        reportedAt: new Date()
      },
      include: { homeTeam: true, awayTeam: true }
    });
    
    // Calculate prediction points
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id }
    });
    
    for (const prediction of predictions) {
      let points = 0;
      
      // Exact score: 5 points
      if (prediction.predictedScoreHome === match.scoreHome && 
          prediction.predictedScoreAway === match.scoreAway) {
        points = 5;
      }
      // Correct winner: 2 points
      else if (prediction.predictedWinner) {
        const actualWinner = match.scoreHome > match.scoreAway ? 'home' : 
                           match.scoreHome < match.scoreAway ? 'away' : 'draw';
        if (prediction.predictedWinner === actualWinner) {
          points = 2;
        }
      }
      
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { points }
      });
    }
    
    // Send Discord webhook
    await sendDiscordWebhook(match);
    
    res.json(match);
  } catch (err) {
    console.error("Error updating match score:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   DISCORD WEBHOOK SERVICE
   =========================================== */

async function sendDiscordWebhook(match) {
  try {
    const webhook = await prisma.discordWebhook.findFirst({
      where: { enabled: true }
    });
    
    if (!webhook) {
      console.log("No Discord webhook configured");
      return;
    }
    
    const embed = {
      title: "⚽ Match Result",
      description: `**${match.homeTeam.name}** ${match.scoreHome} - ${match.scoreAway} **${match.awayTeam.name}**`,
      color: 0x6c5ce7,
      fields: [
        { name: "Matchday", value: `${match.matchday}`, inline: true },
        { name: "Status", value: match.status, inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    
    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
    }
  } catch (err) {
    console.error("Error sending Discord webhook:", err);
  }
}

// Webhook management
app.get("/api/admin/webhooks", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const webhooks = await prisma.discordWebhook.findMany();
    res.json(webhooks);
  } catch (err) {
    console.error("Error fetching webhooks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/webhooks", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, webhookUrl, enabled } = req.body;
    
    if (!type || !webhookUrl) {
      return res.status(400).json({ error: "Type and webhook URL are required" });
    }
    
    const webhook = await prisma.discordWebhook.upsert({
      where: { type: type },
      update: { name, webhookUrl, enabled },
      create: { name, type, webhookUrl, enabled }
    });
    
    res.json(webhook);
  } catch (err) {
    console.error("Error saving webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/webhooks/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const webhook = await prisma.discordWebhook.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(webhook);
  } catch (err) {
    console.error("Error updating webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/webhooks/standings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { matchday } = req.body;
    
    const webhook = await prisma.discordWebhook.findFirst({
      where: { 
        type: 'STANDINGS',
        enabled: true 
      }
    });
    
    if (!webhook) {
      return res.status(404).json({ error: "No standings webhook configured. Please configure it in the admin dashboard." });
    }
    
    const standings = await prisma.sclStanding.findMany({
      include: {
        team: true
      },
      orderBy: [
        { points: 'desc' },
        { goalsFor: 'desc' },
        { goalsAgainst: 'asc' }
      ]
    });
    
    let tableRows = [];
    tableRows.push("Pos ↕ Team        W  D  L  Pts");
    tableRows.push("――――――――――――――――――――――――――――――");
    
    standings.forEach((standing, index) => {
      const currentPos = index + 1;
      const prevPos = standing.previousPosition;
      
      let arrow = "→";
      if (prevPos !== null && prevPos !== undefined) {
        if (currentPos < prevPos) {
          arrow = "↑";
        } else if (currentPos > prevPos) {
          arrow = "↓";
        }
      }
      
      const teamName = (standing.team.shortName || standing.team.name).padEnd(11).substring(0, 11);
      
      const row = `${String(currentPos).padStart(3)} ${arrow} ${teamName} ${String(standing.wins).padStart(2)} ${String(standing.draws).padStart(2)} ${String(standing.losses).padStart(2)}  ${String(standing.points).padStart(3)}`;
      tableRows.push(row);
    });
    
    const tableContent = tableRows.join("\n");
    
    const title = matchday ? `📊 SCL STANDINGS - Matchday ${matchday}` : "📊 SCL STANDINGS";
    
    const embed = {
      title: title,
      description: `\`\`\`\n${tableContent}\n\`\`\``,
      color: 0x6366f1,
      footer: { text: "to view the full roster visit https://scl-league.com/standings" },
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: "View Full Roster",
                style: 5,
                url: "https://scl-league.com/standings"
              }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
      return res.status(500).json({ error: "Failed to send webhook" });
    }
    
    res.json({ success: true, message: "Standings sent to Discord" });
  } catch (err) {
    console.error("Error sending standings webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/webhooks/matchday-schedule", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { matchday } = req.body;
    
    if (!matchday) {
      return res.status(400).json({ error: "Matchday is required" });
    }
    
    const webhook = await prisma.discordWebhook.findFirst({
      where: { 
        type: 'MATCHDAY_SCHEDULE',
        enabled: true 
      }
    });
    
    if (!webhook) {
      return res.status(404).json({ error: "No matchday schedule webhook configured. Please configure it in the admin dashboard." });
    }
    
    const matches = await prisma.sclMatch.findMany({
      where: { matchday: parseInt(matchday) },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: { id: 'asc' }
    });
    
    if (matches.length === 0) {
      return res.status(404).json({ error: `No matches found for matchday ${matchday}` });
    }
    
    let matchLines = [];
    matchLines.push(`Matchday ${matchday} Schedule`);
    matchLines.push("―――――――――――――――――――――――――――――――――――");
    
    matches.forEach((match, index) => {
      const homeTeam = match.homeTeam.name.padEnd(20).substring(0, 20);
      const awayTeam = match.awayTeam.name.padEnd(20).substring(0, 20);
      const status = match.status === 'COMPLETED' 
        ? `${match.scoreHome} - ${match.scoreAway}` 
        : 'Scheduled';
      
      matchLines.push(`${index + 1}. ${homeTeam} vs ${awayTeam}  [${status}]`);
    });
    
    const scheduleContent = matchLines.join("\n");
    
    const embed = {
      title: `📅 MATCHDAY ${matchday} SCHEDULE`,
      description: `\`\`\`\n${scheduleContent}\n\`\`\``,
      color: 0xec4899,
      footer: { text: `Sideswipe Championship League · ${matches.length} matches` },
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    
    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
      return res.status(500).json({ error: "Failed to send webhook" });
    }
    
    res.json({ success: true, message: `Matchday ${matchday} schedule sent to Discord` });
  } catch (err) {
    console.error("Error sending matchday schedule webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   IMAGE GENERATION & WEBHOOK
   =========================================== */

app.get("/api/images/standings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { matchday } = req.query;
    const imageBuffer = await generateStandingsImage({ 
      currentMatchday: matchday ? parseInt(matchday) : null 
    });
    
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'inline; filename="standings.png"');
    res.send(imageBuffer);
  } catch (err) {
    console.error("Error generating standings image:", err);
    res.status(500).json({ error: "Failed to generate standings image" });
  }
});

app.get("/api/images/leaderboard", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit } = req.query;
    const imageBuffer = await generateLeaderboardImage({ 
      limit: limit ? parseInt(limit) : 10 
    });
    
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'inline; filename="leaderboard.png"');
    res.send(imageBuffer);
  } catch (err) {
    console.error("Error generating leaderboard image:", err);
    res.status(500).json({ error: "Failed to generate leaderboard image" });
  }
});

app.post("/api/webhooks/standings-image", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { matchday } = req.body;
    
    const webhook = await prisma.discordWebhook.findFirst({
      where: { webhookType: 'STANDINGS', enabled: true }
    });
    
    if (!webhook) {
      return res.status(400).json({ error: "No standings webhook configured or enabled" });
    }
    
    const imageBuffer = await generateStandingsImage({ 
      currentMatchday: matchday ? parseInt(matchday) : null,
      title: 'SCL STANDINGS'
    });
    
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'standings.png',
      contentType: 'image/png'
    });
    
    const payload = {
      content: matchday ? `📊 **SCL Standings** - After Matchday ${matchday}` : '📊 **SCL Standings**'
    };
    formData.append('payload_json', JSON.stringify(payload));
    
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
      return res.status(500).json({ error: "Failed to send image webhook" });
    }
    
    res.json({ success: true, message: "Standings image sent to Discord" });
  } catch (err) {
    console.error("Error sending standings image webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/webhooks/leaderboard-image", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    
    const webhook = await prisma.discordWebhook.findFirst({
      where: { webhookType: 'STANDINGS', enabled: true }
    });
    
    if (!webhook) {
      return res.status(400).json({ error: "No webhook configured. Using standings webhook for leaderboard." });
    }
    
    const imageBuffer = await generateLeaderboardImage({ 
      limit: parseInt(limit),
      title: `TOP ${limit} PLAYERS`
    });
    
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'leaderboard.png',
      contentType: 'image/png'
    });
    
    const payload = {
      content: `🏆 **Player Leaderboard** - Top ${limit} Scorers`
    };
    formData.append('payload_json', JSON.stringify(payload));
    
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
      return res.status(500).json({ error: "Failed to send image webhook" });
    }
    
    res.json({ success: true, message: "Leaderboard image sent to Discord" });
  } catch (err) {
    console.error("Error sending leaderboard image webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================
   TOORNAMENT API INTEGRATION
   =========================================== */

let cachedTournamentId = null;

app.get("/api/toornament/tournaments", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tournaments = await toornamentClient.getTournaments();
    res.json(tournaments);
  } catch (err) {
    console.error("Error fetching Toornament tournaments:", err);
    res.status(500).json({ error: "Failed to fetch tournaments from Toornament" });
  }
});

app.post("/api/toornament/set-tournament", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) {
      return res.status(400).json({ error: "Tournament ID required" });
    }
    
    const tournament = await toornamentClient.getTournament(tournamentId);
    cachedTournamentId = tournamentId;
    
    res.json({ 
      success: true, 
      message: "Tournament set successfully",
      tournament: {
        id: tournament.id,
        name: tournament.name,
        fullName: tournament.full_name
      }
    });
  } catch (err) {
    console.error("Error setting Toornament tournament:", err);
    res.status(500).json({ error: "Failed to set tournament" });
  }
});

app.get("/api/toornament/current-tournament", async (req, res) => {
  try {
    if (!cachedTournamentId) {
      return res.json({ tournament: null });
    }
    const tournament = await toornamentClient.getTournament(cachedTournamentId);
    res.json({ 
      tournament: {
        id: tournament.id,
        name: tournament.name,
        fullName: tournament.full_name,
        status: tournament.status,
        scheduledDateStart: tournament.scheduled_date_start,
        scheduledDateEnd: tournament.scheduled_date_end
      }
    });
  } catch (err) {
    console.error("Error fetching current tournament:", err);
    res.status(500).json({ error: "Failed to fetch current tournament" });
  }
});

app.get("/api/toornament/stages", async (req, res) => {
  try {
    if (!cachedTournamentId) {
      return res.status(400).json({ error: "No tournament selected. Set a tournament first." });
    }
    const stages = await toornamentClient.getStages(cachedTournamentId);
    res.json(stages);
  } catch (err) {
    console.error("Error fetching Toornament stages:", err);
    res.status(500).json({ error: "Failed to fetch stages" });
  }
});

app.get("/api/toornament/standings", async (req, res) => {
  try {
    if (!cachedTournamentId) {
      return res.status(400).json({ error: "No tournament selected. Set a tournament first." });
    }
    
    const { stageId } = req.query;
    
    let targetStageId = stageId;
    if (!targetStageId) {
      const stages = await toornamentClient.getStages(cachedTournamentId);
      if (stages.length === 0) {
        return res.status(404).json({ error: "No stages found in tournament" });
      }
      targetStageId = stages[0].id;
    }
    
    const standings = await toornamentClient.getStandings(cachedTournamentId, targetStageId);
    res.json(standings);
  } catch (err) {
    console.error("Error fetching Toornament standings:", err);
    res.status(500).json({ error: "Failed to fetch standings" });
  }
});

app.get("/api/toornament/matches", async (req, res) => {
  try {
    if (!cachedTournamentId) {
      return res.status(400).json({ error: "No tournament selected. Set a tournament first." });
    }
    
    const { stageId, status } = req.query;
    const options = {};
    if (stageId) options.stageId = stageId;
    if (status) options.status = status;
    
    const matches = await toornamentClient.getFormattedMatches(cachedTournamentId, stageId);
    res.json(matches);
  } catch (err) {
    console.error("Error fetching Toornament matches:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

app.get("/api/toornament/participants", async (req, res) => {
  try {
    if (!cachedTournamentId) {
      return res.status(400).json({ error: "No tournament selected. Set a tournament first." });
    }
    
    const participants = await toornamentClient.getParticipants(cachedTournamentId);
    res.json(participants);
  } catch (err) {
    console.error("Error fetching Toornament participants:", err);
    res.status(500).json({ error: "Failed to fetch participants" });
  }
});

/* ===========================================
   MATCH SUBMIT PORTAL (uses unified AuthAccount)
   =========================================== */

// Middleware to check if user can submit (PLAYER or LEADER with a team)
const requireSubmitAccess = async (req, res, next) => {
  try {
    const account = await prisma.authAccount.findUnique({ 
      where: { id: req.user.id },
      include: { team: true }
    });
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    if (!['PLAYER', 'LEADER', 'STAFF', 'ADMIN'].includes(account.role)) {
      return res.status(403).json({ error: "Only players and leaders can submit match results" });
    }
    
    if (['PLAYER', 'LEADER'].includes(account.role) && !account.teamId) {
      return res.status(400).json({ error: "No team assigned to your account" });
    }
    
    req.account = account;
    next();
  } catch (err) {
    console.error("Submit access check error:", err);
    res.sendStatus(500);
  }
};

// Get current user's submit info (uses unified auth)
app.get("/api/submit/me", authenticateToken, async (req, res) => {
  try {
    const account = await prisma.authAccount.findUnique({
      where: { id: req.user.id },
      include: {
        team: {
          select: { id: true, name: true, shortName: true, logoUrl: true }
        }
      }
    });
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    res.json({
      id: account.id,
      username: account.username,
      role: account.role,
      isAdmin: ['ADMIN', 'STAFF'].includes(account.role),
      canSubmit: ['PLAYER', 'LEADER', 'STAFF', 'ADMIN'].includes(account.role),
      team: account.team
    });
  } catch (err) {
    console.error("Error fetching account:", err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

app.get("/api/submit/my-team/players", authenticateToken, requireSubmitAccess, async (req, res) => {
  try {
    const players = await prisma.sclPlayer.findMany({
      where: { teamId: req.account.teamId },
      orderBy: { displayName: 'asc' }
    });
    
    res.json(players);
  } catch (err) {
    console.error("Error fetching team players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

app.get("/api/submit/my-team/matches", authenticateToken, requireSubmitAccess, async (req, res) => {
  try {
    const matches = await prisma.sclMatch.findMany({
      where: {
        OR: [
          { homeTeamId: req.account.teamId },
          { awayTeamId: req.account.teamId }
        ]
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } }
      },
      orderBy: { matchday: 'asc' }
    });
    
    res.json(matches);
  } catch (err) {
    console.error("Error fetching team matches:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

app.post("/api/submit/screenshots", authenticateToken, requireSubmitAccess, async (req, res) => {
  try {
    const { matchday, opponentTeamId, games } = req.body;
    
    if (!matchday || !games || !Array.isArray(games)) {
      return res.status(400).json({ error: "Matchday and games are required" });
    }
    
    const validGames = games.filter(g => g.imageData && g.gameNumber);
    
    if (validGames.length === 0) {
      return res.status(400).json({ error: "At least one game screenshot is required" });
    }
    
    const submits = await Promise.all(
      validGames.map(game => 
        prisma.matchSubmit.create({
          data: {
            imageData: game.imageData,
            submitterId: req.account.id,
            teamId: req.account.teamId,
            opponentTeamId: opponentTeamId ? parseInt(opponentTeamId) : null,
            matchday: parseInt(matchday),
            gameNumber: parseInt(game.gameNumber),
            processed: false
          }
        })
      )
    );
    
    res.json({ 
      success: true, 
      message: `${submits.length} game screenshot(s) submitted successfully`,
      count: submits.length
    });
  } catch (err) {
    console.error("Error submitting screenshots:", err);
    res.status(500).json({ error: "Failed to submit screenshots" });
  }
});

app.get("/api/submit/my-submissions", authenticateToken, async (req, res) => {
  try {
    const submissions = await prisma.matchSubmit.findMany({
      where: { submitterId: req.user.id },
      include: {
        team: { select: { id: true, name: true, shortName: true } },
        opponentTeam: { select: { id: true, name: true, shortName: true } }
      },
      orderBy: [
        { matchday: 'desc' },
        { gameNumber: 'asc' }
      ]
    });
    
    res.json(submissions);
  } catch (err) {
    console.error("Error fetching user submissions:", err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// Admin routes for submissions - use unified requireAdmin
app.get("/api/submit/admin/submissions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { processed, teamId } = req.query;
    
    const where = {};
    if (processed !== undefined) {
      where.processed = processed === 'true';
    }
    if (teamId) {
      where.teamId = parseInt(teamId);
    }
    
    const submissions = await prisma.matchSubmit.findMany({
      where,
      include: {
        submitter: { select: { id: true, username: true } },
        team: { select: { id: true, name: true, shortName: true } },
        opponentTeam: { select: { id: true, name: true, shortName: true } }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });
    
    res.json(submissions);
  } catch (err) {
    console.error("Error fetching all submissions:", err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

app.patch("/api/submit/admin/submissions/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { processed } = req.body;
    
    const submission = await prisma.matchSubmit.update({
      where: { id: parseInt(req.params.id) },
      data: { processed }
    });
    
    res.json(submission);
  } catch (err) {
    console.error("Error updating submission:", err);
    res.status(500).json({ error: "Failed to update submission" });
  }
});

// Admin: Get all users
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, teamId, search } = req.query;
    
    const where = {};
    if (role) where.role = role;
    if (teamId) where.teamId = parseInt(teamId);
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const users = await prisma.authAccount.findMany({
      where,
      include: {
        team: { select: { id: true, name: true, shortName: true } }
      },
      orderBy: { username: 'asc' }
    });
    
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      team: u.team,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    })));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Admin: Update user role/team (PATCH)
app.patch("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, teamId } = req.body;
    
    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (teamId !== undefined) updateData.teamId = teamId ? parseInt(teamId) : null;
    
    const user = await prisma.authAccount.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        team: { select: { id: true, name: true, shortName: true } }
      }
    });
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      team: user.team
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Admin: Update user role/team (PUT - for frontend compatibility)
app.put("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, teamId } = req.body;
    
    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (teamId !== undefined) updateData.teamId = teamId ? parseInt(teamId) : null;
    
    const user = await prisma.authAccount.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        team: { select: { id: true, name: true, shortName: true } }
      }
    });
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      team: user.team
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/* ===========================================
   OCR PROCESSING ENDPOINTS
   =========================================== */

app.post("/api/submit/admin/ocr/process/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.id);
    
    const submission = await prisma.matchSubmit.findUnique({
      where: { id: submissionId },
      include: {
        team: { select: { id: true, name: true, shortName: true } },
        opponentTeam: { select: { id: true, name: true, shortName: true } }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }
    
    console.log(`Processing OCR for submission ${submissionId}...`);
    
    const ocrResult = await processMatchScreenshot(submission.imageData);
    
    await prisma.matchSubmit.update({
      where: { id: submissionId },
      data: {
        ocrResult: JSON.stringify(ocrResult),
        ocrProcessedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      submissionId,
      ocrResult
    });
  } catch (err) {
    console.error("Error processing OCR:", err);
    res.status(500).json({ error: "OCR processing failed" });
  }
});

app.post("/api/submit/admin/ocr/process-matchday", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { teamId, matchday } = req.body;
    
    if (!teamId || !matchday) {
      return res.status(400).json({ error: "Team ID and matchday are required" });
    }
    
    const submissions = await prisma.matchSubmit.findMany({
      where: {
        teamId: parseInt(teamId),
        matchday: parseInt(matchday)
      },
      orderBy: { gameNumber: 'asc' }
    });
    
    if (submissions.length === 0) {
      return res.status(404).json({ error: "No submissions found for this matchday" });
    }
    
    console.log(`Processing OCR for ${submissions.length} submissions...`);
    
    const screenshots = submissions.map(s => ({
      gameNumber: s.gameNumber,
      imageData: s.imageData
    }));
    
    const gameResults = await processMultipleScreenshots(screenshots);
    const aggregatedResult = aggregateMatchResults(gameResults);
    
    for (let i = 0; i < submissions.length; i++) {
      const submission = submissions[i];
      const gameResult = gameResults.find(g => g.gameNumber === submission.gameNumber);
      
      if (gameResult) {
        await prisma.matchSubmit.update({
          where: { id: submission.id },
          data: {
            ocrResult: JSON.stringify(gameResult),
            ocrProcessedAt: new Date()
          }
        });
      }
    }
    
    res.json({
      success: true,
      teamId: parseInt(teamId),
      matchday: parseInt(matchday),
      gamesProcessed: submissions.length,
      gameResults,
      aggregatedResult
    });
  } catch (err) {
    console.error("Error processing matchday OCR:", err);
    res.status(500).json({ error: "OCR processing failed" });
  }
});

app.post("/api/submit/admin/ocr/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { teamId, matchday, homeScore, awayScore, opponentTeamId } = req.body;
    
    if (!teamId || !matchday || homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: "Team ID, matchday, and scores are required" });
    }
    
    const match = await prisma.sclMatch.findFirst({
      where: {
        matchday: parseInt(matchday),
        OR: [
          { homeTeamId: parseInt(teamId), awayTeamId: opponentTeamId ? parseInt(opponentTeamId) : undefined },
          { awayTeamId: parseInt(teamId), homeTeamId: opponentTeamId ? parseInt(opponentTeamId) : undefined }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });
    
    if (!match) {
      return res.status(404).json({ error: "Match not found for this matchday and team" });
    }
    
    const isHomeTeam = match.homeTeamId === parseInt(teamId);
    
    const updatedMatch = await prisma.sclMatch.update({
      where: { id: match.id },
      data: {
        homeScore: isHomeTeam ? parseInt(homeScore) : parseInt(awayScore),
        awayScore: isHomeTeam ? parseInt(awayScore) : parseInt(homeScore),
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });
    
    await prisma.matchSubmit.updateMany({
      where: {
        teamId: parseInt(teamId),
        matchday: parseInt(matchday)
      },
      data: {
        processed: true
      }
    });
    
    res.json({
      success: true,
      message: "Match result approved and saved",
      match: {
        id: updatedMatch.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeScore: updatedMatch.homeScore,
        awayScore: updatedMatch.awayScore,
        status: updatedMatch.status
      }
    });
  } catch (err) {
    console.error("Error approving OCR result:", err);
    res.status(500).json({ error: "Failed to approve result" });
  }
});

app.get("/api/submit/admin/pending-review", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingSubmissions = await prisma.matchSubmit.findMany({
      where: {
        processed: false,
        ocrResult: { not: null }
      },
      include: {
        team: { select: { id: true, name: true, shortName: true } },
        opponentTeam: { select: { id: true, name: true, shortName: true } },
        submitter: { select: { id: true, username: true } }
      },
      orderBy: [
        { matchday: 'asc' },
        { teamId: 'asc' },
        { gameNumber: 'asc' }
      ]
    });
    
    const grouped = {};
    for (const sub of pendingSubmissions) {
      const key = `${sub.teamId}-${sub.matchday}`;
      if (!grouped[key]) {
        grouped[key] = {
          teamId: sub.teamId,
          team: sub.team,
          opponentTeam: sub.opponentTeam,
          matchday: sub.matchday,
          games: []
        };
      }
      grouped[key].games.push({
        id: sub.id,
        gameNumber: sub.gameNumber,
        ocrResult: sub.ocrResult ? JSON.parse(sub.ocrResult) : null,
        submitter: sub.submitter,
        createdAt: sub.createdAt
      });
    }
    
    res.json(Object.values(grouped));
  } catch (err) {
    console.error("Error fetching pending reviews:", err);
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

app.post("/api/submit/admin/submissions/reject", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { teamId, matchday } = req.body;
    
    if (!teamId || !matchday) {
      return res.status(400).json({ error: "Team ID and matchday are required" });
    }
    
    await prisma.matchSubmit.updateMany({
      where: {
        teamId: parseInt(teamId),
        matchday: parseInt(matchday)
      },
      data: {
        processed: true
      }
    });
    
    res.json({ success: true, message: "Submissions rejected and marked as processed" });
  } catch (err) {
    console.error("Error rejecting submissions:", err);
    res.status(500).json({ error: "Failed to reject submissions" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SCL API running on http://0.0.0.0:${PORT}`);
});
