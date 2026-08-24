import fs from 'fs';
import path from 'path';

/**
 * Script to generate high-definition branded launcher icons for each BUKKIT flavor
 * Outputs crisp themed icons into android/app/src/main/res/mipmap-*
 */

const FLAVORS = {
  customer: {
    name: 'BUKKIT',
    primaryColor: '#16a34a', // Emerald Green
    secondaryColor: '#22c55e',
    badgeText: 'FOOD',
    iconSymbol: '🍱'
  },
  vendor: {
    name: 'BUKKIT Kitchen',
    primaryColor: '#d97706', // Amber/Orange
    secondaryColor: '#f59e0b',
    badgeText: 'CHEF',
    iconSymbol: '👨‍🍳'
  },
  rider: {
    name: 'BUKKIT Rider',
    primaryColor: '#0284c7', // Sky Blue
    secondaryColor: '#38bdf8',
    badgeText: 'RIDER',
    iconSymbol: '🛵'
  },
  admin: {
    name: 'BUKKIT Admin',
    primaryColor: '#7c3aed', // Purple
    secondaryColor: '#a855f7',
    badgeText: 'ADMIN',
    iconSymbol: '🛡️'
  }
};

const targetFlavor = process.argv[2] || process.env.VITE_BUKKIT_APP_VARIANT || 'customer';
const config = FLAVORS[targetFlavor] || FLAVORS.customer;

console.log(`[Icon Generator] Generating branded native icons for flavor: ${targetFlavor} (${config.name})...`);

// Generate an SVG icon template
function generateSvg(size, isRound = false) {
  const radius = isRound ? size / 2 : size * 0.22;
  const fontSize = Math.floor(size * 0.42);
  const badgeFontSize = Math.floor(size * 0.14);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${config.secondaryColor}" />
      <stop offset="100%" stop-color="${config.primaryColor}" />
    </linearGradient>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${Math.max(2, Math.floor(size * 0.03))}" stdDeviation="${Math.max(2, Math.floor(size * 0.04))}" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Base Container -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="url(#bgGrad)" />
  
  <!-- White Inner Accent -->
  <rect x="${size * 0.06}" y="${size * 0.06}" width="${size * 0.88}" height="${size * 0.88}" rx="${Math.max(0, radius - size * 0.06)}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="${Math.max(1, Math.floor(size * 0.02))}" />
  
  <!-- Center Emoji/Icon Graphic -->
  <text x="50%" y="${size * 0.52}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}px" text-anchor="middle" dominant-baseline="central" filter="url(#dropShadow)">
    ${config.iconSymbol}
  </text>
  
  <!-- Flavor Badge -->
  <g transform="translate(0, ${size * 0.72})">
    <rect x="${size * 0.15}" y="0" width="${size * 0.7}" height="${size * 0.2}" rx="${size * 0.1}" fill="#0f172a" fill-opacity="0.85" />
    <text x="50%" y="${size * 0.11}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${badgeFontSize}px" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="1">
      ${config.badgeText}
    </text>
  </g>
</svg>`;
}

const RES_DIRS = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'android/app/src/main/res/drawable',
  'android/app/src/main/res/drawable-v24'
];

for (const dir of RES_DIRS) {
  if (fs.existsSync(dir)) {
    try {
      const svgStandard = generateSvg(192, false);
      const svgRound = generateSvg(192, true);
      fs.writeFileSync(path.join(dir, 'ic_launcher.xml'), svgStandard);
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.xml'), svgRound);
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.xml'), svgStandard);
    } catch (e) {
      console.warn(`Note writing icons to ${dir}:`, e.message);
    }
  }
}

console.log(`[Icon Generator] Successfully applied ${config.name} branding theme.`);
