# DPS Calculation Documentation

This document explains how weapon DPS (Damage Per Second) and related metrics are calculated in the ARC Raiders Crafting Tool.

---

## Overview

The tool calculates multiple DPS-related metrics to help players compare weapons effectively:

1. **Burst DPS** - Sustained fire damage without considering reloads
2. **Effective DPS** - Sustained damage including reload downtime (estimated)
3. **Magazine Damage** - Total damage from one full magazine
4. **Time to Empty** - Duration of sustained fire before reload

All calculations use verified data from the [Metaforge API](https://metaforge.app/arc-raiders) and account for weapon stat modifiers.

---

## Data Sources

### Available from API
The following stats are directly available in weapon data:

- `damage` - Base damage per shot
- `fireRate` - Fire rate in **rounds per second** (not RPM)
- `magazineSize` - Number of rounds per magazine
- `damageMult` - Damage multiplier (percentage or direct)
- `increasedFireRate` - Percentage fire rate increase
- `reducedReloadTime` - Percentage reload time reduction
- `subcategory` - Weapon class (Pistol, Rifle, SMG, etc.)

### Not Available from API
⚠️ **Important:** Base reload time (`reloadTime`) is **NOT** provided in the API data. Only the modifier `reducedReloadTime` exists.

This means Effective DPS calculations must use estimated reload times based on weapon class.

---

## Calculation Formulas

### 1. Burst DPS

**Formula:**
```
Burst DPS = Modified Damage × Modified Fire Rate
```

**Step-by-step:**
```javascript
// 1. Get base stats
damage = weapon.stat_block.damage
fireRate = weapon.stat_block.fireRate

// 2. Apply damage multiplier
if (damageMult exists) {
  if (damageMult > 1) {
    damage *= (1 + damageMult / 100)  // Treat as percentage
  } else {
    damage *= damageMult              // Treat as multiplier
  }
}

// 3. Apply fire rate modifier
if (increasedFireRate exists) {
  fireRate *= (1 + increasedFireRate / 100)
}

// 4. Calculate DPS
Burst DPS = damage × fireRate
```

**Example:**
```
Weapon: Anvil I
- Base Damage: 40
- Base Fire Rate: 16.3 rps
- Damage Multiplier: 0 (none)
- Increased Fire Rate: 0 (none)

Burst DPS = 40 × 16.3 = 652 DPS
```

---

### 2. Magazine Damage

**Formula:**
```
Magazine Damage = Modified Damage × Magazine Size
```

**Step-by-step:**
```javascript
// 1. Get base stats
damage = weapon.stat_block.damage
magazineSize = weapon.stat_block.magazineSize

// 2. Apply damage multiplier (same as Burst DPS)
if (damageMult exists) {
  if (damageMult > 1) {
    damage *= (1 + damageMult / 100)
  } else {
    damage *= damageMult
  }
}

// 3. Calculate total damage
Magazine Damage = damage × magazineSize
```

**Example:**
```
Weapon: Anvil I
- Modified Damage: 40
- Magazine Size: 6

Magazine Damage = 40 × 6 = 240
```

**Use case:** Shows burst damage potential - useful for alpha damage scenarios.

---

### 3. Time to Empty

**Formula:**
```
Time to Empty = Magazine Size ÷ Modified Fire Rate
```

**Step-by-step:**
```javascript
// 1. Get base stats
fireRate = weapon.stat_block.fireRate
magazineSize = weapon.stat_block.magazineSize

// 2. Apply fire rate modifier
if (increasedFireRate exists) {
  fireRate *= (1 + increasedFireRate / 100)
}

// 3. Calculate time
Time to Empty = magazineSize ÷ fireRate
```

**Example:**
```
Weapon: Anvil I
- Magazine Size: 6
- Modified Fire Rate: 16.3 rps

Time to Empty = 6 ÷ 16.3 = 0.37 seconds
```

**Use case:** Shows how long you can sustain fire before needing to reload.

---

### 4. Effective DPS

**Formula:**
```
Effective DPS = Magazine Damage ÷ (Time to Empty + Modified Reload Time)
```

**Step-by-step:**
```javascript
// 1. Calculate magazine damage (see formula above)
magazineDamage = calculateMagazineDamage(weapon)

// 2. Calculate time to empty (see formula above)
timeToEmpty = calculateTimeToEmpty(weapon)

// 3. Estimate base reload time by weapon class
if (subcategory contains "pistol" or "handgun"):
  estimatedReload = 1.5s
else if (subcategory contains "smg" or "submachine"):
  estimatedReload = 2.0s
else if (subcategory contains "rifle" or "assault"):
  estimatedReload = 2.5s
else if (subcategory contains "sniper"):
  estimatedReload = 3.0s
else if (subcategory contains "shotgun"):
  estimatedReload = 3.5s
else if (subcategory contains "lmg" or "machine"):
  estimatedReload = 4.0s
else:
  estimatedReload = 2.5s  // Default

// 4. Apply reload time modifier
if (reducedReloadTime exists) {
  estimatedReload *= (1 - reducedReloadTime / 100)
}

// 5. Calculate effective DPS
cycleTime = timeToEmpty + estimatedReload
Effective DPS = magazineDamage ÷ cycleTime
```

**Example:**
```
Weapon: Anvil I (Pistol)
- Magazine Damage: 240
- Time to Empty: 0.37s
- Estimated Reload: 1.5s (pistol base)
- Reduced Reload Time: 0 (none)

Cycle Time = 0.37 + 1.5 = 1.87s
Effective DPS = 240 ÷ 1.87 = 128 DPS
```

**⚠️ Limitations:**
- Uses **estimated** reload times since API doesn't provide base reload time
- Estimates based on typical FPS weapon balance
- Apply `reducedReloadTime` modifier to estimates for more accuracy
- Should be used as a **relative comparison** between weapons, not absolute values

---

## Estimated Reload Times by Class

Since base reload time is not in the API, we use these estimates:

| Weapon Class | Estimated Reload Time |
|--------------|----------------------|
| Pistol / Handgun | 1.5 seconds |
| SMG / Submachine Gun | 2.0 seconds |
| Rifle / Assault Rifle | 2.5 seconds |
| Sniper Rifle | 3.0 seconds |
| Shotgun | 3.5 seconds |
| LMG / Machine Gun | 4.0 seconds |
| **Default** (unknown) | **2.5 seconds** |

These estimates are then modified by the `reducedReloadTime` percentage if present.

---

## Edge Cases

### Missing Data
- If `damage` or `fireRate` is 0 or missing → Returns 0 (weapon cannot deal damage)
- If `magazineSize` is 0 or missing → Cannot calculate Magazine Damage or Time to Empty
- If weapon has no `subcategory` → Uses default 2.5s reload estimate

### Zero Division
All calculations include checks to prevent division by zero:
```javascript
if (!fireRate || !magazineSize) return 0
```

### Number Parsing
All values are parsed as floats to handle both integer and decimal values:
```javascript
damage = parseFloat(stats.damage) || 0
fireRate = parseFloat(stats.fireRate) || 0
```

---

## Stat Modifiers

### Damage Multiplier (`damageMult`)
Handles both percentage and direct multipliers:
```javascript
if (damageMult > 1) {
  // Treat as percentage: 10 = +10%
  damage *= (1 + damageMult / 100)
} else {
  // Treat as direct multiplier: 0.5 = 50% damage
  damage *= damageMult
}
```

### Fire Rate Modifier (`increasedFireRate`)
Always treated as percentage:
```javascript
// Example: 15 = +15% fire rate
fireRate *= (1 + increasedFireRate / 100)
```

### Reload Time Modifier (`reducedReloadTime`)
Always treated as percentage reduction:
```javascript
// Example: 20 = -20% reload time
reloadTime *= (1 - reducedReloadTime / 100)
```

---

## Implementation Notes

### Location in Codebase
All DPS calculations are in `src/utils/stats.js`:

- `calculateDPS(weapon)` - Burst DPS
- `calculateMagazineDamage(weapon)` - Magazine damage
- `calculateTimeToEmpty(weapon)` - Time to empty magazine
- `calculateEffectiveDPS(weapon)` - Effective DPS with estimated reload

### Display in UI
Calculations are exposed in `src/app.js` and displayed in the Compare tab:

1. **Burst DPS** - Primary metric for raw damage output
2. **Effective DPS** - Secondary metric (shown in smaller, muted text due to estimates)
3. **Magazine Damage** - Useful for burst damage comparison
4. **Time to Empty** - Shown in seconds format

All values include stat highlighting (best in green, worst dimmed) and visual progress bars.

---

## Example Comparison

### Weapon A: High Damage, Slow Fire Rate
```
Damage: 50
Fire Rate: 5 rps
Magazine Size: 10

Burst DPS = 50 × 5 = 250
Magazine Damage = 50 × 10 = 500
Time to Empty = 10 ÷ 5 = 2.0s
Effective DPS = 500 ÷ (2.0 + 2.5) = 111 DPS
```

### Weapon B: Low Damage, Fast Fire Rate
```
Damage: 20
Fire Rate: 15 rps
Magazine Size: 30

Burst DPS = 20 × 15 = 300
Magazine Damage = 20 × 30 = 600
Time to Empty = 30 ÷ 15 = 2.0s
Effective DPS = 600 ÷ (2.0 + 2.5) = 133 DPS
```

**Analysis:**
- Weapon B has higher Burst DPS (300 vs 250)
- Weapon B has higher Magazine Damage (600 vs 500)
- Both have same Time to Empty (2.0s)
- Weapon B has higher Effective DPS (133 vs 111)
- **Conclusion:** Weapon B is superior in sustained combat

---

## Accuracy & Reliability

### ✅ Highly Accurate
- **Burst DPS** - Uses only verified API data with no assumptions
- **Magazine Damage** - Uses only verified API data
- **Time to Empty** - Uses only verified API data

### ⚠️ Estimated
- **Effective DPS** - Uses estimated reload times
  - Estimates are based on typical FPS weapon balance
  - More accurate for **relative** comparisons between weapons
  - Less accurate for **absolute** DPS values

### 🔄 Future Improvements
If base reload time becomes available in the API:
1. Replace estimated reload times with actual values
2. Remove weapon class detection logic
3. Update documentation to reflect 100% accuracy

---

## Version History

**v1.0** - Initial implementation
- Burst DPS with damage and fire rate modifiers
- Magazine Damage calculation
- Time to Empty calculation
- Effective DPS with estimated reload times
- Support for 50+ weapon stats in comparison

---

## References

- **Game Data Source:** [Metaforge API](https://metaforge.app/arc-raiders)
- **Code Location:** `src/utils/stats.js`
- **UI Implementation:** `src/app.js` and `index.html` (Compare tab)

---

*Last Updated: November 2024*
*Documentation maintained as part of ARC Raiders Crafting Tool*
