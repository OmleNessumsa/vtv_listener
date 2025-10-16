// examples/figma-plugin-snippet.js
const FILE_KEY = "g3csnsTVDzCxVhpRy8c1Pp";
const BASE_URL = "https://<your-vercel-project>.vercel.app"; // vervang
let lastVersion = 0;

async function applyTitleMessage(title, message) {
  const titleNode = figma.getNodeById("48:67");
  const messageNode = figma.getNodeById("48:69");
  if (!titleNode || titleNode.type !== "TEXT" || !messageNode || messageNode.type !== "TEXT") {
    figma.notify("Listener: kon tekstlagen niet vinden.");
    return;
  }
  if (titleNode.hasMissingFont || messageNode.hasMissingFont) {
    figma.notify("Listener: ontbrekende fonts.");
    return;
  }
  if ("fontName" in titleNode) await figma.loadFontAsync(titleNode.fontName);
  else {
    const f1 = titleNode.getRangeAllFontNames(0, titleNode.characters.length);
    await Promise.all(f1.map(figma.loadFontAsync));
  }
  if ("fontName" in messageNode) await figma.loadFontAsync(messageNode.fontName);
  else {
    const f2 = messageNode.getRangeAllFontNames(0, messageNode.characters.length);
    await Promise.all(f2.map(figma.loadFontAsync));
  }
  titleNode.characters = title;
  messageNode.characters = message;
}

async function pollLoop() {
  try {
    const res = await fetch(`${BASE_URL}/api/last?fileKey=${FILE_KEY}&since=${Date.now()-60000}`);
    if (res.ok) {
      const data = await res.json();
      const ev = data.event;
      if (ev && ev.version > lastVersion) {
        lastVersion = ev.version;
        await applyTitleMessage(ev.title, ev.message);
        figma.notify("VTV_POST: content toegepast.");
      }
    }
  } catch (e) {
    // optioneel: logging
  } finally {
    setTimeout(pollLoop, 3000);
  }
}
pollLoop();
