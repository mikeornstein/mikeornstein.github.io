const parts = await Promise.all([0,1,2,3].map((i) =>
  fetch(new URL(`./index-F4sjSRc0.b${i}.txt`, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`b${i} ${r.status}`);
    return r.text();
  })
));
const bin = Uint8Array.from(atob(parts.join("")), (c) => c.charCodeAt(0));
await import(URL.createObjectURL(new Blob([bin], { type: "text/javascript" })));
