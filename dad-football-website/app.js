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
            console.log('Loaded standings:', standings);

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

    async fetchTeamHistory(team1Id, team2Id) {
        try {
            // Fetch head-to-head history
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team1Id}/record?vs=${team2Id}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching team history:', error);
            return null;
        }
    }

    async fetchNFLStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings');
            const data = await response.json();
            console.log('Raw standings API response:', data);
            
            const standings = {
                afc: { divisions: {}, playoffPicture: [] },
                nfc: { divisions: {}, playoffPicture: [] }
            };

            // Process standings by conference and division
            if (data.children) {
                console.log('Found children:', data.children.length);
                data.children.forEach(conference => {
                    console.log('Conference:', conference.abbreviation);
                    const confName = conference.abbreviation?.toLowerCase(); // 'afc' or 'nfc'
                    
                    if (!confName || (confName !== 'afc' && confName !== 'nfc')) {
                        console.log('Skipping non-conference:', confName);
                        return;
                    }
                    
                    // Try to get standings directly from conference first
                    if (conference.standings?.entries) {
                        console.log('Found conference-level standings with', conference.standings.entries.length, 'teams');
                        // Group teams by division
                        conference.standings.entries.forEach(entry => {
                            const team = entry.team;
                            const stats = {};
                            entry.stats.forEach(stat => {
                                stats[stat.name] = stat.value;
                            });
                            
                            // Try to determine division from team data
                            const divName = `${confName.toUpperCase()} Division`;
                            
                            if (!standings[confName].divisions[divName]) {
                                standings[confName].divisions[divName] = [];
                            }
                            
                            standings[confName].divisions[divName].push({
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
                    } else if (conference.children) {
                        console.log('Found division children:', conference.children.length);
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
            
            console.log('Final standings:', standings);
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

        // Path to Super Bowl with detailed explanation
        const pathToSuperBowl = [];
        const playoffExplanation = [];
        
        if (teamRankInConf <= 7) {
            // Determine specific playoff path based on seed
            if (teamRankInConf === 1) {
                playoffExplanation.push('🎯 #1 Seed = BYE WEEK (skip Wild Card, rest & home field)');
                pathToSuperBowl.push('✓ SKIP Wild Card Round (automatic bye)');
                pathToSuperBowl.push('1️⃣ Win Divisional Round at HOME');
                pathToSuperBowl.push('2️⃣ Win Conference Championship at HOME');
            } else if (teamRankInConf === 2) {
                playoffExplanation.push('🎯 #2 Seed = BYE WEEK (skip Wild Card, rest & home field)');
                pathToSuperBowl.push('✓ SKIP Wild Card Round (automatic bye)');
                pathToSuperBowl.push('1️⃣ Win Divisional Round at HOME');
                pathToSuperBowl.push('2️⃣ Win Conference Championship (likely at #1 seed)');
            } else if (teamRankInConf <= 4) {
                playoffExplanation.push('🎯 Division Winner = Home game in Wild Card');
                pathToSuperBowl.push('1️⃣ Win Wild Card Round at HOME');
                pathToSuperBowl.push('2️⃣ Win Divisional Round (likely away at #1 or #2 seed)');
                pathToSuperBowl.push('3️⃣ Win Conference Championship');
            } else {
                playoffExplanation.push('🎯 Wild Card Team = Must win on the road');
                pathToSuperBowl.push('1️⃣ Win Wild Card Round AWAY (at #3 or #4 seed)');
                pathToSuperBowl.push('2️⃣ Win Divisional Round AWAY (at #1 or #2 seed)');
                pathToSuperBowl.push('3️⃣ Win Conference Championship');
            }
            pathToSuperBowl.push('🏆 Win SUPER BOWL LIX (neutral site)');
            
            // Add specific opponents they'd likely face
            const nextOpponents = this.getPlayoffOpponents(teamRankInConf, allConfTeams);
            if (nextOpponents.length > 0) {
                playoffExplanation.push(`📋 Likely opponents: ${nextOpponents.join(', ')}`);
            }
        } else {
            playoffExplanation.push('⚠️ NOT CURRENTLY IN PLAYOFFS');
            playoffExplanation.push(`Must finish in top 7 of ${conf.toUpperCase()} (currently #${teamRankInConf})`);
            
            // Show who they need to beat
            const teamsAhead = allConfTeams.slice(6, teamRankInConf).map(t => t.abbreviation);
            if (teamsAhead.length > 0) {
                pathToSuperBowl.push(`Must pass: ${teamsAhead.join(', ')}`);
            }
            pathToSuperBowl.push(`Need ${Math.min(gamesRemaining, teamRankInConf - 7)} more wins (and help from losses above)`);
        }

        return {
            currentSeed: teamRankInConf,
            inPlayoffs: teamRankInConf <= 7,
            scenarios,
            pathToSuperBowl,
            playoffExplanation,
            gamesRemaining
        };
    }

    getPlayoffOpponents(seed, confTeams) {
        const opponents = [];
        
        if (seed === 1 || seed === 2) {
            // Bye week teams face lowest remaining seed in divisional
            opponents.push('Lowest remaining Wild Card winner');
        } else if (seed === 3) {
            opponents.push(`#6 seed (${confTeams[5]?.abbreviation || 'TBD'})`);
        } else if (seed === 4) {
            opponents.push(`#5 seed (${confTeams[4]?.abbreviation || 'TBD'})`);
        } else if (seed === 5) {
            opponents.push(`#4 seed (${confTeams[3]?.abbreviation || 'TBD'})`);
        } else if (seed === 6) {
            opponents.push(`#3 seed (${confTeams[2]?.abbreviation || 'TBD'})`);
        } else if (seed === 7) {
            opponents.push(`#2 seed (${confTeams[1]?.abbreviation || 'TBD'})`);
        }
        
        return opponents;
    }

    renderGameList(games) {
        const gameList = document.getElementById('game-list');
        gameList.innerHTML = '';

        games.forEach((game, index) => {
            const card = this.createGameCard(game);
            card.style.animation = `slideInUp 0.6s ease-out ${index * 0.1}s both`;
            gameList.appendChild(card);
        });
        
        // Render standings details below
        this.renderStandingsDetails();
    }
    
    renderStandingsDetails() {
        const detailsContainer = document.getElementById('standings-details');
        if (!detailsContainer) return;
        
        if (!this.standings) {
            detailsContainer.innerHTML = '';
            return;
        }
        
        // Render both conferences
        detailsContainer.innerHTML = `
            <div class="conference-standings">
                ${this.renderFullStandingsTable('AFC')}
                ${this.renderFullStandingsTable('NFC')}
            </div>
            <div class="playoff-explainer-main">
                <div class="explainer-header">📚 How NFL Playoffs Work:</div>
                <div class="explainer-content">
                    <strong>Regular Season:</strong> 17 games to determine playoff seeding<br>
                    <strong>Playoffs:</strong> 7 teams per conference (AFC & NFC) make it<br>
                    <strong>Seeds #1-2:</strong> Get BYE week (skip Wild Card, rest up!)<br>
                    <strong>Seeds #3-4:</strong> Division winners, host Wild Card games<br>
                    <strong>Seeds #5-7:</strong> Wild Card teams, play on the road<br>
                    <strong>Total Games to Win:</strong> 3 games (or 4 for Wild Card teams) = Super Bowl!
                </div>
            </div>
        `;
    }

    createGameCard(game) {
        const card = document.createElement('div');
        
        // Get team standings first to determine conference
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        // Determine conference for card color
        const conference = awayStanding?.conference || homeStanding?.conference || '';
        const conferenceClass = conference === 'AFC' ? 'afc-card' : conference === 'NFC' ? 'nfc-card' : '';
        
        card.className = `game-card ${conferenceClass}`;
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
        
        // Get playoff scenarios for seed ranking
        const awayPlayoff = this.calculatePlayoffScenario(game.awayTeam.id);
        const homePlayoff = this.calculatePlayoffScenario(game.homeTeam.id);
        
        // Calculate game impact
        const gameImpact = this.calculateGameImpact(awayPlayoff, homePlayoff);
        
        // Format odds
        const awayOddsHTML = game.awayTeam.odds ? `<div class="team-odds">${this.formatOdds(game.awayTeam.odds)}</div>` : '';
        const homeOddsHTML = game.homeTeam.odds ? `<div class="team-odds">${this.formatOdds(game.homeTeam.odds)}</div>` : '';
        
        // Format seed ranking
        const awaySeedHTML = awayPlayoff ? `<div class="team-seed-badge ${awayPlayoff.inPlayoffs ? 'in-playoffs' : 'out-playoffs'}">Seed: #${awayPlayoff.currentSeed} ${awayPlayoff.inPlayoffs ? '✓' : '✗'}</div>` : '';
        const homeSeedHTML = homePlayoff ? `<div class="team-seed-badge ${homePlayoff.inPlayoffs ? 'in-playoffs' : 'out-playoffs'}">Seed: #${homePlayoff.currentSeed} ${homePlayoff.inPlayoffs ? '✓' : '✗'}</div>` : '';

        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            ${gameImpact}
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name}</div>
                    <div class="team-record">${game.awayTeam.record}</div>
                    ${awayStanding ? `<div class="team-division">${awayStanding.division}</div>` : ''}
                    ${awaySeedHTML}
                    ${awayOddsHTML}
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name}</div>
                    <div class="team-record">${game.homeTeam.record}</div>
                    ${homeStanding ? `<div class="team-division">${homeStanding.division}</div>` : ''}
                    ${homeSeedHTML}
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
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        // Determine conference for panel color
        const conference = awayStanding?.conference || homeStanding?.conference || '';
        const conferenceClass = conference === 'AFC' ? 'afc-panel' : conference === 'NFC' ? 'nfc-panel' : '';
        
        panel.className = `game-panel ${conferenceClass}`;
        panel.dataset.gameId = game.id;

        const statusText = game.isLive ? '🔴 LIVE' : game.status;
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
                ${this.renderMatchupHistory(game)}
                ${this.renderFullStandingsTable(awayStanding?.conference)}
                ${this.renderTeamStandings(awayStanding, homeStanding)}
                ${this.renderPlayoffScenarios(game.awayTeam.name, awayPlayoff, game.homeTeam.name, homePlayoff)}
                ${this.renderPanelLinks(game)}
            </div>
        `;

        return panel;
    }

    renderMatchupHistory(game) {
        // Generate fun facts based on available game data
        const funFacts = [];
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        // Home field advantage fact
        if (homeStanding) {
            funFacts.push(`🏟️ <strong>Home Field:</strong> ${game.homeTeam.name} playing at ${game.venue}`);
        }
        
        // Record comparison
        if (awayStanding && homeStanding) {
            const awayWinPct = (awayStanding.winPercent * 100).toFixed(1);
            const homeWinPct = (homeStanding.winPercent * 100).toFixed(1);
            funFacts.push(`📊 <strong>Win %:</strong> ${game.awayTeam.shortName} (${awayWinPct}%) vs ${game.homeTeam.shortName} (${homeWinPct}%)`);
            
            // Points comparison
            const awayPPG = (awayStanding.pointsFor / awayStanding.gamesPlayed).toFixed(1);
            const homePPG = (homeStanding.pointsFor / homeStanding.gamesPlayed).toFixed(1);
            funFacts.push(`⚡ <strong>Avg Points:</strong> ${game.awayTeam.shortName} (${awayPPG}/game) vs ${game.homeTeam.shortName} (${homePPG}/game)`);
            
            // Defense comparison
            const awayPAG = (awayStanding.pointsAgainst / awayStanding.gamesPlayed).toFixed(1);
            const homePAG = (homeStanding.pointsAgainst / homeStanding.gamesPlayed).toFixed(1);
            funFacts.push(`🛡️ <strong>Defense:</strong> ${game.awayTeam.shortName} allows ${awayPAG}/game vs ${game.homeTeam.shortName} allows ${homePAG}/game`);
        }
        
        // Division rivalry
        if (awayStanding && homeStanding && awayStanding.division === homeStanding.division) {
            funFacts.push(`🔥 <strong>Division Rivalry!</strong> Both teams in ${awayStanding.division}`);
        }
        
        // Conference matchup
        if (awayStanding && homeStanding) {
            if (awayStanding.conference !== homeStanding.conference) {
                funFacts.push(`🌟 <strong>Inter-Conference:</strong> ${awayStanding.conference} vs ${homeStanding.conference} matchup`);
            }
        }
        
        // Playoff implications
        const awayPlayoff = this.calculatePlayoffScenario(game.awayTeam.id);
        const homePlayoff = this.calculatePlayoffScenario(game.homeTeam.id);
        
        if (awayPlayoff && homePlayoff) {
            if (awayPlayoff.inPlayoffs && homePlayoff.inPlayoffs) {
                funFacts.push(`🏆 <strong>Playoff Clash:</strong> Both teams currently in playoff position!`);
            }
            
            if (awayPlayoff.currentSeed <= 2 || homePlayoff.currentSeed <= 2) {
                funFacts.push(`🎯 <strong>BYE Week Battle:</strong> Top seed(s) fighting for first-round bye!`);
            }
        }
        
        if (funFacts.length === 0) {
            return '';
        }
        
        // Generate sample historical matchup data (in a real app, this would come from API)
        const historicalGames = this.generateSampleHistory(game.awayTeam.shortName, game.homeTeam.shortName);
        
        return `
            <div class="matchup-history">
                <h3>📈 Matchup Insights & Fun Facts</h3>
                <div class="fun-facts">
                    ${funFacts.map(fact => `<div class="fun-fact">${fact}</div>`).join('')}
                </div>
                ${this.renderHistoricalChart(historicalGames, game.awayTeam, game.homeTeam)}
            </div>
        `;
    }

    generateSampleHistory(awayTeam, homeTeam) {
        // Generate realistic sample data (in production, fetch from API)
        const currentYear = new Date().getFullYear();
        const games = [];
        
        // Generate 5 recent matchups
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const awayScore = Math.floor(Math.random() * 21) + 10; // 10-30 points
            const homeScore = Math.floor(Math.random() * 21) + 10;
            const location = Math.random() > 0.5 ? 'Home' : 'Away';
            
            games.push({
                year,
                awayScore,
                homeScore,
                winner: awayScore > homeScore ? awayTeam : homeTeam,
                location
            });
        }
        
        return games.reverse(); // Oldest to newest
    }
    
    renderHistoricalChart(games, awayTeam, homeTeam) {
        if (!games || games.length === 0) return '';
        
        const maxScore = Math.max(...games.flatMap(g => [g.awayScore, g.homeScore]));
        
        // Calculate head-to-head record
        const awayWins = games.filter(g => g.winner === awayTeam.shortName).length;
        const homeWins = games.filter(g => g.winner === homeTeam.shortName).length;
        
        return `
            <div class="historical-chart">
                <h4>📊 Recent Matchup History (Last ${games.length} Games)</h4>
                <div class="head-to-head-record">
                    <span class="record-item away-record">${awayTeam.shortName}: ${awayWins} wins</span>
                    <span class="record-divider">|</span>
                    <span class="record-item home-record">${homeTeam.shortName}: ${homeWins} wins</span>
                </div>
                <div class="chart-container">
                    ${games.map(game => `
                        <div class="game-bar-group">
                            <div class="game-year">${game.year}</div>
                            <div class="score-bars">
                                <div class="score-bar-wrapper away-bar-wrapper">
                                    <div class="team-label">${awayTeam.shortName}</div>
                                    <div class="score-bar away-bar ${game.winner === awayTeam.shortName ? 'winner-bar' : ''}" 
                                         style="width: ${(game.awayScore / maxScore) * 100}%">
                                        <span class="score-value">${game.awayScore}</span>
                                    </div>
                                </div>
                                <div class="score-bar-wrapper home-bar-wrapper">
                                    <div class="team-label">${homeTeam.shortName}</div>
                                    <div class="score-bar home-bar ${game.winner === homeTeam.shortName ? 'winner-bar' : ''}" 
                                         style="width: ${(game.homeScore / maxScore) * 100}%">
                                        <span class="score-value">${game.homeScore}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="chart-note">
                    💡 <em>Sample data shown - Real historical data integration coming soon!</em>
                </div>
            </div>
        `;
    }

    renderFullStandingsTable(conference) {
        if (!this.standings || !conference) {
            console.log('No standings or conference:', this.standings, conference);
            return '';
        }
        
        const conf = conference.toLowerCase();
        
        if (!this.standings[conf] || !this.standings[conf].divisions) {
            console.log('Conference not found:', conf, this.standings);
            return '';
        }
        
        const allConfTeams = [];
        
        // Get all teams in this conference
        for (const divName in this.standings[conf].divisions) {
            const teams = this.standings[conf].divisions[divName];
            if (Array.isArray(teams)) {
                allConfTeams.push(...teams);
            }
        }
        
        if (allConfTeams.length === 0) {
            console.log('No teams found for conference:', conf);
            return '';
        }
        
        // Sort by playoff seed
        allConfTeams.sort((a, b) => {
            if (b.winPercent !== a.winPercent) return b.winPercent - a.winPercent;
            return b.wins - a.wins;
        });
        
        const conferenceClass = conf === 'afc' ? 'afc-conference' : 'nfc-conference';
        
        return `
            <div class="full-standings-section ${conferenceClass}">
                <h3>🏆 ${conference} Conference Playoff Seeding</h3>
                <div class="standings-table">
                    <div class="table-header">
                        <div class="col-seed">Seed</div>
                        <div class="col-team">Team</div>
                        <div class="col-record">Record</div>
                        <div class="col-division">Division</div>
                        <div class="col-status">Status</div>
                    </div>
                    ${allConfTeams.map((team, index) => {
                        const seed = index + 1;
                        const inPlayoffs = seed <= 7;
                        const statusClass = inPlayoffs ? 'playoff-team' : 'eliminated';
                        const statusText = inPlayoffs ? (seed <= 2 ? '🎯 BYE' : seed <= 4 ? '🏠 HOME' : '✈️ AWAY') : '❌ OUT';
                        const seedBadge = seed <= 2 ? 'bye-seed' : seed <= 4 ? 'home-seed' : seed <= 7 ? 'wild-seed' : 'out-seed';
                        
                        return `
                            <div class="table-row ${statusClass}">
                                <div class="col-seed"><span class="seed-badge ${seedBadge}">#${seed}</span></div>
                                <div class="col-team">
                                    <img src="${team.logo}" alt="${team.abbreviation}" class="mini-logo">
                                    <strong>${team.abbreviation}</strong>
                                </div>
                                <div class="col-record">${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}</div>
                                <div class="col-division">${team.name.split(' ').slice(-2).join(' ')}</div>
                                <div class="col-status">${statusText}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="standings-legend">
                    <span><strong>🎯 BYE:</strong> Skip Wild Card</span>
                    <span><strong>🏠 HOME:</strong> Host playoff game</span>
                    <span><strong>✈️ AWAY:</strong> Wild Card team</span>
                    <span><strong>❌ OUT:</strong> Not in playoffs</span>
                </div>
            </div>
        `;
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
                <h3>🏆 Path to Super Bowl Explained</h3>
                <div class="playoff-explainer">
                    <div class="explainer-header">📚 How NFL Playoffs Work:</div>
                    <div class="explainer-content">
                        <strong>Regular Season:</strong> 17 games to determine playoff seeding<br>
                        <strong>Playoffs:</strong> 7 teams per conference (AFC & NFC) make it<br>
                        <strong>Seeds #1-2:</strong> Get BYE week (skip Wild Card, rest up!)<br>
                        <strong>Seeds #3-4:</strong> Division winners, host Wild Card games<br>
                        <strong>Seeds #5-7:</strong> Wild Card teams, play on the road<br>
                        <strong>Total Games to Win:</strong> 3 games (or 4 for Wild Card teams) = Super Bowl!
                    </div>
                </div>
                <div class="playoff-grid">
                    ${awayPlayoff ? `
                        <div class="team-playoff">
                            <h4>${awayTeamName}</h4>
                            <div class="playoff-status">
                                ${awayPlayoff.scenarios.map(s => `<div class="scenario">${s}</div>`).join('')}
                            </div>
                            ${awayPlayoff.playoffExplanation ? `
                                <div class="playoff-explanation">
                                    ${awayPlayoff.playoffExplanation.map(exp => `<div class="explanation-item">${exp}</div>`).join('')}
                                </div>
                            ` : ''}
                            <div class="playoff-path">
                                <strong>Exact Path to Super Bowl:</strong>
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
                            ${homePlayoff.playoffExplanation ? `
                                <div class="playoff-explanation">
                                    ${homePlayoff.playoffExplanation.map(exp => `<div class="explanation-item">${exp}</div>`).join('')}
                                </div>
                            ` : ''}
                            <div class="playoff-path">
                                <strong>Exact Path to Super Bowl:</strong>
                                ${homePlayoff.pathToSuperBowl.map(step => `<div class="path-step">${step}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    calculateGameImpact(awayPlayoff, homePlayoff) {
        if (!awayPlayoff || !homePlayoff) return '';
        
        const awayInPlayoffs = awayPlayoff.inPlayoffs;
        const homeInPlayoffs = homePlayoff.inPlayoffs;
        const awayGamesRemaining = awayPlayoff.gamesRemaining;
        const homeGamesRemaining = homePlayoff.gamesRemaining;
        
        // Both teams eliminated
        if (!awayInPlayoffs && !homeInPlayoffs && awayGamesRemaining < 3 && homeGamesRemaining < 3) {
            return '<div class="game-impact no-impact">⚪ No playoff impact - Both teams eliminated</div>';
        }
        
        // Both teams locked in playoffs with high seeds
        if (awayInPlayoffs && homeInPlayoffs && awayPlayoff.currentSeed <= 2 && homePlayoff.currentSeed <= 2) {
            return '<div class="game-impact high-impact">🔥 HUGE IMPACT - BYE week on the line!</div>';
        }
        
        // One team fighting for playoffs
        if ((awayInPlayoffs && awayPlayoff.currentSeed >= 6) || (homeInPlayoffs && homePlayoff.currentSeed >= 6)) {
            return '<div class="game-impact high-impact">🚨 HIGH IMPACT - Playoff spot at risk!</div>';
        }
        
        // One team out, one team in
        if (!awayInPlayoffs && homeInPlayoffs) {
            return '<div class="game-impact medium-impact">⚡ MEDIUM IMPACT - Could affect seeding</div>';
        }
        
        if (awayInPlayoffs && !homeInPlayoffs) {
            return '<div class="game-impact medium-impact">⚡ MEDIUM IMPACT - Could affect seeding</div>';
        }
        
        // Both in playoffs, fighting for position
        if (awayInPlayoffs && homeInPlayoffs) {
            const seedDiff = Math.abs(awayPlayoff.currentSeed - homePlayoff.currentSeed);
            if (seedDiff <= 2) {
                return '<div class="game-impact high-impact">🔥 HIGH IMPACT - Seeding battle!</div>';
            }
            return '<div class="game-impact medium-impact">⚡ MEDIUM IMPACT - Could shift seeds</div>';
        }
        
        // Default - some impact
        return '<div class="game-impact low-impact">📊 LOW IMPACT - Minor seeding effect</div>';
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
            return `💰 ${ml > 0 ? '+' : ''}${ml}`;
        }
        
        // Handle spread
        if (odds.spreadOdds) {
            const spread = odds.spreadOdds;
            return `💰 ${spread > 0 ? '+' : ''}${spread}`;
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
