// Deterministic, zero-API-cost multilingual geospatial gazetteer for PLAIN. Maven.
// Resolves articles and live tickers to precise (lat, lon) coordinates, prioritizing
// specific strategic sites & cities over sub-national regions and country centroids,
// with deterministic golden-angle micro-offsets so co-located stories never stack on one pixel.

const GAZETTEER_RAW = [
  // ── Priority 4: Strategic chokepoints, flashpoints, spaceports & facilities ──
  { name: 'Strait of Hormuz', de: 'Straße von Hormus', country: 'Oman / Iran', cc: 'OM', lat: 26.5667, lon: 56.25, p: 4, aliases: ['strait of hormuz', 'straße von hormus', 'strasse von hormus', 'hormuz'] },
  { name: 'Bab el-Mandeb', de: 'Bab al-Mandab', country: 'Yemen / Djibouti', cc: 'YE', lat: 12.5833, lon: 43.3333, p: 4, aliases: ['bab el-mandeb', 'bab al-mandab', 'red sea shipping', 'rotes meer'] },
  { name: 'Suez Canal', de: 'Suezkanal', country: 'Egypt', cc: 'EG', lat: 30.5852, lon: 32.2654, p: 4, aliases: ['suez canal', 'suezkanal', 'canal de suez'] },
  { name: 'Panama Canal', de: 'Panamakanal', country: 'Panama', cc: 'PA', lat: 9.08, lon: -79.68, p: 4, aliases: ['panama canal', 'panamakanal'] },
  { name: 'Taiwan Strait', de: 'Taiwanstraße', country: 'Taiwan', cc: 'TW', lat: 24.4798, lon: 119.5, p: 4, aliases: ['taiwan strait', 'taiwanstraße', 'taiwanstrasse', 'formosa strait'] },
  { name: 'South China Sea', de: 'Südchinesisches Meer', country: 'Maritime', cc: 'PH', lat: 14.5, lon: 115.5, p: 4, aliases: ['south china sea', 'südchinesisches meer', 'spratly', 'scarborough shoal', 'second thomas shoal'] },
  { name: 'Zaporizhzhia', de: 'Saporischschja', country: 'Ukraine', cc: 'UA', lat: 47.8388, lon: 35.1396, p: 4, aliases: ['zaporizhzhia', 'saporischschja', 'zaporozhye'] },
  { name: 'Gaza', de: 'Gaza', country: 'Palestine', cc: 'PS', lat: 31.5017, lon: 34.4668, p: 4, aliases: ['gaza', 'gazastreifen', 'gaza strip', 'khan younis', 'chan junis', 'jabalia'] },
  { name: 'Rafah', de: 'Rafah', country: 'Palestine', cc: 'PS', lat: 31.2969, lon: 34.2436, p: 4, aliases: ['rafah'] },
  { name: 'West Bank', de: 'Westjordanland', country: 'Palestine', cc: 'PS', lat: 31.9038, lon: 35.2034, p: 4, aliases: ['west bank', 'westjordanland', 'ramallah', 'jenin', 'dschenin', 'nablus', 'hebron'] },
  { name: 'Golan Heights', de: 'Golanhöhen', country: 'Syria / Israel', cc: 'IL', lat: 33.0, lon: 35.75, p: 4, aliases: ['golan heights', 'golanhöhen', 'golan'] },
  { name: 'Crimea', de: 'Krim', country: 'Ukraine', cc: 'UA', lat: 44.9521, lon: 34.1024, p: 4, aliases: ['crimea', 'krim', 'sevastopol', 'sewastopol', 'kerch', 'kertsch'] },
  { name: 'Donbas', de: 'Donbass', country: 'Ukraine', cc: 'UA', lat: 48.0159, lon: 37.8028, p: 4, aliases: ['donbas', 'donbass', 'donetsk', 'donezk', 'luhansk', 'pokrovsk', 'pokrowsk', 'bakhmut', 'bachmut', 'avdiivka', 'kramatorsk'] },
  { name: 'Kursk', de: 'Kursk', country: 'Russia', cc: 'RU', lat: 51.7373, lon: 36.1873, p: 4, aliases: ['kursk', 'sudzha', 'sudscha'] },
  { name: 'Cape Canaveral', de: 'Cape Canaveral', country: 'United States', cc: 'US', lat: 28.3922, lon: -80.6077, p: 4, aliases: ['cape canaveral', 'kennedy space center', 'starbase', 'boca chica'] },
  { name: 'Baikonur', de: 'Baikonur', country: 'Kazakhstan', cc: 'KZ', lat: 45.9646, lon: 63.3052, p: 4, aliases: ['baikonur'] },
  { name: 'CERN Geneva', de: 'CERN Genf', country: 'Switzerland', cc: 'CH', lat: 46.233, lon: 6.0557, p: 4, aliases: ['cern', 'large hadron collider'] },
  { name: 'Ramstein', de: 'Ramstein', country: 'Germany', cc: 'DE', lat: 49.4369, lon: 7.6003, p: 4, aliases: ['ramstein'] },
  { name: 'Natanz', de: 'Natans', country: 'Iran', cc: 'IR', lat: 33.7244, lon: 51.7272, p: 4, aliases: ['natanz', 'natans', 'fordow', 'fordo'] },

  // ── Priority 3: DACH (Switzerland, Germany, Austria, Liechtenstein) ──
  { name: 'Zurich', de: 'Zürich', country: 'Switzerland', cc: 'CH', lat: 47.3769, lon: 8.5417, p: 3, aliases: ['zurich', 'zürich', 'zuerich', 'eth zürich', 'eth zurich', 'snb'] },
  { name: 'Bern', de: 'Bern', country: 'Switzerland', cc: 'CH', lat: 46.948, lon: 7.4474, p: 3, aliases: ['bern', 'bundeshaus', 'bundesrat'] },
  { name: 'Geneva', de: 'Genf', country: 'Switzerland', cc: 'CH', lat: 46.2044, lon: 6.1432, p: 3, aliases: ['geneva', 'genf', 'genève', 'world health organization'] },
  { name: 'Basel', de: 'Basel', country: 'Switzerland', cc: 'CH', lat: 47.5596, lon: 7.5886, p: 3, aliases: ['basel', 'bâle'] },
  { name: 'Lausanne', de: 'Lausanne', country: 'Switzerland', cc: 'CH', lat: 46.5197, lon: 6.6323, p: 3, aliases: ['lausanne', 'epfl'] },
  { name: 'St. Gallen', de: 'St. Gallen', country: 'Switzerland', cc: 'CH', lat: 47.4245, lon: 9.3767, p: 3, aliases: ['st. gallen', 'st gallen', 'sankt gallen'] },
  { name: 'Lucerne', de: 'Luzern', country: 'Switzerland', cc: 'CH', lat: 47.0502, lon: 8.3093, p: 3, aliases: ['lucerne', 'luzern'] },
  { name: 'Lugano', de: 'Lugano', country: 'Switzerland', cc: 'CH', lat: 46.0037, lon: 8.9511, p: 3, aliases: ['lugano', 'ticino', 'tessin'] },
  { name: 'Davos', de: 'Davos', country: 'Switzerland', cc: 'CH', lat: 46.8027, lon: 9.836, p: 3, aliases: ['davos'] },
  { name: 'Vaduz', de: 'Vaduz', country: 'Liechtenstein', cc: 'LI', lat: 47.141, lon: 9.5209, p: 3, aliases: ['vaduz', 'liechtenstein'] },
  { name: 'Berlin', de: 'Berlin', country: 'Germany', cc: 'DE', lat: 52.52, lon: 13.405, p: 3, aliases: ['berlin', 'bundestag', 'kanzleramt', 'bundesregierung'] },
  { name: 'Frankfurt', de: 'Frankfurt am Main', country: 'Germany', cc: 'DE', lat: 50.1109, lon: 8.6821, p: 3, aliases: ['frankfurt', 'ezb', 'european central bank', 'europäische zentralbank', 'dax'] },
  { name: 'Munich', de: 'München', country: 'Germany', cc: 'DE', lat: 48.1351, lon: 11.582, p: 3, aliases: ['munich', 'münchen', 'muenchen'] },
  { name: 'Hamburg', de: 'Hamburg', country: 'Germany', cc: 'DE', lat: 53.5511, lon: 9.9937, p: 3, aliases: ['hamburg'] },
  { name: 'Cologne', de: 'Köln', country: 'Germany', cc: 'DE', lat: 50.9375, lon: 6.9603, p: 3, aliases: ['cologne', 'köln', 'koeln'] },
  { name: 'Stuttgart', de: 'Stuttgart', country: 'Germany', cc: 'DE', lat: 48.7758, lon: 9.1829, p: 3, aliases: ['stuttgart'] },
  { name: 'Düsseldorf', de: 'Düsseldorf', country: 'Germany', cc: 'DE', lat: 51.2277, lon: 6.7735, p: 3, aliases: ['düsseldorf', 'duesseldorf', 'dusseldorf'] },
  { name: 'Leipzig', de: 'Leipzig', country: 'Germany', cc: 'DE', lat: 51.3397, lon: 12.3731, p: 3, aliases: ['leipzig'] },
  { name: 'Dresden', de: 'Dresden', country: 'Germany', cc: 'DE', lat: 51.0504, lon: 13.7373, p: 3, aliases: ['dresden'] },
  { name: 'Karlsruhe', de: 'Karlsruhe', country: 'Germany', cc: 'DE', lat: 49.0069, lon: 8.4037, p: 3, aliases: ['karlsruhe', 'bundesverfassungsgericht'] },
  { name: 'Vienna', de: 'Wien', country: 'Austria', cc: 'AT', lat: 48.2082, lon: 16.3738, p: 3, aliases: ['vienna', 'wien', 'iaea', 'iaeo', 'opec'] },
  { name: 'Salzburg', de: 'Salzburg', country: 'Austria', cc: 'AT', lat: 47.8095, lon: 13.055, p: 3, aliases: ['salzburg'] },
  { name: 'Innsbruck', de: 'Innsbruck', country: 'Austria', cc: 'AT', lat: 47.2692, lon: 11.4041, p: 3, aliases: ['innsbruck', 'tirol'] },
  { name: 'Graz', de: 'Graz', country: 'Austria', cc: 'AT', lat: 47.0707, lon: 15.4395, p: 3, aliases: ['graz'] },

  // ── Priority 3: Europe Major Cities & Capitals ──
  { name: 'Brussels', de: 'Brüssel', country: 'Belgium', cc: 'BE', lat: 50.8503, lon: 4.3517, p: 3, aliases: ['brussels', 'brüssel', 'bruessel', 'bruxelles', 'eu-kommission', 'european commission', 'nato headquarters'] },
  { name: 'Strasbourg', de: 'Straßburg', country: 'France', cc: 'FR', lat: 48.5734, lon: 7.7521, p: 3, aliases: ['strasbourg', 'straßburg', 'strassburg', 'eu-parlament', 'european parliament'] },
  { name: 'Luxembourg', de: 'Luxemburg', country: 'Luxembourg', cc: 'LU', lat: 49.6116, lon: 6.1319, p: 3, aliases: ['luxembourg', 'luxemburg', 'eugh', 'european court of justice'] },
  { name: 'Paris', de: 'Paris', country: 'France', cc: 'FR', lat: 48.8566, lon: 2.3522, p: 3, aliases: ['paris', 'élysée', 'elysee', 'le bourget', 'assemblée nationale'] },
  { name: 'Marseille', de: 'Marseille', country: 'France', cc: 'FR', lat: 43.2965, lon: 5.3698, p: 3, aliases: ['marseille', 'lyon', 'toulouse'] },
  { name: 'London', de: 'London', country: 'United Kingdom', cc: 'GB', lat: 51.5074, lon: -0.1278, p: 3, aliases: ['london', 'westminster', 'downing street', 'bank of england', 'whitehall'] },
  { name: 'Edinburgh', de: 'Edinburgh', country: 'United Kingdom', cc: 'GB', lat: 55.9533, lon: -3.1883, p: 3, aliases: ['edinburgh', 'scotland', 'schottland'] },
  { name: 'Manchester', de: 'Manchester', country: 'United Kingdom', cc: 'GB', lat: 53.4808, lon: -2.2426, p: 3, aliases: ['manchester', 'birmingham', 'liverpool'] },
  { name: 'Dublin', de: 'Dublin', country: 'Ireland', cc: 'IE', lat: 53.3498, lon: -6.2603, p: 3, aliases: ['dublin'] },
  { name: 'Amsterdam', de: 'Amsterdam', country: 'Netherlands', cc: 'NL', lat: 52.3676, lon: 4.9041, p: 3, aliases: ['amsterdam', 'rotterdam', 'eindhoven'] },
  { name: 'The Hague', de: 'Den Haag', country: 'Netherlands', cc: 'NL', lat: 52.0705, lon: 4.3007, p: 3, aliases: ['the hague', 'den haag', 'international criminal court', 'istgh', 'igh', 'icj'] },
  { name: 'Rome', de: 'Rom', country: 'Italy', cc: 'IT', lat: 41.9028, lon: 12.4964, p: 3, aliases: ['rome', 'rom', 'roma', 'vatican', 'vatikan'] },
  { name: 'Milan', de: 'Mailand', country: 'Italy', cc: 'IT', lat: 45.4642, lon: 9.19, p: 3, aliases: ['milan', 'mailand', 'milano', 'turin', 'torino'] },
  { name: 'Naples', de: 'Neapel', country: 'Italy', cc: 'IT', lat: 40.8518, lon: 14.2681, p: 3, aliases: ['naples', 'neapel', 'napoli'] },
  { name: 'Madrid', de: 'Madrid', country: 'Spain', cc: 'ES', lat: 40.4168, lon: -3.7038, p: 3, aliases: ['madrid'] },
  { name: 'Barcelona', de: 'Barcelona', country: 'Spain', cc: 'ES', lat: 41.3874, lon: 2.1686, p: 3, aliases: ['barcelona', 'valencia'] },
  { name: 'Lisbon', de: 'Lissabon', country: 'Portugal', cc: 'PT', lat: 38.7223, lon: -9.1393, p: 3, aliases: ['lisbon', 'lissabon', 'lisboa'] },
  { name: 'Warsaw', de: 'Warschau', country: 'Poland', cc: 'PL', lat: 52.2297, lon: 21.0122, p: 3, aliases: ['warsaw', 'warschau', 'warszawa'] },
  { name: 'Kraków', de: 'Krakau', country: 'Poland', cc: 'PL', lat: 50.0647, lon: 19.945, p: 3, aliases: ['kraków', 'krakow', 'krakau'] },
  { name: 'Gdańsk', de: 'Danzig', country: 'Poland', cc: 'PL', lat: 54.352, lon: 18.6466, p: 3, aliases: ['gdańsk', 'gdansk', 'danzig'] },
  { name: 'Prague', de: 'Prag', country: 'Czechia', cc: 'CZ', lat: 50.0755, lon: 14.4378, p: 3, aliases: ['prague', 'prag', 'praha'] },
  { name: 'Budapest', de: 'Budapest', country: 'Hungary', cc: 'HU', lat: 47.4979, lon: 19.0402, p: 3, aliases: ['budapest'] },
  { name: 'Bratislava', de: 'Bratislava', country: 'Slovakia', cc: 'SK', lat: 48.1486, lon: 17.1077, p: 3, aliases: ['bratislava'] },
  { name: 'Bucharest', de: 'Bukarest', country: 'Romania', cc: 'RO', lat: 44.4268, lon: 26.1025, p: 3, aliases: ['bucharest', 'bukarest'] },
  { name: 'Sofia', de: 'Sofia', country: 'Bulgaria', cc: 'BG', lat: 42.6977, lon: 23.3219, p: 3, aliases: ['sofia'] },
  { name: 'Athens', de: 'Athen', country: 'Greece', cc: 'GR', lat: 37.9838, lon: 23.7275, p: 3, aliases: ['athens', 'athen'] },
  { name: 'Belgrade', de: 'Belgrad', country: 'Serbia', cc: 'RS', lat: 44.7866, lon: 20.4489, p: 3, aliases: ['belgrade', 'belgrad'] },
  { name: 'Zagreb', de: 'Zagreb', country: 'Croatia', cc: 'HR', lat: 45.815, lon: 15.9819, p: 3, aliases: ['zagreb'] },
  { name: 'Sarajevo', de: 'Sarajevo', country: 'Bosnia', cc: 'BA', lat: 43.8563, lon: 18.4131, p: 3, aliases: ['sarajevo'] },
  { name: 'Pristina', de: 'Pristina', country: 'Kosovo', cc: 'XK', lat: 42.6629, lon: 21.1655, p: 3, aliases: ['pristina', 'kosovo'] },
  { name: 'Stockholm', de: 'Stockholm', country: 'Sweden', cc: 'SE', lat: 59.3293, lon: 18.0686, p: 3, aliases: ['stockholm'] },
  { name: 'Oslo', de: 'Oslo', country: 'Norway', cc: 'NO', lat: 59.9139, lon: 10.7522, p: 3, aliases: ['oslo'] },
  { name: 'Copenhagen', de: 'Kopenhagen', country: 'Denmark', cc: 'DK', lat: 55.6761, lon: 12.5683, p: 3, aliases: ['copenhagen', 'kopenhagen'] },
  { name: 'Helsinki', de: 'Helsinki', country: 'Finland', cc: 'FI', lat: 60.1699, lon: 24.9384, p: 3, aliases: ['helsinki'] },
  { name: 'Reykjavik', de: 'Reykjavik', country: 'Iceland', cc: 'IS', lat: 64.1466, lon: -21.9426, p: 3, aliases: ['reykjavik'] },
  { name: 'Tallinn', de: 'Tallinn', country: 'Estonia', cc: 'EE', lat: 59.437, lon: 24.7536, p: 3, aliases: ['tallinn'] },
  { name: 'Riga', de: 'Riga', country: 'Latvia', cc: 'LV', lat: 56.9496, lon: 24.1052, p: 3, aliases: ['riga'] },
  { name: 'Vilnius', de: 'Vilnius', country: 'Lithuania', cc: 'LT', lat: 54.6872, lon: 25.2797, p: 3, aliases: ['vilnius'] },
  { name: 'Kyiv', de: 'Kiew', country: 'Ukraine', cc: 'UA', lat: 50.4501, lon: 30.5234, p: 3, aliases: ['kyiv', 'kiew', 'kiev'] },
  { name: 'Kharkiv', de: 'Charkiw', country: 'Ukraine', cc: 'UA', lat: 49.9935, lon: 36.2304, p: 3, aliases: ['kharkiv', 'charkiw', 'kharkov'] },
  { name: 'Dnipro', de: 'Dnipro', country: 'Ukraine', cc: 'UA', lat: 48.4647, lon: 35.0462, p: 3, aliases: ['dnipro', 'dnipropetrovsk', 'dnipropetrowsk', 'kryvyi rih', 'sumy', 'mykolaiv', 'cherson', 'kherson'] },
  { name: 'Odesa', de: 'Odessa', country: 'Ukraine', cc: 'UA', lat: 46.4825, lon: 30.7233, p: 3, aliases: ['odesa', 'odessa'] },
  { name: 'Lviv', de: 'Lwiw', country: 'Ukraine', cc: 'UA', lat: 49.8397, lon: 24.0297, p: 3, aliases: ['lviv', 'lwiw', 'lemberg'] },
  { name: 'Chisinau', de: 'Chișinău', country: 'Moldova', cc: 'MD', lat: 47.0105, lon: 28.8638, p: 3, aliases: ['chisinau', 'transnistria', 'transnistrien'] },
  { name: 'Minsk', de: 'Minsk', country: 'Belarus', cc: 'BY', lat: 53.9006, lon: 27.559, p: 3, aliases: ['minsk'] },
  { name: 'Moscow', de: 'Moskau', country: 'Russia', cc: 'RU', lat: 55.7558, lon: 37.6173, p: 3, aliases: ['moscow', 'moskau', 'kremlin', 'kreml'] },
  { name: 'St. Petersburg', de: 'St. Petersburg', country: 'Russia', cc: 'RU', lat: 59.9343, lon: 30.3351, p: 3, aliases: ['st. petersburg', 'saint petersburg', 'sankt petersburg'] },
  { name: 'Tbilisi', de: 'Tiflis', country: 'Georgia', cc: 'GE', lat: 41.7151, lon: 44.8271, p: 3, aliases: ['tbilisi', 'tiflis'] },
  { name: 'Yerevan', de: 'Jerewan', country: 'Armenia', cc: 'AM', lat: 40.1792, lon: 44.4991, p: 3, aliases: ['yerevan', 'jerewan'] },
  { name: 'Baku', de: 'Baku', country: 'Azerbaijan', cc: 'AZ', lat: 40.4093, lon: 49.8671, p: 3, aliases: ['baku'] },

  // ── Priority 3: Middle East & North Africa ──
  { name: 'Ankara', de: 'Ankara', country: 'Turkey', cc: 'TR', lat: 39.9334, lon: 32.8597, p: 3, aliases: ['ankara'] },
  { name: 'Istanbul', de: 'Istanbul', country: 'Turkey', cc: 'TR', lat: 41.0082, lon: 28.9784, p: 3, aliases: ['istanbul', 'bosporus', 'bosphorus'] },
  { name: 'Jerusalem', de: 'Jerusalem', country: 'Israel', cc: 'IL', lat: 31.7683, lon: 35.2137, p: 3, aliases: ['jerusalem', 'knesset'] },
  { name: 'Tel Aviv', de: 'Tel Aviv', country: 'Israel', cc: 'IL', lat: 32.0853, lon: 34.7818, p: 3, aliases: ['tel aviv', 'haifa'] },
  { name: 'Beirut', de: 'Beirut', country: 'Lebanon', cc: 'LB', lat: 33.8938, lon: 35.5018, p: 3, aliases: ['beirut', 'hisbollah', 'hezbollah'] },
  { name: 'Damascus', de: 'Damaskus', country: 'Syria', cc: 'SY', lat: 33.5138, lon: 36.2765, p: 3, aliases: ['damascus', 'damaskus', 'aleppo', 'idlib'] },
  { name: 'Amman', de: 'Amman', country: 'Jordan', cc: 'JO', lat: 31.9454, lon: 35.9284, p: 3, aliases: ['amman'] },
  { name: 'Baghdad', de: 'Bagdad', country: 'Iraq', cc: 'IQ', lat: 33.3152, lon: 44.3661, p: 3, aliases: ['baghdad', 'bagdad', 'erbil', 'basra'] },
  { name: 'Tehran', de: 'Teheran', country: 'Iran', cc: 'IR', lat: 35.6892, lon: 51.389, p: 3, aliases: ['tehran', 'teheran', 'isfahan'] },
  { name: 'Riyadh', de: 'Riad', country: 'Saudi Arabia', cc: 'SA', lat: 24.7136, lon: 46.6753, p: 3, aliases: ['riyadh', 'riad', 'jeddah', 'dschidda'] },
  { name: 'Dubai', de: 'Dubai', country: 'UAE', cc: 'AE', lat: 25.2048, lon: 55.2708, p: 3, aliases: ['dubai'] },
  { name: 'Abu Dhabi', de: 'Abu Dhabi', country: 'UAE', cc: 'AE', lat: 24.4539, lon: 54.3773, p: 3, aliases: ['abu dhabi'] },
  { name: 'Doha', de: 'Doha', country: 'Qatar', cc: 'QA', lat: 25.2854, lon: 51.531, p: 3, aliases: ['doha'] },
  { name: 'Kuwait City', de: 'Kuwait-Stadt', country: 'Kuwait', cc: 'KW', lat: 29.3759, lon: 47.9774, p: 3, aliases: ['kuwait city', 'kuwait-stadt'] },
  { name: 'Muscat', de: 'Maskat', country: 'Oman', cc: 'OM', lat: 23.588, lon: 58.3829, p: 3, aliases: ['muscat', 'maskat'] },
  { name: 'Sanaa', de: 'Sanaa', country: 'Yemen', cc: 'YE', lat: 15.3694, lon: 44.191, p: 3, aliases: ['sanaa', 'hodeidah', 'aden', 'houthi', 'huthi'] },
  { name: 'Cairo', de: 'Kairo', country: 'Egypt', cc: 'EG', lat: 30.0444, lon: 31.2357, p: 3, aliases: ['cairo', 'kairo', 'alexandria'] },
  { name: 'Tripoli', de: 'Tripolis', country: 'Libya', cc: 'LY', lat: 32.8872, lon: 13.1913, p: 3, aliases: ['tripoli', 'tripolis', 'benghazi', 'bengasi'] },
  { name: 'Tunis', de: 'Tunis', country: 'Tunisia', cc: 'TN', lat: 36.8065, lon: 10.1815, p: 3, aliases: ['tunis'] },
  { name: 'Algiers', de: 'Algier', country: 'Algeria', cc: 'DZ', lat: 36.7538, lon: 3.0588, p: 3, aliases: ['algiers', 'algier'] },
  { name: 'Rabat', de: 'Rabat', country: 'Morocco', cc: 'MA', lat: 34.0209, lon: -6.8416, p: 3, aliases: ['rabat', 'casablanca', 'marrakech', 'marrakesch'] },

  // ── Priority 3: North & South America ──
  { name: 'Washington, D.C.', de: 'Washington, D.C.', country: 'United States', cc: 'US', lat: 38.9072, lon: -77.0369, p: 3, aliases: ['washington', 'white house', 'weißes haus', 'weisses haus', 'pentagon', 'capitol hill', 'us-kongress', 'supreme court', 'federal reserve', 'state department', 'us-senat'] },
  { name: 'New York', de: 'New York', country: 'United States', cc: 'US', lat: 40.7128, lon: -74.006, p: 3, aliases: ['new york', 'manhattan', 'wall street', 'nasdaq', 'nyse', 'un-sicherheitsrat', 'un security council', 'un general assembly', 'un-vollversammlung'] },
  { name: 'San Francisco', de: 'San Francisco', country: 'United States', cc: 'US', lat: 37.7749, lon: -122.4194, p: 3, aliases: ['san francisco', 'silicon valley', 'cupertino', 'mountain view', 'palo alto', 'santa clara', 'menlo park', 'openai', 'anthropic'] },
  { name: 'Los Angeles', de: 'Los Angeles', country: 'United States', cc: 'US', lat: 34.0522, lon: -118.2437, p: 3, aliases: ['los angeles', 'hollywood', 'pasadena'] },
  { name: 'Chicago', de: 'Chicago', country: 'United States', cc: 'US', lat: 41.8781, lon: -87.6298, p: 3, aliases: ['chicago'] },
  { name: 'Houston', de: 'Houston', country: 'United States', cc: 'US', lat: 29.7604, lon: -95.3698, p: 3, aliases: ['houston', 'dallas', 'austin'] },
  { name: 'Seattle', de: 'Seattle', country: 'United States', cc: 'US', lat: 47.6062, lon: -122.3321, p: 3, aliases: ['seattle', 'redmond'] },
  { name: 'Boston', de: 'Boston', country: 'United States', cc: 'US', lat: 42.3601, lon: -71.0589, p: 3, aliases: ['boston', 'harvard', 'massachusetts institute of technology'] },
  { name: 'Miami', de: 'Miami', country: 'United States', cc: 'US', lat: 25.7617, lon: -80.1918, p: 3, aliases: ['miami', 'mar-a-lago', 'palm beach'] },
  { name: 'Atlanta', de: 'Atlanta', country: 'United States', cc: 'US', lat: 33.749, lon: -84.388, p: 3, aliases: ['atlanta'] },
  { name: 'Detroit', de: 'Detroit', country: 'United States', cc: 'US', lat: 42.3314, lon: -83.0458, p: 3, aliases: ['detroit'] },
  { name: 'Ottawa', de: 'Ottawa', country: 'Canada', cc: 'CA', lat: 45.4215, lon: -75.6972, p: 3, aliases: ['ottawa'] },
  { name: 'Toronto', de: 'Toronto', country: 'Canada', cc: 'CA', lat: 43.6532, lon: -79.3832, p: 3, aliases: ['toronto', 'montreal', 'vancouver'] },
  { name: 'Mexico City', de: 'Mexiko-Stadt', country: 'Mexico', cc: 'MX', lat: 19.4326, lon: -99.1332, p: 3, aliases: ['mexico city', 'mexiko-stadt', 'ciudad de méxico'] },
  { name: 'Havana', de: 'Havanna', country: 'Cuba', cc: 'CU', lat: 23.1136, lon: -82.3666, p: 3, aliases: ['havana', 'havanna', 'cuba', 'kuba'] },
  { name: 'Saint-Martin', de: 'Saint-Martin', country: 'Caribbean', cc: 'MF', lat: 18.0708, lon: -63.0501, p: 3, aliases: ['saint-martin', 'sint maarten', 'guadeloupe', 'martinique'] },
  { name: 'Port-au-Prince', de: 'Port-au-Prince', country: 'Haiti', cc: 'HT', lat: 18.5944, lon: -72.3074, p: 3, aliases: ['port-au-prince'] },
  { name: 'Bogotá', de: 'Bogotá', country: 'Colombia', cc: 'CO', lat: 4.711, lon: -74.0721, p: 3, aliases: ['bogotá', 'bogota'] },
  { name: 'Caracas', de: 'Caracas', country: 'Venezuela', cc: 'VE', lat: 10.4806, lon: -66.9036, p: 3, aliases: ['caracas'] },
  { name: 'Lima', de: 'Lima', country: 'Peru', cc: 'PE', lat: -12.0464, lon: -77.0428, p: 3, aliases: ['lima'] },
  { name: 'Quito', de: 'Quito', country: 'Ecuador', cc: 'EC', lat: -0.1807, lon: -78.4678, p: 3, aliases: ['quito', 'guayaquil'] },
  { name: 'Brasília', de: 'Brasília', country: 'Brazil', cc: 'BR', lat: -15.7975, lon: -47.8919, p: 3, aliases: ['brasília', 'brasilia'] },
  { name: 'São Paulo', de: 'São Paulo', country: 'Brazil', cc: 'BR', lat: -23.5505, lon: -46.6333, p: 3, aliases: ['são paulo', 'sao paulo', 'rio de janeiro'] },
  { name: 'Buenos Aires', de: 'Buenos Aires', country: 'Argentina', cc: 'AR', lat: -34.6037, lon: -58.3816, p: 3, aliases: ['buenos aires'] },
  { name: 'Santiago', de: 'Santiago de Chile', country: 'Chile', cc: 'CL', lat: -33.4489, lon: -70.6693, p: 3, aliases: ['santiago de chile', 'santiago'] },

  // ── Priority 3: Asia-Pacific ──
  { name: 'Beijing', de: 'Peking', country: 'China', cc: 'CN', lat: 39.9042, lon: 116.4074, p: 3, aliases: ['beijing', 'peking'] },
  { name: 'Shanghai', de: 'Shanghai', country: 'China', cc: 'CN', lat: 31.2304, lon: 121.4737, p: 3, aliases: ['shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'wuhan'] },
  { name: 'Hong Kong', de: 'Hongkong', country: 'Hong Kong', cc: 'HK', lat: 22.3193, lon: 114.1694, p: 3, aliases: ['hong kong', 'hongkong'] },
  { name: 'Taipei', de: 'Taipeh', country: 'Taiwan', cc: 'TW', lat: 25.033, lon: 121.5654, p: 3, aliases: ['taipei', 'taipeh', 'tsmc', 'hsinchu'] },
  { name: 'Tokyo', de: 'Tokio', country: 'Japan', cc: 'JP', lat: 35.6762, lon: 139.6503, p: 3, aliases: ['tokyo', 'tokio', 'bank of japan', 'nikkei', 'osaka', 'fukushima'] },
  { name: 'Seoul', de: 'Seoul', country: 'South Korea', cc: 'KR', lat: 37.5665, lon: 126.978, p: 3, aliases: ['seoul', 'busan'] },
  { name: 'Pyongyang', de: 'Pjöngjang', country: 'North Korea', cc: 'KP', lat: 39.0392, lon: 125.7625, p: 3, aliases: ['pyongyang', 'pjöngjang', 'pjoengjang'] },
  { name: 'New Delhi', de: 'Neu-Delhi', country: 'India', cc: 'IN', lat: 28.6139, lon: 77.209, p: 3, aliases: ['new delhi', 'neu-delhi', 'delhi'] },
  { name: 'Mumbai', de: 'Mumbai', country: 'India', cc: 'IN', lat: 19.076, lon: 72.8777, p: 3, aliases: ['mumbai', 'bengaluru', 'bangalore', 'hyderabad'] },
  { name: 'Islamabad', de: 'Islamabad', country: 'Pakistan', cc: 'PK', lat: 33.6844, lon: 73.0479, p: 3, aliases: ['islamabad', 'karachi', 'lahore'] },
  { name: 'Kabul', de: 'Kabul', country: 'Afghanistan', cc: 'AF', lat: 34.5553, lon: 69.2075, p: 3, aliases: ['kabul', 'kandahar'] },
  { name: 'Dhaka', de: 'Dhaka', country: 'Bangladesh', cc: 'BD', lat: 23.8103, lon: 90.4125, p: 3, aliases: ['dhaka'] },
  { name: 'Colombo', de: 'Colombo', country: 'Sri Lanka', cc: 'LK', lat: 6.9271, lon: 79.8612, p: 3, aliases: ['colombo'] },
  { name: 'Kathmandu', de: 'Kathmandu', country: 'Nepal', cc: 'NP', lat: 27.7172, lon: 85.324, p: 3, aliases: ['kathmandu'] },
  { name: 'Singapore', de: 'Singapur', country: 'Singapore', cc: 'SG', lat: 1.3521, lon: 103.8198, p: 3, aliases: ['singapore', 'singapur'] },
  { name: 'Bangkok', de: 'Bangkok', country: 'Thailand', cc: 'TH', lat: 13.7563, lon: 100.5018, p: 3, aliases: ['bangkok'] },
  { name: 'Hanoi', de: 'Hanoi', country: 'Vietnam', cc: 'VN', lat: 21.0278, lon: 105.8342, p: 3, aliases: ['hanoi', 'ho chi minh'] },
  { name: 'Jakarta', de: 'Jakarta', country: 'Indonesia', cc: 'ID', lat: -6.2088, lon: 106.8456, p: 3, aliases: ['jakarta'] },
  { name: 'Manila', de: 'Manila', country: 'Philippines', cc: 'PH', lat: 14.5995, lon: 120.9842, p: 3, aliases: ['manila'] },
  { name: 'Kuala Lumpur', de: 'Kuala Lumpur', country: 'Malaysia', cc: 'MY', lat: 3.139, lon: 101.6869, p: 3, aliases: ['kuala lumpur'] },
  { name: 'Yangon', de: 'Rangun', country: 'Myanmar', cc: 'MM', lat: 16.8409, lon: 96.1735, p: 3, aliases: ['yangon', 'rangun', 'naypyidaw'] },
  { name: 'Astana', de: 'Astana', country: 'Kazakhstan', cc: 'KZ', lat: 51.1694, lon: 71.4491, p: 3, aliases: ['astana', 'almaty'] },
  { name: 'Tashkent', de: 'Taschkent', country: 'Uzbekistan', cc: 'UZ', lat: 41.2995, lon: 69.2401, p: 3, aliases: ['tashkent', 'taschkent'] },
  { name: 'Sydney', de: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.8688, lon: 151.2093, p: 3, aliases: ['sydney', 'melbourne'] },
  { name: 'Canberra', de: 'Canberra', country: 'Australia', cc: 'AU', lat: -35.2809, lon: 149.13, p: 3, aliases: ['canberra'] },
  { name: 'Wellington', de: 'Wellington', country: 'New Zealand', cc: 'NZ', lat: -41.2866, lon: 174.7756, p: 3, aliases: ['wellington', 'auckland'] },

  // ── Priority 3: Sub-Saharan Africa ──
  { name: 'Khartoum', de: 'Khartum', country: 'Sudan', cc: 'SD', lat: 15.5007, lon: 32.5599, p: 3, aliases: ['khartoum', 'khartum', 'darfur', 'port sudan'] },
  { name: 'Addis Ababa', de: 'Addis Abeba', country: 'Ethiopia', cc: 'ET', lat: 9.032, lon: 38.7469, p: 3, aliases: ['addis ababa', 'addis abeba'] },
  { name: 'Nairobi', de: 'Nairobi', country: 'Kenya', cc: 'KE', lat: -1.2921, lon: 36.8219, p: 3, aliases: ['nairobi'] },
  { name: 'Mogadishu', de: 'Mogadischu', country: 'Somalia', cc: 'SO', lat: 2.0469, lon: 45.3182, p: 3, aliases: ['mogadishu', 'mogadischu'] },
  { name: 'Kinshasa', de: 'Kinshasa', country: 'DR Congo', cc: 'CD', lat: -4.4419, lon: 15.2663, p: 3, aliases: ['kinshasa', 'goma', 'kivu'] },
  { name: 'Kigali', de: 'Kigali', country: 'Rwanda', cc: 'RW', lat: -1.9441, lon: 30.0619, p: 3, aliases: ['kigali'] },
  { name: 'Lagos', de: 'Lagos', country: 'Nigeria', cc: 'NG', lat: 6.5244, lon: 3.3792, p: 3, aliases: ['lagos', 'abuja'] },
  { name: 'Accra', de: 'Accra', country: 'Ghana', cc: 'GH', lat: 5.6037, lon: -0.187, p: 3, aliases: ['accra'] },
  { name: 'Dakar', de: 'Dakar', country: 'Senegal', cc: 'SN', lat: 14.7167, lon: -17.4677, p: 3, aliases: ['dakar'] },
  { name: 'Bamako', de: 'Bamako', country: 'Mali', cc: 'ML', lat: 12.6392, lon: -8.0029, p: 3, aliases: ['bamako', 'niamey', 'ouagadougou'] },
  { name: 'Johannesburg', de: 'Johannesburg', country: 'South Africa', cc: 'ZA', lat: -26.2041, lon: 28.0473, p: 3, aliases: ['johannesburg', 'pretoria', 'cape town', 'kapstadt'] },

  // ── Priority 2: Regions, Islands & States ──
  { name: 'California', de: 'Kalifornien', country: 'United States', cc: 'US', lat: 36.7783, lon: -119.4179, p: 2, aliases: ['california', 'kalifornien'] },
  { name: 'Nevada', de: 'Nevada', country: 'United States', cc: 'US', lat: 39.1638, lon: -119.7674, p: 2, aliases: ['nevada', 'las vegas', 'reno'] },
  { name: 'Texas', de: 'Texas', country: 'United States', cc: 'US', lat: 31.9686, lon: -99.9018, p: 2, aliases: ['texas'] },
  { name: 'Florida', de: 'Florida', country: 'United States', cc: 'US', lat: 27.9944, lon: -81.7603, p: 2, aliases: ['florida'] },
  { name: 'Alaska', de: 'Alaska', country: 'United States', cc: 'US', lat: 64.2008, lon: -149.4937, p: 2, aliases: ['alaska'] },
  { name: 'Hawaii', de: 'Hawaii', country: 'United States', cc: 'US', lat: 19.8968, lon: -155.5828, p: 2, aliases: ['hawaii'] },
  { name: 'Greenland', de: 'Grönland', country: 'Greenland', cc: 'GL', lat: 71.7069, lon: -42.6043, p: 2, aliases: ['greenland', 'grönland', 'groenland', 'nuuk'] },
  { name: 'Bavaria', de: 'Bayern', country: 'Germany', cc: 'DE', lat: 48.7904, lon: 11.4979, p: 2, aliases: ['bavaria', 'bayern'] },
  { name: 'North Rhine-Westphalia', de: 'Nordrhein-Westfalen', country: 'Germany', cc: 'DE', lat: 51.4332, lon: 7.6616, p: 2, aliases: ['nordrhein-westfalen', 'north rhine-westphalia'] },
  { name: 'Catalonia', de: 'Katalonien', country: 'Spain', cc: 'ES', lat: 41.5912, lon: 1.5209, p: 2, aliases: ['catalonia', 'katalonien'] },
  { name: 'Xinjiang', de: 'Xinjiang', country: 'China', cc: 'CN', lat: 41.75, lon: 86.15, p: 2, aliases: ['xinjiang', 'tibet'] },
  { name: 'Kashmir', de: 'Kaschmir', country: 'India / Pakistan', cc: 'IN', lat: 34.0837, lon: 74.7973, p: 2, aliases: ['kashmir', 'kaschmir', 'srinagar'] },
  { name: 'Siberia', de: 'Sibirien', country: 'Russia', cc: 'RU', lat: 60.0, lon: 105.0, p: 2, aliases: ['siberia', 'sibirien', 'kamchatka', 'kamtschatka'] },
  { name: 'Arctic', de: 'Arktis', country: 'Arctic', cc: 'NO', lat: 78.2232, lon: 15.6267, p: 2, aliases: ['arctic', 'arktis', 'svalbard', 'spitzbergen'] },
  { name: 'Antarctica', de: 'Antarktis', country: 'Antarctica', cc: 'AQ', lat: -75.2509, lon: -0.0713, p: 2, aliases: ['antarctica', 'antarktis'] },
  { name: 'Amazon', de: 'Amazonas', country: 'Brazil', cc: 'BR', lat: -3.4653, lon: -62.2159, p: 2, aliases: ['amazon rainforest', 'amazonas', 'manaus', 'belém', 'belem'] },

  // ── Priority 1: Countries / Political Anchors (anchored at capital/political hub) ──
  { name: 'Switzerland', de: 'Schweiz', country: 'Switzerland', cc: 'CH', lat: 46.948, lon: 7.4474, p: 1, aliases: ['switzerland', 'schweiz', 'schweizer', 'swiss', 'suisse', 'svizzera'] },
  { name: 'Germany', de: 'Deutschland', country: 'Germany', cc: 'DE', lat: 52.52, lon: 13.405, p: 1, aliases: ['germany', 'deutschland', 'german', 'deutsche', 'deutschen', 'deutscher'] },
  { name: 'Austria', de: 'Österreich', country: 'Austria', cc: 'AT', lat: 48.2082, lon: 16.3738, p: 1, aliases: ['austria', 'österreich', 'oesterreich', 'austrian'] },
  { name: 'France', de: 'Frankreich', country: 'France', cc: 'FR', lat: 48.8566, lon: 2.3522, p: 1, aliases: ['france', 'frankreich', 'french', 'französisch', 'franzoesisch', 'macron', 'mélenchon', 'melenchon'] },
  { name: 'United Kingdom', de: 'Großbritannien', country: 'United Kingdom', cc: 'GB', lat: 51.5074, lon: -0.1278, p: 1, aliases: ['united kingdom', 'großbritannien', 'grossbritannien', 'britain', 'british', 'britische', 'england', 'starmer'] },
  { name: 'United States', de: 'USA', country: 'United States', cc: 'US', lat: 38.9072, lon: -77.0369, p: 1, aliases: ['united states', 'vereinigte staaten', 'u.s.', 'usa', 'us-präsident', 'us-regierung', 'us-zwischenwahlen', 'midterms', 'demokraten', 'republikaner', 'trump', 'biden'] },
  { name: 'Canada', de: 'Kanada', country: 'Canada', cc: 'CA', lat: 45.4215, lon: -75.6972, p: 1, aliases: ['canada', 'kanada', 'canadian', 'kanadisch'] },
  { name: 'Mexico', de: 'Mexiko', country: 'Mexico', cc: 'MX', lat: 19.4326, lon: -99.1332, p: 1, aliases: ['mexico', 'mexiko', 'mexican'] },
  { name: 'Brazil', de: 'Brasilien', country: 'Brazil', cc: 'BR', lat: -15.7975, lon: -47.8919, p: 1, aliases: ['brazil', 'brasilien', 'brazilian', 'lula'] },
  { name: 'Argentina', de: 'Argentinien', country: 'Argentina', cc: 'AR', lat: -34.6037, lon: -58.3816, p: 1, aliases: ['argentina', 'argentinien', 'milei'] },
  { name: 'Chile', de: 'Chile', country: 'Chile', cc: 'CL', lat: -33.4489, lon: -70.6693, p: 1, aliases: ['chile', 'chilenisch'] },
  { name: 'Colombia', de: 'Kolumbien', country: 'Colombia', cc: 'CO', lat: 4.711, lon: -74.0721, p: 1, aliases: ['colombia', 'kolumbien'] },
  { name: 'Venezuela', de: 'Venezuela', country: 'Venezuela', cc: 'VE', lat: 10.4806, lon: -66.9036, p: 1, aliases: ['venezuela', 'maduro'] },
  { name: 'Ukraine', de: 'Ukraine', country: 'Ukraine', cc: 'UA', lat: 50.4501, lon: 30.5234, p: 1, aliases: ['ukraine', 'ukrainian', 'ukrainisch', 'ukrainische', 'zelensky', 'selenskyj'] },
  { name: 'Russia', de: 'Russland', country: 'Russia', cc: 'RU', lat: 55.7558, lon: 37.6173, p: 1, aliases: ['russia', 'russland', 'russian', 'russisch', 'russische', 'putin'] },
  { name: 'Poland', de: 'Polen', country: 'Poland', cc: 'PL', lat: 52.2297, lon: 21.0122, p: 1, aliases: ['poland', 'polen', 'polish', 'polnisch', 'tusk'] },
  { name: 'Italy', de: 'Italien', country: 'Italy', cc: 'IT', lat: 41.9028, lon: 12.4964, p: 1, aliases: ['italy', 'italien', 'italian', 'italienisch', 'meloni'] },
  { name: 'Spain', de: 'Spanien', country: 'Spain', cc: 'ES', lat: 40.4168, lon: -3.7038, p: 1, aliases: ['spain', 'spanien', 'spanish', 'spanisch'] },
  { name: 'Portugal', de: 'Portugal', country: 'Portugal', cc: 'PT', lat: 38.7223, lon: -9.1393, p: 1, aliases: ['portugal', 'portuguese', 'portugiesisch'] },
  { name: 'Netherlands', de: 'Niederlande', country: 'Netherlands', cc: 'NL', lat: 52.3676, lon: 4.9041, p: 1, aliases: ['netherlands', 'niederlande', 'dutch', 'niederländisch'] },
  { name: 'Belgium', de: 'Belgien', country: 'Belgium', cc: 'BE', lat: 50.8503, lon: 4.3517, p: 1, aliases: ['belgium', 'belgien', 'belgian'] },
  { name: 'Sweden', de: 'Schweden', country: 'Sweden', cc: 'SE', lat: 59.3293, lon: 18.0686, p: 1, aliases: ['sweden', 'schweden', 'swedish', 'schwedisch'] },
  { name: 'Norway', de: 'Norwegen', country: 'Norway', cc: 'NO', lat: 59.9139, lon: 10.7522, p: 1, aliases: ['norway', 'norwegen', 'norwegian', 'norwegisch'] },
  { name: 'Denmark', de: 'Dänemark', country: 'Denmark', cc: 'DK', lat: 55.6761, lon: 12.5683, p: 1, aliases: ['denmark', 'dänemark', 'daenemark', 'danish', 'dänisch'] },
  { name: 'Finland', de: 'Finnland', country: 'Finland', cc: 'FI', lat: 60.1699, lon: 24.9384, p: 1, aliases: ['finland', 'finnland', 'finnish', 'finnisch'] },
  { name: 'Greece', de: 'Griechenland', country: 'Greece', cc: 'GR', lat: 37.9838, lon: 23.7275, p: 1, aliases: ['greece', 'griechenland', 'greek', 'griechisch'] },
  { name: 'Turkey', de: 'Türkei', country: 'Turkey', cc: 'TR', lat: 39.9334, lon: 32.8597, p: 1, aliases: ['turkey', 'türkei', 'tuerkei', 'türkiye', 'turkish', 'türkisch', 'erdogan'] },
  { name: 'Hungary', de: 'Ungarn', country: 'Hungary', cc: 'HU', lat: 47.4979, lon: 19.0402, p: 1, aliases: ['hungary', 'ungarn', 'hungarian', 'orban', 'orbán'] },
  { name: 'Czechia', de: 'Tschechien', country: 'Czechia', cc: 'CZ', lat: 50.0755, lon: 14.4378, p: 1, aliases: ['czechia', 'czech republic', 'tschechien'] },
  { name: 'Romania', de: 'Rumänien', country: 'Romania', cc: 'RO', lat: 44.4268, lon: 26.1025, p: 1, aliases: ['romania', 'rumänien', 'rumaenien'] },
  { name: 'Serbia', de: 'Serbien', country: 'Serbia', cc: 'RS', lat: 44.7866, lon: 20.4489, p: 1, aliases: ['serbia', 'serbien', 'serbian'] },
  { name: 'Israel', de: 'Israel', country: 'Israel', cc: 'IL', lat: 31.7683, lon: 35.2137, p: 1, aliases: ['israel', 'israeli', 'israelisch', 'israelische', 'netanyahu', 'netanjahu', 'idf'] },
  { name: 'Palestine', de: 'Palästina', country: 'Palestine', cc: 'PS', lat: 31.9038, lon: 35.2034, p: 1, aliases: ['palestine', 'palästina', 'palestinian', 'palästinensisch', 'palästinenser'] },
  { name: 'Lebanon', de: 'Libanon', country: 'Lebanon', cc: 'LB', lat: 33.8938, lon: 35.5018, p: 1, aliases: ['lebanon', 'libanon', 'lebanese', 'libanesisch'] },
  { name: 'Syria', de: 'Syrien', country: 'Syria', cc: 'SY', lat: 33.5138, lon: 36.2765, p: 1, aliases: ['syria', 'syrien', 'syrian', 'syrisch'] },
  { name: 'Iran', de: 'Iran', country: 'Iran', cc: 'IR', lat: 35.6892, lon: 51.389, p: 1, aliases: ['iran', 'iranian', 'iranisch', 'iranische'] },
  { name: 'Iraq', de: 'Irak', country: 'Iraq', cc: 'IQ', lat: 33.3152, lon: 44.3661, p: 1, aliases: ['iraq', 'irak', 'iraqi', 'irakisch'] },
  { name: 'Saudi Arabia', de: 'Saudi-Arabien', country: 'Saudi Arabia', cc: 'SA', lat: 24.7136, lon: 46.6753, p: 1, aliases: ['saudi arabia', 'saudi-arabien', 'saudi'] },
  { name: 'Yemen', de: 'Jemen', country: 'Yemen', cc: 'YE', lat: 15.3694, lon: 44.191, p: 1, aliases: ['yemen', 'jemen', 'yemeni'] },
  { name: 'Egypt', de: 'Ägypten', country: 'Egypt', cc: 'EG', lat: 30.0444, lon: 31.2357, p: 1, aliases: ['egypt', 'ägypten', 'aegypten', 'egyptian'] },
  { name: 'China', de: 'China', country: 'China', cc: 'CN', lat: 39.9042, lon: 116.4074, p: 1, aliases: ['china', 'chinese', 'chinesisch', 'chinesische', 'xi jinping'] },
  { name: 'Taiwan', de: 'Taiwan', country: 'Taiwan', cc: 'TW', lat: 25.033, lon: 121.5654, p: 1, aliases: ['taiwan', 'taiwanese', 'taiwanisch'] },
  { name: 'Japan', de: 'Japan', country: 'Japan', cc: 'JP', lat: 35.6762, lon: 139.6503, p: 1, aliases: ['japan', 'japanese', 'japanisch', 'japanische'] },
  { name: 'South Korea', de: 'Südkorea', country: 'South Korea', cc: 'KR', lat: 37.5665, lon: 126.978, p: 1, aliases: ['south korea', 'südkorea', 'suedkorea', 'korean', 'südkoreanisch'] },
  { name: 'North Korea', de: 'Nordkorea', country: 'North Korea', cc: 'KP', lat: 39.0392, lon: 125.7625, p: 1, aliases: ['north korea', 'nordkorea', 'kim jong un'] },
  { name: 'India', de: 'Indien', country: 'India', cc: 'IN', lat: 28.6139, lon: 77.209, p: 1, aliases: ['india', 'indien', 'indian', 'indisch', 'modi'] },
  { name: 'Pakistan', de: 'Pakistan', country: 'Pakistan', cc: 'PK', lat: 33.6844, lon: 73.0479, p: 1, aliases: ['pakistan', 'pakistani'] },
  { name: 'Afghanistan', de: 'Afghanistan', country: 'Afghanistan', cc: 'AF', lat: 34.5553, lon: 69.2075, p: 1, aliases: ['afghanistan', 'taliban'] },
  { name: 'Indonesia', de: 'Indonesien', country: 'Indonesia', cc: 'ID', lat: -6.2088, lon: 106.8456, p: 1, aliases: ['indonesia', 'indonesien'] },
  { name: 'Philippines', de: 'Philippinen', country: 'Philippines', cc: 'PH', lat: 14.5995, lon: 120.9842, p: 1, aliases: ['philippines', 'philippinen'] },
  { name: 'Vietnam', de: 'Vietnam', country: 'Vietnam', cc: 'VN', lat: 21.0278, lon: 105.8342, p: 1, aliases: ['vietnam', 'vietnamese'] },
  { name: 'Thailand', de: 'Thailand', country: 'Thailand', cc: 'TH', lat: 13.7563, lon: 100.5018, p: 1, aliases: ['thailand', 'thai'] },
  { name: 'Myanmar', de: 'Myanmar', country: 'Myanmar', cc: 'MM', lat: 16.8409, lon: 96.1735, p: 1, aliases: ['myanmar', 'burma'] },
  { name: 'Australia', de: 'Australien', country: 'Australia', cc: 'AU', lat: -35.2809, lon: 149.13, p: 1, aliases: ['australia', 'australien', 'australian'] },
  { name: 'New Zealand', de: 'Neuseeland', country: 'New Zealand', cc: 'NZ', lat: -41.2866, lon: 174.7756, p: 1, aliases: ['new zealand', 'neuseeland'] },
  { name: 'Sudan', de: 'Sudan', country: 'Sudan', cc: 'SD', lat: 15.5007, lon: 32.5599, p: 1, aliases: ['sudan', 'sudanese'] },
  { name: 'Nigeria', de: 'Nigeria', country: 'Nigeria', cc: 'NG', lat: 9.0765, lon: 7.3986, p: 1, aliases: ['nigeria', 'nigerian'] },
  { name: 'South Africa', de: 'Südafrika', country: 'South Africa', cc: 'ZA', lat: -25.7479, lon: 28.2293, p: 1, aliases: ['south africa', 'südafrika', 'suedafrika'] },
  { name: 'Kenya', de: 'Kenia', country: 'Kenya', cc: 'KE', lat: -1.2921, lon: 36.8219, p: 1, aliases: ['kenya', 'kenia'] },
  { name: 'Ethiopia', de: 'Äthiopien', country: 'Ethiopia', cc: 'ET', lat: 9.032, lon: 38.7469, p: 1, aliases: ['ethiopia', 'äthiopien', 'aethiopien'] },
  { name: 'European Union', de: 'Europäische Union', country: 'European Union', cc: 'EU', lat: 50.8503, lon: 4.3517, p: 1, aliases: ['european union', 'europäische union', 'europaeische union', 'eurozone'] },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED_GAZETTEER = GAZETTEER_RAW.map((entry) => {
  const patterns = entry.aliases.map((alias) => {
    const trimmed = alias.trim().toLowerCase();
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegex(trimmed)})(?=[^\\p{L}\\p{N}]|$)`, 'iu');
  });
  return { ...entry, patterns };
});

function fnv1aHash(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Format latitude & longitude into crisp military/editorial DMS + grid readout.
 */
export function formatTacticalCoord(lat, lon) {
  const fmtAxis = (val, posHem, negHem, padDeg) => {
    const hem = val >= 0 ? posHem : negHem;
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);
    const adjMin = sec === 60 ? min + 1 : min;
    const adjSec = sec === 60 ? 0 : sec;
    return `${String(deg).padStart(padDeg, '0')}°${String(adjMin).padStart(2, '0')}'${String(adjSec).padStart(2, '0')}"${hem}`;
  };
  const zone = Math.max(1, Math.min(60, Math.floor((lon + 180) / 6) + 1));
  const bands = 'CDEFGHJKLMNPQRSTUVWX';
  const bandIdx = Math.max(0, Math.min(bands.length - 1, Math.floor((lat + 80) / 8)));
  const band = bands[bandIdx] || 'N';
  return `${fmtAxis(lat, 'N', 'S', 2)} ${fmtAxis(lon, 'E', 'W', 3)} · ${zone}${band}`;
}

/**
 * Resolve the primary geographic anchor for an article or live ticker.
 * Checks both localized text AND original English text (if available) so
 * translations or proper-noun variations never miss a place match.
 */
export function geolocateStory({
  slug = '',
  title = '',
  dek = '',
  facts = [],
  enTitle = '',
  enDek = '',
  locale = 'en',
} = {}) {
  const headlineBlob = `${title || ''} ${enTitle || ''} ${String(slug || '').replace(/-/g, ' ')}`;
  const bodyBlob = `${dek || ''} ${enDek || ''} ${Array.isArray(facts) ? facts.slice(0, 4).join(' ') : ''}`;

  let best = null;
  let bestScore = 0;

  for (const entry of COMPILED_GAZETTEER) {
    let matchedInHeadline = false;
    let matchedInBody = false;

    for (const rx of entry.patterns) {
      if (!matchedInHeadline && rx.test(headlineBlob)) {
        matchedInHeadline = true;
        break;
      }
      if (!matchedInBody && rx.test(bodyBlob)) {
        matchedInBody = true;
      }
    }

    if (!matchedInHeadline && !matchedInBody) continue;

    // Priority tier (1..4) dominates; headline matches strongly outrank body mentions.
    const tierWeight = entry.p * 100;
    const positionWeight = matchedInHeadline ? 45 : 15;
    const score = tierWeight + positionWeight;

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best) return null;

  // Deterministic golden-angle micro-spiral so multiple dispatches in the same
  // capital (e.g. Washington, Berlin, Kyiv) form a clean clickable constellation.
  const hash = fnv1aHash(slug || title);
  const step = (hash % 19) + 1;
  const angle = step * 2.399963229728653; // golden angle in radians
  const maxSpread = best.p >= 3 ? 0.045 : best.p === 2 ? 0.14 : 0.22;
  const radius = ((hash >>> 5) % 100) / 100 * maxSpread;
  const cosLat = Math.max(0.25, Math.cos((best.lat * Math.PI) / 180));
  const lat = Math.max(-84, Math.min(84, Number((best.lat + Math.sin(angle) * radius).toFixed(5))));
  const lon = Number((((best.lon + (Math.cos(angle) * radius) / cosLat + 540) % 360) - 180).toFixed(5));

  const placeName = locale === 'de' && best.de ? best.de : best.name;
  const precision = best.p >= 4 ? 'site' : best.p === 3 ? 'city' : best.p === 2 ? 'region' : 'country';

  return {
    lat,
    lon,
    baseLat: best.lat,
    baseLon: best.lon,
    placeName,
    canonicalPlace: best.name,
    country: best.country,
    countryCode: best.cc,
    precision,
    tacticalCoord: formatTacticalCoord(best.lat, best.lon),
  };
}
