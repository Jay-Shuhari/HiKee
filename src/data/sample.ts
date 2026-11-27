/* Demo conversations used when no AWS backend is configured. */
import type { Att, Chat, Msg, MsgStatus, Preview } from './types';
import { paint, PAL } from '../lib/paint';

let uid = 1;
const M = (from: 'me' | 'them', t: number, text: string, atts: Att[] = [], status: MsgStatus = 'read'): Msg => ({ id: 'd' + uid++, from, t, text, atts, status });
const pic = (seed: number, k: string, w = 600, h = 760): Att => ({ type: 'image', src: paint(seed, w, h, PAL[k]), w, h, name: `IMG_${2400 + seed}.jpg` });
const vid = (seed: number, k: string, dur: number, name: string): Att => ({ type: 'video', poster: paint(seed, 960, 540, PAL[k]), dur, name });
const page = (title: string, pages: number, paras: string[]): Preview => ({ kind: 'page', title, pages, paras });
const pdfDoc = (name: string, size: number, title: string, pages: number, paras: string[]): Att => ({ type: 'doc', name, size, pdf: true, pv: page(title, pages, paras) });
const pageDoc = (name: string, size: number, title: string, pages: number, paras: string[]): Att => ({ type: 'doc', name, size, pv: page(title, pages, paras) });
const sheetDoc = (name: string, size: number, sheet: string, sheets: number, rows: (string | number)[][]): Att => ({ type: 'doc', name, size, pv: { kind: 'sheet', sheet, sheets, rows } });
const slidesDoc = (name: string, size: number, slides: { title: string; paras: string[] }[]): Att => ({ type: 'doc', name, size, pv: { kind: 'slides', pages: slides.length, title: slides[0].title, paras: slides[0].paras, slides } });

