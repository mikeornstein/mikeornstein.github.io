const urls = [
  "https://cdn.jsdelivr.net/gh/mikeornstein/watch-similarity-explorer@95a8caaf88852d630737570983b51b7b1279b475/publish/watch-atlas/index-F4sjSRc0.js",
  "https://cdn.jsdelivr.net/gh/mikeornstein/watch-similarity-explorer@cursor/atlas-live-bundle-host-f2d4/publish/watch-atlas/index-F4sjSRc0.js",
  "https://rawcdn.githack.com/mikeornstein/watch-similarity-explorer/95a8caaf88852d630737570983b51b7b1279b475/publish/watch-atlas/index-F4sjSRc0.js"
];
async function load() {
  let last;
  for (const url of urls) {
    try {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) throw new Error(String(r.status));
      const txt = await r.text();
      if (txt.length < 200000) throw new Error("short");
      await import(URL.createObjectURL(new Blob([txt], { type: "text/javascript" })));
      return;
    } catch (e) { last = e; }
  }
  throw last;
}
load();
