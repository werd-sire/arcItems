# Item Images

This directory contains item thumbnail images for the ARC Raiders Items Directory.

## Image Source

All images are sourced from the [ARC Raiders Wiki on Fandom](https://arc-raiders.fandom.com/wiki/Items).

**Copyright & Attribution:**
- Images are property of their respective copyright holders
- ARC Raiders is developed by Embark Studios
- Images sourced from the community-maintained Fandom wiki
- Used here for informational and reference purposes

## Image Naming Convention

Images are named using the following pattern:
- Item name converted to lowercase
- Spaces replaced with hyphens (`-`)
- Special characters removed
- Extension: `.png`

**Examples:**
- "Advanced Battery" → `advanced-battery.png`
- "Metal Parts" → `metal-parts.png`
- "Gear Bench III" → `gear-bench-iii.png`

## Downloading Images

To download/update images, run the Python script from the project root:

```bash
python download_images.py
```

This script will:
1. Fetch the current Items list from the Fandom wiki
2. Download missing images to this directory
3. Skip images that already exist
4. Report download statistics

## License

These images are used under fair use for informational purposes. All rights belong to their respective owners.
