// College Basketball Live Game Tracker — with NCAA Tournament Bracket

class CollegeBasketballTracker {
    constructor() {
        this.selectedGames = new Set();
        this.allGames = [];
        this.rankings = [];
        this.bracketData = null;
        this.updateInterval = null;
        this.init();
    }

    toLocalTime(espnDate) {
        return new Date(espnDate);
    }

    formatLocalTime(date) {
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timeZoneAbbr = new Date().toLocaleTimeString('en-us', { timeZone, timeZoneName: 'short' }).split(' ').pop();
        return `${time} ${timeZoneAbbr}`;
    }

    formatLocalDate(date) {
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }

    getCountdown(targetDate) {
        const now = new Date();
        const diff = targetDate - now;
        if (diff <= 0) return 'Starting soon!';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes} min`;
    }

    init() {
        this.setupEventListeners();
        this.loadAll();
    }

    setupEventListeners() {
        const watchBtn = document.getElementById('watch-btn');
        const backBtn = document.getElementById('back-btn');
        if (watchBtn) watchBtn.addEventListener('click', () => this.showLiveView());
        if (backBtn) backBtn.addEventListener('click', () => this.showSelectionScreen());
    }

    async loadAll() {
        const loading = document.getElementById('loading');
        const gameList = document.getElementById('game-list');
        const noGames = document.getElementById('no-games');

        loading.style.display = 'block';
        gameList.innerHTML = '';
        noGames.style.display = 'none';

        try {
            const [games, rankings, bracket] = await Promise.all([
                this.fetchGames(),
                this.fetchRankings(),
                this.fetchBracket()
            ]);

            this.allGames = games;
            this.rankings = rankings;
            this.bracketData = bracket;

            loading.style.display = 'none';

            if (games.length === 0) {
                noGames.style.display = 'block';
            } else {
                this.renderGameList(games);
            }

            this.renderStandingsAndBracket();
        } catch (err) {
            console.error('Error loading CBB data:', err);
            loading.style.display = 'none';
            noGames.style.display = 'block';
            noGames.querySelector('p').textContent = 'Error loading games. Please refresh.';
            this.renderStandingsAndBracket();
        }
    }

    // ── API Fetchers ──────────────────────────────────────────────

    async fetchGames() {
        try {
            const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard');
            const data = await res.json();
            if (!data.events || data.events.length === 0) return [];

            return data.events.map(event => {
                const comp = event.competitions[0];
                const home = comp.competitors.find(t => t.homeAway === 'home');
                const away = comp.competitors.find(t => t.homeAway === 'away');
                const isTournament = (event.season?.slug === 'post-season') ||
                    (comp.notes?.some(n => n.headline && n.headline.toLowerCase().includes('ncaa'))) ||
                    (event.notes?.some(n => n.headline && n.headline.toLowerCase().includes('ncaa')));

                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: this.toLocalTime(event.date),
                    status: comp.status.type.description,
                    statusDetail: comp.status.type.detail || comp.status.type.description,
                    isLive: comp.status.type.state === 'in',
                    isCompleted: comp.status.type.completed,
                    isPregame: comp.status.type.state === 'pre',
                    isTournament,
                    notes: (comp.notes || []).map(n => n.headline).filter(Boolean),
                    homeTeam: {
                        id: home.team.id,
                        name: home.team.displayName,
                        shortName: home.team.abbreviation,
                        score: home.score,
                        logo: home.team.logo,
                        record: home.records?.[0]?.summary || 'N/A',
                        rank: home.curatedRank?.current || null,
                        seed: home.curatedRank?.current || null
                    },
                    awayTeam: {
                        id: away.team.id,
                        name: away.team.displayName,
                        shortName: away.team.abbreviation,
                        score: away.score,
                        logo: away.team.logo,
                        record: away.records?.[0]?.summary || 'N/A',
                        rank: away.curatedRank?.current || null,
                        seed: away.curatedRank?.current || null
                    },
                    venue: comp.venue?.fullName || 'TBD',
                    broadcast: comp.broadcasts?.[0]?.names?.[0] || 'N/A',
                    leaders: comp.leaders || []
                };
            });
        } catch (err) {
            console.error('fetchGames error:', err);
            return [];
        }
    }

    async fetchRankings() {
        try {
            const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings');
            const data = await res.json();
            // First poll: AP Top 25
            const apPoll = data.rankings?.find(r => r.name && r.name.toLowerCase().includes('ap')) || data.rankings?.[0];
            if (!apPoll || !apPoll.ranks) return [];
            return apPoll.ranks.map(r => ({
                rank: r.current,
                name: r.team?.displayName || 'Unknown',
                shortName: r.team?.abbreviation || '',
                logo: r.team?.logo || r.team?.logos?.[0]?.href || '',
                record: r.recordSummary || '',
                previousRank: r.previous || null
            }));
        } catch (err) {
            console.error('fetchRankings error:', err);
            return [];
        }
    }

    async fetchBracket() {
        // Try ESPN's tournament API for the current year's NCAA tournament
        const endpoints = [
            'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/22',
            'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/2026',
            'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments'
        ];

        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const data = await res.json();
                if (data && (data.bracket || data.rounds || data.groups || Array.isArray(data))) {
                    return this.parseBracketData(data);
                }
            } catch (e) {
                // try next
            }
        }

        // Fallback: try to get tournament games from scoreboard
        try {
            const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100');
            const data = await res.json();
            if (data.events && data.events.length > 0) {
                return this.buildBracketFromGames(data.events);
            }
        } catch (e) {}

        return null;
    }

    parseBracketData(data) {
        // Try to parse ESPN tournament API response into our format
        if (Array.isArray(data)) {
            // List of tournaments — pick the latest
            const latest = data[data.length - 1];
            return this.parseBracketData(latest);
        }

        const bracket = {
            title: data.shortName || data.name || 'NCAA Tournament',
            groups: [],
            finalFour: [],
            championship: null,
            champion: null
        };

        // ESPN tournament structure varies. Try to pull region data.
        const groups = data.groups || data.bracket?.groups || data.rounds || [];
        if (Array.isArray(groups)) {
            groups.forEach(group => {
                if (group.name) {
                    bracket.groups.push(this.parseGroup(group));
                }
            });
        }

        return bracket;
    }

    parseGroup(group) {
        const regionObj = {
            name: group.name || group.shortName || 'Region',
            rounds: []
        };
        const events = group.events || group.games || group.rounds || [];
        events.forEach(event => {
            // Each event is a game or a round
            if (event.competitors) {
                regionObj.rounds.push(this.parseGroupGame(event));
            }
        });
        return regionObj;
    }

    parseGroupGame(event) {
        const comp = event.competitions?.[0] || event;
        const teams = comp.competitors || [];
        return {
            id: event.id,
            name: event.name,
            date: event.date,
            isLive: comp.status?.type?.state === 'in',
            isCompleted: comp.status?.type?.completed || false,
            roundName: event.roundText || event.round?.text || '',
            teams: teams.map(t => ({
                seed: t.order || t.seed || null,
                name: t.team?.displayName || t.name || 'TBD',
                shortName: t.team?.abbreviation || '',
                logo: t.team?.logo || t.team?.logos?.[0]?.href || '',
                score: t.score || '',
                winner: t.winner || false,
                record: t.records?.[0]?.summary || ''
            }))
        };
    }

    buildBracketFromGames(events) {
        // Build a simple bracket from tournament scoreboard events
        const rounds = {};
        events.forEach(event => {
            const comp = event.competitions[0];
            const roundText = event.notes?.find(n => n.type === 'event')?.headline ||
                              comp.notes?.[0]?.headline ||
                              event.seasonType?.name || 'Tournament';
            if (!rounds[roundText]) rounds[roundText] = [];

            const home = comp.competitors.find(t => t.homeAway === 'home') || comp.competitors[0];
            const away = comp.competitors.find(t => t.homeAway === 'away') || comp.competitors[1];

            rounds[roundText].push({
                id: event.id,
                name: event.shortName,
                date: event.date,
                isLive: comp.status.type.state === 'in',
                isCompleted: comp.status.type.completed,
                roundName: roundText,
                teams: [
                    {
                        seed: away?.curatedRank?.current || null,
                        name: away?.team?.displayName || 'TBD',
                        shortName: away?.team?.abbreviation || '',
                        logo: away?.team?.logo || '',
                        score: away?.score || '',
                        winner: away?.winner || false,
                        record: away?.records?.[0]?.summary || ''
                    },
                    {
                        seed: home?.curatedRank?.current || null,
                        name: home?.team?.displayName || 'TBD',
                        shortName: home?.team?.abbreviation || '',
                        logo: home?.team?.logo || '',
                        score: home?.score || '',
                        winner: home?.winner || false,
                        record: home?.records?.[0]?.summary || ''
                    }
                ]
            });
        });

        if (Object.keys(rounds).length === 0) return null;

        return {
            title: 'NCAA Tournament',
            groups: Object.entries(rounds).map(([name, games]) => ({
                name,
                rounds: games
            })),
            finalFour: [],
            championship: null,
            champion: null
        };
    }

    // ── Rendering ─────────────────────────────────────────────────

    renderGameList(games) {
        const gameList = document.getElementById('game-list');
        gameList.innerHTML = '';
        games.forEach((game, i) => {
            const card = this.createGameCard(game);
            card.style.animation = `slideInUp 0.5s ease-out ${i * 0.07}s both`;
            gameList.appendChild(card);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        const cardClass = game.isTournament ? 'tournament-card' : 'conference-card';
        card.className = `game-card ${cardClass}`;
        card.dataset.gameId = game.id;

        const statusText = game.isLive ? '🔴 LIVE' : game.isCompleted ? '✓ Final' : game.status;
        const tournamentBadge = game.isTournament ? `<span class="tournament-badge">🏆 NCAA</span>` : '';

        const awayRank = game.awayTeam.rank ? `<div class="team-rank">#${game.awayTeam.rank} AP</div>` : '';
        const homeRank = game.homeTeam.rank ? `<div class="team-rank">#${game.homeTeam.rank} AP</div>` : '';

