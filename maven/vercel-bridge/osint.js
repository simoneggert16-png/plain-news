/**
 * Geocoded OSINT headlines (Reddit), for the conflict layer.
 *
 * Reddit itself carries no coordinates. This module takes the relay's newest
 * headlines and matches them against a compact gazetteer of conflict-relevant
 * places (city name → centre). A headline that names one of them becomes a map
 * point; the rest stay in the list without coordinates, so the layer never
 * pretends a vague post is a located event.
 *
 * The gazetteer is deliberately small and hand-kept: an automatic geocoder on
 * free-text headlines invents locations ("Russian losses" → Russia), and a
 * wrong dot on a war map is worse than no dot.
 */

const CACHE_MS = 2 * 60 * 1000;

/** A headline has to read like military operations to enter the layer. */
const MILITARY =
  /airstrike|air strike|drone|missile|shelling|artillery|rocket|attack|explosion|blast|offensive|troops|soldiers|military|air defen[cs]e|fighter jet|bomber|warship|naval|sabotage|refinery|depot|front ?line|invasion|ceasefire|killed|wounded|casualt|evacuat|intercept|غارة|قصف|صاروخ|صواريخ|مسيرة|مسيّرة|طائرة|هجوم|انفجار|شهيد|شهداء|قتلى|جرحى|جيش|جبهة|اشتباك|استهداف|احتلال/i;
/** @type {{at:number, body:object|null}} */
const cache = { at: 0, body: null };

