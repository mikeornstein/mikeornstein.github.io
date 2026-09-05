(() => {
  const parts = 3;
  Promise.all(Array.from({length: parts}, (_, i) =>
    fetch("parts/part" + i + ".js.txt").then(r => r.text())
  )).then(chunks => {
    const code = chunks.join("");
    (0, eval)(code);
  }).catch(err => {
    document.body.innerHTML = "<pre style=\"color:#c9d63a;background:#2a1c12;padding:12px\">load fail: " + err + "</pre>";
  });
})();