export function sampleChats(): Chat[] {
  const NOW = Date.now(), ago = (m: number) => NOW - m * 60000;
  return [
    { id: 'ava', name: 'Ava Thompson', color: '#e8505b', online: true, unread: 0, msgs: [
      M('them', ago(190), 'Hi! Summer in the mountains is especially beautiful — green valleys, lakes and fresh air. Here are the shots from last week’s trip ☀️', [pic(1, 'alpine'), pic(2, 'lake'), pic(3, 'dawn'), pic(4, 'autumn'), pic(5, 'meadow'), pic(6, 'night')]),
      M('me', ago(178), 'These look unreal. Which one is the lake by the hut?'),
      M('them', ago(176), 'The second one! It’s about a 40-minute walk from the cable car.'),
      M('them', ago(175), '', [{ type: 'audio', dur: 24, name: 'Voice message' }]),
      M('me', ago(120), 'Could you send me the route you took?'),
      M('them', ago(112), 'Here’s the route with all the huts marked.', [pdfDoc('Dolomites-route-2026.pdf', 2.4e6, 'Dolomites Hut-to-Hut Route, Summer 2026', 4, [
        'Day 1, Ortisei to Seceda (2,519 m). Take the cable car from Ortisei, then follow trail 1 along the ridge. Allow 40 minutes to Rifugio Firenze, where we stayed the first night.',
        'Day 2, Rifugio Firenze to Puez Hut. 6.5 km with 520 m of ascent. Refill water at Forcella Pana. Easy, well-marked terrain suited to a light activity level.',
        'Day 3, Puez Hut to Lago di Braies. Descend through Val Longia and take the 442 bus; the lake is a 15-minute walk from the stop.',
        'What to pack: warm layers, a rain shell, a hut sleeping-bag liner and cash, since not every hut takes cards. Book huts at least three weeks ahead in July and August.'])]),
      M('me', ago(21), 'Great! I’m interested in tours for the coming month with a light activity level.'),
      M('them', ago(12), 'Perfect, I’ll look for a few options and send them tonight.')] },
    { id: 'mei', name: 'Mei Lin', color: '#2a9d8f', online: true, unread: 2, msgs: [
      M('me', ago(300), 'How was the ferry ride?'),
      M('them', ago(46), 'Sunset from the ferry 🌅', [pic(11, 'coast', 640, 800), pic(12, 'dusk', 640, 800)]),
      M('them', ago(45), 'We should go back in spring.')] },
    { id: 'daniel', name: 'Daniel Okafor', color: '#4f5bd5', online: false, seen: ago(64), unread: 0, msgs: [
      M('me', ago(1500), 'Sharing the latest guidelines before the review.', [pdfDoc('Brand-guidelines-v3.pdf', 8.1e6, 'HiKee Brand Guidelines v3', 24, [
        'Logo. Keep clear space equal to the height of the mark on every side. Never place the logo on busy photography or inside a container.',
        'Colour. Indigo is reserved for actions and the active state. Surfaces are flat and quiet; text stays near-black in light mode and near-white in dark mode.',
        'Type. One family throughout, in four sizes: 13, 15, 17 and 24 pt. Semibold for names and headings, regular for everything else.',
        'Motion. Short and springy: 200 to 450 ms. Every press gets a response; nothing loops except recording and calling states.'])]),
      M('them', ago(1460), 'Thanks! Here’s the walkthrough of the new onboarding flow.', [vid(21, 'dusk', 72, 'Onboarding-walkthrough.mp4')]),
      M('them', ago(1458), '', [sheetDoc('Sprint-review.xlsx', 412e3, 'Sprint 14', 3, [['Ticket', 'Owner', 'Status', 'Points', 'Due'], ['Onboarding flow', 'Daniel', 'Done', 8, 'Nov 18'], ['Voice notes', 'Ava', 'In review', 5, 'Nov 22'], ['PDF previews', 'Mei', 'In progress', 5, 'Nov 26'], ['Search by message', 'Lucas', 'Done', 3, 'Nov 15'], ['Dark theme polish', 'Sofia', 'To do', 2, 'Nov 29'], ['Gallery downloads', 'Kemi', 'In progress', 3, 'Nov 27'], ['Total', '', '', 26, '']])]),
      M('them', ago(1457), 'And the deck for Thursday.', [slidesDoc('Q4-roadmap.pptx', 5.6e6, [{ title: 'Q4 roadmap: messaging that feels alive', paras: ['Voice notes with live waveforms', 'Rich previews for every document', 'Faster search across chats and files'] }, { title: 'What shipped in Q3', paras: ['Three-column desktop layout', 'Image gallery with downloads', 'Read receipts and heard states'] }, { title: 'Next steps', paras: ['Beta with 200 teams in December', 'Measure reply time and retention', 'Decide on group calls by January'] }])]),
      M('them', ago(95), 'Can we go over the feedback tomorrow at 10?'),
      M('me', ago(80), 'Works for me — I’ll send an invite.', [], 'delivered')] },
    { id: 'kemi', name: 'Kemi Adeyemi', color: '#e08e0b', online: false, seen: ago(180), unread: 1, msgs: [
      M('me', ago(2900), 'Did you get the drone working?'),
      M('them', ago(200), 'Finally! The shot from the beach 🌊', [vid(31, 'coast', 38, 'Beach-drone.mp4')])] },
    { id: 'lucas', name: 'Lucas Moreau', color: '#8456d8', online: false, seen: ago(1600), unread: 0, msgs: [
      M('them', ago(3000), 'View from the cabin this morning.', [pic(41, 'lake', 800, 560)]),
      M('them', ago(2998), '', [{ type: 'audio', dur: 65, name: 'Voice message' }]),
      M('me', ago(2950), 'Jealous! Enjoy the rest of the week.')] },
    { id: 'sofia', name: 'Sofia Rossi', color: '#d6336c', online: true, unread: 0, msgs: [
      M('them', ago(4400), 'Dinner on Saturday?'),
      M('me', ago(4380), 'Yes! 8pm at the usual place?'),
      M('them', ago(4375), 'See you there 🙌')] },
    { id: 'jonas', name: 'Jonas Berg', color: '#3b82c4', online: false, seen: ago(5200), unread: 0, msgs: [
      M('them', ago(5600), 'Signed copy attached.', [pageDoc('Lease-agreement.docx', 186e3, 'Residential Lease Agreement', 6, ['This agreement is made between Jonas Berg (landlord) and the tenant for the flat at 14 Harbour Lane, unit 3B, starting 1 December 2026 for a term of twelve months.', 'Rent. Monthly rent is due on the first day of each month. A late fee applies after the fifth day of the month.', 'Deposit. A deposit equal to one month’s rent is held and returned within 30 days of the end of the lease, less any agreed deductions.', 'Signed by both parties on 18 November 2026.'])]),
      M('me', ago(5590), 'Thanks Jonas, got it.')] },
  ];
}
