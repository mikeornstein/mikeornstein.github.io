const parts = ["p0", "p1", "p2", "p3"];
const texts = await Promise.all(parts.map((p) =>
  fetch(new URL(`./index-F4sjSRc0.${p}.txt`, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`chunk ${p} ${r.status}`);
    return r.text();
  })
));
await import(URL.createObjectURL(new Blob(texts, { type: "text/javascript" })));
