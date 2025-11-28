let adminToken = localStorage.getItem('authToken');
let adminUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        const userData = JSON.parse(localStorage.getItem('authUser') || '{}');
        if (userData.role === 'ADMIN' || userData.role === 'STAFF') {
            adminUser = userData;
            showAdminContent();
        } else {
            showLoginForm();
        }
    }
});

async function adminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            alert(data.error || 'Login failed');
            return;
        }
        
        if (data.role !== 'ADMIN' && data.role !== 'STAFF') {
            alert('Access denied. Admin or Staff privileges required.');
            return;
        }
        
        adminToken = data.token;
        adminUser = data;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify(data));
        
        showAdminContent();
    } catch (error) {
        console.error('Admin login error:', error);
        alert('Login failed. Please try again.');
    }
}

function showLoginForm() {
    document.getElementById('admin-auth').style.display = 'block';
    document.getElementById('admin-content').style.display = 'none';
}

function adminLogout() {
    adminToken = null;
    adminUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    location.reload();
}

function showAdminContent() {
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    document.getElementById('admin-username-display').textContent = `${adminUser.role}: ${adminUser.username}`;
    
    loadMatches();
    loadWebhooks();
    loadTeamsForFilters();
}

function showAdminTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`admin-tab-${tabName}`).style.display = 'block';
    
    if (tabName === 'matches') loadMatches();
    if (tabName === 'teams') loadTeams();
    if (tabName === 'players') loadPlayers();
    if (tabName === 'users') loadAdminUsers();
    if (tabName === 'submissions') loadAdminSubmissions();
    if (tabName === 'webhooks') loadWebhooks();
    if (tabName === 'toornament') checkCurrentTournament();
    if (tabName === 'ocr-review') {
        loadOcrTeams();
        loadPendingOcrReviews();
        loadAllSubmissions();
    }
}

let allMatches = [];

async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        allMatches = await response.json();
        
        // Populate matchday filter dropdown
        const matchdays = [...new Set(allMatches.map(m => m.matchday))].sort((a, b) => a - b);
        const matchdayFilter = document.getElementById('matchday-filter');
        matchdayFilter.innerHTML = '<option value="">All Matchdays</option>' + 
            matchdays.map(md => `<option value="${md}">Matchday ${md}</option>`).join('');
        
        filterMatches();
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

function filterMatches() {
    const matchdayFilter = document.getElementById('matchday-filter').value;
    const container = document.getElementById('matches-list');
    
    let filteredMatches = allMatches;
    
    // Filter by matchday
    if (matchdayFilter) {
        filteredMatches = filteredMatches.filter(m => m.matchday == matchdayFilter);
    }
    
    if (filteredMatches.length === 0) {
        container.innerHTML = '<p>No matches found.</p>';
        return;
    }
    
    container.innerHTML = filteredMatches.map(match => `
        <div class="admin-card">
            <h3>${match.homeTeam} vs ${match.awayTeam}</h3>
            <p>Matchday ${match.matchday} • Status: ${match.status}</p>
            <p>Current Score: ${match.scoreHome || '-'} - ${match.scoreAway || '-'}</p>
            <div class="score-update">
                <input type="number" id="home-score-${match.id}" placeholder="Home Score" value="${match.scoreHome || ''}" min="0" />
                <input type="number" id="away-score-${match.id}" placeholder="Away Score" value="${match.scoreAway || ''}" min="0" />
                <button onclick="updateMatchScore(${match.id})">Update Score</button>
            </div>
        </div>
    `).join('');
}

