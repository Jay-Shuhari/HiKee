# HiKee

A desktop and mobile messenger built with React, TypeScript and Vite, with an AWS backend on Amplify Gen 2.

- **Chats:** realtime one-to-one messaging, read receipts, unread counts, presence (online and last seen), mute, and clear chat with undo.
- **Sharing:** pictures, videos, documents and audio, added from the attach menu, by drag and drop, or by pasting. Documents get rich previews: PDF pages, DOCX text, XLSX and CSV sheets, PPTX slides.
- **Voice notes:** record from the microphone, with live waveforms and a heard state.
- **Viewer:** full-screen gallery with swipe, thumbnails, keyboard navigation and download.
- **Calls:** voice and video calls, peer to peer over WebRTC. The signalling runs through AppSync.
- **Search:** finds chats, message text and document contents. In AWS mode it also finds people by name or email, so you can start new chats.
- **Themes:** flat light and dark themes with no gradients. The app follows the system setting by default; you can switch with the moon or sun button in the Chats header, or from **More → Theme**.
- **Layouts:** three columns on desktop, a narrow rail on tablets, and three pages with a tab bar on phones.

## Run locally (demo mode)

```bash
npm install
npm run dev
```

Without `amplify_outputs.json`, HiKee runs entirely in the browser with sample conversations. Sending, attachments, voice notes, previews, the viewer and downloads all work, but delivery and read receipts are simulated and nothing leaves the device.

## Run against AWS (your own cloud sandbox)

Prerequisites: an AWS account, and local AWS credentials (`aws configure sso` or an access key). See https://docs.amplify.aws/react/start/account-setup/.

```bash
npx ampx sandbox        # deploys Cognito, AppSync + DynamoDB and S3, then writes amplify_outputs.json
npm run dev             # the app detects amplify_outputs.json and switches to AWS mode
```

Create two accounts, for example in two browsers. Search for the other person's name or email in the Chats panel and pick them under **People** to start a chat.

`npx ampx sandbox delete` removes the sandbox resources.

## Deploy to AWS Amplify Hosting

1. Push this folder to a Git repository (GitHub, GitLab, Bitbucket or CodeCommit).
2. In the AWS console, open **Amplify → Create new app**, connect the repository and pick the branch.
3. Amplify uses the included `amplify.yml`. Each build deploys that branch's backend with `ampx pipeline-deploy`, generates `amplify_outputs.json`, then builds and hosts `dist/`.

Every branch gets its own isolated backend.

## What runs on AWS

| Piece | Service | Defined in |
| --- | --- | --- |
| Sign up and sign in (email + password, email codes, password reset) | Amazon Cognito | `amplify/auth/resource.ts` |
| Profiles, conversations, messages, read marks, call signals, realtime subscriptions | AWS AppSync + Amazon DynamoDB | `amplify/data/resource.ts` |
| Attachments, video posters, PDF page images | Amazon S3 | `amplify/storage/resource.ts` |

### Realtime over WebSocket

All live updates travel over **one WebSocket** to AppSync's realtime endpoint, `wss://<api-id>.appsync-realtime-api.<region>.amazonaws.com/graphql`. That covers new messages, new chats, read receipts, presence and call signalling (offer, answer, ICE and hang-up). Nothing polls for updates; the only regular request is a presence heartbeat every 45 seconds that writes your "last seen" time.

- **Server-side filtering:** AppSync filters each subscription on the server, so the socket only delivers rows whose `members` list includes you.
- **Connection badge:** the badge on the right of the "All chats" row shows the socket state: **Live** (green), **Connecting…** or **Offline**.
- **After a drop:** when the socket reconnects, HiKee fetches anything sent while it was down, because the socket doesn't replay missed events. Then it automatically resends any of your messages that failed in the meantime.

Access rules (enforced by AppSync, not by the app):

- **Chat membership:** a conversation, its messages and its call signals carry a `members` list of Cognito user IDs. Only members can read these rows or receive them over the WebSocket.
- **Fixed membership:** `members` is set when a conversation is created and can never be changed, so nobody can add or remove people later. Members can only update the conversation's last-message time and preview.
- **No impersonation:** a message's `senderId` and a call signal's `fromId` must be the caller's own ID. Messages can't be edited. The app also ignores any message whose sender isn't in the conversation.
- **Your own data:** read marks are keyed by conversation and user, and only that user can write theirs. Each user can edit only their own profile.
- **Files:** files are uploaded under `media/<identity-id>/…`. Only the owner can write there; any signed-in user can read, and the paths contain random IDs.
- **Profiles are visible:** every signed-in user can read profiles (name, email and presence), because that is how people search works.

### Message history

Opening a chat loads the latest 100 messages. Scrolling to the top loads earlier messages 50 at a time, and the view stays where it was. History stops at the point where you cleared the chat.

## Calls and TURN

Calls connect directly between the two browsers, using public STUN servers to find a route. Most home and office networks work. Some strict corporate or mobile networks need a TURN relay. To use one, set `VITE_ICE_SERVERS` (see `.env.example`); in Amplify Hosting, add it under **Environment variables**.

## Project layout

```
amplify/            AWS backend (auth, data schema, storage)
public/logo.png     HiKee logo
src/
  App.tsx           layout shell, theme and keyboard shortcuts
  styles.css        design tokens for light and dark, and all component styles
  components/       Left (media nav), Centre (header, conversation, composer, media view, calls),
                    Right (chats list and search), Viewer, overlays and the sign-in screen
  state/            zustand store and actions, voice-note playback, WebRTC calls
  data/             backend interface, AWS implementation, demo implementation, sample data
  lib/              formatting, icons, file processing (previews, waveforms), demo picture painter
reference/          the original single-file HTML this app was built from
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server |
| `npm run build` | Type-checks the app and builds it into `dist/` |
| `npm run preview` | Serves the production build |
| `npm run sandbox` | Starts a personal AWS sandbox (`ampx sandbox`) |
| `npm run icons` | Re-extracts the Streamline Flex icons used by the app |

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl/⌘ + K | Search |
| Enter | Send the message |
| Shift + Enter | New line |
| ← and → | Previous and next item in the viewer |
| Esc | Close the current popover, viewer or media view; discard a recording; end a call |
