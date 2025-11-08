// MMA Live Fight Tracker Application

class MMAFightTracker {
    constructor() {
        this.selectedFights = new Set();
        this.allFights = [];
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFights();
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

    async loadFights() {
        const loading = document.getElementById('loading');
        const fightList = document.getElementById('fight-list');
        const noFights = document.getElementById('no-fights');
        
        loading.style.display = 'block';
        fightList.innerHTML = '';
        noFights.style.display = 'none';

        try {
            const fights = await this.fetchMMAFights();
            this.allFights = fights;
            
            console.log('MMA: Loaded', fights.length, 'fights');

            loading.style.display = 'none';

            if (fights.length === 0) {
                noFights.style.display = 'block';
                this.showUpcomingEvents();
            } else {
                this.renderFightList(fights);
            }
            
            // Always show upcoming events
            this.showUpcomingEvents();
        } catch (error) {
            console.error('Error loading fights:', error);
            loading.style.display = 'none';
            noFights.style.display = 'block';
            noFights.querySelector('p').textContent = 'Error loading fights. Please try again later.';
        }
    }

    async fetchMMAFights() {
        try {
            // Using ESPN's public API for MMA/UFC
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard');
            const data = await response.json();
            
            console.log('MMA API Response:', data);
            
            if (!data.events || data.events.length === 0) {
                return [];
            }

            return data.events.map(event => {
                const competition = event.competitions[0];
                const fighters = competition.competitors;
                
                const fighter1 = fighters[0];
                const fighter2 = fighters[1];
                
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
                    weightClass: competition.notes?.[0]?.headline || 'MMA',
                    isTitleFight: event.name.toLowerCase().includes('championship') || 
                                 event.name.toLowerCase().includes('title'),
                    fighter1: {
                        id: fighter1.athlete?.id,
                        name: fighter1.athlete?.displayName || 'Fighter 1',
                        record: fighter1.record || 'N/A',
                        rank: fighter1.rank || null,
                        isChampion: fighter1.athlete?.flag?.alt?.includes('Champion') || false
                    },
                    fighter2: {
                        id: fighter2.athlete?.id,
                        name: fighter2.athlete?.displayName || 'Fighter 2',
                        record: fighter2.record || 'N/A',
                        rank: fighter2.rank || null,
                        isChampion: fighter2.athlete?.flag?.alt?.includes('Champion') || false
                    },
                    venue: competition.venue?.fullName || 'TBD',
                    location: competition.venue?.address?.city + ', ' + competition.venue?.address?.state || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || 'PPV'
                };
            });
        } catch (error) {
            console.error('Error fetching MMA fights:', error);
            throw error;
        }
    }

    async showUpcomingEvents() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard');
            const data = await response.json();
            
            const eventsContainer = document.getElementById('events-details');
            if (!eventsContainer) return;

