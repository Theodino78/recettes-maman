# August PWA

Tes recettes de chefs, simplifiées. Une PWA mobile-first pour cuisiner comme un pro.

## Structure

```
august-pwa/
├── index.html          # Entry point
├── manifest.json       # PWA manifest
├── src/
│   ├── css/
│   │   └── styles.css  # All styles (dark theme, animations)
│   ├── data/
│   │   └── recipes.js  # Recipe data (enriched steps with details)
│   └── js/
│       └── app.js      # Application logic
```

## Features

- **15 recipes** from Stéphanie Le Quellec, Whoogys, François-Régis Gaudry, Top Chef, @juliettehenry__
- **Ask terms**: tap underlined cooking terms for instant explanations
- **Expandable step details**: each step has hidden duration, temperature, and technique tips
- **Category gradient cards**: beautiful dark gradients per food category
- **Micro-animations**: staggered card fade-in, page transitions, smooth detail expand
- **Premium dark aesthetic**: subtle radial body gradient, accent glow on advanced recipes
- **Onboarding**: smooth 3-screen intro flow
- **Mobile-first**: designed for 480px max, touch-optimized

## Development

```bash
# Serve locally
python3 -m http.server 8765
# Open http://localhost:8765
```

No build step needed — vanilla HTML/CSS/JS with ES modules.

## Design Decisions

- **Category gradients on cards** instead of photos (avoids broken hotlinks, looks premium)
- **Advanced recipes** get an accent border glow to signal difficulty
- **Step details** use max-height transition for smooth expand/collapse
- **Onboarding** uses translateX sliding with opacity for screen transitions
- **Font stack**: Playfair Display (headings) + Inter (body) for premium editorial feel
