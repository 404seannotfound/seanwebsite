// College Football Live Game Tracker Application

class CollegeGameTracker {
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
                this.fetchCollegeGames(),
                this.fetchCollegeStandings()
            ]);
            this.allGames = games;
            this.standings = standings;
            
            loading.style.display = 'none';
            
            if (games.length === 0) {
                noGames.style.display = 'block';
            } else {
                this.renderGameList(games);
            }
            
            this.renderStandingsDetails();
        } catch (error) {
            console.error('Error loading college games:', error);
            loading.style.display = 'none';
            noGames.style.display = 'block';
            noGames.querySelector('p').textContent = 'Error loading games. Please try again later.';
        }
    }

    async fetchCollegeGames() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard');
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                return [];
            }
            
            return data.events.map(event => {
                const competition = event.competitions[0];
                const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
                const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
                
                // Extract detailed stats
                const homeStats = this.extractTeamStats(homeTeam);
                const awayStats = this.extractTeamStats(awayTeam);
                
                // Extract situation/drive info
                const situation = competition.situation || {};
                
                // Extract leaders
                const leaders = competition.leaders || [];
                
                // Extract scoring summary
                const scoringPlays = competition.details?.scoringPlays || [];
                
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
                    period: competition.status.period || 0,
                    clock: competition.status.displayClock || '',
                    homeTeam: {
                        id: homeTeam.team.id,
                        name: homeTeam.team.displayName,
                        shortName: homeTeam.team.abbreviation,
                        score: homeTeam.score,
                        logo: homeTeam.team.logo,
                        record: homeTeam.records?.[0]?.summary || 'N/A',
                        rank: homeTeam.curatedRank?.current || null,
                        linescores: homeTeam.linescores || [],
                        timeouts: homeTeam.timeouts || 0,
                        possession: homeTeam.possession || false,
                        stats: homeStats
                    },
                    awayTeam: {
                        id: awayTeam.team.id,
                        name: awayTeam.team.displayName,
                        shortName: awayTeam.team.abbreviation,
                        score: awayTeam.score,
                        logo: awayTeam.team.logo,
                        record: awayTeam.records?.[0]?.summary || 'N/A',
                        rank: awayTeam.curatedRank?.current || null,
                        linescores: awayTeam.linescores || [],
                        timeouts: awayTeam.timeouts || 0,
                        possession: awayTeam.possession || false,
                        stats: awayStats
                    },
                    situation: {
                        down: situation.down || null,
                        distance: situation.distance || null,
                        yardLine: situation.yardLine || null,
                        possessionText: situation.possessionText || '',
                        downDistanceText: situation.downDistanceText || ''
                    },
                    leaders: leaders,
                    scoringPlays: scoringPlays,
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    links: event.links || []
                };
            });
        } catch (error) {
            console.error('Error fetching college games:', error);
            throw error;
        }
    }

    extractTeamStats(teamData) {
        const stats = {};
        if (teamData.statistics) {
            teamData.statistics.forEach(stat => {
                stats[stat.name] = stat.displayValue || stat.value || '0';
            });
        }
        return stats;
    }

    async fetchCollegeStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/football/college-football/standings');
            const data = await response.json();
            
            const standings = {};
            
            if (data.children) {
                data.children.forEach(group => {
                    // Each child is typically a conference (e.g., SEC, Big Ten, Pac-12)
                    const confName = group.name || group.abbreviation || 'Other';
                    const teams = [];
                    
                    if (group.standings?.entries) {
                        group.standings.entries.forEach(entry => {
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
                                rank: stats.rank || entry.position || 99
                            });
                        });
                    }
                    
                    if (teams.length > 0) {
                        teams.sort((a, b) => {
                            if (b.winPercent !== a.winPercent) return b.winPercent - a.winPercent;
                            return b.wins - a.wins;
                        });
                        standings[confName] = teams;
                    }
                });
            }
            
            return standings;
        } catch (error) {
            console.error('Error fetching college standings:', error);
            return {};
        }
    }

    getTeamStanding(teamId) {
        if (!this.standings) return null;
        
        for (const confName in this.standings) {
            const team = this.standings[confName].find(t => String(t.id) === String(teamId));
            if (team) {
                return { ...team, conference: confName };
            }
        }
        return null;
    }

    calculateChampionshipPath(teamId) {
        const standing = this.getTeamStanding(teamId);
        if (!standing) return null;
        
        const gamesPlayed = standing.gamesPlayed || 0;
        const gamesRemaining = Math.max(0, 12 - gamesPlayed);
        const rank = standing.rank || 99;
        
        const scenarios = [];
        const pathToTitle = [];
        
        if (rank <= 4) {
            scenarios.push(`✅ In College Football Playoff range (#${rank} nationally)`);
        } else if (rank <= 12) {
            scenarios.push(`⚠️ In New Years Six / expanded playoff conversation (#${rank})`);
        } else {
            scenarios.push(`❌ Outside top playoff range (#${rank})`);
        }
        
        scenarios.push(`📅 Approx. ${gamesRemaining} regular season game(s) left`);
        
        pathToTitle.push('1️⃣ Win remaining regular season games');
        pathToTitle.push('2️⃣ Win conference championship game');
        pathToTitle.push('3️⃣ Earn selection into College Football Playoff / New Years Six');
        pathToTitle.push('4️⃣ Win semifinal bowl');
        pathToTitle.push('5️⃣ Win National Championship Game');
        
        return {
            rank,
            scenarios,
            pathToTitle
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
        
        let countdownHTML = '';
        if (game.isPregame) {
            const countdown = this.getCountdown(game.date);
            if (countdown) {
                countdownHTML = `<div class="countdown">⏱️ ${countdown}</div>`;
            }
        }
        
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        const awayRankHTML = game.awayTeam.rank ? `<div class="team-seed-badge in-playoffs">Ranked #${game.awayTeam.rank}</div>` : '';
        const homeRankHTML = game.homeTeam.rank ? `<div class="team-seed-badge in-playoffs">Ranked #${game.homeTeam.rank}</div>` : '';
        
        // Quick stats for live games
        let quickStatsHTML = '';
        if (game.isLive && (game.awayTeam.stats || game.homeTeam.stats)) {
            const awayYards = game.awayTeam.stats?.totalYards || '0';
            const homeYards = game.homeTeam.stats?.totalYards || '0';
            quickStatsHTML = `
                <div style="display: flex; justify-content: space-around; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-top: 10px; font-size: 0.85rem;">
                    <div><strong>${awayYards}</strong> Total Yds</div>
                    <div>|</div>
                    <div><strong>${homeYards}</strong> Total Yds</div>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            ${game.isLive && game.situation.downDistanceText ? `<div style="text-align: center; font-size: 0.9rem; color: #FFD700; margin: 5px 0;">${game.situation.downDistanceText}</div>` : ''}
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name} ${game.awayTeam.possession ? '🏈' : ''}</div>
                    <div class="team-record">${game.awayTeam.record}</div>
                    ${awayStanding ? `<div class="team-division">${awayStanding.conference}</div>` : ''}
                    ${awayRankHTML}
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name} ${game.homeTeam.possession ? '🏈' : ''}</div>
                    <div class="team-record">${game.homeTeam.record}</div>
                    ${homeStanding ? `<div class="team-division">${homeStanding.conference}</div>` : ''}
                    ${homeRankHTML}
                    <div class="team-score">${game.homeTeam.score}</div>
                </div>
            </div>
            ${quickStatsHTML}
            <div class="game-info">
                <div>${game.statusDetail}</div>
                <div>📍 ${game.venue}</div>
                <div>📺 ${game.broadcast}</div>
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
        if (watchBtn) {
            watchBtn.style.display = this.selectedGames.size > 0 ? 'block' : 'none';
        }
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

    async renderLivePanels() {
        const panelsContainer = document.getElementById('game-panels');
        panelsContainer.innerHTML = '';
        
        panelsContainer.className = `game-panels panels-${this.selectedGames.size}`;
        
        const selectedGameData = this.allGames.filter(game => this.selectedGames.has(game.id));
        
        // Fetch detailed stats for each selected game
        for (const game of selectedGameData) {
            await this.fetchGameDetails(game);
            const panel = this.createGamePanel(game);
            panelsContainer.appendChild(panel);
        }
    }

    async fetchGameDetails(game) {
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${game.id}`);
            const data = await response.json();
            
            if (data.boxscore?.teams) {
                data.boxscore.teams.forEach(teamData => {
                    const isHome = teamData.homeAway === 'home';
                    const teamKey = isHome ? 'homeTeam' : 'awayTeam';
                    
                    // Extract detailed stats
                    const stats = {};
                    if (teamData.statistics) {
                        teamData.statistics.forEach(stat => {
                            stats[stat.name] = stat.displayValue || stat.value || '0';
                        });
                    }
                    
                    game[teamKey].stats = stats;
                });
            }
        } catch (error) {
            console.error(`Error fetching details for game ${game.id}:`, error);
        }
    }

    createGamePanel(game) {
        const panel = document.createElement('div');
        panel.className = 'game-panel';
        panel.dataset.gameId = game.id;
        
        const statusText = game.isLive ? '🔴 LIVE' : game.status;
        
        const awayStanding = this.getTeamStanding(game.awayTeam.id);
        const homeStanding = this.getTeamStanding(game.homeTeam.id);
        
        const awayPath = this.calculateChampionshipPath(game.awayTeam.id);
        const homePath = this.calculateChampionshipPath(game.homeTeam.id);
        
        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                ${this.renderGameSituation(game)}
                <div class="panel-matchup">
                    <div class="panel-team">
                        <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.awayTeam.name} ${game.awayTeam.possession ? '🏈' : ''}</div>
                        <div class="panel-team-record">${game.awayTeam.record}</div>
                        ${awayStanding ? `<div class="panel-team-division">${awayStanding.conference}</div>` : ''}
                        ${game.awayTeam.rank ? `<div class="panel-team-seed">Ranked #${game.awayTeam.rank}</div>` : ''}
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                        ${this.renderQuarterScores(game.awayTeam.linescores)}
                        ${game.awayTeam.timeouts !== null && game.awayTeam.timeouts !== undefined ? `<div style="font-size: 0.8rem; margin-top: 5px;">⏱️ Timeouts: ${game.awayTeam.timeouts}</div>` : ''}
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.homeTeam.name} ${game.homeTeam.possession ? '🏈' : ''}</div>
                        <div class="panel-team-record">${game.homeTeam.record}</div>
                        ${homeStanding ? `<div class="panel-team-division">${homeStanding.conference}</div>` : ''}
                        ${game.homeTeam.rank ? `<div class="panel-team-seed">Ranked #${game.homeTeam.rank}</div>` : ''}
                        <div class="panel-team-score">${game.homeTeam.score}</div>
                        ${this.renderQuarterScores(game.homeTeam.linescores)}
                        ${game.homeTeam.timeouts !== null && game.homeTeam.timeouts !== undefined ? `<div style="font-size: 0.8rem; margin-top: 5px;">⏱️ Timeouts: ${game.homeTeam.timeouts}</div>` : ''}
                    </div>
                </div>
                <div class="panel-info">
                    <div><strong>${game.statusDetail}</strong></div>
                    <div>📍 ${game.venue}</div>
                    <div>📺 ${game.broadcast}</div>
                </div>
            </div>
            <div class="panel-details">
                ${this.renderGameLeaders(game)}
                ${this.renderTeamStats(game)}
                ${this.renderChampionshipSection(game, awayPath, homePath)}
                ${this.renderPanelLinks(game)}
            </div>
        `;
        
        return panel;
    }

    renderGameSituation(game) {
        if (!game.isLive || !game.situation.downDistanceText) return '';
        
        return `
            <div style="text-align: center; padding: 10px; background: rgba(255,193,7,0.2); border-radius: 8px; margin: 10px 0;">
                <div style="font-weight: bold; color: #FFD700; font-size: 1.1rem;">
                    ${game.situation.downDistanceText}
                </div>
                ${game.situation.possessionText ? `<div style="font-size: 0.9rem; margin-top: 4px;">${game.situation.possessionText}</div>` : ''}
            </div>
        `;
    }

    renderQuarterScores(linescores) {
        if (!linescores || linescores.length === 0) return '';
        
        const quarters = linescores.map((score, idx) => 
            `<span style="margin: 0 4px;">${idx + 1}Q: ${score.value || 0}</span>`
        ).join('');
        
        return `<div style="font-size: 0.85rem; margin-top: 5px; opacity: 0.9;">${quarters}</div>`;
    }

    renderGameLeaders(game) {
        if (!game.leaders || game.leaders.length === 0) return '';
        
        const leadersHTML = game.leaders.slice(0, 3).map(category => {
            const leader = category.leaders?.[0];
            if (!leader) return '';
            
            const athlete = leader.athlete;
            const displayValue = leader.displayValue || '';
            const jersey = athlete?.jersey || '';
            const position = athlete?.position?.abbreviation || '';
            
            // Determine which team the player is on and set color
            let teamName = '';
            let teamColor = '#FFD700'; // default gold
            let isHome = false;
            
            if (athlete?.team?.id) {
                if (String(athlete.team.id) === String(game.homeTeam.id)) {
                    teamName = game.homeTeam.shortName;
                    teamColor = '#81C784'; // green for home
                    isHome = true;
                } else if (String(athlete.team.id) === String(game.awayTeam.id)) {
                    teamName = game.awayTeam.shortName;
                    teamColor = '#64B5F6'; // blue for away
                    isHome = false;
                }
            }
            
            return `
                <div style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; margin: 5px 0; border-left: 4px solid ${teamColor};">
                    <div style="font-weight: bold; color: #FFD700; font-size: 0.9rem; margin-bottom: 4px;">${category.displayName}</div>
                    <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                        <span style="background: ${teamColor}; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">
                            ${teamName}${jersey ? ` #${jersey}` : ''}
                        </span>
                        <span style="color: ${teamColor}; font-weight: bold;">
                            ${athlete?.displayName || 'N/A'}${position ? ` (${position})` : ''}
                        </span>
                    </div>
                    <div style="font-size: 0.85rem; margin-top: 4px; opacity: 0.95;">
                        ${displayValue}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="standings-section" style="margin-bottom: 20px;">
                <h3>🏆 Game Leaders</h3>
                ${leadersHTML}
            </div>
        `;
    }

    renderTeamStats(game) {
        const awayStats = game.awayTeam.stats || {};
        const homeStats = game.homeTeam.stats || {};
        
        if (Object.keys(awayStats).length === 0 && Object.keys(homeStats).length === 0) {
            return '';
        }
        
        const statCategories = [
            { key: 'totalYards', label: 'Total Yards' },
            { key: 'passingYards', label: 'Passing Yards' },
            { key: 'rushingYards', label: 'Rushing Yards' },
            { key: 'yardsPerPlay', label: 'Yards/Play' },
            { key: 'firstDowns', label: 'First Downs' },
            { key: 'thirdDownEff', label: '3rd Down' },
            { key: 'fourthDownEff', label: '4th Down' },
            { key: 'turnovers', label: 'Turnovers' },
            { key: 'possessionTime', label: 'Time of Possession' },
            { key: 'totalPenaltiesYards', label: 'Penalties-Yards' }
        ];
        
        const statsRows = statCategories.map(cat => {
            const awayVal = awayStats[cat.key] || '-';
            const homeVal = homeStats[cat.key] || '-';
            
            return `
                <div class="table-row">
                    <div style="text-align: right; padding: 8px;">${awayVal}</div>
                    <div style="text-align: center; padding: 8px; font-weight: bold;">${cat.label}</div>
                    <div style="text-align: left; padding: 8px;">${homeVal}</div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="standings-section" style="margin-bottom: 20px;">
                <h3>📊 Team Stats Comparison</h3>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;">
                    <div class="table-header" style="display: grid; grid-template-columns: 1fr 2fr 1fr; background: rgba(76,175,80,0.3);">
                        <div style="text-align: center; padding: 10px;">${game.awayTeam.shortName}</div>
                        <div style="text-align: center; padding: 10px;">Stat</div>
                        <div style="text-align: center; padding: 10px;">${game.homeTeam.shortName}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr;">
                        ${statsRows}
                    </div>
                </div>
            </div>
        `;
    }

    renderChampionshipSection(game, awayPath, homePath) {
        if (!awayPath && !homePath) return '';
        
        return `
            <div class="playoff-section">
                <h3>🏆 Path to College Football Championship</h3>
                <div class="playoff-grid">
                    ${awayPath ? `
                        <div class="team-playoff">
                            <h4>${game.awayTeam.name}</h4>
                            <div class="playoff-status">
                                ${awayPath.scenarios.map(s => `<div class="scenario">${s}</div>`).join('')}
                            </div>
                            <div class="playoff-path">
                                <strong>Path:</strong>
                                ${awayPath.pathToTitle.map(step => `<div class="path-step">${step}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${homePath ? `
                        <div class="team-playoff">
                            <h4>${game.homeTeam.name}</h4>
                            <div class="playoff-status">
                                ${homePath.scenarios.map(s => `<div class="scenario">${s}</div>`).join('')}
                            </div>
                            <div class="playoff-path">
                                <strong>Path:</strong>
                                ${homePath.pathToTitle.map(step => `<div class="path-step">${step}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPanelLinks(game) {
        if (!game.links || game.links.length === 0) {
            return '<p>No additional links available</p>';
        }
        
        const linksHTML = game.links
            .filter(link => link.href)
            .map(link => {
                const linkText = link.text || 'View Details';
                return `
                    <a href="${link.href}" target="_blank" class="panel-link enhanced-link">
                        <div class="link-icon">🔗</div>
                        <div class="link-content">
                            <div class="link-title">${linkText}</div>
                            <div class="link-description">Additional game information and details</div>
                            <div class="link-highlight">✨ Click to explore</div>
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

    renderStandingsDetails() {
        const detailsContainer = document.getElementById('standings-details');
        if (!detailsContainer || !this.standings) return;
        
        const focusConfs = ['Pac-12', 'SEC', 'Big Ten', 'ACC', 'Big 12'];
        
        const sections = focusConfs
            .filter(conf => this.standings[conf])
            .map(conf => this.renderConferenceStandings(conf, this.standings[conf]))
            .join('');
        
        if (!sections) {
            detailsContainer.innerHTML = '';
            return;
        }
        
        detailsContainer.innerHTML = `
            <div class="conference-standings">
                ${sections}
            </div>
            <div class="playoff-explainer-main">
                <div class="explainer-header">📚 How College Football Championship Works (Simplified):</div>
                <div class="explainer-content">
                    <strong>Regular Season:</strong> Win games and rise in conference & national rankings<br>
                    <strong>Conference Titles:</strong> Winning your conference is huge for playoff chances<br>
                    <strong>Playoff / Bowls:</strong> Top teams are selected for the College Football Playoff & major bowls<br>
                    <strong>Championship:</strong> Win your semifinal bowl, then win the National Championship Game 🏆
                </div>
            </div>
        `;
    }

    renderConferenceStandings(confName, teams) {
        if (!teams || teams.length === 0) return '';
        
        return `
            <div class="full-standings-section">
                <h3>🏈 ${confName} Standings</h3>
                <div class="standings-table">
                    <div class="table-header">
                        <div class="col-seed">Rank</div>
                        <div class="col-team">Team</div>
                        <div class="col-record">Record</div>
                        <div class="col-division">Points For/Against</div>
                        <div class="col-status">Nat. Rank</div>
                    </div>
                    ${teams.map((team, index) => `
                        <div class="table-row ${team.rank <= 25 ? 'playoff-team' : ''}">
                            <div class="col-seed">
                                <span class="seed-badge ${team.rank <= 10 ? 'bye-seed' : team.rank <= 25 ? 'home-seed' : 'out-seed'}">#${index + 1}</span>
                            </div>
                            <div class="col-team">
                                ${team.logo ? `<img src="${team.logo}" alt="${team.abbreviation}" class="mini-logo">` : ''}
                                <strong>${team.abbreviation}</strong>
                            </div>
                            <div class="col-record">${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}</div>
                            <div class="col-division">${team.pointsFor}/${team.pointsAgainst}</div>
                            <div class="col-status">${team.rank && team.rank < 99 ? `#${team.rank}` : '-'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    startAutoUpdate() {
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
                this.fetchCollegeGames(),
                this.fetchCollegeStandings()
            ]);
            this.allGames = games;
            this.standings = standings;
            
            const selectedGameData = games.filter(game => this.selectedGames.has(game.id));
            
            for (const game of selectedGameData) {
                await this.fetchGameDetails(game);
                const panel = document.querySelector(`.game-panel[data-game-id="${game.id}"]`);
                if (panel) {
                    const newPanel = this.createGamePanel(game);
                    panel.replaceWith(newPanel);
                }
            }
        } catch (error) {
            console.error('Error updating college live panels:', error);
        }
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
}

// Initialize the tracker when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CollegeGameTracker();
    });
} else {
    new CollegeGameTracker();
}