async function updateMatchScore(matchId) {
    const scoreHome = document.getElementById(`home-score-${matchId}`).value;
    const scoreAway = document.getElementById(`away-score-${matchId}`).value;
    
    if (!scoreHome || !scoreAway) {
        alert('Please enter both scores');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/matches/${matchId}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ scoreHome, scoreAway })
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to update score');
            return;
        }
        
        alert('Score updated successfully! Discord notification sent.');
        await loadMatches();
    } catch (error) {
        console.error('Error updating score:', error);
        alert('Failed to update score');
    }
}

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        const container = document.getElementById('teams-list');
        
        if (teams.length === 0) {
            container.innerHTML = '<p>No teams found.</p>';
            return;
        }
        
        container.innerHTML = teams.map(team => `
            <div class="admin-card">
                <h3>${team.name}</h3>
                <p>Short Name: ${team.shortName || 'N/A'} • Tag: ${team.tag || 'N/A'}</p>
                <p>Region: ${team.region || 'N/A'}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

let allPlayers = [];
let allTeams = [];

async function loadPlayers() {
    try {
        const [playersResponse, teamsResponse] = await Promise.all([
            fetch('/api/players'),
            fetch('/api/teams')
        ]);
        
        allPlayers = await playersResponse.json();
        allTeams = await teamsResponse.json();
        
        // Populate team filter dropdown
        const teamFilter = document.getElementById('team-filter');
        teamFilter.innerHTML = '<option value="">All Teams</option>' + 
            allTeams.map(team => `<option value="${team.name}">${team.name}</option>`).join('');
        
        filterPlayers();
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

function filterPlayers() {
    const teamFilter = document.getElementById('team-filter').value;
    const searchQuery = document.getElementById('player-search').value.toLowerCase();
    const container = document.getElementById('players-list');
    
    let filteredPlayers = allPlayers;
    
    // Filter by team name
    if (teamFilter) {
        filteredPlayers = filteredPlayers.filter(p => p.team.name === teamFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
        filteredPlayers = filteredPlayers.filter(p => 
            p.displayName.toLowerCase().includes(searchQuery) ||
            p.team.name.toLowerCase().includes(searchQuery)
        );
    }
    
    if (filteredPlayers.length === 0) {
        container.innerHTML = '<p>No players found.</p>';
        return;
    }
    
    container.innerHTML = filteredPlayers.map(player => `
        <div class="admin-card">
            <h3>${player.displayName}</h3>
            <p>Team: ${player.team.name}</p>
            <p>Stats: Goals: ${player.goals}, Assists: ${player.assists}, Saves: ${player.saves}</p>
            <div class="player-stats-update">
                <input type="number" id="goals-${player.id}" placeholder="Goals" value="${player.goals}" min="0" />
                <input type="number" id="assists-${player.id}" placeholder="Assists" value="${player.assists}" min="0" />
                <input type="number" id="saves-${player.id}" placeholder="Saves" value="${player.saves}" min="0" />
                <button onclick="updatePlayerStats(${player.id})">Update Stats</button>
            </div>
        </div>
    `).join('');
}

async function updatePlayerStats(playerId) {
    const goals = parseInt(document.getElementById(`goals-${playerId}`).value) || 0;
    const assists = parseInt(document.getElementById(`assists-${playerId}`).value) || 0;
    const saves = parseInt(document.getElementById(`saves-${playerId}`).value) || 0;
    
    try {
        const response = await fetch(`/api/admin/players/${playerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ goals, assists, saves })
        });
        
        if (!response.ok) {
            alert('Failed to update player stats');
            return;
        }
        
        alert('Player stats updated successfully!');
        await loadPlayers();
    } catch (error) {
        console.error('Error updating player stats:', error);
        alert('Failed to update player stats');
    }
}

