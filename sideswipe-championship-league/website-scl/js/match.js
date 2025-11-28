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

function formatDate(dateString) {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusBadge(status) {
    const statusMap = {
        'PLANNED': { text: 'Upcoming', class: 'status-planned' },
        'ONGOING': { text: 'Live', class: 'status-ongoing' },
        'COMPLETED': { text: 'Completed', class: 'status-completed' },
        'CANCELLED': { text: 'Cancelled', class: 'status-cancelled' }
    };
    const info = statusMap[status] || { text: status, class: '' };
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
}

async function loadMatchPage() {
    const matchId = getQueryParam("id");
    const titleEl = document.querySelector("#match-title");
    const infoEl = document.querySelector("#match-info");
    const scoreEl = document.querySelector("#match-score");
    const teamsEl = document.querySelector("#match-teams");

    if (!matchId) {
        titleEl.textContent = "Match not found.";
        infoEl.textContent = "";
        scoreEl.textContent = "";
        teamsEl.textContent = "";
        return;
    }

    try {
        const match = await getJSON(`/api/matches/${matchId}`);

        titleEl.innerHTML = `Matchday ${match.matchday}: ${match.homeTeam.name} vs ${match.awayTeam.name}`;
        
        infoEl.innerHTML = `
            <i class="fas fa-calendar-alt"></i> ${formatDate(match.scheduledAt)} 
            ${getStatusBadge(match.status)}
        `;

        if (match.status === 'COMPLETED' && match.scoreHome !== null && match.scoreAway !== null) {
            const homeWon = match.scoreHome > match.scoreAway;
            const awayWon = match.scoreAway > match.scoreHome;
            const draw = match.scoreHome === match.scoreAway;
            
            scoreEl.innerHTML = `
                <div class="match-score-box">
                    <div class="score-team ${homeWon ? 'winner' : ''}">
                        <a href="team?id=${match.homeTeam.id}" class="team-name-link">${match.homeTeam.name}</a>
                        <span class="team-tag">${match.homeTeam.tag}</span>
                    </div>
                    <div class="score-numbers">
                        <span class="score ${homeWon ? 'winning-score' : ''}">${match.scoreHome}</span>
                        <span class="score-separator">-</span>
                        <span class="score ${awayWon ? 'winning-score' : ''}">${match.scoreAway}</span>
                    </div>
                    <div class="score-team ${awayWon ? 'winner' : ''}">
                        <a href="team?id=${match.awayTeam.id}" class="team-name-link">${match.awayTeam.name}</a>
                        <span class="team-tag">${match.awayTeam.tag}</span>
                    </div>
                </div>
            `;
        } else {
            scoreEl.innerHTML = `
                <div class="match-score-box">
                    <div class="score-team">
                        <a href="team?id=${match.homeTeam.id}" class="team-name-link">${match.homeTeam.name}</a>
                        <span class="team-tag">${match.homeTeam.tag}</span>
                    </div>
                    <div class="score-numbers">
                        <span class="score">-</span>
                        <span class="score-separator">vs</span>
                        <span class="score">-</span>
                    </div>
                    <div class="score-team">
                        <a href="team?id=${match.awayTeam.id}" class="team-name-link">${match.awayTeam.name}</a>
                        <span class="team-tag">${match.awayTeam.tag}</span>
                    </div>
                </div>
            `;
        }

        const homePlayersHTML = match.homeTeam.players.map(p => `
            <div class="player-card">
                <div class="player-info">
                    <a href="player?id=${p.id}" class="player-name-link">
                        ${p.displayName}
                    </a>
                    <span class="player-role-badge ${p.role === 'LEADER' ? 'role-leader' : ''}">${p.role}</span>
                </div>
                <div class="player-stats-mini">
                    <span><i class="fas fa-futbol"></i> ${p.goals}</span>
                    <span><i class="fas fa-hands-helping"></i> ${p.assists}</span>
                    <span><i class="fas fa-shield-alt"></i> ${p.saves}</span>
                </div>
            </div>
        `).join('');

        const awayPlayersHTML = match.awayTeam.players.map(p => `
            <div class="player-card">
                <div class="player-info">
                    <a href="player?id=${p.id}" class="player-name-link">
                        ${p.displayName}
                    </a>
                    <span class="player-role-badge ${p.role === 'LEADER' ? 'role-leader' : ''}">${p.role}</span>
                </div>
                <div class="player-stats-mini">
                    <span><i class="fas fa-futbol"></i> ${p.goals}</span>
                    <span><i class="fas fa-hands-helping"></i> ${p.assists}</span>
                    <span><i class="fas fa-shield-alt"></i> ${p.saves}</span>
                </div>
            </div>
        `).join('');

        teamsEl.innerHTML = `
            <div class="match-team-section">
                <h3>
                    <a href="team?id=${match.homeTeam.id}" class="team-section-link">
                        <i class="fas fa-home"></i> ${match.homeTeam.name}
                    </a>
                </h3>
                <div class="match-roster">
                    ${homePlayersHTML}
                </div>
            </div>
            <div class="match-team-section">
                <h3>
                    <a href="team?id=${match.awayTeam.id}" class="team-section-link">
                        <i class="fas fa-plane"></i> ${match.awayTeam.name}
                    </a>
                </h3>
                <div class="match-roster">
                    ${awayPlayersHTML}
                </div>
            </div>
        `;

    } catch (err) {
        console.error("Error loading match:", err);
        titleEl.textContent = "Failed to load match.";
        infoEl.textContent = "";
        scoreEl.textContent = "Could not retrieve match details.";
        teamsEl.textContent = "";
    }
}

document.addEventListener("DOMContentLoaded", loadMatchPage);
