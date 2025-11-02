// NFL Live Game Tracker Application

class NFLGameTracker {
    constructor() {
        this.selectedGames = new Set();
        this.allGames = [];
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
            // Fetch live NFL games from ESPN API
            const games = await this.fetchNFLGames();
            this.allGames = games;

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
                
                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: new Date(event.date),
                    status: competition.status.type.description,
                    statusDetail: competition.status.type.detail,
                    isLive: competition.status.type.state === 'in',
                    isCompleted: competition.status.type.completed,
                    homeTeam: {
                        name: homeTeam.team.displayName,
                        shortName: homeTeam.team.abbreviation,
                        score: homeTeam.score,
                        logo: homeTeam.team.logo
                    },
                    awayTeam: {
                        name: awayTeam.team.displayName,
                        shortName: awayTeam.team.abbreviation,
                        score: awayTeam.score,
                        logo: awayTeam.team.logo
                    },
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'N/A',
                    links: event.links || []
                };
            });
        } catch (error) {
            console.error('Error fetching NFL games:', error);
            throw error;
        }
    }

    renderGameList(games) {
        const gameList = document.getElementById('game-list');
        gameList.innerHTML = '';

        games.forEach(game => {
            const card = this.createGameCard(game);
            gameList.appendChild(card);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

        const statusClass = game.isLive ? 'live' : '';
        const statusText = game.isLive ? '🔴 LIVE' : game.status;

        card.innerHTML = `
            <div class="game-status ${statusClass}">${statusText}</div>
            <div class="game-matchup">
                <div class="team">
                    <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
                    <div class="team-name">${game.awayTeam.name}</div>
                    <div class="team-score">${game.awayTeam.score}</div>
                </div>
                <div class="vs">@</div>
                <div class="team">
                    <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
                    <div class="team-name">${game.homeTeam.name}</div>
                    <div class="team-score">${game.homeTeam.score}</div>
                </div>
            </div>
            <div class="game-info">
                <div>${game.statusDetail}</div>
                <div>📍 ${game.venue}</div>
                <div>📺 ${game.broadcast}</div>
            </div>
        `;

        card.addEventListener('click', () => this.toggleGameSelection(game.id, card));

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

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-status">${statusText}</div>
                <div class="panel-matchup">
                    <div class="panel-team">
                        <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.awayTeam.name}</div>
                        <div class="panel-team-score">${game.awayTeam.score}</div>
                    </div>
                    <div class="panel-vs">@</div>
                    <div class="panel-team">
                        <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="panel-team-logo">
                        <div class="panel-team-name">${game.homeTeam.name}</div>
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
                ${this.renderPanelLinks(game)}
            </div>
        `;

        return panel;
    }

    renderPanelLinks(game) {
        if (!game.links || game.links.length === 0) {
            return '<p>No additional links available</p>';
        }

        const linksHTML = game.links
            .filter(link => link.href)
            .map(link => `
                <a href="${link.href}" target="_blank" class="panel-link">
                    ${link.text || 'View Details'} →
                </a>
            `)
            .join('');

        return `
            <h3>Links & Resources</h3>
            <div class="panel-links">
                ${linksHTML}
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
            const games = await this.fetchNFLGames();
            this.allGames = games;

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