async function loadWebhooks() {
    try {
        const response = await fetch('/api/admin/webhooks', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const webhooks = await response.json();
        
        const typeMap = {
            'MATCH_UPDATES': 'match',
            'STANDINGS': 'standings',
            'MATCHDAY_SCHEDULE': 'schedule'
        };
        
        webhooks.forEach(webhook => {
            const prefix = typeMap[webhook.type];
            if (prefix) {
                document.getElementById(`webhook-${prefix}-name`).value = webhook.name || '';
                document.getElementById(`webhook-${prefix}-url`).value = webhook.webhookUrl || '';
                document.getElementById(`webhook-${prefix}-enabled`).checked = webhook.enabled;
            }
        });
    } catch (error) {
        console.error('Error loading webhooks:', error);
    }
}

async function saveWebhookByType(type) {
    const typeMap = {
        'MATCH_UPDATES': 'match',
        'STANDINGS': 'standings',
        'MATCHDAY_SCHEDULE': 'schedule'
    };
    
    const prefix = typeMap[type];
    const name = document.getElementById(`webhook-${prefix}-name`).value;
    const webhookUrl = document.getElementById(`webhook-${prefix}-url`).value;
    const enabled = document.getElementById(`webhook-${prefix}-enabled`).checked;
    
    if (!name || !webhookUrl) {
        alert('Please fill in webhook name and URL');
        return;
    }
    
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        alert('Please enter a valid Discord webhook URL');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/webhooks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, type, webhookUrl, enabled })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to save webhook'}`);
            return;
        }
        
        alert('✅ Webhook saved successfully!');
        await loadWebhooks();
    } catch (error) {
        console.error('Error saving webhook:', error);
        alert('Failed to save webhook');
    }
}

function showTeamForm() {
    alert('Team creation form coming soon!');
}

function showPlayerForm() {
    alert('Player creation form coming soon!');
}

async function sendStandingsWebhook() {
    const matchday = document.getElementById('webhook-standings-matchday').value;
    
    if (!confirm('Send current standings table to Discord?')) {
        return;
    }
    
    try {
        const body = matchday ? { matchday: parseInt(matchday) } : {};
        
        const response = await fetch('/api/webhooks/standings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to send standings webhook'}`);
            return;
        }
        
        alert('✅ Standings successfully sent to Discord!');
        document.getElementById('webhook-standings-matchday').value = '';
    } catch (error) {
        console.error('Error sending standings webhook:', error);
        alert('Failed to send standings webhook');
    }
}

async function sendMatchdayWebhook() {
    const matchday = document.getElementById('webhook-matchday').value;
    
    if (!matchday) {
        alert('Please enter a matchday number');
        return;
    }
    
    if (!confirm(`Send Matchday ${matchday} schedule to Discord?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/webhooks/matchday-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ matchday: parseInt(matchday) })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to send matchday schedule'}`);
            return;
        }
        
        alert(`✅ Matchday ${matchday} schedule successfully sent to Discord!`);
        document.getElementById('webhook-matchday').value = '';
    } catch (error) {
        console.error('Error sending matchday schedule webhook:', error);
        alert('Failed to send matchday schedule');
    }
}

async function loadToornamentTournaments() {
    const container = document.getElementById('toornament-list');
    container.innerHTML = '<p>Loading tournaments...</p>';
    
    try {
        const response = await fetch('/api/toornament/tournaments', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">Error: ${error.error || 'Failed to load tournaments'}</p>`;
            return;
        }
        
        const tournaments = await response.json();
        
        if (tournaments.length === 0) {
            container.innerHTML = '<p>No tournaments found in your Toornament account.</p>';
            return;
        }
        
        container.innerHTML = tournaments.map(t => `
            <div class="tournament-card">
                <h4>${t.name}</h4>
                <p>${t.full_name || ''}</p>
                <p class="tournament-meta">
                    Status: ${t.status || 'Unknown'} | 
                    ${t.scheduled_date_start ? `Starts: ${t.scheduled_date_start}` : ''}
                </p>
                <button onclick="selectToornament('${t.id}', '${t.name.replace(/'/g, "\\'")}')">
                    Select This Tournament
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading Toornament tournaments:', error);
        container.innerHTML = '<p class="error">Failed to load tournaments. Check your API credentials.</p>';
    }
}

async function selectToornament(tournamentId, tournamentName) {
    try {
        const response = await fetch('/api/toornament/set-tournament', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ tournamentId })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to select tournament'}`);
            return;
        }
        
        document.getElementById('current-tournament-display').innerHTML = `
            <div class="selected-tournament">
                <i class="fas fa-trophy"></i>
                <strong>${result.tournament.name}</strong>
                <span>${result.tournament.fullName || ''}</span>
            </div>
        `;
        
        document.getElementById('toornament-data-section').style.display = 'block';
        alert(`Tournament "${tournamentName}" selected successfully!`);
    } catch (error) {
        console.error('Error selecting tournament:', error);
        alert('Failed to select tournament');
    }
}

