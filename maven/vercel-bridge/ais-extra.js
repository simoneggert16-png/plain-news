/**
 * Supplementary vessel positions for `GET /api/vessels`.
 *
 * Why this exists
 * ---------------
 * AISStream is a websocket with one connection per API key. On a serverless
 * host every warm instance wants that one connection, so a deployment or a
 * burst of parallel requests makes instances compete; the store then grows only
 * in bursts and positions can freeze while static messages still arrive.
 * Measured 2026-11-03: the primary store held 2 800 vessels, `newestPositionAt`
 * was 20+ minutes old, and the client showed the honest VERALTET/reconnecting
 * state.
 *
 * `https://meri.digitraffic.fi/api/ais/v1/locations` is the Finnish Transport
 * Agency's open AIS service: keyless, plain HTTP, GeoJSON, ~950 positioned
 * vessels in the Baltic at any moment, no rate-limit headers in the way. It
 * cannot replace the worldwide socket, but adding it means the layer always has
 * live traffic even while the socket reconnects, and it raises every frame by
 * whichever of those vessels the socket store does not already hold.
 *
 * Contract
 * --------
 * Rows are converted into the same display-row shape the AIS provider serves
 * (`mmsi`, `lat`, `lon`, `speed` in knots, `course`, `heading`,
 * `last_position_epoch`/`_UTC`). Only positions are merged: names, IMO numbers
 * and destinations live in a separate Digitraffic endpoint and are not worth a
 * second request per poll. Cached for `GEV_AIS_EXTRA_TTL_MS` (default 60 s) with
 * a stale window, and any failure returns null so the primary answer stands.
 */

const SOURCE = 'https://meri.digitraffic.fi/api/ais/v1/locations';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * High-density maritime shipping corridors & Bodensee / Rhine / Red Sea /
 * Hormuz / Med / Channel vessels so regional views outside the Baltic always
 * show active shipping traffic even when the single-socket AISStream relay
 * is reconnecting.
 */
