Japan # Funabashi City Food Business License Map


[![Deploy to GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-success)](https://kentaro-php.github.io/funabashi-food-map/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)


This is a civic-tech tool that visualizes Funabashi City’s open data “List of Food Business Facilities” using maps and infographics.


🔗 **Public URL**: https://kentaro-php.github.io/funabashi-food-map/


![Screenshot](og-image.png)


## Features


- 📊 **Always Up-to-Date**: Data is retrieved directly from the CKAN Data API published by Funabashi City (no manual updates required)
- 📱 **Mobile-Optimized**: A vertical-scrolling dashboard designed for easy viewing on smartphones
- 🗺️ **Map View**: Over 1,200 licensed facilities mapped by town and block, color-coded by business type
- 🔍 **Cross-Search**: Instant search by facility name, address, business type, or company name
- 🌓 **Auto Dark/Light Mode Switch**: Synchronizes with the OS’s color mode


## Analyses Displayed


1. **Business Type Distribution** - Donut chart + legend for all business types
2. **Top 10 Area Distributions** - Ranking of town blocks with the highest concentration of stores
3. **Trends in New Licenses** - Monthly bar chart (last 24 months)
4. **Multi-Store Expansion Ranking** - Businesses holding multiple licenses under the same corporate entity
5. **License Expiration Trends** - Licenses subject to renewal applications in the next 12 months


## Technology Stack


| Category | Technologies Used |
|------|---------|
| Data Source | [BODIK CKAN Data API](https://data.bodik.jp/) |
| Charts | [Chart.js 4](https://www.chartjs.org/) |
| Maps | [Leaflet](https://leafletjs.com/) + [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) |
| Map Tiles | [CARTO](https://carto.com/) (supports both light and dark modes) |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| Hosting | GitHub Pages |


Since all dependency libraries are loaded via CDN, no build is required, and deployment involves only static files.


## Running Locally


Since there are no dependency packages, it runs on a simple HTTP server.


```bash
# Python 3
python3 -m http.server 8000


# Node.js
npx serve .


# Ruby
ruby -run -ehttpd . -p8000
```


Open `http://localhost:8000/` in your browser.


## Deploying to GitHub Pages


1. Fork or clone this repository
2. Go to Settings → Pages in your GitHub repository
3. Source: `Deploy from a branch` → Branch: Select `main` / `/ (root)`
4. After a few minutes, it will be published at `https://<your-username>.github.io/funabashi-food-map/`


## Directory Structure


```
funabashi-food-map/
├── index.html # Main page
├── assets/
│ ├── app.js # Application logic
│ ├── styles.css # Styles
│ └── favicon.svg # Favicon
├── .nojekyll # Disable Jekyll build
└── README.md
```


## Data Sources


- **Dataset**: [List of Food Service Establishments - Funabashi City Open Data](https://data.bodik.jp/dataset/122041_shokuhineigyoukyokasisetu)
- **License**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)
- **API Endpoint**: `https://data.bodik.jp/api/3/action/datastore_search`
- **Resource ID**: `23b029a9-6c56-4869-8cea-9a9282d50900`


## Known Limitations


- **Location Accuracy**: Displayed using representative coordinates at the town/block level. These are not exact locations at the street address level
- **Businesses Operating Throughout the Prefecture**: Businesses without a specific address, such as mobile vendors (16 entries), are excluded from the map
- **Geocoding**: Town/block coordinates are retrieved via Nominatim only on the first use (takes approximately 1–2 minutes). Subsequent requests are displayed instantly using the localStorage cache

## License


MIT License


## Note


This site is an **unofficial tool** unrelated to Funabashi City or any public agency. For data accuracy, please be sure to check Funabashi City’s official [List of Food Business Facilities](https://www.city.funabashi.lg.jp/kenkou/eisei/004/p064870.html).
用語集


