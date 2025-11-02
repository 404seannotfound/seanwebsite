# 🏈 NFL Live Game Tracker

A real-time NFL game tracking website that displays live scores, game details, and updates every 30 seconds.

## Features

- **Live Game Data**: Fetches current NFL games using ESPN's public API
- **Game Selection**: Choose which games you want to track
- **Multi-Panel View**: Dynamically splits the screen into panels based on selected games (2, 3, 4+ games)
- **Auto-Refresh**: Updates scores and game details every 30 seconds
- **Live Links**: Provides links to game details and resources
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Beautiful gradient background with glassmorphism effects

## How to Use

1. **Open the Website**: Simply open `index.html` in your web browser
2. **View Available Games**: The homepage shows all current NFL games (live, upcoming, or recently completed)
3. **Select Games**: Click on game cards to select which games you want to track
4. **Watch Live**: Click "Watch Selected Games" to view all selected games in split panels
5. **Auto-Updates**: The panels automatically refresh every 30 seconds with new scores and details
6. **Return to Selection**: Click "Back to Selection" to choose different games

## Technical Details

### Files
- `index.html` - Main HTML structure
- `styles.css` - Modern styling with responsive design
- `app.js` - JavaScript application logic and API integration

### API
Uses ESPN's public NFL scoreboard API:
```
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
```

### Features Implemented
- ✅ Real-time game data fetching
- ✅ 30-second auto-refresh
- ✅ Dynamic panel layout (1-6+ games)
- ✅ Live status indicators
- ✅ Score tracking
- ✅ Game details (venue, broadcast network)
- ✅ External links to game resources
- ✅ Responsive grid layout
- ✅ Modern glassmorphism UI

## Running Locally

No build process or dependencies required! Just open `index.html` in any modern web browser.

For a better development experience, you can use a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid
- Fetch API
- CSS backdrop-filter

## Future Enhancements

Possible additions:
- Play-by-play updates
- Player statistics
- Team logos and colors
- Game highlights/videos
- Notification sounds for scoring plays
- Save favorite teams
- Historical game data

