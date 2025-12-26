const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// Search configurations
const SEARCHES = [
    // eBay RSS feeds
    {
        name: 'eBay - YES Hel YES',
        source: 'ebay',
        url: 'https://www.ebay.com/sch/i.html?_nkw=YES+Hel+YES+snowboard&_sacat=0&LH_ItemCondition=3000&_sop=10&_rss=1'
    },
    {
        name: 'eBay - YES Hel YES 149',
        source: 'ebay',
        url: 'https://www.ebay.com/sch/i.html?_nkw=YES+Hel+YES+149+snowboard&_sacat=0&_sop=10&_rss=1'
    },
    {
        name: 'eBay - YES Women Snowboard',
        source: 'ebay',
        url: 'https://www.ebay.com/sch/i.html?_nkw=YES+women+snowboard&_sacat=0&LH_ItemCondition=3000&_sop=10&_rss=1'
    },
    // Craigslist RSS feeds
    {
        name: 'Craigslist Seattle - YES',
        source: 'craigslist',
        url: 'https://seattle.craigslist.org/search/sga?query=YES+snowboard&format=rss'
    },
    {
        name: 'Craigslist Seattle - Hel Yes',
        source: 'craigslist',
        url: 'https://seattle.craigslist.org/search/sga?query=Hel+Yes&format=rss'
    },
    {
        name: 'Craigslist Seattle - Snowboard 149',
        source: 'craigslist',
        url: 'https://seattle.craigslist.org/search/sga?query=snowboard+149&format=rss'
    },
    {
        name: 'Craigslist Portland - YES',
        source: 'craigslist',
        url: 'https://portland.craigslist.org/search/sga?query=YES+snowboard&format=rss'
    },
    {
        name: 'Craigslist Spokane - YES',
        source: 'craigslist',
        url: 'https://spokane.craigslist.org/search/sga?query=YES+snowboard&format=rss'
    }
];

function fetchUrl(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        };
        
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

function parseRSS(xmlText, source, searchName) {
    const listings = [];
    
    // Simple XML parsing with regex (works for RSS)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemXml = match[1];
        
        const getTag = (tag) => {
            const tagMatch = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
            return tagMatch ? tagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
        };
        
        const title = decodeEntities(getTag('title'));
        const link = getTag('link');
        const description = getTag('description');
        const pubDate = getTag('pubDate');
        
        // Extract image
        let image = null;
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) image = imgMatch[1];
        
        // Extract price
        let price = null;
        const priceMatch = (title + ' ' + description).match(/\$[\d,]+(?:\.\d{2})?/);
        if (priceMatch) price = priceMatch[0];
        
        // Generate ID from link
        const id = Buffer.from(link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
        
        listings.push({
            id,
            title,
            link,
            image,
            price,
            source,
            searchName,
            date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
        });
    }
    
    return listings;
}

function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

async function fetchAllListings() {
    const results = [];
    
    for (const search of SEARCHES) {
        try {
            console.log(`Fetching: ${search.name}`);
            const response = await fetchUrl(search.url);
            
            if (response.status === 200) {
                const listings = parseRSS(response.data, search.source, search.name);
                results.push({
                    search: search.name,
                    source: search.source,
                    status: 'success',
                    count: listings.length,
                    listings
                });
                console.log(`  ✓ Found ${listings.length} listings`);
            } else {
                results.push({
                    search: search.name,
                    source: search.source,
                    status: 'error',
                    error: `HTTP ${response.status}`,
                    listings: []
                });
                console.log(`  ✗ HTTP ${response.status}`);
            }
        } catch (err) {
            results.push({
                search: search.name,
                source: search.source,
                status: 'error',
                error: err.message,
                listings: []
            });
            console.log(`  ✗ ${err.message}`);
        }
    }
    
    return results;
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/listings') {
        try {
            console.log('\n--- Fetching all listings ---');
            const results = await fetchAllListings();
            
            // Flatten and dedupe listings
            const allListings = [];
            const seenIds = new Set();
            
            results.forEach(r => {
                r.listings.forEach(l => {
                    if (!seenIds.has(l.id)) {
                        seenIds.add(l.id);
                        allListings.push(l);
                    }
                });
            });
            
            // Sort by date
            allListings.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const response = {
                success: true,
                fetchedAt: new Date().toISOString(),
                sources: results.map(r => ({
                    name: r.search,
                    source: r.source,
                    status: r.status,
                    count: r.count || 0,
                    error: r.error
                })),
                totalListings: allListings.length,
                listings: allListings
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response, null, 2));
            
            console.log(`--- Done: ${allListings.length} total listings ---\n`);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    } else if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
            <head><title>Snowboard Finder Proxy</title></head>
            <body style="font-family: sans-serif; padding: 40px; background: #1a1a2e; color: #fff;">
                <h1>🏂 Snowboard Finder Proxy</h1>
                <p>API endpoint: <a href="/api/listings" style="color: #17a2b8;">/api/listings</a></p>
                <p>This proxy fetches listings from eBay and Craigslist RSS feeds.</p>
            </body>
            </html>
        `);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`\n🏂 Snowboard Finder Proxy running at http://localhost:${PORT}`);
    console.log(`   API endpoint: http://localhost:${PORT}/api/listings\n`);
});
