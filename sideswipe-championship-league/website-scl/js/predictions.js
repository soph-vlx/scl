let currentUser = null;
let authToken = localStorage.getItem('authToken');
let isLoggedIn = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    loadUpcomingMatches();
    loadPredictionsLeaderboard();
});

function checkAuthState() {
    authToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('authUser');
    
    if (authToken && userData) {
        try {
            currentUser = JSON.parse(userData);
            if (currentUser.username) {
                isLoggedIn = true;
                showLoggedInState();
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
            isLoggedIn = false;
        }
    }
    
    if (!isLoggedIn) {
        showLoggedOutState();
    }
}

function showLoggedInState() {
    document.getElementById('user-welcome-section').style.display = 'flex';
    document.getElementById('username-display').textContent = `Welcome, ${currentUser.username}!`;
    document.getElementById('login-prompt-upcoming').style.display = 'none';
    document.getElementById('my-predictions-tab').style.display = 'inline-block';
    loadMyPredictions();
}

function showLoggedOutState() {
    document.getElementById('user-welcome-section').style.display = 'none';
    document.getElementById('login-prompt-upcoming').style.display = 'block';
    document.getElementById('my-predictions-tab').style.display = 'none';
}

function logout() {
    authToken = null;
    currentUser = null;
    isLoggedIn = false;
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    location.reload();
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    if (tabName === 'upcoming') loadUpcomingMatches();
    if (tabName === 'my-predictions' && isLoggedIn) loadMyPredictions();
    if (tabName === 'leaderboard') loadPredictionsLeaderboard();
}

async function loadUpcomingMatches() {
    try {
        const response = await fetch('/api/predictions/upcoming-matches');
        const matches = await response.json();
        
        const container = document.getElementById('upcoming-matches');
        
        if (matches.length === 0) {
            container.innerHTML = '<p>No upcoming matches available for predictions.</p>';
            return;
        }
        
        if (isLoggedIn) {
            container.innerHTML = matches.map(match => `
                <div class="prediction-card">
                    <h3>${match.homeTeam.name} vs ${match.awayTeam.name}</h3>
                    <p>Matchday ${match.matchday} • ${match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : 'TBD'}</p>
                    <div class="prediction-form">
                        <label>Predict Winner:</label>
                        <select id="winner-${match.id}">
                            <option value="">Select winner</option>
                            <option value="home">${match.homeTeam.name}</option>
                            <option value="away">${match.awayTeam.name}</option>
                            <option value="draw">Draw</option>
                        </select>
                        
                        <label>Predict Score:</label>
                        <div class="score-inputs">
                            <input type="number" id="score-home-${match.id}" min="0" placeholder="0" />
                            -
                            <input type="number" id="score-away-${match.id}" min="0" placeholder="0" />
                        </div>
                        
                        <button onclick="submitPrediction(${match.id})">Submit Prediction</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = matches.map(match => `
                <div class="match-preview-card">
                    <h3>${match.homeTeam.name} vs ${match.awayTeam.name}</h3>
                    <p class="match-info">
                        <i class="fas fa-calendar"></i> Matchday ${match.matchday} • 
                        ${match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString() : 'Date TBD'}
                    </p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        document.getElementById('upcoming-matches').innerHTML = '<p>Failed to load upcoming matches.</p>';
    }
}

async function submitPrediction(matchId) {
    if (!isLoggedIn) {
        window.location.href = '/login';
        return;
    }
    
    const predictedWinner = document.getElementById(`winner-${matchId}`).value;
    const predictedScoreHome = parseInt(document.getElementById(`score-home-${matchId}`).value) || null;
    const predictedScoreAway = parseInt(document.getElementById(`score-away-${matchId}`).value) || null;
    
    try {
        const response = await fetch('/api/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                matchId,
                predictedWinner,
                predictedScoreHome,
                predictedScoreAway
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to submit prediction');
            return;
        }
        
        alert('Prediction submitted successfully!');
        loadMyPredictions();
    } catch (error) {
        console.error('Error submitting prediction:', error);
        alert('Failed to submit prediction');
    }
}

async function loadMyPredictions() {
    if (!currentUser || !isLoggedIn || !authToken) {
        document.getElementById('my-predictions').innerHTML = `
            <div class="login-prompt">
                <h3><i class="fas fa-lock"></i> Login Required</h3>
                <p>You need to be logged in to view your predictions.</p>
                <a href="/login" class="login-btn"><i class="fas fa-sign-in-alt"></i> Login or Create Account</a>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`/api/predictions/user/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            document.getElementById('my-predictions').innerHTML = '<p>Failed to load predictions. Please try again.</p>';
            return;
        }
        
        const predictions = await response.json();
        
        const container = document.getElementById('my-predictions');
        
        if (predictions.length === 0) {
            container.innerHTML = '<p>You have not made any predictions yet.</p>';
            return;
        }
        
        container.innerHTML = predictions.map(pred => `
            <div class="prediction-card">
                <h3>${pred.match.homeTeam.name} vs ${pred.match.awayTeam.name}</h3>
                <p>Your prediction: ${pred.predictedWinner || 'N/A'} ${pred.predictedScoreHome !== null ? `(${pred.predictedScoreHome}-${pred.predictedScoreAway})` : ''}</p>
                ${pred.match.status === 'COMPLETED' ? 
                    `<p><strong>Result:</strong> ${pred.match.scoreHome}-${pred.match.scoreAway} • Points earned: ${pred.points}</p>` : 
                    `<p>Match not completed yet</p>`}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading predictions:', error);
    }
}

async function loadPredictionsLeaderboard() {
    try {
        const response = await fetch('/api/predictions/leaderboard');
        const leaderboard = await response.json();
        
        const tbody = document.getElementById('predictions-leaderboard-body');
        
        if (leaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No predictions yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = leaderboard.map((user, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.totalPoints}</td>
                <td>${user.totalPredictions}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}