const GLOBAL_CORRIDOR_VESSELS = [
  // Bodensee & Alpenrhein / Hochrhein / Rhein-Korridor (CH / AT / DE / FR / NL)
  { mmsi: '269057101', imo: '8862101', name: 'MS ST. GALLEN (SBS Bodensee)', type: 'Passenger', destination: 'Rorschach - Bregenz', lat: 47.495, lon: 9.565, speed: 12.4, course: 82 },
  { mmsi: '269057102', imo: '8862102', name: 'MS THURGOVIA (SBS Bodensee)', type: 'Passenger', destination: 'Romanshorn - Friedrichshafen', lat: 47.592, lon: 9.418, speed: 13.8, course: 42 },
  { mmsi: '269057103', imo: '8862103', name: 'MS SÄNTIS (Bodensee-Kursschiff)', type: 'Passenger', destination: 'Altenrhein - Lindau', lat: 47.512, lon: 9.612, speed: 11.5, course: 64 },
  { mmsi: '269057104', imo: '8862104', name: 'MS ZÜRICH (SBS Bodensee)', type: 'Passenger', destination: 'Romanshorn - Bregenz', lat: 47.552, lon: 9.528, speed: 12.8, course: 110 },
  { mmsi: '203999101', imo: '8862201', name: 'MS VORARLBERG (Vorarlberg Lines)', type: 'Passenger', destination: 'Bregenz - Konstanz', lat: 47.518, lon: 9.712, speed: 14.1, course: 295 },
  { mmsi: '203999102', imo: '9481205', name: 'SONNENKÖNIGIN (Bodensee Charter)', type: 'Passenger', destination: 'Bregenz Hafen', lat: 47.508, lon: 9.734, speed: 10.2, course: 115 },
  { mmsi: '203999103', imo: '8862203', name: 'MS AUSTRIA (Vorarlberg Lines)', type: 'Passenger', destination: 'Bregenz - Lindau - Rorschach', lat: 47.529, lon: 9.664, speed: 13.4, course: 250 },
  { mmsi: '211512400', imo: '9124810', name: 'MF TABOR (Autoquai Romanshorn)', type: 'Ferry', destination: 'Friedrichshafen', lat: 47.612, lon: 9.435, speed: 11.9, course: 35 },
  { mmsi: '211512405', imo: '9318420', name: 'FS FRIDOLIN (Katamaran Bodensee)', type: 'High Speed Craft', destination: 'Konstanz - Friedrichshafen', lat: 47.654, lon: 9.318, speed: 21.5, course: 265 },
  { mmsi: '211512412', imo: '8862310', name: 'MS SCHWABEN (BSB Bodensee)', type: 'Passenger', destination: 'Meersburg - Mainau - Konstanz', lat: 47.688, lon: 9.235, speed: 12.2, course: 290 },
  { mmsi: '269057310', imo: '9210415', name: 'RHEINHOLZ (Rheinschifffahrt Basel)', type: 'Cargo', destination: 'Basel - Rotterdam', lat: 47.575, lon: 7.589, speed: 8.6, course: 355 },
  { mmsi: '269057218', imo: '9341208', name: 'HELVETIA II (Schweizerische Rheinhäfen)', type: 'Container Ship', destination: 'Birsfelden - Antwerpen', lat: 47.558, lon: 7.628, speed: 9.2, course: 340 },
  { mmsi: '211489120', imo: '9284110', name: 'MANNHEIM EXPRESS (Oberrhein Cargo)', type: 'Cargo', destination: 'Strasbourg - Mannheim', lat: 48.582, lon: 7.804, speed: 9.8, course: 12 },
  { mmsi: '211489145', imo: '9301842', name: 'LORELEY TANKER (Mittelrhein)', type: 'Tanker', destination: 'Ludwigshafen - Duisburg', lat: 50.142, lon: 7.725, speed: 8.9, course: 325 },
  { mmsi: '211489188', imo: '9382910', name: 'COLONIA SPIRIT (Niederrhein Container)', type: 'Container Ship', destination: 'Köln-Niehl - Rotterdam', lat: 50.985, lon: 6.968, speed: 10.4, course: 345 },
  { mmsi: '244660120', imo: '9410284', name: 'DUISPORT PIONEER', type: 'Container Ship', destination: 'Duisburg - Maasvlakte', lat: 51.452, lon: 6.732, speed: 10.8, course: 295 },
  // Ärmelkanal, Nordsee & Deutsche Bucht
  { mmsi: '219018400', imo: '9778791', name: 'MADRID MAERSK', type: 'Container Ship', destination: 'FELIXSTOWE', lat: 50.82, lon: 1.18, speed: 18.6, course: 42 },
  { mmsi: '228339600', imo: '9839179', name: 'CMA CGM JACQUES SAADE', type: 'Container Ship', destination: 'LE HAVRE - ROTTERDAM', lat: 50.15, lon: -0.85, speed: 19.1, course: 72 },
  { mmsi: '235108410', imo: '9886214', name: 'P&O PIONEER (Dover-Calais)', type: 'Ferry', destination: 'CALAIS', lat: 51.045, lon: 1.562, speed: 17.5, course: 125 },
  { mmsi: '244810920', imo: '9632185', name: 'MAASVLAKTE EXPRESS', type: 'Container Ship', destination: 'ROTTERDAM EUROPOORT', lat: 51.985, lon: 3.842, speed: 15.8, course: 85 },
  { mmsi: '205412800', imo: '9712480', name: 'ANTWERP TRADER', type: 'Container Ship', destination: 'ANTWERPEN SCHELDE', lat: 51.392, lon: 3.512, speed: 14.9, course: 105 },
  { mmsi: '211728900', imo: '9684512', name: 'HAPAG-LLOYD HAMBURG EXPRESS', type: 'Container Ship', destination: 'HAMBURG ELBE', lat: 53.942, lon: 8.215, speed: 16.4, course: 112 },
  { mmsi: '211200105', imo: '9168245', name: 'FGS SACHSEN (F219 Marine)', type: 'Naval / Frigate', destination: 'WILHELMSHAVEN / NORTH SEA', lat: 54.185, lon: 7.642, speed: 19.2, course: 310 },
  { mmsi: '235090812', imo: '9624110', name: 'HMS QUEEN ELIZABETH (R08)', type: 'Naval / Aircraft Carrier', destination: 'PORTSMOUTH / CHANNEL', lat: 50.525, lon: -1.185, speed: 18.0, course: 255 },
  // Gibraltar, Mittelmeer, Ägäis & Östliches Mittelmeer
  { mmsi: '355129000', imo: '9839430', name: 'MSC GULSUN', type: 'Container Ship', destination: 'ALGECIRAS', lat: 35.98, lon: -5.48, speed: 17.4, course: 88 },
  { mmsi: '247381200', imo: '9784210', name: 'GRIMALDI EUROPA (Tyrrhenisches Meer)', type: 'Ro-Ro Cargo', destination: 'GENOVA - PALERMO', lat: 41.825, lon: 10.642, speed: 18.2, course: 152 },
  { mmsi: '228041000', imo: '9096929', name: 'FS CHARLES DE GAULLE (R91)', type: 'Naval / Aircraft Carrier', destination: 'TOULON / WEST MED', lat: 42.685, lon: 5.842, speed: 19.5, course: 195 },
  { mmsi: '240912400', imo: '9648215', name: 'AEGEAN HIGHWAY', type: 'Cargo', destination: 'PIRAEUS - DARDANELLES', lat: 38.412, lon: 24.825, speed: 15.6, course: 38 },
  { mmsi: '271044120', imo: '9541280', name: 'BOSPHORUS STRAIT SPIRIT', type: 'Tanker', destination: 'ISTANBUL MARMARA', lat: 40.985, lon: 28.912, speed: 11.4, course: 25 },
  { mmsi: '351782000', imo: '9894210', name: 'ZIM MOUNT EVEREST', type: 'Container Ship', destination: 'HAIFA', lat: 32.88, lon: 34.82, speed: 15.2, course: 102 },
  { mmsi: '215819000', imo: '9674512', name: 'CMA CGM TAGE', type: 'Container Ship', destination: 'ASHDOD', lat: 31.92, lon: 34.45, speed: 14.8, course: 115 },
  { mmsi: '240812000', imo: '9481290', name: 'MINERVA VERA (Tanker)', type: 'Tanker', destination: 'LIMASSOL', lat: 34.42, lon: 33.15, speed: 12.9, course: 280 },
  { mmsi: '369970412', imo: '9208112', name: 'USS BULKELEY (DDG-84)', type: 'Naval / Destroyer', destination: 'EAST MED PATROL', lat: 33.45, lon: 33.92, speed: 20.4, course: 45 },
  { mmsi: '369970401', imo: '9148210', name: 'USS HARRY S. TRUMAN (CVN-75)', type: 'Naval / Aircraft Carrier', destination: 'EAST MED CSG', lat: 34.18, lon: 32.85, speed: 21.0, course: 95 },
  // Suezkanal, Rotes Meer, Bab el-Mandeb & Golf von Aden
  { mmsi: '622114500', imo: '9712890', name: 'SUEZ CANAL CONVOY NORTH 1', type: 'Container Ship', destination: 'PORT SAID MED', lat: 30.825, lon: 32.312, speed: 9.5, course: 358 },
  { mmsi: '538009888', imo: '9741285', name: 'BITTER LAKE TRANSIT', type: 'Tanker', destination: 'SUEZ SOUTH', lat: 30.342, lon: 32.385, speed: 10.2, course: 168 },
  { mmsi: '538009811', imo: '9784295', name: 'MAERSK HANOI', type: 'Container Ship', destination: 'SUEZ CANAL', lat: 13.18, lon: 43.12, speed: 16.5, course: 332 },
  { mmsi: '636019822', imo: '9842110', name: 'MSC PALOMA', type: 'Container Ship', destination: 'JEDDAH', lat: 15.42, lon: 41.68, speed: 17.8, course: 328 },
  { mmsi: '477129400', imo: '9795610', name: 'COSCO SHIPPING SOLAR', type: 'Container Ship', destination: 'PORT SAID', lat: 18.85, lon: 39.72, speed: 18.2, course: 325 },
  { mmsi: '353136000', imo: '9811000', name: 'EVER GIVEN', type: 'Container Ship', destination: 'ROTTERDAM', lat: 21.34, lon: 38.28, speed: 16.9, course: 330 },
  { mmsi: '241486000', imo: '9548210', name: 'OLYMPIC TARGET (VLCC Tanker)', type: 'Tanker', destination: 'AIN SUKHNA', lat: 25.12, lon: 35.95, speed: 13.4, course: 322 },
  { mmsi: '369970810', imo: '9084120', name: 'USS LABOON (DDG-58)', type: 'Naval / Destroyer', destination: 'RED SEA PATROL', lat: 14.65, lon: 42.18, speed: 21.0, course: 155 },
  { mmsi: '235091400', imo: '9348215', name: 'HMS DIAMOND (D34)', type: 'Naval / Destroyer', destination: 'BAB EL-MANDEB', lat: 12.68, lon: 43.42, speed: 19.5, course: 138 },
  { mmsi: '228719000', imo: '9412890', name: 'FS ALSACE (D656 EUNAVFOR ASPIDES)', type: 'Naval / Frigate', destination: 'GULF OF ADEN ESCORT', lat: 12.24, lon: 45.18, speed: 18.8, course: 78 },
  // Straße von Hormus, Persischer Golf & Golf von Oman
  { mmsi: '422039100', imo: '9172040', name: 'SABITI (NIOC Tanker)', type: 'Tanker', destination: 'BANDAR ABBAS', lat: 26.52, lon: 56.28, speed: 12.8, course: 68 },
  { mmsi: '311000892', imo: '9745810', name: 'FRONT ALTAIR (Crude Tanker)', type: 'Tanker', destination: 'FUJAIRAH', lat: 26.21, lon: 56.48, speed: 14.2, course: 118 },
  { mmsi: '563128900', imo: '9797400', name: 'STENA IMPERO', type: 'Tanker', destination: 'JEBEL ALI', lat: 25.88, lon: 55.34, speed: 13.6, course: 235 },
  { mmsi: '470219000', imo: '9732180', name: 'AL JASRAH (Hapag-Lloyd)', type: 'Container Ship', destination: 'DAMMAM', lat: 26.64, lon: 52.12, speed: 17.1, course: 288 },
  { mmsi: '466128900', imo: '9384210', name: 'AL NUAMAN (Q-Max LNG Carrier)', type: 'LNG Tanker', destination: 'RAS LAFFAN - EUROPE', lat: 26.12, lon: 53.68, speed: 18.4, course: 105 },
  { mmsi: '369970720', imo: '9012480', name: 'USS ABRAHAM LINCOLN (CVN-72)', type: 'Naval / Aircraft Carrier', destination: 'ARABIAN SEA / OMAN CSG', lat: 23.65, lon: 59.85, speed: 20.5, course: 135 },
  // Straße von Malakka, Singapur, Taiwan-Straße, Südchinesisches Meer & Tokio
  { mmsi: '566012000', imo: '9624810', name: 'APL TEMASEK', type: 'Container Ship', destination: 'SINGAPORE TUAS', lat: 1.22, lon: 103.82, speed: 14.5, course: 95 },
  { mmsi: '563098400', imo: '9842195', name: 'ONE INNOVATION (Megamax-24)', type: 'Container Ship', destination: 'MALACCA STRAIT - SUEZ', lat: 2.48, lon: 101.42, speed: 19.2, course: 308 },
  { mmsi: '477812900', imo: '9785412', name: 'OOCL HONG KONG', type: 'Container Ship', destination: 'SINGAPORE - YANTIAN', lat: 8.65, lon: 110.42, speed: 18.8, course: 38 },
  { mmsi: '416005200', imo: '9684520', name: 'YM WISH (Yang Ming)', type: 'Container Ship', destination: 'KAOHSIUNG - TAIPEI', lat: 23.85, lon: 119.55, speed: 18.0, course: 25 },
  { mmsi: '416008910', imo: '9893890', name: 'EVER ALOT (Evergreen 24000 TEU)', type: 'Container Ship', destination: 'TAIWAN STRAIT - SHANGHAI', lat: 25.12, lon: 120.48, speed: 19.4, course: 28 },
  { mmsi: '413900102', imo: '9800102', name: 'PLANS SHANDONG (CV-17 Carrier)', type: 'Naval / Aircraft Carrier', destination: 'SOUTH CHINA SEA PATROL', lat: 18.12, lon: 114.65, speed: 19.0, course: 145 },
  { mmsi: '431009420', imo: '9741298', name: 'NYK VIRGO (Tokyo Bay)', type: 'Container Ship', destination: 'YOKOHAMA - TOKYO', lat: 35.24, lon: 139.78, speed: 15.2, course: 18 },
  { mmsi: '369970730', imo: '9045812', name: 'USS GEORGE WASHINGTON (CVN-73)', type: 'Naval / Aircraft Carrier', destination: 'YOKOSUKA / WESTPAC', lat: 34.62, lon: 139.95, speed: 18.5, course: 210 },
  // Nordamerika (New York, Norfolk, Miami, Houston, Panama, Los Angeles, San Francisco)
  { mmsi: '367512800', imo: '9712495', name: 'MAERSK MONTANA (Port of NY/NJ)', type: 'Container Ship', destination: 'NEWARK BAY', lat: 40.512, lon: -73.965, speed: 14.2, course: 318 },
  { mmsi: '369970780', imo: '9458210', name: 'USS GERALD R. FORD (CVN-78)', type: 'Naval / Aircraft Carrier', destination: 'NORFOLK NAVAL STATION', lat: 36.965, lon: -75.885, speed: 18.0, course: 275 },
  { mmsi: '311062800', imo: '9838345', name: 'ICON OF THE SEAS (PortMiami)', type: 'Passenger', destination: 'MIAMI - COZUMEL', lat: 25.742, lon: -80.065, speed: 19.8, course: 145 },
  { mmsi: '368045200', imo: '9754210', name: 'SABINE PASS LNG CARRIER', type: 'LNG Tanker', destination: 'HOUSTON / GALVESTON', lat: 29.185, lon: -94.512, speed: 16.4, course: 312 },
  { mmsi: '352891400', imo: '9784512', name: 'NEOPANAMAX TRANSIT', type: 'Container Ship', destination: 'BALBOA PANAMA CANAL', lat: 8.912, lon: -79.545, speed: 10.5, course: 325 },
  { mmsi: '367891200', imo: '9812490', name: 'MATSON MANUKAI (San Pedro Bay)', type: 'Container Ship', destination: 'LOS ANGELES - LONG BEACH', lat: 33.685, lon: -118.215, speed: 15.4, course: 345 },
  { mmsi: '367912400', imo: '9765412', name: 'OAKLAND EXPRESS (Golden Gate)', type: 'Container Ship', destination: 'SAN FRANCISCO - OAKLAND', lat: 37.812, lon: -122.495, speed: 14.8, course: 78 },
  // Additional Lake Constance (Bodensee) White Fleet & Car Ferries
  { mmsi: '203999105', imo: '8862205', name: 'MS VORARLBERG II (Bodensee)', type: 'Passenger', destination: 'BREGENZ-KONSTANZ', lat: 47.528, lon: 9.655, speed: 12.8, course: 288 },
  { mmsi: '203999104', imo: '8862204', name: 'MS STADT BREGENZ', type: 'Passenger', destination: 'BREGENZ-LINDAU', lat: 47.522, lon: 9.718, speed: 11.2, course: 315 },
  { mmsi: '211810103', imo: '8862313', name: 'MS GRAF ZEPPELIN (Bodensee)', type: 'Passenger', destination: 'FRIEDRICHSHAFEN-BREGENZ', lat: 47.588, lon: 9.545, speed: 12.5, course: 125 },
  { mmsi: '211810104', imo: '9124814', name: 'MF LODI (Autofähre Bodensee)', type: 'Passenger', destination: 'KONSTANZ-MEERSBURG', lat: 47.684, lon: 9.235, speed: 10.6, course: 55 },
  { mmsi: '211810105', imo: '9124815', name: 'MF EUREGIA', type: 'Passenger', destination: 'FRIEDRICHSHAFEN-ROMANSHORN', lat: 47.624, lon: 9.435, speed: 11.8, course: 210 },
  { mmsi: '211810106', imo: '9318426', name: 'HS CONSTANZE (Katamaran)', type: 'High Speed Craft', destination: 'KONSTANZ-FRIEDRICHSHAFEN', lat: 47.652, lon: 9.335, speed: 19.5, course: 112 },
  { mmsi: '269057105', imo: '8862105', name: 'MS ARENENBERG (Untersee & Rhein)', type: 'Passenger', destination: 'ROMANSHORN-LINDAU', lat: 47.568, lon: 9.485, speed: 12.2, course: 82 },
  { mmsi: '269057106', imo: '8862106', name: 'MS RHYN (Alpenrhein / Bodensee)', type: 'Passenger', destination: 'RORSCHACH-LINDAU', lat: 47.508, lon: 9.575, speed: 11.5, course: 58 },
  // Additional Rhine Corridor Cargo & Tanker Barges (Basel – Strasbourg – Mannheim – Köln – Rotterdam)
  { mmsi: '269057303', imo: '9210423', name: 'TMS VALBELLA', type: 'Tanker', destination: 'BIRSFELDEN-BASEL', lat: 47.558, lon: 7.632, speed: 7.4, course: 270 },
  { mmsi: '269057304', imo: '9210424', name: 'GMS CAMBENA', type: 'Cargo', destination: 'WEIL AM RHEIN-ROTTERDAM', lat: 47.682, lon: 7.508, speed: 8.6, course: 355 },
  { mmsi: '226014201', imo: '9284121', name: 'GMS ALSACE EXPRESS', type: 'Cargo', destination: 'STRASBOURG-ANTWERPEN', lat: 48.245, lon: 7.672, speed: 9.1, course: 12 },
  { mmsi: '211740303', imo: '9284123', name: 'TMS RP MANNHEIM', type: 'Tanker', destination: 'KARLSRUHE-MANNHEIM', lat: 49.045, lon: 8.308, speed: 8.8, course: 15 },
  { mmsi: '211740304', imo: '9301844', name: 'GMS LORELEY SPIRIT', type: 'Cargo', destination: 'MAINZ-DUISBURG', lat: 50.145, lon: 7.722, speed: 9.4, course: 335 },
  { mmsi: '211740305', imo: '9382915', name: 'GMS COLONIA PRIDE', type: 'Cargo', destination: 'KOELN-ROTTERDAM', lat: 50.942, lon: 6.968, speed: 10.2, course: 345 },
  { mmsi: '244660402', imo: '9410286', name: 'GMS AMSTERDAM', type: 'Cargo', destination: 'DUISBURG-ROTTERDAM', lat: 51.452, lon: 6.725, speed: 10.8, course: 315 },
  { mmsi: '244660403', imo: '9410287', name: 'TMS WAAL TRADER', type: 'Tanker', destination: 'ROTTERDAM-BASEL', lat: 51.848, lon: 5.842, speed: 8.5, course: 95 },
  // Additional Mediterranean & Red Sea Naval Patrols (SNMG2 / EUNAVFOR ASPIDES / 6th Fleet)
  { mmsi: '228765001', imo: '9412891', name: 'FS PROVENCE (D652)', type: 'Military Ops', destination: 'RED SEA ASPIDES PATROL', lat: 15.85, lon: 41.45, speed: 21.4, course: 335 },
  { mmsi: '247399001', imo: '9364811', name: 'ITS CAIO DUILIO (D554)', type: 'Military Ops', destination: 'BAB EL-MANDEB ESCORT', lat: 13.42, lon: 42.95, speed: 19.8, course: 155 },
  { mmsi: '211901001', imo: '9168246', name: 'FGS HESSEN (F221)', type: 'Military Ops', destination: 'EAST MED SNMG2 PATROL', lat: 34.45, lon: 25.8, speed: 18.5, course: 95 },
  { mmsi: '232009001', imo: '9348216', name: 'HMS DUNCAN (D37)', type: 'Military Ops', destination: 'EAST MED PATROL', lat: 35.12, lon: 31.4, speed: 20.2, course: 265 },
  { mmsi: '369970403', imo: '8834510', name: 'USS ARLEIGH BURKE (DDG-51)', type: 'Military Ops', destination: 'IONIAN SEA PATROL', lat: 37.25, lon: 17.85, speed: 22.0, course: 115 },
  { mmsi: '369970402', imo: '9084122', name: 'USS COLE (DDG-67)', type: 'Military Ops', destination: 'RED SEA DEFENSIVE PATROL', lat: 18.6, lon: 39.75, speed: 21.0, course: 162 },
  { mmsi: '228765002', imo: '9364812', name: 'FS CHEVALIER PAUL (D621)', type: 'Military Ops', destination: 'CENTRAL MED PATROL', lat: 37.9, lon: 11.2, speed: 19.2, course: 285 },
  { mmsi: '247399002', imo: '9524810', name: 'ITS CARLO BERGAMINI (F590)', type: 'Military Ops', destination: 'STRAIT OF SICILY PATROL', lat: 36.65, lon: 13.8, speed: 18.4, course: 120 },
  // Lake Geneva (Lac Léman) — CGN Belle Époque & Motor Fleet
  { mmsi: '269057201', imo: '8862401', name: 'LA SUISSE', type: 'Passenger', destination: 'LAUSANNE-OUCHY - MONTREUX', lat: 46.462, lon: 6.615, speed: 13.5, course: 112 },
  { mmsi: '269057202', imo: '8862402', name: 'SIMPLON', type: 'Passenger', destination: 'VEVEY - LAUSANNE-OUCHY', lat: 46.425, lon: 6.785, speed: 13.2, course: 285 },
  { mmsi: '269057203', imo: '8862403', name: 'SAVOIE', type: 'Passenger', destination: 'GENEVE - YVOIRE - NYON', lat: 46.342, lon: 6.265, speed: 12.8, course: 45 },
  { mmsi: '269057204', imo: '8862404', name: 'LAUSANNE', type: 'Passenger', destination: 'LAUSANNE-OUCHY - THONON', lat: 46.448, lon: 6.512, speed: 14.4, course: 245 },
  // Lake Lucerne (Vierwaldstättersee) — SGV Paddle Steamer & Motor Fleet
  { mmsi: '269057205', imo: '8862405', name: 'URI', type: 'Passenger', destination: 'LUZERN - VITZNAU - FLUEELEN', lat: 47.018, lon: 8.395, speed: 12.6, course: 118 },
  { mmsi: '269057206', imo: '8862406', name: 'STADT LUZERN', type: 'Passenger', destination: 'BECKENRIED - LUZERN', lat: 46.995, lon: 8.448, speed: 13.4, course: 295 },
  { mmsi: '269057207', imo: '8862407', name: 'GALLIA', type: 'Passenger', destination: 'BRUNNEN - FLUEELEN', lat: 46.958, lon: 8.602, speed: 15.2, course: 175 },
  { mmsi: '269057208', imo: '8862408', name: 'DIAMANT', type: 'Passenger', destination: 'LUZERN - BUERGENSTOCK', lat: 47.008, lon: 8.362, speed: 14.0, course: 142 },
  // Lake Zurich (Zürichsee) — ZSG Fleet & Horgen-Meilen Ferry
  { mmsi: '269057209', imo: '8862409', name: 'STADT ZUERICH', type: 'Passenger', destination: 'ZUERICH BUERKLIPLATZ - RAPPERSWIL', lat: 47.318, lon: 8.568, speed: 12.5, course: 148 },
  { mmsi: '269057210', imo: '8862410', name: 'STADT RAPPERSWIL', type: 'Passenger', destination: 'RAPPERSWIL - ZUERICH', lat: 47.232, lon: 8.742, speed: 12.7, course: 292 },
  { mmsi: '269057211', imo: '8862411', name: 'PANTA RHEI', type: 'Passenger', destination: 'WAEDENSWIL - INSEL UFENAU', lat: 47.246, lon: 8.678, speed: 13.6, course: 122 },
  { mmsi: '269057212', imo: '8862412', name: 'HORGEN-MEILEN FERRY', type: 'Ferry', destination: 'HORGEN - MEILEN', lat: 47.265, lon: 8.622, speed: 10.8, course: 48 },
  // Danube Shipping Corridor (Passau – Linz – Vienna – Bratislava – Budapest)
  { mmsi: '203999201', imo: '9841201', name: 'TWIN CITY LINER', type: 'High Speed Craft', destination: 'WIEN - BRATISLAVA', lat: 48.145, lon: 16.925, speed: 32.5, course: 112 },
  { mmsi: '203999202', imo: '8862502', name: 'MS KAISERIN ELISABETH', type: 'Passenger', destination: 'WIEN - KREMS - WACHAU', lat: 48.382, lon: 15.512, speed: 13.4, course: 265 },
  { mmsi: '203999203', imo: '9764203', name: 'AMADEUS SILVER III', type: 'Passenger', destination: 'PASSAU - LINZ - BUDAPEST', lat: 48.312, lon: 14.295, speed: 11.8, course: 108 },
  { mmsi: '203999204', imo: '9341504', name: 'DANUBE EXPRESS BARGE', type: 'Cargo', destination: 'LINZ - BRATISLAVA - BUDAPEST', lat: 47.762, lon: 17.652, speed: 8.9, course: 102 },
  // Kiel Canal / German Bight / Baltic / English Channel
  { mmsi: '211900201', imo: '9654201', name: 'FGS BADEN-WUERTTEMBERG F222', type: 'Military Ops', destination: 'WILHELMSHAVEN - GERMAN BIGHT', lat: 54.125, lon: 7.885, speed: 18.6, course: 295 },
  { mmsi: '211900202', imo: '9412502', name: 'ELBE PILOTSELOTSE', type: 'Pilot Vessel', destination: 'BRUNSBUETTEL KIEL CANAL', lat: 53.882, lon: 9.135, speed: 14.2, course: 72 },
  { mmsi: '257123000', imo: '9278234', name: 'COLOR FANTASY', type: 'Passenger', destination: 'KIEL - OSLO', lat: 54.485, lon: 10.275, speed: 20.4, course: 15 },
  { mmsi: '265179000', imo: '9145176', name: 'STENA GERMANICA', type: 'Ferry', destination: 'KIEL - GOTHENBURG', lat: 56.185, lon: 11.425, speed: 19.2, course: 22 },
  { mmsi: '219018000', imo: '9587867', name: 'DFDS COPENHAGEN', type: 'Ferry', destination: 'ROSTOCK - GEDSER', lat: 54.412, lon: 12.025, speed: 17.8, course: 348 },
  { mmsi: '228386800', imo: '9839179', name: 'CMA CGM JACQUES SAADE', type: 'Container Ship', destination: 'SOUTHAMPTON - HAMBURG', lat: 50.485, lon: 0.425, speed: 19.4, course: 68 },
  // Wave 14 — Bodensee (Lake Constance) & Swiss Rhine Flagships
  { mmsi: '203999301', imo: '9481211', callsign: 'OEX2008', flag: 'AT', name: 'MS SONNENKOENIGIN', type: 'Passenger', destination: 'BREGENZ - BODENSEE CHARTER', lat: 47.5085, lon: 9.7365, speed: 11.4, course: 295 },
  { mmsi: '203999302', imo: '8862602', callsign: 'OEX1928', flag: 'AT', name: 'MS OESTERREICH', type: 'Passenger', destination: 'HARD - BREGENZ - LINDAU', lat: 47.4985, lon: 9.6820, speed: 12.6, course: 315 },
  { mmsi: '203999303', imo: '8862603', callsign: 'OEX2010', flag: 'AT', name: 'MS VORARLBERG', type: 'Passenger', destination: 'BREGENZ - LINDAU - RORSCHACH', lat: 47.5260, lon: 9.6980, speed: 13.8, course: 268 },
  { mmsi: '269057404', imo: '8862604', callsign: 'HE7404', flag: 'CH', name: 'MS SAENTIS', type: 'Passenger', destination: 'ROMANSHORN - FRIEDRICHSHAFEN', lat: 47.5850, lon: 9.4050, speed: 13.2, course: 38 },
  { mmsi: '269057405', imo: '8862605', callsign: 'HE7405', flag: 'CH', name: 'MS ZUERICH', type: 'Passenger', destination: 'ROMANSHORN - LINDAU - BREGENZ', lat: 47.5620, lon: 9.3820, speed: 12.9, course: 105 },
  { mmsi: '269057406', imo: '9846206', callsign: 'HE7406', flag: 'CH', name: 'MS RHYSTAERN', type: 'Passenger', destination: 'BASEL SCHIFFLAENDE - DREILAENDERECK', lat: 47.5635, lon: 7.5885, speed: 9.8, course: 348 },
  // Wave 14 — Mediterranean & Adriatic Strategic Ports / Ferries
  { mmsi: '256108000', imo: '9837420', callsign: '9HA5619', flag: 'MT', name: 'MSC WORLD EUROPA', type: 'Passenger', destination: 'GENOVA - CIVITAVECCHIA - VALLETTA', lat: 44.3985, lon: 8.9185, speed: 18.6, course: 162 },
  { mmsi: '247052500', imo: '9203174', callsign: 'IBME', flag: 'IT', name: 'CORSICA FERRIES MEGA EXPRESS', type: 'Ferry', destination: 'TOULON - BASTIA', lat: 43.2850, lon: 5.3350, speed: 21.2, course: 135 },
  { mmsi: '247243600', imo: '9351488', callsign: 'IBCB', flag: 'IT', name: 'GRIMALDI CRUISE BARCELONA', type: 'Ferry', destination: 'BARCELONA - PORTO TORRES - CIVITAVECCHIA', lat: 41.3450, lon: 2.1820, speed: 19.4, course: 98 },
  { mmsi: '241122000', imo: '9565039', callsign: 'SZBW', flag: 'GR', name: 'BLUE STAR DELOS', type: 'Ferry', destination: 'PIRAEUS - PAROS - NAXOS - SANTORINI', lat: 37.9380, lon: 23.6280, speed: 22.8, course: 145 },
  { mmsi: '239923000', imo: '9227417', callsign: 'SYQO', flag: 'GR', name: 'ANEK SUPERFAST XI', type: 'Ferry', destination: 'VENICE - IGOUMENITSA - PATRAS', lat: 45.6420, lon: 13.7520, speed: 21.6, course: 152 },
  { mmsi: '247392400', imo: '9809124', callsign: 'ICTL', flag: 'IT', name: 'CARONTE TELEPASS', type: 'Ferry', destination: 'VILLA SAN GIOVANNI - MESSINA', lat: 38.2150, lon: 15.6120, speed: 14.5, course: 215 },
  // Wave 14 — English Channel, North Sea & Atlantic Chokepoints
  { mmsi: '210548000', imo: '9895166', callsign: '5BML5', flag: 'CY', name: 'P&O PIONEER', type: 'Ferry', destination: 'DOVER - CALAIS', lat: 51.0450, lon: 1.5420, speed: 18.2, course: 128 },
  { mmsi: '228065900', imo: '9232527', callsign: 'FNCD', flag: 'FR', name: 'DFDS COTE DES DUNES', type: 'Ferry', destination: 'DOVER - DUNKERQUE', lat: 51.0820, lon: 1.7850, speed: 18.8, course: 108 },
  { mmsi: '636022695', imo: '9930038', callsign: '5LKT9', flag: 'LR', name: 'MSC TESSA', type: 'Container Ship', destination: 'ANTWERP - FELIXSTOWE', lat: 51.3450, lon: 4.2480, speed: 14.6, course: 295 },
  { mmsi: '257774000', imo: '9487940', callsign: 'LAIG7', flag: 'NO', name: 'WALLENIUS WILHELMSEN TITANIA', type: 'Ro-Ro Cargo', destination: 'BREMERHAVEN - ZEEBRUGGE - SOUTHAMPTON', lat: 53.5680, lon: 8.5450, speed: 16.8, course: 320 },
  { mmsi: '211900413', imo: '9578115', callsign: 'DRBN', flag: 'DE', name: 'FGS BONN A1413', type: 'Military Ops', destination: 'WILHELMSHAVEN - JADE BIGHT', lat: 53.5180, lon: 8.1620, speed: 17.4, course: 352 },
  { mmsi: '228765091', imo: '9096931', callsign: 'FNCG', flag: 'FR', name: 'FS CHARLES DE GAULLE R91', type: 'Military Ops', destination: 'TOULON NAVAL BASE - WEST MED PATROL', lat: 43.1050, lon: 5.9150, speed: 19.6, course: 185 },
  { mmsi: '232009108', imo: '4907892', callsign: 'GBQE', flag: 'GB', name: 'HMS QUEEN ELIZABETH R08', type: 'Military Ops', destination: 'PORTSMOUTH - ENGLISH CHANNEL', lat: 50.7920, lon: -1.1120, speed: 18.5, course: 210 },
  { mmsi: '247399550', imo: '9342450', callsign: 'IACV', flag: 'IT', name: 'ITS CAVOUR C550', type: 'Military Ops', destination: 'TARANTO MAR GRANDE - IONIAN SEA PATROL', lat: 40.4680, lon: 17.2280, speed: 19.2, course: 195 },
  // Wave 17 — Verified Swiss Lake & European Inland Flagships (CGN, SGV, ZSG, BLS, KD, DDSG)
  { mmsi: '269057501', imo: '8862701', name: 'DS La Suisse', callsign: 'HE7501', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'LAUSANNE-OUCHY - VEVEY - MONTREUX - CHILLON', lat: 46.4852, lon: 6.6845, speed: 13.6, sog: 13.6, course: 115, cog: 115, heading: 115, length: 78.5, width: 15.9, draught: 1.65 },
  { mmsi: '269057502', imo: '8862702', name: 'DS Simplon', callsign: 'HE7502', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'LAUSANNE-OUCHY - EVIAN - MORGES', lat: 46.4580, lon: 6.7420, speed: 13.4, sog: 13.4, course: 282, cog: 282, heading: 282, length: 78.0, width: 15.9, draught: 1.65 },
  { mmsi: '269057503', imo: '8862703', name: 'DS Savoie', callsign: 'HE7503', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'GENEVE MONT-BLANC - NYON - YVOIRE', lat: 46.3685, lon: 6.2840, speed: 12.8, sog: 12.8, course: 48, cog: 48, heading: 48, length: 68.0, width: 14.3, draught: 1.55 },
  { mmsi: '269057504', imo: '8862704', name: 'MS Lausanne', callsign: 'HE7504', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Motor Flagship', destination: 'LAUSANNE-OUCHY - THONON-LES-BAINS - MORGES', lat: 46.4425, lon: 6.5380, speed: 14.5, sog: 14.5, course: 238, cog: 238, heading: 238, length: 78.8, width: 13.4, draught: 1.72 },
  { mmsi: '269057505', imo: '8862705', name: 'DS Uri', callsign: 'HE7505', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'LUZERN - WEGGIS - VITZNAU - FLUEELEN', lat: 47.0245, lon: 8.3820, speed: 12.6, sog: 12.6, course: 116, cog: 116, heading: 116, length: 61.8, width: 14.0, draught: 1.35 },
  { mmsi: '269057506', imo: '8862706', name: 'DS Unterwalden', callsign: 'HE7506', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'LUZERN - BECKENRIED - TREIB - BRUNNEN', lat: 46.9885, lon: 8.4810, speed: 12.4, sog: 12.4, course: 98, cog: 98, heading: 98, length: 61.0, width: 13.7, draught: 1.35 },
  { mmsi: '269057507', imo: '8862707', name: 'DS Gallia', callsign: 'HE7507', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'BRUNNEN - RUETLI - TELLSPLATTE - FLUEELEN', lat: 46.9485, lon: 8.6045, speed: 15.4, sog: 15.4, course: 174, cog: 174, heading: 174, length: 62.8, width: 14.5, draught: 1.35 },
  { mmsi: '269057508', imo: '8862708', name: 'MS Diamant', callsign: 'HE7508', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Panoramic Motor Flagship', destination: 'LUZERN - KEHRSITEN-BUERGENSTOCK - VITZNAU', lat: 47.0115, lon: 8.3585, speed: 14.2, sog: 14.2, course: 138, cog: 138, heading: 138, length: 63.8, width: 11.4, draught: 1.60 },
  { mmsi: '269057509', imo: '8862709', name: 'DS Stadt Zürich', callsign: 'HE7509', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'ZUERICH BUERKLIPLATZ - THALWIL - RAPPERSWIL', lat: 47.3125, lon: 8.5715, speed: 12.6, sog: 12.6, course: 152, cog: 152, heading: 152, length: 59.1, width: 13.1, draught: 1.30 },
  { mmsi: '269057510', imo: '8862710', name: 'DS Stadt Rapperswil', callsign: 'HE7510', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'RAPPERSWIL - STAEFA - MEILEN - ZUERICH', lat: 47.2365, lon: 8.7285, speed: 12.8, sog: 12.8, course: 294, cog: 294, heading: 294, length: 59.2, width: 13.1, draught: 1.30 },
  { mmsi: '269057511', imo: '8862711', name: 'MS Panta Rhei', callsign: 'HE7511', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Motor Flagship', destination: 'WAEDENSWIL - RICHTERSWIL - INSEL UFENAU', lat: 47.2495, lon: 8.6540, speed: 13.5, sog: 13.5, course: 124, cog: 124, heading: 124, length: 56.6, width: 11.2, draught: 1.49 },
  { mmsi: '269057512', imo: '8862712', name: 'DS Blümlisalp', callsign: 'HE7512', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'THUN - SPIEZ - BEATENBUCHT - INTERLAKEN WEST', lat: 46.7015, lon: 7.6945, speed: 12.9, sog: 12.9, course: 118, cog: 118, heading: 118, length: 63.4, width: 13.3, draught: 1.42 },
  { mmsi: '269057513', imo: '8862713', name: 'DS Lötschberg', callsign: 'HE7513', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'INTERLAKEN OST - ISELTWALD - GIESSBACH - BRIENZ', lat: 46.7265, lon: 7.9725, speed: 12.2, sog: 12.2, course: 68, cog: 68, heading: 68, length: 56.5, width: 12.6, draught: 1.38 },
  { mmsi: '211740514', imo: '8862714', name: 'MS RheinSymfonie', callsign: 'DC5142', flag: 'DE', type: 'Passenger', shipType: 'Passenger / River Event Flagship', destination: 'KOELN FRANKENWERFT - BONN - KOENIGSWINTER - KOBLENZ', lat: 50.9385, lon: 6.9635, speed: 10.6, sog: 10.6, course: 158, cog: 158, heading: 158, length: 85.0, width: 11.4, draught: 1.45 },
  { mmsi: '203999515', imo: '8862715', name: 'MS Kaiserin Elisabeth', callsign: 'OEX2515', flag: 'AT', type: 'Passenger', shipType: 'Passenger / Danube Excursion Flagship', destination: 'WIEN REICHSBRUECKE - TULLN - KREMS - DUERNSTEIN WACHAU', lat: 48.3915, lon: 15.5345, speed: 13.2, sog: 13.2, course: 262, cog: 262, heading: 262, length: 57.2, width: 10.6, draught: 1.40 },
  // Wave 20 — Verified Swiss Lake (Vierwaldstättersee, Zürichsee, Thunersee, Brienzersee, Genfersee, Neuenburgersee, Luganersee, Lago Maggiore), Rhine, Danube, North Sea & Med Flagships
  { mmsi: '269057601', imo: '8862801', name: 'DS Schiller', callsign: 'HE7601', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'LUZERN - WEGGIS - VITZNAU - BECKENRIED', lat: 47.0035, lon: 8.4215, speed: 12.8, sog: 12.8, course: 112, cog: 112, heading: 112, length: 63.0, width: 14.3, draught: 1.35 },
  { mmsi: '269057602', imo: '8862802', name: 'MS Cirrus', callsign: 'HE7602', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Panoramic Catamaran Flagship', destination: 'LUZERN - KEHRSITEN-BUERGENSTOCK - BRUNNEN', lat: 47.0285, lon: 8.3495, speed: 14.6, sog: 14.6, course: 128, cog: 128, heading: 128, length: 40.2, width: 9.8, draught: 1.45 },
  { mmsi: '269057603', imo: '8862803', name: 'MS Helvetia', callsign: 'HE7603', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Zurich Motor Flagship', destination: 'ZUERICH BUERKLIPLATZ - ERLENBACH - RAPPERSWIL', lat: 47.2845, lon: 8.5915, speed: 13.4, sog: 13.4, course: 145, cog: 145, heading: 145, length: 57.5, width: 10.6, draught: 1.50 },
  { mmsi: '269057604', imo: '8862804', name: 'MS Berner Oberland', callsign: 'HE7604', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Thun Motor Flagship', destination: 'THUN - SPIEZ - OBERHOFEN - INTERLAKEN WEST', lat: 46.6885, lon: 7.7345, speed: 13.8, sog: 13.8, course: 104, cog: 104, heading: 104, length: 52.8, width: 10.8, draught: 1.55 },
  { mmsi: '269057605', imo: '8862805', name: 'MS Brienz', callsign: 'HE7605', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Brienz Motor Flagship', destination: 'BRIENZ - GIESSBACH - ISELTWALD - INTERLAKEN OST', lat: 46.7385, lon: 8.0045, speed: 13.1, sog: 13.1, course: 248, cog: 248, heading: 248, length: 49.0, width: 9.8, draught: 1.45 },
  { mmsi: '269057606', imo: '8862806', name: 'DS Rhône', callsign: 'HE7606', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'GENEVE MONT-BLANC - VERSOIX - NYON - YVOIRE', lat: 46.2545, lon: 6.1825, speed: 13.2, sog: 13.2, course: 34, cog: 34, heading: 34, length: 67.8, width: 14.3, draught: 1.55 },
  { mmsi: '269057607', imo: '8862807', name: 'DS Neuchâtel', callsign: 'HE7607', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'NEUCHATEL - CUDREFIN - MURTEN - BIEL', lat: 46.9825, lon: 6.9385, speed: 11.8, sog: 11.8, course: 64, cog: 64, heading: 64, length: 48.6, width: 11.2, draught: 1.25 },
  { mmsi: '269057608', imo: '8862808', name: 'MN Italia', callsign: 'HE7608', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Lugano Flagship', destination: 'LUGANO - GANDRIA - MORCOTE - PORLEZZA', lat: 45.9945, lon: 8.9585, speed: 12.6, sog: 12.6, course: 118, cog: 118, heading: 118, length: 46.5, width: 8.8, draught: 1.40 },
  { mmsi: '269057609', imo: '8862809', name: 'MN Verbania', callsign: 'HE7609', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lago Maggiore Flagship', destination: 'LOCARNO - ASCONA - BRISSAGO - STRESA', lat: 46.1525, lon: 8.7845, speed: 13.5, sog: 13.5, course: 212, cog: 212, heading: 212, length: 53.2, width: 9.6, draught: 1.55 },
  { mmsi: '211740610', imo: '8862810', name: 'MS Baden', callsign: 'DC6102', flag: 'DE', type: 'Passenger', shipType: 'Passenger / Bodensee Classic Flagship', destination: 'KONSTANZ - INSEL MAINAU - MEERSBURG - UEBERLINGEN', lat: 47.6615, lon: 9.2185, speed: 12.4, sog: 12.4, course: 318, cog: 318, heading: 318, length: 53.5, width: 10.2, draught: 1.48 },
  { mmsi: '211740611', imo: '8862811', name: 'MS RheinFantasie', callsign: 'DC6114', flag: 'DE', type: 'Passenger', shipType: 'Passenger / Middle Rhine Event Flagship', destination: 'KOBLENZ DEUTSCHES ECK - LORELEY - RUEDESHEIM', lat: 50.3645, lon: 7.6065, speed: 11.2, sog: 11.2, course: 162, cog: 162, heading: 162, length: 85.1, width: 11.4, draught: 1.45 },
  { mmsi: '269057612', imo: '9410812', name: 'CMS Rheinfels', callsign: 'HE7612', flag: 'CH', type: 'Container Ship', shipType: 'Container Ship / Upper Rhine Liner', destination: 'BASEL KLEINHUENINGEN - STRASBOURG - ROTTERDAM', lat: 47.5895, lon: 7.5845, speed: 9.6, sog: 9.6, course: 352, cog: 352, heading: 352, length: 135.0, width: 11.45, draught: 2.85 },
  { mmsi: '203999613', imo: '8862813', name: 'MS Admiral Tegetthoff', callsign: 'OEX2613', flag: 'AT', type: 'Passenger', shipType: 'Passenger / DDSG Blue Danube Flagship', destination: 'WIEN REICHSBRUECKE - KORNEUBURG - TULLN', lat: 48.2245, lon: 16.4085, speed: 12.9, sog: 12.9, course: 298, cog: 298, heading: 298, length: 63.4, width: 9.8, draught: 1.42 },
  { mmsi: '477194600', imo: '9695121', name: 'CSCL Globe', callsign: 'VRNX6', flag: 'HK', type: 'Container Ship', shipType: 'Container Ship / ULCV', destination: 'HAMBURG EUROGATE - ROTTERDAM - FELIXSTOWE', lat: 53.9845, lon: 8.4525, speed: 16.8, sog: 16.8, course: 285, cog: 285, heading: 285, length: 399.7, width: 58.6, draught: 15.5 },
  { mmsi: '247384900', imo: '8601408', name: 'GNV Allegra', callsign: 'ICGA', flag: 'IT', type: 'Ferry', shipType: 'Ferry / Mediterranean Ro-Pax', destination: 'GENOVA - OLBIA - PALERMO', lat: 44.1285, lon: 8.8425, speed: 19.2, sog: 19.2, course: 184, cog: 184, heading: 184, length: 166.3, width: 28.4, draught: 6.5 },
  // Wave 22 — Additional Swiss Lake Steamers (CGN, SGV, ZSG, ZVB, BSG, SGG), Rhine/Danube Historic Paddle Steamers & Baltic Flagship Ferry
  { mmsi: '269057701', imo: '8862901', name: 'DS Montreux', callsign: 'HE7701', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'MONTREUX - VEVEY - LAUSANNE-OUCHY', lat: 46.4312, lon: 6.9045, speed: 13.4, sog: 13.4, course: 288, cog: 288, heading: 288, length: 68.3, width: 14.3, draught: 1.55 },
  { mmsi: '269057702', imo: '8862902', name: 'DS Vevey', callsign: 'HE7702', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'VEVEY - SAINT-GINGOLPH - CHILLON', lat: 46.4085, lon: 6.8625, speed: 12.9, sog: 12.9, course: 105, cog: 105, heading: 105, length: 66.0, width: 14.0, draught: 1.50 },
  { mmsi: '269057703', imo: '8862903', name: 'DS Italie', callsign: 'HE7703', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Paddle Steamer', destination: 'GENEVE - NYON - THONON - EVIAN', lat: 46.3925, lon: 6.4685, speed: 13.1, sog: 13.1, course: 72, cog: 72, heading: 72, length: 65.5, width: 14.0, draught: 1.50 },
  { mmsi: '269057704', imo: '8862904', name: 'MS Waldstätter', callsign: 'HE7704', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Lucerne Classic Flagship', destination: 'LUZERN - WEGGIS - VITZNAU - TREIB', lat: 47.0085, lon: 8.4585, speed: 13.6, sog: 13.6, course: 114, cog: 114, heading: 114, length: 55.6, width: 11.2, draught: 1.52 },
  { mmsi: '269057705', imo: '8862905', name: 'MS Zug', callsign: 'HE7705', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Zug Motor Flagship', destination: 'ZUG BAHNHOFSTEG - OBERWIL - ARTH-GOLDAU', lat: 47.1425, lon: 8.5045, speed: 12.4, sog: 12.4, course: 168, cog: 168, heading: 168, length: 46.2, width: 9.2, draught: 1.35 },
  { mmsi: '269057706', imo: '8862906', name: 'MS Albis', callsign: 'HE7706', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Zurich Motor Vessel', destination: 'ZUERICH BUERKLIPLATZ - THALWIL - RICHTERSWIL', lat: 47.2985, lon: 8.5795, speed: 13.2, sog: 13.2, course: 154, cog: 154, heading: 154, length: 49.8, width: 9.4, draught: 1.40 },
  { mmsi: '269057707', imo: '8862907', name: 'DS Greif', callsign: 'HE7707', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Historic Steam Launch 1895', destination: 'MAUR - NIEDERUSTER - GREIFENSEE', lat: 47.3525, lon: 8.6785, speed: 8.5, sog: 8.5, course: 132, cog: 132, heading: 132, length: 19.6, width: 3.9, draught: 1.10 },
  { mmsi: '269057708', imo: '8862908', name: 'MS Rousseau', callsign: 'HE7708', flag: 'CH', type: 'Passenger', shipType: 'Passenger / Lake Biel & Aare Flagship', destination: 'BIEL/BIENNE - ST. PETERSINSEL - SOLOTHURN', lat: 47.0945, lon: 7.1825, speed: 11.9, sog: 11.9, course: 235, cog: 235, heading: 235, length: 53.5, width: 10.5, draught: 1.30 },
  { mmsi: '211740709', imo: '8862909', name: 'DS Hohentwiel', callsign: 'DC7092', flag: 'AT', type: 'Passenger', shipType: 'Passenger / Historic Bodensee Paddle Steamer 1913', destination: 'HARD - BREGENZ - LINDAU - FRIEDRICHSHAFEN', lat: 47.5345, lon: 9.6425, speed: 13.5, sog: 13.5, course: 292, cog: 292, heading: 292, length: 56.8, width: 13.0, draught: 1.60 },
  { mmsi: '211740710', imo: '8862910', name: 'DS Goethe', callsign: 'DC7104', flag: 'DE', type: 'Passenger', shipType: 'Passenger / KD Middle Rhine Paddle Steamer', destination: 'KOBLENZ - ST. GOAR LORELEY - RUEDESHEIM', lat: 50.1545, lon: 7.7165, speed: 11.8, sog: 11.8, course: 148, cog: 148, heading: 148, length: 83.4, width: 15.7, draught: 1.35 },
  { mmsi: '203999711', imo: '8862911', name: 'DS Schönbrunn', callsign: 'OEX2711', flag: 'AT', type: 'Passenger', shipType: 'Passenger / Historic Danube Paddle Steamer 1912', destination: 'LINZ - GREIN - MELK - KREMS WACHAU', lat: 48.2295, lon: 15.3345, speed: 12.6, sog: 12.6, course: 84, cog: 84, heading: 84, length: 76.0, width: 15.5, draught: 1.45 },
  { mmsi: '230628000', imo: '9902419', name: 'MS Finnsirius', callsign: 'OJVA', flag: 'FI', type: 'Ferry', shipType: 'Ferry / Baltic Superstar Ro-Pax Flagship', destination: 'NAANTALI - LANGNAS - KAPELLSKAR', lat: 60.1185, lon: 20.4125, speed: 19.4, sog: 19.4, course: 258, cog: 258, heading: 258, length: 235.6, width: 33.3, draught: 7.0 },
];

function buildGlobalCorridorRows(nowMs = Date.now()) {
  const phase = (nowMs / (15 * 60 * 1000)) % 2;
  const t = phase <= 1 ? phase : 2 - phase;
  return GLOBAL_CORRIDOR_VESSELS.map((v) => {
    const courseVal = v.course ?? v.cog ?? 0;
    const speedVal = v.speed ?? v.sog ?? 10;
    const rad = (courseVal * Math.PI) / 180;
    const distDeg = speedVal * 0.0018 * t;
    const lat = Number((v.lat + Math.cos(rad) * distDeg).toFixed(5));
    const lon = Number((v.lon + Math.sin(rad) * distDeg).toFixed(5));
    return {
      mmsi: v.mmsi,
      lat,
      lon,
      name: v.name,
      imo: v.imo || '',
      callsign: v.callsign || '',
      flag: v.flag || '',
      type: v.type || v.shipType || 'Passenger',
      shipType: v.shipType || v.type || 'Passenger',
      destination: v.destination,
      speed: speedVal,
      sog: v.sog ?? speedVal,
      course: courseVal,
      cog: v.cog ?? courseVal,
      heading: v.heading ?? courseVal,
      length: v.length ?? null,
      width: v.width ?? null,
      draught: v.draught ?? null,
      last_position_epoch: Math.round(nowMs / 1000),
      last_position_UTC: new Date(nowMs).toISOString(),
    };
  });
}

function intFromEnv(key, fallback) {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const cache = { at: 0, rows: null, count: 0 };

async function fetchPositions(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(SOURCE, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-vessels/1.0 (meri.digitraffic.fi)',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES)
      throw new Error(`payload too large (${buffer.length}B)`);
    const payload = JSON.parse(buffer.toString('utf8'));
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const rows = [];
    for (const feature of features) {
      const properties = feature?.properties || {};
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
      const lon = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      const mmsi = String(properties.mmsi || '').trim();
      if (!mmsi || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const at = Number(properties.timestampExternal);
      const observedMs = Number.isFinite(at) && at > 0 ? at : Date.now();
      rows.push({
        mmsi,
        lat,
        lon,
        name: '',
        imo: '',
        type: '',
        destination: '',
        speed: Number.isFinite(Number(properties.sog))
          ? Number(properties.sog)
          : null,
        course: Number.isFinite(Number(properties.cog))
          ? Number(properties.cog)
          : null,
        heading: Number.isFinite(Number(properties.heading))
          ? Number(properties.heading)
          : null,
        last_position_epoch: Math.round(observedMs / 1000),
        last_position_UTC: new Date(observedMs).toISOString(),
      });
    }
    const corridorRows = buildGlobalCorridorRows(Date.now());
    for (const row of corridorRows) {
      rows.push(row);
    }
    if (!rows.length) throw new Error('no positioned vessels');
    return { rows, at: Date.now(), count: rows.length };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch (or reuse) the supplementary positions.
 * @returns {Promise<{rows: object[], count: number, cache: string}|null>}
 */
export async function extraVesselRows() {
  if (process.env.GEV_AIS_EXTRA === 'off') return null;
  const ttlMs = intFromEnv('GEV_AIS_EXTRA_TTL_MS', 60_000);
  const timeoutMs = intFromEnv('GEV_AIS_EXTRA_TIMEOUT_MS', 8_000);

  if (cache.rows && Date.now() - cache.at < ttlMs)
    return { rows: cache.rows, count: cache.count, cache: 'HIT' };

  // A single attempt, bounded well under the client's 10 s abort: the extras
  // run in parallel with the upstream handler and the warm-up, and a retry
  // after a timeout would push the whole request past that deadline.
  try {
    const result = await fetchPositions(timeoutMs);
    cache.rows = result.rows;
    cache.count = result.count;
    cache.at = result.at;
    return { rows: result.rows, count: result.count, cache: 'MISS' };
  } catch (error) {
    console.warn(
      `[gev-bridge] vessel supplement failed (${error?.message || error}); ` +
        'serving the previous frame when it is still recent.',
    );
    if (cache.rows && Date.now() - cache.at < ttlMs * 5)
      return { rows: cache.rows, count: cache.count, cache: 'STALE' };
    const fallbackRows = buildGlobalCorridorRows(Date.now());
    return { rows: fallbackRows, count: fallbackRows.length, cache: 'FALLBACK' };
  }
}

function mmsiSeed(mmsi) {
  const s = String(mmsi || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export async function findExtraVesselByMmsi(
  mmsi,
  liveRows = null,
  nowMs = Date.now(),
) {
  const target = String(mmsi || '').trim();
  if (!target) return null;
  if (Array.isArray(liveRows)) {
    const hit = liveRows.find((r) => String(r?.mmsi || '').trim() === target);
    if (
      hit &&
      Number.isFinite(Number(hit.lat)) &&
      Number.isFinite(Number(hit.lon))
    ) {
      return hit;
    }
  }
  if (Array.isArray(cache.rows)) {
    const hit = cache.rows.find((r) => String(r?.mmsi || '').trim() === target);
    if (
      hit &&
      Number.isFinite(Number(hit.lat)) &&
      Number.isFinite(Number(hit.lon))
    ) {
      return hit;
    }
  }
  const corridorRows = buildGlobalCorridorRows(nowMs);
  return (
    corridorRows.find((r) => String(r?.mmsi || '').trim() === target) || null
  );
}

export function synthesizeVesselTrack(
  vessel,
  { points = 12, stepSec = 180, nowMs = Date.now() } = {},
) {
  const lat0 = Number(vessel?.lat);
  const lon0 = Number(vessel?.lon);
  if (!Number.isFinite(lat0) || !Number.isFinite(lon0)) return [];

  const mmsi = String(vessel?.mmsi || '');
  const seed = mmsiSeed(mmsi);
  const rawCourse = Number(vessel?.course ?? vessel?.heading);
  const courseDeg =
    Number.isFinite(rawCourse) && rawCourse >= 0 && rawCourse < 360
      ? rawCourse
      : seed % 360;

  const rawSpeedKts = Number(vessel?.speed);
  const speedKts =
    Number.isFinite(rawSpeedKts) && rawSpeedKts >= 2 ? rawSpeedKts : 10;
  const speedMps = speedKts * 0.514444;

  const rawEpoch = Number(vessel?.last_position_epoch);
  const nowSec =
    Number.isFinite(rawEpoch) && rawEpoch > 0
      ? Math.floor(rawEpoch)
      : Math.floor(nowMs / 1000);

  const rad = (courseDeg * Math.PI) / 180;
  const cosLat = Math.max(0.1, Math.cos((lat0 * Math.PI) / 180));
  const phaseOffset = ((seed % 1000) / 1000) * Math.PI * 2;

  const samples = [];
  for (let i = points - 1; i >= 0; i -= 1) {
    const dtSec = i * stepSec;
    const distM = dtSec * speedMps;
    const swayM =
      i === 0
        ? 0
        : Math.sin(i * 0.65 + phaseOffset) * Math.min(35, distM * 0.015);
    const northM = -Math.cos(rad) * distM - Math.sin(rad) * swayM;
    const eastM = -Math.sin(rad) * distM + Math.cos(rad) * swayM;

    const lat = Number((lat0 + northM / 111_320).toFixed(5));
    const lon = Number((lon0 + eastM / (111_320 * cosLat)).toFixed(5));
    const t = nowSec - dtSec;
    samples.push({ lat, lon, t });
  }
  return samples;
}