async function checkCurrentTournament() {
    try {
        const response = await fetch('/api/toornament/current-tournament');
        const data = await response.json();
        
        if (data.tournament) {
            document.getElementById('current-tournament-display').innerHTML = `
                <div class="selected-tournament">
                    <i class="fas fa-trophy"></i>
                    <strong>${data.tournament.name}</strong>
                    <span>${data.tournament.fullName || ''}</span>
                </div>
            `;
            document.getElementById('toornament-data-section').style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking current tournament:', error);
    }
}

async function viewToornamentStages() {
    const container = document.getElementById('toornament-data-display');
    container.innerHTML = '<p>Loading stages...</p>';
    
    try {
        const response = await fetch('/api/toornament/stages');
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">${error.error}</p>`;
            return;
        }
        
        const stages = await response.json();
        
        container.innerHTML = `
            <h4>Tournament Stages</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Number</th>
                    </tr>
                </thead>
                <tbody>
                    ${stages.map(s => `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.type}</td>
                            <td>${s.number}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading stages:', error);
        container.innerHTML = '<p class="error">Failed to load stages</p>';
    }
}

async function viewToornamentStandings() {
    const container = document.getElementById('toornament-data-display');
    container.innerHTML = '<p>Loading standings...</p>';
    
    try {
        const response = await fetch('/api/toornament/standings');
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">${error.error}</p>`;
            return;
        }
        
        const standings = await response.json();
        
        container.innerHTML = `
            <h4>Tournament Standings</h4>
            <table class="data-table standings-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>P</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                        <th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${standings.map(s => `
                        <tr>
                            <td>${s.position}</td>
                            <td>${s.teamName}</td>
                            <td>${s.played}</td>
                            <td>${s.wins}</td>
                            <td>${s.draws}</td>
                            <td>${s.losses}</td>
                            <td>${s.goalsFor}</td>
                            <td>${s.goalsAgainst}</td>
                            <td>${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}</td>
                            <td><strong>${s.points}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading standings:', error);
        container.innerHTML = '<p class="error">Failed to load standings</p>';
    }
}

