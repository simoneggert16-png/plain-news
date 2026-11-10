/** Half-width of the box a bundled landmark is framed with, in degrees. */
const LANDMARK_HALF_SPAN_DEG = 0.005;

const DACH_CURATED_LANDMARKS = Object.freeze([
  {
    names: ['Hoher Kasten', 'Hohen Kasten', 'Drehrestaurant Hoher Kasten', 'Kamor'],
    display: 'Hoher Kasten (1794m, St. Galler Rheintal / Alpstein)',
    lat: 47.2839,
    lon: 9.4847,
  },
  {
    names: ['Ebenalp', 'Äscher', 'Aescher', 'Wildkirchli', 'Ebenalp Äscher'],
    display: 'Ebenalp & Berggasthaus Äscher (Alpstein)',
    lat: 47.2838,
    lon: 9.4111,
  },
  {
    names: ['Säntis', 'Saentis', 'Säntis Gipfel', 'Säntis Sendeturm'],
    display: 'Säntis Gipfel (2502m, Alpstein)',
    lat: 47.2494,
    lon: 9.3433,
  },
  {
    names: ['Pfänder', 'Pfaender', 'Pfänder Bregenz', 'Pfänderbahn'],
    display: 'Pfänder (1064m, Bregenz / Bodensee)',
    lat: 47.5072,
    lon: 9.7803,
  },
  {
    names: [
      'Grenzübergang Au-Lustenau',
      'Grenzübergang Au',
      'Zollamt Au',
      'Rheinbrücke Au-Lustenau',
    ],
    display: 'Grenzübergang Au SG – Lustenau (Rheinbrücke)',
    lat: 47.4342,
    lon: 9.6458,
  },
  {
    names: [
      'Grenzübergang St. Margrethen',
      'Grenzübergang Sankt Margrethen',
      'Zollamt St. Margrethen',
      'Grenzübergang St. Margrethen-Höchst',
    ],
    display: 'Grenzübergang St. Margrethen – Höchst',
    lat: 47.4547,
    lon: 9.6389,
  },
  {
    names: [
      'Grenzübergang Widnau',
      'Grenzübergang Wiesenrain',
      'Zollamt Wiesenrain',
    ],
    display: 'Grenzübergang Widnau – Lustenau Wiesenrain',
    lat: 47.4058,
    lon: 9.6503,
  },
  {
    names: [
      'Grenzübergang Diepoldsau',
      'Grenzübergang Schmitter',
      'Zollamt Schmitter',
    ],
    display: 'Grenzübergang Diepoldsau – Hohenems Schmitter',
    lat: 47.3792,
    lon: 9.6694,
  },
  {
    names: [
      'Grenzübergang Schaanwald',
      'Grenzübergang Tisis',
      'Zollamt Schaanwald',
    ],
    display: 'Grenzübergang Schaanwald (LI) – Feldkirch Tisis (AT)',
    lat: 47.2144,
    lon: 9.5664,
  },
  {
    names: ['Kernkraftwerk Gösgen', 'KKW Gösgen', 'Atomkraftwerk Gösgen', 'Gösgen Nuclear Power Plant'],
    display: 'Kernkraftwerk Gösgen (KKG, Däniken SO)',
    lat: 47.3661,
    lon: 7.9667,
  },
  {
    names: ['Kernkraftwerk Beznau', 'KKW Beznau', 'Atomkraftwerk Beznau'],
    display: 'Kernkraftwerk Beznau (KKB 1 & 2, Döttingen AG)',
    lat: 47.5522,
    lon: 8.2286,
  },
  {
    names: ['Kernkraftwerk Leibstadt', 'KKW Leibstadt', 'Atomkraftwerk Leibstadt'],
    display: 'Kernkraftwerk Leibstadt (KKL, Aargau)',
    lat: 47.6019,
    lon: 8.1836,
  },
  {
    names: ['Kernkraftwerk Mühleberg', 'KKW Mühleberg', 'Atomkraftwerk Mühleberg'],
    display: 'Kernkraftwerk Mühleberg (KKM, Bern)',
    lat: 46.9689,
    lon: 7.2681,
  },
  {
    names: ['Fliegerhorst Emmen', 'Militärflugplatz Emmen', 'RUAG Emmen', 'Air Base Emmen'],
    display: 'Militärflugplatz Emmen (Schweizer Luftwaffe)',
    lat: 47.0922,
    lon: 8.305,
  },
  {
    names: ['Fliegerhorst Payerne', 'Militärflugplatz Payerne', 'Air Base Payerne'],
    display: 'Militärflugplatz Payerne (F/A-18 & F-35A Hauptbasis)',
    lat: 46.8433,
    lon: 6.915,
  },
  {
    names: ['Fliegerhorst Meiringen', 'Militärflugplatz Meiringen', 'Kavernenflugplatz Meiringen', 'Axalp'],
    display: 'Militärflugplatz Meiringen / Unterbach (Felsenkaverne)',
    lat: 46.7433,
    lon: 8.1097,
  },
  {
    names: ['Festung Furggels', 'Artilleriewerk Furggels', 'Bunker Furggels'],
    display: 'Artilleriewerk & Führungsbunker Furggels (St. Margrethenberg)',
    lat: 46.9708,
    lon: 9.4889,
  },
  {
    names: ['Festung Magletsch', 'Artilleriewerk Magletsch', 'AFOM Magletsch'],
    display: 'Artilleriewerk Magletsch (Wartau / Sarganserland)',
    lat: 47.0956,
    lon: 9.4556,
  },
  {
    names: ['Festung Heldsberg', 'Artilleriewerk Heldsberg', 'Festungsmuseum Heldsberg'],
    display: 'Artilleriewerk Heldsberg (St. Margrethen SG)',
    lat: 47.445,
    lon: 9.6194,
  },
  // Alpine Passes & Tunnels
  {
    names: ['Gotthardpass', 'St Gotthard Pass', 'Passo del San Gottardo', 'Gotthard Tunnel', 'Gotthard Strassentunnel'],
    display: 'Gotthardpass & Gotthard-Strassentunnel (Uri / Tessin, 2106 m)',
    lat: 46.5594,
    lon: 8.5614,
  },
  {
    names: ['San Bernardino Pass', 'San Bernardino Tunnel', 'Passo del San Bernardino'],
    display: 'San-Bernardino-Pass & A13-Alpentunnel (Graubünden, 2067 m)',
    lat: 46.4967,
    lon: 9.1708,
  },
  {
    names: ['Julierpass', 'Pass dal Güglia', 'Julier Pass'],
    display: 'Julierpass (Oberhalbstein / Engadin, Graubünden, 2284 m)',
    lat: 46.4722,
    lon: 9.7278,
  },
  {
    names: ['Flüelapass', 'Fluela Pass', 'Pass dal Flüela'],
    display: 'Flüelapass (Davos / Susch, Graubünden, 2383 m)',
    lat: 46.7503,
    lon: 9.9472,
  },
  {
    names: ['Furkapass', 'Furka Pass'],
    display: 'Furkapass (Uri / Wallis, 2429 m)',
    lat: 46.5725,
    lon: 8.415,
  },
  {
    names: ['Grimselpass', 'Grimsel Pass'],
    display: 'Grimselpass & Grimselstausee (Bern / Wallis, 2164 m)',
    lat: 46.5614,
    lon: 8.3375,
  },
  {
    names: ['Sustenpass', 'Susten Pass'],
    display: 'Sustenpass (Uri / Bern, 2224 m)',
    lat: 46.7294,
    lon: 8.4486,
  },
  {
    names: ['Simplonpass', 'Simplon Pass', 'Passo del Sempione'],
    display: 'Simplonpass (Wallis / Piemont, 2005 m)',
    lat: 46.2508,
    lon: 8.0333,
  },
  {
    names: ['Oberalppass', 'Oberalp Pass'],
    display: 'Oberalppass (Andermatt / Sedrun, 2044 m)',
    lat: 46.6586,
    lon: 8.6714,
  },
  {
    names: ['Klausenpass', 'Klausen Pass'],
    display: 'Klausenpass (Uri / Glarus, 1948 m)',
    lat: 46.8681,
    lon: 8.8556,
  },
  {
    names: ['Berninapass', 'Passo del Bernina', 'Bernina Pass'],
    display: 'Berninapass & Lago Bianco (Engadin / Puschlav, 2328 m)',
    lat: 46.4108,
    lon: 10.0278,
  },
  {
    names: ['Stilfserjoch', 'Passo dello Stelvio', 'Stelvio Pass'],
    display: 'Stilfser Joch / Passo dello Stelvio (Südtirol / Lombardei, 2757 m)',
    lat: 46.5286,
    lon: 10.4531,
  },
  {
    names: ['Brennerpass', 'Brenner Pass', 'Passo del Brennero'],
    display: 'Brennerpass (A13/A22 Tirol / Südtirol, 1370 m)',
    lat: 47.0028,
    lon: 11.5069,
  },
  {
    names: ['Arlbergpass', 'Arlberg Straßentunnel', 'Arlberg Tunnel'],
    display: 'Arlbergpass & S16 Arlberg-Straßentunnel (Vorarlberg / Tirol, 1793 m)',
    lat: 47.1297,
    lon: 10.2111,
  },
  {
    names: ['Grossglockner Hochalpenstrasse'],
    display: 'Großglockner & Kaiser-Franz-Josefs-Höhe (Kärnten / Salzburg, 3798 m)',
    lat: 47.0742,
    lon: 12.6939,
  },
  // DACH & European Airports & Airbases (ICAO / IATA / Names)
  {
    names: ['LSZR', 'ACH', 'Flugplatz St Gallen Altenrhein', 'Airport Altenrhein', 'People s Airport Altenrhein'],
    display: 'People’s Airport St. Gallen-Altenrhein (LSZR / ACH)',
    lat: 47.485,
    lon: 9.5608,
  },
  {
    names: ['LSZH', 'ZRH', 'Flughafen Zürich', 'Zurich Airport', 'Flughafen Kloten'],
    display: 'Flughafen Zürich-Kloten (LSZH / ZRH)',
    lat: 47.4582,
    lon: 8.5555,
  },
  {
    names: ['LSGG', 'GVA', 'Flughafen Genf', 'Geneva Airport', 'Genève Aéroport'],
    display: 'Genève Aéroport (LSGG / GVA)',
    lat: 46.2381,
    lon: 6.1089,
  },
  {
    names: ['LFSB', 'BSL', 'EuroAirport Basel', 'Flughafen Basel Mulhouse'],
    display: 'EuroAirport Basel-Mulhouse-Freiburg (LFSB / BSL)',
    lat: 47.59,
    lon: 7.5292,
  },
  {
    names: ['LSZB', 'BRN', 'Flughafen Bern', 'Bern Belp Airport'],
    display: 'Flughafen Bern-Belp (LSZB / BRN)',
    lat: 46.9141,
    lon: 7.4972,
  },
  {
    names: ['LSZS', 'SMV', 'Engadin Airport', 'Flugplatz Samedan'],
    display: 'Engadin Airport Samedan / St. Moritz (LSZS / SMV)',
    lat: 46.5342,
    lon: 9.8842,
  },
  {
    names: ['LSMD', 'Militärflugplatz Dübendorf', 'Flugplatz Dübendorf'],
    display: 'Militärflugplatz Dübendorf & Skyguide (LSMD)',
    lat: 47.3986,
    lon: 8.6478,
  },
  {
    names: ['LSMA', 'Militärflugplatz Alpnach', 'Fliegerhorst Alpnach'],
    display: 'Militärflugplatz Alpnach (LSMA · Schweizer Luftwaffe)',
    lat: 46.9439,
    lon: 8.2842,
  },
  {
    names: ['EDNY', 'FDH', 'Bodensee Airport Friedrichshafen', 'Flughafen Friedrichshafen'],
    display: 'Bodensee-Airport Friedrichshafen (EDNY / FDH)',
    lat: 47.6713,
    lon: 9.5115,
  },
  {
    names: ['LOWI', 'INN', 'Flughafen Innsbruck', 'Innsbruck Airport'],
    display: 'Flughafen Innsbruck-Kranebitten (LOWI / INN)',
    lat: 47.2603,
    lon: 11.3439,
  },
  {
    names: ['LOWW', 'VIE', 'Flughafen Wien Schwechat', 'Vienna Airport'],
    display: 'Flughafen Wien-Schwechat (LOWW / VIE)',
    lat: 48.1103,
    lon: 16.5697,
  },
  {
    names: ['LOXZ', 'Fliegerhorst Hinterstoisser Zeltweg', 'Fliegerhorst Zeltweg', 'AirPower Zeltweg'],
    display: 'Fliegerhorst Hinterstoisser Zeltweg (LOXZ · Österreichische Luftstreitkräfte)',
    lat: 47.2028,
    lon: 14.7442,
  },
  {
    names: ['EDDM', 'MUC', 'Flughafen München', 'Munich Airport'],
    display: 'Flughafen München Franz Josef Strauß (EDDM / MUC)',
    lat: 48.3538,
    lon: 11.7861,
  },
  {
    names: ['EDDF', 'FRA', 'Flughafen Frankfurt', 'Frankfurt Airport'],
    display: 'Flughafen Frankfurt am Main (EDDF / FRA)',
    lat: 50.0379,
    lon: 8.5622,
  },
  {
    names: ['EDDB', 'BER', 'Flughafen Berlin Brandenburg', 'BER Airport'],
    display: 'Flughafen Berlin Brandenburg Willy Brandt (EDDB / BER)',
    lat: 52.3667,
    lon: 13.5033,
  },
  {
    names: ['ETAR', 'RMS', 'Ramstein Air Base', 'Fliegerhorst Ramstein'],
    display: 'Ramstein Air Base (ETAR · USAFE / NATO HQ)',
    lat: 49.4369,
    lon: 7.6003,
  },
  {
    names: ['ETSB', 'Fliegerhorst Büchel', 'Büchel Air Base'],
    display: 'Fliegerhorst Büchel (ETSB · TaktLwG 33)',
    lat: 50.1739,
    lon: 7.0633,
  },
  {
    names: ['ETNG', 'NATO Air Base Geilenkirchen', 'Fliegerhorst Geilenkirchen'],
    display: 'NATO Air Base Geilenkirchen (ETNG · E-3A AWACS)',
    lat: 50.9608,
    lon: 6.0425,
  },
  {
    names: ['LIPA', 'Aviano Air Base'],
    display: 'Aviano Air Base (LIPA · USAF 31st Fighter Wing)',
    lat: 46.0319,
    lon: 12.5964,
  },
  {
    names: ['LICZ', 'NAS Sigonella', 'Naval Air Station Sigonella', 'Sigonella Air Base'],
    display: 'Naval Air Station Sigonella (LICZ · USN / NATO AGS)',
    lat: 37.4017,
    lon: 14.9222,
  },
  {
    names: ['LCRA', 'RAF Akrotiri', 'Akrotiri Air Base'],
    display: 'RAF Akrotiri (LCRA · Sovereign Base Area Cyprus)',
    lat: 34.5906,
    lon: 32.9878,
  },
  {
    names: ['OTBH', 'Al Udeid Air Base'],
    display: 'Al Udeid Air Base (OTBH · US CENTCOM Forward HQ, Qatar)',
    lat: 25.1172,
    lon: 51.315,
  },
  {
    names: ['FJDG', 'Diego Garcia', 'NSF Diego Garcia'],
    display: 'Naval Support Facility Diego Garcia (FJDG · Indian Ocean)',
    lat: -7.3133,
    lon: 72.4111,
  },
  // Major Swiss & DACH Cities
  {
    names: ['Basel', 'Basel Stadt'],
    display: 'Basel (Basel-Stadt, Schweiz)',
    lat: 47.5596,
    lon: 7.5886,
  },
  {
    names: ['Bern', 'Bundesstadt Bern'],
    display: 'Bern & Bundeshaus (Kanton Bern, Schweiz)',
    lat: 46.948,
    lon: 7.4474,
  },
  {
    names: ['Luzern', 'Lucerne'],
    display: 'Luzern & Vierwaldstättersee (Schweiz)',
    lat: 47.0502,
    lon: 8.3093,
  },
  {
    names: ['Genf', 'Geneva', 'Genève'],
    display: 'Genf / Genève (Kanton Genf, Schweiz)',
    lat: 46.2044,
    lon: 6.1432,
  },
  {
    names: ['Lausanne'],
    display: 'Lausanne & Genfersee (Waadt, Schweiz)',
    lat: 46.5197,
    lon: 6.6323,
  },
  {
    names: ['Lugano', 'Lago di Lugano'],
    display: 'Lugano (Tessin, Schweiz)',
    lat: 46.0037,
    lon: 8.9511,
  },
  {
    names: ['Winterthur'],
    display: 'Winterthur (Kanton Zürich, Schweiz)',
    lat: 47.4988,
    lon: 8.7237,
  },
  {
    names: ['Zug', 'Zugersee'],
    display: 'Zug (Kanton Zug, Schweiz)',
    lat: 47.1662,
    lon: 8.5155,
  },
  {
    names: ['Schaffhausen'],
    display: 'Schaffhausen & Rheinfall (Schweiz)',
    lat: 47.6779,
    lon: 8.615,
  },
  {
    names: ['Innsbruck'],
    display: 'Innsbruck (Tirol, Österreich)',
    lat: 47.2692,
    lon: 11.4041,
  },
  {
    names: ['Salzburg'],
    display: 'Salzburg (Österreich)',
    lat: 47.8095,
    lon: 13.055,
  },
  {
    names: ['München', 'Munich', 'Marienplatz München'],
    display: 'München (Bayern, Deutschland)',
    lat: 48.1351,
    lon: 11.582,
  },
  {
    names: ['Stuttgart'],
    display: 'Stuttgart (Baden-Württemberg, Deutschland)',
    lat: 48.7758,
    lon: 9.1829,
  },
  {
    names: ['Frankfurt', 'Frankfurt am Main'],
    display: 'Frankfurt am Main (Hessen, Deutschland)',
    lat: 50.1109,
    lon: 8.6821,
  },
  {
    names: ['Hamburg', 'Hafen Hamburg'],
    display: 'Hamburg (Deutschland)',
    lat: 53.5511,
    lon: 9.9937,
  },
  // Wave 12 — European & DACH Iconic Peaks, Landmarks, Research Centers & Cultural Hubs
  {
    names: [
      'Matterhorn',
      'Monte Cervino',
      'Mont Cervin',
      'Matterhorn Zermatt',
      'Matterhorn / Monte Cervino (Zermatt 4478m)',
    ],
    display: 'Matterhorn / Monte Cervino (Zermatt 4478m)',
    lat: 45.9766,
    lon: 7.6585,
  },
  {
    names: [
      'Jungfraujoch',
      'Top of Europe',
      'Sphinx Observatorium',
      'Jungfraujoch Top of Europe',
      'Jungfraujoch — Top of Europe (3454m)',
    ],
    display: 'Jungfraujoch — Top of Europe (3454m)',
    lat: 46.5475,
    lon: 7.9851,
  },
  {
    names: [
      'Eiger',
      'Mönch',
      'Moench',
      'Jungfrau',
      'Eiger Mönch Jungfrau',
      'Eigernordwand',
      'Eiger, Mönch & Jungfrau (Berner Oberland)',
    ],
    display: 'Eiger, Mönch & Jungfrau (Berner Oberland)',
    lat: 46.5775,
    lon: 8.0053,
  },
  {
    names: [
      'Titlis',
      'Klein Titlis',
      'Titlis Gipfel',
      'Titlis Rotair',
      'Titlis Engelberg',
      'Titlis Gipfel & Rotair (Engelberg 3238m)',
    ],
    display: 'Titlis Gipfel & Rotair (Engelberg 3238m)',
    lat: 46.772,
    lon: 8.4378,
  },
  {
    names: [
      'Pilatus',
      'Pilatus Kulm',
      'Pilatus Luzern',
      'Pilatusbahn',
      'Pilatus Kulm (Luzern 2128m)',
    ],
    display: 'Pilatus Kulm (Luzern 2128m)',
    lat: 46.9793,
    lon: 8.2533,
  },
  {
    names: [
      'Rigi',
      'Rigi Kulm',
      'Königin der Berge',
      'Koenigin der Berge',
      'Rigi Kulm (Königin der Berge 1797m)',
    ],
    display: 'Rigi Kulm (Königin der Berge 1797m)',
    lat: 47.0567,
    lon: 8.4851,
  },
  {
    names: [
      'Piz Bernina',
      'Bernina Gipfel',
      'Biancograt',
      'Piz Bernina (Engadin 4049m)',
    ],
    display: 'Piz Bernina (Engadin 4049m)',
    lat: 46.3823,
    lon: 9.9081,
  },
  {
    names: [
      'Zugspitze',
      'Zugspitze Gipfel',
      'Zugspitzplatt',
      'Zugspitze Garmisch',
      'Zugspitze Gipfel (Garmisch / Tirol 2962m)',
    ],
    display: 'Zugspitze Gipfel (Garmisch / Tirol 2962m)',
    lat: 47.421,
    lon: 10.9854,
  },
  {
    names: [
      'Großglockner',
      'Grossglockner',
      'Großglockner Gipfel',
      'Grossglockner Gipfel',
      'Kaiser Franz Josefs Höhe',
      'Großglockner (Hohe Tauern 3798m)',
    ],
    display: 'Großglockner (Hohe Tauern 3798m)',
    lat: 47.0745,
    lon: 12.6939,
  },
  {
    names: [
      'Mont Blanc',
      'Monte Bianco',
      'Mont Blanc Chamonix',
      'Aiguille du Midi',
      'Mont Blanc / Monte Bianco (Chamonix / Courmayeur 4808m)',
    ],
    display: 'Mont Blanc / Monte Bianco (Chamonix / Courmayeur 4808m)',
    lat: 45.8326,
    lon: 6.8652,
  },
  {
    names: [
      'Rheinfall',
      'Rheinfall Schaffhausen',
      'Rheinfall Neuhausen',
      'Schloss Laufen am Rheinfall',
      'Rheinfall Schaffhausen / Neuhausen',
    ],
    display: 'Rheinfall Schaffhausen / Neuhausen',
    lat: 47.6779,
    lon: 8.6156,
  },
  {
    names: [
      'Kapellbrücke',
      'Kapellbruecke',
      'Kapellbrücke Luzern',
      'Wasserturm Luzern',
      'Kapellbrücke & Wasserturm Luzern',
    ],
    display: 'Kapellbrücke & Wasserturm Luzern',
    lat: 47.0516,
    lon: 8.3075,
  },
  {
    names: [
      'Jet d Eau',
      "Jet d'Eau",
      'Jet d Eau Genf',
      'Jet d Eau Genève',
      'Rade de Genève',
      "Jet d'Eau & Rade de Genève",
    ],
    display: "Jet d'Eau & Rade de Genève",
    lat: 46.2074,
    lon: 6.1559,
  },
  {
    names: [
      'Château de Chillon',
      'Chateau de Chillon',
      'Schloss Chillon',
      'Chillon Castle',
      'Château de Chillon (Montreux / Veytaux)',
    ],
    display: 'Château de Chillon (Montreux / Veytaux)',
    lat: 46.4142,
    lon: 6.9275,
  },
  {
    names: [
      'Bundeshaus',
      'Bundeshaus Bern',
      'Palais fédéral',
      'Palais federal',
      'Parlamentsgebäude Bern',
      'Bundeshaus / Palais fédéral Bern',
    ],
    display: 'Bundeshaus / Palais fédéral Bern',
    lat: 46.9466,
    lon: 7.4443,
  },
  {
    names: [
      'CERN',
      'CERN Meyrin',
      'CERN Genf',
      'CERN Geneva',
      'Large Hadron Collider',
      'LHC CERN',
      'Science Gateway CERN',
      'CERN — European Organization for Nuclear Research (Meyrin / Genève)',
    ],
    display: 'CERN — European Organization for Nuclear Research (Meyrin / Genève)',
    lat: 46.233,
    lon: 6.0557,
  },
  {
    names: [
      'PSI',
      'PSI Villigen',
      'Paul Scherrer Institut',
      'Paul Scherrer Institute',
      'Swiss Light Source SLS',
      'Paul Scherrer Institut PSI (Villigen)',
    ],
    display: 'Paul Scherrer Institut PSI (Villigen)',
    lat: 47.5381,
    lon: 8.2228,
  },
  {
    names: [
      'ETH Zürich',
      'ETH Zuerich',
      'ETH Zurich',
      'ETH Hönggerberg',
      'ETH Zentrum',
      'Eidgenössische Technische Hochschule Zürich',
      'ETH Zürich Hönggerberg & Zentrum',
    ],
    display: 'ETH Zürich Hönggerberg & Zentrum',
    lat: 47.3763,
    lon: 8.5477,
  },
  {
    names: [
      'EPFL',
      'EPFL Lausanne',
      'École Polytechnique Fédérale de Lausanne',
      'Ecole Polytechnique Federale de Lausanne',
      'Rolex Learning Center',
      'EPFL — École Polytechnique Fédérale de Lausanne',
    ],
    display: 'EPFL — École Polytechnique Fédérale de Lausanne',
    lat: 46.5191,
    lon: 6.5668,
  },
  {
    names: [
      'HSG',
      'Uni St. Gallen',
      'Universität St. Gallen',
      'Universitaet St. Gallen',
      'University of St. Gallen',
      'HSG Rosenberg',
      'SQUARE HSG',
      'Universität St. Gallen (HSG)',
    ],
    display: 'Universität St. Gallen (HSG)',
    lat: 47.4317,
    lon: 9.3748,
  },
  {
    names: [
      'Schloss Neuschwanstein',
      'Neuschwanstein',
      'Neuschwanstein Castle',
      'Schloss Hohenschwangau',
      'Schloss Neuschwanstein (Schwangau / Füssen)',
    ],
    display: 'Schloss Neuschwanstein (Schwangau / Füssen)',
    lat: 47.5576,
    lon: 10.7498,
  },
  {
    names: [
      'Kölner Dom',
      'Koelner Dom',
      'Cologne Cathedral',
      'Dom zu Köln',
      'Hohe Domkirche Sankt Petrus',
      'Kölner Dom (Hohe Domkirche Sankt Petrus)',
    ],
    display: 'Kölner Dom (Hohe Domkirche Sankt Petrus)',
    lat: 50.9413,
    lon: 6.9583,
  },
  {
    names: [
      'Elbphilharmonie',
      'Elphi',
      'Elbphilharmonie Hamburg',
      'Speicherstadt Hamburg',
      'Elbphilharmonie & Speicherstadt Hamburg',
    ],
    display: 'Elbphilharmonie & Speicherstadt Hamburg',
    lat: 53.5413,
    lon: 9.9841,
  },
  {
    names: [
      'Frauenkirche Dresden',
      'Semperoper Dresden',
      'Semperoper',
      'Zwinger Dresden',
      'Frauenkirche & Semperoper Dresden',
    ],
    display: 'Frauenkirche & Semperoper Dresden',
    lat: 51.0519,
    lon: 13.7416,
  },
  {
    names: [
      'Heidelberger Schloss',
      'Schloss Heidelberg',
      'Heidelberg Castle',
      'Alte Brücke Heidelberg',
      'Heidelberger Schloss & Alte Brücke',
    ],
    display: 'Heidelberger Schloss & Alte Brücke',
    lat: 49.4106,
    lon: 8.7153,
  },
  {
    names: [
      'Insel Mainau',
      'Mainau',
      'Blumeninsel Mainau',
      'Konstanz Bodensee',
      'Imperia Konstanz',
      'Insel Mainau & Konstanz Bodensee',
    ],
    display: 'Insel Mainau & Konstanz Bodensee',
    lat: 47.7051,
    lon: 9.1956,
  },
  {
    names: [
      'Bregenzer Seebühne',
      'Seebühne Bregenz',
      'Seebuehne Bregenz',
      'Festspielhaus Bregenz',
      'Bregenzer Festspiele',
      'Bregenz Festspielhaus & Seebühne',
    ],
    display: 'Bregenz Festspielhaus & Seebühne',
    lat: 47.5042,
    lon: 9.7381,
  },
  {
    names: [
      'Schloss Vaduz',
      'Vaduz Castle',
      'Regierungsviertel Vaduz',
      'Landtag Liechtenstein',
      'Schloss Vaduz & Regierungsviertel Liechtenstein',
    ],
    display: 'Schloss Vaduz & Regierungsviertel Liechtenstein',
    lat: 47.1394,
    lon: 9.5244,
  },
  {
    names: [
      'Karren Dornbirn',
      'Karrenseilbahn',
      'Rappenlochschlucht',
      'Rappenloch',
      'Alplochschlucht',
      'Karren Dornbirn & Rappenlochschlucht',
    ],
    display: 'Karren Dornbirn & Rappenlochschlucht',
    lat: 47.3925,
    lon: 9.7547,
  },
  {
    names: [
      'Schattenburg',
      'Schattenburg Feldkirch',
      'Altstadt Feldkirch',
      'Katzenturm Feldkirch',
      'Schattenburg & Altstadt Feldkirch',
    ],
    display: 'Schattenburg & Altstadt Feldkirch',
    lat: 47.2369,
    lon: 9.5997,
  },
  {
    names: [
      'Goldenes Dachl',
      'Goldenes Dachl Innsbruck',
      'Bergiselschanze',
      'Bergisel-Schanze',
      'Bergisel Innsbruck',
      'Goldenes Dachl & Bergisel-Schanze Innsbruck',
    ],
    display: 'Goldenes Dachl & Bergisel-Schanze Innsbruck',
    lat: 47.2686,
    lon: 11.3933,
  },
  {
    names: [
      'Festung Hohensalzburg',
      'Hohensalzburg',
      'Mirabellgarten',
      'Schloss Mirabell',
      'Festung Hohensalzburg & Mirabellgarten Salzburg',
    ],
    display: 'Festung Hohensalzburg & Mirabellgarten Salzburg',
    lat: 47.795,
    lon: 13.0475,
  },
  {
    names: [
      'Grazer Uhrturm',
      'Uhrturm Graz',
      'Schloßberg Graz',
      'Schlossberg Graz',
      'Uhrturm & Schloßberg Graz',
    ],
    display: 'Uhrturm & Schloßberg Graz',
    lat: 47.0747,
    lon: 15.4375,
  },
  {
    names: [
      'Kolosseum',
      'Colosseo',
      'Colosseum',
      'Colosseo Roma',
      'Kolosseum Rom',
      'Amphitheatrum Flavium',
      'Kolosseum / Colosseo Roma',
    ],
    display: 'Kolosseum / Colosseo Roma',
    lat: 41.8902,
    lon: 12.4922,
  },
  {
    names: [
      'Sagrada Família',
      'Sagrada Familia',
      'Basílica de la Sagrada Família',
      'Sagrada Familia Barcelona',
      'Sagrada Família Barcelona',
    ],
    display: 'Sagrada Família Barcelona',
    lat: 41.4036,
    lon: 2.1744,
  },
  // Wave 17 — DACH & Alpine Iconic Landmarks, Castles, Bridges, Gorges & Peaks
  {
    names: [
      'Aareschlucht',
      'Aareschlucht Meiringen',
      'Aare Gorge',
      'Gorges de l Aare',
      'Aareschlucht Haslital',
      'Aareschlucht Meiringen (Haslital, BE)',
    ],
    display: 'Aareschlucht Meiringen (Haslital, BE)',
    lat: 46.7192,
    lon: 8.2047,
  },
  {
    names: [
      'Taminabrücke',
      'Taminabruecke',
      'Taminabrücke Pfäfers',
      'Taminabrücke Bad Ragaz',
      'Taminaschlucht',
      'Altes Bad Pfäfers',
      'Taminabrücke Pfäfers / Bad Ragaz (Taminatal, SG)',
    ],
    display: 'Taminabrücke Pfäfers / Bad Ragaz (Taminatal, SG)',
    lat: 46.9892,
    lon: 9.5039,
  },
  {
    names: [
      'Churfirsten',
      'Chäserrugg',
      'Chaeserrugg',
      'Hinterrugg',
      'Churfirsten Walensee',
      'Chäserrugg Toggenburg',
      'Churfirsten (Chäserrugg / Toggenburg 2262m, SG)',
    ],
    display: 'Churfirsten (Chäserrugg / Toggenburg 2262m, SG)',
    lat: 47.1558,
    lon: 9.3125,
  },
  {
    names: [
      'Schloss Schönbrunn',
      'Schloss Schoenbrunn',
      'Schloss Schönbrunn Wien',
      'Schönbrunn Palace',
      'Gloriette Schönbrunn',
      'Schloss Schönbrunn & Gloriette Wien',
    ],
    display: 'Schloss Schönbrunn & Gloriette Wien',
    lat: 48.1845,
    lon: 16.3122,
  },
  {
    names: [
      'Stephansdom',
      'Stephansdom Wien',
      'Stephansplatz Wien',
      'St. Stephen s Cathedral Vienna',
      'Domkirche St. Stephan Wien',
      'Stephansdom Wien (Stephansplatz)',
    ],
    display: 'Stephansdom Wien (Stephansplatz)',
    lat: 48.2085,
    lon: 16.3731,
  },
  {
    names: [
      'Landwasserviadukt',
      'Landwasserviadukt Filisur',
      'Landwasser Viaduct',
      'Albulabahn Filisur',
      'Landwasserviadukt RhB',
      'Landwasserviadukt Filisur (Rhätische Bahn UNESCO, GR)',
    ],
    display: 'Landwasserviadukt Filisur (Rhätische Bahn UNESCO, GR)',
    lat: 46.6808,
    lon: 9.6761,
  },
  {
    names: [
      'Ruinaulta',
      'Rheinschlucht',
      'Ruinaulta Rheinschlucht',
      'Il Spir',
      'Il Spir Conn',
      'Swiss Grand Canyon',
      'Ruinaulta Rheinschlucht & Il Spir (Flims / Trin, GR)',
    ],
    display: 'Ruinaulta Rheinschlucht & Il Spir (Flims / Trin, GR)',
    lat: 46.7981,
    lon: 9.2981,
  },
  {
    names: [
      'Stiftsbibliothek St. Gallen',
      'Stiftsbibliothek Sankt Gallen',
      'Fürstabtei St. Gallen',
      'Stiftskirche St. Gallen',
      'Abbey Library of Saint Gall',
      'Stiftsbibliothek & Stiftsbezirk St. Gallen (UNESCO)',
    ],
    display: 'Stiftsbibliothek & Stiftsbezirk St. Gallen (UNESCO)',
    lat: 47.4231,
    lon: 9.3772,
  },
  {
    names: [
      'Viamala',
      'Viamala Schlucht',
      'Viamala-Schlucht',
      'Viamala Zillis',
      'Viamala Thusis',
      'Viamala-Schlucht (Thusis / Zillis, GR)',
    ],
    display: 'Viamala-Schlucht (Thusis / Zillis, GR)',
    lat: 46.6639,
    lon: 9.4464,
  },
  {
    names: [
      'Teufelsbrücke',
      'Teufelsbruecke',
      'Teufelsbrücke Andermatt',
      'Schöllenenschlucht',
      'Schoellenenschlucht',
      'Suworow Denkmal',
      'Teufelsbrücke & Schöllenenschlucht (Andermatt, UR)',
    ],
    display: 'Teufelsbrücke & Schöllenenschlucht (Andermatt, UR)',
    lat: 46.6472,
    lon: 8.5903,
  },
  {
    names: [
      'Triftbrücke',
      'Triftbruecke',
      'Triftbrücke Gadmen',
      'Trift Bridge',
      'Triftgletscher',
      'Triftbrücke Gadmen (Haslital, BE)',
    ],
    display: 'Triftbrücke Gadmen (Haslital, BE)',
    lat: 46.6942,
    lon: 8.3575,
  },
  {
    names: [
      'Schilthorn',
      'Piz Gloria',
      'Schilthorn Piz Gloria',
      'Schilthorn Mürren',
      'Schilthorn — Piz Gloria (Mürren 2970m, BE)',
    ],
    display: 'Schilthorn — Piz Gloria (Mürren 2970m, BE)',
    lat: 46.5572,
    lon: 7.8353,
  },
  {
    names: [
      'Niesen',
      'Niesen Kulm',
      'Niesenbahn',
      'Schweizer Pyramide',
      'Niesen Thunersee',
      'Niesen Kulm — Schweizer Pyramide (Spiez 2362m, BE)',
    ],
    display: 'Niesen Kulm — Schweizer Pyramide (Spiez 2362m, BE)',
    lat: 46.6461,
    lon: 7.655,
  },
  {
    names: [
      'Creux du Van',
      'Cirque rocheux du Creux du Van',
      'Creux du Van Neuchâtel',
      'Creux du Van Val de Travers',
      'Creux du Van (Val-de-Travers, NE/VD)',
    ],
    display: 'Creux du Van (Val-de-Travers, NE/VD)',
    lat: 46.9383,
    lon: 6.7275,
  },
  {
    names: [
      'Schloss Belvedere',
      'Belvedere Wien',
      'Oberes Belvedere',
      'Hofburg Wien',
      'Wiener Hofburg',
      'Schloss Belvedere & Hofburg Wien',
    ],
    display: 'Schloss Belvedere & Hofburg Wien',
    lat: 48.1916,
    lon: 16.3809,
  },
  // Wave 20 — DACH & Alpine Iconic Glaciers, Summits, Passes, Castles & Bridges
  {
    names: [
      'Aletschgletscher',
      'Grosser Aletschgletscher',
      'Großer Aletschgletscher',
      'Eggishorn',
      'Konkordiaplatz Aletsch',
      'Aletsch Arena',
      'Grosser Aletschgletscher & Eggishorn (UNESCO 2926m, VS)',
    ],
    display: 'Grosser Aletschgletscher & Eggishorn (UNESCO 2926m, VS)',
    lat: 46.4408,
    lon: 8.0889,
  },
  {
    names: [
      'Oeschinensee',
      'Öschinensee',
      'Oeschinensee Kandersteg',
      'Blüemlisalp',
      'Bluemlisalp',
      'Oeschinensee & Blüemlisalp (Kandersteg, BE)',
    ],
    display: 'Oeschinensee & Blüemlisalp (Kandersteg, BE)',
    lat: 46.4986,
    lon: 7.7292,
  },
  {
    names: [
      'Brienzer Rothorn',
      'Brienz Rothorn Bahn',
      'Rothorn Kulm Brienz',
      'Brienzersee Panorama',
      'Brienzer Rothorn (Brienz / Sörenberg 2350m, BE/LU)',
    ],
    display: 'Brienzer Rothorn (Brienz / Sörenberg 2350m, BE/LU)',
    lat: 46.7869,
    lon: 8.0469,
  },
  {
    names: [
      'Stanserhorn',
      'Stanserhorn Cabrio',
      'CabriO Stanserhorn',
      'Stanserhorn Bahn',
      'Stanserhorn (Stans / Nidwalden 1898m, NW)',
    ],
    display: 'Stanserhorn (Stans / Nidwalden 1898m, NW)',
    lat: 46.9297,
    lon: 8.3403,
  },
  {
    names: [
      'Fronalpstock',
      'Stoosbahn',
      'Stoos Standseilbahn',
      'Stoos Schwyz',
      'Fronalpstock Stoos',
      'Stoos & Fronalpstock (Schwyz 1922m, SZ)',
    ],
    display: 'Stoos & Fronalpstock (Schwyz 1922m, SZ)',
    lat: 46.9686,
    lon: 8.6372,
  },
  {
    names: [
      'Grosser Mythen',
      'Großer Mythen',
      'Mythen Schwyz',
      'Kleiner Mythen',
      'Holzegg Mythen',
      'Grosser Mythen (Schwyz 1899m, SZ)',
    ],
    display: 'Grosser Mythen (Schwyz 1899m, SZ)',
    lat: 47.0297,
    lon: 8.6886,
  },
  {
    names: [
      'Nufenenpass',
      'Passo della Novena',
      'Nufenen Pass',
      'Nufenenpass Ulrichen',
      'Nufenenpass / Passo della Novena (Wallis / Tessin 2478m)',
    ],
    display: 'Nufenenpass / Passo della Novena (Wallis / Tessin 2478m)',
    lat: 46.4781,
    lon: 8.3875,
  },
  {
    names: [
      'Albulapass',
      'Pass d Albula',
      'Albula Pass',
      'Albulapass La Punt',
      'Albulapass Bergün',
      'Albulapass (Bergün / La Punt 2312m, GR)',
    ],
    display: 'Albulapass (Bergün / La Punt 2312m, GR)',
    lat: 46.5825,
    lon: 9.8381,
  },
  {
    names: [
      'Splügenpass',
      'Spluegenpass',
      'Passo dello Spluga',
      'Splügen Pass',
      'Splügenpass (Rheinwald / Valchiavenna 2114m, GR)',
    ],
    display: 'Splügenpass (Rheinwald / Valchiavenna 2114m, GR)',
    lat: 46.5056,
    lon: 9.3303,
  },
  {
    names: [
      'Ofenpass',
      'Pass dal Fuorn',
      'Ofen Pass',
      'Schweizerischer Nationalpark Zernez',
      'Ofenpass / Pass dal Fuorn (Engadin / Val Müstair 2149m, GR)',
    ],
    display: 'Ofenpass / Pass dal Fuorn (Engadin / Val Müstair 2149m, GR)',
    lat: 46.6397,
    lon: 10.2925,
  },
  {
    names: [
      'Lukmanierpass',
      'Passo del Lucomagno',
      'Cuolm Lucomagno',
      'Lukmanier Pass',
      'Santa Maria Lukmanier',
      'Lukmanierpass / Passo del Lucomagno (Disentis / Blenio 1915m)',
    ],
    display: 'Lukmanierpass / Passo del Lucomagno (Disentis / Blenio 1915m)',
    lat: 46.5633,
    lon: 8.8011,
  },
  {
    names: [
      'Europabrücke',
      'Europabruecke',
      'Europabrücke Brenner',
      'Europabrücke Innsbruck',
      'Europabrücke Wipptal',
      'Europabrücke A13 Brenner Autobahn (Patsch / Schönberg, Tirol)',
    ],
    display: 'Europabrücke A13 Brenner Autobahn (Patsch / Schönberg, Tirol)',
    lat: 47.2022,
    lon: 11.4019,
  },
  {
    names: [
      'Burg Hohenwerfen',
      'Festung Hohenwerfen',
      'Hohenwerfen Castle',
      'Erlebnisburg Hohenwerfen',
      'Eisriesenwelt Werfen',
      'Burg Hohenwerfen & Eisriesenwelt (Salzachtal, AT)',
    ],
    display: 'Burg Hohenwerfen & Eisriesenwelt (Salzachtal, AT)',
    lat: 47.4828,
    lon: 13.1883,
  },
  {
    names: [
      'Hallstatt',
      'Hallstätter See',
      'Hallstaetter See',
      'Dachstein Skywalk',
      'Hoher Dachstein',
      'Hallstatt & Dachstein Salzkammergut (UNESCO, AT)',
    ],
    display: 'Hallstatt & Dachstein Salzkammergut (UNESCO, AT)',
    lat: 47.5622,
    lon: 13.6493,
  },
  {
    names: [
      'Kehlsteinhaus',
      'Königssee',
      'Koenigssee',
      'St. Bartholomä Königssee',
      'Watzmann',
      'Eagle s Nest Berchtesgaden',
      'Königssee, Watzmann & Kehlsteinhaus (Berchtesgaden, BY)',
    ],
    display: 'Königssee, Watzmann & Kehlsteinhaus (Berchtesgaden, BY)',
    lat: 47.6111,
    lon: 13.0417,
  },
  {
    names: [
      'Schloss Lenzburg',
      'Lenzburg Castle',
      'Schloss Hallwyl',
      'Schloss Habsburg',
      'Festung Aarburg',
      'Schloss Lenzburg & Hallwyl (Aargau, CH)',
    ],
    display: 'Schloss Lenzburg & Hallwyl (Aargau, CH)',
    lat: 47.3875,
    lon: 8.1864,
  },
  // Wave 22 — Iconic DACH & Alpine Passes, Glaciers, 4000m Peaks, Castles & World Monument Bridges
  {
    names: [
      'Malojapass',
      'Passo del Maloja',
      'Maloja Pass',
      'Maloja Engadin',
      'Maloja Bergell',
      'Malojapass (Oberengadin / Bergell 1815m, GR)',
    ],
    display: 'Malojapass (Oberengadin / Bergell 1815m, GR)',
    lat: 46.4006,
    lon: 9.6958,
  },
  {
    names: [
      'Umbrailpass',
      'Pass da l Umbrail',
      'Giogo di Santa Maria',
      'Umbrail Pass',
      'Umbrailpass Val Müstair',
      'Umbrailpass (Val Müstair / Bormio 2501m, GR)',
    ],
    display: 'Umbrailpass (Val Müstair / Bormio 2501m, GR)',
    lat: 46.5417,
    lon: 10.4331,
  },
  {
    names: [
      'Grosser St. Bernhard',
      'Großer St. Bernhard',
      'Col du Grand-Saint-Bernard',
      'Colle del Gran San Bernardo',
      'Great St Bernard Pass',
      'Hospiz Grosser St. Bernhard',
      'Grosser-St.-Bernhard-Pass & Hospiz (Wallis / Aostatal 2469m)',
    ],
    display: 'Grosser-St.-Bernhard-Pass & Hospiz (Wallis / Aostatal 2469m)',
    lat: 45.8689,
    lon: 7.1706,
  },
  {
    names: [
      'Gornergrat',
      'Gornergletscher',
      'Gornergratbahn',
      'Kulmhotel Gornergrat',
      'Monte Rosa Hütte',
      'Gornergrat & Gornergletscher (Zermatt 3089m, VS)',
    ],
    display: 'Gornergrat & Gornergletscher (Zermatt 3089m, VS)',
    lat: 45.9836,
    lon: 7.7847,
  },
  {
    names: [
      'Morteratschgletscher',
      'Vadret da Morteratsch',
      'Diavolezza',
      'Berghaus Diavolezza',
      'Morteratsch Pontresina',
      'Morteratschgletscher & Diavolezza (Pontresina / Bernina 2978m, GR)',
    ],
    display: 'Morteratschgletscher & Diavolezza (Pontresina / Bernina 2978m, GR)',
    lat: 46.4125,
    lon: 9.9656,
  },
  {
    names: [
      'Rhonegletscher',
      'Rhone Glacier',
      'Hotel Belvédère Furka',
      'Belvedere Furkapass',
      'Eisgrotte Rhonegletscher',
      'Rhonegletscher & Belvédère (Furkapass 2272m, VS)',
    ],
    display: 'Rhonegletscher & Belvédère (Furkapass 2272m, VS)',
    lat: 46.5772,
    lon: 8.3878,
  },
  {
    names: [
      'Dufourspitze',
      'Monte Rosa',
      'Monte Rosa Massiv',
      'Punta Dufour',
      'Höchster Berg der Schweiz',
      'Dufourspitze — Monte-Rosa-Massiv (Wallis 4634m, VS)',
    ],
    display: 'Dufourspitze — Monte-Rosa-Massiv (Wallis 4634m, VS)',
    lat: 45.9369,
    lon: 7.8669,
  },
  {
    names: [
      'Finsteraarhorn',
      'Finsteraarhornhütte',
      'Finsteraarhorn Berner Alpen',
      'Finsteraarhorn Gipfel',
      'Finsteraarhorn (Berner Alpen 4274m, BE/VS)',
    ],
    display: 'Finsteraarhorn (Berner Alpen 4274m, BE/VS)',
    lat: 46.5372,
    lon: 8.1261,
  },
  {
    names: [
      'Schloss Kyburg',
      'Kyburg',
      'Kyburg Castle',
      'Museum Schloss Kyburg',
      'Schloss Kyburg (Winterthur / Tösstal, ZH)',
    ],
    display: 'Schloss Kyburg (Winterthur / Tösstal, ZH)',
    lat: 47.4583,
    lon: 8.7433,
  },
  {
    names: [
      'Schloss Greyerz',
      'Château de Gruyères',
      'Chateau de Gruyeres',
      'Gruyères Castle',
      'Städtchen Gruyères',
      'Château de Gruyères / Schloss Greyerz (Freiburg, FR)',
    ],
    display: 'Château de Gruyères / Schloss Greyerz (Freiburg, FR)',
    lat: 46.5844,
    lon: 7.0825,
  },
  {
    names: [
      'Schloss Tarasp',
      'Chastè da Tarasp',
      'Tarasp Castle',
      'Tarasp Scuol',
      'Schloss Tarasp (Scuol / Unterengadin, GR)',
    ],
    display: 'Schloss Tarasp (Scuol / Unterengadin, GR)',
    lat: 46.7783,
    lon: 10.2617,
  },
  {
    names: [
      'Salginatobelbrücke',
      'Salginatobelbruecke',
      'Salginatobel Bridge',
      'Robert Maillart Brücke Schiers',
      'Salginatobelbrücke Schiers (Prättigau, GR)',
    ],
    display: 'Salginatobelbrücke Schiers (Prättigau, GR)',
    lat: 46.9814,
    lon: 9.7181,
  },
]);

