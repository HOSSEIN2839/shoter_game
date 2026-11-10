# OPERATION: STRIKE — 3D Asset Pipeline

## Current state

The game still uses procedural operator meshes as a fallback. No downloaded character GLB or map pack is included yet. Do not describe the 15 operator slots as finished 3D characters until the models are installed and tested.

## Character direction

The target is 15 distinct, fully clothed, non-explicit tactical operators with readable silhouettes and a consistent stylized-realistic art direction. Avoid underwear, swimwear, revealing outfits, joke costumes, and unrelated fantasy gear.

### Candidate source: Quaternius

- Universal Base Characters: https://quaternius.itch.io/universal-base-characters
- Modular Character Outfits / official pack index: https://quaternius.com/
- Universal Animation Library: https://quaternius.itch.io/universal-animation-library

The Universal Base pack page currently advertises six humanoid rigged bases, six body/proportion variants and 20 hairstyles; it is a foundation, not 15 finished operators. The broader Quaternius catalogue lists modular male outfits including soldier/FPS styles and humanoid combat/locomotion animations.

**Important licence handling:** Quaternius published QAL v1.0 on 2026-08-28. It allows use in a finished game, including commercial use, but prohibits redistributing the model files themselves as standalone assets. Therefore do not commit Quaternius source GLB/FBX files into this public repository unless the exact asset's licence at acquisition explicitly permits redistribution. Keep source downloads locally and distribute only the completed game incorporating them, or use a separately verified CC0 source.

Current licence: https://quaternius.com/license.html

## CC0 alternative for freely redistributable assets

- Kenney Blocky Characters: https://kenney.nl/assets/blocky-characters
- Kenney Mini Characters: https://kenney.nl/assets/mini-characters
- Kenney Nature Kit: https://kenney.nl/assets/nature-kit

Kenney identifies these asset pages as CC0. The style is more toy-like than tactical, so these are fallback/prototype sources rather than the preferred final operator art direction. Preserve each downloaded pack's included License.txt.

## Required model layout

When a model has been acquired and its licence checked, convert/prepare it as a GLB and place it here:

```
public/
  assets/
    characters/
      operator-01.glb
      operator-02.glb
      ...
      operator-15.glb
    environment/
```

Use the same operator IDs as the server's character catalogue. Each model must be checked for:
- full-body coverage and suitable clothing;
- consistent scale, forward direction and origin at the feet;
- humanoid rig and animation compatibility;
- texture paths embedded or correctly relative;
- reasonable polygon/texture size for browser multiplayer;
- permission to redistribute the resulting file in this public repository.

## Integration and acceptance checklist

- Load models asynchronously and retain the procedural mesh if a model is missing or fails.
- Cache each GLB once; clone safely for each player (including skinned meshes).
- Apply team identification as a small armband/shoulder marker, not by recolouring the whole uniform.
- Play idle, walk/run, fire, reload, hit and death animations where available.
- Verify all 15 previews, selection exclusivity, remote player appearance, respawn, and browser performance.
- Record source URL, creator, exact licence/version, acquisition date and any required attribution for every asset.

## Environment

The training-yard map currently uses procedural geometry. The arena was improved with painted firing lanes, container ribs, concrete cover, sandbags, watchtower frames and perimeter lights. A polished downloadable map pack is a later step; keep its licence and performance budget documented before adding it.