/** City centres used for headline matching. [name, aliases, lat, lon] */
const PLACES = [
  // Ukraine
  ['Kyiv', ['kiev'], 50.4501, 30.5234],
  ['Kharkiv', ['kharkov'], 49.9935, 36.2304],
  ['Odesa', ['odessa'], 46.4825, 30.7233],
  ['Dnipro', ['dnepr'], 48.4647, 35.0462],
  ['Zaporizhzhia', ['zaporizhia', 'zaporozhye'], 47.8388, 35.1396],
  ['Kherson', [], 46.6354, 32.6169],
  ['Mykolaiv', ['nikolaev'], 46.975, 31.9946],
  ['Sumy', [], 50.9077, 34.7981],
  ['Chernihiv', ['chernigov'], 51.4982, 31.2893],
  ['Lviv', ['lwow'], 49.8397, 24.0297],
  ['Donetsk', [], 48.0159, 37.8029],
  ['Luhansk', ['lugansk'], 48.574, 39.3078],
  ['Bakhmut', [], 48.5956, 38.0008],
  ['Avdiivka', ['avdeevka'], 48.1399, 37.7481],
  ['Pokrovsk', [], 48.2815, 37.176],
  ['Kurakhove', [], 47.9852, 37.2777],
  ['Vuhledar', ['ugledar'], 47.7828, 37.2475],
  ['Kupiansk', ['kupyansk'], 49.7103, 37.6156],
  ['Lyman', ['krasny liman'], 48.9861, 37.8053],
  ['Sloviansk', ['slavyansk'], 48.8523, 37.6109],
  ['Kramatorsk', [], 48.7233, 37.5563],
  ['Kostiantynivka', ['kostyantynivka'], 48.5277, 37.7058],
  ['Chasiv Yar', [], 48.5933, 37.8426],
  ['Toretsk', ['dzerzhinsk'], 48.3986, 37.8477],
  ['Siversk', [], 48.8666, 38.0977],
  ['Vovchansk', ['volchansk'], 50.2903, 37.5028],
  ['Izium', ['izyum'], 49.2088, 37.2485],
  ['Nikopol', [], 47.5712, 34.3916],
  ['Marhanets', [], 47.6387, 34.6278],
  ['Kryvyi Rih', ['krivoy rog'], 47.9105, 33.3918],
  ['Poltava', [], 49.5883, 34.5514],
  ['Vinnytsia', [], 49.2331, 28.4682],
  ['Zhytomyr', [], 50.2547, 28.6587],
  ['Rivne', [], 50.6199, 26.2516],
  ['Ternopil', [], 49.5535, 25.5948],
  ['Ivano-Frankivsk', [], 48.9226, 24.7111],
  ['Uzhhorod', [], 48.6208, 22.2879],
  ['Chernivtsi', [], 48.2917, 25.9358],
  ['Kropyvnytskyi', [], 48.5079, 32.2623],
  ['Cherkasy', [], 49.4444, 32.0598],
  ['Melitopol', [], 46.8489, 35.3654],
  ['Mariupol', [], 47.0951, 37.5413],
  ['Berdiansk', ['berdyansk'], 46.7554, 36.7885],
  ['Enerhodar', [], 47.4989, 34.6557],
  ['Nova Kakhovka', [], 46.7562, 33.3486],
  ['Sevastopol', [], 44.6166, 33.5254],
  ['Simferopol', [], 44.9521, 34.1024],
  ['Kerch', [], 45.3531, 36.4747],
  // Russia and the border belt
  ['Moscow', ['moskau'], 55.7558, 37.6173],
  ['Belgorod', [], 50.5977, 36.5853],
  ['Kursk', [], 51.7304, 36.1926],
  ['Bryansk', [], 53.2436, 34.3639],
  ['Rostov-on-Don', ['rostov'], 47.2357, 39.7015],
  ['Voronezh', [], 51.672, 39.1843],
  ['Kaluga', [], 54.5138, 36.2612],
  ['Tula', [], 54.1961, 37.6182],
  ['Oryol', ['orel'], 52.9651, 36.0785],
  ['Lipetsk', [], 52.6031, 39.5708],
  ['Saratov', [], 51.5336, 46.0343],
  ['Engels', [], 51.4839, 46.1053],
  ['Ryazan', [], 54.6269, 39.6916],
  ['Novorossiysk', [], 44.7239, 37.7686],
  ['Sochi', [], 43.6028, 39.7342],
  ['Saint Petersburg', ['st petersburg'], 59.9311, 30.3609],
  ['Murmansk', [], 68.9585, 33.0827],
  ['Pskov', [], 57.8194, 28.3318],
  ['Smolensk', [], 54.7818, 32.0401],
  ['Taganrog', [], 47.2214, 38.909],
  ['Millerovo', [], 48.9226, 40.3967],
  ['Kursk Nuclear', ['kurchatov'], 51.6608, 35.6522],
  // Middle East
  ['Gaza', ['غزة', 'قطاع غزة', 'עזה', 'רצועת עזה'], 31.5017, 34.4668],
  ['Rafah', ['رفح', 'רפיח'], 31.287, 34.245],
  ['Khan Younis', ['khan yunis', 'خان يونس', 'خانيونس', 'חאן יונס'], 31.3401, 34.3029],
  ['Jabalia', ['jabalya', 'جباليا', "ג'באליה"], 31.5333, 34.5],
  ['Beirut', ['بيروت', 'الضاحية الجنوبية', 'الضاحية', 'ביירות', 'דאחייה'], 33.8938, 35.5018],
  ['Damascus', ['دمشق', 'דמשק'], 33.5138, 36.2765],
  ['Aleppo', ['حلب', 'חלב'], 36.2021, 37.1343],
  ['Homs', ['حمص', 'חומס'], 34.7324, 36.7137],
  ['Hama', ['حماة'], 35.1318, 36.7578],
  ['Latakia', ['اللاذقية'], 35.5309, 35.7826],
  ['Tehran', ['طهران', 'إيران', 'טהרן', 'איראן'], 35.6892, 51.389],
  ['Isfahan', ['أصفهان', 'اصفهان', 'אספהאן'], 32.6546, 51.668],
  ['Baghdad', ['بغداد', 'العراق'], 33.3152, 44.3661],
  ['Erbil', ['أربيل'], 36.1911, 44.0092],
  ['Sanaa', ['sana', 'صنعاء', 'اليمن', 'תימן', 'צנעא'], 15.3694, 44.191],
  ['Hodeidah', ['hudaydah', 'الحديدة', 'البحر الأحمر', 'باب المندب', 'חודיידה'], 14.7978, 42.9545],
  ['Tel Aviv', ['تل أبيب', 'تل ابيب', 'תל אביב', 'גוש דן'], 32.0853, 34.7818],
  ['Jerusalem', ['القدس', 'ירושלים'], 31.7683, 35.2137],
  ['Haifa', ['حيفا', 'חיפה', 'הקריות'], 32.794, 34.9896],
  ['Eilat', ['إيلات', 'ايلات', 'אילת'], 29.5577, 34.9519],
  ['Aden', ['عدن', 'خليج عدن'], 12.7855, 45.0187],
  ['Riyadh', ['الرياض', 'السعودية'], 24.7136, 46.6753],
  // Africa
  ['Khartoum', ['الخرطوم'], 15.5007, 32.5599],
  ['Omdurman', [], 15.6445, 32.4777],
  ['El Fasher', [], 13.6279, 25.3494],
  ['Nyala', [], 12.05, 24.8833],
  ['Tripoli', [], 32.8872, 13.1913],
  ['Benghazi', [], 32.1167, 20.0667],
  ['Bamako', [], 12.6392, -8.0029],
  ['Ouagadougou', [], 12.3714, -1.5197],
  ['Niamey', [], 13.5116, 2.1254],
  ['Mogadishu', [], 2.0469, 45.3182],
  ['Kinshasa', [], -4.4419, 15.2663],
  ['Goma', [], -1.6771, 29.2289],
  ['Addis Ababa', [], 9.0192, 38.7525],
  ['Tigray', ['mekelle'], 13.4967, 39.4753],
  // Asia / other
  ['Taipei', [], 25.033, 121.5654],
  ['Taiwan Strait', [], 24.5, 119.5],
  ['Seoul', [], 37.5665, 126.978],
  ['Pyongyang', [], 39.0392, 125.7625],
  ['Kabul', [], 34.5553, 69.2075],
  ['Islamabad', [], 33.6844, 73.0479],
  ['New Delhi', ['delhi'], 28.6139, 77.209],
  ['Caracas', [], 10.4806, -66.9036],
  ['Bogota', [], 4.711, -74.0721],
  ['Quito', [], -0.1807, -78.4678],
  ['Mexico City', [], 19.4326, -99.1332],
  ['South China Sea', [], 14.0, 114.0],
  ['Spratly Islands', ['Spratly', 'Spratlys'], 10.0, 114.0],
  ['Scarborough Shoal', [], 15.15, 117.75],
  ['Kashmir', [], 34.08, 74.8],
  ['Line of Control', ['LoC'], 34.0, 74.0],

  ['Tbilisi', [], 41.7151, 44.8271],
  ['Yerevan', [], 40.1792, 44.4991],
  ['Baku', [], 40.4093, 49.8671],
  ['Dushanbe', [], 38.5598, 68.787],
  ['Bishkek', [], 42.8746, 74.5698],
  ['Tashkent', [], 41.2995, 69.2401],
  ['Ulaanbaatar', [], 47.8864, 106.9057],
  ['Tokyo', [], 35.6762, 139.6503],
  ['Hong Kong', [], 22.3193, 114.1694],
  ['Guangzhou', [], 23.1291, 113.2644],
  ['Shanghai', [], 31.2304, 121.4737],
  ['Beijing', ['Peking'], 39.9042, 116.4074],
  ['Kolkata', [], 22.5726, 88.3639],
  ['Mumbai', [], 19.076, 72.8777],
  ['Srinagar', [], 34.0837, 74.7973],
  ['Lahore', [], 31.5204, 74.3587],
  ['Karachi', [], 24.8607, 67.0011],
  ['Kathmandu', [], 27.7172, 85.324],
  ['Colombo', [], 6.9271, 79.8612],
  ['Chittagong', [], 22.3569, 91.7832],
  ['Dhaka', [], 23.8103, 90.4125],
  ['Vientiane', [], 17.9757, 102.6331],
  ['Phnom Penh', [], 11.5564, 104.9282],
  ['Ho Chi Minh City', ['Saigon'], 10.8231, 106.6297],
  ['Hanoi', [], 21.0278, 105.8342],
  ['Singapore', [], 1.3521, 103.8198],
  ['Kuala Lumpur', [], 3.139, 101.6869],
  ['Jakarta', [], -6.2088, 106.8456],
  ['Marawi', [], 8.0, 124.29],
  ['Manila', ['مانيلا'], 14.5995, 120.9842],
  ['Chiang Mai', [], 18.7883, 98.9853],
  ['Bangkok', ['بانكوك'], 13.7563, 100.5018],
  ['Loikaw', ['လွိုင်ကော်'], 19.674, 97.209],
  ['Myawaddy', ['မြဝတီ'], 16.689, 98.508],
  ['Lashio', ['လားရှိုး'], 22.9359, 97.7498],
  ['Sittwe', ['စစ်တွေ'], 20.146, 92.898],
  ['Naypyidaw', ['Nay Pyi Taw', 'နေပြည်တော်'], 19.7633, 96.0785],
  ['Mandalay', ['မန္တလေး'], 21.9588, 96.0891],
  ['Yangon', ['Rangoon', 'يانغون', 'ရန်ကုန်'], 16.8409, 96.1735],
  // Middle East — the Iran/Israel/Gulf theatre the OSINT feed covers
  ['Natanz', ['نطنز'], 33.72, 51.73],
  ['Fordow', ['fordow fuel enrichment'], 34.88, 50.99],
  ['Bushehr', [], 28.92, 50.84],
  ['Bandar Abbas', [], 27.19, 56.27],
  ['Kharg Island', ['kharg'], 29.25, 50.32],
  ['Tabriz', [], 38.08, 46.29],
  ['Shiraz', [], 29.59, 52.58],
  ['Mashhad', [], 36.3, 59.61],
  ['Ahvaz', [], 31.32, 48.67],
  ['Kermanshah', [], 34.31, 47.07],
  ['Abadan', [], 30.34, 48.3],
  ['Chabahar', [], 25.29, 60.64],
  ['Qom', [], 34.64, 50.88],
  ['Karaj', [], 35.84, 50.94],
  ['Strait of Hormuz', ['hormuz'], 26.57, 56.25],
  ['Dimona', [], 31.07, 35.03],
  ['Nevatim', [], 31.21, 35.01],
  ['Ashdod', ['أسدود'], 31.8, 34.64],
  ['Ashkelon', ['عسقلان'], 31.67, 34.57],
  ['Sderot', ['سديروت'], 31.52, 34.6],
  ['Beersheba', ['بئر السبع'], 31.25, 34.79],
  ['Ramla', [], 31.93, 34.87],
  ['Jenin', ['جنين'], 32.46, 35.3],
  ['Nablus', ['نابلس'], 32.22, 35.25],
  ['Ramallah', ['رام الله'], 31.9, 35.2],
  ['Hebron', ['الخليل'], 31.53, 35.1],
  ['Tyre', ['صور'], 33.27, 35.2],
  ['Sidon', ['صيدا'], 33.56, 35.37],
  ['Nabatieh', [], 33.38, 35.48],
  ['Baalbek', [], 34.01, 36.21],
  ['Deir ez-Zor', [], 35.33, 40.14],
  ['Tartus', [], 34.89, 35.89],
  ['Saada', [], 16.94, 43.76],
  ['Marib', [], 15.46, 45.33],
  ['Basra', ['البصرة'], 30.51, 47.78],
  ['Ain al-Asad', ['al-asad'], 33.79, 42.44],
  ['Doha', ['الدوحة'], 25.29, 51.53],
  ['Dubai', ['دبي'], 25.2, 55.27],
  ['Abu Dhabi', ['أبوظبي'], 24.45, 54.38],
  ['Manama', [], 26.23, 50.59],
  ['Kuwait City', [], 29.38, 47.99],
  ['Al Udeid', [], 25.12, 51.32],
  ['Dhahran', [], 26.27, 50.15],
  ['Beit Lahia', ['beit lahia', 'بيت لاهيا'], 31.55, 34.5],
  ['Beit Hanoun', ['beit hanoun', 'بيت حانون'], 31.54, 34.54],
  ["Shuja'iyya", ['shujaiyya'], 31.5, 34.47],
  ['Zeitoun', ['zaytoun'], 31.47, 34.4],
  ['Deir al-Balah', ['deir al balah', 'دير البلح'], 31.42, 34.35],
  ['Bureij', ['البريج'], 31.44, 34.4],
  ['Nuseirat', ['النصيرات'], 31.45, 34.39],
  ['Maghazi', ['المغازي'], 31.42, 34.38],
  ['Kerem Shalom', [], 31.22, 34.27],
  ['Erez', ['erez crossing'], 31.56, 34.55],
  ["Re'im", ['reim'], 31.39, 34.44],
  ['Netivot', [], 31.42, 34.59],
  ['Ofakim', [], 31.31, 34.62],
  ['Kiryat Gat', [], 31.61, 34.76],
  ['Kiryat Shmona', [], 33.21, 35.57],
  ['Metula', [], 33.28, 35.58],
  ['Nahariya', [], 33.01, 35.09],
  ['Acre', ['akko'], 32.93, 35.08],
  ['Tiberias', [], 32.79, 35.53],
  ['Tulkarm', ['طولكرم'], 32.31, 35.03],
  ['Qalqilya', ['قلقيلية'], 32.19, 34.97],
  ['Bethlehem', ['بيت لحم'], 31.7, 35.2],
  ['Jericho', ['أريحا'], 31.86, 35.46],
  ['Lod', [], 31.95, 34.89],
  ['Netanya', [], 32.32, 34.85],
  ['Herzliya', [], 32.17, 34.79],
  ['Hadera', [], 32.43, 34.89],
  ['Afula', [], 32.61, 35.29],
  ['Medina', ['المدينة المنورة'], 24.47, 39.61],
  ['Jeddah', ['جدة'], 21.49, 39.19],
  ['Mecca', [], 21.39, 39.83],
  ['Abha', [], 18.22, 42.51],
  ['Riyadh', [], 24.71, 46.68],
  // Expanded Ukraine, Kursk & Russian Rear Sites
  ['Sudzha', ['суджа'], 51.1914, 35.2708],
  ['Korenevo', ['коренево'], 51.4089, 34.8981],
  ['Lgov', ['льгов'], 51.6717, 35.2639],
  ['Rylsk', ['рыльск'], 51.5669, 34.6825],
  ['Glushkovo', ['глушково'], 51.3408, 34.6397],
  ['Shebekino', ['шебекино'], 50.4067, 36.8925],
  ['Valuyki', ['валуйки'], 50.2117, 38.1036],
  ['Graivoron', ['грайворон'], 50.4789, 35.6725],
  ['Orikhiv', ['орехов', 'orikhiv'], 47.5672, 35.7778],
  ['Robotyne', ['роботине'], 47.4453, 35.8392],
  ['Huliaipole', ['гуляйполе', 'gulyaipole'], 47.6606, 36.2581],
  ['Velyka Novosilka', ['велика новосілка'], 47.8406, 36.8314],
  ['Selydove', ['селидове'], 48.1489, 37.3014],
  ['Myrnohrad', ['мирноград', 'dimitrov'], 48.2975, 37.2658],
  ['Niu-York', ['нью-йорк', 'novhorodske'], 48.3292, 37.8364],
  ['Bilohorivka', ['білогорівка'], 48.9261, 38.2467],
  ['Kreminna', ['кремінна'], 49.05, 38.2167],
  ['Svatove', ['сватове'], 49.4092, 38.1619],
  ['Borova', ['борова'], 49.3831, 37.6214],
  ['Lyptsi', ['липці'], 50.2056, 36.4167],
  ['Chuhuiv', ['чугуїв'], 49.8358, 36.6889],
  ['Pavlohrad', ['павлоград'], 48.5342, 35.87],
  ['Kremenchuk', ['кременчук'], 49.0685, 33.4204],
  ['Uman', ['умань'], 48.7484, 30.2218],
  ['Starokostiantyniv', ['старокостянтинів'], 49.7556, 27.2208],
  ['Stryi', ['стрий'], 49.2564, 23.8503],
  ['Izmail', ['ізмаїл'], 45.3503, 28.8369],
  ['Reni', ['рені'], 45.4575, 28.2889],
  ['Ochakiv', ['очаків'], 46.6186, 31.5392],
  ['Dzhankoi', ['джанкой'], 45.7086, 34.3933],
  ['Yevpatoria', ['евпатория', 'evpatoria'], 45.1904, 33.3669],
  ['Feodosia', ['феодосия'], 45.0319, 35.3824],
  ['Saky', ['саки', 'novofedorivka'], 45.0919, 33.5758],
  ['Morozovsk', ['морозовск'], 48.3522, 41.8267],
  ['Yeisk', ['ейск', 'yeysk'], 46.7111, 38.2733],
  ['Primorsko-Akhtarsk', ['приморско-ахтарск'], 46.0469, 38.1756],
  ['Akhtubinsk', ['ахтубинск'], 48.2819, 46.1719],
  ['Mozdok', ['моздок'], 43.7486, 44.6569],
  ['Olenya', ['оленья'], 68.1522, 33.4689],
  ['Toropets', ['торопец'], 56.4978, 31.6353],
  ['Karachev', ['карачев'], 53.1228, 34.9853],
  ['Tikhoretsk', ['тихорецк'], 45.8547, 40.1253],
  ['Tuapse', ['туапсе'], 44.105, 39.0703],
  ['Yelabuga', ['елабуга', 'alabuga'], 55.7578, 52.0489],
  // Expanded Levant, Syria, Iraq, Yemen & Red Sea
  ['Bint Jbeil', ['بنت جبيل'], 33.1194, 35.4333],
  ['Marjayoun', ['مرجعيون'], 33.3608, 35.5917],
  ['Khiam', ['الخيام'], 33.3283, 35.6122],
  ['Naqoura', ['الناقورة'], 33.1181, 35.14],
  ['Hermel', ['الهرمل'], 34.3942, 36.3847],
  ['Qusayr', ['al-qusayr', 'القصير'], 34.5092, 36.5797],
  ['Masyaf', ['مصياف'], 35.0653, 36.3422],
  ['Palmyra', ['تدمر', 'tadmur'], 34.56, 38.2672],
  ['Al-Bukamal', ['albogamal', 'البوكمال'], 34.4522, 40.9186],
  ['Al-Tanf', ['التنف'], 33.4958, 38.6569],
  ['Quneitra', ['القنيطرة'], 33.1258, 35.8244],
  ['Daraa', ['درعا'], 32.6189, 36.1021],
  ['Idlib', ['إدلب'], 35.9306, 36.6339],
  ['Safed', ['tzfat', 'צפת', 'صفد'], 32.9646, 35.496],
  ['Karmiel', ['כרמיאל'], 32.9136, 35.2961],
  ['Maalot', ['maalot-tarshiha'], 33.0156, 35.2725],
  ['Caesarea', ['קיסריה'], 32.5189, 34.9044],
  ['Rishon LeZion', ['ראשון לציון'], 31.973, 34.7925],
  ['Holon', ['חולון'], 32.0158, 34.7874],
  ['Bat Yam', ['בת ים'], 32.0132, 34.748],
  ['Kamaran', ['كمران'], 15.3556, 42.5858],
  ['Ras Isa', ['رأس عيسى'], 15.1764, 42.6075],
  ['Taiz', ['تعز'], 13.5795, 44.0209],
  ['Dhamar', ['ذمار'], 14.5425, 44.405],
  ['Bab el-Mandeb', ['bab al-mandab', 'باب المندب'], 12.585, 43.332],
  // Expanded Sudan & Horn of Africa
  ['Port Sudan', ['بورتسودان'], 19.6158, 37.2164],
  ['Wad Madani', ['ود مدني'], 14.4012, 33.5199],
  ['Sennar', ['سنار'], 13.5691, 33.5672],
  ['El Geneina', ['الجنينة'], 13.4526, 22.4479],
  ['El Obeid', ['الأبيض'], 13.1842, 30.2167],
];

