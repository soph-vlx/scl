let currentSort = 'goals';

document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard('goals');
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            loadLeaderboard(currentSort);
        });
    });
});

async function loadLeaderboard(sortBy) {
    try {
        const response = await fetch(`/api/leaderboard/players?sortBy=${sortBy}&limit=50`);
        const players = await response.json();
        
        const tbody = document.getElementById('leaderboard-body');
        
        if (players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No player data available yet.</td></tr>';
            return;
        }
        
        tbody.innerHTML = players.map(player => `
            <tr>
                <td>${player.position}</td>
                <td><strong><a href="player?id=${player.id}" class="player-link">${player.displayName}</a></strong></td>
                <td>${player.teamShortName || player.team}</td>
                <td>${player.goals}</td>
                <td>${player.assists}</td>
                <td>${player.saves}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        document.getElementById('leaderboard-body').innerHTML = 
            '<tr><td colspan="8" style="text-align: center; color: #e74c3c;">Error loading leaderboard</td></tr>';
    }
}
