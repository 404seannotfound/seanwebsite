// NASCAR Live Race Tracker Application

class NASCARRaceTracker {
    constructor() {
        this.selectedRaces = new Set();
        this.allRaces = [];
        this.standings = null;
        this.updateInterval = null;
        this.init();
    }

    // Helper function to convert ESPN time (EST/EDT) to local browser time
    toLocalTime(espnDate) {
        const date = new Date(espnDate);
        return date;
    }

    // Helper function to format time in local timezone
    formatLocalTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper function to format date in local timezone
    formatLocalDate(date) {
        return date.toLocaleDateString();
    }

    init() {
        this.setupEventListeners();
        this.loadRaces();
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

    async loadRaces() {
        const loading = document.getElementById('loading');
        const raceList = document.getElementById('race-list');
        const noRaces = document.getElementById('no-races');
        
        loading.style.display = 'block';
        raceList.innerHTML = '';
        noRaces.style.display = 'none';

        try {
            const [races, standings] = await Promise.all([
                this.fetchNASCARRaces(),
                this.fetchNASCARStandings()
            ]);
            this.allRaces = races;
            this.standings = standings;
            
            console.log('NASCAR: Loaded', races.length, 'races and', standings?.length || 0, 'standings entries');

            loading.style.display = 'none';

            // Always render standings
            this.renderStandingsDetails();
            
            if (races.length === 0) {
                noRaces.style.display = 'block';
                // Try to show next upcoming race
                this.showNextRaceInfo();
            } else {
                this.renderRaceList(races);
            }
        } catch (error) {
            console.error('Error loading races:', error);
            loading.style.display = 'none';
            noRaces.style.display = 'block';
            noRaces.querySelector('p').textContent = 'Error loading races. Please try again later.';
        }
    }

    async fetchNASCARRaces() {
        try {
            // Using ESPN's public API for NASCAR
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/racing/nascar/cup/scoreboard');
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                // If no current races, try to fetch recent completed races
                return await this.fetchRecentRaces();
            }

            return data.events.map(event => {
                const competition = event.competitions[0];
                const status = competition.status;
                
                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: this.toLocalTime(new Date(event.date)),
                    status: status.type.description,
                    statusDetail: status.type.detail,
                    isLive: status.type.state === 'in',
                    isCompleted: status.type.completed,
                    isPregame: status.type.state === 'pre',
                    track: competition.venue?.fullName || 'TBD',
                    location: competition.venue?.address?.city + ', ' + competition.venue?.address?.state || 'TBD',
                    laps: competition.laps || 'N/A',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    competitors: competition.competitors?.slice(0, 5).map(comp => ({
                        id: comp.athlete?.id,
                        name: comp.athlete?.displayName || 'Unknown',
                        position: comp.order || 'N/A',
                        status: comp.status || 'N/A'
                    })) || []
                };
            });
        } catch (error) {
            console.error('Error fetching NASCAR races:', error);
            throw error;
        }
    }

    async fetchRecentRaces() {
        try {
            // Fetch completed races from the current season
            const year = new Date().getFullYear();
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/racing/nascar/cup/scoreboard?dates=${year}`);
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                return [];
            }

            // Filter for completed races and get the most recent ones
            const completedRaces = data.events
                .filter(event => event.competitions[0].status.type.completed)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 3); // Get last 3 races

            return completedRaces.map(event => {
                const competition = event.competitions[0];
                const status = competition.status;
                
                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: this.toLocalTime(new Date(event.date)),
                    status: '✅ Completed',
                    statusDetail: status.type.detail,
                    isLive: false,
                    isCompleted: true,
                    isPregame: false,
                    track: competition.venue?.fullName || 'TBD',
                    location: competition.venue?.address?.city + ', ' + competition.venue?.address?.state || 'TBD',
                    laps: competition.laps || 'N/A',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    competitors: competition.competitors?.slice(0, 10).map(comp => ({
                        id: comp.athlete?.id,
                        name: comp.athlete?.displayName || 'Unknown',
                        position: comp.order || 'N/A',
                        status: comp.status || 'N/A'
                    })) || []
                };
            });
        } catch (error) {
            console.error('Error fetching recent races:', error);
            return [];
        }
    }

    async showNextRaceInfo() {
        try {
            const year = new Date().getFullYear();
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/racing/nascar/cup/scoreboard?dates=${year}`);
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) return;

            const now = new Date();
            const upcomingRaces = data.events
                .filter(event => new Date(event.date) > now)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (upcomingRaces.length > 0) {
                const nextRace = upcomingRaces[0];
                const raceDate = this.toLocalTime(new Date(nextRace.date));
                const competition = nextRace.competitions[0];
                
                const noRacesDiv = document.getElementById('no-races');
                const countdown = this.getCountdown(raceDate);
                
                noRacesDiv.innerHTML = `
                    <div style="text-align: center;">
                        <p style="font-size: 1.2rem; margin-bottom: 15px;">⏱️ Next Race</p>
                        <p style="font-size: 1.5rem; font-weight: bold; color: #FFD700; margin-bottom: 10px;">${nextRace.name}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📍 ${competition.venue?.fullName || 'TBD'}</p>
                        <p style="font-size: 1rem; margin-bottom: 8px;">📅 ${this.formatLocalDate(raceDate)} at ${this.formatLocalTime(raceDate)}</p>
                        <p style="font-size: 1rem; margin-bottom: 15px;">📺 ${competition.broadcasts?.[0]?.names?.[0] || 'TBD'}</p>
                        <p style="font-size: 1.3rem; font-weight: bold; color: #FF4500; background: rgba(255,69,0,0.2); padding: 15px; border-radius: 10px; border: 2px solid rgba(255,69,0,0.5);">
                            🏁 ${countdown}
                        </p>
                        <p style="font-size: 0.9rem; margin-top: 15px; opacity: 0.8;">Recent results and standings shown below 👇</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching next race info:', error);
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

    async fetchNASCARStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/v2/sports/racing/nascar/cup/standings');
            const data = await response.json();
            
            console.log('NASCAR Standings API Response:', data);
            
            // Try different possible API structures
            let entries = [];
            
            if (data.standings && data.standings[0] && data.standings[0].entries) {
                entries = data.standings[0].entries;
            } else if (data.entries) {
                entries = data.entries;
            } else if (data.children && data.children[0] && data.children[0].standings) {
                entries = data.children[0].standings.entries || [];
            }
            
            if (entries.length === 0) {
                console.warn('No standings entries found in API response');
                return [];
            }

            const standings = entries.map((entry, index) => {
                const driver = entry.athlete || entry.team;
                const stats = {};
                
                if (entry.stats) {
                    entry.stats.forEach(stat => {
                        stats[stat.name] = stat.value;
                    });
                }

                return {
                    position: entry.position || (index + 1),
                    name: driver?.displayName || driver?.name || 'Unknown Driver',
                    points: stats.points || stats.totalPoints || 0,
                    wins: stats.wins || stats.victories || 0,
                    top5: stats.top5 || stats.top5Finishes || 0,
                    top10: stats.top10 || stats.top10Finishes || 0,
                    poles: stats.poles || stats.poleWins || 0,
                    avgFinish: stats.avgFinish || stats.averageFinish || 0,
                    inPlayoffs: (entry.position || (index + 1)) <= 16
                };
            });

            console.log('Processed NASCAR standings:', standings);
            return standings;
        } catch (error) {
            console.error('Error fetching NASCAR standings:', error);
            return [];
        }
    }

    renderRaceList(races) {
        const raceList = document.getElementById('race-list');
        raceList.innerHTML = '';

        races.forEach((race, index) => {
            const card = this.createRaceCard(race);
            card.style.animation = `slideInUp 0.6s ease-out ${index * 0.1}s both`;
            raceList.appendChild(card);
        });
        
        this.renderStandingsDetails();
    }
    
    renderStandingsDetails() {
        const detailsContainer = document.getElementById('standings-details');
        if (!detailsContainer) {
            console.warn('Standings details container not found');
            return;
        }
        
        if (!this.standings || this.standings.length === 0) {
            console.log('No standings data available');
            detailsContainer.innerHTML = `
                <div class="standings-section">
                    <h3>🏆 NASCAR Cup Series Standings</h3>
                    <div style="text-align: center; padding: 30px; opacity: 0.7;">
                        <p>Standings data not available at this time.</p>
                        <p style="font-size: 0.9rem; margin-top: 10px;">Check back during the racing season!</p>
                    </div>
                </div>
            `;
            return;
        }
        
        console.log('Rendering standings for', this.standings.length, 'drivers');
        
        detailsContainer.innerHTML = `
            <div class="standings-section">
                <h3>🏆 NASCAR Cup Series Standings</h3>
                <div class="standings-table">
                    <div class="table-header">
                        <div>Pos</div>
                        <div>Driver</div>
                        <div>Points</div>
                        <div>Wins</div>
                        <div>Top 5</div>
                        <div>Top 10</div>
                    </div>
                    ${this.standings.slice(0, 20).map((driver, idx) => `
                        <div class="table-row ${driver.inPlayoffs ? 'playoff-driver' : ''}" style="${idx === 0 ? 'background: rgba(255,215,0,0.15);' : ''}">
                            <div style="font-weight: ${idx < 3 ? 'bold' : 'normal'}; color: ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'inherit'};">
                                ${idx === 0 ? '🏆 ' : ''}${driver.position}
                            </div>
                            <div style="font-weight: ${idx < 3 ? 'bold' : 'normal'};">${driver.name}</div>
                            <div>${driver.points}</div>
                            <div>${driver.wins}</div>
                            <div>${driver.top5}</div>
                            <div>${driver.top10}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                    🏁 Top 16 drivers make the playoffs | 🏆 = Points Leader
                </div>
            </div>
        `;
    }

    getDriverStanding(driverName) {
        if (!this.standings || this.standings.length === 0) return null;
        
        const driver = this.standings.find(d => 
            d.name.toLowerCase().includes(driverName.toLowerCase()) ||
            driverName.toLowerCase().includes(d.name.toLowerCase())
        );
        
        return driver;
    }

    calculateChampionshipPath(driverName) {
        const standing = this.getDriverStanding(driverName);
        if (!standing) return null;

        const position = standing.position;
        const points = standing.points;
        const wins = standing.wins;
        const scenarios = [];
        const path = [];

        // Playoff status
        if (position <= 16) {
            scenarios.push(`✅ In playoff position (#${position} in points)`);
            scenarios.push(`🏁 ${points} points | ${wins} win(s) this season`);
            
            if (position === 1) {
                scenarios.push(`🏆 POINTS LEADER - Leading the championship!`);
            } else {
                const leader = this.standings[0];
                const pointsBehind = leader.points - points;
                scenarios.push(`📊 ${pointsBehind} points behind leader (${leader.name})`);
            }

            // Championship path
            if (wins > 0) {
                path.push(`✓ Has ${wins} win(s) - locked into playoffs with victory`);
            }
            path.push(`🏁 Win races to advance through playoff rounds`);
            path.push(`1️⃣ Round of 16 - Top 12 advance`);
            path.push(`2️⃣ Round of 12 - Top 8 advance`);
            path.push(`3️⃣ Round of 8 - Top 4 advance (Championship 4)`);
            path.push(`🏆 Win Championship Race = NASCAR Cup Champion!`);
            
        } else {
            scenarios.push(`❌ Outside playoff cut (#${position} in points)`);
            scenarios.push(`📈 Need to reach top 16 to make playoffs`);
            scenarios.push(`🏁 ${points} points | ${wins} win(s)`);
            
            const cutoff = this.standings[15];
            const pointsNeeded = cutoff.points - points;
            path.push(`Must gain ${pointsNeeded} points to reach playoff cutoff`);
            path.push(`🏁 Win a race = automatic playoff berth!`);
            path.push(`Or finish in top 16 in points by season end`);
        }

        return {
            position,
            points,
            wins,
            inPlayoffs: position <= 16,
            scenarios,
            path
        };
    }

    createRaceCard(race) {
        const card = document.createElement('div');
        card.className = 'race-card';
        card.dataset.raceId = race.id;

        const statusClass = race.isLive ? 'live' : '';
        const statusText = race.isLive ? '🔴 LIVE' : race.status;
        
        let topDriversHTML = '';
        if (race.competitors.length > 0) {
            const headerText = race.isCompleted ? 'Final Results:' : 'Top Positions:';
            const displayCount = race.isCompleted ? 10 : 5;
            topDriversHTML = `
                <div class="driver-info">
                    <div style="font-weight: bold; margin-bottom: 8px;">${headerText}</div>
                    ${race.competitors.slice(0, displayCount).map((comp, idx) => `
                        <div style="margin: 4px 0; display: flex; justify-content: space-between;">
                            <span>
                                <span style="color: ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#FFD700'};">P${comp.position}:</span> 
                                ${comp.name}
                            </span>
                            ${idx === 0 && race.isCompleted ? '<span style="font-size: 1.2rem;">🏆</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="race-status ${statusClass}">${statusText}</div>
            <div class="race-name">${race.name}</div>
            <div class="race-track">📍 ${race.track}</div>
            <div class="race-info">
                <div>${race.statusDetail}</div>
                <div>🏁 Laps: ${race.laps}</div>
                <div>📺 ${race.broadcast}</div>
                <div>📅 ${this.formatLocalDate(race.date)} at ${this.formatLocalTime(race.date)}</div>
            </div>
            ${topDriversHTML}
        `;

        card.addEventListener('click', () => this.toggleRaceSelection(race.id, card));
        
        card.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.selectedRaces.clear();
            document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
            this.selectedRaces.add(race.id);
            card.classList.add('selected');
            this.showLiveView();
        });

        return card;
    }

    toggleRaceSelection(raceId, card) {
        if (this.selectedRaces.has(raceId)) {
            this.selectedRaces.delete(raceId);
            card.classList.remove('selected');
        } else {
            this.selectedRaces.add(raceId);
            card.classList.add('selected');
        }

        const watchBtn = document.getElementById('watch-btn');
        watchBtn.style.display = this.selectedRaces.size > 0 ? 'block' : 'none';
    }

    showLiveView() {
        if (this.selectedRaces.size === 0) return;

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
        const panelsContainer = document.getElementById('race-panels');
        panelsContainer.innerHTML = '';
        
        panelsContainer.className = `race-panels panels-${this.selectedRaces.size}`;

        const selectedRaceData = this.allRaces.filter(race => this.selectedRaces.has(race.id));

        selectedRaceData.forEach(race => {
            const panel = this.createRacePanel(race);
            panelsContainer.appendChild(panel);
        });
    }

    createRacePanel(race) {
        const panel = document.createElement('div');
        panel.className = 'race-panel';
        panel.dataset.raceId = race.id;

        const statusText = race.isLive ? '🔴 LIVE' : race.status;
        
        // Get championship paths for top 3 drivers
        let championshipHTML = '';
        if (race.competitors.length > 0 && this.standings && this.standings.length > 0) {
            const topDrivers = race.competitors.slice(0, 3);
            const paths = topDrivers.map(comp => ({
                driver: comp,
                path: this.calculateChampionshipPath(comp.name)
            })).filter(p => p.path !== null);

            if (paths.length > 0) {
                championshipHTML = `
                    <div class="leaderboard" style="background: linear-gradient(135deg, rgba(255,69,0,0.2), rgba(255,215,0,0.2)); border: 2px solid rgba(255,69,0,0.4); margin-bottom: 15px;">
                        <h4>🏆 Championship Standings</h4>
                        ${paths.map((p, idx) => `
                            <div style="margin-bottom: ${idx < paths.length - 1 ? '15px' : '0'}; padding-bottom: ${idx < paths.length - 1 ? '15px' : '0'}; border-bottom: ${idx < paths.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'};">
                                <div style="font-weight: bold; color: ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32'}; margin-bottom: 6px;">
                                    ${idx === 0 ? '🏆 ' : ''}P${p.driver.position}: ${p.driver.name}
                                </div>
                                ${p.path.scenarios.map(s => `<div style="margin: 3px 0; font-size: 0.85rem; padding-left: 10px;">${s}</div>`).join('')}
                                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 4px;">Path to Championship:</div>
                                    ${p.path.path.map(step => `<div style="margin: 2px 0; font-size: 0.8rem; padding-left: 10px;">${step}</div>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }
        
        let leaderboardHTML = '';
        if (race.competitors.length > 0) {
            const headerText = race.isCompleted ? '🏆 Final Results' : '📊 Current Leaderboard';
            leaderboardHTML = `
                <div class="leaderboard">
                    <h4>${headerText}</h4>
                    ${race.competitors.map((comp, idx) => `
                        <div class="leaderboard-entry" style="${idx < 3 && race.isCompleted ? 'background: rgba(255,215,0,0.1);' : ''}">
                            <div class="position" style="color: ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#FFD700'};">
                                ${idx === 0 && race.isCompleted ? '🏆' : ''} P${comp.position}
                            </div>
                            <div class="driver-name">${comp.name}</div>
                            <div class="laps-info">${comp.status}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="panel-header">
                <div class="race-status">${statusText}</div>
                <div class="panel-race-name">${race.name}</div>
                <div class="panel-race-info">
                    <div>📍 ${race.track}</div>
                    <div>🏁 Laps: ${race.laps}</div>
                    <div>📺 ${race.broadcast}</div>
                    <div>📅 ${race.date.toLocaleDateString()}</div>
                    <div><strong>${race.statusDetail}</strong></div>
                </div>
            </div>
            <div class="panel-details">
                ${championshipHTML}
                ${leaderboardHTML}
                <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-top: 15px;">
                    <div style="font-size: 0.9rem; opacity: 0.8;">
                        🏁 NASCAR Cup Series<br>
                        ${race.location}
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
            const races = await this.fetchNASCARRaces();
            this.allRaces = races;
            this.renderLivePanels();
        } catch (error) {
            console.error('Error updating live data:', error);
        }
    }
}

// Initialize the tracker when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NASCARRaceTracker();
    });
} else {
    // DOM already loaded
    new NASCARRaceTracker();
}