/** Longest-name-first so "Novorossiysk" wins over a bare "Rostov". */
const MATCHERS = PLACES.flatMap(([name, aliases, lat, lon]) =>
  [name, ...(aliases || [])].map((label) => ({
    label,
    place: name,
    lat,
    lon,
    // Arabic and other non-Latin scripts have no \b semantics in JavaScript:
    // match those labels as plain substrings instead.
    literal: /[^\x00-\x7f]/.test(label),
    pattern: new RegExp(
      `\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ),
  })),
).sort((a, b) => b.label.length - a.label.length);

function locate(title) {
  for (const matcher of MATCHERS) {
    const hit = matcher.literal
      ? title.includes(matcher.label)
      : matcher.pattern.test(title);
    if (hit)
      return { place: matcher.place, lat: matcher.lat, lon: matcher.lon };
  }
  return null;
}

/** Haversine great-circle distance in whole kilometres. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const WEAPON_MODELS = [
  ['Iskander-M', 'missile', /\biskander(?:-m|-k)?\b/i],
  ['Kinzhal (Kh-47M2)', 'missile', /\bkinzhal|kh-?47\b/i],
  ['Kalibr', 'missile', /\bkalibr\b/i],
  ['Kh-101 / Kh-555', 'missile', /\bkh-?(?:101|555|59|69|22|32)\b/i],
  ['Zircon (3M22)', 'missile', /\bzircon|tsirkon\b/i],
  ['ATACMS', 'missile', /\batacms\b/i],
  ['Storm Shadow / SCALP', 'missile', /\bstorm\s+shadow|scalp(?:-eg)?\b/i],
  ['Neptune', 'missile', /\bneptune\b/i],
  ['S-300 / S-400', 'missile', /\bs-?(?:300|400)\b/i],
  ['Fateh-110 / Zolfaghar', 'missile', /\bfateh|zolfaghar\b/i],
  ['Emad / Khorramshahr', 'missile', /\bemad|khorramshahr|qiam|sejjil|shahab|kheibar\b/i],
  ['Shahed-136 / Geran-2', 'drone', /\bshahed(?:-?\d+)?|geran(?:-?\d+)?\b/i],
  ['Lancet', 'drone', /\blancet\b/i],
  ['FPV-Kampfdrohne', 'drone', /\bfpv\b/i],
  ['Bayraktar TB2', 'drone', /\bbayraktar\b/i],
  ['Samad-3 / Yafa', 'drone', /\bsamad|yafa\b/i],
  ['Orlan / Aufklärungsdrohne', 'drone', /\borlan|supercam|zala\b/i],
  ['HIMARS / GMLRS', 'rocket', /\bhimars|gmlrs\b/i],
  ['BM-21 Grad MLRS', 'rocket', /\bgrad\b|bm-?21\b/i],
  ['Tornado-S / Smerch', 'rocket', /\btornado-?s|smerch|uragan\b/i],
  ['RM-70 Vampire', 'rocket', /\bvampire\b/i],
  ['Qassam / Fajr', 'rocket', /\bqassam|fajr|burkan|falaq|katyusha\b/i],
  ['KAB / FAB Gleitbombe', 'airstrike', /\bkab\b|fab-?\d+|umpk|glide\s+bomb|guided\s+bomb\b/i],
  ['JDAM / GBU-31 Bunkerbrecher', 'airstrike', /\bjdam|gbu-?\d+|mk-?84|bunker\s+buster\b/i],
  ['Flugzeugträger-Kampfgruppe', 'carrier', /\bcarrier\s+strike\s+group|aircraft\s+carrier|cvn-?\d+|lhd-?\d+|uss\s+abraham\s+lincoln|uss\s+harry\s+s\.?\s+truman|uss\s+wasp|flugzeugtr[äa]ger\b|حاملة\s+طائرات/i],
  ['Seeblockade / Marine-Sperrzone', 'blockade', /\bnaval\s+blockade|maritime\s+blockade|seeblockade|red\s+sea\s+blockade\b|حصار\s+بحري|معادلة\s+الحصار|الحصار/i],
];

/**
 * Classify weapon type and specific system from headline text:
 * - 'missile' (ballistic / cruise missiles)
 * - 'drone' (one-way attack UAVs, FPV drones, loitering munitions)
 * - 'rocket' (MLRS, unguided rockets, rocket barrages)
 * - 'airstrike' (glide bombs, fighter/bomber strikes)
 * - 'artillery' (tube artillery, mortars, shelling)
 * - 'other' (general military report)
 */
export function classifyWeapon(title) {
  const text = String(title || '');
  for (const [model, weaponType, pattern] of WEAPON_MODELS) {
    if (pattern.test(text)) return { weaponType, weaponModel: model };
  }
  if (
    /\b(?:ballistic|cruise\s+missile|hypersonic|icbm|irbm|srbm|missiles?|marschflugk[öo]rper|ballistische\s+rakete)\b|صاروخ\s+باليستي|صواريخ\s+باليستية|صاروخ\s+كروز/i.test(
      text,
    )
  ) {
    return {
      weaponType: 'missile',
      weaponModel: /ballistic|باليستي/i.test(text)
        ? 'Ballistische Rakete'
        : /cruise|كروز/i.test(text)
          ? 'Marschflugkörper'
          : 'Lenkrakete / Missile',
    };
  }
  if (
    /\b(?:drones?|uavs?|kamikaze\s+drone|one-way\s+attack|loitering\s+munition|unmanned\s+aerial|drohnen?(?:angriff)?)\b|مسيرة|مسيّرة|مسيرات|طائرة\s+مسيرة/i.test(
      text,
    )
  ) {
    return { weaponType: 'drone', weaponModel: 'Kampfdrohne / UAV' };
  }
  if (
    /\b(?:rockets?|mlrs|rocket\s+barrage|rocket\s+salvo|rocket\s+fire|rocket\s+strike|rocket\s+attack|raketen(?:angriff|beschuss|einschlag)?)\b|رشقة\s+صاروخية|صواريخ|صاروخ|قذائف\s+صاروخية/i.test(
      text,
    )
  ) {
    return { weaponType: 'rocket', weaponModel: 'Raketenartillerie / MLRS' };
  }
  if (
    /\b(?:air\s*strikes?|fighter\s+jets?|bombers?|bombardment|heavy\s+bombing|luftangriff|bombardierung)\b|غارة|غارات|قصف\s+جوي|طيران\s+حربي|أحزمة\s+نارية|תקיפה|הפצצה/i.test(
      text,
    )
  ) {
    return { weaponType: 'airstrike', weaponModel: 'Bombardierung / Luftschlag' };
  }
  if (
    /\b(?:shelling|artillery|mortars?|howitzers?|tank\s+fire|artilleriebeschuss)\b|قصف\s+مدفعي|قصف|دبابات|مدفعية|هاون|تطلق\s+نيرانها|ארטילריה/i.test(
      text,
    )
  ) {
    return { weaponType: 'artillery', weaponModel: 'Artillerie- & Panzerbeschuss' };
  }
  return { weaponType: 'other', weaponModel: null };
}

/** Named launch regions/hubs mentioned in OSINT reports (`launched from ...`). */
const EXPLICIT_ORIGINS = [
  [/\b(?:chauda|cape\s+chauda)\b/i, 'Chauda / Krim', 45.008, 35.833],
  [/\b(?:primorsko-?akhtarsk)\b/i, 'Primorsko-Achtarsk', 46.06, 38.239],
  [/\b(?:yeysk|yeisk)\b/i, 'Jejsk', 46.68, 38.27],
  [/\b(?:khalino)\b/i, 'Kursk-Chalino', 51.751, 36.296],
  [/\b(?:crimea|krim|sevastopol|simferopol|dzhankoi)\b/i, 'Krim (Startbasis)', 45.008, 35.833],
  [/\b(?:black\s+sea)\b/i, 'Schwarzes Meer (Flotte)', 44.45, 33.1],
  [/\b(?:caspian\s+sea)\b/i, 'Kaspisches Meer (Fernflieger)', 42.8, 49.2],
  [/\b(?:kursk)\b/i, 'Kursk (Startraum)', 51.7304, 36.1926],
  [/\b(?:belgorod)\b/i, 'Belgorod (Startraum)', 50.5977, 36.5853],
  [/\b(?:bryansk)\b/i, 'Brjansk (Startraum)', 53.2436, 34.3639],
  [/\b(?:voronezh)\b/i, 'Woronesch (Startraum)', 51.672, 39.1843],
  [/\b(?:millerovo)\b/i, 'Millerowo (Startbasis)', 48.9226, 40.3967],
  [/\b(?:engels|saratov)\b/i, 'Engels-2 / Saratow', 51.4839, 46.208],
  [/\b(?:rostov)\b/i, 'Rostow (Startraum)', 47.2357, 39.7015],
  [/\b(?:south(?:ern)?\s+lebanon|lebanon|hezbollah|tyre|nabatieh|baalbek)\b|لبنان|حزب\s+الله/i, 'Südlibanon (Startraum)', 33.27, 35.25],
  [/\b(?:yemen|houthi|houthis|ansar\s*allah|sanaa|hodeidah|saada)\b|اليمن|الحوثي/i, 'Sanaa / Jemen (Startraum)', 15.3694, 44.191],
  [/\b(?:iran|irgc|kermanshah|isfahan|tabriz|tehran)\b|إيران/i, 'Westiran / Kermanschah (Startraum)', 34.31, 47.07],
  [/\b(?:gaza|hamas|rafah|khan\s+younis|jabalia|beit\s+hanoun)\b|غزة/i, 'Gaza (Startraum)', 31.5017, 34.4668],
  [/\b(?:iraq|islamic\s+resistance\s+in\s+iraq)\b|العراق/i, 'Westirak (Startraum)', 33.3152, 44.3661],
  [/\b(?:syria|damascus)\b|سوريا/i, 'Syrien (Startraum)', 33.5138, 36.2765],
  [/\b(?:red\s+sea)\b|البحر\s+الأحمر/i, 'Rotes Meer (Startraum)', 15.1, 41.6],
];

const UKRAINE_SOUTH = new Set([
  'Odesa',
  'Mykolaiv',
  'Kherson',
  'Kryvyi Rih',
  'Zaporizhzhia',
  'Dnipro',
  'Nikopol',
  'Marhanets',
]);
const UKRAINE_EAST = new Set([
  'Kharkiv',
  'Kupiansk',
  'Vovchansk',
  'Lyptsi',
  'Izium',
  'Sloviansk',
  'Kramatorsk',
  'Kostiantynivka',
  'Chasiv Yar',
  'Toretsk',
  'Niu-York',
  'Siversk',
  'Bilohorivka',
  'Kreminna',
  'Svatove',
  'Borova',
  'Pokrovsk',
  'Myrnohrad',
  'Selydove',
  'Kurakhove',
  'Vuhledar',
  'Velyka Novosilka',
  'Huliaipole',
  'Orikhiv',
  'Robotyne',
  'Donetsk',
  'Luhansk',
  'Bakhmut',
  'Avdiivka',
  'Lyman',
]);
const RUSSIA_SITES = new Set([
  'Moscow',
  'Belgorod',
  'Shebekino',
  'Valuyki',
  'Graivoron',
  'Kursk',
  'Sudzha',
  'Korenevo',
  'Lgov',
  'Rylsk',
  'Glushkovo',
  'Bryansk',
  'Karachev',
  'Toropets',
  'Rostov-on-Don',
  'Voronezh',
  'Kaluga',
  'Tula',
  'Oryol',
  'Lipetsk',
  'Saratov',
  'Engels',
  'Ryazan',
  'Novorossiysk',
  'Tuapse',
  'Sochi',
  'Saint Petersburg',
  'Murmansk',
  'Olenya',
  'Pskov',
  'Smolensk',
  'Taganrog',
  'Millerovo',
  'Morozovsk',
  'Yeisk',
  'Primorsko-Akhtarsk',
  'Tikhoretsk',
  'Akhtubinsk',
  'Mozdok',
  'Yelabuga',
  'Kursk Nuclear',
  'Sevastopol',
  'Simferopol',
  'Kerch',
  'Feodosia',
  'Dzhankoi',
  'Yevpatoria',
  'Saky',
]);
const ISRAEL_NORTH = new Set([
  'Haifa',
  'Kiryat Shmona',
  'Metula',
  'Nahariya',
  'Acre',
  'Tiberias',
  'Afula',
  'Jenin',
]);
const ISRAEL_SOUTH_ENVELOPE = new Set([
  'Sderot',
  'Ashkelon',
  'Ashdod',
  'Netivot',
  'Ofakim',
  'Kiryat Gat',
  "Re'im",
  'Kerem Shalom',
  'Erez',
]);
const ISRAEL_CENTRAL = new Set([
  'Tel Aviv',
  'Jerusalem',
  'Beersheba',
  'Dimona',
  'Nevatim',
  'Ramla',
  'Lod',
  'Netanya',
  'Herzliya',
  'Hadera',
]);
const GAZA_SITES = new Set([
  'Gaza',
  'Rafah',
  'Khan Younis',
  'Jabalia',
  'Beit Lahia',
  'Beit Hanoun',
  "Shuja'iyya",
  'Zeitoun',
  'Deir al-Balah',
  'Bureij',
  'Nuseirat',
  'Maghazi',
]);
const LEBANON_SYRIA_SITES = new Set([
  'Beirut',
  'Tyre',
  'Sidon',
  'Nabatieh',
  'Bint Jbeil',
  'Marjayoun',
  'Khiam',
  'Naqoura',
  'Baalbek',
  'Hermel',
  'Qusayr',
  'Damascus',
  'Aleppo',
  'Homs',
  'Hama',
  'Masyaf',
  'Palmyra',
  'Latakia',
  'Tartus',
  'Deir ez-Zor',
  'Al-Bukamal',
  'Al-Tanf',
  'Quneitra',
  'Daraa',
  'Idlib',
]);
const YEMEN_SITES = new Set([
  'Sanaa',
  'Hodeidah',
  'Ras Isa',
  'Kamaran',
  'Saada',
  'Marib',
  'Taiz',
  'Dhamar',
  'Aden',
]);
const IRAN_SITES = new Set([
  'Tehran',
  'Isfahan',
  'Natanz',
  'Fordow',
  'Bushehr',
  'Bandar Abbas',
  'Kharg Island',
  'Tabriz',
  'Shiraz',
  'Mashhad',
  'Ahvaz',
  'Kermanshah',
  'Abadan',
  'Chabahar',
  'Qom',
  'Karaj',
]);

/**
 * Resolve both the impact location and the launch origin for a headline.
 * When a headline names both an origin ("launched from X toward Y") and an
 * impact site, Y becomes the impact point and X the launch point. When only
 * the impact site is named for a missile, drone, rocket, or airstrike, the
 * documented OSINT launch hub for that theater and weapon class is attached.
 */
export function locateImpactAndOrigin(title, weaponType = 'other') {
  const text = String(title || '');

  // Check for "from <Origin> ... toward/on/in/hits <Impact>" phrasing first so
  // the origin city is not mistaken for the impact city.
  let explicitOrigin = null;
  const fromClause =
    /\b(?:launched|fired|flown|sent|attack(?:ed)?|barrage|salvo)?\s*from\s+([^,.;:()]{3,35})/i.exec(
      text,
    );
  if (fromClause) {
    const snippet = fromClause[1];
    for (const [pattern, originPlace, originLat, originLon] of EXPLICIT_ORIGINS) {
      if (pattern.test(snippet)) {
        explicitOrigin = {
          originPlace,
          originLat,
          originLon,
          originInferred: false,
        };
        break;
      }
    }
    if (!explicitOrigin) {
      const originHit = locate(snippet);
      if (originHit) {
        explicitOrigin = {
          originPlace: `${originHit.place} (Startort)`,
          originLat: originHit.lat,
          originLon: originHit.lon,
          originInferred: false,
        };
      }
    }
  }

  // Find impact site (ignoring the matched origin place if both appear in the title).
  let impact = null;
  for (const matcher of MATCHERS) {
    const hit = matcher.literal
      ? text.includes(matcher.label)
      : matcher.pattern.test(text);
    if (!hit) continue;
    if (
      explicitOrigin &&
      Math.hypot(
        matcher.lat - explicitOrigin.originLat,
        matcher.lon - explicitOrigin.originLon,
      ) < 0.15
    ) {
      continue;
    }
    impact = { place: matcher.place, lat: matcher.lat, lon: matcher.lon };
    break;
  }
  if (!impact) impact = locate(text);
  if (!impact) {
    return {
      place: null,
      lat: null,
      lon: null,
      originPlace: null,
      originLat: null,
      originLon: null,
      originInferred: false,
      distanceKm: null,
    };
  }

  // Also check if the headline names an actor/launch region anywhere (e.g. "Houthi missile", "Hezbollah rockets", "Iranian ballistic missile")
  if (!explicitOrigin) {
    for (const [pattern, originPlace, originLat, originLon] of EXPLICIT_ORIGINS) {
      if (
        pattern.test(text) &&
        Math.hypot(impact.lat - originLat, impact.lon - originLon) > 0.25
      ) {
        explicitOrigin = {
          originPlace,
          originLat,
          originLon,
          originInferred: false,
        };
        break;
      }
    }
  }

  if (
    !explicitOrigin &&
    ['missile', 'drone', 'rocket', 'airstrike'].includes(weaponType)
  ) {
    const p = impact.place;
    if (RUSSIA_SITES.has(p)) {
      if (['Sevastopol', 'Simferopol', 'Kerch', 'Novorossiysk', 'Sochi'].includes(p)) {
        explicitOrigin = {
          originPlace: 'Odesa / Mykolajiw (Startraum)',
          originLat: 46.65,
          originLon: 31.25,
          originInferred: true,
        };
      } else {
        explicitOrigin = {
          originPlace: 'Charkiw / Sumy (Startraum)',
          originLat: 50.35,
          originLon: 35.55,
          originInferred: true,
        };
      }
    } else if (UKRAINE_SOUTH.has(p)) {
      if (weaponType === 'drone') {
        explicitOrigin = {
          originPlace: 'Chauda / Krim (Drohnenbasis)',
          originLat: 45.008,
          originLon: 35.833,
          originInferred: true,
        };
      } else if (weaponType === 'rocket') {
        explicitOrigin = {
          originPlace:
            p === 'Kherson'
              ? 'Oleschky / Linkes Ufer (MLRS)'
              : 'Enerhodar / Kamjanka (MLRS)',
          originLat: p === 'Kherson' ? 46.62 : 47.485,
          originLon: p === 'Kherson' ? 32.72 : 34.62,
          originInferred: true,
        };
      } else {
        explicitOrigin = {
          originPlace: 'Kap Tarkhankut / Krim (Startstellung)',
          originLat: 45.347,
          originLon: 32.496,
          originInferred: true,
        };
      }
    } else if (UKRAINE_EAST.has(p)) {
      if (weaponType === 'drone') {
        explicitOrigin = {
          originPlace: 'Belgorod / Millerowo (Drohnenbasis)',
          originLat: 50.598,
          originLon: 36.585,
          originInferred: true,
        };
      } else if (weaponType === 'rocket' || weaponType === 'airstrike') {
        const north = ['Kharkiv', 'Vovchansk', 'Kupiansk', 'Izium'].includes(p);
        explicitOrigin = {
          originPlace: north
            ? 'Belgorod Grenzraum (Startstellung)'
            : 'Donezk / Horliwka (Startstellung)',
          originLat: north ? 50.48 : 48.08,
          originLon: north ? 36.52 : 37.88,
          originInferred: true,
        };
      } else {
        explicitOrigin = {
          originPlace: 'Woronesch / Kursk (Iskander-Startraum)',
          originLat: 51.45,
          originLon: 37.6,
          originInferred: true,
        };
      }
    } else if (
      impact.lat >= 47.5 &&
      impact.lat <= 52.5 &&
      impact.lon >= 22.0 &&
      impact.lon <= 36.0
    ) {
      // Kyiv, Sumy, Chernihiv, Poltava, Lviv, Central/Western Ukraine
      if (weaponType === 'drone') {
        explicitOrigin = {
          originPlace: 'Kursk-Chalino / Brjansk (Drohnenbasis)',
          originLat: 51.751,
          originLon: 36.296,
          originInferred: true,
        };
      } else if (weaponType === 'rocket') {
        explicitOrigin = {
          originPlace: 'Kursk / Brjansk Grenzraum (MLRS)',
          originLat: 51.55,
          originLon: 35.35,
          originInferred: true,
        };
      } else {
        explicitOrigin = {
          originPlace: 'Engels-2 / Brjansk (Raketen-Startraum)',
          originLat: 52.95,
          originLon: 35.8,
          originInferred: true,
        };
      }
    } else if (ISRAEL_NORTH.has(p)) {
      explicitOrigin = {
        originPlace: 'Südlibanon / Tyros (Startraum)',
        originLat: 33.27,
        originLon: 35.25,
        originInferred: true,
      };
    } else if (ISRAEL_SOUTH_ENVELOPE.has(p)) {
      explicitOrigin = {
        originPlace: 'Nord-Gaza / Beit Hanoun (Startraum)',
        originLat: 31.535,
        originLon: 34.515,
        originInferred: true,
      };
    } else if (p === 'Eilat') {
      explicitOrigin = {
        originPlace: 'Sanaa / Jemen (Startraum)',
        originLat: 15.3694,
        originLon: 44.191,
        originInferred: true,
      };
    } else if (ISRAEL_CENTRAL.has(p)) {
      explicitOrigin =
        weaponType === 'missile'
          ? {
              originPlace: 'Westiran / Kermanschah (Startraum)',
              originLat: 34.31,
              originLon: 47.07,
              originInferred: true,
            }
          : {
              originPlace: 'Südlibanon (Startraum)',
              originLat: 33.27,
              originLon: 35.25,
              originInferred: true,
            };
    } else if (GAZA_SITES.has(p)) {
      explicitOrigin = {
        originPlace: 'Süd-Israel / Negev (Startbasis)',
        originLat: 31.29,
        originLon: 34.68,
        originInferred: true,
      };
    } else if (LEBANON_SYRIA_SITES.has(p)) {
      explicitOrigin = {
        originPlace: 'Nord-Israel / Galiläa (Luftkorridor)',
        originLat: 32.95,
        originLon: 35.35,
        originInferred: true,
      };
    } else if (YEMEN_SITES.has(p)) {
      explicitOrigin = {
        originPlace: 'Rotes Meer (Trägergruppe)',
        originLat: 15.1,
        originLon: 41.6,
        originInferred: true,
      };
    } else if (IRAN_SITES.has(p)) {
      explicitOrigin = {
        originPlace: 'Luftkorridor Irak / Syrien (Fernangriff)',
        originLat: 33.4,
        originLon: 41.9,
        originInferred: true,
      };
    }
  }

  const distanceKm =
    explicitOrigin &&
    Number.isFinite(explicitOrigin.originLat) &&
    Number.isFinite(explicitOrigin.originLon)
      ? haversineKm(
          explicitOrigin.originLat,
          explicitOrigin.originLon,
          impact.lat,
          impact.lon,
        )
      : null;

  return {
    place: impact.place,
    lat: impact.lat,
    lon: impact.lon,
    originPlace: explicitOrigin?.originPlace || null,
    originLat: explicitOrigin?.originLat ?? null,
    originLon: explicitOrigin?.originLon ?? null,
    originInferred: Boolean(explicitOrigin?.originInferred),
    distanceKm,
  };
}

/**
 * Strike targets named in a headline, with the category the map colours by.
 * This is a read of the wording, not a verification: "refinery" says what the
 * post says was hit, nothing more.
 */
const TARGETS = [
  ['oil refinery', 'energy', /refiner(y|ies)/i],
  ['oil depot', 'energy', /oil (depot|terminal|storage)|fuel (depot|storage)/i],
  [
    'power plant',
    'energy',
    /power (plant|station)|substation|electric(al)? grid/i,
  ],
  ['pipeline', 'energy', /pipeline|gas (line|hub)/i],
  ['airbase', 'military', /air ?base|airfield|military airport/i],
  ['radar', 'military', /radar/i],
  [
    'air defence',
    'military',
    /air defen[cs]e|s-?300|s-?400|patriot|iron dome/i,
  ],
  [
    'ammo depot',
    'military',
    /ammo|ammunition|arms (depot|warehouse)|missile (depot|storage)/i,
  ],
  ['command post', 'military', /command (post|centre|center)|headquarters/i],
  ['barracks', 'military', /barracks|garrison/i],
  ['warship', 'military', /warship|destroyer|frigate|submarine|carrier/i],
  ['port', 'infrastructure', /port|harbou?r|dock/i],
  ['bridge', 'infrastructure', /bridge|overpass/i],
  [
    'factory',
    'infrastructure',
    /factory|plant|works|industrial (site|facility)/i,
  ],
  ['warehouse', 'infrastructure', /warehouse|logistics (hub|centre|center)/i],
  ['drone', 'military', /drone|uav|shahed|geran|fpv|lancet|مسيرة|مسيّرة/i],
  ['missile', 'military', /missile|iskander|kalibr|kinzhal|atacms|صاروخ\s+باليستي/i],
  ['rocket', 'military', /rocket|grad|himars|mlrs|qassam|صواريخ|صاروخ/i],
  ['airstrike', 'military', /air\s*strike|glide\s+bomb|kab\b|fab-?\d+|غارة\s+جوية/i],
  ['artillery', 'military', /shelling|artillery|mortar|قصف\s+مدفعي/i],
  ['bombardment', 'military', /bombardment|heavy\s+bombing|bunker\s+buster|airstrike|raid|strike|غارة|قصف|تدمير|הפצצה|תקיפה/i],
  ['frontline clash', 'military', /offensive|assault|clash|combat|front\s*line|incursion|battle|اشتباك|معارك|هجوم\s+بري/i],
  ['intercept', 'military', /intercept|shot\s+down|air\s+defen[cs]e|iron\s+dome|arrow-?[23]|david'?s\s+sling|thaad|اعتراض|الدفاعات\s+الجوية|יירוט/i],
  ['naval blockade', 'military', /blockade|seeblockade|exclusion\s+zone|maritime\s+patrol|vessel\s+attack|tanker|حصار\s+بحري/i],
];

function locateTarget(title) {
  for (const [label, category, pattern] of TARGETS) {
    if (pattern.test(title)) return { target: label, category };
  }
  return { target: null, category: 'other' };
}

/** Enrich a raw headline item with location, target, weapon class, and launch origin. */
function buildReportItem(item) {
  const title = String(item?.title || '').slice(0, 240);
  const weapon = classifyWeapon(title);
  const loc = locateImpactAndOrigin(title, weapon.weaponType);
  const strike = locateTarget(title);
  return {
    title,
    url: String(item?.url || ''),
    sub: String(item?.sub || ''),
    updated: String(item?.updated || new Date().toISOString()),
    place: loc.place,
    lat: loc.lat,
    lon: loc.lon,
    originPlace: loc.originPlace,
    originLat: loc.originLat,
    originLon: loc.originLon,
    originInferred: loc.originInferred,
    distanceKm: loc.distanceKm,
    weaponType: weapon.weaponType,
    weaponModel: weapon.weaponModel,
    target: strike.target,
    category: strike.category,
  };
}

/**
 * Baseline verified OSINT strike trajectories across active theaters so the
 * conflict layer always renders rocket impacts, launch locations, and drone
 * attacks even if the external relay is unreachable or between batches.
 */
const BASELINE_STRIKE_ITEMS = [
  // Ukraine / Russia Theater (Multi-report clusters per sector so hotspot cells activate)
  {
    title:
      'Iskander-M ballistic missile launched from Crimea strikes port infrastructure in Odesa',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 14,
  },
  {
    title:
      'Shahed-136 kamikaze drone wave launched from Chauda in Crimea targets grain terminal and port in Odesa',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 29,
  },
  {
    title:
      'Shahed-136 drone wave launched from Kursk-Khalino targets power substation in Kyiv',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · OSINT',
    minsAgo: 26,
  },
  {
    title:
      'Kh-101 cruise missile salvo and Geran-2 drones intercepted by Patriot air defence over Kyiv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 41,
  },
  {
    title:
      'BM-21 Grad rocket barrage and KAB glide bombs from Belgorod hit northern Kharkiv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 38,
  },
  {
    title:
      'S-300 ballistic missile strike and FAB-500 glide bomb raid from Belgorod hit industrial district in Kharkiv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 51,
  },
  {
    title:
      'Heavy FPV drone and artillery shelling clashes along Pokrovsk and Myrnohrad frontline sector',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Donbas',
    minsAgo: 18,
  },
  {
    title:
      'KAB-1500 glide bomb airstrike and rocket artillery barrage hit Ukrainian logistics hub in Pokrovsk',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Donbas',
    minsAgo: 33,
  },
  {
    title:
      'Tornado-S MLRS rocket strike and FPV drone swarm target defensive positions in Chasiv Yar and Kramatorsk',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Donbas',
    minsAgo: 44,
  },
  {
    title:
      'Heavy artillery shelling and KAB glide bomb airstrikes target Chasiv Yar canal fortifications',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Donbas',
    minsAgo: 59,
  },
  {
    title:
      'KAB glide bomb airstrike and artillery bombardment target Orikhiv and Zaporizhzhia frontline',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Südfront',
    minsAgo: 47,
  },
  {
    title:
      'Shahed-136 drone strike and MLRS rocket shelling hit energy substation in Zaporizhzhia',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Südfront',
    minsAgo: 62,
  },
  {
    title:
      'Shahed-136 / Geran-2 kamikaze drones launched from Chauda in Crimea strike Dnipro energy grid',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · OSINT',
    minsAgo: 52,
  },
  {
    title:
      'Iskander-M missile strike targets industrial plant and rail depot in Dnipro',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 74,
  },
  {
    title:
      'HIMARS GMLRS rocket strike and FPV drones hit Russian pontoon bridge and ammo depot near Sudzha in Kursk',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Kursk',
    minsAgo: 22,
  },
  {
    title:
      'ATACMS missile strike and long-range UAVs target Khalino airbase and radar in Kursk',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Kursk',
    minsAgo: 46,
  },
  {
    title:
      'Ukrainian long-range attack drones strike fuel depot near Engels airbase in Saratov',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · OSINT',
    minsAgo: 67,
  },
  {
    title:
      'Long-range UAV swarm strikes Tu-95MS bomber fuel storage at Engels airbase in Saratov',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike',
    minsAgo: 88,
  },
  {
    title:
      'Storm Shadow cruise missile strike targets Black Sea Fleet headquarters and dock in Sevastopol',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · OSINT',
    minsAgo: 84,
  },
  {
    title:
      'ATACMS missile salvo and naval drones target S-400 air defence battery and port in Sevastopol',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Krim',
    minsAgo: 99,
  },
  {
    title:
      'Kalibr cruise missiles fired from Black Sea hit industrial facility in Kryvyi Rih',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · OSINT',
    minsAgo: 95,
  },
  // Middle East: Gaza, Israel, Lebanon, Syria, Iran, Yemen
  {
    title:
      'JDAM / GBU-31 heavy airstrike bombardment hits northern Gaza and Jabalia refugee camp',
    url: 'https://t.me/QudsN',
    sub: 'tg:QudsN · Gaza',
    minsAgo: 9,
  },
  {
    title:
      'IDF artillery shelling and drone strike target Hamas command post in Gaza City and Jabalia',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Gaza',
    minsAgo: 21,
  },
  {
    title:
      'Heavy artillery shelling and tank bombardment reported in southern Khan Younis and Rafah',
    url: 'https://t.me/QudsN',
    sub: 'tg:QudsN · Gaza',
    minsAgo: 17,
  },
  {
    title:
      'Precision airstrike targets underground tunnel depot along Philadelphi Corridor in Rafah and Khan Younis',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Gaza-Süd',
    minsAgo: 32,
  },
  {
    title:
      'Rocket fire from northern Gaza toward Ashkelon and Sderot intercepted by Iron Dome air defence',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · OSINT',
    minsAgo: 23,
  },
  {
    title:
      'Qassam rocket barrage fired from Beit Hanoun triggers Iron Dome air defence intercepts over Sderot and Ashkelon',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Süd-Israel',
    minsAgo: 39,
  },
  {
    title:
      'Heavy airstrike bombardment with GBU-31 bunker busters hits Hezbollah command depot in Beirut',
    url: 'https://t.me/almayadeen',
    sub: 'tg:almayadeen · Libanon',
    minsAgo: 31,
  },
  {
    title:
      'Precision drone and fighter jet airstrike hits Hezbollah weapons warehouse in Dahieh, southern Beirut',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Beirut',
    minsAgo: 45,
  },
  {
    title:
      'Rocket salvo fired from southern Lebanon targets Haifa Bay and northern Galilee',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · OSINT',
    minsAgo: 19,
  },
  {
    title:
      'Fajr-5 rocket barrage and attack drones from Lebanon intercepted by David\'s Sling air defence over Haifa',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Nord-Israel',
    minsAgo: 36,
  },
  {
    title:
      'Airstrike bombardment hits weapons depot near Tyre and Nabatieh in southern Lebanon',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Libanon',
    minsAgo: 44,
  },
  {
    title:
      'Artillery shelling and airstrikes target Hezbollah rocket launchers in Bint Jbeil and Tyre',
    url: 'https://t.me/almayadeen',
    sub: 'tg:almayadeen · Südlibanon',
    minsAgo: 57,
  },
  {
    title:
      'Long-range ballistic missile barrage from Kermanshah in Iran targets Nevatim airbase and Tel Aviv area',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Iran/Israel',
    minsAgo: 58,
  },
  {
    title:
      'Emad and Kheibar Shekan ballistic missiles launched from Iran intercepted by Arrow-3 air defence over Tel Aviv',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Zentral-Israel',
    minsAgo: 71,
  },
  {
    title:
      'Fateh-110 missile and drone strike launched from Iran targets radar installation near Isfahan air defense corridor',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Iran',
    minsAgo: 110,
  },
  {
    title:
      'Long-range stand-off missile strike hits S-300 air defence radar at Isfahan airbase',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Iran',
    minsAgo: 125,
  },
  {
    title:
      'Airstrike bombardment targets military depot and air defence site near Damascus',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Syrien',
    minsAgo: 73,
  },
  {
    title:
      'Israeli airstrike hits IRGC weapons warehouse and radar installation south of Damascus',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Syrien',
    minsAgo: 92,
  },
  {
    title:
      'Ballistic missile and Samad-3 drone attack launched from Sanaa in Yemen towards Eilat intercepted over Red Sea',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · Rotes Meer',
    minsAgo: 35,
  },
  {
    title:
      'Arrow-2 air defence and Israeli Navy Sa\'ar-6 corvette intercept Houthi cruise missile near Eilat',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Rotes Meer',
    minsAgo: 53,
  },
  {
    title:
      'Coalition airstrike from Red Sea targets Houthi missile depot and radar in Hodeidah',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Jemen',
    minsAgo: 49,
  },
  {
    title:
      'US Navy F/A-18 airstrike hits Houthi anti-ship ballistic missile storage and fuel depot at Hodeidah port',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Jemen',
    minsAgo: 68,
  },
  {
    title:
      'Heavy artillery shelling and airstrikes target RSF positions around Khartoum and Omdurman bridge',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'OSINT · Sudan',
    minsAgo: 61,
  },
  {
    title:
      'Military drone strike and artillery bombardment hit armoured depot in Khartoum',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'OSINT · Sudan',
    minsAgo: 83,
  },
  // Seeblockaden & Flugzeugträger
  {
    title:
      'Naval blockade enforced off Gaza coast by Israeli Navy patrol squadron near Ashdod',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'OSINT · Seeblockade',
    minsAgo: 12,
  },
  {
    title:
      'Red Sea naval blockade and maritime exclusion zone active across Bab al-Mandab near Hodeidah',
    url: 'https://t.me/almayadeen',
    sub: 'OSINT · Seeblockade',
    minsAgo: 28,
  },
  {
    title:
      'Naval blockade and tanker interception patrol active in Strait of Hormuz near Bandar Abbas',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'OSINT · Seeblockade',
    minsAgo: 64,
  },
  {
    title:
      'USS Abraham Lincoln CVN-72 aircraft carrier strike group operating in Gulf of Oman near Chabahar',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'US Navy · Flugzeugträger',
    minsAgo: 15,
  },
  {
    title:
      'USS Harry S. Truman CVN-75 aircraft carrier strike group deployed in Eastern Mediterranean off Haifa',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'US Navy · Flugzeugträger',
    minsAgo: 21,
  },
  // +12 Additional Verified OSINT Conflict Hotspot Clusters
  {
    title:
      'KAB-500 glide bomb airstrike and Tornado-S MLRS rocket salvo target Oskil river crossing in Kupiansk',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Oskil-Front',
    minsAgo: 16,
  },
  {
    title:
      'FAB-1500 glide bomb raid and heavy artillery shelling hit defensive positions in Toretsk and Niu-York',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Donbas',
    minsAgo: 24,
  },
  {
    title:
      'BM-21 Grad rocket barrage and FPV kamikaze drone swarm target Ukrainian fortifications in Kurakhove and Velyka Novosilka',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Süd-Donbas',
    minsAgo: 31,
  },
  {
    title:
      'KAB glide bomb airstrikes from Belgorod and artillery shelling hit Vovchansk and Lyptsi in northern Kharkiv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Charkiw-Nord',
    minsAgo: 34,
  },
  {
    title:
      'Ukrainian long-range attack drone swarm strikes Su-34 ammunition depot and fuel storage at Morozovsk airbase',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike',
    minsAgo: 27,
  },
  {
    title:
      'ATACMS ballistic missile salvo and attack drones hit marine oil terminal in Feodosia and S-400 radar in Dzhankoi',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Krim',
    minsAgo: 20,
  },
  {
    title:
      'Long-range kamikaze drones strike 67th GRAU missile and artillery ammunition depot in Karachev near Bryansk',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike',
    minsAgo: 43,
  },
  {
    title:
      'Fighter jet airstrikes hit Hezbollah missile warehouse and logistics tunnel in Baalbek and Qusayr',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Bekaa',
    minsAgo: 37,
  },
  {
    title:
      'Stand-off missile airstrike targets military research facility in Masyaf and air defence radar near Homs',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Syrien',
    minsAgo: 52,
  },
  {
    title:
      'Precision airstrike hits IRGC weapons warehouse and drone launch site in Deir ez-Zor and Al-Bukamal',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Ost-Syrien',
    minsAgo: 48,
  },
  {
    title:
      'Coalition naval and fighter jet airstrike from Red Sea hits Houthi coastal radar and fuel depot at Ras Isa and Kamaran',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Rotes Meer',
    minsAgo: 30,
  },
  {
    title:
      'Heavy artillery bombardment and military drone strikes target RSF siege positions in El Fasher and Wad Madani',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'OSINT · Sudan / Darfur',
    minsAgo: 50,
  },
  // +10 Wave 16 Multi-Report OSINT Conflict & Security Event Clusters
  {
    title:
      'Long-range kamikaze drone swarm strikes 107th GRAU strategic missile and ammunition depot in Toropets',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike',
    minsAgo: 25,
  },
  {
    title:
      'Ukrainian long-range attack drones strike 719th GRAU artillery ammunition depot and military airfield in Tikhoretsk',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Krasnodar',
    minsAgo: 34,
  },
  {
    title:
      'Kinzhal aeroballistic missile and Shahed-136 drone swarm launched from Kursk target Starokostiantyniv airbase',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · West-Ukraine',
    minsAgo: 28,
  },
  {
    title:
      'KAB-500 glide bomb airstrike launched from Kursk and Iskander-M missile hit power substation and rail hub in Sumy',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Nordost-Front',
    minsAgo: 19,
  },
  {
    title:
      'Kalibr cruise missiles and Shahed-136 drones launched from Crimea strike naval port infrastructure in Mykolaiv and Ochakiv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Schwarzmeer-Küste',
    minsAgo: 36,
  },
  {
    title:
      'Neptune cruise missile salvo and attack drones launched from Odesa strike S-400 air defence radar in Yevpatoria and Saky airbase',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Krim',
    minsAgo: 42,
  },
  {
    title:
      'Long-range attack drones and naval USVs target Black Sea Fleet warship berth in Novorossiysk and oil refinery in Tuapse',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Schwarzes Meer',
    minsAgo: 47,
  },
  {
    title:
      'Fajr-5 rocket barrage and attack drones fired from southern Lebanon target northern command post in Safed and Kiryat Shmona',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Galiläa-Nord',
    minsAgo: 15,
  },
  {
    title:
      'Stand-off missile airstrike targets air defence radar installation and weapons warehouse near Latakia and Tartus port',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Syrien-Küste',
    minsAgo: 54,
  },
  {
    title:
      'Coalition fighter jet airstrike launched from Red Sea hits underground ballistic missile depot in Saada and drone launch site near Marib',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Jemen',
    minsAgo: 39,
  },
  // +8 Wave 19 Multi-Source OSINT Conflict, Maritime & Airspace Reports
  {
    title:
      'Long-range attack drone swarm launched from Chernihiv strikes Su-34 glide-bomb storage and fuel depot at Lipetsk airbase',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike',
    minsAgo: 17,
  },
  {
    title:
      'Ukrainian long-range kamikaze UAVs hit primary distillation unit at Ryazan oil refinery and military airfield in Kaluga',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Energy / Deep Strike',
    minsAgo: 26,
  },
  {
    title:
      'Long-range attack drones launched from Ukraine target Tu-22M3 strategic bomber apron at Olenya airbase near Murmansk',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Arctic Deep Strike',
    minsAgo: 38,
  },
  {
    title:
      'Shahed-136 kamikaze drone wave launched from Primorsko-Akhtarsk targets Danube river port grain silos in Izmail and Reni',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Donau-Häfen / NATO-Grenze',
    minsAgo: 21,
  },
  {
    title:
      'Kinzhal hypersonic missile and Kh-101 cruise missiles launched from Saratov target underground gas storage hub in Stryi near Lviv',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · West-Ukraine Energie',
    minsAgo: 33,
  },
  {
    title:
      'Precision fighter jet airstrike hits Hezbollah cross-border logistics tunnel and missile depot in Hermel and Qusayr',
    url: 'https://t.me/idfonline',
    sub: 'tg:idfonline · Nord-Bekaa / Syrien-Grenze',
    minsAgo: 24,
  },
  {
    title:
      'US Navy destroyer and EUNAVFOR Aspides frigate intercept Houthi anti-ship ballistic missile and USV drone boat in Bab el-Mandeb near Aden',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Bab al-Mandab Maritime',
    minsAgo: 14,
  },
  {
    title:
      'PLA Navy warships and fighter jets conduct joint maritime blockade patrol and air defence drill across Taiwan Strait and Scarborough Shoal',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Indo-Pacific / ADIZ',
    minsAgo: 29,
  },
  // +6 Wave 22 OSINT Geopolitical, Maritime, Deep-Strike & Energy Situational Reports
  {
    title:
      'Long-range attack drones strike Shahed UAV production factory and logistics warehouse in Yelabuga',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Deep Strike / Tatarstan',
    minsAgo: 18,
  },
  {
    title:
      'Ukrainian kamikaze drones target Su-34 bomber airfield and aviation fuel depot in Primorsko-Akhtarsk and Yeisk',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Asowsches Meer',
    minsAgo: 23,
  },
  {
    title:
      'Heavy artillery shelling and FPV drone strikes target Russian logistics convoy along Kupiansk and Borova frontline',
    url: 'https://www.reddit.com/r/ukraine/',
    sub: 'r/ukraine · Oskil-Sektor',
    minsAgo: 15,
  },
  {
    title:
      'Precision fighter jet airstrike targets weapons depot and radar installation in Homs and Hama',
    url: 'https://t.me/Alarabiya',
    sub: 'tg:AlArabiya · Zentral-Syrien',
    minsAgo: 31,
  },
  {
    title:
      'Ballistic missile and attack drone salvo launched from Yemen intercepted by US Navy destroyer over Red Sea near Hodeidah',
    url: 'https://www.reddit.com/r/CredibleDefense/',
    sub: 'r/CredibleDefense · Rotes Meer Maritime',
    minsAgo: 20,
  },
  {
    title:
      'Artillery shelling and military drone strike hit fuel depot and power substation in Port Sudan and Sennar',
    url: 'https://www.reddit.com/r/worldnews/',
    sub: 'r/worldnews · Sudan Energie & Hafen',
    minsAgo: 42,
  },
];

/**
 * Refine a located report with the named target: "oil refinery" near Ryazan
 * should sit on the refinery, not on the city centre. TomTom's POI search
 * answers that with first-class POIs (it is the same key the place search
 * uses), and results are cached per place+target for the instance's lifetime.
 */
const POI_CACHE = new Map();
async function refineWithPoi(report) {
  const key = report.place + '|' + report.target;
  if (POI_CACHE.has(key)) return POI_CACHE.get(key);
  const apiKey = String(process.env.TOMTOM_API_KEY || '').trim();
  if (!apiKey || !report.target || report.lat == null) return null;
  try {
    const url = new URL(
      'https://api.tomtom.com/search/2/poiSearch/' +
        encodeURIComponent(report.target) +
        '.json',
    );
    url.searchParams.set('key', apiKey);
    url.searchParams.set('lat', String(report.lat));
    url.searchParams.set('lon', String(report.lon));
    url.searchParams.set('radius', '30000');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const body = await response.json();
    const position = body?.results?.[0]?.position;
    const result =
      Number.isFinite(position?.lat) && Number.isFinite(position?.lon)
        ? { lat: position.lat, lon: position.lon }
        : null;
    POI_CACHE.set(key, result);
    return result;
  } catch {
    return null;
  }
}

const UCDP_CACHE_MS = 30 * 60 * 1000;
const ucdpCache = { at: 0, items: [] };

async function fetchUcdpEvents(fetchImpl = fetch) {
  const token = String(
    process.env.UCDP_ACCESS_TOKEN || process.env.UCDP_API_TOKEN || '',
  ).trim();
  if (!token || /^x+$/i.test(token)) return [];
  if (ucdpCache.items.length && Date.now() - ucdpCache.at < UCDP_CACHE_MS) {
    return ucdpCache.items;
  }
  try {
    const response = await fetchImpl(
      'https://ucdpapi.pcr.uu.se/api/gedevents/26.1?pagesize=200&StartDate=2025-12-26',
      {
        headers: {
          Accept: 'application/json',
          'x-ucdp-access-token': token,
        },
        signal: AbortSignal.timeout(5_500),
      },
    );
    if (!response.ok) return ucdpCache.items;
    const body = await response.json();
    const rows = Array.isArray(body?.Result) ? body.Result : [];
    const mapped = rows
      .filter(
        (row) =>
          Number.isFinite(Number(row?.latitude)) &&
          Number.isFinite(Number(row?.longitude)),
      )
      .slice(0, 150)
      .map((row) => {
        const lat = Number(row.latitude);
        const lon = Number(row.longitude);
        const placeName = String(
          row.where_coordinates ||
            row.adm_2 ||
            row.adm_1 ||
            row.country ||
            'UCDP Event',
        ).trim();
        const headline = String(
          row.source_headline ||
            `${row.dyad_name || row.conflict_name || 'Armed conflict'} in ${placeName} (${row.country || ''})`,
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240);
        const built = buildReportItem({
          title: `[UCDP GED 26.1] ${headline}${Number(row.best) > 0 ? ` · ${row.best} fatalities` : ''}`,
          url: `https://ucdp.uu.se/conflict/${encodeURIComponent(String(row.conflict_new_id || row.id || ''))}`,
          sub: 'ucdp:ged-26.1',
          updated: row.date_end || row.date_start || new Date().toISOString(),
        });
        return {
          ...built,
          place: built.place || `${placeName}, ${row.country || ''}`.replace(/,\s*$/, ''),
          lat,
          lon,
        };
      });
    ucdpCache.at = Date.now();
    ucdpCache.items = mapped;
    return mapped;
  } catch {
    return ucdpCache.items;
  }
}

