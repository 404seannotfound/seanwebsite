// NBA Live Game Tracker Application

class NBAGameTracker {
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
                this.fetchNBAGames(),
                this.fetchNBAStandings()
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

    async fetchNBAGames() {
        try {
            // Using ESPN's public API for NBA scores
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
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
                    leaders: competition.leaders || []
                };
            });
        } catch (error) {
            console.error('Error fetching NBA games:', error);
            throw error;
        }
    }

    async fetchNBAStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
            const data = await response.json();
            
            const standings = {
                eastern: [],
                western: []
            };

            if (data.children) {
                data.children.forEach(conference => {
                    const confName = conference.abbreviation?.toLowerCase();
                    
                    if (confName === 'east' || confName === 'eastern') {
                        if (conference.standings?.entries) {
                            standings.eastern = this.processStandingsEntries(conference.standings.entries);
                        }
                    } else if (confName === 'west' || confName === 'western') {
                        if (conference.standings?.entries) {
                            standings.western = this.processStandingsEntries(conference.standings.entries);
                        }
                    }
                });
            }

            return standings;
        } catch (error) {
            console.error('Error fetching NBA standings:', error);
            return { eastern: [], western: [] };
        }
    }

    processStandingsEntries(entries) {
        const teams = entries.map(entry => {
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
                winPercent: stats.winPercent || 0,
                gamesPlayed: stats.gamesPlayed || 0,
                streak: stats.streak || 0,
                pointsFor: stats.pointsFor || 0,
                pointsAgainst: stats.pointsAgainst || 0,
                rank: stats.rank || entry.position || 99,
                inPlayoffs: (stats.rank || entry.position || 99) <= 10
            };
        });

        // Sort by win percentage (descending), then by wins (descending)
        teams.sort((a, b) => {
            if (b.winPercent !== a.winPercent) {
                return b.winPercent - a.winPercent;
            }
            return b.wins - a.wins;
        });

        return teams;
    }

    async showNextGameInfo() {
        try {
            // Fetch upcoming games
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
            
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`);
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
                        <p style="font-size: 1.5rem; font-weight: bold; color: #FF9800; margin-bottom: 10px;">${awayTeam.team.displayName} @ ${homeTeam.team.displayName}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📍 ${competition.venue?.fullName || 'TBD'}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📅 ${gameDate.toLocaleDateString()} at ${gameDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                        <p style="font-size: 1rem; margin-bottom: 15px;">📺 ${competition.broadcasts?.[0]?.names?.[0] || 'TBD'}</p>
                        <p style="font-size: 1.3rem; font-weight: bold; color: #FF9800; background: rgba(255,152,0,0.2); padding: 15px; border-radius: 10px; border: 2px solid rgba(255,152,0,0.5);">
                            🏀 ${countdown}
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
        // Eastern Conference team IDs
        const easternTeams = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 20, 27];
        // Western Conference team IDs  
        const westernTeams = [12, 13, 14, 15, 18, 19, 21, 22, 23, 24, 25, 26, 28, 29, 30];
        
        if (easternTeams.includes(parseInt(teamId))) return 'Eastern';
        if (westernTeams.includes(parseInt(teamId))) return 'Western';
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
            conference: conference
        };
    }

    calculateChampionshipPath(teamId, conference) {
        const standing = this.getTeamStanding(teamId, conference);
        if (!standing) return null;

        const seed = standing.seed;
        const gamesRemaining = 82 - standing.gamesPlayed;
        const path = [];
        const scenarios = [];

        // Determine playoff status
        if (seed <= 6) {
            scenarios.push(`✅ Currently in playoff position (#${seed} seed)`);
            scenarios.push(`🎯 Direct playoff berth - no play-in needed!`);
        } else if (seed <= 10) {
            scenarios.push(`⚠️ Currently in play-in position (#${seed} seed)`);
            scenarios.push(`🎲 Must win play-in game(s) to make playoffs`);
        } else {
            scenarios.push(`❌ Currently outside playoffs (Ranked #${seed} in ${conference})`);
            scenarios.push(`📈 Need to reach top 10 to make play-in tournament`);
        }

        scenarios.push(`📅 ${gamesRemaining} game(s) remaining in regular season`);

        // Path to championship
        if (seed <= 10) {
            if (seed >= 7 && seed <= 10) {
                // Play-in teams
                if (seed === 7 || seed === 8) {
                    path.push('🎲 Win 1 play-in game (7 vs 8 winner gets #7 seed)');
                } else {
                    path.push('🎲 Win 2 play-in games (9/10 winner plays 7/8 loser)');
                }
            }
            
            // Playoff rounds
            path.push('1️⃣ Win First Round (4 wins) - Best of 7');
            path.push('2️⃣ Win Conference Semifinals (4 wins) - Best of 7');
            path.push('3️⃣ Win Conference Finals (4 wins) - Best of 7');
            path.push('🏆 Win NBA Finals (4 wins) - Best of 7');
            
            const totalWinsNeeded = seed >= 7 ? (seed >= 9 ? 18 : 17) : 16;
            scenarios.push(`🎯 Total wins needed: ${totalWinsNeeded} (${seed >= 9 ? '2 play-in + ' : seed >= 7 ? '1 play-in + ' : ''}16 playoff wins)`);
        } else {
            path.push(`Must finish in top 10 of ${conference} Conference`);
            path.push(`Currently ${seed - 10} spot(s) away from play-in`);
        }

        return {
            seed,
            inPlayoffs: seed <= 10,
            directPlayoff: seed <= 6,
            scenarios,
            path
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
                <div style="font-size: 1.1rem; font-weight: bold; color: #FF9800; margin-bottom: 10px;">
                    🏀 NBA Playoffs Format
                </div>
                <div style="font-size: 0.95rem; line-height: 1.8; opacity: 0.9;">
                    <strong>Regular Season:</strong> 82 games to determine playoff seeding<br>
                    <strong>Playoffs:</strong> Top 10 teams per conference compete<br>
                    <strong>Play-In Tournament:</strong> Seeds 7-10 battle for final playoff spots<br>
                    <strong>Playoffs:</strong> Seeds 1-6 automatically advance, 7-8 from play-in<br>
                    <strong>Championship:</strong> Win 4 rounds = NBA Finals Champion! 🏆
                </div>
            </div>
        `;
    }

    renderConferenceStandings(conferenceName, teams) {
        if (teams.length === 0) return '';
        
        const confClass = conferenceName.toLowerCase() + '-conference';
        
        return `
            <div class="standings-section ${confClass}">
                <h3>🏀 ${conferenceName} Conference</h3>
                <div class="standings-table">
                    <div class="table-header">
                        <div>Rank</div>
                        <div>Team</div>
                        <div>Record</div>
                        <div>Win %</div>
                    </div>
                    ${teams.slice(0, 15).map((team, index) => `
                        <div class="table-row ${team.inPlayoffs ? 'playoff-team' : ''}">
                            <div>${index + 1}</div>
                            <div style="display: flex; align-items: center;">
                                ${team.logo ? `<img src="${team.logo}" class="mini-logo" alt="${team.name}">` : ''}
                                ${team.name}
                            </div>
                            <div>${team.wins}-${team.losses}</div>
                            <div>${(team.winPercent * 100).toFixed(1)}%</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 10px; font-size: 0.85rem; opacity: 0.8;">
                    Top 6 teams make playoffs directly, 7-10 compete in play-in tournament
                </div>
            </div>
        `;
    }

    createGameCard(game) {
        const card = document.createElement('div');
        
        // Determine conference for card color
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

        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name}</div>
                    <div class="team-record">${game.awayTeam.record}</div>
                    <div class="team-conference">${game.awayTeam.conference} Conference</div>
                    ${awayStanding ? `<div class="team-seed-badge ${awayStanding.seed <= 10 ? 'in-playoffs' : 'out-playoffs'}">Seed: #${awayStanding.seed}</div>` : ''}
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name}</div>
                    <div class="team-record">${game.homeTeam.record}</div>
                    <div class="team-conference">${game.homeTeam.conference} Conference</div>
                    ${homeStanding ? `<div class="team-seed-badge ${homeStanding.seed <= 10 ? 'in-playoffs' : 'out-playoffs'}">Seed: #${homeStanding.seed}</div>` : ''}
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
                <div class="stats-section" style="background: linear-gradient(135deg, rgba(255,152,0,0.2), rgba(33,150,243,0.2)); border: 2px solid rgba(255,152,0,0.4);">
                    <h4>🏆 Path to NBA Championship</h4>
                    ${awayPath ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-weight: bold; color: #FFB74D; margin-bottom: 8px;">${game.awayTeam.name}</div>
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

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                <div class="panel-matchup">
                    <div class="panel-team">
                        <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.awayTeam.name}</div>
                        <div class="panel-team-record">${game.awayTeam.record}</div>
                        ${awayPath ? `<div style="font-size: 0.8rem; opacity: 0.9; margin: 4px 0;">Seed: #${awayPath.seed}</div>` : ''}
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.homeTeam.name}</div>
                        <div class="panel-team-record">${game.homeTeam.record}</div>
                        ${homePath ? `<div style="font-size: 0.8rem; opacity: 0.9; margin: 4px 0;">Seed: #${homePath.seed}</div>` : ''}
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
                        🏀 ${game.awayTeam.conference} vs ${game.homeTeam.conference}<br>
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
            const games = await this.fetchNBAGames();
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
        new NBAGameTracker();
    });
} else {
    // DOM already loaded
    new NBAGameTracker();
}
