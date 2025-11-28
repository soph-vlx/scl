// ======================================================
// SCL WEBSITE — LIVE API VERSION
// Fetches data from backend API
// ======================================================

const API_BASE = "/api";

// ---------- helper ----------
async function getJSON(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error("API Error");
        return await res.json();
    } catch (err) {
        console.error(`API failed: ${endpoint}`, err);
        return null;
    }
}

// ======================================================
// STANDINGS
// ======================================================
async function renderStandings() {
    const loading = document.querySelector("#loading-standings");
    if (loading) loading.style.display = "block";

    const tableBody = document.querySelector("#standings-body");
    if (!tableBody) return; // not on this page

    const standings = await getJSON("/standings");

    if (!standings || standings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:20px;">
                    No standings data found.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = "";

    standings.forEach((s) => {
        const row = document.createElement("tr");

        const logoHtml = s.logoUrl 
            ? `<img src="${s.logoUrl}" alt="${s.team}" class="standings-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="standings-logo-placeholder" style="display:none;"></div>`
            : `<div class="standings-logo-placeholder"></div>`;

        row.innerHTML = `
            <td>${s.position}</td>
            <td class="team-cell">
                ${logoHtml}
                <a href="team?id=${s.teamId}" class="team-link">${s.team}</a>
            </td>
            <td>${s.played}</td>
            <td>${s.wins}</td>
            <td>${s.draws}</td>
            <td>${s.losses}</td>
            <td>${s.goalsFor}</td>
            <td>${s.goalsAgainst}</td>
            <td class="${s.goalDifference > 0 ? 'stat-positive' : s.goalDifference < 0 ? 'stat-negative' : ''}">
                ${s.goalDifference}
            </td>
            <td>${s.points}</td>
        `;

        tableBody.appendChild(row);
        
    });
    if (loading) loading.style.display = "none";

}

// ======================================================
// MATCHES + MATCHDAY FILTER
// ======================================================
async function renderMatches() {
    const container = document.querySelector("#matches-container");
    const selector = document.querySelector("#matchday-select");
    if (!container || !selector) return; // not on this page

    const matches = await getJSON("/matches");

    if (!matches || matches.length === 0) {
        container.innerHTML = `<p>No matches found.</p>`;
        return;
    }

    // build matchday list
    const matchdays = [...new Set(matches.map((m) => m.matchday))].sort(
        (a, b) => a - b
    );

    // populate dropdown only once
    if (selector.options.length === 1) {
        matchdays.forEach((md) => {
            const opt = document.createElement("option");
            opt.value = md;
            opt.textContent = `Matchday ${md}`;
            selector.appendChild(opt);
        });
    }

    // selected value
    const selected = selector.value;

    // refilter when user changes
    selector.onchange = () => renderMatches();

    const filtered =
        selected === "all"
            ? matches
            : matches.filter((m) => m.matchday == selected);

    const grouped = {};
    filtered.forEach((m) => {
        if (!grouped[m.matchday]) grouped[m.matchday] = [];
        grouped[m.matchday].push(m);
    });

    container.innerHTML = "";

    for (const matchday of Object.keys(grouped)) {
        const title = document.createElement("h2");
        title.textContent = `Matchday ${matchday}`;
        container.appendChild(title);

        grouped[matchday].forEach((m) => {
            const card = document.createElement("div");
            card.className = "match-card";

            const score =
                m.status === "COMPLETED" && m.scoreHome !== null
                    ? `${m.scoreHome} - ${m.scoreAway}`
                    : "TBD";

            const homeLogoHtml = m.homeTeamLogo 
                ? `<img src="${m.homeTeamLogo}" alt="${m.homeTeam}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="match-logo-placeholder" style="display:none;"></div>`
                : `<div class="match-logo-placeholder"></div>`;
            
            const awayLogoHtml = m.awayTeamLogo 
                ? `<img src="${m.awayTeamLogo}" alt="${m.awayTeam}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="match-logo-placeholder" style="display:none;"></div>`
                : `<div class="match-logo-placeholder"></div>`;

            card.innerHTML = `
                <div class="match-teams-row">
                    <div class="match-team-info">
                        ${homeLogoHtml}
                        <span class="match-team-name">${m.homeTeam}</span>
                    </div>
                    <div class="match-vs">vs</div>
                    <div class="match-team-info">
                        ${awayLogoHtml}
                        <span class="match-team-name">${m.awayTeam}</span>
                    </div>
                </div>
                <div class="match-status">Status: ${m.status}</div>
                <div class="match-score">Score: ${score}</div>
            `;

            card.style.cursor = "pointer";
            card.onclick = () => {
                window.location.href = `match?id=${m.id}`;
            };

            container.appendChild(card);
        });
    }
}

// ======================================================
// TEAMS (LIST) — CLICKABLE CARDS
// ======================================================
async function renderTeams() {
    const container = document.querySelector("#teams-container");
    if (!container) return; // not on this page

    const teams = await getJSON("/teams");

    if (!teams || teams.length === 0) {
        container.innerHTML = `<p>No teams found.</p>`;
        const teamCount = document.querySelector("#team-count");
        if (teamCount) teamCount.textContent = "0";
        return;
    }

    const teamCount = document.querySelector("#team-count");
    if (teamCount) teamCount.textContent = teams.length;

    container.innerHTML = "";

    teams.forEach((t) => {
        const card = document.createElement("div");
        card.className = "team-card";

        // Create logo element (image if URL exists, placeholder otherwise)
        let logoEl;
        if (t.logoUrl) {
            // Real logo image
            logoEl = document.createElement("img");
            logoEl.src = t.logoUrl;
            logoEl.alt = `${t.name} logo`;
            logoEl.className = "team-logo-img";
            
            // Fallback to placeholder on error
            const placeholderDiv = document.createElement("div");
            placeholderDiv.className = "team-logo-placeholder";
            placeholderDiv.style.display = "none";
            
            logoEl.onerror = () => {
                logoEl.style.display = "none";
                placeholderDiv.style.display = "block";
                const c1 = "#" + Math.floor(Math.random() * 16777215).toString(16);
                const c2 = "#" + Math.floor(Math.random() * 16777215).toString(16);
                placeholderDiv.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
            };
            
            card.appendChild(logoEl);
            card.appendChild(placeholderDiv);
        } else {
            // Gradient placeholder
            logoEl = document.createElement("div");
            logoEl.className = "team-logo-placeholder";
            card.appendChild(logoEl);
        }

        // Team name heading
        const heading = document.createElement("h3");
        heading.textContent = t.name;
        card.appendChild(heading);

        // Make card clickable -> team?id=TEAM_ID
        card.style.cursor = "pointer";
        card.onclick = () => {
            window.location.href = `team?id=${t.id}`;
        };

        container.appendChild(card);
    });

    // random gradients for logos without images
    document.querySelectorAll(".team-logo-placeholder").forEach((logo) => {
        const c1 = "#" + Math.floor(Math.random() * 16777215).toString(16);
        const c2 = "#" + Math.floor(Math.random() * 16777215).toString(16);
        logo.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    });
}

// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
    renderStandings();
    renderMatches();
    renderTeams();
    const refreshBtn = document.querySelector("#refresh-standings");
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            renderStandings();
        };
    }

});