        let noteHTML = '';
        if (game.notes.length > 0) {
            noteHTML = `<div style="font-size:0.78rem;color:#FFD700;margin-bottom:6px;text-align:center;">${game.notes[0]}</div>`;
        }

        let countdownHTML = '';
        if (game.isPregame) {
            countdownHTML = `<div class="countdown">⏱️ ${this.getCountdown(game.date)}</div>`;
        }

        card.innerHTML = `
            <div class="game-status">${statusText}</div>${tournamentBadge}
            ${countdownHTML}
            ${noteHTML}
            <div class="game-matchup">
                <div class="team">
                    ${game.awayTeam.logo ? `<img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">` : ''}
                    <div class="team-name">${game.awayTeam.name}</div>
                    ${awayRank}
                    <div class="team-record">${game.awayTeam.record}</div>
                    <div class="team-score">${game.awayTeam.score !== undefined ? game.awayTeam.score : ''}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    ${game.homeTeam.logo ? `<img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">` : ''}
                    <div class="team-name">${game.homeTeam.name}</div>
                    ${homeRank}
                    <div class="team-record">${game.homeTeam.record}</div>
                    <div class="team-score">${game.homeTeam.score !== undefined ? game.homeTeam.score : ''}</div>
                </div>
            </div>
            <div class="game-info">
                <div><strong>${game.statusDetail}</strong></div>
                <div>📍 ${game.venue}</div>
                <div>📺 ${game.broadcast}</div>
                <div>📅 ${this.formatLocalDate(game.date)} at ${this.formatLocalTime(game.date)}</div>
            </div>
        `;

        card.addEventListener('click', () => this.toggleGameSelection(game.id, card));
        card.addEventListener('dblclick', e => {
            e.stopPropagation();
            this.selectedGames.clear();
            document.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
            this.selectedGames.add(game.id);
            card.classList.add('selected');
            this.showLiveView();
        });

        return card;
    }

    toggleGameSelection(gameId, card) {
        if (this.selectedGames.has(gameId)) {
            this.selectedGames.delete(gameId);
            card.classList.remove('selected');
        } else {
            this.selectedGames.add(gameId);
            card.classList.add('selected');
        }
        const watchBtn = document.getElementById('watch-btn');
        watchBtn.style.display = this.selectedGames.size > 0 ? 'block' : 'none';
    }

    showLiveView() {
        if (this.selectedGames.size === 0) return;
        document.getElementById('selection-screen').classList.remove('active');
        document.getElementById('live-screen').classList.add('active');
        this.renderLivePanels();
        this.startAutoUpdate();
    }

    showSelectionScreen() {
        document.getElementById('live-screen').classList.remove('active');
        document.getElementById('selection-screen').classList.add('active');
        this.stopAutoUpdate();
    }

    renderLivePanels() {
        const container = document.getElementById('game-panels');
        container.innerHTML = '';
        container.className = `game-panels panels-${this.selectedGames.size}`;
        this.allGames.filter(g => this.selectedGames.has(g.id)).forEach(g => {
            container.appendChild(this.createGamePanel(g));
        });
    }

    createGamePanel(game) {
        const panel = document.createElement('div');
        panel.className = `game-panel ${game.isTournament ? 'tournament-panel' : ''}`;
        panel.dataset.gameId = game.id;

        const statusText = game.isLive ? '🔴 LIVE' : game.isCompleted ? '✓ Final' : game.status;

        const awayRank = game.awayTeam.rank ? `<div style="font-size:0.8rem;color:#FFD700;">#${game.awayTeam.rank} AP</div>` : '';
        const homeRank = game.homeTeam.rank ? `<div style="font-size:0.8rem;color:#FFD700;">#${game.homeTeam.rank} AP</div>` : '';

