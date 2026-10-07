async function run() {
  try {
    const res = await fetch('https://www.sportschau.de/fussball/adios-argentinien-letztes-laenderspiel-von-messi,messi-abschied-argentinien-100.html');
    const html = await res.text();
    const match = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
    console.log('Sportschau Image:', match ? match[1] : null);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
