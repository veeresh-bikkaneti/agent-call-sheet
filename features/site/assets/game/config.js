// config.js: static game data. Catalog of buildable items, tools, chapters,
// postcards and unlocks. No DOM and no three.js here.

export const N = 64;            // terrain cells per side
export const HALF = N / 2;
export const SEA = 0;           // base sand height
export const CHANNEL_DEPTH = 0.55;
export const FLOW_CLIMB = 0.35; // water may rise this much from cell to cell
export const CELL_FILL_RATE = 2.6;   // wet units per second at the water front
export const HISTORY_LIMIT = 60;
export const SAVE_VERSION = 1;

export const KIND = { SAND: 0, CHANNEL: 1, PATH: 2, GARDEN: 3, DRY: 4, ROCK: 5, RESTORED: 6 };

export const TOOLS = [
  { id: 'select', label: 'Select', key: '1', hint: 'Pick a building to rotate, copy or remove. Click a hidden marvel to discover it.' },
  { id: 'raise', label: 'Raise', key: '2', hint: 'Drag to lift the dunes.' },
  { id: 'lower', label: 'Lower', key: '3', hint: 'Drag to dig the sand down.' },
  { id: 'smooth', label: 'Smooth', key: '4', hint: 'Drag to soften slopes.' },
  { id: 'carve', label: 'Canal', key: '5', hint: 'Drag from the spring to carve a canal. Water follows, but cannot climb.' },
  { id: 'path', label: 'Path', key: '6', hint: 'Drag to lay a path. Paths connect homes to the market and courtyards.' },
  { id: 'build', label: 'Build', key: '7', hint: 'Choose something from the build tray, then click to place it.' },
];

