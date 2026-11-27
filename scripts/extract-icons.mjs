// Pulls only the Streamline Flex icons HiKee uses out of @iconify-json/streamline-flex
// into src/lib/sf-icons.json, so the full icon set never ships to the browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SFN = {
  image: 'landscape-2', video: 'camera-video', cam: 'webcam', doc: 'text-file', pdf: 'pdf-reader-application',
  audio: 'music-note-circle', media: 'polaroid-four', search: 'magnifying-glass', phone: 'phone', clip: 'paperclip-1',
  smile: 'happy-face', logout: 'logout-1', down: 'download-arrow', bellOff: 'disable-bell-notification', bell: 'bell',
  trash: 'recycle-bin-3', chats: 'chat-bubble-text-square', upload: 'upload-box-1',
};
let set;
try {
  set = JSON.parse(readFileSync(require.resolve('@iconify-json/streamline-flex/icons.json'), 'utf8'));
} catch {
  console.warn('@iconify-json/streamline-flex not installed; keeping fallback icons.');
  writeFileSync(new URL('../src/lib/sf-icons.json', import.meta.url), '{}\n');
  process.exit(0);
}
const out = {};
for (const [k, name] of Object.entries(SFN)) {
  let nm = name, ic = set.icons[nm];
  if (!ic && set.aliases?.[nm]) { nm = set.aliases[nm].parent; ic = set.icons[nm]; }
  if (ic) out[k] = { body: ic.body, w: ic.width || set.width || 16, h: ic.height || set.height || 16 };
  else console.warn('missing icon', name);
}
writeFileSync(new URL('../src/lib/sf-icons.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`Extracted ${Object.keys(out).length} icons.`);
