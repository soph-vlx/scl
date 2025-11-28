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

async function loadTeamPage() {
    const teamId = getQueryParam("id");
    const nameEl = document.querySelector("#team-name");
    const statsEl = document.querySelector("#team-stats");
    const matchesEl = document.querySelector("#team-matches");
    const playersEl = document.querySelector("#player-list");

    if (!teamId) {
        nameEl.textContent = "Team not found.";
        statsEl.textContent = "";
        matchesEl.textContent = "";
        playersEl.textContent = "";
        return;
    }

    try {
        const team = await getJSON(`/api/teams/${teamId}`);

        nameEl.textContent = team.name;

        const logoContainer = document.querySelector(".team-logo-placeholder");
        
        // Display real logo if available, otherwise use gradient placeholder
        if (team.logoUrl) {
            const logoImg = document.createElement("img");
            // Using createElement and setting properties directly is safe from XSS
            logoImg.src = team.logoUrl;
            logoImg.alt = `${team.name} logo`;
            logoImg.className = "team-logo-img";
            logoImg.style.margin = "20px auto";
            
            // On error, fall back to gradient placeholder
            logoImg.onerror = () => {
                logoImg.style.display = "none";
                logoContainer.style.display = "block";
                const c1 = "#" + Math.floor(Math.random() * 16777215).toString(16);
                const c2 = "#" + Math.floor(Math.random() * 16777215).toString(16);
                logoContainer.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
            };
            
            logoContainer.parentNode.insertBefore(logoImg, logoContainer);
            logoContainer.style.display = "none";
        } else {
            // No logo URL, use gradient placeholder
            const c1 = "#" + Math.floor(Math.random() * 16777215).toString(16);
            const c2 = "#" + Math.floor(Math.random() * 16777215).toString(16);
            logoContainer.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
        }

        if (team.standing) {
            const gd = team.standing.goalDifference;
            const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : 'neutral';
            
            statsEl.innerHTML = `
                <div class="team-stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Position</span>
                        <span class="stat-value">${team.standing.position || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Played</span>
                        <span class="stat-value">${team.standing.played}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Wins</span>
                        <span class="stat-value">${team.standing.wins}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Draws</span>
                        <span class="stat-value">${team.standing.draws}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Losses</span>
                        <span class="stat-value">${team.standing.losses}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Goals For</span>
                        <span class="stat-value">${team.standing.goalsFor}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Goals Against</span>
                        <span class="stat-value">${team.standing.goalsAgainst}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Goal Difference</span>
                        <span class="stat-value ${gdClass}">${gd > 0 ? '+' : ''}${gd}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Points</span>
                        <span class="stat-value highlight">${team.standing.points}</span>
                    </div>
                </div>
            `;
        } else {
            statsEl.innerHTML = `<p>No stats available yet.</p>`;
        }

        if (team.matches && team.matches.length > 0) {
            matchesEl.innerHTML = "";
            team.matches.forEach((m) => {
                const div = document.createElement("div");
                div.className = "match-card";

                const score = m.status === "COMPLETED" && m.scoreHome !== null
                    ? `${m.scoreHome} - ${m.scoreAway}`
                    : "TBD";

                const isHome = m.homeTeam === team.name;
                const opponent = isHome ? m.awayTeam : m.homeTeam;
                const location = isHome ? "vs" : "@";

                div.innerHTML = `
                    <div class="match-teams">${location} ${opponent}</div>
                    <div class="match-info">Matchday ${m.matchday}</div>
                    <div class="match-info">Status: ${m.status}</div>
                    <div class="match-score">Score: ${score}</div>
                `;
                matchesEl.appendChild(div);
            });
        } else {
            matchesEl.innerHTML = `<p>No matches scheduled yet.</p>`;
        }

        if (team.players && team.players.length > 0) {
            playersEl.innerHTML = "";
            const playerGrid = document.createElement("div");
            playerGrid.className = "player-grid";

            team.players.forEach((player) => {
                const playerCard = document.createElement("div");
                playerCard.className = "player-card";

                const roleClass = player.role === "LEADER" ? "role-leader" : "";

                playerCard.innerHTML = `
                    <h3><a href="player?id=${player.id}" class="player-link">${player.displayName}</a></h3>
                    <p class="player-role ${roleClass}">${player.role}</p>
                    <div class="player-stats-mini">
                        <span><i class="fas fa-futbol"></i> ${player.goals || 0} goals</span>
                        <span><i class="fas fa-hands-helping"></i> ${player.assists || 0} assists</span>
                        <span><i class="fas fa-shield-alt"></i> ${player.saves || 0} saves</span>
                    </div>
                    <div class="player-record">
                        <span class="wins">${player.wins || 0}W</span> - 
                        <span class="losses">${player.losses || 0}L</span>
                    </div>
                `;
                playerGrid.appendChild(playerCard);
            });

            playersEl.appendChild(playerGrid);
        } else {
            playersEl.innerHTML = `<p>No players registered yet.</p>`;
        }

    } catch (err) {
        console.error("Error loading team page:", err);
        nameEl.textContent = "Error loading team.";
        statsEl.innerHTML = `<p>Unable to load team data. Please try again later.</p>`;
        matchesEl.innerHTML = "";
        playersEl.innerHTML = "";
    }
}

document.addEventListener("DOMContentLoaded", loadTeamPage);