            const now = new Date();
            const upcomingEvents = data.events
                ?.filter(event => new Date(event.date) > now)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5) || [];

            if (upcomingEvents.length > 0) {
                const nextEvent = upcomingEvents[0];
                const eventDate = new Date(nextEvent.date);
                const countdown = this.getCountdown(eventDate);
                const competition = nextEvent.competitions[0];
                const mainEvent = competition.competitors;

                eventsContainer.innerHTML = `
                    <div class="events-section">
                        <h3>⏱️ Next UFC Event</h3>
                        <div style="text-align: center; padding: 20px;">
                            <p style="font-size: 1.5rem; font-weight: bold; color: #FFD700; margin-bottom: 10px;">${nextEvent.name}</p>
                            <p style="font-size: 1.2rem; margin-bottom: 8px;">${mainEvent[0].athlete?.displayName} vs ${mainEvent[1].athlete?.displayName}</p>
                            <p style="font-size: 1rem; margin-bottom: 8px;">📍 ${competition.venue?.fullName || 'TBD'}</p>
                            <p style="font-size: 1rem; margin-bottom: 8px;">📅 ${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                            <p style="font-size: 1rem; margin-bottom: 15px;">📺 ${competition.broadcasts?.[0]?.names?.[0] || 'PPV'}</p>
                            <p style="font-size: 1.3rem; font-weight: bold; color: #DC143C; background: rgba(220,20,60,0.2); padding: 15px; border-radius: 10px; border: 2px solid rgba(220,20,60,0.5);">
                                🥊 ${countdown}
                            </p>
                        </div>
                        ${upcomingEvents.length > 1 ? `
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <h4 style="text-align: center; margin-bottom: 15px; color: #DC143C;">Upcoming Events</h4>
                                ${upcomingEvents.slice(1).map(evt => {
                                    const evtDate = new Date(evt.date);
                                    return `
                                        <div style="padding: 10px; margin: 8px 0; background: rgba(0,0,0,0.3); border-radius: 8px;">
                                            <div style="font-weight: bold; color: #FFD700;">${evt.name}</div>
                                            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 4px;">
                                                📅 ${evtDate.toLocaleDateString()} - ${this.getCountdown(evtDate)}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching upcoming events:', error);
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

    renderFightList(fights) {
        const fightList = document.getElementById('fight-list');
        fightList.innerHTML = '';

        fights.forEach((fight, index) => {
            const card = this.createFightCard(fight);
            card.style.animation = `slideInUp 0.6s ease-out ${index * 0.1}s both`;
            fightList.appendChild(card);
        });
    }

    createFightCard(fight) {
        const card = document.createElement('div');
        card.className = `fight-card ${fight.isTitleFight ? 'title-fight' : ''}`;
        card.dataset.fightId = fight.id;

        const statusClass = fight.isLive ? 'live' : '';
        const statusText = fight.isLive ? '🔴 LIVE' : fight.status;
        
        let countdownHTML = '';
        if (fight.isPregame) {
            const countdown = this.getCountdown(fight.date);
            countdownHTML = `<div class="countdown">⏱️ ${countdown}</div>`;
        }

        const titleBadge = fight.isTitleFight ? '<div class="fight-title">🏆 CHAMPIONSHIP FIGHT</div>' : '';

        card.innerHTML = `
            <div class="fight-status ${statusClass}">${statusText}</div>
            ${countdownHTML}
            ${titleBadge}
            <div style="text-align: center; font-size: 0.9rem; opacity: 0.8; margin-bottom: 10px;">${fight.weightClass}</div>
            <div class="fight-matchup">
                <div class="fighter">
                    <div class="fighter-name">${fight.fighter1.name}</div>
                    <div class="fighter-record">${fight.fighter1.record}</div>
                    ${fight.fighter1.rank ? `<div class="fighter-rank">Rank: #${fight.fighter1.rank}</div>` : ''}
                    ${fight.fighter1.isChampion ? '<div class="fighter-rank champion-badge">🏆 CHAMPION</div>' : ''}
                </div>
                <div class="vs">VS</div>
                <div class="fighter">
                    <div class="fighter-name">${fight.fighter2.name}</div>
                    <div class="fighter-record">${fight.fighter2.record}</div>
                    ${fight.fighter2.rank ? `<div class="fighter-rank">Rank: #${fight.fighter2.rank}</div>` : ''}
                    ${fight.fighter2.isChampion ? '<div class="fighter-rank champion-badge">🏆 CHAMPION</div>' : ''}
                </div>
            </div>
            <div class="fight-info">
                <div><strong>${fight.statusDetail}</strong></div>
                <div>📍 ${fight.venue}</div>
                <div>📺 ${fight.broadcast}</div>
                <div>📅 ${fight.date.toLocaleDateString()} ${fight.date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
            </div>
        `;

        card.addEventListener('click', () => this.toggleFightSelection(fight.id, card));
        
        card.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.selectedFights.clear();
            document.querySelectorAll('.fight-card').forEach(c => c.classList.remove('selected'));
            this.selectedFights.add(fight.id);
            card.classList.add('selected');
            this.showLiveView();
        });

        return card;
    }

    toggleFightSelection(fightId, card) {
        if (this.selectedFights.has(fightId)) {
            this.selectedFights.delete(fightId);
            card.classList.remove('selected');
        } else {
            this.selectedFights.add(fightId);
            card.classList.add('selected');
        }

        const watchBtn = document.getElementById('watch-btn');
        watchBtn.style.display = this.selectedFights.size > 0 ? 'block' : 'none';
    }

    showLiveView() {
        if (this.selectedFights.size === 0) return;

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
        const panelsContainer = document.getElementById('fight-panels');
        panelsContainer.innerHTML = '';
        
        panelsContainer.className = `fight-panels panels-${this.selectedFights.size}`;

        const selectedFightData = this.allFights.filter(fight => this.selectedFights.has(fight.id));

        selectedFightData.forEach(fight => {
            const panel = this.createFightPanel(fight);
            panelsContainer.appendChild(panel);
        });
    }

    createFightPanel(fight) {
        const panel = document.createElement('div');
        panel.className = 'fight-panel';
        panel.dataset.fightId = fight.id;

        const statusText = fight.isLive ? '🔴 LIVE' : fight.status;
        const titleBadge = fight.isTitleFight ? '🏆 CHAMPIONSHIP FIGHT' : '';

        panel.innerHTML = `
            <div class="panel-header">
                <div class="fight-status">${statusText}</div>
                <div class="panel-fight-title">${titleBadge} ${fight.weightClass}</div>
                <div class="panel-matchup">
                    <div class="panel-fighter">
                        <div class="panel-fighter-name">${fight.fighter1.name}</div>
                        <div class="panel-fighter-record">${fight.fighter1.record}</div>
                        ${fight.fighter1.rank ? `<div class="fighter-rank">Rank: #${fight.fighter1.rank}</div>` : ''}
                        ${fight.fighter1.isChampion ? '<div class="fighter-rank champion-badge">🏆 CHAMPION</div>' : ''}
                    </div>
                    <div class="vs">VS</div>
                    <div class="panel-fighter">
                        <div class="panel-fighter-name">${fight.fighter2.name}</div>
                        <div class="panel-fighter-record">${fight.fighter2.record}</div>
                        ${fight.fighter2.rank ? `<div class="fighter-rank">Rank: #${fight.fighter2.rank}</div>` : ''}
                        ${fight.fighter2.isChampion ? '<div class="fighter-rank champion-badge">🏆 CHAMPION</div>' : ''}
                    </div>
                </div>
                <div style="text-align: center; margin-top: 15px; font-size: 0.9rem;">
                    <div><strong>${fight.statusDetail}</strong></div>
                    <div>📍 ${fight.venue}</div>
                    <div>📺 ${fight.broadcast}</div>
                    <div>📅 ${fight.date.toLocaleDateString()}</div>
                </div>
            </div>
            <div class="panel-details">
                <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <div style="font-size: 0.9rem; opacity: 0.8;">
                        🥊 UFC / MMA<br>
                        ${fight.location}
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
            const fights = await this.fetchMMAFights();
            this.allFights = fights;
            this.renderLivePanels();
        } catch (error) {
            console.error('Error updating live data:', error);
        }
    }
}

// Initialize the tracker when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MMAFightTracker();
    });
} else {
    // DOM already loaded
    new MMAFightTracker();
}