/** Fold a name to the form an exact comparison uses: case, spacing, punctuation. */
function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\bhohen\s+kasten\b/g, 'hoher kasten')
    .replace(/\bhohen\s+freschen\b/g, 'hoher freschen')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keep a generated box inside the poles and inside the dateline. */
function boundedBox(lat, lon, halfSpan) {
  const wrap = (value) => {
    const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
    return wrapped === -180 ? 180 : wrapped;
  };
  return {
    southwest: {
      lat: Math.max(-90, lat - halfSpan),
      lng: wrap(lon - halfSpan),
    },
    northeast: { lat: Math.min(90, lat + halfSpan), lng: wrap(lon + halfSpan) },
  };
}

/**
 * Build the exact-match index once, so a search is a lookup rather than a scan.
 *
 * Only exact names match. A bundled preset that answered a partial or fuzzy
 * query would shadow the real geocoders for everything that merely resembles a
 * bundled name, and the operator would have no way to reach the place they
 * meant.
 */
function indexPresets(presets) {
  const byName = new Map();
  const remember = (key, place) => {
    const name = normalizeName(key);
    if (name && !byName.has(name)) byName.set(name, place);
  };

  for (const [cityId, city] of Object.entries(presets || {})) {
    const anchor = city?.pois?.[0];
    const bounds = city?.viewBounds;
    const lat = Number(anchor?.lat);
    const lon = Number(anchor?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const place = {
        lat,
        lng: lon,
        name: city.name,
        label: city.name,
        types: ['locality'],
        exact: true,
        viewport:
          Number.isFinite(bounds?.southwest?.lat) &&
          Number.isFinite(bounds?.southwest?.lng) &&
          Number.isFinite(bounds?.northeast?.lat) &&
          Number.isFinite(bounds?.northeast?.lng)
            ? {
                southwest: {
                  lat: bounds.southwest.lat,
                  lng: bounds.southwest.lng,
                },
                northeast: {
                  lat: bounds.northeast.lat,
                  lng: bounds.northeast.lng,
                },
              }
            : boundedBox(lat, lon, 0.1),
      };
      remember(cityId, place);
      remember(city.name, place);
    }

    for (const poi of city?.pois || []) {
      const poiLat = Number(poi?.lat);
      const poiLon = Number(poi?.lon);
      if (!Number.isFinite(poiLat) || !Number.isFinite(poiLon)) continue;
      remember(poi.name, {
        lat: poiLat,
        lng: poiLon,
        name: poi.name,
        label: city?.name ? `${poi.name}, ${city.name}` : poi.name,
        types: ['point_of_interest'],
        exact: true,
        viewport: boundedBox(poiLat, poiLon, LANDMARK_HALF_SPAN_DEG),
      });
    }
  }
  if (presets?.st_gallen || presets?.zurich) {
    for (const landmark of DACH_CURATED_LANDMARKS) {
      const place = {
        lat: landmark.lat,
        lng: landmark.lon,
        name: landmark.names[0],
        label: landmark.display,
        types: ['point_of_interest'],
        exact: true,
        viewport: boundedBox(landmark.lat, landmark.lon, LANDMARK_HALF_SPAN_DEG),
      };
      for (const alias of landmark.names) {
        remember(alias, place);
      }
    }
  }
  return byName;
}

/**
 * Answer the bundled city and landmark names without asking anyone.
 *
 * Matching is exact on the city id, the city name, or a landmark name; anything
 * else is passed on to the network geocoders untouched.
 */
export function createPresetGeocoder({ presets = {} } = {}) {
  const byName = indexPresets(presets);
  return {
    async geocode(query, { signal } = {}) {
      signal?.throwIfAborted();
      const place = byName.get(normalizeName(query));
      return place
        ? { place, answered: true }
        : { place: null, answered: true };
    },
  };
}
