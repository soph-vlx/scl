// api/utils/calcStandings.js

/**
 * Recalculates standings for a tournament.
 * Applies:
 *  - games played
 *  - wins / draws / losses
 *  - goals for / against
 *  - points (3W / 1D / 0L)
 *
 * @param {PrismaClient} prisma
 * @param {number} tournamentId
 */

export async function recalcStandings(prisma, tournamentId) {
  // Reset standings first
  await prisma.standing.updateMany({
    where: { tournamentId },
    data: {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    }
  });

  // Get completed matches
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      scoreHome: { not: null },
      scoreAway: { not: null }
    }
  });

  for (const m of matches) {
    // update stats for both teams
    await applyMatchToStandings(prisma, tournamentId, m);
  }

  return { updated: true };
}

async function applyMatchToStandings(prisma, tournamentId, match) {
  const { homeTeamId, awayTeamId, scoreHome, scoreAway } = match;

  // Update played + goals
  await prisma.standing.updateMany({
    where: { tournamentId, teamId: homeTeamId },
    data: {
      played: { increment: 1 },
      goalsFor: { increment: scoreHome },
      goalsAgainst: { increment: scoreAway }
    }
  });

  await prisma.standing.updateMany({
    where: { tournamentId, teamId: awayTeamId },
    data: {
      played: { increment: 1 },
      goalsFor: { increment: scoreAway },
      goalsAgainst: { increment: scoreHome }
    }
  });

  // Decide W/D/L
  if (scoreHome > scoreAway) {
    await prisma.standing.updateMany({
      where: { tournamentId, teamId: homeTeamId },
      data: { wins: { increment: 1 }, points: { increment: 3 } }
    });

    await prisma.standing.updateMany({
      where: { tournamentId, teamId: awayTeamId },
      data: { losses: { increment: 1 } }
    });
  } else if (scoreAway > scoreHome) {
    await prisma.standing.updateMany({
      where: { tournamentId, teamId: awayTeamId },
      data: { wins: { increment: 1 }, points: { increment: 3 } }
    });

    await prisma.standing.updateMany({
      where: { tournamentId, teamId: homeTeamId },
      data: { losses: { increment: 1 } }
    });
  } else {
    // draw
    await prisma.standing.updateMany({
      where: { tournamentId, teamId: homeTeamId },
      data: { draws: { increment: 1 }, points: { increment: 1 } }
    });

    await prisma.standing.updateMany({
      where: { tournamentId, teamId: awayTeamId },
      data: { draws: { increment: 1 }, points: { increment: 1 } }
    });
  }
}
