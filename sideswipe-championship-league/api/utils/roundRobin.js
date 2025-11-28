// api/utils/roundRobin.js

/**
 * Generates a round-robin schedule for N teams
 * Returns an array of rounds, each containing matches.
 *
 * teams = array of team IDs
 */

export function generateRoundRobin(teams) {
  const teamCount = teams.length;
  const isOdd = teamCount % 2 !== 0;

  // If odd number, add a dummy with value null
  const teamList = isOdd ? [...teams, null] : [...teams];

  const totalTeams = teamList.length;
  const rounds = totalTeams - 1;
  const half = totalTeams / 2;

  const schedule = [];

  let home = teamList.slice(0, half);
  let away = teamList.slice(half).reverse();

  for (let round = 1; round <= rounds; round++) {
    const matches = [];

    for (let i = 0; i < half; i++) {
      const homeTeam = home[i];
      const awayTeam = away[i];

      if (homeTeam !== null && awayTeam !== null) {
        matches.push({
          round,
          homeTeamId: homeTeam,
          awayTeamId: awayTeam
        });
      }
    }

    schedule.push(matches);

    // rotate teams (circle method, keep first element static)
    if (totalTeams > 2) {
      const fixed = home[0];

      const newHome = [fixed, away[0], ...home.slice(1, -1)];
      const newAway = [...away.slice(1), home[home.length - 1]];

      home = newHome;
      away = newAway;
    }
  }

  return schedule;
}
