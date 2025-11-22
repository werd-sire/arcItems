# Static Game Data

This directory contains pre-fetched game data from the Metaforge API.

## Files

- `items.json` - All game items with stats, components, and relationships
- `quests.json` - All quests with required items and rewards
- `metadata.json` - Data fetch timestamp and item/quest counts

## Updating Data

When game data needs to be updated (after patches, new content, etc.):

```bash
# Install Python dependencies first (one-time)
pip install requests

# Fetch latest data from Metaforge API
npm run fetch-data
```

This will overwrite the JSON files in this directory with fresh data from the API.

## Data Source

Data is fetched from: https://metaforge.app/api/arc-raiders

See `wikiSource/api_info.md` for API documentation.
