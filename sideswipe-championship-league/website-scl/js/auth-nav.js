document.addEventListener('DOMContentLoaded', () => {
    updateNavbarAuth();
});

function updateNavbarAuth() {
    const authToken = localStorage.getItem('authToken');
    const authUser = localStorage.getItem('authUser');
    const adminShield = document.querySelector('.admin-shield');
    const topBarAuth = document.getElementById('top-bar-auth');
    const authLink = document.querySelector('.nav-auth-link');
    
    if (adminShield) {
        adminShield.style.display = 'none';
    }
    
    if (authToken && authUser) {
        try {
            const user = JSON.parse(authUser);
            
            if (adminShield && (user.role === 'ADMIN' || user.role === 'STAFF')) {
                adminShield.style.display = 'flex';
            }
            
            if (topBarAuth) {
                topBarAuth.innerHTML = `
                    <span class="user-info">
                        <i class="fas fa-user"></i> ${user.username}
                    </span>
                    <button class="logout-btn" onclick="logout()">Logout</button>
                `;
            }
            
            if (authLink) {
                authLink.innerHTML = `<a href="#" onclick="logout(); return false;">Logout (${user.username})</a>`;
            }
        } catch (e) {
            console.error('Error parsing auth user:', e);
        }
    } else {
        if (topBarAuth) {
            topBarAuth.innerHTML = '<a href="/login" class="login-btn">Login</a>';
        }
        if (authLink) {
            authLink.innerHTML = '<a href="/login">Login</a>';
        }
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
}