        let leadersHTML = '';
        if (game.leaders && game.leaders.length > 0) {
            leadersHTML = `
                <div class="stats-section">
                    <h4>Game Leaders</h4>
                    ${game.leaders.slice(0, 3).map(leader => {
                        const top = leader.leaders?.[0];
                        if (!top) return '';
                        return `<div class="stat-row"><div class="stat-label">${leader.displayName}</div><div class="stat-value">${top.athlete?.displayName || 'N/A'}: ${top.displayValue || 'N/A'}</div></div>`;
                    }).join('')}
                </div>
            `;
        }

        let noteHTML = '';
        if (game.notes.length > 0) {
            noteHTML = `<div style="text-align:center;margin-bottom:10px;font-size:0.9rem;color:#FFD700;font-weight:bold;">${game.notes[0]}</div>`;
        }

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                ${game.isTournament ? '<span class="tournament-badge">🏆 NCAA Tournament</span>' : ''}
                ${noteHTML}
                <div class="panel-matchup">
                    <div class="panel-team">
                        ${game.awayTeam.logo ? `<img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">` : ''}
                        <div class="panel-team-name">${game.awayTeam.name}</div>
                        ${awayRank}
                        <div class="panel-team-record">${game.awayTeam.record}</div>
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        ${game.homeTeam.logo ? `<img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">` : ''}
                        <div class="panel-team-name">${game.homeTeam.name}</div>
                        ${homeRank}
                        <div class="panel-team-record">${game.homeTeam.record}</div>
                        <div class="panel-team-score">${game.homeTeam.score}</div>
                    </div>
                </div>
                <div class="panel-info">
                    <div><strong>${game.statusDetail}</strong></div>
                    <div>📍 ${game.venue}</div>
                    <div>📺 ${game.broadcast}</div>
                </div>
            </div>
            <div class="panel-details">
                ${leadersHTML}
            </div>
        `;

        return panel;
    }

    startAutoUpdate() {
        this.updateInterval = setInterval(() => this.updateLiveData(), 30000);
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateLiveData() {
        try {
            this.allGames = await this.fetchGames();
            this.renderLivePanels();
        } catch (e) {
            console.error('Update error:', e);
        }
    }

    // ── Standings & Bracket rendering ─────────────────────────────

    renderStandingsAndBracket() {
        const container = document.getElementById('standings-details');
        if (!container) return;

        let html = '';

        // Rankings section
        if (this.rankings.length > 0) {
            html += this.renderRankings();
        }

        // Tournament bracket section — always show (with fallback UI)
        html += this.renderBracketSection();

        // Format info
        html += `
            <div class="info-box" style="margin-top:30px;">
                <div class="info-box-title">🏀 NCAA Tournament Format</div>
                <div class="info-box-body">
                    <strong>Selection Sunday:</strong> 68 teams chosen and seeded 1–16 in 4 regions<br>
                    <strong>First Four:</strong> 4 play-in games → 64 teams advance<br>
                    <strong>First Round (Round of 64):</strong> 1v16, 2v15 ... 8v9 matchups per region<br>
                    <strong>Second Round (Round of 32):</strong> Winners advance<br>
                    <strong>Sweet 16 → Elite 8 → Final Four → Championship</strong><br>
                    Win 6 games from a top seed (or 7 from the First Four) to be <strong>National Champion 🏆</strong>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachBracketTabListeners();
    }

    renderRankings() {
        const top25 = this.rankings.slice(0, 25);
        return `
            <div class="rankings-section">
                <h2>📊 AP Top 25 Rankings</h2>
                <div class="rankings-grid">
                    ${top25.map(team => `
                        <div class="ranking-card">
                            <div class="ranking-number ${team.rank <= 3 ? 'top3' : ''}">${team.rank}</div>
                            ${team.logo ? `<img src="${team.logo}" alt="${team.name}" class="ranking-logo">` : ''}
                            <div class="ranking-info">
                                <div class="ranking-team-name">${team.name}</div>
                                <div class="ranking-record">${team.record}${team.previousRank && team.previousRank !== team.rank ? ` · Prev: #${team.previousRank}` : ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderBracketSection() {
        if (!this.bracketData) {
            return this.renderNoBracketFallback();
        }
        return this.renderFullBracket();
    }

    renderNoBracketFallback() {
        // Build a "projected bracket" from rankings when tournament API isn't available
        const teams = this.rankings.slice(0, 64);
        if (teams.length < 8) {
            return `
                <div class="bracket-section">
                    <div class="bracket-section-title">🏆 NCAA Tournament Bracket</div>
                    <div class="bracket-section-subtitle">Tournament data will appear when the bracket is announced.</div>
                </div>
            `;
        }

        // Build 4 seeded regions using top 64 ranked teams
        const regionNames = ['South', 'East', 'West', 'Midwest'];
        // Seeds 1-16 per region — assign teams round-robin across regions
        const regions = regionNames.map((name, ri) => {
            const regionTeams = [];
            for (let seed = 1; seed <= 16; seed++) {
                const teamIdx = (seed - 1) * 4 + ri;
                regionTeams.push(teams[teamIdx] || null);
            }
            return { name, teams: regionTeams };
        });

        return `
            <div class="bracket-section">
                <div class="bracket-section-title">🏆 NCAA Tournament Bracket</div>
                <div class="bracket-section-subtitle">Season standings — win/loss records by region seeding</div>
                <div class="bracket-regions">
                    ${regions.map(region => this.renderRegionSeedings(region)).join('')}
                </div>
                ${this.renderFallbackFinalFour()}
            </div>
        `;
    }

    renderRegionSeedings(region) {
        // Show 8 first-round matchups (1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9)
        const pairings = [[1,16],[2,15],[3,14],[4,13],[5,12],[6,11],[7,10],[8,9]];
        return `
            <div class="bracket-region">
                <div class="bracket-region-title">${region.name} Region</div>
                <div class="bracket-rounds-wrapper">
                    <div class="bracket-round-col">
                        <div class="bracket-round-label">First Round</div>
                        ${pairings.map(([s1, s2]) => {
                            const t1 = region.teams[s1 - 1];
                            const t2 = region.teams[s2 - 1];
                            return `
                                <div class="bracket-matchup" style="margin-bottom:6px;">
                                    ${this.renderBracketTeamRow(s1, t1, false, false)}
                                    ${this.renderBracketTeamRow(s2, t2, false, false)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="bracket-round-col">
                        <div class="bracket-round-label">Round of 32</div>
                        ${pairings.slice(0,4).map(() => `
                            <div class="bracket-matchup" style="margin-bottom:24px;">
                                ${this.renderTBDRow()}
                                ${this.renderTBDRow()}
                            </div>
                        `).join('')}
                    </div>
                    <div class="bracket-round-col">
                        <div class="bracket-round-label">Sweet 16</div>
                        ${[0,1].map(() => `
                            <div class="bracket-matchup" style="margin-bottom:80px;">
                                ${this.renderTBDRow()}
                                ${this.renderTBDRow()}
                            </div>
                        `).join('')}
                    </div>
                    <div class="bracket-round-col">
                        <div class="bracket-round-label">Elite 8</div>
                        <div class="bracket-matchup" style="margin-top:80px;">
                            ${this.renderTBDRow()}
                            ${this.renderTBDRow()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderBracketTeamRow(seed, team, isWinner, isLoser) {
        if (!team) return this.renderTBDRow(seed);
        const winClass = isWinner ? 'winner' : isLoser ? 'loser' : '';
        return `
            <div class="bracket-team-row ${winClass}">
                <span class="bracket-seed-num">${seed}</span>
                ${team.logo ? `<img src="${team.logo}" alt="${team.name}" class="bracket-team-logo">` : ''}
                <span class="bracket-team-name-short" title="${team.name}">${team.shortName || team.name.split(' ').pop()}</span>
                <span class="bracket-score" style="font-size:0.75rem;opacity:0.7;">${team.record || ''}</span>
            </div>
        `;
    }

    renderTBDRow(seed) {
        return `
            <div class="bracket-team-row tbd">
                <span class="bracket-seed-num">${seed || '?'}</span>
                <span class="bracket-team-name-short">TBD</span>
            </div>
        `;
    }

    renderFallbackFinalFour() {
        return `
            <div class="final-four-section">
                <div class="final-four-title">🏟️ Final Four</div>
                <div class="final-four-grid">
                    <div class="final-four-matchup">
                        <div class="final-four-matchup-label">Semifinal 1 (South vs East)</div>
                        ${this.renderTBDRow()}${this.renderTBDRow()}
                    </div>
                    <div class="final-four-matchup">
                        <div class="final-four-matchup-label">Semifinal 2 (West vs Midwest)</div>
                        ${this.renderTBDRow()}${this.renderTBDRow()}
                    </div>
                </div>
                <div style="margin-top:20px;">
                    <div class="championship-game">
                        <div class="championship-label">🏆 National Championship</div>
                        ${this.renderTBDRow()}
                        ${this.renderTBDRow()}
                    </div>
                </div>
            </div>
        `;
    }

    renderFullBracket() {
        const groups = this.bracketData.groups || [];
        const regionGroups = groups.filter(g => g.rounds && g.rounds.length > 0);

        if (regionGroups.length === 0) {
            return this.renderNoBracketFallback();
        }

        const roundNames = [...new Set(regionGroups.flatMap(g => g.rounds.map(r => r.roundName)).filter(Boolean))];

        return `
            <div class="bracket-section">
                <div class="bracket-section-title">🏆 ${this.bracketData.title || 'NCAA Tournament Bracket'}</div>
                <div class="bracket-section-subtitle">Live bracket — click a round to filter</div>
                ${roundNames.length > 1 ? `
                    <div class="bracket-round-tabs">
                        <div class="round-tab active-tab" data-round="all">All Rounds</div>
                        ${roundNames.map(r => `<div class="round-tab" data-round="${r}">${r}</div>`).join('')}
                    </div>
                ` : ''}
                <div class="bracket-regions" id="bracket-regions-container">
                    ${regionGroups.map(g => this.renderLiveRegion(g)).join('')}
                </div>
                ${this.renderLiveFinalFour()}
            </div>
        `;
    }

    renderLiveRegion(group) {
        // Group rounds by roundName
        const roundMap = {};
        group.rounds.forEach(game => {
            const rn = game.roundName || 'Round';
            if (!roundMap[rn]) roundMap[rn] = [];
            roundMap[rn].push(game);
        });

        return `
            <div class="bracket-region">
                <div class="bracket-region-title">${group.name}</div>
                <div class="bracket-rounds-wrapper">
                    ${Object.entries(roundMap).map(([roundName, games]) => `
                        <div class="bracket-round-col" data-round="${roundName}">
                            <div class="bracket-round-label">${roundName}</div>
                            ${games.map(game => this.renderLiveMatchup(game)).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderLiveMatchup(game) {
        const liveClass = game.isLive ? 'live-game' : '';
        return `
            <div class="bracket-matchup ${liveClass}" style="margin-bottom:8px;">
                ${game.teams.map(team => {
                    const isWinner = game.isCompleted && team.winner;
                    const isLoser = game.isCompleted && !team.winner;
                    const rowClass = isWinner ? 'winner' : isLoser ? 'loser' : team.name === 'TBD' ? 'tbd' : '';
                    const scoreClass = isWinner ? 'winning-score' : '';
                    return `
                        <div class="bracket-team-row ${rowClass}">
                            <span class="bracket-seed-num">${team.seed || '?'}</span>
                            ${team.logo ? `<img src="${team.logo}" alt="${team.name}" class="bracket-team-logo">` : ''}
                            <span class="bracket-team-name-short" title="${team.name}">${team.shortName || team.name}</span>
                            ${team.score !== '' ? `<span class="bracket-score ${scoreClass}">${team.score}</span>` : `<span class="bracket-score" style="font-size:0.72rem;opacity:0.6;">${team.record}</span>`}
                        </div>
                    `;
                }).join('')}
                ${game.isLive ? `<div style="text-align:center;font-size:0.72rem;color:#ff4444;padding:3px;">🔴 LIVE</div>` : ''}
            </div>
        `;
    }

    renderLiveFinalFour() {
        if (!this.bracketData) return '';
        const ff = this.bracketData.finalFour || [];
        const champ = this.bracketData.championship;
        const winner = this.bracketData.champion;

        return `
            <div class="final-four-section">
                <div class="final-four-title">🏟️ Final Four & Championship</div>
                <div class="final-four-grid">
                    ${ff.length > 0 ? ff.map(game => `
                        <div class="final-four-matchup">
                            <div class="final-four-matchup-label">${game.roundName || 'Semifinal'}</div>
                            ${this.renderLiveMatchup(game)}
                        </div>
                    `).join('') : `
                        <div class="final-four-matchup">
                            <div class="final-four-matchup-label">Semifinal 1</div>
                            ${this.renderTBDRow()}${this.renderTBDRow()}
                        </div>
                        <div class="final-four-matchup">
                            <div class="final-four-matchup-label">Semifinal 2</div>
                            ${this.renderTBDRow()}${this.renderTBDRow()}
                        </div>
                    `}
                </div>
                <div style="margin-top:24px;">
                    ${winner ? `
                        <div class="champion-banner">
                            ${winner.logo ? `<img src="${winner.logo}" style="width:60px;height:60px;object-fit:contain;margin-bottom:10px;" alt="${winner.name}">` : ''}
                            <h3>🏆 ${winner.name}</h3>
                            <div style="margin-top:8px;opacity:0.85;">National Champions!</div>
                        </div>
                    ` : champ ? `
                        <div class="championship-game">
                            <div class="championship-label">🏆 National Championship</div>
                            ${this.renderLiveMatchup(champ)}
                        </div>
                    ` : `
                        <div class="championship-game">
                            <div class="championship-label">🏆 National Championship</div>
                            ${this.renderTBDRow()}
                            ${this.renderTBDRow()}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    attachBracketTabListeners() {
        document.querySelectorAll('.round-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.round-tab').forEach(t => t.classList.remove('active-tab'));
                tab.classList.add('active-tab');
                const round = tab.dataset.round;
                document.querySelectorAll('.bracket-round-col[data-round]').forEach(col => {
                    col.style.display = (round === 'all' || col.dataset.round === round) ? '' : 'none';
                });
            });
        });
    }
}

// Boot
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CollegeBasketballTracker());
} else {
    new CollegeBasketballTracker();
}