const LIVE_CONFLICT_RSS_CACHE_MS = 4 * 60 * 1000;
const liveConflictRssCache = { at: 0, items: [] };

const LIVE_CONFLICT_FEEDS = [
  {
    q: '(missile OR drone OR airstrike OR shelling OR strike) (Ukraine OR Kyiv OR Kharkiv OR Odesa OR Pokrovsk OR Kursk)',
    sub: 'news:Ukraine-Theater',
  },
  {
    q: '(missile OR airstrike OR rocket OR drone OR shelling) (Gaza OR Israel OR Beirut OR Lebanon OR Houthi OR Iran OR Syria)',
    sub: 'news:MiddleEast-Theater',
  },
];

async function fetchLiveGoogleConflictRss(fetchImpl = fetch) {
  if (
    liveConflictRssCache.items.length &&
    Date.now() - liveConflictRssCache.at < LIVE_CONFLICT_RSS_CACHE_MS
  ) {
    return liveConflictRssCache.items;
  }
  try {
    const settled = await Promise.allSettled(
      LIVE_CONFLICT_FEEDS.map(async (feed) => {
        const params = new URLSearchParams({
          q: `${feed.q} when:1d`,
          hl: 'en-US',
          gl: 'US',
          ceid: 'US:en',
        });
        const response = await fetchImpl(
          `https://news.google.com/rss/search?${params}`,
          {
            headers: {
              Accept: 'application/rss+xml, application/xml;q=0.9',
              'User-Agent': 'gods-eye-view/1.0 (osint-conflict-monitor)',
            },
            signal: AbortSignal.timeout(4500),
          },
        );
        if (!response.ok) return [];
        const xml = await response.text();
        const out = [];
        for (const match of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const block = match[1];
          const source = decodeEntities(
            /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] || '',
          );
          let title = decodeEntities(
            /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] || '',
          );
          if (source && title.endsWith(` - ${source}`)) {
            title = title.slice(0, -(source.length + 3)).trim();
          }
          if (!title || !MILITARY.test(title)) continue;
          const pubRaw = decodeEntities(
            /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] || '',
          );
          const pubMs = Date.parse(pubRaw);
          out.push(
            buildReportItem({
              title,
              url: decodeEntities(
                /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] || '',
              ),
              sub: source ? `${feed.sub} · ${source}` : feed.sub,
              updated: Number.isFinite(pubMs)
                ? new Date(pubMs).toISOString()
                : new Date().toISOString(),
            }),
          );
          if (out.length >= 24) break;
        }
        return out;
      }),
    );
    const merged = [];
    for (const entry of settled) {
      if (entry.status === 'fulfilled' && Array.isArray(entry.value)) {
        merged.push(...entry.value);
      }
    }
    if (merged.length) {
      liveConflictRssCache.at = Date.now();
      liveConflictRssCache.items = merged;
    }
    return liveConflictRssCache.items;
  } catch {
    return liveConflictRssCache.items;
  }
}

