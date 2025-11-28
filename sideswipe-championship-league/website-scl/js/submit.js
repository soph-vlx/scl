let authToken = localStorage.getItem('authToken');
let currentUser = null;
let uploadedGames = {};

document.addEventListener('DOMContentLoaded', async () => {
  await loadTeams();
  
  if (authToken) {
    try {
      const response = await fetch('/api/submit/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        currentUser = await response.json();
        if (currentUser.canSubmit) {
          showDashboard();
        } else {
          showAccessDenied();
        }
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        authToken = null;
        showLoginPrompt();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      showLoginPrompt();
    }
  } else {
    showLoginPrompt();
  }
});

async function loadTeams() {
  try {
    const response = await fetch('/api/teams');
    const teams = await response.json();
    
    const opponentSelect = document.getElementById('submit-opponent');
    
    teams.forEach(team => {
      opponentSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

function showLoginPrompt() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('access-denied-section').classList.add('hidden');
}

function showAccessDenied() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('access-denied-section').classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  authToken = null;
  currentUser = null;
  uploadedGames = {};
  window.location.href = '/register';
}

function showDashboard() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('access-denied-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  
  document.getElementById('user-display').textContent = `Welcome, ${currentUser.username}`;
  document.getElementById('role-display').textContent = currentUser.role;
  
  if (currentUser.team) {
    document.getElementById('team-display').textContent = currentUser.team.name;
    
    const logoContainer = document.getElementById('team-logo-container');
    if (currentUser.team.logoUrl) {
      logoContainer.innerHTML = `<img src="${currentUser.team.logoUrl}" alt="${currentUser.team.name}" class="team-logo">`;
    } else {
      const initials = (currentUser.team.shortName || currentUser.team.name).substring(0, 2).toUpperCase();
      logoContainer.innerHTML = `<div class="team-logo-placeholder">${initials}</div>`;
    }
  }
  
  loadMatches();
  loadSubmissions();
  loadRoster();
}

function showTab(tab) {
  const tabs = ['submit', 'submissions', 'roster'];
  const tabBtns = document.querySelectorAll('.submit-tabs .tab-btn');
  
  tabs.forEach(t => {
    const el = document.getElementById(`${t}-tab`);
    if (el) el.classList.add('hidden');
  });
  
  tabBtns.forEach(btn => btn.classList.remove('active'));
  
  const targetTab = document.getElementById(`${tab}-tab`);
  if (targetTab) targetTab.classList.remove('hidden');
  
  const activeBtn = Array.from(tabBtns).find(btn => 
    btn.textContent.toLowerCase().includes(tab) || 
    (tab === 'submit' && btn.textContent.includes('Submit'))
  );
  if (activeBtn) activeBtn.classList.add('active');
}

async function loadMatches() {
  try {
    const response = await fetch('/api/submit/my-team/matches', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const matches = await response.json();
    const select = document.getElementById('submit-matchday');
    
    const matchdays = [...new Set(matches.map(m => m.matchday))].sort((a, b) => a - b);
    
    matchdays.forEach(md => {
      select.innerHTML += `<option value="${md}">Matchday ${md}</option>`;
    });
  } catch (error) {
    console.error('Error loading matches:', error);
  }
}

function triggerUpload(gameNum) {
  document.getElementById(`game-${gameNum}-file`).click();
}

function handleUpload(gameNum, input) {
  const file = input.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('Image size must be less than 10MB');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    uploadedGames[gameNum] = base64;
    
    const preview = document.getElementById(`preview-${gameNum}`);
    preview.innerHTML = `<span class="game-label">Game ${gameNum}</span><img src="${base64}" alt="Game ${gameNum}">`;
    preview.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

async function submitGames() {
  const matchday = document.getElementById('submit-matchday').value;
  const opponentTeamId = document.getElementById('submit-opponent').value;
  
  if (!matchday) {
    alert('Please select a matchday');
    return;
  }
  
  const games = [];
  for (let i = 1; i <= 5; i++) {
    if (uploadedGames[i]) {
      games.push({
        gameNumber: i,
        imageData: uploadedGames[i]
      });
    }
  }
  
  if (games.length === 0) {
    alert('Please upload at least one game screenshot');
    return;
  }
  
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  
  try {
    const response = await fetch('/api/submit/screenshots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ matchday, opponentTeamId, games })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      alert(data.error || 'Submission failed');
      return;
    }
    
    alert(`Success! ${data.count} screenshot(s) submitted.`);
    
    uploadedGames = {};
    for (let i = 1; i <= 5; i++) {
      const preview = document.getElementById(`preview-${i}`);
      preview.innerHTML = `<span class="game-label">Game ${i}</span><i class="fas fa-cloud-upload-alt"></i><span>Click to upload</span>`;
      preview.classList.remove('has-image');
      document.getElementById(`game-${i}-file`).value = '';
    }
    document.getElementById('submit-matchday').value = '';
    document.getElementById('submit-opponent').value = '';
    
    loadSubmissions();
  } catch (error) {
    console.error('Submit error:', error);
    alert('Submission failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Screenshots';
  }
}

async function loadSubmissions() {
  const container = document.getElementById('submissions-list');
  
  try {
    const response = await fetch('/api/submit/my-submissions', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      container.innerHTML = '<p>Failed to load submissions</p>';
      return;
    }
    
    const submissions = await response.json();
    
    if (submissions.length === 0) {
      container.innerHTML = '<p>No submissions yet. Upload your first match screenshots!</p>';
      return;
    }
    
    container.innerHTML = submissions.map(sub => `
      <div class="submission-card">
        <img src="${sub.imageData}" alt="Game ${sub.gameNumber}">
        <div class="submission-info">
          <h4>Matchday ${sub.matchday} - Game ${sub.gameNumber}</h4>
          <p>
            ${sub.team?.shortName || 'Your Team'} vs ${sub.opponentTeam?.shortName || 'Opponent'}
            <br>
            Submitted: ${new Date(sub.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span class="status-badge ${sub.processed ? 'status-processed' : 'status-pending'}">
          ${sub.processed ? 'Processed' : 'Pending'}
        </span>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading submissions:', error);
    container.innerHTML = '<p>Failed to load submissions</p>';
  }
}

async function loadRoster() {
  const container = document.getElementById('roster-list');
  
  try {
    const response = await fetch('/api/submit/my-team/players', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      container.innerHTML = '<p>Failed to load roster</p>';
      return;
    }
    
    const players = await response.json();
    
    if (players.length === 0) {
      container.innerHTML = '<p>No players found in your team roster.</p>';
      return;
    }
    
    container.innerHTML = players.map(player => `
      <div class="player-card">
        <i class="fas fa-user"></i>
        <h4>${player.displayName}</h4>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading roster:', error);
    container.innerHTML = '<p>Failed to load roster</p>';
  }
}