// size: [w, d] in cells. src: water supply when placed. needsWater: thrives near water.
export const ITEMS = {
  home:      { label: 'Adobe home', cat: 'Homes', size: [2, 2], beauty: 2, residents: 2, unlock: null },
  domeHome:  { label: 'Domed home', cat: 'Homes', size: [2, 2], beauty: 4, residents: 3, unlock: 'domeHome' },
  tileHome:  { label: 'Blue-tile home', cat: 'Homes', size: [2, 2], beauty: 5, residents: 3, unlock: 'tileHome' },
  windTower: { label: 'Wind tower', cat: 'Public', size: [1, 1], beauty: 3, shade: 3, unlock: 'windTower' },
  courtyard: { label: 'Shaded courtyard', cat: 'Public', size: [3, 3], beauty: 4, shade: 1, publicSpace: true, unlock: 'courtyard' },
  market:    { label: 'Market', cat: 'Public', size: [3, 2], beauty: 4, shade: 1, publicSpace: true, unlock: null },
  bathhouse: { label: 'Bathhouse', cat: 'Public', size: [3, 3], beauty: 5, publicSpace: true, needsWater: true, unlock: 'bathhouse' },
  well:      { label: 'Well', cat: 'Water', size: [1, 1], beauty: 1, src: 26, unlock: 'well' },
  aqueduct:  { label: 'Aqueduct span', cat: 'Water', size: [1, 1], beauty: 2, carries: true, unlock: 'aqueduct' },
  bridge:    { label: 'Footbridge', cat: 'Water', size: [1, 1], beauty: 2, overCanal: true, unlock: null },
  fountain:  { label: 'Fountain', cat: 'Water', size: [2, 2], beauty: 7, needsWater: true, waterFeature: true, publicSpace: true, unlock: 'fountain' },
  pool:      { label: 'Reflecting pool', cat: 'Water', size: [2, 3], beauty: 8, needsWater: true, waterFeature: true, unlock: 'pool' },
  palm:      { label: 'Date palm', cat: 'Gardens', size: [1, 1], beauty: 2, shade: 2, plant: true, unlock: null },
  crops:     { label: 'Crop rows', cat: 'Gardens', size: [1, 1], beauty: 1, plant: true, crop: true, unlock: null },
  garden:    { label: 'Oleander bed', cat: 'Gardens', size: [2, 2], beauty: 4, plant: true, unlock: 'garden' },
  pomegranate: { label: 'Pomegranate tree', cat: 'Gardens', size: [1, 1], beauty: 3, shade: 1, plant: true, unlock: 'pomegranate' },
  lantern:   { label: 'Lantern post', cat: 'Decor', size: [1, 1], beauty: 1, light: true, unlock: 'lantern' },
  ceramics:  { label: 'Ceramic jars', cat: 'Decor', size: [1, 1], beauty: 2, unlock: 'ceramics' },
  textiles:  { label: 'Textile awning', cat: 'Decor', size: [1, 1], beauty: 2, shade: 1, unlock: 'textiles' },
  bench:     { label: 'Stone bench', cat: 'Decor', size: [1, 1], beauty: 1, unlock: null },
  spring:    { label: 'Spring', cat: null, size: [2, 2], beauty: 3, src: 60, fixed: true, unlock: null },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const CATEGORIES = ['Homes', 'Public', 'Water', 'Gardens', 'Decor'];

export const UNLOCK_LABELS = {
  windTower: 'Wind towers', courtyard: 'Shaded courtyards', lantern: 'Lantern posts', textiles: 'Textile awnings',
  ceramics: 'Ceramic jars', well: 'Wells', bathhouse: 'Bathhouses', domeHome: 'Domed homes', garden: 'Oleander beds',
  aqueduct: 'Aqueducts', fountain: 'Fountains', tileHome: 'Blue-tile homes', pomegranate: 'Pomegranate trees', pool: 'Reflecting pools',
};
export const ALL_UNLOCKS = Object.keys(UNLOCK_LABELS);

// Goals: gentle creative aims. Each completed goal widens the settlement boundary.
export const CHAPTERS = [
  {
    id: 'first-spring', title: 'The First Spring',
    intro: 'A small spring bubbles up between the dunes. Lead its water out and let a few families settle beside it.',
    seed: 11, spring: [0, 0], boundary: [10, 4],
    dry: [[5, 4, 3, 2]], ruins: [[-14, 12, 'ruin']], overlooks: [[16, -15]], blooms: [[-9, -13]],
    start: { unlocked: [] },
    goals: [
      { id: 'canal', type: 'wetCells', n: 8, text: 'Carve a canal so water flows through 8 squares' },
      { id: 'homes', type: 'count', item: 'home', n: 3, text: 'Build 3 adobe homes' },
      { id: 'palms', type: 'count', item: 'palm', n: 4, text: 'Plant 4 date palms' },
      { id: 'crops', type: 'irrigated', n: 3, text: 'Water 3 plantings near the canal' },
    ],
    unlocks: ['windTower', 'courtyard', 'lantern'],
  },
  {
    id: 'shade-market', title: 'Shade and Market',
    intro: 'Traders have heard of the new spring. Give them a market, cool places to gather, and bring the dry plots back to life.',
    seed: 23, spring: [-4, 2], boundary: [12, 4],
    dry: [[4, -6, 4, 2], [-12, 8, 2, 3]], ruins: [[15, 13, 'ruin']], overlooks: [[-17, -16]], blooms: [[12, -14]],
    start: { unlocked: ['windTower', 'courtyard', 'lantern'] },
    goals: [
      { id: 'market', type: 'count', item: 'market', n: 1, text: 'Open a market' },
      { id: 'connect', type: 'connectedHomes', n: 4, text: 'Connect 4 homes to the market or a courtyard with paths' },
      { id: 'shade', type: 'shadedPublic', n: 1, text: 'Create a shaded public space (palms or a wind tower beside a courtyard)' },
      { id: 'restore', type: 'restored', n: 4, text: 'Restore 4 dry plots by planting on them near water' },
      { id: 'lanterns', type: 'count', item: 'lantern', n: 4, text: 'Light the evening with 4 lanterns' },
    ],
    unlocks: ['textiles', 'ceramics', 'well', 'bathhouse', 'domeHome', 'garden'],
  },
  {
    id: 'long-canal', title: 'The Long Canal',
    intro: 'Beyond the ridge lies a quiet basin. Dig a well, carry its water over the dunes, and let the town grow.',
    seed: 37, spring: [-10, -6], boundary: [14, 5], ridge: true,
    dry: [[9, 6, 3, 3]], ruins: [[18, -12, 'ruin'], [-18, 16, 'ruin']], overlooks: [[2, -19]], blooms: [[16, 16]],
    start: { unlocked: ['windTower', 'courtyard', 'lantern', 'textiles', 'ceramics', 'well', 'bathhouse', 'domeHome', 'garden'] },
    goals: [
      { id: 'well', type: 'count', item: 'well', n: 1, text: 'Dig a well' },
      { id: 'aqueduct', type: 'aqueductFlow', text: 'Carry water along an aqueduct span' },
      { id: 'bridge', type: 'bridgeOverCanal', text: 'Lay a footbridge across a flowing canal' },
      { id: 'bath', type: 'count', item: 'bathhouse', n: 1, text: 'Build a bathhouse beside the water' },
      { id: 'people', type: 'population', n: 20, text: 'Welcome 20 residents' },
    ],
    unlocks: ['aqueduct', 'fountain', 'tileHome', 'pomegranate'],
  },
  {
    id: 'postcard-evening', title: 'Postcard Evening',
    intro: 'The oasis is alive. Make it beautiful, find what the old travellers left behind, and frame the moment.',
    seed: 53, spring: [3, -3], boundary: [16, 6],
    dry: [[-8, 7, 3, 2]], ruins: [[-17, -14, 'ruin'], [17, 12, 'ruin']], overlooks: [[-19, 10], [12, -19]], blooms: [[-5, 17], [19, -2]],
    start: { unlocked: ['windTower', 'courtyard', 'lantern', 'textiles', 'ceramics', 'well', 'bathhouse', 'domeHome', 'garden', 'aqueduct', 'fountain', 'tileHome', 'pomegranate'] },
    goals: [
      { id: 'fountain', type: 'count', item: 'fountain', n: 1, text: 'Build a fountain that runs' },
      { id: 'discover', type: 'discover', n: 2, text: 'Discover 2 hidden overlooks, ruins or desert blooms' },
      { id: 'beauty', type: 'beauty', n: 60, text: 'Raise the oasis beauty to 60' },
      { id: 'vista', type: 'postcard', n: 1, text: 'Frame a scenic vista: capture any postcard in photo mode' },
    ],
    unlocks: ['pool'],
  },
];

// Postcard compositions, judged when a photo is taken.
export const POSTCARDS = [
  { id: 'golden-canal', title: 'Golden Canal', hint: 'Late afternoon light on flowing water and palms.' },
  { id: 'lantern-night', title: 'Lantern Night', hint: 'Four or more lanterns glowing after dark.' },
  { id: 'market-morning', title: 'Market Morning', hint: 'A busy market in the morning.' },
  { id: 'birds-over-oasis', title: 'Birds over the Oasis', hint: 'Catch the migrating flock in the frame.' },
  { id: 'ruins-dusk', title: 'Ruins at Dusk', hint: 'A discovered ruin as the sun goes down.' },
  { id: 'reflecting-pool', title: 'Still Water', hint: 'A full reflecting pool beside a palm.' },
  { id: 'courtyard-shade', title: 'Midday Shade', hint: 'A courtyard at noon with shade beside it.' },
  { id: 'sand-drift', title: 'Drifting Sand', hint: 'Water in the frame on a breezy day.' },
  { id: 'rain-gardens', title: 'Rain on the Gardens', hint: 'Thriving plantings in a rare shower.' },
  { id: 'starry-overlook', title: 'Starry Overlook', hint: 'A discovered overlook under the stars.' },
];

export const WEATHERS = ['clear', 'hazy', 'breezy', 'rain'];
export const ABUNDANCE = { low: 0.6, normal: 1, high: 1.6 };
export const BOUNDARIES = { small: 12, medium: 18, large: 26, open: 40 };

export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.6, ambience: 0.8, sfx: 0.8, muted: false,
  quality: 'high', reduceMotion: false, shake: true, highContrast: false, textSize: 'normal',
  captions: false, invertY: false, camSpeed: 1, gridSnap: true, waterPattern: false, timeSpeed: 1,
};
