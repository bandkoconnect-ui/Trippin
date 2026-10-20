/**
 * Trippin — departure points the prototype knows about.
 * Search matches name, country and airport codes.
 * air:  hub | major | regional  (affects connection time estimates)
 * rail: rail network id — matching a destination's id means a train trip is plausible
 * road: landmass id for driving and coaches
 * culture: same hierarchical codes as destinations (see engine/culture.js)
 */
const C = (lang, script, food, customs) => ({ lang, script, food, customs });

const DE = C('ie.germanic.west.de', 'latin', 'eu.central.de', 'west.central.dach');
const EN_UK = C('ie.germanic.west.en', 'latin', 'eu.west.uk', 'west.anglo.uk');
const EN_US = C('ie.germanic.west.en', 'latin', 'am.north.us', 'west.anglo.na');

export const ORIGINS = [
  // Germany & DACH
  { id: 'berlin', name: 'Berlin', country: 'Germany', codes: 'BER', lat: 52.52, lon: 13.4, air: 'major', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'hamburg', name: 'Hamburg', country: 'Germany', codes: 'HAM', lat: 53.55, lon: 9.99, air: 'major', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'hannover', name: 'Hannover', country: 'Germany', codes: 'HAJ', lat: 52.37, lon: 9.73, air: 'regional', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'cologne', name: 'Cologne / Düsseldorf', country: 'Germany', codes: 'CGN DUS', lat: 50.94, lon: 6.96, air: 'major', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'frankfurt', name: 'Frankfurt', country: 'Germany', codes: 'FRA', lat: 50.11, lon: 8.68, air: 'hub', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'stuttgart', name: 'Stuttgart', country: 'Germany', codes: 'STR', lat: 48.78, lon: 9.18, air: 'regional', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'munich-o', name: 'Munich', country: 'Germany', codes: 'MUC', lat: 48.14, lon: 11.58, air: 'hub', rail: 'eu', road: 'eurasia', culture: DE },
  { id: 'vienna-o', name: 'Vienna', country: 'Austria', codes: 'VIE', lat: 48.21, lon: 16.37, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.west.de', 'latin', 'eu.central.alpine', 'west.central.dach') },
  { id: 'zurich', name: 'Zürich', country: 'Switzerland', codes: 'ZRH', lat: 47.37, lon: 8.54, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.west.de', 'latin', 'eu.central.alpine', 'west.central.dach') },
  // Western Europe
  { id: 'amsterdam-o', name: 'Amsterdam', country: 'Netherlands', codes: 'AMS', lat: 52.37, lon: 4.9, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.west.nl', 'latin', 'eu.west.benelux', 'west.central.benelux') },
  { id: 'brussels', name: 'Brussels', country: 'Belgium', codes: 'BRU', lat: 50.85, lon: 4.35, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.romance.gallo.fr', 'latin', 'eu.west.benelux', 'west.central.benelux') },
  { id: 'paris', name: 'Paris', country: 'France', codes: 'CDG ORY', lat: 48.86, lon: 2.35, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.romance.gallo.fr', 'latin', 'eu.west.fr', 'west.central.fr') },
  { id: 'london', name: 'London', country: 'United Kingdom', codes: 'LHR LGW STN', lat: 51.51, lon: -0.13, air: 'hub', rail: 'eu', road: 'eurasia', culture: EN_UK },
  { id: 'manchester', name: 'Manchester', country: 'United Kingdom', codes: 'MAN', lat: 53.48, lon: -2.24, air: 'major', rail: 'eu', road: 'eurasia', culture: EN_UK },
  { id: 'dublin', name: 'Dublin', country: 'Ireland', codes: 'DUB', lat: 53.35, lon: -6.26, air: 'major', rail: null, road: 'ireland', culture: C('ie.germanic.west.en', 'latin', 'eu.west.uk', 'west.anglo.uk') },
  // Southern Europe
  { id: 'madrid', name: 'Madrid', country: 'Spain', codes: 'MAD', lat: 40.42, lon: -3.7, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.romance.ibero.es', 'latin', 'eu.south.iberia', 'west.south.iberia') },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', codes: 'BCN', lat: 41.39, lon: 2.17, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.romance.ibero.ca', 'latin', 'eu.south.iberia', 'west.south.iberia') },
  { id: 'lisbon-o', name: 'Lisbon', country: 'Portugal', codes: 'LIS', lat: 38.72, lon: -9.14, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.romance.ibero.pt', 'latin', 'eu.south.iberia', 'west.south.iberia') },
  { id: 'rome', name: 'Rome', country: 'Italy', codes: 'FCO', lat: 41.9, lon: 12.5, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.romance.italo.it', 'latin', 'eu.south.italy', 'west.south.italy') },
  { id: 'milan', name: 'Milan', country: 'Italy', codes: 'MXP LIN', lat: 45.46, lon: 9.19, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.romance.italo.it', 'latin', 'eu.south.italy', 'west.south.italy') },
  { id: 'athens', name: 'Athens', country: 'Greece', codes: 'ATH', lat: 37.98, lon: 23.73, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.hellenic.greek.el', 'greek', 'eu.south.balkan', 'west.south.greece') },
  // Northern & Central-Eastern Europe
  { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark', codes: 'CPH', lat: 55.68, lon: 12.57, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.north.da', 'latin', 'eu.north.nordic', 'west.nordic.nordic') },
  { id: 'stockholm', name: 'Stockholm', country: 'Sweden', codes: 'ARN', lat: 59.33, lon: 18.07, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.north.sv', 'latin', 'eu.north.nordic', 'west.nordic.nordic') },
  { id: 'oslo', name: 'Oslo', country: 'Norway', codes: 'OSL', lat: 59.91, lon: 10.75, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.germanic.north.no', 'latin', 'eu.north.nordic', 'west.nordic.nordic') },
  { id: 'helsinki', name: 'Helsinki', country: 'Finland', codes: 'HEL', lat: 60.17, lon: 24.94, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('uralic.finnic.fi.fi', 'latin', 'eu.north.nordic', 'west.nordic.nordic') },
  { id: 'warsaw', name: 'Warsaw', country: 'Poland', codes: 'WAW', lat: 52.23, lon: 21.01, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.slavic.west.pl', 'latin', 'eu.east.slavic', 'west.east.slavic') },
  { id: 'prague-o', name: 'Prague', country: 'Czechia', codes: 'PRG', lat: 50.08, lon: 14.44, air: 'major', rail: 'eu', road: 'eurasia', culture: C('ie.slavic.west.cs', 'latin', 'eu.central.de', 'west.east.slavic') },
  { id: 'budapest', name: 'Budapest', country: 'Hungary', codes: 'BUD', lat: 47.5, lon: 19.04, air: 'major', rail: 'eu', road: 'eurasia', culture: C('uralic.ugric.hu.hu', 'latin', 'eu.east.magyar', 'west.east.magyar') },
  { id: 'istanbul-o', name: 'Istanbul', country: 'Türkiye', codes: 'IST SAW', lat: 41.01, lon: 28.98, air: 'hub', rail: 'eu', road: 'eurasia', culture: C('turkic.oghuz.tr.tr', 'latin', 'westasia.anatolia.tr', 'mena.turkic.tr') },
  // Middle East & Africa
  { id: 'dubai-o', name: 'Dubai', country: 'United Arab Emirates', codes: 'DXB', lat: 25.2, lon: 55.27, air: 'hub', rail: null, road: 'eurasia', culture: C('afroasiatic.semitic.ar.gulf', 'arabic', 'westasia.gulf.ae', 'mena.arab.gulf') },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', codes: 'CAI', lat: 30.04, lon: 31.24, air: 'hub', rail: null, road: 'africa', culture: C('afroasiatic.semitic.ar.eg', 'arabic', 'africa.north.nile', 'mena.arab.east') },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', codes: 'LOS', lat: 6.52, lon: 3.38, air: 'major', rail: null, road: 'africa', culture: C('ie.germanic.west.en', 'latin', 'africa.west.ng', 'africa.west.ng') },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', codes: 'NBO', lat: -1.29, lon: 36.82, air: 'hub', rail: null, road: 'africa', culture: C('nigercongo.bantu.sw.ke', 'latin', 'africa.east.swahili', 'africa.east.swahili') },
  { id: 'johannesburg', name: 'Johannesburg', country: 'South Africa', codes: 'JNB', lat: -26.2, lon: 28.05, air: 'hub', rail: null, road: 'africa', culture: C('ie.germanic.west.en', 'latin', 'africa.south.cape', 'africa.south.za') },
  // Asia
  { id: 'delhi', name: 'Delhi', country: 'India', codes: 'DEL', lat: 28.61, lon: 77.21, air: 'hub', rail: 'in', road: 'india', culture: C('ie.indoaryan.hindi.hi', 'devanagari', 'asia.south.in', 'asia.south.in') },
  { id: 'mumbai', name: 'Mumbai', country: 'India', codes: 'BOM', lat: 19.08, lon: 72.88, air: 'hub', rail: 'in', road: 'india', culture: C('ie.indoaryan.marathi.mr', 'devanagari', 'asia.south.in', 'asia.south.in') },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', codes: 'BKK', lat: 13.76, lon: 100.5, air: 'hub', rail: 'th', road: 'eurasia', culture: C('kradai.tai.th.th', 'thai', 'asia.se.th', 'asia.se.buddhist') },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', codes: 'SIN', lat: 1.35, lon: 103.82, air: 'hub', rail: null, road: 'eurasia', culture: C('ie.germanic.west.en', 'latin', 'asia.se.sg', 'asia.se.sg') },
  { id: 'hongkong', name: 'Hong Kong', country: 'China', codes: 'HKG', lat: 22.32, lon: 114.17, air: 'hub', rail: 'cn', road: 'eurasia', culture: C('sinotibetan.sinitic.zh.yue', 'han', 'asia.east.cn', 'asia.east.cn') },
  { id: 'beijing', name: 'Beijing', country: 'China', codes: 'PEK PKX', lat: 39.9, lon: 116.4, air: 'hub', rail: 'cn', road: 'eurasia', culture: C('sinotibetan.sinitic.zh.cmn', 'han', 'asia.east.cn', 'asia.east.cn') },
  { id: 'shanghai', name: 'Shanghai', country: 'China', codes: 'PVG SHA', lat: 31.23, lon: 121.47, air: 'hub', rail: 'cn', road: 'eurasia', culture: C('sinotibetan.sinitic.zh.cmn', 'han', 'asia.east.cn', 'asia.east.cn') },
  { id: 'seoul-o', name: 'Seoul', country: 'South Korea', codes: 'ICN GMP', lat: 37.57, lon: 126.98, air: 'hub', rail: 'kr', road: 'korea', culture: C('koreanic.korean.ko.ko', 'hangul', 'asia.east.kr', 'asia.east.kr') },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', codes: 'HND NRT', lat: 35.68, lon: 139.69, air: 'hub', rail: 'jp', road: 'japan', culture: C('japonic.japanese.ja.ja', 'japanese', 'asia.east.jp', 'asia.east.jp') },
  // Oceania
  { id: 'sydney-o', name: 'Sydney', country: 'Australia', codes: 'SYD', lat: -33.87, lon: 151.21, air: 'hub', rail: null, road: 'australia', culture: C('ie.germanic.west.en', 'latin', 'oc.anglo.au', 'west.anglo.oc') },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', codes: 'MEL', lat: -37.81, lon: 144.96, air: 'hub', rail: null, road: 'australia', culture: C('ie.germanic.west.en', 'latin', 'oc.anglo.au', 'west.anglo.oc') },
  { id: 'auckland', name: 'Auckland', country: 'New Zealand', codes: 'AKL', lat: -36.85, lon: 174.76, air: 'hub', rail: null, road: 'newzealand', culture: C('ie.germanic.west.en', 'latin', 'oc.anglo.nz', 'west.anglo.oc') },
  // Americas
  { id: 'newyork-o', name: 'New York', country: 'United States', codes: 'JFK EWR LGA', lat: 40.71, lon: -74.0, air: 'hub', rail: 'na', road: 'northamerica', culture: EN_US },
  { id: 'chicago', name: 'Chicago', country: 'United States', codes: 'ORD', lat: 41.88, lon: -87.63, air: 'hub', rail: 'na', road: 'northamerica', culture: EN_US },
  { id: 'losangeles', name: 'Los Angeles', country: 'United States', codes: 'LAX', lat: 34.05, lon: -118.24, air: 'hub', rail: 'na', road: 'northamerica', culture: EN_US },
  { id: 'sanfrancisco', name: 'San Francisco', country: 'United States', codes: 'SFO', lat: 37.77, lon: -122.42, air: 'hub', rail: 'na', road: 'northamerica', culture: EN_US },
  { id: 'toronto', name: 'Toronto', country: 'Canada', codes: 'YYZ', lat: 43.65, lon: -79.38, air: 'hub', rail: 'na', road: 'northamerica', culture: C('ie.germanic.west.en', 'latin', 'am.north.ca', 'west.anglo.na') },
  { id: 'montreal', name: 'Montréal', country: 'Canada', codes: 'YUL', lat: 45.5, lon: -73.57, air: 'major', rail: 'na', road: 'northamerica', culture: C('ie.romance.gallo.fr', 'latin', 'am.north.ca', 'west.anglo.na') },
  { id: 'mexicocity', name: 'Mexico City', country: 'Mexico', codes: 'MEX', lat: 19.43, lon: -99.13, air: 'hub', rail: null, road: 'northamerica', culture: C('ie.romance.ibero.es', 'latin', 'am.meso.mx', 'latam.meso.mx') },
  { id: 'bogota', name: 'Bogotá', country: 'Colombia', codes: 'BOG', lat: 4.71, lon: -74.07, air: 'hub', rail: null, road: 'southamerica', culture: C('ie.romance.ibero.es', 'latin', 'am.andes.co', 'latam.carib.co') },
  { id: 'lima', name: 'Lima', country: 'Peru', codes: 'LIM', lat: -12.05, lon: -77.04, air: 'hub', rail: null, road: 'southamerica', culture: C('ie.romance.ibero.es', 'latin', 'am.andes.pe', 'latam.andes.pe') },
  { id: 'saopaulo', name: 'São Paulo', country: 'Brazil', codes: 'GRU', lat: -23.55, lon: -46.63, air: 'hub', rail: null, road: 'southamerica', culture: C('ie.romance.ibero.pt', 'latin', 'am.south.br', 'latam.south.br') },
  { id: 'buenosaires', name: 'Buenos Aires', country: 'Argentina', codes: 'EZE AEP', lat: -34.6, lon: -58.38, air: 'hub', rail: null, road: 'southamerica', culture: C('ie.romance.ibero.es', 'latin', 'am.south.ar', 'latam.south.ar') },
];