async function viewToornamentMatches() {
    const container = document.getElementById('toornament-data-display');
    container.innerHTML = '<p>Loading matches...</p>';
    
    try {
        const response = await fetch('/api/toornament/matches');
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">${error.error}</p>`;
            return;
        }
        
        const matches = await response.json();
        
        container.innerHTML = `
            <h4>Tournament Matches (${matches.length} total)</h4>
            <div class="matches-grid">
                ${matches.map(m => `
                    <div class="match-card ${m.status}">
                        <div class="match-teams">
                            <span class="team ${m.opponents[0]?.result === 'win' ? 'winner' : ''}">${m.opponents[0]?.teamName || 'TBD'}</span>
                            <span class="vs">vs</span>
                            <span class="team ${m.opponents[1]?.result === 'win' ? 'winner' : ''}">${m.opponents[1]?.teamName || 'TBD'}</span>
                        </div>
                        <div class="match-score">
                            ${m.opponents[0]?.score ?? '-'} - ${m.opponents[1]?.score ?? '-'}
                        </div>
                        <div class="match-meta">
                            Status: ${m.status}
                            ${m.scheduledAt ? ` | ${new Date(m.scheduledAt).toLocaleDateString()}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading matches:', error);
        container.innerHTML = '<p class="error">Failed to load matches</p>';
    }
}

async function viewToornamentParticipants() {
    const container = document.getElementById('toornament-data-display');
    container.innerHTML = '<p>Loading participants...</p>';
    
    try {
        const response = await fetch('/api/toornament/participants');
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">${error.error}</p>`;
            return;
        }
        
        const participants = await response.json();
        
        container.innerHTML = `
            <h4>Tournament Participants (${participants.length} total)</h4>
            <div class="participants-grid">
                ${participants.map(p => `
                    <div class="participant-card">
                        <strong>${p.name}</strong>
                        ${p.lineup ? `<p class="lineup">Players: ${p.lineup.map(l => l.name).join(', ')}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading participants:', error);
        container.innerHTML = '<p class="error">Failed to load participants</p>';
    }
}

async function sendStandingsImageWebhook() {
    const matchday = document.getElementById('webhook-image-matchday').value;
    
    if (!confirm('Send standings image to Discord?')) {
        return;
    }
    
    try {
        const body = {};
        if (matchday) body.matchday = parseInt(matchday);
        
        const response = await fetch('/api/webhooks/standings-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to send standings image'}`);
            return;
        }
        
        alert('Standings image sent to Discord!');
        document.getElementById('webhook-image-matchday').value = '';
    } catch (error) {
        console.error('Error sending standings image webhook:', error);
        alert('Failed to send standings image');
    }
}

async function sendLeaderboardImageWebhook() {
    const limit = document.getElementById('webhook-leaderboard-limit').value || 10;
    
    if (!confirm(`Send top ${limit} player leaderboard image to Discord?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/webhooks/leaderboard-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ limit: parseInt(limit) })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to send leaderboard image'}`);
            return;
        }
        
        alert('Leaderboard image sent to Discord!');
    } catch (error) {
        console.error('Error sending leaderboard image webhook:', error);
        alert('Failed to send leaderboard image');
    }
}

