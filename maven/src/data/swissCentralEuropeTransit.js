/**
 * @module swissCentralEuropeTransit
 * @description Live-interpolated timetable & corridor vehicle generator for
 * `sbb-ch` (Switzerland, St. Galler Rheintal & Vorarlberg) and `db-de`
 * (Germany, Austria & Central Europe) when upstream GTFS-RT requires an
 * operator API key or is unreachable.
 *
 * Vehicles glide continuously along real multi-waypoint rail, bus, tram, and
 * ferry corridors based on wall-clock epoch time (`now`), producing smooth
 * bearing, speed, and stop telemetry on every 15-second poll.
 */

const DEG_TO_RAD = Math.PI / 180;

function computeBearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const p1 = lat1 * DEG_TO_RAD;
  const p2 = lat2 * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Number((((brng % 360) + 360) % 360).toFixed(1));
}

/**
 * Real corridors for `sbb-ch` (St. Galler Rheintal, Ostschweiz, Vorarlberg & Schweiz)
 */
const SBB_CH_CORRIDORS = [
  // --- ST. GALLER RHEINTAL: RTB RHEINTAL BUS & POSTAUTO ---
  {
    routeId: '301',
    lineName: 'RTB 301 Altstätten SG – Heerbrugg – Widnau – Diepoldsau – Hohenems',
    speedMps: 11.5,
    cycleSec: 1200,
    vehiclesCount: 4,
    stops: ['Altstätten SG Bahnhof', 'Marbach', 'Rebstein', 'Balgach', 'Heerbrugg Bahnhof', 'Widnau Post', 'Diepoldsau Zentrum', 'Diepoldsau Zoll', 'Hohenems Bahnhof'],
    waypoints: [
      [47.3768, 9.5471], // Altstätten SG Bahnhof
      [47.3879, 9.5665], // Marbach SG
      [47.3965, 9.5828], // Rebstein
      [47.4058, 9.6042], // Balgach
      [47.4109, 9.6272], // Heerbrugg Bahnhof
      [47.4063, 9.6385], // Widnau Rathaus / Post
      [47.3921, 9.6495], // Schmitter / Diepoldsau West
      [47.3849, 9.6562], // Diepoldsau Dorfzentrum
      [47.3802, 9.6669], // Diepoldsau Zoll
      [47.3672, 9.6798], // Hohenems Bahnhof
    ],
  },
  {
    routeId: '302',
    lineName: 'RTB 302 Heerbrugg – Berneck – Au SG – Walzenhausen',
    speedMps: 10.8,
    cycleSec: 900,
    vehiclesCount: 3,
    stops: ['Heerbrugg Bahnhof', 'Berneck Rathaus', 'Au SG Bahnhof', 'Lachen AR', 'Walzenhausen Bahnhof'],
    waypoints: [
      [47.4109, 9.6272], // Heerbrugg Bahnhof
      [47.4245, 9.6128], // Berneck
      [47.4342, 9.6388], // Au SG Bahnhof
      [47.4418, 9.6265], // St. Margrethen West
      [47.4508, 9.6025], // Walzenhausen
    ],
  },
  {
    routeId: '303',
    lineName: 'RTB 303 Heerbrugg – Widnau – Diepoldsau – Lustenau',
    speedMps: 10.5,
    cycleSec: 840,
    vehiclesCount: 3,
    stops: ['Heerbrugg Bahnhof', 'Widnau Bahnhof', 'Widnau Unterdorf', 'Diepoldsau Kirche', 'Widnau Wiesenrain', 'Lustenau Marktplatz'],
    waypoints: [
      [47.4109, 9.6272], // Heerbrugg Bahnhof
      [47.4088, 9.6345], // Widnau
      [47.3968, 9.6481], // Schmitter
      [47.3849, 9.6562], // Diepoldsau
      [47.4032, 9.6448], // Widnau Wiesenrain
      [47.4265, 9.6588], // Lustenau
    ],
  },
  {
    routeId: '304',
    lineName: 'RTB 304 Heerbrugg – Au SG – St. Margrethen – Rheineck – Thal – Altenrhein',
    speedMps: 11.2,
    cycleSec: 1100,
    vehiclesCount: 3,
    stops: ['Heerbrugg Bahnhof', 'Au SG Bahnhof', 'St. Margrethen Bahnhof', 'Rheineck Bahnhof', 'Thal Post', 'Staab / Altenrhein Flugplatz'],
    waypoints: [
      [47.4109, 9.6272], // Heerbrugg Bahnhof
      [47.4342, 9.6388], // Au SG Bahnhof
      [47.4534, 9.6391], // St. Margrethen Bahnhof
      [47.4672, 9.5912], // Rheineck Bahnhof
      [47.4718, 9.5648], // Thal
      [47.4862, 9.5554], // Altenrhein
    ],
  },
  {
    routeId: '300',
    lineName: 'RTB 300 Altstätten SG – Oberriet – Kriessern – Rüthi SG – Sennwald – Buchs SG',
    speedMps: 13.0,
    cycleSec: 1400,
    vehiclesCount: 4,
    stops: ['Altstätten SG Stadt', 'Lüchingen', 'Kriessern Dorf', 'Oberriet SG Bahnhof', 'Rüthi SG Dorf / Praxis', 'Lienz', 'Sennwald', 'Salez-Sennwald', 'Buchs SG Bahnhof'],
    waypoints: [
      [47.3768, 9.5471], // Altstätten SG
      [47.3592, 9.5895], // Kriessern
      [47.3215, 9.5668], // Oberriet SG
      [47.2952, 9.5378], // Rüthi SG (Bahnhof / Staatsstrasse)
      [47.2698, 9.5015], // Sennwald
      [47.2328, 9.4842], // Haag / Salez
      [47.1672, 9.4778], // Buchs SG Bahnhof
    ],
  },
  {
    routeId: '351',
    lineName: 'Landbus 351 Heerbrugg – Au SG – Lustenau – Dornbirn Bahnhof',
    speedMps: 11.8,
    cycleSec: 1050,
    vehiclesCount: 3,
    stops: ['Heerbrugg Bahnhof', 'Au SG Zoll', 'Lustenau Rheinvorland', 'Lustenau Kirche', 'Dornbirn Schoren', 'Dornbirn Bahnhof'],
    waypoints: [
      [47.4109, 9.6272], // Heerbrugg Bahnhof
      [47.4342, 9.6388], // Au SG
      [47.4285, 9.6612], // Lustenau
      [47.4192, 9.7015], // Lustenau Ost
      [47.4135, 9.7421], // Dornbirn Bahnhof
    ],
  },
  // --- ST. GALLER RHEINTAL & OSTSCHWEIZ: SBB / THURBO RAIL ---
  {
    routeId: 'IR13',
    lineName: 'SBB IR13 Zürich HB – St. Gallen – St. Margrethen – Heerbrugg – Altstätten – Rüthi – Buchs – Sargans – Chur',
    speedMps: 27.5,
    cycleSec: 2100,
    vehiclesCount: 5,
    stops: ['St. Gallen HB', 'Rorschach', 'St. Margrethen SG', 'Au SG', 'Heerbrugg', 'Altstätten SG', 'Oberriet SG', 'Rüthi SG', 'Buchs SG', 'Sargans', 'Landquart', 'Chur'],
    waypoints: [
      [47.4232, 9.3698], // St. Gallen HB
      [47.4782, 9.4975], // Rorschach
      [47.4672, 9.5912], // Rheineck
      [47.4534, 9.6391], // St. Margrethen SG
      [47.4342, 9.6388], // Au SG
      [47.4109, 9.6272], // Heerbrugg
      [47.3965, 9.5828], // Rebstein-Marbach
      [47.3768, 9.5471], // Altstätten SG
      [47.3215, 9.5668], // Oberriet SG
      [47.2952, 9.5378], // Rüthi SG
      [47.2412, 9.4982], // Salez-Sennwald
      [47.1672, 9.4778], // Buchs SG
      [47.0452, 9.4425], // Sargans
      [46.9668, 9.5542], // Landquart
      [46.8532, 9.5289], // Chur
    ],
  },
  {
    routeId: 'S4',
    lineName: 'S-Bahn S4 St. Gallen – Rorschach – Heerbrugg – Altstätten – Buchs – Sargans',
    speedMps: 22.0,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: ['St. Gallen HB', 'Rorschach', 'St. Margrethen SG', 'Heerbrugg', 'Altstätten SG', 'Rüthi SG', 'Buchs SG', 'Sargans'],
    waypoints: [
      [47.4232, 9.3698], // St. Gallen HB
      [47.4782, 9.4975], // Rorschach
      [47.4534, 9.6391], // St. Margrethen SG
      [47.4109, 9.6272], // Heerbrugg
      [47.3768, 9.5471], // Altstätten SG
      [47.2952, 9.5378], // Rüthi SG
      [47.1672, 9.4778], // Buchs SG
      [47.0452, 9.4425], // Sargans
    ],
  },
  {
    routeId: 'S2',
    lineName: 'S-Bahn S2 Nesslau – Herisau – St. Gallen – Rorschach – St. Margrethen – Heerbrugg – Altstätten SG',
    speedMps: 20.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: ['Herisau', 'St. Gallen HB', 'Rorschach', 'St. Margrethen SG', 'Au SG', 'Heerbrugg', 'Rebstein-Marbach', 'Altstätten SG'],
    waypoints: [
      [47.3862, 9.2792], // Herisau
      [47.4232, 9.3698], // St. Gallen HB
      [47.4782, 9.4975], // Rorschach
      [47.4534, 9.6391], // St. Margrethen SG
      [47.4342, 9.6388], // Au SG
      [47.4109, 9.6272], // Heerbrugg
      [47.3965, 9.5828], // Rebstein-Marbach
      [47.3768, 9.5471], // Altstätten SG
    ],
  },
  {
    routeId: 'S1',
    lineName: 'ÖBB S1 Bregenz – Lustenau / Lauterach – Dornbirn – Hohenems – Götzis – Rankweil – Feldkirch – Bludenz',
    speedMps: 24.0,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: ['Bregenz Hafen', 'Bregenz Hbf', 'Lauterach', 'Dornbirn', 'Hohenems', 'Götzis', 'Rankweil', 'Feldkirch', 'Bludenz'],
    waypoints: [
      [47.5031, 9.7408], // Bregenz Hbf
      [47.4762, 9.7312], // Lauterach
      [47.4135, 9.7421], // Dornbirn
      [47.3672, 9.6798], // Hohenems (direkt gegenüber Diepoldsau)
      [47.3348, 9.6352], // Götzis
      [47.2708, 9.6415], // Rankweil
      [47.2412, 9.5978], // Feldkirch
      [47.1525, 9.8162], // Bludenz
    ],
  },
  {
    routeId: 'EC196',
    lineName: 'SBB / DB EuroCity Zürich HB – Winterthur – St. Gallen – St. Margrethen – Bregenz – Lindau – München',
    speedMps: 31.0,
    cycleSec: 2200,
    vehiclesCount: 3,
    stops: ['Zürich HB', 'Winterthur', 'Wil SG', 'Gossau SG', 'St. Gallen HB', 'St. Margrethen SG', 'Bregenz', 'Lindau-Reutin'],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.5003, 8.7241], // Winterthur
      [47.4622, 9.0412], // Wil SG
      [47.4125, 9.2528], // Gossau SG
      [47.4232, 9.3698], // St. Gallen HB
      [47.4534, 9.6391], // St. Margrethen SG
      [47.5031, 9.7408], // Bregenz
      [47.5492, 9.7082], // Lindau
    ],
  },
  // --- LIEMOBIL LIECHTENSTEIN / RHEINTAL / VORARLBERG ---
  {
    routeId: 'LIEMOBIL-11',
    lineName: 'LIEmobil Linie 11 Sargans – Balzers – Vaduz Post – Schaan – Eschen – Schaanwald – Feldkirch',
    speedMps: 12.5,
    cycleSec: 1200,
    vehiclesCount: 4,
    stops: ['Sargans Bahnhof', 'Balzers Rietstrasse', 'Triesen', 'Vaduz Post', 'Schaan Bahnhof', 'Bendern', 'Eschen', 'Schaanwald Zoll', 'Feldkirch Bahnhof'],
    waypoints: [
      [47.0455, 9.4451],
      [47.0672, 9.5015],
      [47.1038, 9.5245],
      [47.1393, 9.5215],
      [47.1684, 9.5088],
      [47.1992, 9.5062],
      [47.2112, 9.5234],
      [47.2165, 9.5664],
      [47.2412, 9.5981],
    ],
  },
  {
    routeId: 'LIEMOBIL-12',
    lineName: 'LIEmobil Linie 12 Buchs SG Bahnhof – Schaan Bahnhof – Vaduz Post',
    speedMps: 11.8,
    cycleSec: 720,
    vehiclesCount: 3,
    stops: ['Buchs SG Bahnhof', 'Rheinbrücke Buchs/Schaan', 'Schaan Bahnhof', 'Vaduz Marktplatz / Post'],
    waypoints: [
      [47.1684, 9.4785],
      [47.1684, 9.5088],
      [47.1393, 9.5215],
    ],
  },
  {
    routeId: 'LIEMOBIL-13',
    lineName: 'LIEmobil Linie 13 Buchs SG – Bendern – Eschen – Nendeln – Feldkirch',
    speedMps: 12.5,
    cycleSec: 900,
    vehiclesCount: 3,
    stops: ['Buchs SG Bahnhof', 'Bendern Post', 'Eschen Zentrum', 'Nendeln Bahnhof', 'Feldkirch Bahnhof'],
    waypoints: [
      [47.1684, 9.4785],
      [47.1992, 9.5062],
      [47.2112, 9.5234],
      [47.2008, 9.5445],
      [47.2412, 9.5981],
    ],
  },
  // --- ST. GALLER RHEINTAL & VORARLBERG CROSS-BORDER BUS & RAIL ---
  {
    routeId: 'RTB-305',
    lineName: 'RTB Rheintalbus 305 Heerbrugg Bahnhof – Widnau – Diepoldsau – Zoll Schmitter – Hohenems Bahnhof',
    speedMps: 11.2,
    cycleSec: 720,
    vehiclesCount: 3,
    stops: ['Heerbrugg Bahnhof', 'Widnau Gemeindehaus', 'Diepoldsau Zentrum', 'Zollamt Schmitter', 'Hohenems Bahnhof'],
    waypoints: [
      [47.4109, 9.6272],
      [47.4052, 9.6354],
      [47.3863, 9.6548],
      [47.3822, 9.6698],
      [47.3672, 9.6798],
    ],
  },
  {
    routeId: 'LANDBUS-50',
    lineName: 'Landbus Unterland 50 Bregenz – Hard – Höchst – Lustenau – Dornbirn',
    speedMps: 12.0,
    cycleSec: 960,
    vehiclesCount: 4,
    stops: ['Bregenz Bahnhof', 'Hard Zentrum', 'Höchst Kirchplatz', 'Lustenau Kirchplatz', 'Dornbirn Bahnhof'],
    waypoints: [
      [47.5031, 9.7401],
      [47.4882, 9.6915],
      [47.4585, 9.6408],
      [47.4265, 9.6588],
      [47.4135, 9.7438],
    ],
  },
  {
    routeId: 'REX1',
    lineName: 'ÖBB REX1 Lindau-Insel – Bregenz – Dornbirn – Hohenems – Feldkirch – Bludenz',
    speedMps: 27.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: ['Lindau-Insel', 'Bregenz', 'Dornbirn', 'Hohenems', 'Götzis', 'Rankweil', 'Feldkirch', 'Bludenz'],
    waypoints: [
      [47.5432, 9.6838],
      [47.5031, 9.7401],
      [47.4135, 9.7438],
      [47.3672, 9.6798],
      [47.3315, 9.6451],
      [47.2742, 9.6435],
      [47.2412, 9.5981],
      [47.1528, 9.8165],
    ],
  },
  // --- THURBO, SOB VORALPEN-EXPRESS, APPENZELLER BAHNEN & RHÄTISCHE BAHN ---
  {
    routeId: 'THURBO-S1',
    lineName: 'THURBO S1 Wil SG – St. Gallen – Romanshorn – Kreuzlingen – Schaffhausen',
    speedMps: 22.0,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: ['Wil SG', 'Gossau SG', 'St. Gallen HB', 'Arbon', 'Romanshorn', 'Kreuzlingen', 'Stein am Rhein', 'Schaffhausen'],
    waypoints: [
      [47.4622, 9.0412],
      [47.4142, 9.2518],
      [47.4232, 9.3698],
      [47.5152, 9.4312],
      [47.5656, 9.3765],
      [47.6502, 9.1705],
      [47.6562, 8.8595],
      [47.6983, 8.6328],
    ],
  },
  {
    routeId: 'VAE',
    lineName: 'SOB Voralpen-Express St. Gallen – Herisau – Wattwil – Rapperswil – Arth-Goldau – Luzern',
    speedMps: 24.5,
    cycleSec: 2000,
    vehiclesCount: 3,
    stops: ['St. Gallen HB', 'Herisau', 'Wattwil', 'Rapperswil', 'Pfäffikon SZ', 'Arth-Goldau', 'Luzern'],
    waypoints: [
      [47.4232, 9.3698],
      [47.3912, 9.2785],
      [47.2975, 9.0862],
      [47.2265, 8.8184],
      [47.0488, 8.5495],
      [47.0502, 8.3102],
    ],
  },
  {
    routeId: 'AB-S21',
    lineName: 'Appenzeller Bahnen S21 Trogen – Speicher – St. Gallen – Teufen – Gais – Appenzell',
    speedMps: 14.0,
    cycleSec: 1200,
    vehiclesCount: 3,
    stops: ['Trogen', 'Speicher', 'St. Gallen HB', 'Teufen AR', 'Bühler', 'Gais', 'Appenzell'],
    waypoints: [
      [47.4078, 9.4648],
      [47.4222, 9.4235],
      [47.4232, 9.3698],
      [47.3902, 9.3895],
      [47.3628, 9.4522],
      [47.3312, 9.4085],
    ],
  },
  {
    routeId: 'RHB-IR38',
    lineName: 'Rhätische Bahn (RhB) Albulalinie Chur – Thusis – Filisur – Bergün – St. Moritz',
    speedMps: 18.0,
    cycleSec: 2100,
    vehiclesCount: 3,
    stops: ['Chur', 'Thusis', 'Tiefencastel', 'Filisur', 'Bergün/Bravuogn', 'Samedan', 'St. Moritz'],
    waypoints: [
      [46.8535, 9.5292],
      [46.6978, 9.4408],
      [46.6612, 9.5745],
      [46.6742, 9.6885],
      [46.6288, 9.7478],
      [46.5342, 9.8728],
      [46.4978, 9.8465],
    ],
  },
  {
    routeId: 'RHB-RE3',
    lineName: 'Rhätische Bahn (RhB) Prättigau/Engadin Landquart – Klosters – Vereina – Scuol-Tarasp',
    speedMps: 19.5,
    cycleSec: 1800,
    vehiclesCount: 3,
    stops: ['Landquart', 'Schiers', 'Klosters Platz', 'Sagliains', 'Scuol-Tarasp'],
    waypoints: [
      [46.9675, 9.5542],
      [46.9422, 9.6795],
      [46.8685, 9.8812],
      [46.7622, 10.0945],
      [46.7958, 10.2942],
    ],
  },
  // --- ST. GALLEN STADTBUS ---
  {
    routeId: '1',
    lineName: 'VBSG Linie 1 Winkeln – St. Gallen HB – Stephanshorn',
    speedMps: 9.8,
    cycleSec: 900,
    vehiclesCount: 3,
    stops: ['Winkeln', 'St. Gallen HB', 'Marktplatz', 'Stephanshorn'],
    waypoints: [
      [47.4021, 9.3025],
      [47.4232, 9.3698],
      [47.4261, 9.3765],
      [47.4398, 9.4065],
    ],
  },
  // --- BODENSEE-FÄHRE ---
  {
    routeId: 'SBS-Fähre',
    lineName: 'Bodensee-Fähre MF Euregia Romanshorn – Friedrichshafen',
    speedMps: 6.5,
    cycleSec: 1800,
    vehiclesCount: 2,
    stops: ['Romanshorn Hafen', 'Bodensee Mitte', 'Friedrichshafen Hafen'],
    waypoints: [
      [47.5658, 9.3802],
      [47.6085, 9.4295],
      [47.6502, 9.4785],
    ],
  },
  // --- SCHWEIZER HAUPTACHSEN (ZÜRICH, BERN, BASEL, LUZERN, GENF, GOTTHARD) ---
  {
    routeId: 'IC1',
    lineName: 'SBB IC1 St. Gallen – Zürich HB – Bern – Fribourg – Lausanne – Genève-Aéroport',
    speedMps: 38.0,
    cycleSec: 2600,
    vehiclesCount: 6,
    stops: ['St. Gallen HB', 'Zürich HB', 'Bern', 'Fribourg', 'Lausanne', 'Genève Cornavin'],
    waypoints: [
      [47.4232, 9.3698], // St. Gallen
      [47.3779, 8.5403], // Zürich HB
      [47.3502, 7.9078], // Olten
      [46.9488, 7.4391], // Bern
      [46.8031, 7.1512], // Fribourg
      [46.5168, 6.6291], // Lausanne
      [46.2102, 6.1424], // Genève
    ],
  },
  {
    routeId: 'IC2',
    lineName: 'SBB IC2 Zürich HB – Zug – Arth-Goldau – Gotthard-Basistunnel – Bellinzona – Lugano',
    speedMps: 39.0,
    cycleSec: 2400,
    vehiclesCount: 4,
    stops: ['Zürich HB', 'Zug', 'Arth-Goldau', 'Altdorf', 'Bellinzona', 'Lugano'],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.1736, 8.5152], // Zug
      [47.0485, 8.5495], // Arth-Goldau
      [46.8772, 8.6318], // Altdorf
      [46.1956, 9.0245], // Bellinzona
      [46.0052, 8.9468], // Lugano
    ],
  },
  {
    routeId: 'IC3',
    lineName: 'SBB IC3 Basel SBB – Zürich HB – Sargans – Landquart – Chur',
    speedMps: 35.0,
    cycleSec: 2200,
    vehiclesCount: 4,
    stops: ['Basel SBB', 'Frick', 'Zürich HB', 'Pfäffikon SZ', 'Ziegelbrücke', 'Walenstadt', 'Sargans', 'Chur'],
    waypoints: [
      [47.5474, 7.5896], // Basel SBB
      [47.4792, 8.2065], // Baden
      [47.3779, 8.5403], // Zürich HB
      [47.2012, 8.7785], // Pfäffikon SZ
      [47.1362, 9.0602], // Ziegelbrücke
      [47.1202, 9.3145], // Walenstadt
      [47.0452, 9.4425], // Sargans
      [46.8532, 9.5289], // Chur
    ],
  },
  {
    routeId: 'Tram-4',
    lineName: 'VBZ Tram 4 Zürich Tiefenbrunnen – Bellevue – HB – Escher-Wyss-Platz – Altstetten',
    speedMps: 8.5,
    cycleSec: 1100,
    vehiclesCount: 3,
    stops: ['Bahnhof Tiefenbrunnen', 'Bellevue', 'Zürich HB', 'Escher-Wyss-Platz', 'Bahnhof Altstetten'],
    waypoints: [
      [47.3505, 8.5614],
      [47.3669, 8.5451],
      [47.3779, 8.5403],
      [47.3908, 8.5225],
      [47.3915, 8.4889],
    ],
  },
  {
    routeId: 'IR15',
    lineName: 'SBB IR15 Luzern – Sursee – Zofingen – Bern',
    speedMps: 30.0,
    cycleSec: 1800,
    vehiclesCount: 3,
    stops: ['Luzern', 'Sursee', 'Zofingen', 'Burgdorf', 'Bern'],
    waypoints: [
      [47.0502, 8.3102],
      [47.1712, 8.0985],
      [47.2875, 7.9428],
      [47.0602, 7.6212],
      [46.9488, 7.4391],
    ],
  },
  // --- ADDITIONAL SWISS, RHEINTAL, APPENZELL, VORARLBERG & LIECHTENSTEIN CORRIDORS ---
  {
    routeId: 'EC-GOTTHARD',
    lineName: 'SBB / Trenitalia EuroCity Zürich HB – Zug – Arth-Goldau – Gotthard-Basistunnel – Bellinzona – Lugano – Chiasso – Milano',
    agency: 'SBB CFF FFS / Trenitalia',
    routeColor: '#E50000',
    headsigns: ['Lugano / Milano Centrale', 'Zürich HB'],
    speedMps: 42.0,
    cycleSec: 3600,
    vehiclesCount: 5,
    stops: ['Zürich HB', 'Zug', 'Arth-Goldau', 'Flüelen', 'Altdorf UR', 'Erstfeld (Nordportal GBT)', 'Bodio (Südportal GBT)', 'Biasca', 'Bellinzona', 'Giubiasco', 'Rivera-Bironico', 'Lugano', 'Mendrisio', 'Chiasso'],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.2804, 8.5542], // Thalwil
      [47.1736, 8.5152], // Zug
      [47.0485, 8.5495], // Arth-Goldau
      [46.9019, 8.6244], // Flüelen
      [46.8772, 8.6318], // Altdorf UR
      [46.8205, 8.6508], // Erstfeld (GBT North Portal)
      [46.6305, 8.7650], // Gotthard Base Tunnel Mid-North
      [46.4750, 8.8850], // Gotthard Base Tunnel Mid-South
      [46.3792, 8.9102], // Bodio (GBT South Portal)
      [46.3519, 8.9692], // Biasca
      [46.1956, 9.0245], // Bellinzona
      [46.1722, 9.0044], // Giubiasco
      [46.1245, 8.9268], // Rivera-Bironico (Ceneri Base Tunnel)
      [46.0052, 8.9468], // Lugano
      [45.9512, 8.9725], // Melide
      [45.8712, 8.9782], // Mendrisio
      [45.8322, 9.0314], // Chiasso
    ],
  },
  {
    routeId: 'IC6',
    lineName: 'SBB IC6 Basel SBB – Olten – Bern – Thun – Spiez – Lötschberg-Basistunnel – Visp – Brig – Domodossola',
    agency: 'SBB CFF FFS / BLS',
    routeColor: '#EB0000',
    headsigns: ['Brig / Domodossola', 'Basel SBB'],
    speedMps: 38.0,
    cycleSec: 3600,
    vehiclesCount: 5,
    stops: ['Basel SBB', 'Liestal', 'Olten', 'Bern', 'Thun', 'Spiez', 'Frutigen (Nordportal LBT)', 'Visp', 'Brig', 'Iselle di Trasquera', 'Domodossola'],
    waypoints: [
      [47.5474, 7.5896], // Basel SBB
      [47.4842, 7.7314], // Liestal
      [47.3519, 7.9078], // Olten
      [47.1852, 7.7365], // Langenthal
      [47.0602, 7.6212], // Burgdorf
      [46.9488, 7.4391], // Bern
      [46.8425, 7.5385], // Münsingen
      [46.7545, 7.6295], // Thun
      [46.6865, 7.6802], // Spiez
      [46.5882, 7.6512], // Frutigen (Lötschberg Base Tunnel North)
      [46.4250, 7.7680], // Lötschberg Base Tunnel Mid
      [46.2941, 7.8815], // Visp
      [46.3192, 7.9881], // Brig (Simplon North Portal)
      [46.2069, 8.1989], // Iselle di Trasquera (Simplon South)
      [46.1147, 8.2961], // Domodossola
    ],
  },
  {
    routeId: 'IR90',
    lineName: 'SBB IR90 Genève-Aéroport – Genève – Nyon – Morges – Lausanne – Vevey – Montreux – Aigle – Martigny – Sion – Sierre – Visp – Brig',
    agency: 'SBB CFF FFS',
    routeColor: '#D81E05',
    headsigns: ['Brig', 'Genève-Aéroport'],
    speedMps: 35.0,
    cycleSec: 3600,
    vehiclesCount: 6,
    stops: ['Genève-Aéroport', 'Genève Cornavin', 'Nyon', 'Morges', 'Lausanne', 'Vevey', 'Montreux', 'Aigle', 'St-Maurice', 'Martigny', 'Sion', 'Sierre/Siders', 'Visp', 'Brig'],
    waypoints: [
      [46.2325, 6.1119], // Genève-Aéroport
      [46.2102, 6.1424], // Genève Cornavin
      [46.3845, 6.2358], // Nyon
      [46.5112, 6.4942], // Morges
      [46.5168, 6.6291], // Lausanne
      [46.4631, 6.8436], // Vevey
      [46.4358, 6.9108], // Montreux
      [46.3168, 6.9636], // Aigle
      [46.2158, 7.0019], // St-Maurice
      [46.1058, 7.0789], // Martigny
      [46.2275, 7.3592], // Sion
      [46.2918, 7.5325], // Sierre/Siders
      [46.3025, 7.7412], // Turtmann
      [46.2941, 7.8815], // Visp
      [46.3192, 7.9881], // Brig
    ],
  },
  {
    routeId: 'IC5',
    lineName: 'SBB IC5 Genève – Morges – Yverdon-les-Bains – Neuchâtel – Biel/Bienne – Grenchen Süd – Solothurn – Olten – Aarau – Zürich HB',
    agency: 'SBB CFF FFS',
    routeColor: '#E50000',
    headsigns: ['Zürich HB / St. Gallen', 'Genève-Aéroport'],
    speedMps: 36.0,
    cycleSec: 3400,
    vehiclesCount: 5,
    stops: ['Genève Cornavin', 'Morges', 'Yverdon-les-Bains', 'Neuchâtel', 'Biel/Bienne', 'Solothurn', 'Olten', 'Aarau', 'Lenzburg', 'Zürich HB'],
    waypoints: [
      [46.2102, 6.1424], // Genève
      [46.5112, 6.4942], // Morges
      [46.7815, 6.6412], // Yverdon-les-Bains
      [46.9968, 6.9355], // Neuchâtel
      [47.1328, 7.2428], // Biel/Bienne
      [47.2008, 7.5425], // Solothurn
      [47.3519, 7.9078], // Olten
      [47.3915, 8.0512], // Aarau
      [47.3922, 8.1805], // Lenzburg
      [47.3779, 8.5403], // Zürich HB
    ],
  },
  {
    routeId: 'IC8',
    lineName: 'SBB IC8 Romanshorn – Amriswil – Weinfelden – Frauenfeld – Winterthur – Zürich Flughafen – Zürich HB – Bern – Thun – Spiez – Interlaken Ost',
    agency: 'SBB CFF FFS',
    routeColor: '#E50000',
    headsigns: ['Interlaken Ost', 'Romanshorn'],
    speedMps: 34.0,
    cycleSec: 3400,
    vehiclesCount: 5,
    stops: ['Romanshorn', 'Amriswil', 'Weinfelden', 'Frauenfeld', 'Winterthur', 'Zürich Flughafen', 'Zürich HB', 'Bern', 'Thun', 'Spiez', 'Interlaken West', 'Interlaken Ost'],
    waypoints: [
      [47.5656, 9.3765], // Romanshorn
      [47.5512, 9.2975], // Amriswil
      [47.5662, 9.1065], // Weinfelden
      [47.5582, 8.8965], // Frauenfeld
      [47.5003, 8.7241], // Winterthur
      [47.4504, 8.5624], // Zürich Flughafen
      [47.3779, 8.5403], // Zürich HB
      [47.3519, 7.9078], // Olten
      [46.9488, 7.4391], // Bern
      [46.7545, 7.6295], // Thun
      [46.6865, 7.6802], // Spiez
      [46.6832, 7.8515], // Interlaken West
      [46.6905, 7.8692], // Interlaken Ost
    ],
  },
  {
    routeId: 'THURBO-S7',
    lineName: 'THURBO Seelinie S7/RE Romanshorn – Uttwil – Münsterlingen – Kreuzlingen – Tägerwilen – Steckborn – Mammern – Stein am Rhein – Diessenhofen – Schaffhausen',
    agency: 'THURBO / SBB',
    routeColor: '#0079C1',
    headsigns: ['Schaffhausen', 'Romanshorn'],
    speedMps: 21.0,
    cycleSec: 2100,
    vehiclesCount: 4,
    stops: ['Romanshorn', 'Uttwil', 'Altnau', 'Münsterlingen-Scherzingen', 'Kreuzlingen Hafen', 'Kreuzlingen', 'Tägerwilen Dorf', 'Mannenbach-Salenstein', 'Berlingen', 'Steckborn', 'Mammern', 'Stein am Rhein', 'Diessenhofen', 'Schaffhausen'],
    waypoints: [
      [47.5656, 9.3765], // Romanshorn
      [47.5862, 9.3418], // Uttwil
      [47.6192, 9.2665], // Altnau
      [47.6328, 9.2295], // Münsterlingen-Scherzingen
      [47.6512, 9.1815], // Kreuzlingen Hafen
      [47.6502, 9.1705], // Kreuzlingen
      [47.6552, 9.1328], // Tägerwilen Dorf
      [47.6722, 9.0485], // Mannenbach-Salenstein
      [47.6738, 9.0185], // Berlingen
      [47.6652, 8.9815], // Steckborn
      [47.6468, 8.9165], // Mammern
      [47.6562, 8.8595], // Stein am Rhein
      [47.6865, 8.7518], // Diessenhofen
      [47.6882, 8.6612], // Feuerthalen
      [47.6983, 8.6328], // Schaffhausen
    ],
  },
  {
    routeId: 'AB-S24',
    lineName: 'Appenzeller Bahnen Zahnradbahn S24 Altstätten Stadt – Warmesberg – Kreuzstrasse – Stoss AR – Rietli – Hebrig – Gais',
    agency: 'Appenzeller Bahnen (AB)',
    routeType: 'rail',
    routeColor: '#D6001C',
    headsigns: ['Gais', 'Altstätten Stadt'],
    speedMps: 10.5,
    cycleSec: 960,
    vehiclesCount: 2,
    stops: [
      'Altstätten Stadt',
      'Alter Zoll',
      'Warmesberg',
      'Kreuzstrasse',
      'Stoss AR',
      'Rietli',
      'Schachen (Gais)',
      'Hebrig',
      'Gais',
    ],
    waypoints: [
      [47.3782, 9.5398], // Altstätten Stadt
      [47.3765, 9.5285], // Alter Zoll
      [47.3728, 9.5192], // Warmesberg
      [47.3695, 9.5082], // Kreuzstrasse
      [47.3652, 9.4968], // Stoss AR
      [47.3622, 9.4825], // Rietli
      [47.3615, 9.4758], // Schachen (Gais)
      [47.3618, 9.4692], // Hebrig
      [47.3628, 9.4522], // Gais
    ],
  },
  {
    routeId: 'AB-S23',
    lineName: 'Appenzeller Bahnen S23 Gossau SG – Herisau – Waldstatt – Urnäsch – Jakobsbad – Appenzell – Weissbad – Wasserauen',
    agency: 'Appenzeller Bahnen (AB)',
    routeType: 'rail',
    routeColor: '#D6001C',
    headsigns: ['Wasserauen', 'Gossau SG'],
    speedMps: 15.0,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: [
      'Gossau SG',
      'Herisau',
      'Wilen',
      'Waldstatt',
      'Zürchersmühle',
      'Urnäsch',
      'Jakobsbad',
      'Gonten',
      'Gontenbad',
      'Appenzell',
      'Steinegg',
      'Weissbad',
      'Schwende',
      'Wasserauen',
    ],
    waypoints: [
      [47.4125, 9.2528], // Gossau SG
      [47.3912, 9.2785], // Herisau
      [47.3768, 9.2772], // Wilen
      [47.3578, 9.2862], // Waldstatt
      [47.3322, 9.2768], // Zürchersmühle
      [47.3175, 9.2798], // Urnäsch
      [47.3228, 9.3325], // Jakobsbad (Kronbergbahn)
      [47.3292, 9.3495], // Gonten
      [47.3308, 9.3732], // Gontenbad
      [47.3312, 9.4085], // Appenzell
      [47.3208, 9.4245], // Steinegg
      [47.3105, 9.4342], // Weissbad
      [47.2982, 9.4385], // Schwende
      [47.2865, 9.4292], // Wasserauen (Ebenalp)
    ],
  },
  {
    routeId: 'AB-S26',
    lineName: 'Appenzeller Bahnen S26 Rheineck – Ruderbach – Walzenhausen (Zahnradbahn)',
    agency: 'Appenzeller Bahnen (AB)',
    routeColor: '#D6001C',
    headsigns: ['Walzenhausen', 'Rheineck'],
    speedMps: 7.5,
    cycleSec: 600,
    vehiclesCount: 2,
    stops: ['Rheineck Bahnhof', 'Ruderbach', 'Hof', 'Walzenhausen'],
    waypoints: [
      [47.4672, 9.5912], // Rheineck Bahnhof
      [47.4622, 9.5945], // Ruderbach
      [47.4562, 9.5988], // Hof
      [47.4508, 9.6025], // Walzenhausen
    ],
  },
  {
    routeId: 'S3-VBG',
    lineName: 'ÖBB S3 Bregenz – Riedenburg – Lauterach West – Hard-Fußach – Lustenau – St. Margrethen SG',
    agency: 'ÖBB Personenverkehr / SBB',
    routeColor: '#005AA0',
    headsigns: ['St. Margrethen SG', 'Bregenz Hbf'],
    speedMps: 21.0,
    cycleSec: 900,
    vehiclesCount: 3,
    stops: ['Bregenz Hbf', 'Bregenz Riedenburg', 'Lauterach Unterfeld', 'Hard-Fußach', 'Lustenau Bahnhof', 'St. Margrethen SG'],
    waypoints: [
      [47.5031, 9.7408], // Bregenz Hbf
      [47.4902, 9.7325], // Bregenz Riedenburg
      [47.4795, 9.7192], // Lauterach Unterfeld
      [47.4782, 9.6895], // Hard-Fußach
      [47.4418, 9.6498], // Lustenau Bahnhof
      [47.4534, 9.6391], // St. Margrethen SG
    ],
  },
  {
    routeId: 'S4-MBS',
    lineName: 'Montafonerbahn S4 Bludenz – Lorüns – St. Anton im Montafon – Vandans – Tschagguns – Schruns',
    agency: 'Montafonerbahn (mbs) / ÖBB',
    routeColor: '#E30613',
    headsigns: ['Schruns', 'Bludenz'],
    speedMps: 18.0,
    cycleSec: 900,
    vehiclesCount: 2,
    stops: ['Bludenz', 'Bludenz-Moos', 'Lorüns', 'St. Anton im Montafon', 'Vandans', 'Kaltenbrunnen', 'Tschagguns', 'Schruns'],
    waypoints: [
      [47.1525, 9.8162], // Bludenz
      [47.1328, 9.8325], // Lorüns
      [47.1182, 9.8595], // St. Anton im Montafon
      [47.0988, 9.8692], // Vandans
      [47.0815, 9.9012], // Tschagguns
      [47.0785, 9.9168], // Schruns
    ],
  },
  {
    routeId: 'LIEMOBIL-14',
    lineName: 'LIEmobil Linie 14 Vaduz Post – Schaan – Nendeln – Eschen – Mauren – Schaanwald – Feldkirch Bahnhof',
    agency: 'LIEmobil (Verkehrsbetrieb LIECHTENSTEINmobil)',
    routeColor: '#84BD00',
    headsigns: ['Feldkirch Bahnhof', 'Vaduz Post'],
    speedMps: 12.5,
    cycleSec: 1100,
    vehiclesCount: 3,
    stops: ['Vaduz Post', 'Schaan Bahnhof', 'Nendeln Bahnhof', 'Eschen Zentrum', 'Mauren Post', 'Schaanwald Zoll', 'Tisis', 'Feldkirch Bahnhof'],
    waypoints: [
      [47.1393, 9.5215], // Vaduz Post
      [47.1684, 9.5088], // Schaan Bahnhof
      [47.2008, 9.5445], // Nendeln Bahnhof
      [47.2112, 9.5234], // Eschen Zentrum
      [47.2185, 9.5432], // Mauren Post
      [47.2165, 9.5664], // Schaanwald Zoll
      [47.2298, 9.5825], // Tisis
      [47.2412, 9.5981], // Feldkirch Bahnhof
    ],
  },
  {
    routeId: 'RHB-PE-BERNINA',
    lineName: 'RhB Bernina Express Chur / St. Moritz – Pontresina – Bernina Diavolezza – Ospizio Bernina – Alp Grüm – Poschiavo – Brusio – Tirano',
    agency: 'Rhätische Bahn (RhB)',
    routeColor: '#E30613',
    headsigns: ['Tirano', 'St. Moritz / Chur'],
    speedMps: 14.5,
    cycleSec: 2200,
    vehiclesCount: 4,
    stops: ['St. Moritz', 'Celerina Staz', 'Pontresina', 'Morteratsch', 'Bernina Diavolezza', 'Ospizio Bernina', 'Alp Grüm', 'Cavaglia', 'Poschiavo', 'Le Prese', 'Miralago', 'Brusio (Kreisviadukt)', 'Campocologno', 'Tirano'],
    waypoints: [
      [46.4978, 9.8465], // St. Moritz
      [46.5062, 9.8625], // Celerina Staz
      [46.4908, 9.8962], // Pontresina
      [46.4535, 9.9462], // Morteratsch
      [46.4418, 9.9825], // Bernina Diavolezza
      [46.4088, 10.0195], // Ospizio Bernina (2253 m)
      [46.3752, 10.0358], // Alp Grüm
      [46.3612, 10.0445], // Cavaglia
      [46.3258, 10.0568], // Poschiavo
      [46.2912, 10.0752], // Le Prese
      [46.2715, 10.0895], // Miralago
      [46.2538, 10.1258], // Brusio Kreisviadukt
      [46.2335, 10.1442], // Campocologno
      [46.2155, 10.1652], // Tirano
    ],
  },
  {
    routeId: 'PE-GLACIER',
    lineName: 'MGB / RhB Glacier Express Zermatt – Täsch – Visp – Brig – Fiesch – Oberwald – Andermatt – Oberalppass – Disentis/Mustér – Ilanz – Chur',
    agency: 'Matterhorn Gotthard Bahn (MGB) / RhB',
    routeColor: '#C8102E',
    headsigns: ['Chur / St. Moritz', 'Zermatt'],
    speedMps: 17.5,
    cycleSec: 3600,
    vehiclesCount: 5,
    stops: ['Zermatt', 'Täsch', 'St. Niklaus', 'Visp', 'Brig', 'Fiesch', 'Münster VS', 'Oberwald', 'Realp', 'Andermatt', 'Oberalppass', 'Sedrun', 'Disentis/Mustér', 'Ilanz', 'Reichenau-Tamins', 'Chur'],
    waypoints: [
      [46.0242, 7.7485], // Zermatt
      [46.0668, 7.7775], // Täsch
      [46.1782, 7.8035], // St. Niklaus
      [46.2941, 7.8815], // Visp
      [46.3192, 7.9881], // Brig
      [46.4025, 8.1342], // Fiesch
      [46.4865, 8.2618], // Münster VS
      [46.5332, 8.3525], // Oberwald (Furka Base Tunnel West)
      [46.5992, 8.5028], // Realp (Furka Base Tunnel East)
      [46.6368, 8.5938], // Andermatt
      [46.6588, 8.6712], // Oberalppass
      [46.6815, 8.7745], // Sedrun
      [46.7038, 8.8542], // Disentis/Mustér
      [46.7748, 9.2055], // Ilanz
      [46.8242, 9.4088], // Reichenau-Tamins
      [46.8532, 9.5289], // Chur
    ],
  },
  {
    routeId: 'PE-GOLDENPASS',
    lineName: 'MOB / BLS GoldenPass Express Montreux – Les Avants – Château-d’Oex – Gstaad – Zweisimmen – Boltigen – Spiez – Interlaken Ost',
    agency: 'Montreux-Berner Oberland-Bahn (MOB) / BLS',
    routeColor: '#B4975A',
    headsigns: ['Interlaken Ost', 'Montreux'],
    speedMps: 18.5,
    cycleSec: 2600,
    vehiclesCount: 4,
    stops: ['Montreux', 'Chamby', 'Les Avants', 'Montbovon', 'Château-d’Oex', 'Rougemont', 'Saanen', 'Gstaad', 'Saanenmöser', 'Zweisimmen', 'Boltigen', 'Erlenbach im Simmental', 'Spiez', 'Interlaken Ost'],
    waypoints: [
      [46.4358, 6.9108], // Montreux
      [46.4518, 6.9495], // Les Avants
      [46.4865, 7.0438], // Montbovon
      [46.4742, 7.1355], // Château-d’Oex
      [46.4872, 7.2065], // Rougemont
      [46.4722, 7.2858], // Gstaad
      [46.5128, 7.3025], // Saanenmöser
      [46.5542, 7.3728], // Zweisimmen
      [46.6258, 7.3915], // Boltigen
      [46.6602, 7.5528], // Erlenbach im Simmental
      [46.6865, 7.6802], // Spiez
      [46.6905, 7.8692], // Interlaken Ost
    ],
  },
  {
    routeId: 'S8-ZVV',
    lineName: 'S-Bahn Zürich S8 Winterthur – Effretikon – Wallisellen – Zürich Oerlikon – Zürich HB – Thalwil – Horgen – Wädenswil – Pfäffikon SZ',
    agency: 'SBB / Zürcher Verkehrsverbund (ZVV)',
    routeColor: '#6F2282',
    headsigns: ['Pfäffikon SZ', 'Winterthur'],
    speedMps: 24.0,
    cycleSec: 2100,
    vehiclesCount: 5,
    stops: ['Winterthur', 'Effretikon', 'Dietlikon', 'Wallisellen', 'Zürich Oerlikon', 'Zürich Hardbrücke', 'Zürich HB', 'Zürich Enge', 'Thalwil', 'Horgen', 'Wädenswil', 'Richterswil', 'Pfäffikon SZ'],
    waypoints: [
      [47.5003, 8.7241], // Winterthur
      [47.4258, 8.6865], // Effretikon
      [47.4198, 8.6192], // Dietlikon
      [47.4125, 8.5918], // Wallisellen
      [47.4115, 8.5442], // Zürich Oerlikon
      [47.3852, 8.5175], // Zürich Hardbrücke
      [47.3779, 8.5403], // Zürich HB
      [47.3642, 8.5312], // Zürich Enge
      [47.2952, 8.5645], // Thalwil
      [47.2612, 8.5975], // Horgen
      [47.2292, 8.6718], // Wädenswil
      [47.2078, 8.7062], // Richterswil
      [47.2012, 8.7785], // Pfäffikon SZ
    ],
  },
  {
    routeId: 'S5-ZVV',
    lineName: 'S-Bahn Zürich S5 Zug – Affoltern am Albis – Zürich Altstetten – Zürich HB – Stadelhofen – Uster – Wetzikon – Rapperswil – Pfäffikon SZ',
    agency: 'SBB / Zürcher Verkehrsverbund (ZVV)',
    routeColor: '#00A5E3',
    headsigns: ['Pfäffikon SZ', 'Zug'],
    speedMps: 24.5,
    cycleSec: 2200,
    vehiclesCount: 5,
    stops: ['Zug', 'Steinhausen', 'Affoltern am Albis', 'Birmensdorf', 'Zürich Altstetten', 'Zürich Hardbrücke', 'Zürich HB', 'Zürich Stadelhofen', 'Dübendorf', 'Uster', 'Wetzikon', 'Rüti ZH', 'Rapperswil', 'Pfäffikon SZ'],
    waypoints: [
      [47.1736, 8.5152], // Zug
      [47.1965, 8.4822], // Steinhausen
      [47.2762, 8.4465], // Affoltern am Albis
      [47.3548, 8.4375], // Birmensdorf
      [47.3915, 8.4889], // Zürich Altstetten
      [47.3779, 8.5403], // Zürich HB
      [47.3665, 8.5485], // Zürich Stadelhofen
      [47.3992, 8.6188], // Dübendorf
      [47.3502, 8.7182], // Uster
      [47.3185, 8.7952], // Wetzikon
      [47.2582, 8.8512], // Rüti ZH
      [47.2265, 8.8184], // Rapperswil
      [47.2012, 8.7785], // Pfäffikon SZ
    ],
  },
  {
    routeId: 'Tram-10',
    lineName: 'VBZ Tram 10 (Glattalbahn) Zürich HB – Central – ETH/Universitätsspital – Milchbuck – Oerlikon Ost – Glattpark – Zürich Flughafen',
    agency: 'VBZ / VBG Glattalbahn',
    routeColor: '#E6007E',
    headsigns: ['Zürich Flughafen', 'Zürich Bahnhofplatz/HB'],
    speedMps: 10.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: ['Zürich Bahnhofplatz/HB', 'Central', 'ETH/Universitätsspital', 'Seilbahn Rigiblick', 'Milchbuck', 'Sternen Oerlikon', 'Bahnhof Oerlikon Ost', 'Glattpark', 'Lindberghplatz', 'Zürich Flughafen'],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.3768, 8.5442], // Central
      [47.3775, 8.5485], // ETH/Universitätsspital
      [47.3865, 8.5488], // Seilbahn Rigiblick
      [47.3975, 8.5418], // Milchbuck
      [47.4102, 8.5448], // Sternen Oerlikon
      [47.4128, 8.5462], // Bahnhof Oerlikon Ost
      [47.4205, 8.5592], // Glattpark
      [47.4352, 8.5615], // Glattbrugg
      [47.4504, 8.5624], // Zürich Flughafen
    ],
  },
  {
    routeId: 'Tram-11',
    lineName: 'VBZ Tram 11 Zürich Rehalp – Bellevue – Paradeplatz – Zürich HB – Schaffhauserplatz – Oerlikon – Auzelg',
    agency: 'Verkehrsbetriebe Zürich (VBZ)',
    routeColor: '#009640',
    headsigns: ['Auzelg', 'Rehalp'],
    speedMps: 9.2,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: ['Rehalp', 'Kreuzplatz', 'Bellevue', 'Bürkliplatz', 'Paradeplatz', 'Rennweg', 'Bahnhofquai/HB', 'Schaffhauserplatz', 'Bucheggplatz', 'Bahnhof Oerlikon', 'Auzelg'],
    waypoints: [
      [47.3518, 8.5795], // Rehalp
      [47.3618, 8.5605], // Kreuzplatz
      [47.3669, 8.5451], // Bellevue
      [47.3697, 8.5389], // Paradeplatz
      [47.3779, 8.5403], // Zürich HB
      [47.3895, 8.5385], // Schaffhauserplatz
      [47.3978, 8.5342], // Bucheggplatz
      [47.4115, 8.5442], // Bahnhof Oerlikon
      [47.4172, 8.5695], // Auzelg
    ],
  },
  {
    routeId: 'Tram-8',
    lineName: 'BVB Trinational Tram 8 Kleinhüningen – Claraplatz – Marktplatz – Basel SBB – Weil am Rhein Bahnhof (DE)',
    agency: 'Basler Verkehrs-Betriebe (BVB)',
    routeColor: '#00843D',
    headsigns: ['Weil am Rhein Bahnhof/Zentrum', 'Neuweilerstrasse'],
    speedMps: 9.5,
    cycleSec: 1400,
    vehiclesCount: 4,
    stops: ['Basel Bahnhof SBB', 'Aeschenplatz', 'Bankverein', 'Barfüsserplatz', 'Marktplatz', 'Schifflände', 'Claraplatz', 'Kleinhüningen', 'Weil am Rhein Grenze', 'Weil am Rhein Bahnhof'],
    waypoints: [
      [47.5476, 7.5896], // Basel SBB
      [47.5515, 7.5948], // Aeschenplatz
      [47.5546, 7.5891], // Barfüsserplatz
      [47.5584, 7.5878], // Marktplatz
      [47.5618, 7.5955], // Claraplatz
      [47.5795, 7.5912], // Kleinhüningen
      [47.5882, 7.5965], // Weil am Rhein Grenze
      [47.5942, 7.6095], // Weil am Rhein Bahnhof
    ],
  },
  {
    routeId: 'Tram-6',
    lineName: 'BERNMOBIL Tram 6 Fischermätteli – Bern Bahnhof – Zytglogge – Helvetiaplatz – Muri – Worb Dorf',
    agency: 'BERNMOBIL',
    routeColor: '#C8102E',
    headsigns: ['Worb Dorf', 'Fischermätteli'],
    speedMps: 10.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: ['Fischermätteli', 'Loryplatz', 'Hirschengraben', 'Bern Bahnhof', 'Bärenplatz', 'Zytglogge', 'Helvetiaplatz', 'Egghölzli', 'Muri bei Bern', 'Gümligen', 'Worb Dorf'],
    waypoints: [
      [46.9412, 7.4165], // Fischermätteli
      [46.9465, 7.4352], // Hirschengraben
      [46.9488, 7.4404], // Bern Bahnhof
      [46.9482, 7.4478], // Zytglogge
      [46.9438, 7.4512], // Helvetiaplatz
      [46.9315, 7.4865], // Muri bei Bern
      [46.9322, 7.5152], // Gümligen
      [46.9302, 7.5645], // Worb Dorf
    ],
  },
  {
    routeId: 'Tram-12',
    lineName: 'TPG Tram 12 Lancy-Bachet-Gare – Carouge – Plainpalais – Bel-Air – Rive – Moillesulaz',
    agency: 'Transports publics genevois (TPG)',
    routeColor: '#F39200',
    headsigns: ['Thônex, Moillesulaz', 'Lancy-Bachet-Gare'],
    speedMps: 9.5,
    cycleSec: 1400,
    vehiclesCount: 4,
    stops: ['Lancy-Bachet-Gare', 'Carouge-Rondeau', 'Plainpalais', 'Place de Neuve', 'Bel-Air', 'Molard', 'Rive', 'Eaux-Vives-Gare', 'Chêne-Bourg', 'Moillesulaz'],
    waypoints: [
      [46.1742, 6.1292], // Lancy-Bachet-Gare
      [46.1825, 6.1392], // Carouge
      [46.1978, 6.1418], // Plainpalais
      [46.2044, 6.1432], // Bel-Air
      [46.2018, 6.1545], // Rive
      [46.2008, 6.1658], // Eaux-Vives-Gare
      [46.1958, 6.1945], // Chêne-Bourg
      [46.1925, 6.2058], // Moillesulaz
    ],
  },
  {
    routeId: 'RL4-LEMAN',
    lineName: 'Léman Express RL4 Coppet – Genève Cornavin – Genève-Eaux-Vives – Annemasse (FR)',
    agency: 'Lémanis (SBB / SNCF)',
    routeColor: '#0055A4',
    headsigns: ['Annemasse', 'Coppet'],
    speedMps: 23.0,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: ['Coppet', 'Versoix', 'Genève-Sécheron', 'Genève Cornavin', 'Lancy-Pont-Rouge', 'Lancy-Bachet', 'Genève-Champel', 'Genève-Eaux-Vives', 'Chêne-Bourg', 'Annemasse'],
    waypoints: [
      [46.3175, 6.1878], // Coppet
      [46.2792, 6.1645], // Versoix
      [46.2225, 6.1445], // Genève-Sécheron
      [46.2102, 6.1424], // Genève Cornavin
      [46.1888, 6.1255], // Lancy-Pont-Rouge
      [46.1742, 6.1292], // Lancy-Bachet
      [46.1922, 6.1538], // Genève-Champel
      [46.2008, 6.1658], // Genève-Eaux-Vives
      [46.1958, 6.1945], // Chêne-Bourg
      [46.1992, 6.2368], // Annemasse
    ],
  },
  // --- WAVE 13: ALPINE MOUNTAIN RAILWAYS, SWISS PANORAMIC LINES & EUROPEAN HIGH-SPEED RAIL ---
  {
    routeId: 'AB-S20',
    lineName: 'Appenzeller Bahnen S20 Trogen – Speicher – St. Gallen – Teufen AR – Bühler – Gais – Appenzell',
    agency: 'Appenzeller Bahnen (AB)',
    routeType: 'rail',
    routeColor: '#D6001C',
    headsigns: ['Appenzell', 'Trogen'],
    speedMps: 13.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: [
      'Trogen',
      'Bendlehn',
      'Speicher',
      'Vögelinsegg',
      'Notkersegg',
      'St. Gallen Schülerhaus',
      'St. Gallen Marktplatz',
      'St. Gallen HB',
      'St. Gallen Riethüsli',
      'Niederteufen',
      'Teufen AR',
      'Bühler',
      'Gais',
      'Sammelplatz',
      'Appenzell',
    ],
    waypoints: [
      [47.4078, 9.4648], // Trogen
      [47.4138, 9.4492], // Bendlehn
      [47.4142, 9.4385], // Speicher
      [47.4185, 9.4192], // Vögelinsegg
      [47.4215, 9.4028], // Notkersegg
      [47.4235, 9.3865], // St. Gallen Schülerhaus
      [47.4248, 9.3782], // St. Gallen Marktplatz / Spisertor
      [47.4232, 9.3698], // St. Gallen HB (AB)
      [47.4112, 9.3665], // St. Gallen Riethüsli
      [47.4025, 9.3712], // Lustmühle
      [47.3968, 9.3775], // Niederteufen
      [47.3902, 9.3895], // Teufen AR
      [47.3738, 9.4215], // Bühler
      [47.3628, 9.4522], // Gais
      [47.3508, 9.4368], // Sammelplatz
      [47.3312, 9.4085], // Appenzell
    ],
  },
  {
    routeId: 'RHB-BERNINA-NORD',
    lineName: 'RhB Bernina Express Nord Chur – Thusis – Tiefencastel – Filisur – Bergün – Preda – Pontresina – St. Moritz',
    agency: 'Rhätische Bahn (RhB)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['St. Moritz / Pontresina', 'Chur'],
    speedMps: 17.5,
    cycleSec: 2400,
    vehiclesCount: 4,
    stops: [
      'Chur',
      'Domat/Ems',
      'Reichenau-Tamins',
      'Thusis',
      'Tiefencastel',
      'Filisur',
      'Bergün/Bravuogn',
      'Preda',
      'Spinas',
      'Bever',
      'Samedan',
      'Pontresina',
      'Celerina Staz',
      'St. Moritz',
    ],
    waypoints: [
      [46.8535, 9.5292], // Chur
      [46.8358, 9.4525], // Domat/Ems
      [46.8242, 9.4088], // Reichenau-Tamins
      [46.7972, 9.4022], // Rhäzüns
      [46.6978, 9.4408], // Thusis
      [46.6712, 9.5245], // Soliser Viadukt
      [46.6612, 9.5745], // Tiefencastel
      [46.6808, 9.6762], // Landwasserviadukt
      [46.6742, 9.6885], // Filisur
      [46.6288, 9.7478], // Bergün/Bravuogn
      [46.6025, 9.7545], // Albula Kehrtunnels (Muot)
      [46.5892, 9.7765], // Preda (Nordportal Albulatunnel)
      [46.5562, 9.8495], // Spinas (Südportal Albulatunnel)
      [46.5508, 9.8892], // Bever
      [46.5342, 9.8728], // Samedan
      [46.4908, 9.8962], // Pontresina
      [46.5062, 9.8625], // Celerina Staz
      [46.4978, 9.8465], // St. Moritz
    ],
  },
  {
    routeId: 'MGB-BAHN',
    lineName: 'MGB Matterhorn Gotthard Bahn R40 Brig – Visp – Stalden-Saas – St. Niklaus – Randa – Täsch – Zermatt',
    agency: 'Matterhorn Gotthard Bahn (MGB)',
    routeType: 'rail',
    routeColor: '#C8102E',
    headsigns: ['Zermatt', 'Brig Bahnhofplatz'],
    speedMps: 15.5,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: [
      'Brig Bahnhofplatz',
      'Eyholz',
      'Visp',
      'Stalden-Saas',
      'Kalpetran',
      'St. Niklaus',
      'Herbriggen',
      'Randa',
      'Täsch (Matterhorn Terminal)',
      'Zermatt',
    ],
    waypoints: [
      [46.3192, 7.9881], // Brig Bahnhofplatz
      [46.3055, 7.9325], // Eyholz
      [46.2941, 7.8815], // Visp
      [46.2338, 7.8682], // Stalden-Saas
      [46.2052, 7.8405], // Kalpetran
      [46.1782, 7.8035], // St. Niklaus
      [46.1355, 7.7912], // Herbriggen
      [46.0998, 7.7818], // Randa
      [46.0668, 7.7775], // Täsch (Matterhorn Terminal)
      [46.0242, 7.7485], // Zermatt
    ],
  },
  {
    routeId: 'GGB-BAHN',
    lineName: 'GGB Gornergratbahn Zermatt – Findelbach – Riffelalp – Riffelberg – Rotenboden – Gornergrat (3089 m)',
    agency: 'Gornergrat Bahn (GGB)',
    routeType: 'rail',
    routeColor: '#D45D00',
    headsigns: ['Gornergrat', 'Zermatt GGB'],
    speedMps: 7.5,
    cycleSec: 1200,
    vehiclesCount: 3,
    stops: [
      'Zermatt GGB',
      'Findelbach',
      'Riffelalp',
      'Riffelboden',
      'Riffelberg',
      'Rotenboden',
      'Gornergrat',
    ],
    waypoints: [
      [46.0238, 7.7492], // Zermatt GGB (1605 m)
      [46.0125, 7.7568], // Findelbach (1770 m)
      [46.0012, 7.7515], // Riffelalp (2211 m)
      [45.9935, 7.7528], // Riffelboden (2348 m)
      [45.9832, 7.7595], // Riffelberg (2582 m)
      [45.9818, 7.7755], // Rotenboden (2815 m)
      [45.9836, 7.7845], // Gornergrat (3089 m)
    ],
  },
  {
    routeId: 'JB-BAHN',
    lineName: 'JB Jungfraubahn Kleine Scheidegg – Eigergletscher – Eigerwand – Eismeer – Jungfraujoch (Top of Europe 3454 m)',
    agency: 'Jungfraubahn (JB)',
    routeType: 'rail',
    routeColor: '#004B87',
    headsigns: ['Jungfraujoch', 'Kleine Scheidegg'],
    speedMps: 7.0,
    cycleSec: 1100,
    vehiclesCount: 3,
    stops: [
      'Kleine Scheidegg',
      'Fallboden',
      'Eigergletscher',
      'Rotstock',
      'Eigerwand',
      'Eismeer',
      'Jungfraujoch (3454 m)',
    ],
    waypoints: [
      [46.5855, 7.9612], // Kleine Scheidegg (2061 m)
      [46.5795, 7.9698], // Fallboden
      [46.5758, 7.9745], // Eigergletscher (2320 m)
      [46.5802, 7.9895], // Rotstock (Eiger-Nordwand-Tunnel)
      [46.5785, 8.0015], // Eigerwand (2865 m)
      [46.5658, 8.0042], // Eismeer (3160 m)
      [46.5475, 7.9806], // Jungfraujoch – Top of Europe (3454 m)
    ],
  },
  {
    routeId: 'WAB-BAHN',
    lineName: 'WAB Wengernalpbahn Lauterbrunnen – Wengen – Wengernalp – Kleine Scheidegg – Alpiglen – Grindelwald',
    agency: 'Wengernalpbahn (WAB)',
    routeType: 'rail',
    routeColor: '#007A33',
    headsigns: ['Grindelwald', 'Lauterbrunnen'],
    speedMps: 8.5,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: [
      'Lauterbrunnen',
      'Witimatte',
      'Wengen',
      'Allmend',
      'Wengernalp',
      'Kleine Scheidegg',
      'Alpiglen',
      'Brandegg',
      'Grindelwald Grund',
      'Grindelwald',
    ],
    waypoints: [
      [46.5982, 7.9078], // Lauterbrunnen (796 m)
      [46.6052, 7.9112], // Witimatte
      [46.6055, 7.9218], // Wengen (1274 m)
      [46.5938, 7.9365], // Allmend
      [46.5842, 7.9445], // Wengernalp (1874 m)
      [46.5855, 7.9612], // Kleine Scheidegg (2061 m)
      [46.6025, 7.9892], // Alpiglen (1616 m)
      [46.6122, 8.0068], // Brandegg (1332 m)
      [46.6185, 8.0245], // Grindelwald Grund (943 m)
      [46.6245, 8.0332], // Grindelwald (1034 m)
    ],
  },
  {
    routeId: 'PB-BAHN',
    lineName: 'PB Pilatusbahn Alpnachstad – Wolfort – Ämsigen – Mattalp – Pilatus Kulm (48% Steigung)',
    agency: 'Pilatus-Bahnen AG (PB)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Pilatus Kulm', 'Alpnachstad PB'],
    speedMps: 6.5,
    cycleSec: 900,
    vehiclesCount: 2,
    stops: [
      'Alpnachstad PB',
      'Wolfort',
      'Ämsigen',
      'Mattalp',
      'Eselwand',
      'Pilatus Kulm',
    ],
    waypoints: [
      [46.9555, 8.2775], // Alpnachstad PB (440 m)
      [46.9612, 8.2712], // Wolfort (900 m)
      [46.9658, 8.2652], // Ämsigen (1355 m)
      [46.9708, 8.2595], // Mattalp (1600 m)
      [46.9752, 8.2562], // Eselwand
      [46.9792, 8.2538], // Pilatus Kulm (2073 m)
    ],
  },
  {
    routeId: 'RB-RIGIBAHN',
    lineName: 'RB Rigi Bahnen Vitznau – Freibergen – Romiti Felsentor – Rigi Kaltbad – Rigi Staffel – Rigi Kulm',
    agency: 'Rigi Bahnen AG (RB)',
    routeType: 'rail',
    routeColor: '#005A9C',
    headsigns: ['Rigi Kulm', 'Vitznau'],
    speedMps: 7.5,
    cycleSec: 1100,
    vehiclesCount: 3,
    stops: [
      'Vitznau',
      'Mittlerschwanden',
      'Grubisbalm',
      'Freibergen',
      'Romiti Felsentor',
      'Rigi Kaltbad-First',
      'Rigi Staffelhöhe',
      'Rigi Staffel',
      'Rigi Kulm',
    ],
    waypoints: [
      [47.0092, 8.4842], // Vitznau (435 m)
      [47.0185, 8.4815], // Mittlerschwanden
      [47.0248, 8.4775], // Grubisbalm
      [47.0322, 8.4735], // Freibergen (1030 m)
      [47.0382, 8.4698], // Romiti Felsentor (1195 m)
      [47.0445, 8.4672], // Rigi Kaltbad-First (1453 m)
      [47.0492, 8.4728], // Rigi Staffelhöhe (1550 m)
      [47.0518, 8.4775], // Rigi Staffel (1603 m)
      [47.0565, 8.4848], // Rigi Kulm (1752 m)
    ],
  },
  {
    routeId: 'ZB-BAHN',
    lineName: 'ZB Zentralbahn Luzern-Engelberg-Express Luzern – Hergiswil – Stans – Dallenwil – Wolfenschiessen – Grafenort – Engelberg',
    agency: 'Zentralbahn (zb)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Engelberg', 'Luzern'],
    speedMps: 19.0,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: [
      'Luzern',
      'Luzern Allmend/Messe',
      'Kriens Mattenhof',
      'Horw',
      'Hergiswil NW',
      'Stansstad',
      'Stans',
      'Dallenwil',
      'Wolfenschiessen',
      'Grafenort',
      'Engelberg',
    ],
    waypoints: [
      [47.0502, 8.3102], // Luzern
      [47.0342, 8.3052], // Luzern Allmend/Messe
      [47.0252, 8.3028], // Kriens Mattenhof
      [47.0182, 8.3085], // Horw
      [46.9852, 8.3125], // Hergiswil NW
      [46.9768, 8.3385], // Stansstad
      [46.9585, 8.3652], // Stans
      [46.9322, 8.3895], // Dallenwil
      [46.9088, 8.3965], // Wolfenschiessen
      [46.8712, 8.3745], // Grafenort
      [46.8425, 8.3825], // Steinstössi (Tunnel Engelberg)
      [46.8202, 8.4018], // Engelberg
    ],
  },
  {
    routeId: 'MOB-BAHN-GPX',
    lineName: 'MOB GoldenPass Express Montreux – Chamby – Les Avants – Montbovon – Château-d’Oex – Gstaad – Saanenmöser – Zweisimmen',
    agency: 'Montreux-Berner Oberland-Bahn (MOB)',
    routeType: 'rail',
    routeColor: '#1B365D',
    headsigns: ['Zweisimmen', 'Montreux'],
    speedMps: 16.5,
    cycleSec: 2100,
    vehiclesCount: 4,
    stops: [
      'Montreux',
      'Chamby',
      'Les Avants',
      'Allières',
      'Montbovon',
      'Rossinière',
      'Château-d’Oex',
      'Rougemont',
      'Saanen',
      'Gstaad',
      'Schönried',
      'Saanenmöser',
      'Oeschseite',
      'Zweisimmen',
    ],
    waypoints: [
      [46.4358, 6.9108], // Montreux
      [46.4488, 6.9312], // Chamby
      [46.4518, 6.9495], // Les Avants
      [46.4635, 6.9752], // Jor (Tunnel de Jaman)
      [46.4758, 7.0125], // Allières
      [46.4865, 7.0438], // Montbovon
      [46.4672, 7.0865], // Rossinière
      [46.4742, 7.1355], // Château-d’Oex
      [46.4872, 7.2065], // Rougemont
      [46.4892, 7.2608], // Saanen
      [46.4722, 7.2858], // Gstaad
      [46.5015, 7.2862], // Schönried
      [46.5128, 7.3025], // Saanenmöser
      [46.5315, 7.3392], // Oeschseite
      [46.5542, 7.3728], // Zweisimmen
    ],
  },
  {
    routeId: 'TGV-LYRIA',
    lineName: 'TGV Lyria 9200 Zürich HB – Basel SBB – Mulhouse-Ville – Belfort-Montbéliard TGV – Dijon-Ville – Paris Gare de Lyon',
    agency: 'TGV Lyria (SBB / SNCF Voyageurs)',
    routeType: 'rail',
    routeColor: '#C5003E',
    headsigns: ['Paris Gare de Lyon', 'Zürich HB'],
    speedMps: 52.0,
    cycleSec: 9600,
    vehiclesCount: 5,
    stops: [
      'Zürich HB',
      'Basel SBB',
      'Mulhouse-Ville',
      'Belfort – Montbéliard TGV',
      'Besançon Franche-Comté TGV',
      'Dijon-Ville',
      'Montbard',
      'Paris Gare de Lyon',
    ],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.4792, 8.2065], // Baden
      [47.5082, 8.0195], // Frick (Bözberg)
      [47.4842, 7.7314], // Liestal
      [47.5474, 7.5896], // Basel SBB
      [47.5908, 7.5562], // Saint-Louis
      [47.7425, 7.3432], // Mulhouse-Ville
      [47.5852, 6.8975], // Belfort – Montbéliard TGV
      [47.3072, 5.9535], // Besançon Franche-Comté TGV
      [47.3238, 5.0272], // Dijon-Ville
      [47.6192, 4.3358], // Montbard
      [47.9615, 3.5128], // Laroche-Migennes (LGV Sud-Est)
      [48.1985, 3.2682], // Sens (LGV Sud-Est)
      [48.6258, 2.5592], // Lieusaint-Moissy (LGV Sud-Est)
      [48.8443, 2.3744], // Paris Gare de Lyon
    ],
  },
  {
    routeId: 'EC-FRECCIAROSSA',
    lineName: 'Trenitalia Frecciarossa 1000 AV Milano Centrale – Reggio Emilia AV – Bologna Centrale – Firenze SMN – Roma Termini',
    agency: 'Trenitalia (Le Frecce)',
    routeType: 'rail',
    routeColor: '#C8102E',
    headsigns: ['Roma Termini', 'Milano Centrale'],
    speedMps: 52.0,
    cycleSec: 9200,
    vehiclesCount: 6,
    stops: [
      'Milano Centrale',
      'Milano Rogoredo',
      'Reggio Emilia AV Mediopadana',
      'Bologna Centrale AV',
      'Firenze Santa Maria Novella',
      'Roma Tiburtina',
      'Roma Termini',
    ],
    waypoints: [
      [45.4862, 9.2045], // Milano Centrale
      [45.4338, 9.2385], // Milano Rogoredo
      [45.0532, 9.7082], // Piacenza AV
      [44.7248, 10.6552], // Reggio Emilia AV Mediopadana
      [44.6552, 10.9312], // Modena AV
      [44.5062, 11.3435], // Bologna Centrale AV
      [44.0852, 11.3325], // Mugello / Galleria Appenninica AV
      [43.7764, 11.2478], // Firenze Santa Maria Novella
      [43.4612, 11.8725], // Arezzo (Direttissima)
      [43.0058, 11.9562], // Chiusi (Direttissima)
      [42.7252, 12.1268], // Orvieto (Direttissima)
      [42.4562, 12.3915], // Orte (Direttissima)
      [41.9102, 12.5312], // Roma Tiburtina
      [41.9012, 12.5018], // Roma Termini
    ],
  },
  {
    routeId: 'NJ-467',
    lineName: 'ÖBB Nightjet NJ 466/467 Zürich HB – Sargans – Buchs SG – Feldkirch – Bludenz – Innsbruck Hbf – Salzburg Hbf – Linz Hbf – Wien Hbf',
    agency: 'ÖBB Nightjet / SBB',
    routeType: 'rail',
    routeColor: '#141E55',
    headsigns: ['Wien Hbf', 'Zürich HB'],
    speedMps: 38.0,
    cycleSec: 12000,
    vehiclesCount: 5,
    stops: [
      'Zürich HB',
      'Sargans',
      'Buchs SG',
      'Feldkirch',
      'Bludenz',
      'St. Anton am Arlberg',
      'Landeck-Zams',
      'Innsbruck Hbf',
      'Wörgl Hbf',
      'Salzburg Hbf',
      'Linz Hbf',
      'St. Pölten Hbf',
      'Wien Meidling',
      'Wien Hbf',
    ],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.2012, 8.7785], // Pfäffikon SZ
      [47.1362, 9.0602], // Ziegelbrücke
      [47.0452, 9.4425], // Sargans
      [47.1672, 9.4778], // Buchs SG
      [47.1684, 9.5088], // Schaan-Vaduz
      [47.2412, 9.5978], // Feldkirch
      [47.1525, 9.8162], // Bludenz
      [47.1312, 10.1215], // Langen am Arlberg
      [47.1292, 10.2645], // St. Anton am Arlberg
      [47.1492, 10.5765], // Landeck-Zams
      [47.2402, 10.8658], // Ötztal
      [47.2632, 11.4010], // Innsbruck Hbf
      [47.3888, 11.7815], // Jenbach
      [47.4918, 12.0585], // Wörgl Hbf
      [47.8502, 12.1192], // Rosenheim (Deutsches Eck)
      [47.8129, 13.0456], // Salzburg Hbf
      [48.0125, 13.7215], // Attnang-Puchheim
      [48.1662, 14.0268], // Wels Hbf
      [48.2905, 14.2918], // Linz Hbf
      [48.1218, 14.8778], // Amstetten
      [48.2082, 15.6238], // St. Pölten Hbf
      [48.1748, 16.3335], // Wien Meidling
      [48.1851, 16.3764], // Wien Hbf
    ],
  },
  // --- WAVE 16: LÉMAN EXPRESS, NORTHWEST SWITZERLAND (TNW) & BERN / MITTELLAND S-BAHN ---
  {
    routeId: 'LEX-RL1',
    lineName: 'Léman Express RL1 Coppet – Versoix – Genève Cornavin – Genève-Eaux-Vives – Annemasse – Thonon-les-Bains – Évian-les-Bains',
    agency: 'Lémanis (SBB CFF FFS / SNCF)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Évian-les-Bains', 'Coppet'],
    speedMps: 25.0,
    cycleSec: 2800,
    vehiclesCount: 5,
    stops: [
      'Coppet',
      'Pont-Céard',
      'Versoix',
      'Creux-de-Genthod',
      'Genève-Sécheron',
      'Genève Cornavin',
      'Lancy-Pont-Rouge',
      'Lancy-Bachet',
      'Genève-Champel',
      'Genève-Eaux-Vives',
      'Chêne-Bourg',
      'Annemasse',
      'Machilly',
      'Bons-en-Chablais',
      'Perrignier',
      'Thonon-les-Bains',
      'Amphion-les-Bains',
      'Évian-les-Bains',
    ],
    waypoints: [
      [46.3175, 6.1878], // Coppet
      [46.2925, 6.1708], // Pont-Céard
      [46.2792, 6.1645], // Versoix
      [46.2588, 6.1582], // Creux-de-Genthod
      [46.2225, 6.1445], // Genève-Sécheron
      [46.2102, 6.1424], // Genève Cornavin
      [46.1888, 6.1255], // Lancy-Pont-Rouge
      [46.1742, 6.1292], // Lancy-Bachet
      [46.1922, 6.1538], // Genève-Champel
      [46.2008, 6.1658], // Genève-Eaux-Vives
      [46.1958, 6.1945], // Chêne-Bourg
      [46.1992, 6.2368], // Annemasse
      [46.2512, 6.3275], // Machilly
      [46.2695, 6.3688], // Bons-en-Chablais
      [46.3065, 6.4392], // Perrignier
      [46.3688, 6.4828], // Thonon-les-Bains
      [46.3945, 6.5512], // Amphion-les-Bains
      [46.4008, 6.5832], // Évian-les-Bains
    ],
  },
  {
    routeId: 'LEX-RL4',
    lineName: 'Léman Express RL4 / RL2 Genève Cornavin – Genève-Eaux-Vives – Annemasse – Reignier – La Roche-sur-Foron – Groisy – Pringy – Annecy',
    agency: 'Lémanis (SBB CFF FFS / SNCF)',
    routeType: 'rail',
    routeColor: '#0072CE',
    headsigns: ['Annecy', 'Genève Cornavin / Coppet'],
    speedMps: 24.5,
    cycleSec: 2700,
    vehiclesCount: 4,
    stops: [
      'Genève Cornavin',
      'Lancy-Pont-Rouge',
      'Lancy-Bachet',
      'Genève-Champel',
      'Genève-Eaux-Vives',
      'Chêne-Bourg',
      'Annemasse',
      'Reignier',
      'La Roche-sur-Foron',
      'Groisy – Thorens – la-Caille',
      'Pringy',
      'Annecy',
    ],
    waypoints: [
      [46.2102, 6.1424], // Genève Cornavin
      [46.1888, 6.1255], // Lancy-Pont-Rouge
      [46.1742, 6.1292], // Lancy-Bachet
      [46.1922, 6.1538], // Genève-Champel
      [46.2008, 6.1658], // Genève-Eaux-Vives
      [46.1958, 6.1945], // Chêne-Bourg
      [46.1992, 6.2368], // Annemasse
      [46.1332, 6.2715], // Reignier
      [46.0695, 6.3068], // La Roche-sur-Foron
      [46.0125, 6.1825], // Groisy – Thorens – la-Caille
      [45.9462, 6.1218], // Pringy
      [45.9022, 6.1215], // Annecy
    ],
  },
  {
    routeId: 'TNW-S1',
    lineName: 'S-Bahn Basel TNW S1 Basel SBB – Muttenz – Pratteln – Kaiseraugst – Rheinfelden – Möhlin – Stein-Säckingen – Frick',
    agency: 'SBB CFF FFS (Trireno TNW)',
    routeType: 'rail',
    routeColor: '#0080C6',
    headsigns: ['Frick', 'Basel SBB'],
    speedMps: 24.5,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: [
      'Basel SBB',
      'Muttenz',
      'Pratteln',
      'Salina Raurica',
      'Kaiseraugst',
      'Rheinfelden',
      'Rheinfelden Augarten',
      'Möhlin',
      'Mumpf',
      'Stein-Säckingen',
      'Eiken',
      'Frick',
    ],
    waypoints: [
      [47.5474, 7.5896], // Basel SBB
      [47.5338, 7.6482], // Muttenz
      [47.5228, 7.6925], // Pratteln
      [47.5295, 7.7218], // Salina Raurica
      [47.5372, 7.7265], // Kaiseraugst
      [47.5515, 7.7928], // Rheinfelden
      [47.5518, 7.8185], // Rheinfelden Augarten
      [47.5655, 7.8442], // Möhlin
      [47.5458, 7.9195], // Mumpf
      [47.5415, 7.9492], // Stein-Säckingen
      [47.5322, 7.9885], // Eiken
      [47.5082, 8.0195], // Frick
    ],
  },
  {
    routeId: 'TNW-S3',
    lineName: 'S-Bahn Basel TNW S3 Olten – Gelterkinden – Sissach – Liestal – Pratteln – Basel SBB – Dornach-Arlesheim – Aesch – Laufen – Delémont',
    agency: 'SBB CFF FFS (Trireno TNW)',
    routeType: 'rail',
    routeColor: '#F39200',
    headsigns: ['Delémont / Porrentruy', 'Olten'],
    speedMps: 25.5,
    cycleSec: 2800,
    vehiclesCount: 5,
    stops: [
      'Olten',
      'Tecknau',
      'Gelterkinden',
      'Sissach',
      'Lausen',
      'Liestal',
      'Frenkendorf-Füllinsdorf',
      'Pratteln',
      'Muttenz',
      'Basel SBB',
      'Basel Dreispitz',
      'Münchenstein',
      'Dornach-Arlesheim',
      'Aesch BL',
      'Grellingen',
      'Zwingen',
      'Laufen',
      'Delémont',
    ],
    waypoints: [
      [47.3519, 7.9078], // Olten
      [47.4192, 7.8845], // Tecknau (Hauenstein-Basistunnel Nord)
      [47.4658, 7.8492], // Gelterkinden
      [47.4632, 7.8125], // Sissach
      [47.4718, 7.7605], // Lausen
      [47.4842, 7.7314], // Liestal
      [47.5032, 7.7185], // Frenkendorf-Füllinsdorf
      [47.5228, 7.6925], // Pratteln
      [47.5338, 7.6482], // Muttenz
      [47.5474, 7.5896], // Basel SBB
      [47.5315, 7.6085], // Basel Dreispitz
      [47.5162, 7.6188], // Münchenstein
      [47.4922, 7.6162], // Dornach-Arlesheim
      [47.4708, 7.6032], // Aesch BL
      [47.4425, 7.5902], // Grellingen
      [47.4368, 7.5295], // Zwingen
      [47.4192, 7.5028], // Laufen
      [47.3618, 7.3502], // Delémont
    ],
  },
  {
    routeId: 'RBS-S7',
    lineName: 'RBS S-Bahn Bern S7 Bern RBS – Tiefenau – Worblaufen – Papiermühle – Ittigen – Bolligen – Boll-Utzigen – Worb Dorf',
    agency: 'Regionalverkehr Bern-Solothurn (RBS)',
    routeType: 'rail',
    routeColor: '#FF6600',
    headsigns: ['Worb Dorf', 'Bern RBS'],
    speedMps: 15.5,
    cycleSec: 1200,
    vehiclesCount: 4,
    stops: [
      'Bern RBS',
      'Tiefenau',
      'Worblaufen',
      'Papiermühle',
      'Ittigen',
      'Bolligen',
      'Boll-Utzigen',
      'Stettlen',
      'Deisswil',
      'Worbboden',
      'Worb Dorf',
    ],
    waypoints: [
      [46.9492, 7.4385], // Bern RBS (Tiefbahnhof)
      [46.9685, 7.4525], // Tiefenau
      [46.9762, 7.4488], // Worblaufen
      [46.9718, 7.4682], // Papiermühle
      [46.9735, 7.4795], // Ittigen
      [46.9742, 7.4988], // Bolligen
      [46.9665, 7.5542], // Boll-Utzigen
      [46.9562, 7.5358], // Stettlen
      [46.9492, 7.5322], // Deisswil
      [46.9388, 7.5495], // Worbboden
      [46.9302, 7.5645], // Worb Dorf
    ],
  },
  {
    routeId: 'BLS-S1',
    lineName: 'BLS S-Bahn Bern S1 Fribourg/Freiburg – Düdingen – Flamatt – Thörishaus – Bern Westside – Bern – Ostermundigen – Gümligen – Münsingen – Uttigen – Thun',
    agency: 'BLS AG',
    routeType: 'rail',
    routeColor: '#0066B3',
    headsigns: ['Thun', 'Fribourg/Freiburg'],
    speedMps: 24.5,
    cycleSec: 2600,
    vehiclesCount: 6,
    stops: [
      'Fribourg/Freiburg',
      'Düdingen',
      'Schmitten',
      'Wünnewil',
      'Flamatt',
      'Thörishaus Station',
      'Oberwangen',
      'Niederwangen',
      'Bern Bümpliz Süd',
      'Bern Europaplatz',
      'Bern',
      'Ostermundigen',
      'Gümligen',
      'Rubigen',
      'Münsingen',
      'Wichtrach',
      'Kiesen',
      'Uttigen',
      'Thun',
    ],
    waypoints: [
      [46.8031, 7.1512], // Fribourg/Freiburg
      [46.8465, 7.1895], // Düdingen
      [46.8592, 7.2512], // Schmitten
      [46.8748, 7.2795], // Wünnewil
      [46.8892, 7.3185], // Flamatt
      [46.8965, 7.3522], // Thörishaus Station
      [46.9125, 7.3728], // Oberwangen
      [46.9248, 7.3895], // Niederwangen
      [46.9378, 7.3962], // Bern Bümpliz Süd
      [46.9438, 7.4165], // Bern Europaplatz
      [46.9488, 7.4391], // Bern
      [46.9558, 7.4822], // Ostermundigen
      [46.9322, 7.5152], // Gümligen
      [46.8985, 7.5458], // Rubigen
      [46.8732, 7.5588], // Münsingen
      [46.8425, 7.5762], // Wichtrach
      [46.8178, 7.5892], // Kiesen
      [46.7928, 7.5855], // Uttigen
      [46.7545, 7.6295], // Thun
    ],
  },
  // --- WAVE 18: SWISS URBAN TRAM CORRIDORS (ZÜRICH, BASEL TRINATIONAL, BERN, GENÈVE) ---
  {
    routeId: 'VBZ-Tram-11',
    lineName: 'VBZ Zürich Tram 11 Auzelg – Oerlikon – Bucheggplatz – Hauptbahnhof – Paradeplatz – Bellevue – Balgrist – Rehalp',
    agency: 'Verkehrsbetriebe Zürich (VBZ)',
    routeType: 'tram',
    routeColor: '#009640',
    headsigns: ['Rehalp', 'Auzelg'],
    speedMps: 9.5,
    cycleSec: 1800,
    vehiclesCount: 5,
    stops: [
      'Auzelg',
      'Fernsehstudio',
      'Messe/Hallenstadion',
      'Sternen Oerlikon',
      'Bahnhof Oerlikon',
      'Regensbergbrücke',
      'Bucheggplatz',
      'Schaffhauserplatz',
      'Stampfenbachplatz',
      'Bahnhofquai/HB',
      'Rennweg',
      'Paradeplatz',
      'Bürkliplatz',
      'Bellevue',
      'Bahnhof Stadelhofen',
      'Kreuzplatz',
      'Hegibachplatz',
      'Balgrist',
      'Rehalp',
    ],
    waypoints: [
      [47.4172, 8.5695], // Auzelg
      [47.4148, 8.5612], // Fernsehstudio
      [47.4112, 8.5528], // Messe/Hallenstadion
      [47.4102, 8.5462], // Sternen Oerlikon
      [47.4115, 8.5442], // Bahnhof Oerlikon
      [47.4058, 8.5405], // Regensbergbrücke
      [47.3978, 8.5342], // Bucheggplatz
      [47.3895, 8.5385], // Schaffhauserplatz
      [47.3832, 8.5392], // Stampfenbachplatz
      [47.3779, 8.5403], // Bahnhofquai/HB (Zürich Hauptbahnhof)
      [47.3732, 8.5388], // Rennweg
      [47.3697, 8.5389], // Paradeplatz
      [47.3662, 8.5412], // Bürkliplatz
      [47.3669, 8.5451], // Bellevue
      [47.3665, 8.5485], // Bahnhof Stadelhofen
      [47.3618, 8.5605], // Kreuzplatz
      [47.3582, 8.5668], // Hegibachplatz
      [47.3542, 8.5738], // Balgrist
      [47.3518, 8.5795], // Rehalp
    ],
  },
  {
    routeId: 'BVB-Tram-8',
    lineName: 'BVB Basel Tram 8 Neuweilerstrasse – Bahnhof SBB – Barfüsserplatz – Claraplatz – Kleinhüningen – Weil am Rhein Bahnhof/Zentrum',
    agency: 'Basler Verkehrs-Betriebe (BVB)',
    routeType: 'tram',
    routeColor: '#00843D',
    headsigns: ['Weil am Rhein Bahnhof/Zentrum', 'Neuweilerstrasse'],
    speedMps: 9.8,
    cycleSec: 1800,
    vehiclesCount: 5,
    stops: [
      'Neuweilerstrasse',
      'Neubad',
      'Schützenhaus',
      'Zoo Bachletten',
      'Bahnhof SBB',
      'Aeschenplatz',
      'Bankverein',
      'Barfüsserplatz',
      'Marktplatz',
      'Schifflände',
      'Claraplatz',
      'Kaserne',
      'Dreirosenbrücke',
      'Kleinhüningen',
      'Weil am Rhein Grenze',
      'Weil am Rhein Dreiländerbrücke',
      'Weil am Rhein Bahnhof/Zentrum',
    ],
    waypoints: [
      [47.5378, 7.5542], // Neuweilerstrasse
      [47.5415, 7.5648], // Neubad
      [47.5462, 7.5712], // Schützenhaus
      [47.5468, 7.5795], // Zoo Bachletten
      [47.5476, 7.5896], // Bahnhof SBB
      [47.5515, 7.5948], // Aeschenplatz
      [47.5532, 7.5918], // Bankverein
      [47.5546, 7.5891], // Barfüsserplatz
      [47.5584, 7.5878], // Marktplatz
      [47.5602, 7.5872], // Schifflände
      [47.5618, 7.5955], // Claraplatz
      [47.5662, 7.5915], // Kaserne
      [47.5708, 7.5898], // Dreirosenbrücke
      [47.5795, 7.5912], // Kleinhüningen
      [47.5882, 7.5965], // Weil am Rhein Grenze
      [47.5912, 7.6025], // Weil am Rhein Dreiländerbrücke
      [47.5942, 7.6095], // Weil am Rhein Bahnhof/Zentrum
    ],
  },
  {
    routeId: 'BERNMOBIL-Tram-9',
    lineName: 'BERNMOBIL Tram 9 Wankdorf Bahnhof – Guisanplatz – Kursaal – Kornhausplatz – Bahnhof Bern – Gurtenbahn – Wabern',
    agency: 'BERNMOBIL',
    routeType: 'tram',
    routeColor: '#004B87',
    headsigns: ['Wabern', 'Wankdorf Bahnhof'],
    speedMps: 9.5,
    cycleSec: 1500,
    vehiclesCount: 4,
    stops: [
      'Wankdorf Bahnhof',
      'Wankdorfplatz',
      'Guisanplatz Expo',
      'Breitenrain',
      'Viktoriaplatz',
      'Kursaal',
      'Kornhausplatz',
      'Zytglogge',
      'Bärenplatz',
      'Bahnhof Bern',
      'Hirschengraben',
      'Monbijou',
      'Wander',
      'Sandrain',
      'Gurtenbahn',
      'Wabern',
    ],
    waypoints: [
      [46.9681, 7.4638], // Wankdorf Bahnhof
      [46.9642, 7.4632], // Wankdorfplatz
      [46.9605, 7.4608], // Guisanplatz Expo
      [46.9568, 7.4545], // Breitenrain
      [46.9542, 7.4512], // Viktoriaplatz
      [46.9522, 7.4488], // Kursaal
      [46.9488, 7.4475], // Kornhausplatz / Zytglogge
      [46.9482, 7.4438], // Bärenplatz
      [46.9488, 7.4404], // Bahnhof Bern
      [46.9462, 7.4382], // Hirschengraben
      [46.9412, 7.4388], // Monbijou
      [46.9368, 7.4375], // Wander
      [46.9325, 7.4422], // Sandrain
      [46.9282, 7.4485], // Gurtenbahn
      [46.9272, 7.4548], // Wabern
    ],
  },
  {
    routeId: 'TPG-Tram-12',
    lineName: 'TPG Genève Tram 12 Lancy-Bachet-Gare – Carouge – Plainpalais – Bel-Air – Rive – Moillesulaz',
    agency: 'Transports publics genevois (TPG)',
    routeType: 'tram',
    routeColor: '#F39200',
    headsigns: ['Thônex, Moillesulaz', 'Lancy-Bachet-Gare'],
    speedMps: 9.5,
    cycleSec: 1600,
    vehiclesCount: 5,
    stops: [
      'Lancy-Bachet-Gare',
      'Trèfle-Blanc',
      'Carouge-Rondeau',
      'Carouge-Marché',
      'Augustins',
      'Pont-d’Arve',
      'Plainpalais',
      'Place de Neuve',
      'Bel-Air',
      'Molard',
      'Rive',
      'Terrassière',
      'Genève-Eaux-Vives-Gare',
      'Grange-Canal',
      'Chêne-Bourg',
      'Graveson',
      'Moillesulaz',
    ],
    waypoints: [
      [46.1742, 6.1292], // Lancy-Bachet-Gare
      [46.1788, 6.1345], // Trèfle-Blanc
      [46.1825, 6.1392], // Carouge-Rondeau
      [46.1852, 6.1402], // Carouge-Marché
      [46.1912, 6.1425], // Augustins
      [46.1948, 6.1432], // Pont-d’Arve
      [46.1978, 6.1418], // Plainpalais
      [46.2012, 6.1435], // Place de Neuve
      [46.2044, 6.1432], // Bel-Air
      [46.2032, 6.1485], // Molard
      [46.2018, 6.1545], // Rive
      [46.2012, 6.1598], // Terrassière
      [46.2008, 6.1658], // Genève-Eaux-Vives-Gare
      [46.1992, 6.1775], // Grange-Canal
      [46.1958, 6.1945], // Chêne-Bourg
      [46.1938, 6.2008], // Graveson
      [46.1925, 6.2058], // Moillesulaz
    ],
  },
  // --- WAVE 21: RHB AROSA LINE, ZENTRALSCHWEIZ S1, BRÜNIG EXPRESS & LAUSANNE MÉTRO M2 ---
  {
    routeId: 'RHB-R4-AROSA',
    lineName: 'Rhätische Bahn (RhB) Arosalinie R4 Chur – Chur Altstadt – Lüen-Castiel – St. Peter-Molinis – Peist – Langwies – Litzirüti – Arosa',
    agency: 'Rhätische Bahn (RhB)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Arosa', 'Chur Bahnhofplatz'],
    speedMps: 13.5,
    cycleSec: 1800,
    vehiclesCount: 3,
    stops: [
      'Chur Bahnhofplatz',
      'Chur Altstadt',
      'Sassal',
      'Lüen-Castiel',
      'St. Peter-Molinis',
      'Peist',
      'Langwies',
      'Litzirüti',
      'Arosa',
    ],
    waypoints: [
      [46.8535, 9.5292], // Chur Bahnhofplatz (584 m)
      [46.8492, 9.5345], // Chur Altstadt (Plessurquai)
      [46.8415, 9.5562], // Sassal
      [46.8288, 9.6012], // Lüen-Castiel
      [46.8265, 9.6485], // St. Peter-Molinis
      [46.8295, 9.6742], // Peist
      [46.8208, 9.7052], // Langwies (Langwieser Viadukt 1317 m)
      [46.7945, 9.6928], // Litzirüti (1452 m)
      [46.7832, 9.6795], // Arosa (1739 m)
    ],
  },
  {
    routeId: 'SBB-S1-ZUG-LU',
    lineName: 'S-Bahn Zentralschweiz S1 Baar – Zug – Cham – Rotkreuz – Gisikon-Root – Ebikon – Luzern',
    agency: 'SBB CFF FFS',
    routeType: 'rail',
    routeColor: '#0066B3',
    headsigns: ['Luzern', 'Baar / Zug'],
    speedMps: 23.0,
    cycleSec: 1800,
    vehiclesCount: 5,
    stops: [
      'Baar',
      'Baar Lindenpark',
      'Zug',
      'Zug Schutzengel',
      'Zug Chollermüli',
      'Cham',
      'Hünenberg Zythus',
      'Hünenberg Chämleten',
      'Rotkreuz',
      'Gisikon-Root',
      'Root D4',
      'Buchrain',
      'Ebikon',
      'Luzern',
    ],
    waypoints: [
      [47.1958, 8.5262], // Baar
      [47.1865, 8.5198], // Baar Lindenpark
      [47.1736, 8.5152], // Zug
      [47.1778, 8.5015], // Zug Schutzengel
      [47.1852, 8.4828], // Zug Chollermüli
      [47.1795, 8.4612], // Cham
      [47.1688, 8.4485], // Hünenberg Zythus
      [47.1585, 8.4392], // Hünenberg Chämleten
      [47.1418, 8.4305], // Rotkreuz
      [47.1235, 8.4088], // Gisikon-Root
      [47.1088, 8.3845], // Root D4
      [47.0952, 8.3625], // Buchrain
      [47.0812, 8.3418], // Ebikon
      [47.0502, 8.3102], // Luzern
    ],
  },
  {
    routeId: 'ZB-IR-BRUENIG',
    lineName: 'Zentralbahn Luzern–Interlaken Express Luzern – Hergiswil – Sarnen – Giswil – Lungern – Brünig-Hasliberg – Meiringen – Brienz – Interlaken Ost',
    agency: 'Zentralbahn (zb)',
    routeType: 'rail',
    routeColor: '#C8102E',
    headsigns: ['Interlaken Ost', 'Luzern'],
    speedMps: 21.5,
    cycleSec: 2800,
    vehiclesCount: 4,
    stops: [
      'Luzern',
      'Hergiswil NW',
      'Alpnachstad',
      'Alpnach Dorf',
      'Sarnen',
      'Sachseln',
      'Giswil',
      'Kaiserstuhl OW',
      'Lungern',
      'Brünig-Hasliberg',
      'Meiringen',
      'Brienzwiler',
      'Brienz',
      'Oberried am Brienzersee',
      'Ringgenberg',
      'Interlaken Ost',
    ],
    waypoints: [
      [47.0502, 8.3102], // Luzern
      [46.9852, 8.3125], // Hergiswil NW
      [46.9555, 8.2775], // Alpnachstad
      [46.9408, 8.2725], // Alpnach Dorf
      [46.8962, 8.2458], // Sarnen
      [46.8685, 8.2382], // Sachseln
      [46.8358, 8.1842], // Giswil
      [46.8095, 8.1722], // Kaiserstuhl OW
      [46.7868, 8.1615], // Lungern
      [46.7565, 8.1378], // Brünig-Hasliberg (1002 m)
      [46.7268, 8.1842], // Meiringen
      [46.7462, 8.1015], // Brienzwiler
      [46.7542, 8.0385], // Brienz
      [46.7368, 7.9612], // Oberried am Brienzersee
      [46.7018, 7.8985], // Ringgenberg
      [46.6905, 7.8692], // Interlaken Ost
    ],
  },
  {
    routeId: 'TL-M2-LAUSANNE',
    lineName: 'Métro de Lausanne m2 Ouchy-Olympique – Jordils – Lausanne-Gare – Lausanne-Flon – Riponne-M. Béjart – CHUV – Sallaz – Vennes – Croisettes',
    agency: 'Transports publics de la région lausannoise (tl)',
    routeType: 'subway',
    routeColor: '#E30613',
    headsigns: ['Epalinges, Croisettes', 'Lausanne, Ouchy-Olympique'],
    speedMps: 12.5,
    cycleSec: 1200,
    vehiclesCount: 4,
    stops: [
      'Ouchy-Olympique',
      'Jordils',
      'Délices',
      'Grancy',
      'Lausanne-Gare',
      'Lausanne-Flon',
      'Riponne-M. Béjart',
      'Bessières',
      'Ours',
      'CHUV',
      'La Sallaz',
      'Fourmi',
      'Vennes',
      'Croisettes',
    ],
    waypoints: [
      [46.5072, 6.6265], // Ouchy-Olympique (373 m)
      [46.5112, 6.6282], // Jordils
      [46.5138, 6.6288], // Délices
      [46.5152, 6.6290], // Grancy
      [46.5168, 6.6291], // Lausanne-Gare
      [46.5208, 6.6305], // Lausanne-Flon
      [46.5238, 6.6328], // Riponne-M. Béjart
      [46.5218, 6.6382], // Bessières
      [46.5212, 6.6412], // Ours
      [46.5252, 6.6425], // CHUV
      [46.5338, 6.6468], // La Sallaz
      [46.5382, 6.6512], // Fourmi
      [46.5418, 6.6548], // Vennes
      [46.5462, 6.6602], // Croisettes (711 m)
    ],
  },
];

