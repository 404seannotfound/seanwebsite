# Snowboard Finder Proxy

A simple Node.js proxy server that fetches snowboard listings from eBay and Craigslist RSS feeds.

## Usage

```bash
cd snowboard-proxy
npm start
```

The server runs on `http://localhost:3001`

## API

### GET /api/listings

Returns all listings from configured search sources.

Response:
```json
{
  "success": true,
  "fetchedAt": "2024-12-25T...",
  "sources": [...],
  "totalListings": 42,
  "listings": [...]
}
```

## Search Sources

- eBay: YES Hel YES, YES Hel YES 149, YES Women Snowboard
- Craigslist: Seattle, Portland, Spokane
