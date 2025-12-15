// NHL Live Game Tracker Application

class NHLGameTracker {
    constructor() {
        this.selectedGames = new Set();
        this.allGames = [];
        this.standings = null;
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGames();
    }

    setupEventListeners() {
        const watchBtn = document.getElementById('watch-btn');
        const backBtn = document.getElementById('back-btn');
        
        if (watchBtn) {
            watchBtn.addEventListener('click', () => {
                this.showLiveView();
            });
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showSelectionScreen();
            });
        }
    }

    async loadGames() {
        const loading = document.getElementById('loading');
        const gameList = document.getElementById('game-list');
        const noGames = document.getElementById('no-games');
        
        loading.style.display = 'block';
        gameList.innerHTML = '';
        noGames.style.display = 'none';

        try {
            const [games, standings] = await Promise.all([
                this.fetchNHLGames(),
                this.fetchNHLStandings()
            ]);
            this.allGames = games;
            this.standings = standings;

            loading.style.display = 'none';

            if (games.length === 0) {
                noGames.style.display = 'block';
                this.showNextGameInfo();
            } else {
                this.renderGameList(games);
            }
            
            // Always render standings
            this.renderStandingsDetails();
        } catch (error) {
            console.error('Error loading games:', error);
            loading.style.display = 'none';
            noGames.style.display = 'block';
            noGames.querySelector('p').textContent = 'Error loading games. Please try again later.';
        }
    }

    async fetchNHLGames() {
        try {
            // Using ESPN's public API for NHL scores
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard');
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                return [];
            }

            return data.events.map(event => {
                const competition = event.competitions[0];
                const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
                const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
                
                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: new Date(event.date),
                    status: competition.status.type.description,
                    statusDetail: competition.status.type.detail,
                    period: competition.status.period || 0,
                    clock: competition.status.displayClock || '',
                    isLive: competition.status.type.state === 'in',
                    isCompleted: competition.status.type.completed,
                    isPregame: competition.status.type.state === 'pre',
                    homeTeam: {
                        id: homeTeam.team.id,
                        name: homeTeam.team.displayName,
                        shortName: homeTeam.team.abbreviation,
                        score: homeTeam.score,
                        logo: homeTeam.team.logo,
                        record: homeTeam.records?.[0]?.summary || 'N/A',
                        conference: this.getTeamConference(homeTeam.team.id)
                    },
                    awayTeam: {
                        id: awayTeam.team.id,
                        name: awayTeam.team.displayName,
                        shortName: awayTeam.team.abbreviation,
                        score: awayTeam.score,
                        logo: awayTeam.team.logo,
                        record: awayTeam.records?.[0]?.summary || 'N/A',
                        conference: this.getTeamConference(awayTeam.team.id)
                    },
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    leaders: competition.leaders || [],
                    situation: competition.situation || null
                };
            });
        } catch (error) {
            console.error('Error fetching NHL games:', error);
            throw error;
        }
    }

    async fetchNHLStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings');
            const data = await response.json();
            
            const standings = {
                eastern: [],
                western: []
            };

            if (data.children) {
                data.children.forEach(conference => {
                    const confName = conference.name?.toLowerCase() || conference.abbreviation?.toLowerCase();
                    
                    if (confName?.includes('east')) {
                        if (conference.standings?.entries) {
                            standings.eastern = this.processStandingsEntries(conference.standings.entries);
                        } else if (conference.children) {
                            // Handle division-based structure
                            conference.children.forEach(division => {
                                if (division.standings?.entries) {
                                    standings.eastern.push(...this.processStandingsEntries(division.standings.entries));
                                }
                            });
                        }
                    } else if (confName?.includes('west')) {
                        if (conference.standings?.entries) {
                            standings.western = this.processStandingsEntries(conference.standings.entries);
                        } else if (conference.children) {
                            conference.children.forEach(division => {
                                if (division.standings?.entries) {
                                    standings.western.push(...this.processStandingsEntries(division.standings.entries));
                                }
                            });
                        }
                    }
                });
            }

            // Sort by points (NHL uses points system)
            standings.eastern.sort((a, b) => b.points - a.points || b.wins - a.wins);
            standings.western.sort((a, b) => b.points - a.points || b.wins - a.wins);

            return standings;
        } catch (error) {
            console.error('Error fetching NHL standings:', error);
            return { eastern: [], western: [] };
        }
    }

    processStandingsEntries(entries) {
        return entries.map(entry => {
            const team = entry.team;
            const stats = {};
            entry.stats.forEach(stat => {
                stats[stat.name] = stat.value;
            });

            return {
                id: team.id,
                name: team.displayName,
                abbreviation: team.abbreviation,
                logo: team.logos?.[0]?.href,
                wins: stats.wins || 0,
                losses: stats.losses || 0,
                otLosses: stats.otLosses || stats.OTL || 0,
                points: stats.points || 0,
                gamesPlayed: stats.gamesPlayed || 0,
                goalsFor: stats.pointsFor || stats.goalsFor || 0,
                goalsAgainst: stats.pointsAgainst || stats.goalsAgainst || 0,
                goalDiff: stats.pointDifferential || stats.differential || 0,
                streak: stats.streak || 0,
                regulationWins: stats.regulationWins || stats.wins || 0,
                inPlayoffs: false // Will be set after sorting
            };
        });
    }

    async showNextGameInfo() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
            
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`);
            const data = await response.json();
            
            if (data.events && data.events.length > 0) {
                const nextGame = data.events[0];
                const gameDate = new Date(nextGame.date);
                const competition = nextGame.competitions[0];
                const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
                const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
                
                const noGamesDiv = document.getElementById('no-games');
                const countdown = this.getCountdown(gameDate);
                
                noGamesDiv.innerHTML = `
                    <div style="text-align: center;">
                        <p style="font-size: 1.2rem; margin-bottom: 15px;">⏱️ Next Game</p>
                        <p style="font-size: 1.5rem; font-weight: bold; color: #00D4FF; margin-bottom: 10px;">${awayTeam.team.displayName} @ ${homeTeam.team.displayName}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📍 ${competition.venue?.fullName || 'TBD'}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📅 ${gameDate.toLocaleDateString()} at ${gameDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                        <p style="font-size: 1rem; margin-bottom: 15px;">📺 ${competition.broadcasts?.[0]?.names?.[0] || 'TBD'}</p>
                        <p style="font-size: 1.3rem; font-weight: bold; color: #00D4FF; background: rgba(0,212,255,0.2); padding: 15px; border-radius: 10px; border: 2px solid rgba(0,212,255,0.5);">
                            🏒 ${countdown}
                        </p>
                        <p style="font-size: 0.9rem; margin-top: 15px; opacity: 0.8;">Current standings shown below 👇</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching next game info:', error);
        }
    }

    getCountdown(targetDate) {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) return 'Starting soon!';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else {
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
    }

    getTeamConference(teamId) {
        // Eastern Conference NHL teams (team IDs)
        const easternTeams = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 17, 22];
        // Western Conference NHL teams
        const westernTeams = [16, 18, 19, 20, 21, 23, 24, 25, 26, 28, 29, 30, 52, 53, 54, 55];
        
        const id = parseInt(teamId);
        if (easternTeams.includes(id)) return 'Eastern';
        if (westernTeams.includes(id)) return 'Western';
        return 'Unknown';
    }

    getTeamStanding(teamId, conference) {
        if (!this.standings || !conference) return null;
        
        const confKey = conference.toLowerCase();
        const confStandings = this.standings[confKey === 'eastern' ? 'eastern' : 'western'];
        
        if (!confStandings) return null;
        
        const teamIndex = confStandings.findIndex(t => t.id === parseInt(teamId));
        if (teamIndex === -1) return null;
        
        return {
            ...confStandings[teamIndex],
            seed: teamIndex + 1,
            conference: conference,
            inPlayoffs: teamIndex < 8 // Top 8 in each conference make playoffs
        };
    }

    calculateChampionshipPath(teamId, conference) {
        const standing = this.getTeamStanding(teamId, conference);
        if (!standing) return null;

        const seed = standing.seed;
        const gamesRemaining = 82 - standing.gamesPlayed;
        const path = [];
        const scenarios = [];

        // Determine playoff status (top 8 per conference make playoffs)
        if (seed <= 8) {
            scenarios.push(`✅ Currently in playoff position (#${seed} in ${conference})`);
            if (seed <= 3) {
                scenarios.push(`🏆 Division leader - Home ice advantage!`);
            }
        } else {
            scenarios.push(`❌ Currently outside playoffs (Ranked #${seed} in ${conference})`);
            scenarios.push(`📈 Need to reach top 8 to make playoffs`);
        }

        scenarios.push(`📅 ${gamesRemaining} game(s) remaining in regular season`);
        scenarios.push(`📊 ${standing.points} points (${standing.wins}W-${standing.losses}L-${standing.otLosses}OT)`);

        // Path to Stanley Cup
        if (seed <= 8) {
            path.push('1️⃣ Win First Round (4 wins) - Best of 7');
            path.push('2️⃣ Win Second Round (4 wins) - Best of 7');
            path.push('3️⃣ Win Conference Finals (4 wins) - Best of 7');
            path.push('🏆 Win Stanley Cup Finals (4 wins) - Best of 7');
            scenarios.push(`🎯 Total wins needed: 16 playoff wins`);
        } else {
            path.push(`Must finish in top 8 of ${conference} Conference`);
            path.push(`Currently ${seed - 8} spot(s) out of playoffs`);
        }

        return {
            seed,
            inPlayoffs: seed <= 8,
            scenarios,
            path,
            points: standing.points
        };
    }

    renderGameList(games) {
        const gameList = document.getElementById('game-list');
        gameList.innerHTML = '';

        games.forEach((game, index) => {
            const card = this.createGameCard(game);
            card.style.animation = `slideInUp 0.6s ease-out ${index * 0.1}s both`;
            gameList.appendChild(card);
        });
        
        this.renderStandingsDetails();
    }
    
    renderStandingsDetails() {
        const detailsContainer = document.getElementById('standings-details');
        if (!detailsContainer) return;
        
        if (!this.standings || (this.standings.eastern.length === 0 && this.standings.western.length === 0)) {
            detailsContainer.innerHTML = '';
            return;
        }
        
        detailsContainer.innerHTML = `
            <div class="conference-standings">
                ${this.renderConferenceStandings('Eastern', this.standings.eastern)}
                ${this.renderConferenceStandings('Western', this.standings.western)}
            </div>
            <div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; max-width: 1000px; margin: 0 auto;">
                <div style="font-size: 1.1rem; font-weight: bold; color: #00D4FF; margin-bottom: 10px;">
                    🏒 NHL Playoffs Format
                </div>
                <div style="font-size: 0.95rem; line-height: 1.8; opacity: 0.9;">
                    <strong>Regular Season:</strong> 82 games to accumulate points (2 for win, 1 for OT loss)<br>
                    <strong>Playoffs:</strong> Top 8 teams per conference qualify<br>
                    <strong>Seeding:</strong> Division leaders get top 3 seeds, wild cards fill 4-8<br>
                    <strong>Format:</strong> Four rounds of best-of-7 series<br>
                    <strong>Championship:</strong> Win 16 playoff games = Stanley Cup Champion! 🏆
                </div>
            </div>
        `;
    }

    renderConferenceStandings(conferenceName, teams) {
        if (teams.length === 0) return '';
        
        const confClass = conferenceName.toLowerCase() + '-conference';
        
        return `
            <div class="standings-section ${confClass}">
                <h3>🏒 ${conferenceName} Conference</h3>
                <div class="standings-table">
                    <div class="table-header">
                        <div>Rank</div>
                        <div>Team</div>
                        <div>Record</div>
                        <div>Points</div>
                    </div>
                    ${teams.slice(0, 16).map((team, index) => `
                        <div class="table-row ${index < 8 ? 'playoff-team' : ''}">
                            <div>${index + 1}</div>
                            <div style="display: flex; align-items: center;">
                                ${team.logo ? `<img src="${team.logo}" class="mini-logo" alt="${team.name}">` : ''}
                                ${team.name}
                            </div>
                            <div>${team.wins}-${team.losses}-${team.otLosses}</div>
                            <div style="font-weight: bold; color: #00D4FF;">${team.points}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 10px; font-size: 0.85rem; opacity: 0.8;">
                    Top 8 teams qualify for Stanley Cup Playoffs
                </div>
            </div>
        `;
    }

    createGameCard(game) {
        const card = document.createElement('div');
        
        const awayConf = game.awayTeam.conference;
        const homeConf = game.homeTeam.conference;
        
        let conferenceClass = '';
        if (awayConf && homeConf && awayConf !== homeConf) {
            conferenceClass = 'inter-conference-card';
        } else if (awayConf === 'Eastern' || homeConf === 'Eastern') {
            conferenceClass = 'eastern-card';
        } else if (awayConf === 'Western' || homeConf === 'Western') {
            conferenceClass = 'western-card';
        }
        
        card.className = `game-card ${conferenceClass}`;
        card.dataset.gameId = game.id;

        const statusClass = game.isLive ? 'live' : '';
        const statusText = game.isLive ? '🔴 LIVE' : game.status;

        // Get seed rankings
        const awayStanding = this.getTeamStanding(game.awayTeam.id, game.awayTeam.conference);
        const homeStanding = this.getTeamStanding(game.homeTeam.id, game.homeTeam.conference);

        // Countdown for scheduled games
        let countdownHTML = '';
        if (game.isPregame) {
            const countdown = this.getCountdown(game.date);
            countdownHTML = `<div class="countdown">⏱️ ${countdown}</div>`;
        }

        // Period info for live games
        let periodInfo = '';
        if (game.isLive && game.period) {
            const periodNames = ['', '1st', '2nd', '3rd', 'OT', '2OT', '3OT'];
            periodInfo = `<div class="period-info">${periodNames[game.period] || game.period} Period - ${game.clock}</div>`;
        }

        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            ${periodInfo}
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name}</div>
                    <div class="team-record">${game.awayTeam.record}</div>
                    <div class="team-conference">${game.awayTeam.conference} Conference</div>
                    ${awayStanding ? `<div class="team-seed-badge ${awayStanding.inPlayoffs ? 'in-playoffs' : 'out-playoffs'}">#${awayStanding.seed} • ${awayStanding.points} pts</div>` : ''}
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name}</div>
                    <div class="team-record">${game.homeTeam.record}</div>
                    <div class="team-conference">${game.homeTeam.conference} Conference</div>
                    ${homeStanding ? `<div class="team-seed-badge ${homeStanding.inPlayoffs ? 'in-playoffs' : 'out-playoffs'}">#${homeStanding.seed} • ${homeStanding.points} pts</div>` : ''}
                    <div class="team-score">${game.homeTeam.score}</div>
                </div>
            </div>
            <div class="game-info">
                <div><strong>${game.statusDetail}</strong></div>
                <div>📍 ${game.venue}</div>
                <div>📺 ${game.broadcast}</div>
                <div>📅 ${game.date.toLocaleDateString()} ${game.date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
            </div>
        `;

        card.addEventListener('click', () => this.toggleGameSelection(game.id, card));
        
        card.addEventListener('dblclick', (e) => {
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

        const selectionScreen = document.getElementById('selection-screen');
        const liveScreen = document.getElementById('live-screen');
        
        selectionScreen.classList.remove('active');
        liveScreen.classList.add('active');

        this.renderLivePanels();
        this.startAutoUpdate();
    }

    showSelectionScreen() {
        document.getElementById('live-screen').classList.remove('active');
        document.getElementById('selection-screen').classList.add('active');

        this.stopAutoUpdate();
    }

    renderLivePanels() {
        const panelsContainer = document.getElementById('game-panels');
        panelsContainer.innerHTML = '';
        
        panelsContainer.className = `game-panels panels-${this.selectedGames.size}`;

        const selectedGameData = this.allGames.filter(game => this.selectedGames.has(game.id));

        selectedGameData.forEach(game => {
            const panel = this.createGamePanel(game);
            panelsContainer.appendChild(panel);
        });
    }

    createGamePanel(game) {
        const panel = document.createElement('div');
        
        const awayConf = game.awayTeam.conference;
        const homeConf = game.homeTeam.conference;
        
        let conferenceClass = '';
        if (awayConf && homeConf && awayConf !== homeConf) {
            conferenceClass = 'inter-conference-panel';
        } else if (awayConf === 'Eastern' || homeConf === 'Eastern') {
            conferenceClass = 'eastern-panel';
        } else if (awayConf === 'Western' || homeConf === 'Western') {
            conferenceClass = 'western-panel';
        }
        
        panel.className = `game-panel ${conferenceClass}`;
        panel.dataset.gameId = game.id;

        const statusText = game.isLive ? '🔴 LIVE' : game.status;

        // Get championship paths for both teams
        const awayPath = this.calculateChampionshipPath(game.awayTeam.id, game.awayTeam.conference);
        const homePath = this.calculateChampionshipPath(game.homeTeam.id, game.homeTeam.conference);

        let leadersHTML = '';
        if (game.leaders && game.leaders.length > 0) {
            leadersHTML = `
                <div class="stats-section">
                    <h4>Game Leaders</h4>
                    ${game.leaders.slice(0, 3).map(leader => {
                        const topPlayer = leader.leaders?.[0];
                        if (!topPlayer) return '';
                        return `
                            <div class="stat-row">
                                <div class="stat-label">${leader.displayName}</div>
                                <div class="stat-value">${topPlayer.athlete?.displayName || 'N/A'}: ${topPlayer.displayValue || 'N/A'}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Championship path HTML
        let championshipHTML = '';
        if (awayPath || homePath) {
            championshipHTML = `
                <div class="stats-section" style="background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(100,181,246,0.2)); border: 2px solid rgba(0,212,255,0.4);">
                    <h4>🏆 Path to Stanley Cup</h4>
                    ${awayPath ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-weight: bold; color: #00D4FF; margin-bottom: 8px;">${game.awayTeam.name}</div>
                            ${awayPath.scenarios.map(s => `<div style="margin: 4px 0; font-size: 0.9rem;">${s}</div>`).join('')}
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-weight: bold; margin-bottom: 6px;">Championship Path:</div>
                                ${awayPath.path.map(p => `<div style="margin: 3px 0; font-size: 0.85rem; padding-left: 10px;">${p}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${homePath ? `
                        <div>
                            <div style="font-weight: bold; color: #64B5F6; margin-bottom: 8px;">${game.homeTeam.name}</div>
                            ${homePath.scenarios.map(s => `<div style="margin: 4px 0; font-size: 0.9rem;">${s}</div>`).join('')}
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-weight: bold; margin-bottom: 6px;">Championship Path:</div>
                                ${homePath.path.map(p => `<div style="margin: 3px 0; font-size: 0.85rem; padding-left: 10px;">${p}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Period info for live games
        let periodInfo = '';
        if (game.isLive && game.period) {
            const periodNames = ['', '1st', '2nd', '3rd', 'OT', '2OT', '3OT'];
            periodInfo = `<div class="period-display">${periodNames[game.period] || game.period} Period - ${game.clock}</div>`;
        }

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                ${periodInfo}
                <div class="panel-matchup">
                    <div class="panel-team">
                        <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.awayTeam.name}</div>
                        <div class="panel-team-record">${game.awayTeam.record}</div>
                        ${awayPath ? `<div style="font-size: 0.8rem; opacity: 0.9; margin: 4px 0;">#${awayPath.seed} • ${awayPath.points} pts</div>` : ''}
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.homeTeam.name}</div>
                        <div class="panel-team-record">${game.homeTeam.record}</div>
                        ${homePath ? `<div style="font-size: 0.8rem; opacity: 0.9; margin: 4px 0;">#${homePath.seed} • ${homePath.points} pts</div>` : ''}
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
                ${championshipHTML}
                ${leadersHTML}
                <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-top: 15px;">
                    <div style="font-size: 0.9rem; opacity: 0.8;">
                        🏒 ${game.awayTeam.conference} vs ${game.homeTeam.conference}<br>
                        ${game.venue}
                    </div>
                </div>
            </div>
        `;

        return panel;
    }

    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.updateLiveData();
        }, 30000); // Update every 30 seconds
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateLiveData() {
        try {
            const games = await this.fetchNHLGames();
            this.allGames = games;
            this.renderLivePanels();
        } catch (error) {
            console.error('Error updating live data:', error);
        }
    }
}

// Initialize the tracker when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NHLGameTracker();
    });
} else {
    // DOM already loaded
    new NHLGameTracker();
}
