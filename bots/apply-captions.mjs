import fs from 'node:fs';
import path from 'node:path';
import { loadIndex, saveIndex, toIndexEntry } from './lib/store.mjs';

const CAPTIONS = {
  'saxony-anhalt-parliament-elects-afd-president-and-two-vice-20261006-byok': {
    credit: 'MDR / dpa',
    de: 'Hans-Thomas Tillschneider (AfD) im Landtag von Sachsen-Anhalt in Magdeburg, wo er zum Vizepräsidenten gewählt wurde.',
    en: 'Hans-Thomas Tillschneider (AfD) in the Saxony-Anhalt state parliament in Magdeburg, where he was elected vice-president.',
    fr: 'Hans-Thomas Tillschneider (AfD) au parlement régional de Saxe-Anhalt à Magdebourg, où il a été élu vice-président.',
    es: 'Hans-Thomas Tillschneider (AfD) en el parlamento estatal de Sajonia-Anhalt en Magdeburgo, donde fue elegido vicepresidente.',
    it: 'Hans-Thomas Tillschneider (AfD) nel parlamento statale della Sassonia-Anhalt a Magdeburgo, dove è stato eletto vicepresidente.',
    pt: 'Hans-Thomas Tillschneider (AfD) no parlamento estadual da Saxônia-Anhalt em Magdeburgo, onde foi eleito vice-presidente.',
    zh: '汉斯-托马斯·蒂尔施奈德（德国选择党）在马格德堡萨克森-安哈尔特州议会中，他当选为副议长。',
    ja: 'マクデブルクのザクセン＝アンハルト州議会で副議長に選出されたハンス＝トーマス・ティルシュナイダー（AfD）。',
    ko: '마그데부르크 작센안할트 주 의회에서 부의장으로 선출된 한스토마스 틸슈나이더(AfD).',
  },
  'french-student-protests-over-school-conditions-lead-to-clashes-20261006-z0l4': {
    credit: 'AFP / Al Jazeera',
    de: 'Schülerproteste und Straßenbarrikaden gegen mangelhafte Schulbedingungen in Frankreich.',
    en: 'High school blockades and street protests over dilapidated school conditions across France.',
    fr: 'Blocages de lycées et manifestations de rue contre les conditions scolaires en France.',
    es: 'Bloqueos de institutos y protestas callejeras por las condiciones escolares en Francia.',
    it: 'Blocchi studenteschi e proteste di piazza contro il degrado delle scuole in Francia.',
    pt: 'Bloqueios escolares e protestos de rua contra as condições de ensino em França.',
    zh: '法国各地爆发针对公立学校恶劣条件的示威游行与校园封锁行动。',
    ja: 'フランス全土で学校施設の老朽化や教育環境の改善を求める高校生の抗議デモと封鎖。',
    ko: '프랑스 전역에서 열악한 교육 환경 개선을 요구하는 고등학생 시위와 학교 봉쇄.',
  },
  'nfl-suspends-two-officials-for-unprofessional-conduct-toward-players-20261006-qx99': {
    credit: 'Getty Images / ESPN',
    de: 'Arizona-Cardinals-Spieler Trey McBride auf dem Spielfeld während der NFL-Begegnung.',
    en: 'Arizona Cardinals tight end Trey McBride on the field during NFL regular season action.',
    fr: 'Le joueur des Cardinals de l’Arizona Trey McBride sur le terrain lors d’une rencontre de NFL.',
    es: 'El jugador de los Arizona Cardinals Trey McBride en el campo durante la acción de la NFL.',
    it: 'Il giocatore degli Arizona Cardinals Trey McBride in campo durante la partita NFL.',
    pt: 'O jogador dos Arizona Cardinals Trey McBride em campo durante a partida da NFL.',
    zh: '亚利桑那红雀队球员特雷·麦克布莱德在NFL常规赛比赛现场。',
    ja: 'NFL公式戦でフィールドに立つアリゾナ・カージナルスのトレイ・マクブライド選手。',
    ko: 'NFL 정규 시즌 경기 중 필드에 선 애리조나 카디널스의 트레이 맥브라이드 선수.',
  },
  'paramount-completes-110-billion-acquisition-of-warner-bros-discovery-20261006-onlk': {
    credit: 'Spiegel / Reuters',
    de: 'Paramount-Markenauftritt: Die Mega-Übernahme von Warner Bros. Discovery bündelt Hollywoods größte Filmstudios.',
    en: 'Paramount corporate branding: The mega-merger with Warner Bros. Discovery unites historic Hollywood studios.',
    fr: 'Identité visuelle de Paramount : La fusion avec Warner Bros. Discovery réunit les plus grands studios d’Hollywood.',
    es: 'Marca de Paramount: La megafusión con Warner Bros. Discovery reúne a los mayores estudios de Hollywood.',
    it: 'Marchio Paramount: La fusione con Warner Bros. Discovery unisce i più grandi studi cinematografici di Hollywood.',
    pt: 'Identidade visual da Paramount: A fusão com a Warner Bros. Discovery une os maiores estúdios de Hollywood.',
    zh: '派拉蒙品牌展示：与华纳兄弟探索公司的巨额并购合并了多家好莱坞老牌制片厂。',
    ja: 'パラマウント社のロゴ：ワーナー・ブラザース・ディスカバリーとの大型統合によりハリウッド主要スタジオが結集。',
    ko: '파라마운트 브랜드 이미지: 워너 브라더스 디스커버리와의 대형 합병으로 할리우드 주요 제작사 통합.',
  },
  'anthropic-expands-claude-startups-program-offering-free-credits-and-20261006-2g58': {
    credit: 'Getty Images / CNBC',
    de: 'Das Modell Claude von Anthropic: Erweiterung des Start-up-Förderprogramms um kostenlose API-Guthaben.',
    en: 'Anthropic Claude AI platform: Expansion of the startup initiative offering credits and model access.',
    fr: 'Plateforme Claude d’Anthropic : Extension du programme destiné aux start-ups avec des crédits API offerts.',
    es: 'Plataforma Claude de Anthropic: Ampliación del programa para empresas emergentes con créditos gratuitos.',
    it: 'Piattaforma Claude di Anthropic: Espansione del programma per startup con crediti API inclusi.',
    pt: 'Plataforma Claude da Anthropic: Expansão do programa de apoio a startups com créditos de API gratuitos.',
    zh: 'Anthropic Claude 人工智能平台：针对初创企业的资助计划全面扩展，提供免费 API 额度。',
    ja: 'AnthropicのAI「Claude」：無料APIクレジットを提供するスタートアップ支援プログラムの拡充。',
    ko: 'Anthropic의 Claude AI 플랫폼: 무료 API 크레딧을 제공하는 스타트업 지원 프로그램 확대.',
  },
};

const ARTICLES_DIR = 'content/articles';
const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.json'));

const updatedArticles = [];

for (const f of files) {
  const filePath = path.join(ARTICLES_DIR, f);
  const art = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const meta = CAPTIONS[art.slug];
  if (!meta) continue;

  art.imageCredit = meta.credit;
  for (const [locale, caption] of Object.entries(meta)) {
    if (locale === 'credit') continue;
    if (art.locales[locale]) {
      art.locales[locale].imageCaption = caption;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(art, null, 2) + '\n');
  updatedArticles.push(art);
  console.log(`Updated captions & credit for: ${art.slug}`);
}

const index = loadIndex();
index.articles = updatedArticles.map((a) => toIndexEntry(a));
saveIndex(index);
console.log(`Saved index with updated captions!`);
