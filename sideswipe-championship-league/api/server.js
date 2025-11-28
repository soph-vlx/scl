import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { generateRoundRobin } from "./utils/roundRobin.js";
import { recalcStandings } from "./utils/calcStandings.js";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "SCL API online" });
});

/* =======================================================
   CREATE TOURNAMENT
   ======================================================= */
app.post("/api/tournaments", async (req, res) => {
  try {
    const { name, slug, season, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "name and slug required" });
    }

    const tournament = await prisma.tournament.create({
      data: { name, slug, season, description }
    });

    res.status(201).json(tournament);
  } catch (err) {
    console.error("Error creating tournament:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =======================================================
   GENERATE ROUND ROBIN
   ======================================================= */
app.post("/api/tournaments/:slug/generate", async (req, res) => {
  try {
    const { slug } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: { teams: true, matches: true }
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (tournament.matches.length > 0) {
      return res.status(400).json({ error: "Round robin already generated" });
    }

    const teams = tournament.teams;
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length < 2) {
      return res
        .status(400)
        .json({ error: "Tournament requires at least 2 teams" });
    }

    const rounds = generateRoundRobin(teamIds);
    let createdMatches = [];

    for (const roundMatches of rounds) {
      for (const m of roundMatches) {
        const match = await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            round: m.round,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId
          }
        });

        createdMatches.push(match);
      }
    }

    // Create standings rows
    for (const teamId of teamIds) {
      await prisma.standing.create({
        data: { tournamentId: tournament.id, teamId }
      });
    }

    res.json({
      message: "Round robin generated",
      rounds: rounds.length,
      matchesCreated: createdMatches.length
    });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =======================================================
   REPORT MATCH RESULT
   ======================================================= */
app.post("/api/matches/:id/report", async (req, res) => {
  try {
    const { id } = req.params;
    const { scoreHome, scoreAway } = req.body;

    if (scoreHome == null || scoreAway == null) {
      return res.status(400).json({ error: "Scores required" });
    }

    const match = await prisma.match.findUnique({
      where: { id: Number(id) }
    });

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    // Update match
    const updatedMatch = await prisma.match.update({
      where: { id: Number(id) },
      data: {
        scoreHome,
        scoreAway,
        status: "COMPLETED",
        reportedAt: new Date()
      }
    });

    // Recalculate standings
    await recalcStandings(prisma, match.tournamentId);

    res.json({ message: "Result reported", match: updatedMatch });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =======================================================
   GET MATCHES FOR TOURNAMENT
   ======================================================= */
app.get("/api/tournaments/:slug/matches", async (req, res) => {
  try {
    const { slug } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        matches: true
      }
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(tournament.matches);
  } catch (err) {
    console.error("Matches error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =======================================================
   GET LIVE STANDINGS
   ======================================================= */
app.get("/api/tournaments/:slug/standings", async (req, res) => {
  try {
    const { slug } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { slug }
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const standings = await prisma.standing.findMany({
      where: { tournamentId: tournament.id },
      include: { team: true },
      orderBy: [
        { points: "desc" },
        { goalsFor: "desc" },
        { goalsAgainst: "asc" }
      ]
    });

    res.json(standings);
  } catch (err) {
    console.error("Standings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { app };