async function loadOcrTeams() {
    try {
        const response = await fetch('/api/teams');
        if (response.ok) {
            const teams = await response.json();
            
            const ocrTeamSelect = document.getElementById('ocr-team-select');
            const ocrFilterTeam = document.getElementById('ocr-filter-team');
            
            if (ocrTeamSelect) {
                ocrTeamSelect.innerHTML = '<option value="">Select Team</option>' +
                    teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
            
            if (ocrFilterTeam) {
                ocrFilterTeam.innerHTML = '<option value="">All Teams</option>' +
                    teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading teams for OCR:', error);
    }
}

async function processOcrMatchday() {
    const teamId = document.getElementById('ocr-team-select').value;
    const matchday = document.getElementById('ocr-matchday').value;
    
    if (!teamId || !matchday) {
        alert('Please select a team and enter a matchday');
        return;
    }
    
    try {
        const response = await fetch('/api/submit/admin/ocr/process-matchday', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                teamId: parseInt(teamId),
                matchday: parseInt(matchday)
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'OCR processing failed'}`);
            return;
        }
        
        let message = `OCR processed ${result.gamesProcessed} game(s)\n\n`;
        message += `Aggregated Result:\n`;
        message += `Home Team: ${result.aggregatedResult.homeTeam || 'Unknown'}\n`;
        message += `Away Team: ${result.aggregatedResult.awayTeam || 'Unknown'}\n`;
        message += `Series: ${result.aggregatedResult.homeWins} - ${result.aggregatedResult.awayWins}\n`;
        message += `Winner: ${result.aggregatedResult.winner}\n`;
        message += result.aggregatedResult.needsReview ? '\n⚠️ Needs manual review' : '\n✅ Ready for approval';
        
        alert(message);
        loadPendingOcrReviews();
    } catch (error) {
        console.error('Error processing OCR:', error);
        alert('Failed to process OCR');
    }
}

async function loadPendingOcrReviews() {
    try {
        const response = await fetch('/api/submit/admin/pending-review', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch pending reviews');
        }
        
        const pendingReviews = await response.json();
        
        const container = document.getElementById('ocr-pending-list');
        
        if (pendingReviews.length === 0) {
            container.innerHTML = '<p>No pending reviews</p>';
            return;
        }
        
        container.innerHTML = pendingReviews.map(review => {
            const gamesHtml = review.games.map(g => {
                const ocrData = g.ocrResult;
                return `
                    <div class="ocr-game-result">
                        <strong>Game ${g.gameNumber}:</strong>
                        ${ocrData && ocrData.parsedData ? 
                            `${ocrData.parsedData.homeScore || '?'} - ${ocrData.parsedData.awayScore || '?'} 
                            (Confidence: ${Math.round(ocrData.confidence || 0)}%)` : 
                            'No OCR data'}
                    </div>
                `;
            }).join('');
            
            return `
                <div class="ocr-review-card">
                    <div class="ocr-review-header">
                        <strong>${review.team?.name || 'Unknown Team'}</strong> vs 
                        <strong>${review.opponentTeam?.name || 'Unknown'}</strong>
                        <span class="matchday-badge">Matchday ${review.matchday}</span>
                    </div>
                    <div class="ocr-games">
                        ${gamesHtml}
                    </div>
                    <div class="ocr-review-actions">
                        <input type="number" id="home-score-${review.teamId}-${review.matchday}" placeholder="Home Score" min="0" max="5" style="width: 100px;" />
                        <input type="number" id="away-score-${review.teamId}-${review.matchday}" placeholder="Away Score" min="0" max="5" style="width: 100px;" />
                        <button onclick="approveOcrResult(${review.teamId}, ${review.matchday}, ${review.opponentTeam?.id || 'null'})" class="approve-btn">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button onclick="rejectOcrResult(${review.teamId}, ${review.matchday})" class="reject-btn">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading pending reviews:', error);
        document.getElementById('ocr-pending-list').innerHTML = 
            '<p class="error">Failed to load pending reviews</p>';
    }
}

async function approveOcrResult(teamId, matchday, opponentTeamId) {
    const homeScore = document.getElementById(`home-score-${teamId}-${matchday}`).value;
    const awayScore = document.getElementById(`away-score-${teamId}-${matchday}`).value;
    
    if (homeScore === '' || awayScore === '') {
        alert('Please enter both home and away scores');
        return;
    }
    
    if (!confirm(`Approve match result: ${homeScore} - ${awayScore}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/submit/admin/ocr/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                teamId,
                matchday,
                homeScore: parseInt(homeScore),
                awayScore: parseInt(awayScore),
                opponentTeamId
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to approve result'}`);
            return;
        }
        
        alert(`Match result approved: ${result.match.homeTeam} ${result.match.homeScore} - ${result.match.awayScore} ${result.match.awayTeam}`);
        loadPendingOcrReviews();
        loadAllSubmissions();
    } catch (error) {
        console.error('Error approving OCR result:', error);
        alert('Failed to approve result');
    }
}

async function rejectOcrResult(teamId, matchday) {
    if (!confirm('Reject this submission? This will mark it as processed without updating match scores.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/submit/admin/submissions/reject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ teamId, matchday })
        });
        
        if (response.ok) {
            alert('Submission rejected');
            loadPendingOcrReviews();
            loadAllSubmissions();
        } else {
            const result = await response.json();
            alert(`Error: ${result.error || 'Failed to reject'}`);
        }
    } catch (error) {
        console.error('Error rejecting submission:', error);
        alert('Failed to reject submission');
    }
}

async function loadAllSubmissions() {
    const teamId = document.getElementById('ocr-filter-team').value;
    const processed = document.getElementById('ocr-filter-processed').value;
    
    let url = '/api/submit/admin/submissions?';
    if (teamId) url += `teamId=${teamId}&`;
    if (processed) url += `processed=${processed}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch submissions');
        }
        
        const submissions = await response.json();
        
        const container = document.getElementById('ocr-submissions-list');
        
        if (submissions.length === 0) {
            container.innerHTML = '<p>No submissions found</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Team</th>
                        <th>Matchday</th>
                        <th>Game</th>
                        <th>Submitter</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map(sub => `
                        <tr>
                            <td>${sub.id}</td>
                            <td>${sub.team?.name || 'Unknown'}</td>
                            <td>${sub.matchday}</td>
                            <td>Game ${sub.gameNumber}</td>
                            <td>${sub.submitter?.username || 'Unknown'}</td>
                            <td>
                                <span class="status-badge ${sub.processed ? 'status-processed' : 'status-pending'}">
                                    ${sub.processed ? 'Processed' : 'Pending'}
                                </span>
                            </td>
                            <td>
                                <button onclick="viewSubmissionImage(${sub.id})" class="view-btn">
                                    <i class="fas fa-image"></i>
                                </button>
                                ${!sub.ocrResult ? `
                                    <button onclick="processOcrSingle(${sub.id})" class="process-btn">
                                        <i class="fas fa-cog"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading submissions:', error);
        document.getElementById('ocr-submissions-list').innerHTML = 
            '<p class="error">Failed to load submissions</p>';
    }
}

async function processOcrSingle(submissionId) {
    try {
        const response = await fetch(`/api/submit/admin/ocr/process/${submissionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error: ${result.error || 'OCR processing failed'}`);
            return;
        }
        
        let message = 'OCR Result:\n';
        if (result.ocrResult.parsedData) {
            const data = result.ocrResult.parsedData;
            message += `Home: ${data.homeTeam || 'Unknown'} - ${data.homeScore}\n`;
            message += `Away: ${data.awayTeam || 'Unknown'} - ${data.awayScore}\n`;
            message += `Confidence: ${Math.round(result.ocrResult.confidence || 0)}%`;
        } else {
            message += 'Could not parse match data';
        }
        
        alert(message);
        loadAllSubmissions();
        loadPendingOcrReviews();
    } catch (error) {
        console.error('Error processing OCR:', error);
        alert('Failed to process OCR');
    }
}

function viewSubmissionImage(submissionId) {
    alert(`Image viewer for submission ${submissionId} - This would open the submitted screenshot in a modal.`);
}

async function loadTeamsForFilters() {
    try {
        const response = await fetch('/api/teams');
        if (response.ok) {
            const teams = await response.json();
            
            const userTeamFilter = document.getElementById('user-team-filter');
            const submissionsTeamFilter = document.getElementById('submissions-team-filter');
            
            if (userTeamFilter) {
                userTeamFilter.innerHTML = '<option value="">All Teams</option>' +
                    teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
            
            if (submissionsTeamFilter) {
                submissionsTeamFilter.innerHTML = '<option value="">All Teams</option>' +
                    teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading teams for filters:', error);
    }
}

async function loadAdminUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    container.innerHTML = '<p>Loading users...</p>';
    
    const roleFilter = document.getElementById('user-role-filter')?.value || '';
    const teamFilter = document.getElementById('user-team-filter')?.value || '';
    const search = document.getElementById('user-search')?.value || '';
    
    let url = '/api/admin/users?';
    if (roleFilter) url += `role=${roleFilter}&`;
    if (teamFilter) url += `teamId=${teamFilter}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">Error: ${error.error || 'Failed to load users'}</p>`;
            return;
        }
        
        const users = await response.json();
        
        if (users.length === 0) {
            container.innerHTML = '<p>No users found</p>';
            return;
        }
        
        container.innerHTML = users.map(user => `
            <div class="admin-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3>${user.username}</h3>
                        <p>Role: <span class="status-badge ${user.role === 'ADMIN' ? 'status-processed' : user.role === 'STAFF' ? 'status-pending' : ''}">${user.role}</span></p>
                        <p>Team: ${user.team?.name || 'No team'}</p>
                        ${user.email ? `<p>Email: ${user.email}</p>` : ''}
                    </div>
                    <div class="user-actions">
                        <select id="role-select-${user.id}" onchange="updateUserRole(${user.id}, this.value)">
                            <option value="VIEWER" ${user.role === 'VIEWER' ? 'selected' : ''}>Viewer</option>
                            <option value="PLAYER" ${user.role === 'PLAYER' ? 'selected' : ''}>Player</option>
                            <option value="LEADER" ${user.role === 'LEADER' ? 'selected' : ''}>Leader</option>
                            <option value="STAFF" ${user.role === 'STAFF' ? 'selected' : ''}>Staff</option>
                            <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<p class="error">Failed to load users</p>';
    }
}

async function updateUserRole(userId, newRole) {
    if (!confirm(`Change user role to ${newRole}?`)) {
        loadAdminUsers();
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to update user'}`);
            loadAdminUsers();
            return;
        }
        
        alert('User role updated successfully!');
        loadAdminUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Failed to update user');
        loadAdminUsers();
    }
}