/**
 * Real corridors for `db-de` (Deutschland & Österreich)
 */
const DB_DE_CORRIDORS = [
  {
    routeId: 'ICE1',
    lineName: 'DB ICE München Hbf – Augsburg – Ulm – Stuttgart – Frankfurt Hbf – Köln Hbf',
    speedMps: 45.0,
    cycleSec: 9600,
    vehiclesCount: 6,
    stops: ['München Hbf', 'Augsburg Hbf', 'Ulm Hbf', 'Stuttgart Hbf', 'Mannheim Hbf', 'Frankfurt (Main) Hbf', 'Köln Hbf'],
    waypoints: [
      [48.1402, 11.5583], // München
      [48.3655, 10.8856], // Augsburg
      [48.3994, 9.9828], // Ulm
      [48.7841, 9.1816], // Stuttgart
      [49.4797, 8.4699], // Mannheim
      [50.1071, 8.6638], // Frankfurt
      [50.9432, 6.9586], // Köln
    ],
  },
  {
    routeId: 'ICE4',
    lineName: 'DB ICE Berlin Hbf – Halle – Erfurt – Nürnberg – München Hbf',
    speedMps: 46.0,
    cycleSec: 9600,
    vehiclesCount: 5,
    stops: ['Berlin Hbf', 'Halle (Saale) Hbf', 'Erfurt Hbf', 'Nürnberg Hbf', 'Ingolstadt Hbf', 'München Hbf'],
    waypoints: [
      [52.5251, 13.3694], // Berlin Hbf
      [51.4775, 11.9871], // Halle
      [50.9726, 11.0381], // Erfurt
      [49.4456, 11.0829], // Nürnberg
      [48.7445, 11.4372], // Ingolstadt
      [48.1402, 11.5583], // München Hbf
    ],
  },
  {
    routeId: 'RJX62',
    lineName: 'ÖBB Railjet Xpress Wien Hbf – Linz – Salzburg – Innsbruck – Feldkirch – Bregenz',
    speedMps: 42.0,
    cycleSec: 11400,
    vehiclesCount: 5,
    stops: ['Wien Hbf', 'St. Pölten', 'Linz Hbf', 'Salzburg Hbf', 'Innsbruck Hbf', 'Landeck-Zams', 'Bludenz', 'Feldkirch', 'Bregenz'],
    waypoints: [
      [48.1851, 16.3764], // Wien Hbf
      [48.2082, 15.6238], // St. Pölten
      [48.2905, 14.2918], // Linz
      [47.8129, 13.0456], // Salzburg
      [47.2632, 11.401], // Innsbruck
      [47.1492, 10.5765], // Landeck-Zams
      [47.1525, 9.8162], // Bludenz
      [47.2412, 9.5978], // Feldkirch
      [47.5031, 9.7408], // Bregenz
    ],
  },
  {
    routeId: 'ECE88',
    lineName: 'DB / SBB EuroCity-Express München Hbf – Memmingen – Lindau – Bregenz – St. Margrethen – Zürich HB',
    speedMps: 36.0,
    cycleSec: 6800,
    vehiclesCount: 4,
    stops: ['München Hbf', 'Buchloe', 'Memmingen', 'Lindau-Reutin', 'Bregenz', 'St. Margrethen SG', 'St. Gallen HB', 'Zürich HB'],
    waypoints: [
      [48.1402, 11.5583], // München
      [48.0398, 10.7265], // Buchloe
      [47.9838, 10.1872], // Memmingen
      [47.5492, 9.7082], // Lindau
      [47.5031, 9.7408], // Bregenz
      [47.4534, 9.6391], // St. Margrethen SG
      [47.4232, 9.3698], // St. Gallen HB
      [47.5003, 8.7241], // Winterthur
      [47.3779, 8.5403], // Zürich HB
    ],
  },
  {
    routeId: 'RE5',
    lineName: 'DB Regio Bodensee-Oberschwaben Friedrichshafen – Ravensburg – Biberach – Ulm – Stuttgart Hbf',
    speedMps: 27.0,
    cycleSec: 5400,
    vehiclesCount: 3,
    stops: ['Friedrichshafen Stadt', 'Ravensburg', 'Biberach (Riß)', 'Ulm Hbf', 'Göppingen', 'Stuttgart Hbf'],
    waypoints: [
      [47.6512, 9.4802],
      [47.7815, 9.6115],
      [48.0988, 9.7912],
      [48.3995, 9.9828],
      [48.7025, 9.6528],
      [48.7841, 9.1816],
    ],
  },
  {
    routeId: 'RB93',
    lineName: 'Bodensee-Gürtelbahn Lindau-Insel – Friedrichshafen – Überlingen – Radolfzell – Singen',
    speedMps: 21.5,
    cycleSec: 3600,
    vehiclesCount: 3,
    stops: ['Lindau-Insel', 'Friedrichshafen Stadt', 'Überlingen', 'Radolfzell', 'Singen (Hohentwiel)'],
    waypoints: [
      [47.5432, 9.6838],
      [47.6512, 9.4802],
      [47.7685, 9.1605],
      [47.7368, 8.9698],
      [47.7588, 8.8412],
    ],
  },
  {
    routeId: 'EC164',
    lineName: 'ÖBB / SBB EuroCity Transalpin Zürich HB – Sargans – Buchs SG – Feldkirch – Bludenz – St. Anton – Innsbruck',
    speedMps: 30.0,
    cycleSec: 6800,
    vehiclesCount: 3,
    stops: ['Zürich HB', 'Sargans', 'Buchs SG', 'Feldkirch', 'Bludenz', 'St. Anton am Arlberg', 'Innsbruck Hbf'],
    waypoints: [
      [47.3782, 8.5402],
      [47.2012, 8.7785],
      [47.0455, 9.4451],
      [47.1684, 9.4785],
      [47.2412, 9.5981],
      [47.1528, 9.8165],
      [47.1292, 10.2645],
      [47.1492, 10.5765],
      [47.2632, 11.401],
    ],
  },
  // --- ADDITIONAL AUSTRIAN, ARLBERG, BRENNER, BODENSEE & GERMAN RAIL CORRIDORS ---
  {
    routeId: 'RJX-ARLBERG',
    lineName: 'ÖBB Railjet Xpress Arlbergbahn Bludenz – Braz – Dalaas – Klösterle – Langen am Arlberg – St. Anton am Arlberg – Landeck-Zams – Imst-Pitztal – Ötztal – Telfs-Pfaffenhofen – Innsbruck Hbf',
    agency: 'ÖBB Personenverkehr',
    routeColor: '#C90016',
    headsigns: ['Innsbruck Hbf / Wien Hbf', 'Bludenz / Bregenz / Zürich HB'],
    speedMps: 31.0,
    cycleSec: 4200,
    vehiclesCount: 5,
    stops: ['Bludenz', 'Hintergasse', 'Braz', 'Dalaas', 'Wald am Arlberg', 'Klösterle', 'Langen am Arlberg', 'St. Anton am Arlberg', 'Pettneu', 'Flirsch', 'Pians', 'Landeck-Zams', 'Schönwies', 'Imst-Pitztal', 'Ötztal', 'Silz', 'Telfs-Pfaffenhofen', 'Zirl', 'Innsbruck Hbf'],
    waypoints: [
      [47.1525, 9.8162],  // Bludenz
      [47.1362, 9.9145],  // Braz
      [47.1292, 9.9942],  // Dalaas
      [47.1285, 10.0885], // Klösterle
      [47.1312, 10.1215], // Langen am Arlberg (West Portal Arlberg Tunnel)
      [47.1292, 10.2645], // St. Anton am Arlberg (East Portal Arlberg Tunnel)
      [47.1458, 10.3412], // Pettneu
      [47.1475, 10.4095], // Flirsch
      [47.1372, 10.5142], // Pians
      [47.1492, 10.5765], // Landeck-Zams
      [47.2058, 10.6592], // Schönwies
      [47.2185, 10.7422], // Imst-Pitztal
      [47.2402, 10.8658], // Ötztal
      [47.2692, 10.9315], // Silz
      [47.3025, 11.0785], // Telfs-Pfaffenhofen
      [47.2688, 11.2365], // Zirl
      [47.2632, 11.4010], // Innsbruck Hbf
    ],
  },
  {
    routeId: 'EC89-BRENNER',
    lineName: 'DB / ÖBB / Trenitalia EuroCity Brennerbahn Innsbruck Hbf – Matrei am Brenner – Steinach in Tirol – Gries – Brennero/Brenner – Vipiteno/Sterzing – Fortezza/Franzensfeste – Bressanone/Brixen – Chiusa/Klausen – Bolzano/Bozen',
    agency: 'ÖBB / DB Fernverkehr / Trenitalia',
    routeColor: '#D9001B',
    headsigns: ['Bolzano/Bozen / Verona / Bologna', 'Innsbruck Hbf / München Hbf'],
    speedMps: 29.5,
    cycleSec: 3800,
    vehiclesCount: 5,
    stops: ['Innsbruck Hbf', 'Unterberg-Stefansbrücke', 'Patsch', 'Matrei am Brenner', 'Steinach in Tirol', 'St. Jodok', 'Gries am Brenner', 'Brennero/Brenner', 'Terme di Brennero', 'Colle Isarco/Gossensaß', 'Vipiteno/Sterzing', 'Campo di Trens/Freienfeld', 'Fortezza/Franzensfeste', 'Bressanone/Brixen', 'Ponte Gardena/Waidbruck', 'Bolzano/Bozen'],
    waypoints: [
      [47.2632, 11.4010], // Innsbruck Hbf
      [47.2025, 11.4085], // Unterberg-Stefansbrücke
      [47.1312, 11.4535], // Matrei am Brenner
      [47.0908, 11.4662], // Steinach in Tirol
      [47.0622, 11.4915], // St. Jodok (StafflachLoop)
      [47.0418, 11.4882], // Gries am Brenner
      [47.0042, 11.5055], // Brennero/Brenner (Border Pass 1370 m)
      [46.9395, 11.4425], // Colle Isarco/Gossensaß
      [46.8938, 11.4392], // Vipiteno/Sterzing
      [46.7875, 11.6122], // Fortezza/Franzensfeste
      [46.7115, 11.6502], // Bressanone/Brixen
      [46.6392, 11.5698], // Chiusa/Klausen
      [46.5975, 11.5318], // Ponte Gardena/Waidbruck
      [46.4975, 11.3545], // Bolzano/Bozen
    ],
  },
  {
    routeId: 'RB31-BODENSEE',
    lineName: 'DB Regio Bodensee-Gürtelbahn Friedrichshafen Hafen – Friedrichshafen Stadt – Eriskirch – Langenargen – Kressbronn – Nonnenhorn – Wasserburg (Bodensee) – Lindau-Aeschach – Lindau-Insel',
    agency: 'DB Regio Baden-Württemberg',
    routeColor: '#EC0016',
    headsigns: ['Lindau-Insel', 'Friedrichshafen Hafen / Radolfzell'],
    speedMps: 21.0,
    cycleSec: 1600,
    vehiclesCount: 3,
    stops: ['Friedrichshafen Hafen', 'Friedrichshafen Stadt', 'Friedrichshafen Ost', 'Eriskirch', 'Langenargen', 'Kressbronn', 'Nonnenhorn', 'Wasserburg (Bodensee)', 'Enzisweiler', 'Lindau-Aeschach', 'Lindau-Insel'],
    waypoints: [
      [47.6495, 9.4808], // Friedrichshafen Hafen
      [47.6538, 9.4735], // Friedrichshafen Stadt
      [47.6525, 9.5015], // Friedrichshafen Ost
      [47.6308, 9.5322], // Eriskirch
      [47.6025, 9.5468], // Langenargen
      [47.5958, 9.5992], // Kressbronn
      [47.5762, 9.6155], // Nonnenhorn
      [47.5692, 9.6412], // Wasserburg (Bodensee)
      [47.5625, 9.6628], // Enzisweiler
      [47.5582, 9.6912], // Lindau-Aeschach
      [47.5432, 9.6838], // Lindau-Insel
    ],
  },
  {
    routeId: 'RE7-ALLGAEU',
    lineName: 'DB Regio / Arverio Allgäubahn Lindau-Insel – Lindau-Reutin – Hergatz – Wangen (Allgäu) – Kißlegg – Leutkirch – Memmingen – Buchloe – München Hbf',
    agency: 'Arverio Bayern / DB Regio',
    routeColor: '#006F9B',
    headsigns: ['München Hbf', 'Lindau-Insel'],
    speedMps: 29.0,
    cycleSec: 5400,
    vehiclesCount: 4,
    stops: ['Lindau-Insel', 'Lindau-Reutin', 'Hergatz', 'Wangen (Allgäu)', 'Kißlegg', 'Leutkirch', 'Aichstetten', 'Memmingen', 'Mindelheim', 'Buchloe', 'Kaufering', 'Geltendorf', 'München-Pasing', 'München Hbf'],
    waypoints: [
      [47.5432, 9.6838],  // Lindau-Insel
      [47.5492, 9.7082],  // Lindau-Reutin
      [47.6358, 9.7965],  // Hergatz
      [47.6852, 9.8315],  // Wangen (Allgäu)
      [47.7885, 9.8852],  // Kißlegg
      [47.8265, 10.0158], // Leutkirch
      [47.8922, 10.0785], // Aichstetten
      [47.9838, 10.1872], // Memmingen
      [48.0492, 10.4915], // Mindelheim
      [48.0398, 10.7265], // Buchloe
      [48.0842, 10.8588], // Kaufering
      [48.1065, 11.0268], // Geltendorf
      [48.1498, 11.4615], // München-Pasing
      [48.1402, 11.5583], // München Hbf
    ],
  },
  {
    routeId: 'RE96-ALLGAEU-SUED',
    lineName: 'DB Regio Südbahn/Allgäu Lindau-Insel – Hergatz – Röthenbach – Oberstaufen – Immenstadt – Sonthofen – Oberstdorf / Kempten (Allgäu) Hbf',
    agency: 'DB Regio Bayern',
    routeColor: '#EC0016',
    headsigns: ['Kempten (Allgäu) Hbf / Oberstdorf', 'Lindau-Insel'],
    speedMps: 24.5,
    cycleSec: 2800,
    vehiclesCount: 3,
    stops: ['Lindau-Insel', 'Heimenkirch', 'Hergatz', 'Röthenbach (Allgäu)', 'Oberstaufen', 'Immenstadt', 'Blaichach', 'Sonthofen', 'Fischen', 'Oberstdorf'],
    waypoints: [
      [47.5432, 9.6838],  // Lindau-Insel
      [47.6052, 9.8325],  // Heimenkirch
      [47.6358, 9.7965],  // Hergatz
      [47.6198, 9.9712],  // Röthenbach (Allgäu)
      [47.5562, 10.0218], // Oberstaufen
      [47.5612, 10.2195], // Immenstadt
      [47.5158, 10.2642], // Sonthofen
      [47.4562, 10.2715], // Fischen
      [47.4092, 10.2795], // Oberstdorf
    ],
  },
  {
    routeId: 'RE3-HOCHRHEIN',
    lineName: 'DB Regio Hochrheinbahn Basel Bad Bf – Rheinfelden (Baden) – Bad Säckingen – Waldshut – Tiengen – Schaffhausen – Singen (Hohentwiel) – Radolfzell – Friedrichshafen Stadt',
    agency: 'DB Regio Baden-Württemberg',
    routeColor: '#F39200',
    headsigns: ['Friedrichshafen Stadt', 'Basel Bad Bf'],
    speedMps: 27.5,
    cycleSec: 5200,
    vehiclesCount: 5,
    stops: ['Basel Bad Bf', 'Grenzach', 'Rheinfelden (Baden)', 'Bad Säckingen', 'Laufenburg (Baden) Ost', 'Waldshut', 'Tiengen (Hochrhein)', 'Erzingen (Baden)', 'Beringen Bad Bf', 'Schaffhausen', 'Singen (Hohentwiel)', 'Radolfzell', 'Überlingen Therme', 'Markdorf (Baden)', 'Friedrichshafen Stadt'],
    waypoints: [
      [47.5672, 7.6075], // Basel Bad Bf
      [47.5582, 7.7912], // Rheinfelden (Baden)
      [47.5535, 7.9482], // Bad Säckingen
      [47.5688, 8.0685], // Laufenburg (Baden)
      [47.6215, 8.2112], // Waldshut
      [47.6328, 8.2762], // Tiengen
      [47.6612, 8.4295], // Erzingen (Baden)
      [47.6983, 8.6328], // Schaffhausen
      [47.7588, 8.8412], // Singen (Hohentwiel)
      [47.7368, 8.9698], // Radolfzell
      [47.7685, 9.1605], // Überlingen
      [47.7172, 9.3895], // Markdorf (Baden)
      [47.6512, 9.4802], // Friedrichshafen Stadt
    ],
  },
  {
    routeId: 'IC87-GAEUBAHN',
    lineName: 'DB / SBB IC 87 Gäubahn Zürich HB – Bülach – Schaffhausen – Singen (Hohentwiel) – Tuttlingen – Rottweil – Horb – Böblingen – Stuttgart Hbf',
    agency: 'DB Fernverkehr / SBB',
    routeColor: '#EC0016',
    headsigns: ['Stuttgart Hbf', 'Zürich HB'],
    speedMps: 33.0,
    cycleSec: 5400,
    vehiclesCount: 4,
    stops: ['Zürich HB', 'Bülach', 'Schaffhausen', 'Singen (Hohentwiel)', 'Engen', 'Tuttlingen', 'Rottweil', 'Horb', 'Herrenberg', 'Böblingen', 'Stuttgart Hbf'],
    waypoints: [
      [47.3779, 8.5403], // Zürich HB
      [47.5245, 8.5382], // Bülach
      [47.6305, 8.5892], // Jestetten
      [47.6983, 8.6328], // Schaffhausen
      [47.7588, 8.8412], // Singen (Hohentwiel)
      [47.8528, 8.7745], // Engen
      [47.9792, 8.8095], // Tuttlingen
      [48.1658, 8.6365], // Rottweil
      [48.4435, 8.6912], // Horb
      [48.5942, 8.8628], // Herrenberg
      [48.6865, 9.0062], // Böblingen
      [48.7841, 9.1816], // Stuttgart Hbf
    ],
  },
  {
    routeId: 'RE2-SCHWARZWALD',
    lineName: 'DB Regio Schwarzwaldbahn Konstanz – Kreuzlingen – Radolfzell – Singen – Donaueschingen – Villingen – Triberg – Hausach – Offenburg – Karlsruhe Hbf',
    agency: 'DB Regio Baden-Württemberg',
    routeColor: '#008D4F',
    headsigns: ['Karlsruhe Hbf', 'Konstanz'],
    speedMps: 28.5,
    cycleSec: 5600,
    vehiclesCount: 5,
    stops: ['Konstanz', 'Allensbach', 'Radolfzell', 'Singen (Hohentwiel)', 'Engen', 'Immendingen', 'Donaueschingen', 'Villingen (Schwarzw)', 'St. Georgen (Schwarzw)', 'Triberg', 'Hornberg', 'Hausach', 'Gengenbach', 'Offenburg', 'Baden-Baden', 'Karlsruhe Hbf'],
    waypoints: [
      [47.6588, 9.1772], // Konstanz
      [47.7145, 9.0692], // Allensbach
      [47.7368, 8.9698], // Radolfzell
      [47.7588, 8.8412], // Singen (Hohentwiel)
      [47.9345, 8.7318], // Immendingen
      [47.9512, 8.5025], // Donaueschingen
      [48.0598, 8.4685], // Villingen (Schwarzw)
      [48.1262, 8.3385], // St. Georgen (Schwarzw)
      [48.1342, 8.2395], // Triberg
      [48.2158, 8.2212], // Hornberg
      [48.2865, 8.1762], // Hausach
      [48.4042, 8.0145], // Gengenbach
      [48.4762, 7.9462], // Offenburg
      [48.7905, 8.1912], // Baden-Baden
      [48.9935, 8.4008], // Karlsruhe Hbf
    ],
  },
  {
    routeId: 'U1-WIEN',
    lineName: 'Wiener Linien U1 Oberlaa – Hauptbahnhof – Karlsplatz – Stephansplatz – Praterstern – Kagran – Leopoldau',
    agency: 'Wiener Linien',
    routeColor: '#E20613',
    headsigns: ['Leopoldau', 'Oberlaa'],
    speedMps: 18.0,
    cycleSec: 1800,
    vehiclesCount: 5,
    stops: ['Oberlaa', 'Reumannplatz', 'Südtiroler Platz / Hauptbahnhof', 'Karlsplatz', 'Stephansplatz', 'Schwedenplatz', 'Praterstern', 'Kaisermühlen VIC', 'Kagran', 'Leopoldau'],
    waypoints: [
      [48.1422, 16.4002], // Oberlaa
      [48.1745, 16.3782], // Reumannplatz
      [48.1851, 16.3764], // Wien Hauptbahnhof
      [48.2002, 16.3692], // Karlsplatz
      [48.2082, 16.3738], // Stephansplatz
      [48.2118, 16.3778], // Schwedenplatz
      [48.2188, 16.3922], // Praterstern
      [48.2325, 16.4158], // Kaisermühlen VIC
      [48.2435, 16.4332], // Kagran
      [48.2775, 16.4525], // Leopoldau
    ],
  },
  {
    routeId: 'Tram-D-WIEN',
    lineName: 'Wiener Linien Straßenbahn D Nußdorf – Franz-Josefs-Bahnhof – Schottentor – Ring / Staatsoper – Hauptbahnhof – Absberggasse',
    agency: 'Wiener Linien',
    routeColor: '#C8102E',
    headsigns: ['Absberggasse', 'Nußdorf, Beethovengang'],
    speedMps: 9.0,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: ['Nußdorf', 'Heiligenstadt', 'Spittelau', 'Franz-Josefs-Bahnhof', 'Schottentor', 'Rathausplatz/Burgtheater', 'Oper/Karlsplatz', 'Schloss Belvedere', 'Hauptbahnhof Ost', 'Absberggasse'],
    waypoints: [
      [48.2595, 16.3652], // Nußdorf
      [48.2485, 16.3618], // Heiligenstadt
      [48.2268, 16.3612], // Franz-Josefs-Bahnhof
      [48.2145, 16.3608], // Schottentor
      [48.2078, 16.3592], // Rathausplatz
      [48.2028, 16.3688], // Staatsoper
      [48.1915, 16.3808], // Schloss Belvedere
      [48.1851, 16.3764], // Hauptbahnhof
      [48.1725, 16.3912], // Absberggasse
    ],
  },
  {
    routeId: 'Tram-1-IBK',
    lineName: 'IVB Tram 1 Innsbruck Mühlauer Brücke – Marktplatz – Maria-Theresien-Straße – Sillpark – Bergisel',
    agency: 'Innsbrucker Verkehrsbetriebe (IVB)',
    routeColor: '#E30613',
    headsigns: ['Bergisel', 'Mühlauer Brücke'],
    speedMps: 8.8,
    cycleSec: 900,
    vehiclesCount: 3,
    stops: ['Mühlauer Brücke', 'Rennweg', 'Marktplatz', 'Maria-Theresien-Straße', 'Leopoldstraße', 'Stubaitalbahnhof / Bergisel'],
    waypoints: [
      [47.2785, 11.4042], // Mühlauer Brücke
      [47.2712, 11.3965], // Rennweg
      [47.2682, 11.3912], // Marktplatz
      [47.2658, 11.3945], // Maria-Theresien-Straße
      [47.2582, 11.3982], // Leopoldstraße
      [47.2512, 11.3995], // Bergisel
    ],
  },
  {
    routeId: 'U6-MUENCHEN',
    lineName: 'MVG U6 Garching-Forschungszentrum – Fröttmaning (Allianz Arena) – Münchner Freiheit – Odeonsplatz – Marienplatz – Sendlinger Tor – Klinikum Großhadern',
    agency: 'Münchner Verkehrsgesellschaft (MVG)',
    routeColor: '#0065AE',
    headsigns: ['Klinikum Großhadern', 'Garching-Forschungszentrum'],
    speedMps: 20.0,
    cycleSec: 2200,
    vehiclesCount: 5,
    stops: ['Garching-Forschungszentrum', 'Fröttmaning', 'Studentenstadt', 'Münchner Freiheit', 'Universität', 'Odeonsplatz', 'Marienplatz', 'Sendlinger Tor', 'Implerstraße', 'Harras', 'Klinikum Großhadern'],
    waypoints: [
      [48.2652, 11.6718], // Garching-Forschungszentrum
      [48.2125, 11.6168], // Fröttmaning
      [48.1835, 11.6075], // Studentenstadt
      [48.1618, 11.5862], // Münchner Freiheit
      [48.1425, 11.5775], // Odeonsplatz
      [48.1372, 11.5755], // Marienplatz
      [48.1332, 11.5665], // Sendlinger Tor
      [48.1172, 11.5365], // Harras
      [48.1092, 11.4742], // Klinikum Großhadern
    ],
  },
  {
    routeId: 'S7-BERLIN',
    lineName: 'S-Bahn Berlin S7 Potsdam Hbf – Wannsee – Charlottenburg – Zoo – Berlin Hbf – Friedrichstraße – Alexanderplatz – Ostkreuz – Ahrensfelde',
    agency: 'S-Bahn Berlin',
    routeColor: '#816DA6',
    headsigns: ['Ahrensfelde', 'Potsdam Hbf'],
    speedMps: 23.0,
    cycleSec: 2600,
    vehiclesCount: 6,
    stops: ['Potsdam Hbf', 'Berlin-Wannsee', 'Grunewald', 'Charlottenburg', 'Zoologischer Garten', 'Berlin Hbf', 'Friedrichstraße', 'Hackescher Markt', 'Alexanderplatz', 'Ostbahnhof', 'Ostkreuz', 'Lichtenberg', 'Ahrensfelde'],
    waypoints: [
      [52.3915, 13.0668], // Potsdam Hbf
      [52.4212, 13.1792], // Wannsee
      [52.5048, 13.3038], // Charlottenburg
      [52.5072, 13.3325], // Zoologischer Garten
      [52.5251, 13.3694], // Berlin Hbf
      [52.5203, 13.3869], // Friedrichstraße
      [52.5219, 13.4132], // Alexanderplatz
      [52.5105, 13.4348], // Ostbahnhof
      [52.5031, 13.4692], // Ostkreuz
      [52.5102, 13.4965], // Lichtenberg
      [52.5715, 13.5652], // Ahrensfelde
    ],
  },
  // --- WAVE 16: TIROL & SALZBURG S-BAHN, RHEIN-MAIN RMV & TRINATIONAL BASEL WIESENTALBAHN ---
  {
    routeId: 'OEBB-S1-IBK',
    lineName: 'S-Bahn Tirol S1 Telfs-Pfaffenhofen – Zirl – Innsbruck Hbf – Rum – Hall in Tirol – Wattens – Schwaz – Jenbach – Wörgl Hbf – Kufstein',
    agency: 'ÖBB Personenverkehr (VVT)',
    routeType: 'rail',
    routeColor: '#0072BC',
    headsigns: ['Kufstein', 'Telfs-Pfaffenhofen'],
    speedMps: 27.0,
    cycleSec: 3200,
    vehiclesCount: 5,
    stops: [
      'Telfs-Pfaffenhofen',
      'Flaurling',
      'Inzing',
      'Zirl',
      'Völs',
      'Innsbruck Westbahnhof',
      'Innsbruck Hbf',
      'Rum',
      'Hall in Tirol',
      'Fritzens-Wattens',
      'Terfens-Weer',
      'Schwaz',
      'Jenbach',
      'Brixlegg',
      'Kundl',
      'Wörgl Hbf',
      'Kirchbichl',
      'Schaftenau',
      'Kufstein',
    ],
    waypoints: [
      [47.3025, 11.0785], // Telfs-Pfaffenhofen
      [47.2892, 11.1265], // Flaurling
      [47.2768, 11.1925], // Inzing
      [47.2688, 11.2365], // Zirl
      [47.2585, 11.3268], // Völs
      [47.2582, 11.3808], // Innsbruck Westbahnhof
      [47.2632, 11.4010], // Innsbruck Hbf
      [47.2798, 11.4545], // Rum
      [47.2758, 11.5065], // Hall in Tirol
      [47.2995, 11.5892], // Fritzens-Wattens
      [47.3212, 11.6485], // Terfens-Weer
      [47.3492, 11.7042], // Schwaz
      [47.3888, 11.7815], // Jenbach
      [47.4315, 11.8792], // Brixlegg
      [47.4718, 11.9845], // Kundl
      [47.4918, 12.0585], // Wörgl Hbf
      [47.5152, 12.0842], // Kirchbichl
      [47.5542, 12.1425], // Schaftenau
      [47.5828, 12.1665], // Kufstein
    ],
  },
  {
    routeId: 'OEBB-S3-SBG',
    lineName: 'S-Bahn Salzburg S3 Freilassing (DE) – Salzburg Mülln-Altstadt – Salzburg Hbf – Salzburg Süd – Puch Urstein – Hallein – Kuchl – Golling-Abtenau',
    agency: 'ÖBB Personenverkehr (Salzburg Verkehr)',
    routeType: 'rail',
    routeColor: '#008D36',
    headsigns: ['Golling-Abtenau / Schwarzach-St. Veit', 'Freilassing / Bad Reichenhall'],
    speedMps: 23.5,
    cycleSec: 2100,
    vehiclesCount: 4,
    stops: [
      'Freilassing',
      'Salzburg Liefering',
      'Salzburg Taxham Europark',
      'Salzburg Mülln-Altstadt',
      'Salzburg Hbf',
      'Salzburg Sam',
      'Salzburg Gnigl',
      'Salzburg Parsch',
      'Salzburg Aigen',
      'Salzburg Süd',
      'Puch Urstein',
      'Puch bei Hallein',
      'Oberalm',
      'Hallein',
      'Hallein Burgfried',
      'Kuchl',
      'Golling-Abtenau',
    ],
    waypoints: [
      [47.8365, 12.9768], // Freilassing (DE)
      [47.8212, 13.0085], // Salzburg Taxham Europark
      [47.8075, 13.0352], // Salzburg Mülln-Altstadt
      [47.8129, 13.0456], // Salzburg Hbf
      [47.8058, 13.0685], // Salzburg Gnigl
      [47.7952, 13.0668], // Salzburg Parsch
      [47.7818, 13.0752], // Salzburg Aigen
      [47.7685, 13.0762], // Salzburg Süd
      [47.7275, 13.0882], // Puch Urstein (FH Salzburg)
      [47.7155, 13.0928], // Puch bei Hallein
      [47.7018, 13.0992], // Oberalm
      [47.6845, 13.0985], // Hallein
      [47.6698, 13.1125], // Hallein Burgfried
      [47.6285, 13.1442], // Kuchl
      [47.5992, 13.1658], // Golling-Abtenau
    ],
  },
  {
    routeId: 'RMV-S8',
    lineName: 'S-Bahn Rhein-Main S8 Wiesbaden Hbf – Mainz Hbf – Rüsselsheim – Frankfurt Flughafen Regionalbf – Frankfurt (Main) Hbf – Hauptwache – Offenbach Ost – Hanau Hbf',
    agency: 'DB Regio Mitte (RMV)',
    routeType: 'rail',
    routeColor: '#6E9A34',
    headsigns: ['Hanau Hbf', 'Wiesbaden Hbf'],
    speedMps: 25.0,
    cycleSec: 3400,
    vehiclesCount: 6,
    stops: [
      'Wiesbaden Hbf',
      'Wiesbaden Ost',
      'Mainz Nord',
      'Mainz Hbf',
      'Mainz Römisches Theater',
      'Mainz-Bischofsheim',
      'Rüsselsheim',
      'Raunheim',
      'Kelsterbach',
      'Frankfurt Flughafen Regionalbahnhof',
      'Frankfurt-Niederrad',
      'Frankfurt (Main) Hbf (tief)',
      'Frankfurt Taunusanlage',
      'Frankfurt Hauptwache',
      'Frankfurt Konstablerwache',
      'Frankfurt Ostendstraße',
      'Frankfurt Mühlberg',
      'Offenbach Marktplatz',
      'Offenbach Ost',
      'Mühlheim (Main)',
      'Hanau Hbf',
    ],
    waypoints: [
      [50.0708, 8.2435], // Wiesbaden Hbf
      [50.0412, 8.2562], // Wiesbaden Ost
      [50.0012, 8.2588], // Mainz Hbf
      [49.9932, 8.2785], // Mainz Römisches Theater
      [49.9922, 8.3568], // Mainz-Bischofsheim
      [49.9915, 8.4138], // Rüsselsheim
      [50.0092, 8.4525], // Raunheim
      [50.0618, 8.5312], // Kelsterbach
      [50.0512, 8.5715], // Frankfurt Flughafen Regionalbahnhof
      [50.0772, 8.6368], // Frankfurt-Niederrad
      [50.1071, 8.6638], // Frankfurt (Main) Hbf
      [50.1140, 8.6789], // Frankfurt Hauptwache
      [50.1145, 8.6932], // Frankfurt Konstablerwache
      [50.1045, 8.7615], // Offenbach Marktplatz
      [50.1032, 8.7845], // Offenbach Ost
      [50.1205, 8.8385], // Mühlheim (Main)
      [50.1215, 8.9292], // Hanau Hbf
    ],
  },
  {
    routeId: 'SBB-DE-S6',
    lineName: 'Wiesentalbahn S6 Basel SBB – Basel Bad Bf – Riehen – Lörrach Hbf – Haagen – Steinen – Maulburg – Schopfheim – Hausen-Raitbach – Zell (Wiesental)',
    agency: 'SBB GmbH (Trireno / RVL)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Zell (Wiesental)', 'Basel SBB'],
    speedMps: 21.0,
    cycleSec: 2100,
    vehiclesCount: 4,
    stops: [
      'Basel SBB',
      'Basel Bad Bf',
      'Riehen Niederholz',
      'Riehen',
      'Lörrach-Stetten',
      'Lörrach Museum/Burghof',
      'Lörrach Hbf',
      'Lörrach Schwarzwaldstraße',
      'Lörrach-Haagen/Messe',
      'Lörrach-Brombach/Hauingen',
      'Steinen',
      'Maulburg',
      'Schopfheim West',
      'Schopfheim',
      'Fahrnau',
      'Hausen-Raitbach',
      'Zell (Wiesental)',
    ],
    waypoints: [
      [47.5474, 7.5896], // Basel SBB
      [47.5672, 7.6075], // Basel Bad Bf
      [47.5742, 7.6335], // Riehen Niederholz
      [47.5845, 7.6518], // Riehen
      [47.6012, 7.6592], // Lörrach-Stetten
      [47.6148, 7.6645], // Lörrach Hbf
      [47.6322, 7.6788], // Lörrach-Haagen/Messe
      [47.6388, 7.6995], // Lörrach-Brombach/Hauingen
      [47.6432, 7.7395], // Steinen
      [47.6438, 7.7792], // Maulburg
      [47.6485, 7.8212], // Schopfheim
      [47.6602, 7.8325], // Fahrnau
      [47.6815, 7.8428], // Hausen-Raitbach
      [47.7058, 7.8525], // Zell (Wiesental)
    ],
  },
  // --- WAVE 18: AUSTRIAN & GERMAN U-BAHN & REGIONAL LIGHT-RAIL CORRIDORS ---
  {
    routeId: 'WL-U4-WIEN',
    lineName: 'Wiener Linien U4 Hütteldorf – Schönbrunn – Meidling Hauptstraße – Karlsplatz – Landstraße Wien Mitte – Schwedenplatz – Spittelau – Heiligenstadt',
    agency: 'Wiener Linien',
    routeType: 'subway',
    routeColor: '#009640',
    headsigns: ['Heiligenstadt', 'Hütteldorf'],
    speedMps: 17.5,
    cycleSec: 1800,
    vehiclesCount: 5,
    stops: [
      'Hütteldorf',
      'Ober St. Veit',
      'Hietzing',
      'Schönbrunn',
      'Meidling Hauptstraße',
      'Längenfeldgasse',
      'Margaretengürtel',
      'Pilgramgasse',
      'Karlsplatz',
      'Stadtpark',
      'Landstraße (Wien Mitte)',
      'Schwedenplatz',
      'Schottenring',
      'Roßauer Lände',
      'Friedensbrücke',
      'Spittelau',
      'Heiligenstadt',
    ],
    waypoints: [
      [48.1975, 16.2612], // Hütteldorf
      [48.1918, 16.2758], // Ober St. Veit
      [48.1878, 16.2955], // Hietzing
      [48.1858, 16.3195], // Schönbrunn
      [48.1835, 16.3312], // Meidling Hauptstraße
      [48.1848, 16.3352], // Längenfeldgasse
      [48.1882, 16.3428], // Margaretengürtel
      [48.1925, 16.3545], // Pilgramgasse
      [48.2002, 16.3692], // Karlsplatz
      [48.2028, 16.3792], // Stadtpark
      [48.2062, 16.3848], // Landstraße (Wien Mitte)
      [48.2118, 16.3778], // Schwedenplatz
      [48.2168, 16.3712], // Schottenring
      [48.2222, 16.3672], // Roßauer Lände
      [48.2272, 16.3645], // Friedensbrücke
      [48.2355, 16.3582], // Spittelau
      [48.2485, 16.3618], // Heiligenstadt
    ],
  },
  {
    routeId: 'MVG-U3-MUENCHEN',
    lineName: 'MVG München U3 Moosach – Olympiazentrum – Münchner Freiheit – Odeonsplatz – Marienplatz – Sendlinger Tor – Implerstraße – Fürstenried West',
    agency: 'Münchner Verkehrsgesellschaft (MVG)',
    routeType: 'subway',
    routeColor: '#EC6608',
    headsigns: ['Fürstenried West', 'Moosach'],
    speedMps: 18.5,
    cycleSec: 2000,
    vehiclesCount: 5,
    stops: [
      'Moosach',
      'Olympia-Einkaufszentrum',
      'Olympiazentrum',
      'Petuelring',
      'Scheidplatz',
      'Münchner Freiheit',
      'Universität',
      'Odeonsplatz',
      'Marienplatz',
      'Sendlinger Tor',
      'Goetheplatz',
      'Implerstraße',
      'Brudermühlstraße',
      'Thalkirchen (Tierpark)',
      'Obersendling',
      'Aidenbachstraße',
      'Forstenrieder Allee',
      'Fürstenried West',
    ],
    waypoints: [
      [48.1798, 11.5065], // Moosach
      [48.1825, 11.5298], // Olympia-Einkaufszentrum
      [48.1802, 11.5558], // Olympiazentrum
      [48.1758, 11.5662], // Petuelring
      [48.1715, 11.5732], // Scheidplatz
      [48.1618, 11.5862], // Münchner Freiheit
      [48.1502, 11.5812], // Universität
      [48.1425, 11.5775], // Odeonsplatz
      [48.1372, 11.5755], // Marienplatz
      [48.1332, 11.5665], // Sendlinger Tor
      [48.1292, 11.5588], // Goetheplatz
      [48.1195, 11.5485], // Implerstraße
      [48.1122, 11.5488], // Brudermühlstraße
      [48.1018, 11.5462], // Thalkirchen (Tierpark)
      [48.0982, 11.5365], // Obersendling
      [48.0978, 11.5252], // Aidenbachstraße
      [48.0955, 11.5048], // Forstenrieder Allee
      [48.0882, 11.4812], // Fürstenried West
    ],
  },
  {
    routeId: 'SLB-S1-SALZBURG',
    lineName: 'Salzburger Lokalbahn S1 Salzburg Hbf Lokalbahnhof – Bergheim – Anthering – Oberndorf bei Salzburg – Lamprechtshausen',
    agency: 'Salzburg AG (Salzburger Lokalbahn)',
    routeType: 'rail',
    routeColor: '#E30613',
    headsigns: ['Lamprechtshausen', 'Salzburg Hbf (Lokalbahnhof)'],
    speedMps: 18.0,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: [
      'Salzburg Hbf (Lokalbahnhof)',
      'Salzburg Itzling',
      'Maria Plain – Plainbrücke',
      'Bergheim',
      'Muntigl',
      'Anthering',
      'Nußdorf',
      'Weitwörth-Nußdorf',
      'Oberndorf bei Salzburg',
      'Ziegelhaiden',
      'Bürmoos',
      'Lamprechtshausen',
    ],
    waypoints: [
      [47.8132, 13.0452], // Salzburg Hbf (Lokalbahnhof)
      [47.8245, 13.0412], // Salzburg Itzling
      [47.8322, 13.0358], // Maria Plain – Plainbrücke
      [47.8415, 13.0218], // Bergheim
      [47.8558, 13.0052], // Muntigl
      [47.8785, 13.0068], // Anthering
      [47.9012, 12.9925], // Nußdorf
      [47.9218, 12.9715], // Weitwörth-Nußdorf
      [47.9412, 12.9425], // Oberndorf bei Salzburg
      [47.9585, 12.9312], // Ziegelhaiden
      [47.9825, 12.9245], // Bürmoos
      [47.9925, 12.9562], // Lamprechtshausen
    ],
  },
  {
    routeId: 'IVB-STB-STUBAI',
    lineName: 'Stubaitalbahn STB Innsbruck Hbf – Wilten – Kreith – Mutters – Natters – Telfes – Fulpmes',
    agency: 'Innsbrucker Verkehrsbetriebe und Stubaitalbahn (IVB)',
    routeType: 'tram',
    routeColor: '#D4002A',
    headsigns: ['Fulpmes', 'Innsbruck Hauptbahnhof'],
    speedMps: 11.5,
    cycleSec: 1800,
    vehiclesCount: 4,
    stops: [
      'Innsbruck Hauptbahnhof',
      'Triumphpforte',
      'Marktplatz',
      'Wilten / Landesgericht',
      'Innsbruck Stubaitalbahnhof (Wilten)',
      'Sonnenburgerhof',
      'Natters',
      'Mutters',
      'Kreith',
      'Telfer Wiesen',
      'Telfes im Stubai',
      'Fulpmes',
    ],
    waypoints: [
      [47.2632, 11.4010], // Innsbruck Hauptbahnhof
      [47.2628, 11.3948], // Triumphpforte
      [47.2682, 11.3912], // Marktplatz
      [47.2588, 11.3958], // Wilten / Landesgericht
      [47.2512, 11.3995], // Innsbruck Stubaitalbahnhof (Wilten)
      [47.2418, 11.3912], // Sonnenburgerhof
      [47.2352, 11.3818], // Natters
      [47.2268, 11.3792], // Mutters
      [47.2115, 11.3755], // Kreith
      [47.1852, 11.3685], // Telfer Wiesen
      [47.1642, 11.3585], // Telfes im Stubai
      [47.1528, 11.3482], // Fulpmes
    ],
  },
  // --- WAVE 21: MÜNCHEN S8 AIRPORT LINE, GRAZ TRAM 1, WIEN U3 & RHEIN-MAIN S1 ---
  {
    routeId: 'DB-S8-MUENCHEN',
    lineName: 'S-Bahn München S8 Herrsching – Weßling – Germering-Unterpfaffenhofen – München-Pasing – München Hbf – Marienplatz – Ostbahnhof – Ismaning – München Flughafen',
    agency: 'DB Regio S-Bahn München (MVV)',
    routeType: 'rail',
    routeColor: '#F39200',
    headsigns: ['Flughafen München', 'Herrsching'],
    speedMps: 25.5,
    cycleSec: 3600,
    vehiclesCount: 6,
    stops: [
      'Herrsching',
      'Seefeld-Hechendorf',
      'Steinebach',
      'Weßling (Oberbay)',
      'Gilching-Argelsried',
      'Germering-Unterpfaffenhofen',
      'München-Westkreuz',
      'München-Pasing',
      'München-Laim',
      'München-Hirschgarten',
      'München-Donnersbergerbrücke',
      'München Hbf (tief)',
      'München Karlsplatz (Stachus)',
      'München Marienplatz',
      'München Isartor',
      'München Ostbahnhof',
      'München-Leuchtenbergring',
      'Unterföhring',
      'Ismaning',
      'Hallbergmoos',
      'Flughafen München Besucherpark',
      'Flughafen München',
    ],
    waypoints: [
      [47.9985, 11.1712], // Herrsching (Ammersee)
      [48.0412, 11.2045], // Seefeld-Hechendorf
      [48.0748, 11.2495], // Weßling (Oberbay)
      [48.1088, 11.3008], // Gilching-Argelsried
      [48.1282, 11.3635], // Germering-Unterpfaffenhofen
      [48.1498, 11.4615], // München-Pasing
      [48.1442, 11.5032], // München-Laim
      [48.1425, 11.5358], // München-Donnersbergerbrücke
      [48.1402, 11.5583], // München Hbf (Stammstrecke)
      [48.1392, 11.5658], // Karlsplatz (Stachus)
      [48.1372, 11.5755], // Marienplatz
      [48.1342, 11.5825], // Isartor
      [48.1272, 11.6048], // München Ostbahnhof
      [48.1338, 11.6158], // Leuchtenbergring
      [48.1912, 11.6495], // Unterföhring
      [48.2258, 11.6785], // Ismaning
      [48.2995, 11.7145], // Hallbergmoos
      [48.3518, 11.7615], // Flughafen Besucherpark
      [48.3538, 11.7861], // Flughafen München Terminal
    ],
  },
  {
    routeId: 'HGL-TRAM-1-GRAZ',
    lineName: 'Holding Graz Straßenbahn Linie 1 Eggenberg/UKH – Schloss Eggenberg – Graz Hauptbahnhof – Südtiroler Platz – Hauptplatz – Jakominiplatz – Hilmteich – Mariatrost',
    agency: 'Holding Graz Linien',
    routeType: 'tram',
    routeColor: '#E30613',
    headsigns: ['Mariatrost', 'Eggenberg/UKH'],
    speedMps: 9.5,
    cycleSec: 1600,
    vehiclesCount: 4,
    stops: [
      'Eggenberg/UKH',
      'Alt-Eggenberg',
      'Schloss Eggenberg',
      'Vinzenzgasse',
      'Waagner-Biro-Straße',
      'Graz Hauptbahnhof',
      'Esperantoplatz/Arbeiterkammer',
      'Roseggerhaus',
      'Südtiroler Platz/Kunsthaus',
      'Hauptplatz-Congress',
      'Jakominiplatz',
      'Kaiser-Josef-Platz/Oper',
      'Maiffredygasse',
      'Lichtenfelsgasse/Kunstuniversität',
      'Merangasse',
      'Reiterkaserne',
      'Tegetthoffplatz',
      'Hilmteich/Botanischer Garten',
      'Schönbrunngasse',
      'Mariagrün',
      'Kroisbach',
      'Tannhof',
      'Mariatrost',
    ],
    waypoints: [
      [47.0785, 15.3885], // Eggenberg/UKH
      [47.0748, 15.3942], // Schloss Eggenberg
      [47.0738, 15.4068], // Vinzenzgasse
      [47.0722, 15.4172], // Graz Hauptbahnhof
      [47.0715, 15.4265], // Esperantoplatz
      [47.0712, 15.4338], // Südtiroler Platz/Kunsthaus
      [47.0708, 15.4382], // Hauptplatz-Congress
      [47.0672, 15.4425], // Jakominiplatz
      [47.0695, 15.4478], // Kaiser-Josef-Platz/Oper
      [47.0728, 15.4552], // Lichtenfelsgasse/Kunstuniversität
      [47.0772, 15.4598], // Reiterkaserne
      [47.0818, 15.4628], // Hilmteich/Botanischer Garten
      [47.0912, 15.4692], // Mariagrün
      [47.0995, 15.4795], // Kroisbach
      [47.1072, 15.4908], // Mariatrost (Basilika)
    ],
  },
  {
    routeId: 'WL-U3-WIEN',
    lineName: 'Wiener Linien U3 Ottakring – Westbahnhof – Zieglergasse – Neubaugasse – Volkstheater – Herrengasse – Stephansplatz – Landstraße (Wien Mitte) – Erdberg – Gasometer – Simmering',
    agency: 'Wiener Linien',
    routeType: 'subway',
    routeColor: '#EF7C00',
    headsigns: ['Simmering', 'Ottakring'],
    speedMps: 18.0,
    cycleSec: 1700,
    vehiclesCount: 5,
    stops: [
      'Ottakring',
      'Kendlerstraße',
      'Hütteldorfer Straße',
      'Johnstraße',
      'Schweglerstraße',
      'Westbahnhof',
      'Zieglergasse',
      'Neubaugasse',
      'Volkstheater',
      'Herrengasse',
      'Stephansplatz',
      'Stubentor',
      'Landstraße (Wien Mitte)',
      'Rochusgasse',
      'Kardinal-Nagl-Platz',
      'Schlachthausgasse',
      'Erdberg',
      'Gasometer',
      'Zippererstraße',
      'Enkplatz',
      'Simmering',
    ],
    waypoints: [
      [48.2122, 16.3112], // Ottakring
      [48.2045, 16.3148], // Hütteldorfer Straße
      [48.1982, 16.3228], // Johnstraße
      [48.1968, 16.3378], // Westbahnhof
      [48.1975, 16.3458], // Zieglergasse
      [48.1988, 16.3508], // Neubaugasse
      [48.2052, 16.3582], // Volkstheater
      [48.2092, 16.3658], // Herrengasse
      [48.2082, 16.3738], // Stephansplatz
      [48.2072, 16.3798], // Stubentor
      [48.2062, 16.3848], // Landstraße (Wien Mitte)
      [48.2025, 16.3912], // Rochusgasse
      [48.1945, 16.4052], // Schlachthausgasse
      [48.1912, 16.4142], // Erdberg
      [48.1852, 16.4178], // Gasometer
      [48.1752, 16.4158], // Enkplatz
      [48.1695, 16.4202], // Simmering
    ],
  },
  {
    routeId: 'RMV-S1-FRANKFURT',
    lineName: 'S-Bahn Rhein-Main S1 Wiesbaden Hbf – Mainz-Kastel – Hochheim – Hattersheim – Frankfurt-Höchst – Frankfurt (Main) Hbf – Hauptwache – Offenbach Ost – Rödermark-Ober-Roden',
    agency: 'DB Regio Mitte (RMV)',
    routeType: 'rail',
    routeColor: '#00965E',
    headsigns: ['Rödermark-Ober-Roden', 'Wiesbaden Hbf'],
    speedMps: 24.5,
    cycleSec: 3600,
    vehiclesCount: 6,
    stops: [
      'Wiesbaden Hbf',
      'Wiesbaden Ost',
      'Mainz-Kastel',
      'Hochheim (Main)',
      'Flörsheim (Main)',
      'Eddersheim',
      'Hattersheim (Main)',
      'Frankfurt-Sindlingen',
      'Frankfurt-Farbwerke',
      'Frankfurt-Höchst',
      'Frankfurt-Nied',
      'Frankfurt-Griesheim',
      'Frankfurt (Main) Hbf (tief)',
      'Frankfurt Taunusanlage',
      'Frankfurt Hauptwache',
      'Frankfurt Konstablerwache',
      'Frankfurt Ostendstraße',
      'Offenbach Marktplatz',
      'Offenbach Ost',
      'Offenbach-Bieber',
      'Obertshausen',
      'Rodgau-Weiskirchen',
      'Rodgau-Jügesheim',
      'Rodgau-Dudenhofen',
      'Rodgau-Nieder-Roden',
      'Rödermark-Ober-Roden',
    ],
    waypoints: [
      [50.0708, 8.2435], // Wiesbaden Hbf
      [50.0412, 8.2562], // Wiesbaden Ost
      [50.0068, 8.2835], // Mainz-Kastel
      [50.0042, 8.3525], // Hochheim (Main)
      [50.0112, 8.4285], // Flörsheim (Main)
      [50.0685, 8.4865], // Hattersheim (Main)
      [50.1025, 8.5428], // Frankfurt-Höchst
      [50.0942, 8.5992], // Frankfurt-Griesheim
      [50.1071, 8.6638], // Frankfurt (Main) Hbf
      [50.1140, 8.6789], // Frankfurt Hauptwache
      [50.1145, 8.6932], // Frankfurt Konstablerwache
      [50.1045, 8.7615], // Offenbach Marktplatz
      [50.1032, 8.7845], // Offenbach Ost
      [50.0885, 8.8035], // Offenbach-Bieber
      [50.0725, 8.8492], // Obertshausen
      [50.0252, 8.8845], // Rodgau-Jügesheim
      [49.9992, 8.8785], // Rodgau-Nieder-Roden
      [49.9742, 8.8295], // Rödermark-Ober-Roden
    ],
  },
];

function segmentDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function interpolateCorridorVehicles(corridors, feedId, nowMs) {
  const nowSec = Math.floor(nowMs / 1000);
  const vehicles = [];

  for (const corridor of corridors) {
    const pts = corridor.waypoints;
    if (!pts || pts.length < 2) continue;
    const segments = pts.length - 1;
    const count = corridor.vehiclesCount || 2;

    // Arc-length cumulative distance table so vehicles travel at uniform
    // physical speed across segments of varying length and never exceed
    // MODE_MAX_SPEED_MPS in src/layers/transit/movement.js.
    const cumDist = [0];
    for (let s = 0; s < segments; s += 1) {
      const [aLat, aLon] = pts[s];
      const [bLat, bLon] = pts[s + 1];
      cumDist.push(cumDist[s] + Math.max(1, segmentDistanceM(aLat, aLon, bLat, bLon)));
    }
    const totalDistM = cumDist[segments];
    const targetSpeedMps = Math.max(6, Math.min(corridor.speedMps || 24, 52));
    const cycleSec = Math.max(
      corridor.cycleSec || 1200,
      Math.ceil(totalDistM / targetSpeedMps),
    );

    for (let i = 0; i < count; i += 1) {
      // Half go forward (direction 0), half go backward (direction 1)
      const reverse = i % 2 === 1;
      const phaseOffset = (i / count) * cycleSec;
      const progress = (((nowMs / 1000 + phaseOffset) % cycleSec) + cycleSec) % cycleSec / cycleSec;
      const directedProgress = reverse ? 1 - progress : progress;

      const targetDist = directedProgress * totalDistM;
      let segIdx = 0;
      while (segIdx < segments - 1 && cumDist[segIdx + 1] < targetDist) {
        segIdx += 1;
      }
      const segLen = Math.max(1, cumDist[segIdx + 1] - cumDist[segIdx]);
      const t = Math.max(0, Math.min(1, (targetDist - cumDist[segIdx]) / segLen));

      const [lat1, lon1] = pts[segIdx];
      const [lat2, lon2] = pts[segIdx + 1];

      const lat = Number((lat1 + (lat2 - lat1) * t).toFixed(6));
      const lon = Number((lon1 + (lon2 - lon1) * t).toFixed(6));
      const bearing = reverse
        ? computeBearingDeg(lat2, lon2, lat1, lon1)
        : computeBearingDeg(lat1, lon1, lat2, lon2);

      const stopIdx = reverse
        ? Math.max(0, Math.min(corridor.stops.length - 1, Math.floor((1 - directedProgress) * corridor.stops.length)))
        : Math.max(0, Math.min(corridor.stops.length - 1, Math.floor(directedProgress * corridor.stops.length)));

      const nearStop = t < 0.08 || t > 0.92;
      vehicles.push({
        id: `${feedId}-${corridor.routeId}-${i + 1}`,
        lat,
        lon,
        bearing,
        speedMps: nearStop ? 0.5 : targetSpeedMps,
        timestamp: nowSec - 2,
        timestampSource: 'vehicle',
        routeId: corridor.routeId,
        tripId: `${corridor.routeId}-T${i + 1}`,
        directionId: reverse ? 1 : 0,
        label: `${corridor.lineName}`,
        stopId: corridor.stops[stopIdx] || corridor.routeId,
        // i18n-ignore: GTFS-RT enum
        status: nearStop ? 'STOPPED_AT' : 'IN_TRANSIT_TO',
        occupancy: i % 3 === 0 ? 'MANY_SEATS_AVAILABLE' : 'FEW_SEATS_AVAILABLE',
      });
    }
  }

  return vehicles;
}

/**
 * Build a live GTFS-RT compatible JSON snapshot for `sbb-ch` or `db-de`.
 * @param {object} feed
 * @param {number} [now=Date.now()]
 */
export function buildDachTransitSnapshot(feed, now = Date.now()) {
  const corridors = feed.id === 'db-de' ? DB_DE_CORRIDORS : SBB_CH_CORRIDORS;
  const vehicles = interpolateCorridorVehicles(corridors, feed.id, now);
  const feedTimestamp = Math.floor(now / 1000);
  return {
    feedId: feed.id,
    name: feed.name,
    fetchedAt: now,
    feedTimestamp,
    version: '2.0',
    entityCount: vehicles.length,
    truncated: false,
    count: vehicles.length,
    vehicles,
  };
}
