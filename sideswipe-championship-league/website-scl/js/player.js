async function getJSON(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

async function loadPlayerPage() {
    const playerId = getQueryParam("id");
    const nameEl = document.querySelector("#player-name");
    const teamEl = document.querySelector("#player-team");
    const statsEl = document.querySelector("#player-stats");
    const performanceEl = document.querySelector("#player-performance");
    const matchesEl = document.querySelector("#player-matches");

    if (!playerId) {
        nameEl.textContent = "Player not found.";
        teamEl.textContent = "";
        statsEl.textContent = "";
        performanceEl.textContent = "";
        matchesEl.textContent = "";
        return;
    }

    try {
        const player = await getJSON(`/api/players/${playerId}`);

        nameEl.innerHTML = `${player.displayName} <span class="player-role-badge ${player.role === 'LEADER' ? 'role-leader' : ''}">${player.role}</span>`;
        
        teamEl.innerHTML = `
            <i class="fas fa-users"></i> 
            <a href="team?id=${player.team.id}">${player.team.name}</a>
        `;

        statsEl.innerHTML = `
            <div class="team-stats-grid">
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-futbol"></i> Goals</span>
                    <span class="stat-value highlight">${player.goals}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-hands-helping"></i> Assists</span>
                    <span class="stat-value highlight">${player.assists}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-shield-alt"></i> Saves</span>
                    <span class="stat-value highlight">${player.saves}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-trophy"></i> Wins</span>
                    <span class="stat-value positive">${player.wins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-times-circle"></i> Losses</span>
                    <span class="stat-value negative">${player.losses}</span>
                </div>
            </div>
        `;

        const perf = player.performance;
        const winRateClass = perf.winRate >= 60 ? 'positive' : perf.winRate >= 40 ? 'neutral' : 'negative';
        
        performanceEl.innerHTML = `
            <div class="team-stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Matches</span>
                    <span class="stat-value">${perf.totalMatches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Win Rate</span>
                    <span class="stat-value ${winRateClass}">${perf.winRate}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Goals Per Game</span>
                    <span class="stat-value">${perf.goalsPerGame}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Assists Per Game</span>
                    <span class="stat-value">${perf.assistsPerGame}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Saves Per Game</span>
                    <span class="stat-value">${perf.savesPerGame}</span>
                </div>
            </div>
        `;

        if (player.matches && player.matches.length > 0) {
            matchesEl.innerHTML = "";
            player.matches.forEach((m) => {
                const div = document.createElement("div");
                div.className = "match-card";

                const score = m.status === "COMPLETED" && m.scoreHome !== null
                    ? `${m.scoreHome} - ${m.scoreAway}`
                    : "TBD";

                const isHome = m.homeTeam === player.team.name;
                const opponent = isHome ? m.awayTeam : m.homeTeam;
                const location = isHome ? "vs" : "@";

                let result = "";
                if (m.status === "COMPLETED") {
                    const teamWon = (isHome && m.scoreHome > m.scoreAway) || (!isHome && m.scoreAway > m.scoreHome);
                    result = teamWon ? '<span class="match-result win">W</span>' : '<span class="match-result loss">L</span>';
                }

                div.innerHTML = `
                    <div class="match-header">
                        ${result}
                        <span class="match-teams">${location} ${opponent}</span>
                    </div>
                    <div class="match-info">Matchday ${m.matchday}</div>
                    <div class="match-info">Status: ${m.status}</div>
                    <div class="match-score">Score: ${score}</div>
                `;
                matchesEl.appendChild(div);
            });
        } else {
            matchesEl.innerHTML = `<p>No matches played yet.</p>`;
        }

    } catch (err) {
        console.error("Error loading player page:", err);
        nameEl.textContent = "Error loading player.";
        teamEl.textContent = "";
        statsEl.innerHTML = `<p>Unable to load player data. Please try again later.</p>`;
        performanceEl.innerHTML = "";
        matchesEl.innerHTML = "";
    }
}

document.addEventListener("DOMContentLoaded", loadPlayerPage);