async function loadAdminSubmissions() {
    const container = document.getElementById('submissions-list');
    if (!container) return;
    
    container.innerHTML = '<p>Loading submissions...</p>';
    
    const teamFilter = document.getElementById('submissions-team-filter')?.value || '';
    const statusFilter = document.getElementById('submissions-status-filter')?.value || '';
    
    let url = '/api/submit/admin/submissions?';
    if (teamFilter) url += `teamId=${teamFilter}&`;
    if (statusFilter) url += `processed=${statusFilter}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            container.innerHTML = `<p class="error">Error: ${error.error || 'Failed to load submissions'}</p>`;
            return;
        }
        
        const submissions = await response.json();
        
        if (submissions.length === 0) {
            container.innerHTML = '<p>No submissions found</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Team</th>
                        <th>Matchday</th>
                        <th>Game</th>
                        <th>Submitter</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map(sub => `
                        <tr>
                            <td>${sub.id}</td>
                            <td>${sub.team?.name || 'Unknown'}</td>
                            <td>${sub.matchday}</td>
                            <td>Game ${sub.gameNumber}</td>
                            <td>${sub.submitter?.username || 'Unknown'}</td>
                            <td>
                                <span class="status-badge ${sub.processed ? 'status-processed' : 'status-pending'}">
                                    ${sub.processed ? 'Processed' : 'Pending'}
                                </span>
                            </td>
                            <td>
                                <button onclick="viewSubmissionImageModal(${sub.id})" class="view-btn" title="View Image">
                                    <i class="fas fa-image"></i>
                                </button>
                                ${!sub.processed ? `
                                    <button onclick="markSubmissionProcessed(${sub.id})" class="process-btn" title="Mark Processed">
                                        <i class="fas fa-check"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading submissions:', error);
        container.innerHTML = '<p class="error">Failed to load submissions</p>';
    }
}

async function markSubmissionProcessed(submissionId) {
    if (!confirm('Mark this submission as processed?')) return;
    
    try {
        const response = await fetch(`/api/submit/admin/submissions/${submissionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ processed: true })
        });
        
        if (!response.ok) {
            alert('Failed to update submission');
            return;
        }
        
        alert('Submission marked as processed');
        loadAdminSubmissions();
    } catch (error) {
        console.error('Error marking submission processed:', error);
        alert('Failed to update submission');
    }
}

function viewSubmissionImageModal(submissionId) {
    alert(`Image viewer for submission ${submissionId} - This would open the submitted screenshot in a modal.`);
}