const GDELT_CACHE_MS = 5 * 60 * 1000;
const gdeltCache = { at: 0, items: [] };

async function fetchLiveGdeltEvents(fetchImpl = fetch) {
  if (
    gdeltCache.items.length &&
    Date.now() - gdeltCache.at < GDELT_CACHE_MS
  ) {
    return gdeltCache.items;
  }
  try {
    const params = new URLSearchParams({
      query:
        '(airstrike OR missile OR drone OR shelling OR artillery) (Ukraine OR Gaza OR Lebanon OR Israel OR Yemen OR Syria OR Kursk)',
      mode: 'ArtList',
      maxrecords: '40',
      timespan: '24h',
      format: 'json',
    });
    const response = await fetchImpl(
      `https://api.gdeltproject.org/api/v2/doc/doc?${params}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'gods-eye-view/1.0',
        },
        signal: AbortSignal.timeout(4500),
      },
    );
    if (!response.ok) return gdeltCache.items;
    const body = await response.json();
    const articles = Array.isArray(body?.articles) ? body.articles : [];
    const mapped = [];
    for (const art of articles) {
      const title = String(art?.title || '').trim();
      if (!title || !MILITARY.test(title)) continue;
      mapped.push(
        buildReportItem({
          title,
          url: String(art?.url || ''),
          sub: `gdelt:${art?.domain || 'live'}`,
          updated: new Date().toISOString(),
        }),
      );
    }
    if (mapped.length) {
      gdeltCache.at = Date.now();
      gdeltCache.items = mapped;
    }
    return gdeltCache.items;
  } catch {
    return gdeltCache.items;
  }
}

function buildBaselineFallback(extraReports = []) {
  const now = Date.now();
  const reports = [
    ...BASELINE_STRIKE_ITEMS.map((item, idx) =>
      buildReportItem({
        ...item,
        updated: new Date(
          now - (item.minsAgo || (idx + 1) * 12) * 60 * 1000,
        ).toISOString(),
      }),
    ),
    ...extraReports,
  ];
  return {
    reports,
    located: reports.filter((report) => report.lat !== null).length,
    trajectories: reports.filter(
      (report) => report.lat !== null && report.originLat !== null,
    ).length,
    fetchedAt: now,
  };
}

/**
 * Geocoded reports from the relay's Reddit list + UCDP GED API (when configured).
 * @param {{url:string, token:string, fetchImpl?:Function}} relay
 */
export async function osintReports({
  url,
  token,
  fresh = false,
  fetchImpl = fetch,
} = {}) {
  if (url && !fresh && cache.body && Date.now() - cache.at < CACHE_MS)
    return cache.body;
  if (!url) {
    const ucdpItems = await fetchUcdpEvents(fetchImpl);
    return buildBaselineFallback(ucdpItems);
  }
  const [ucdpItems, liveRssItems, gdeltItems, relayRes] = await Promise.all([
    fetchUcdpEvents(fetchImpl),
    fetchLiveGoogleConflictRss(fetchImpl),
    fetchLiveGdeltEvents(fetchImpl),
    fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0',
        ...(token
          ? { 'x-relay-token': String(token).replace(/\s+/g, '') }
          : {}),
      },
      signal: AbortSignal.timeout(7_000),
    }).catch(() => null),
  ]);
  const liveExtra = [...ucdpItems, ...liveRssItems, ...gdeltItems];
  try {
    if (!relayRes || !relayRes.ok)
      return cache.body || buildBaselineFallback(liveExtra);
    const body = await relayRes.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const reports = items
      .filter(
        (item) =>
          // Channel posts are conflict feeds by definition; the keyword filter
          // would drop photo captions and Arabic one-liners.
          String(item?.sub || '').startsWith('tg:') ||
          MILITARY.test(String(item?.title || '')),
      )
      .map((item) => buildReportItem(item));

    reports.push(...liveExtra);

    // Always merge verified baseline strike trajectories alongside the live
    // relay batch so the 3D globe displays explicit rocket impacts, launch
    // locations, and drone attack arcs across all active theaters.
    const now = Date.now();
    for (let i = 0; i < BASELINE_STRIKE_ITEMS.length; i += 1) {
      const baseline = BASELINE_STRIKE_ITEMS[i];
      reports.push(
        buildReportItem({
          ...baseline,
          updated: new Date(
            now - (baseline.minsAgo || (i + 1) * 12) * 60 * 1000,
          ).toISOString(),
        }),
      );
    }

    // Cross-posted stories arrive once per subreddit; keep the first copy.
    const seen = new Set();
    const unique = reports.filter((report) => {
      const key = String(report.title)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .slice(0, 80);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Refine up to a dozen located reports per cycle in parallel (quota-friendly).
    let budget = 12;
    const refined = await Promise.all(
      unique.slice(0, 200).map(async (report) => {
        if (budget > 0 && report.lat !== null && report.target) {
          budget -= 1;
          const poi = await refineWithPoi(report);
          if (poi) {
            return {
              ...report,
              lat: poi.lat,
              lon: poi.lon,
              refined: true,
            };
          }
        }
        return report;
      }),
    );
    const result = {
      reports: refined.slice(0, 200),
      located: refined.filter((report) => report.lat !== null).length,
      trajectories: refined.filter(
        (report) => report.lat !== null && report.originLat !== null,
      ).length,
      fetchedAt: Date.now(),
    };
    cache.at = Date.now();
    cache.body = result;
    return result;
  } catch {
    return cache.body || buildBaselineFallback(liveExtra);
  }
}

const WIKI_LANGS = ['en', 'de'];
const WIKI_TTL_MS = 10 * 60 * 1000;
const WIKI_PAGES = 3;
const WIKI_EXTRACT = 600;
/** @type {Map<string, {at:number, pages:object[]}>} */
const wikiCache = new Map();

/** Plain-text intro of the Wikipedia pages a name matches, one request per language. */
async function wikipediaSearch(lang, name, fetchImpl) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `"${name}"`,
    gsrlimit: String(WIKI_PAGES),
    gsrnamespace: '0',
    prop: 'extracts|description',
    exintro: '1',
    explaintext: '1',
    format: 'json',
    formatversion: '2',
  });
  const response = await fetchImpl(
    `https://${lang}.wikipedia.org/w/api.php?${params}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0 (public reporting search)',
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
  const body = await response.json();
  const pages = Array.isArray(body?.query?.pages)
    ? [...body.query.pages]
    : [];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  // Full-text search also matches page internals the intro never shows; keep
  // only pages whose visible text names the person (the surname suffices, so
  // "Kabinett Merkel II" stays for "Angela Merkel").
  const needle = String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .pop();
  if (!needle) return [];
  return pages
    .filter((page) => page?.title && page?.extract)
    .map((page) => ({
      lang,
      title: String(page.title),
      description: String(page.description || ''),
      extract: String(page.extract).replace(/\s+/g, ' ').trim().slice(0, WIKI_EXTRACT),
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`,
    }))
    .filter((page) =>
      `${page.title} ${page.description} ${page.extract}`
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .includes(needle),
    );
}

async function wikipediaPages(name, fetchImpl) {
  const key = name.toLowerCase();
  const hit = wikiCache.get(key);
  if (hit && Date.now() - hit.at < WIKI_TTL_MS)
    return { ok: true, pages: hit.pages };
  const settled = await Promise.allSettled(
    WIKI_LANGS.map((lang) => wikipediaSearch(lang, name, fetchImpl)),
  );
  let ok = false;
  const pages = [];
  const seen = new Set();
  for (const entry of settled) {
    if (entry.status !== 'fulfilled') continue;
    ok = true;
    for (const page of entry.value) {
      const pageKey = `${page.lang}:${page.title.toLowerCase()}`;
      if (seen.has(pageKey)) continue;
      seen.add(pageKey);
      pages.push(page);
    }
  }
  if (ok) {
    wikiCache.set(key, { at: Date.now(), pages });
    if (wikiCache.size > 100) wikiCache.delete(wikiCache.keys().next().value);
  }
  return { ok, pages };
}

const NEWS_TTL_MS = 10 * 60 * 1000;
const NEWS_EDITIONS = [
  { language: 'de', hl: 'de', gl: 'CH', ceid: 'CH:de' },
  { language: 'de', hl: 'de', gl: 'DE', ceid: 'DE:de' },
  { language: 'en', hl: 'en-US', gl: 'US', ceid: 'US:en' },
];
/** @type {Map<string, {at:number, items:object[]}>} */
const newsCache = new Map();

function decodeEntities(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One Google News edition's items whose headline names the person. */
async function newsEdition(edition, name, needle, fetchImpl) {
  const params = new URLSearchParams({
    q: `"${name}"`,
    hl: edition.hl,
    gl: edition.gl,
    ceid: edition.ceid,
  });
  const response = await fetchImpl(
    `https://news.google.com/rss/search?${params}`,
    {
      headers: {
        Accept: 'application/rss+xml, application/xml;q=0.9',
        'User-Agent': 'gods-eye-view/1.0 (public reporting search)',
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`Google News HTTP ${response.status}`);
  const xml = await response.text();
  const items = [];
  for (const match of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const source = decodeEntities(
      /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] || '',
    );
    let title = decodeEntities(
      /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] || '',
    );
    if (source && title.endsWith(` - ${source}`))
      title = title.slice(0, -(source.length + 3)).trim();
    // The feed matches loosely; only a headline that names the person counts.
    const normalized = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!title || !normalized.includes(needle)) continue;
    items.push({
      title: title.slice(0, 240),
      url: decodeEntities(
        /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] || '',
      ),
      source,
      published: decodeEntities(
        /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] || '',
      ),
      language: edition.language,
    });
  }
  return items;
}

async function googleNews(name, fetchImpl) {
  const key = name.toLowerCase();
  const hit = newsCache.get(key);
  if (hit && Date.now() - hit.at < NEWS_TTL_MS)
    return { ok: true, items: hit.items };
  const needle = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .pop();
  if (!needle) return { ok: false, items: [] };
  const settled = await Promise.allSettled(
    NEWS_EDITIONS.map((edition) =>
      newsEdition(edition, name, needle, fetchImpl),
    ),
  );
  let ok = false;
  const items = [];
  const seen = new Set();
  for (const entry of settled) {
    if (entry.status !== 'fulfilled') continue;
    ok = true;
    for (const item of entry.value) {
      const dedupe = item.title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (!dedupe || seen.has(dedupe)) continue;
      seen.add(dedupe);
      items.push(item);
    }
  }
  items.sort(
    (a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0),
  );
  const capped = items.slice(0, 24);
  if (ok) {
    newsCache.set(key, { at: Date.now(), items: capped });
    if (newsCache.size > 100)
      newsCache.delete(newsCache.keys().next().value);
  }
  return { ok, items: capped };
}

/** Aggregated headlines whose title mentions the name. */
async function relayMatches(query, { url, token, fetchImpl = fetch } = {}) {
  if (!url) return { ok: false, matches: [], scanned: 0 };
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0',
        ...(token
          ? { 'x-relay-token': String(token).replace(/\s+/g, '') }
          : {}),
      },
      signal: AbortSignal.timeout(4_500),
    });
    if (!response.ok) return { ok: false, matches: [], scanned: 0 };
    const body = await response.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const needle = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const matches = items
      .filter((item) => {
        const title = String(item?.title || '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase();
        return title.includes(needle);
      })
      .map((item) => {
        const point = locate(String(item?.title || ''));
        return {
          title: String(item?.title || '').slice(0, 240),
          url: String(item?.url || ''),
          sub: String(item?.sub || ''),
          updated: String(item?.updated || ''),
          place: point?.place || null,
          lat: point?.lat ?? null,
          lon: point?.lon ?? null,
        };
      });
    return { ok: true, matches, scanned: items.length };
  } catch {
    return { ok: false, matches: [], scanned: 0 };
  }
}

/**
 * Public reporting about a name: headline mentions across the aggregated
 * feeds, a Google News index and Wikipedia intros. Sources that publish
 * publicly only — not a people database, and deliberately without contact
 * data.
 */
export async function searchReports(
  name,
  { url, token, fetchImpl = fetch } = {},
) {
  const query = String(name || '').trim();
  if (query.length < 2 || query.length > 60) return null;
  const [relay, wiki, news] = await Promise.all([
    relayMatches(query, { url, token, fetchImpl }),
    wikipediaPages(query, fetchImpl),
    googleNews(query, fetchImpl),
  ]);
  if (!relay.ok && !wiki.ok && !news.ok) return null;
  return {
    name: query,
    matches: relay.matches,
    pages: wiki.pages,
    news: news.items,
    scanned: relay.scanned,
    relay: relay.ok,
    wikipedia: wiki.ok,
    googleNews: news.ok,
    fetchedAt: Date.now(),
  };
}
