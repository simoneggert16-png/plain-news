async function analyzeCommentary() {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.friendly/summary?event=401921408', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  const commentary = data.commentary || [];

  const playerActions = {};

  const ensurePlayer = (name) => {
    if (!playerActions[name]) {
      playerActions[name] = {
        keyPasses: 0,
        blocks: 0,
        tackles: 0,
        interceptions: 0,
        saves: 0,
        shotsBlocked: 0,
        cornersConceded: 0,
        dribblesWon: 0,
        turnovers: 0,
        dispossessed: 0,
        offsides: 0,
        bigChancesMissed: 0
      };
    }
    return playerActions[name];
  };

  commentary.forEach(c => {
    const text = c.text || '';
    
    // Key pass / Assisted by:
    const assistMatch = text.match(/Assisted by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (assistMatch) {
      ensurePlayer(assistMatch[1]).keyPasses++;
    }

    // Attempt blocked
    const blockMatch = text.match(/Attempt blocked\. ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (blockMatch) {
      ensurePlayer(blockMatch[1]).shotsBlocked++;
    }

    // Corner conceded by
    const cornerConcededMatch = text.match(/Conceded by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (cornerConcededMatch) {
      ensurePlayer(cornerConcededMatch[1]).cornersConceded++;
    }

    // Saved by GK
    const savedMatch = text.match(/saved .*? by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (savedMatch) {
      ensurePlayer(savedMatch[1]).saves++;
    }

    // Foul won (dribble success)
    const foulWonMatch = text.match(/([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+) wins a free kick/);
    if (foulWonMatch) {
      ensurePlayer(foulWonMatch[1]).dribblesWon++;
    }

    // Offside
    const offsideMatch = text.match(/Offside, .*?\. ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+) is caught offside/);
    if (offsideMatch) {
      ensurePlayer(offsideMatch[1]).offsides++;
    }
  });

  console.log('Mined in-depth actions from commentary:');
  console.log(JSON.stringify(playerActions, null, 2));
}

analyzeCommentary();
