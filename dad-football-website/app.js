// NFL Live Game Tracker Application

class NFLGameTracker {
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
                console.log('Watch button clicked, selected games:', this.selectedGames.size);
                this.showLiveView();
            });
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Back button clicked');
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
            // Fetch both games and standings
            const [games, standings] = await Promise.all([
                this.fetchNFLGames(),
                this.fetchNFLStandings()
            ]);
            this.allGames = games;
            this.standings = standings;

            loading.style.display = 'none';

            if (games.length === 0) {
                noGames.style.display = 'block';
            } else {
                this.renderGameList(games);
            }
        } catch (error) {
            console.error('Error loading games:', error);
            loading.style.display = 'none';
            noGames.style.display = 'block';
            noGames.querySelector('p').textContent = 'Error loading games. Please try again later.';
        }
    }

    async fetchNFLGames() {
        try {
            // Using ESPN's public API for NFL scores
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                return [];
            }

            // Filter and format games
            return data.events.map(event => {
                const competition = event.competitions[0];
                const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
                const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
                
                // Extract odds if available
                const odds = competition.odds?.[0];
                const homeOdds = odds?.homeTeamOdds;
                const awayOdds = odds?.awayTeamOdds;
                
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
                        odds: homeOdds
                    },
                    awayTeam: {
                        id: awayTeam.team.id,
                        name: awayTeam.team.displayName,
                        shortName: awayTeam.team.abbreviation,
                        score: awayTeam.score,
                        logo: awayTeam.team.logo,
                        record: awayTeam.records?.[0]?.summary || 'N/A',
                        odds: awayOdds
                    },
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    links: event.links || [],
                    odds: odds
                };
            });
        } catch (error) {
            console.error('Error fetching NFL games:', error);
            throw error;
        }
    }

    async fetchNFLStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings');
            const data = await response.json();
            
            const standings = {
                afc: { divisions: {}, playoffPicture: [] },
                nfc: { divisions: {}, playoffPicture: [] }
            };

            // Process standings by conference and division
            if (data.children) {
                data.children.forEach(conference => {
                    const confName = conference.abbreviation.toLowerCase(); // 'afc' or 'nfc'
                    
                    if (conference.children) {
                        conference.children.forEach(division => {
                            const divName = division.name; // e.g., "AFC East"
                            const teams = [];
                            
                            if (division.standings?.entries) {
                                division.standings.entries.forEach(entry => {
                                    const team = entry.team;
                                    const stats = {};
                                    entry.stats.forEach(stat => {
                                        stats[stat.name] = stat.value;
                                    });
                                    
                                    teams.push({
                                        id: team.id,
                                        name: team.displayName,
                                        abbreviation: team.abbreviation,
                                        logo: team.logos?.[0]?.href,
                                        wins: stats.wins || 0,
                                        losses: stats.losses || 0,
                                        ties: stats.ties || 0,
                                        winPercent: stats.winPercent || 0,
                                        gamesPlayed: stats.gamesPlayed || 0,
                                        pointsFor: stats.pointsFor || 0,
                                        pointsAgainst: stats.pointsAgainst || 0,
                                        divisionRank: stats.divisionRank || 0,
                                        playoffSeed: stats.playoffSeed || 0
                                    });
                                });
                            }
                            
                            standings[confName].divisions[divName] = teams;
                        });
                    }
                });
            }

            return standings;
        } catch (error) {
            console.error('Error fetching NFL standings:', error);
            return null;
        }
    }

    getTeamStanding(teamId) {
        if (!this.standings) return null;
        
        for (const conf of ['afc', 'nfc']) {
            for (const divName in this.standings[conf].divisions) {
                const team = this.standings[conf].divisions[divName].find(t => t.id === teamId);
                if (team) {
                    return {
                        ...team,
                        conference: conf.toUpperCase(),
                        division: divName
                    };
                }
            }
        }
        return null;
    }

    calculatePlayoffScenario(teamId) {
        const teamStanding = this.getTeamStanding(teamId);
        if (!teamStanding) return null;

        const conf = teamStanding.conference.toLowerCase();
        const division = teamStanding.division;
        const divisionTeams = this.standings[conf].divisions[division];
        
        // Get all conference teams sorted by playoff seed
        const allConfTeams = [];
        for (const divName in this.standings[conf].divisions) {
            allConfTeams.push(...this.standings[conf].divisions[divName]);
        }
        allConfTeams.sort((a, b) => {
            if (b.winPercent !== a.winPercent) return b.winPercent - a.winPercent;
            return b.wins - a.wins;
        });

        const teamRankInConf = allConfTeams.findIndex(t => t.id === teamId) + 1;
        const divisionLeader = divisionTeams[0];
        const isDivisionLeader = divisionLeader.id === teamId;
        const gamesRemaining = 17 - teamStanding.gamesPlayed;

        // Calculate scenarios
        const scenarios = [];
        
        if (teamRankInConf <= 7) {
            scenarios.push(`✅ Currently in playoff position (#${teamRankInConf} seed)`);
        } else {
            scenarios.push(`❌ Currently outside playoffs (Ranked #${teamRankInConf} in ${conf.toUpperCase()})`);
        }

        if (isDivisionLeader) {
            scenarios.push(`🏆 Leading ${division}`);
        } else {
            const gamesBack = divisionLeader.wins - teamStanding.wins;
            scenarios.push(`📊 ${gamesBack} game(s) behind division leader (${divisionLeader.abbreviation})`);
        }

        if (gamesRemaining > 0) {
            scenarios.push(`📅 ${gamesRemaining} game(s) remaining in regular season`);
        }

        // Path to Super Bowl
        const pathToSuperBowl = [];
        if (teamRankInConf <= 7) {
            pathToSuperBowl.push('1️⃣ Win Wild Card Round');
            pathToSuperBowl.push('2️⃣ Win Divisional Round');
            pathToSuperBowl.push('3️⃣ Win Conference Championship');
            pathToSuperBowl.push('🏆 Super Bowl LIX');
        } else {
            pathToSuperBowl.push('⚠️ Must make playoffs first');
            pathToSuperBowl.push(`Need to be top 7 in ${conf.toUpperCase()} (currently #${teamRankInConf})`);
        }

        return {
            currentSeed: teamRankInConf,
            inPlayoffs: teamRankInConf <= 7,
            scenarios,
            pathToSuperBowl,
            gamesRemaining
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
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

        const statusClass = game.isLive ? 'live' : '';
        const statusText = game.isLive ? '🔴 LIVE' : game.status;
        
        // Calculate countdown for pregame
        let countdownHTML = '';
        if (game.isPregame) {
            const countdown = this.getCountdown(game.date);
            if (countdown) {
                countdownHTML = `<div class="countdown">⏱️ ${countdown}</div>`;
            }
        }

        // Get team standings
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        // Format odds
        const awayOddsHTML = game.awayTeam.odds ? `<div class="team-odds">${this.formatOdds(game.awayTeam.odds)}</div>` : '';
        const homeOddsHTML = game.homeTeam.odds ? `<div class="team-odds">${this.formatOdds(game.homeTeam.odds)}</div>` : '';

        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name}</div>
                    <div class="team-record">${game.awayTeam.record}</div>
                    ${awayStanding ? `<div class="team-division">${awayStanding.division}</div>` : ''}
                    ${awayOddsHTML}
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name}</div>
                    <div class="team-record">${game.homeTeam.record}</div>
                    ${homeStanding ? `<div class="team-division">${homeStanding.division}</div>` : ''}
                    ${homeOddsHTML}
                    <div class="team-score">${game.homeTeam.score}</div>
                </div>
            </div>
            <div class="game-info">
                <div>${game.statusDetail}</div>
                <div>📍 ${game.venue}</div>
                <div>📺 ${game.broadcast}</div>
            </div>
        `;

        // Single click to select/deselect
        card.addEventListener('click', () => this.toggleGameSelection(game.id, card));
        
        // Double click to go straight to detail view
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
            console.log('Deselected game:', gameId);
        } else {
            this.selectedGames.add(gameId);
            card.classList.add('selected');
            console.log('Selected game:', gameId);
        }

        const watchBtn = document.getElementById('watch-btn');
        watchBtn.style.display = this.selectedGames.size > 0 ? 'block' : 'none';
        console.log('Total selected games:', this.selectedGames.size, 'Button visible:', watchBtn.style.display);
    }

    showLiveView() {
        console.log('showLiveView called, selected games:', this.selectedGames.size);
        
        if (this.selectedGames.size === 0) {
            console.log('No games selected, returning');
            return;
        }

        const selectionScreen = document.getElementById('selection-screen');
        const liveScreen = document.getElementById('live-screen');
        
        console.log('Switching screens...');
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
        
        // Set grid layout based on number of selected games
        panelsContainer.className = `game-panels panels-${this.selectedGames.size}`;

        const selectedGameData = this.allGames.filter(game => this.selectedGames.has(game.id));

        selectedGameData.forEach(game => {
            const panel = this.createGamePanel(game);
            panelsContainer.appendChild(panel);
        });

        this.addLastUpdatedIndicator();
    }

    createGamePanel(game) {
        const panel = document.createElement('div');
        panel.className = 'game-panel';
        panel.dataset.gameId = game.id;

        const statusText = game.isLive ? '🔴 LIVE' : game.status;
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        const awayPlayoff = this.calculatePlayoffScenario(game.awayTeam.id);
        const homePlayoff = this.calculatePlayoffScenario(game.homeTeam.id);

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                <div class="panel-matchup">
                    <div class="panel-team">
                        <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.awayTeam.name}</div>
                        <div class="panel-team-record">${game.awayTeam.record}</div>
                        ${awayStanding ? `<div class="panel-team-division">${awayStanding.division}</div>` : ''}
                        ${awayPlayoff ? `<div class="panel-team-seed">Seed: #${awayPlayoff.currentSeed}</div>` : ''}
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.homeTeam.name}</div>
                        <div class="panel-team-record">${game.homeTeam.record}</div>
                        ${homeStanding ? `<div class="panel-team-division">${homeStanding.division}</div>` : ''}
                        ${homePlayoff ? `<div class="panel-team-seed">Seed: #${homePlayoff.currentSeed}</div>` : ''}
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
                ${this.renderTeamStandings(awayStanding, homeStanding)}
                ${this.renderPlayoffScenarios(game.awayTeam.name, awayPlayoff, game.homeTeam.name, homePlayoff)}
                ${this.renderPanelLinks(game)}
            </div>
        `;

        return panel;
    }

    renderTeamStandings(awayStanding, homeStanding) {
        if (!awayStanding && !homeStanding) return '';

        return `
            <div class="standings-section">
                <h3>📊 Team Rankings</h3>
                <div class="standings-grid">
                    ${awayStanding ? `
                        <div class="team-standing">
                            <h4>${awayStanding.name}</h4>
                            <div class="standing-stat"><strong>Record:</strong> ${awayStanding.wins}-${awayStanding.losses}${awayStanding.ties > 0 ? `-${awayStanding.ties}` : ''}</div>
                            <div class="standing-stat"><strong>Conference:</strong> ${awayStanding.conference}</div>
                            <div class="standing-stat"><strong>Division:</strong> ${awayStanding.division}</div>
                            <div class="standing-stat"><strong>Division Rank:</strong> #${awayStanding.divisionRank}</div>
                            <div class="standing-stat"><strong>Points For:</strong> ${awayStanding.pointsFor}</div>
                            <div class="standing-stat"><strong>Points Against:</strong> ${awayStanding.pointsAgainst}</div>
                        </div>
                    ` : ''}
                    ${homeStanding ? `
                        <div class="team-standing">
                            <h4>${homeStanding.name}</h4>
                            <div class="standing-stat"><strong>Record:</strong> ${homeStanding.wins}-${homeStanding.losses}${homeStanding.ties > 0 ? `-${homeStanding.ties}` : ''}</div>
                            <div class="standing-stat"><strong>Conference:</strong> ${homeStanding.conference}</div>
                            <div class="standing-stat"><strong>Division:</strong> ${homeStanding.division}</div>
                            <div class="standing-stat"><strong>Division Rank:</strong> #${homeStanding.divisionRank}</div>
                            <div class="standing-stat"><strong>Points For:</strong> ${homeStanding.pointsFor}</div>
                            <div class="standing-stat"><strong>Points Against:</strong> ${homeStanding.pointsAgainst}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPlayoffScenarios(awayTeamName, awayPlayoff, homeTeamName, homePlayoff) {
        if (!awayPlayoff && !homePlayoff) return '';

        return `
            <div class="playoff-section">
                <h3>🏆 Path to Super Bowl</h3>
                <div class="playoff-grid">
                    ${awayPlayoff ? `
                        <div class="team-playoff">
                            <h4>${awayTeamName}</h4>
                            <div class="playoff-status">
                                ${awayPlayoff.scenarios.map(s => `<div class="scenario">${s}</div>`).join('')}
                            </div>
                            <div class="playoff-path">
                                <strong>Steps to Super Bowl:</strong>
                                ${awayPlayoff.pathToSuperBowl.map(step => `<div class="path-step">${step}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${homePlayoff ? `
                        <div class="team-playoff">
                            <h4>${homeTeamName}</h4>
                            <div class="playoff-status">
                                ${homePlayoff.scenarios.map(s => `<div class="scenario">${s}</div>`).join('')}
                            </div>
                            <div class="playoff-path">
                                <strong>Steps to Super Bowl:</strong>
                                ${homePlayoff.pathToSuperBowl.map(step => `<div class="path-step">${step}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getCountdown(gameDate) {
        const now = new Date();
        const diff = gameDate - now;
        
        if (diff <= 0) return null;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `Starts in ${days}d ${hours}h`;
        } else if (hours > 0) {
            return `Starts in ${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `Starts in ${minutes}m`;
        } else {
            return 'Starting soon!';
        }
    }
    
    formatOdds(odds) {
        if (!odds) return '';
        
        // Handle moneyline odds
        if (odds.moneyLine) {
            const ml = odds.moneyLine;
            return `<span class="odds-label">ML:</span> ${ml > 0 ? '+' : ''}${ml}`;
        }
        
        // Handle spread
        if (odds.spreadOdds) {
            const spread = odds.spreadOdds;
            return `<span class="odds-label">Spread:</span> ${spread > 0 ? '+' : ''}${spread}`;
        }
        
        return '';
    }

    renderPanelLinks(game) {
        if (!game.links || game.links.length === 0) {
            return '<p>No additional links available</p>';
        }

        // Enhanced link descriptions with icons and previews
        const linkDescriptions = {
            'Gamecast': {
                icon: '🎮',
                title: 'Live Gamecast',
                description: 'Play-by-play action, real-time stats, and game flow',
                highlight: 'Interactive game tracker'
            },
            'Play-by-Play': {
                icon: '📋',
                title: 'Detailed Play-by-Play',
                description: 'Every snap, every yard, complete game breakdown',
                highlight: 'Full game timeline'
            },
            'Box Score': {
                icon: '📊',
                title: 'Complete Box Score',
                description: 'Player stats, team totals, and performance metrics',
                highlight: 'All the numbers'
            },
            'Recap': {
                icon: '📰',
                title: 'Game Recap & Highlights',
                description: 'Key moments, turning points, and expert analysis',
                highlight: 'Story of the game'
            },
            'Highlights': {
                icon: '🎬',
                title: 'Video Highlights',
                description: 'Watch the best plays and biggest moments',
                highlight: 'Must-see action'
            },
            'Commentary': {
                icon: '🎙️',
                title: 'Expert Commentary',
                description: 'Analysis and insights from the pros',
                highlight: 'Expert breakdown'
            },
            'Now': {
                icon: '⚡',
                title: 'Live Updates',
                description: 'Real-time scores and instant notifications',
                highlight: 'Stay in the action'
            }
        };

        const linksHTML = game.links
            .filter(link => link.href)
            .map(link => {
                const linkText = link.text || 'View Details';
                const linkInfo = linkDescriptions[linkText] || {
                    icon: '🔗',
                    title: linkText,
                    description: 'Additional game information and details',
                    highlight: 'Click to explore'
                };
                
                return `
                    <a href="${link.href}" target="_blank" class="panel-link enhanced-link">
                        <div class="link-icon">${linkInfo.icon}</div>
                        <div class="link-content">
                            <div class="link-title">${linkInfo.title}</div>
                            <div class="link-description">${linkInfo.description}</div>
                            <div class="link-highlight">✨ ${linkInfo.highlight}</div>
                        </div>
                        <div class="link-arrow">→</div>
                    </a>
                `;
            })
            .join('');

        return `
            <div class="links-section">
                <h3>🔥 Watch More & Dive Deeper</h3>
                <p class="links-subtitle">Click any option below for more game content</p>
                <div class="panel-links">
                    ${linksHTML}
                </div>
            </div>
        `;
    }

    addLastUpdatedIndicator() {
        const panelsContainer = document.getElementById('game-panels');
        const indicator = document.createElement('div');
        indicator.className = 'last-updated';
        indicator.id = 'last-updated';
        indicator.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        panelsContainer.appendChild(indicator);
    }

    startAutoUpdate() {
        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateLivePanels();
        }, 30000);
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateLivePanels() {
        try {
            const [games, standings] = await Promise.all([
                this.fetchNFLGames(),
                this.fetchNFLStandings()
            ]);
            this.allGames = games;
            this.standings = standings;

            const selectedGameData = games.filter(game => this.selectedGames.has(game.id));

            selectedGameData.forEach(game => {
                const panel = document.querySelector(`.game-panel[data-game-id="${game.id}"]`);
                if (panel) {
                    const newPanel = this.createGamePanel(game);
                    panel.replaceWith(newPanel);
                }
            });

            // Update last updated time
            const lastUpdated = document.getElementById('last-updated');
            if (lastUpdated) {
                lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('Error updating live panels:', error);
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NFLGameTracker();
});
