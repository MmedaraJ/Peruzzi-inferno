# Peruzzi Asks

A fan experience for **Inferno**, Peruzzi's new song, whose hook asks "could this be love?". A fan writes someone a note in one sentence: "Dear ___, you ___." Something sweet they did, or something they shouldn't have. A crush, a bestie, a mum, even their bed. Peruzzi reads it at the mic in front of his crowd, tells what they did back to them as a joke, asks "Could this be love?", and answers it himself in three words at most, slyly ("Joint Account.", "Insurance Fraud."). The person it's for opens the note on their phone, on the stage with the song playing, and can write one back. Anyone can write their own.

The song's snippet plays underneath the whole time.

**For now.** The snippet, the cover and the photo on the stage are stand-ins from what was to hand, until Peruzzi's team sends the official assets (see *Before launch*).

**The look** is matte and flat, with no gradients: a deep rose-black (`#1D1418`) with two lighter surfaces (`#2C2025`, `#3B2C33`), Peruzzi's rose `#C86272` as the main colour (buttons, his question), blush `#FFCCD6` second and petal `#FDB1BF` third, and the notes on light matte blush paper (`#F5E6E9`, ink `#2B1B21`). Only the stage glows: its lights and its crowd keep the colour of a night at the show. The colours are tokens in `apps/web/src/styles.css`.

## What's where

```
apps/web    React + Vite + Tailwind: the stage, the shared pages, the admin
apps/api    NestJS + Prisma + Postgres: Peruzzi's lines, notebooks and notes, sending notes, emails, voice, insights
```

The site opens on the way in: the cover as the room's backdrop (soft and dark, so what's on it reads), the stage's lights playing over it, the cover itself as a sleeve with its record half out and turning while the song plays, the song's name, and two cards, one to stream the song and one into Peruzzi Asks. The song starts there wherever the browser allows it; a phone that wants a tap first gets the "Tap to play the music" pill, and any tap starts it, the one into the stage too, so it's playing the moment the stage opens. Each screen has its own address, so the phone's back button goes where you'd expect, and one component holds them all, so the song and the notebook carry on throughout.

| Address | Screen |
|---|---|
| `/` | the way in: the cover under the lights, the song, and Peruzzi Asks (while the stage is paused, its card says so, and the song still plays) |
| `/stage` | a note: "Dear ___, you ___.", Peruzzi's reading, and the note (`?back=<ask>` writes back to the one who sent that note; the old `/?back=` still gets there) |
| `/notes` | your notes, each with where it has got to |
| `/notes/:id` | a note already asked, to save, post or send |
| `/tracklist` | the tracklist |
| `/answer/:code` | a note sent to you: open it, and write one back |
| `/question/:code` | a note someone posted (public) |
| `/tracks/:code` | a tracklist someone posted (public) |

Back from a note's page is your notes, and back from your notes is a new note.

- **The stage.** Peruzzi in the light, seen from the back of the room: a truss across the top with six moving heads, four lights on the stage floor, the stage's front edge with its LED strip and nameplate ("Peruzzi · live"), and the crowd in front: two rows of people seen from behind (afros, braids, a gele, a cap, a bun), shoulders and arms, a few phones up, outlined in whatever colour the lights are. The show opens with the room settling and a finger on the mic, twice ("Make some noise! Who's on your mind tonight?" when the stage has a voice). The crowd reacts out loud ("Awww.", "Ooooh.", laughter, a cheer) as the notes land.
  - **The light show** (`apps/web/src/components/LightRig.tsx`, two canvases over the photo). The heads hang in their yokes and turn to where their beams go: narrow beams with soft edges through a drifting haze, brightest at the lens, with a glare on each lens, a wash on the back wall, and a warm spot on Peruzzi. The colours change every two bars (rose, blush and petal as light, against warm white, amber, magenta or violet), and the LED strip and the crowd's outlines change with them.
  - **Always on the beat, whatever the move.** Every move is a place for each head on every beat, so however the moves change, the heads land on the beat: a *swing* leaves one beat's place as the beat goes and eases into the next one's right on the next beat (with the crowd's sway); a *snap* holds, then whips across to land on the next beat. There are seven moves (all together a side a beat; fanning out on one and three and in on two and four; crossing over, every other head bright in turn; a wave rolling along the rig; a chase from the outside in; every beam on Peruzzi on the one, scattered between; fanned out, then crossed), one to each part of the song, changing on a bar's first beat. Every beat is the lights' brightest moment, each bar's first brighter still; the floor lights lean across each other a beat at a time, in every other part.
  - **The song's shape.** A new part starts at each of the song's sections and every four bars between them, with a hit of white where a section starts. For the two-beat break before the drop, the beams close in on Peruzzi and go dark but for a flash on each beat, his spot alone; the drop hits hardest.
  - The drummer's crash and the mic taps make it all jump. Before the song starts, the lights drift at half the tempo, dimmer; with reduced motion, they hold one look.
  - **On the beat.** The crowd sways left and right with the song: a lean one way on each beat and back the other way on the next, a little dip on the beat, the back row a touch behind the front. The beat is the song's own, and the crowd and the lights share it. `apps/web/src/lib/beat.ts` holds it, measured from `inferno.mp3`: 103 beats a minute, the first at 0.341 s (the drums land within 2 ms of it through the whole clip), four to a bar from the first; the sections starting on beats 8, 32, 48, 64 and 68; the break on beats 66 and 67. Measure them again if the file changes. It follows where the song is, smoothed between the audio element's readings, so the lights keep the song's time to within a few milliseconds. Before the song starts, the crowd keeps its tempo, more gently; with reduced motion, it stands still.
- **A note, in one sentence**, on the note's paper:

  > Dear \_\_\_\_\_, you \_\_\_\_\_\_\_\_\_\_.

  - Two blanks: who (a name or a role, 28 characters) and what they did (80, with a count). While they're empty, they suggest a note at a time, always something they shouldn't have done, which is more fun to read (Tobi, left me on read for three days, then liked my story; Chidi, ate my jollof and blamed the generator).
  - Nothing else on the paper: Peruzzi's question goes on the note once he has read it.
  - **Peruzzi, help me ask** at the foot of the screen hands it up. Return in the first blank goes on to the second; in the second it hands the note up.
  - With *read live* on (Admin → The stage), the note says Peruzzi could read the best notes out live.
  - Someone writing back starts with who already in: the one who sent them the note.
  - While typing, the screen is fitted to what can be seen above the keyboard: the stage slides up behind the top bar, all but its front edge and nameplate, before the keyboard is up.
- **Peruzzi reads it.** "peruzzi is reading it", over three slips: the band (a guitar strumming), Peruzzi in the middle (the mic swaying), the crowd (clapping). Above them, typed out a line at a time, what the room is up to ("The crowd wants to know who your crush is…", "Checking it's love and not just December…"), for as long as the reading takes. Then the lights come up on each of them, Peruzzi's last ("Peruzzi has it."), the drummer's crash, and the note. Peruzzi starts reading once the writer stops typing for a moment, so by the time they hand it up it's there or nearly.
- **The note on paper**, light matte blush, under "Note 0007 · Two Hours at the ATM", the cover pinned to its corner:
  - **"Dear Kemi,"** as its headline, in the paper's ink like the rest.
  - **What they did**, as Peruzzi tells it, to them: "You queued two hours at the ATM with me, then it swallowed my card."
  - **Peruzzi asks: Could this be love?** in a box of its own, in flat rose. That's all it says.
  - **Peruzzi answers**, under it, in three words at most: a sly name for what it really is, never the word love ("Joint Account.", "Insurance Fraud.", "Situationship.").
  - **"Inferno by Peruzzi"** in its bottom right corner.

  No stamp, nothing to tick, and no question at the foot: Peruzzi's box asks it. It's the story card's own paper: the page draws it with the card's code at the phone's width, so what's on screen is exactly what gets posted. What it says is also there as text for screen readers.
- **The cards.** The story card (1080×1920, to post) and the square (for link previews): the matte dark behind it, "PERUZZI ASKS" in blush over the paper, and under it the way in, "Who's on your mind?" and the address, underlined in petal.
- **Next steps.** The note is in your notes the moment it lands. Right under the paper, "Save image". Then three numbered steps:
  1. **Let Peruzzi ask:** "Send it to Kemi".
  2. **Post it:** "Put it on your story". The phone's share sheet with the story card (without one, it copies the note's link).
  3. **The song:** "Listen to Inferno by Peruzzi".

  A note to something that can't read it (a bed, jollof, Arsenal) has nobody to send to, so it starts at posting: "Bed can't read it, but everyone else can."
- **Sending it.** From and To (their name from the note), then:
  - **Send it with the card**: the phone's share sheet (WhatsApp, Instagram, iMessage…) with the note's story card, "Kemi, Adé wrote you a note, and Peruzzi is asking it for them." and the link. A phone that can't share a picture shares the message and the link; without a share sheet, they're copied.
  - **Send on WhatsApp**: the same message, "Open it:" and the link.
  - **Copy the link**, with the message, to paste anywhere.
  - **Have it emailed** (once email is set up): the writer confirms their own address with a six-digit code first, so nobody can send notes in someone else's name.

  The link is made on the address the page is on, never one the server was told, so it's never localhost. It's the key: whoever has it can open the note, and write back.
- **The note, for the person it's for.** They arrive on the stage, the song playing: "A note from Adé", "Kemi, peruzzi asked you something", the note still folded. **Open it**: the spotlight swings off the stage and lands on them, Peruzzi says "Somebody here has a question for you.", and the note comes down. Then: Save image, and next steps of their own ("Your turn: tell Adé what they did."): **Write Adé back**, post it, the song, and **Write your own note**. Coming back to the note shows it open.
  - Writing back opens a notebook of its own that knows what it answers, so Peruzzi can play off it. "Write your own note" carries on in the notebook already on that phone.
- **Your notes.** Every note so far, newest first, each with where it has got to: "Sent. Kemi hasn't opened it yet.", "Seen 9:26am.", "Kemi is writing you back." While your notes are on screen they keep up by themselves (every 15 seconds, and whenever the page comes back into view). A note that described real harm isn't among them.
- **The tracklist.** Every note is a track: the tracklist is there from the first note and grows with every one after, under a name and a city. Its card carries the latest notes with their titles. Save it, share it, or email it. The phone keeps its notebook for 30 days after the last note, so the tracklist carries on from one visit to the next.
- **When a note is serious.** A note describing abuse, violence, threats, stalking, self-harm or someone in danger: Peruzzi puts the mic down, says so plainly, and shows where to get help (the text and links are set in Admin → The stage).

**Shared links:**
- `/q/:code` is a note someone posted. Its preview names who it's for ("Someone asked Peruzzi to ask Tolu: could this be love?"), with the note's square card.
- `/a/:code` is a note sent to the person it's for. Its preview keeps the note folded: who it's for, who it's from, and the question. What it says is for them to open.
- `/t/:code` is a tracklist.

WhatsApp and similar apps read the link preview from the API, which then sends the person on into the site on the same address they opened the link on (a relative redirect), so a server that hasn't been told the site's address never sends anyone to localhost. The preview's own addresses (its picture, its link) come from `WEB_URL` and `API_URL`, or from the request when they aren't set.

**Admin (`/admin`):** one shared password, `ADMIN_PASSWORD`, traded at sign-in for a session that lasts 12 hours (the tab never keeps the password). Ten wrong passwords through one connection in a quarter of an hour and it gets no more tries until the quarter has passed.
- **Status**, above every tab: Peruzzi's lines, the voice, email, and whether the server knows the site's address (`WEB_URL` and `API_URL`, which the emails' links need).
- **Insights.** Totals only: notes, sent, opened by the one asked, written back, the way from the stage to sharing, what the notes were about (something sweet, something they shouldn't have, nonsense), the kinds of love Peruzzi named most, who the notes are for, notes per day, the busiest hours, cities, and the AI's cost.
- **Costs.** What the site has cost to run, what's been paid towards it, and what's still to pay: month by month, bill by bill, the AI as measured from every reading, the voice's credits, and projections (a month at 1,000, 10,000, 50,000 and 250,000 notes, and a calculator, with the voice reading every note or nothing). Bills and payments are set here.
- **Notes.** Every note as written, what Peruzzi made of it, where it was sent and whether it was opened, with flags (contact details taken out, a prepared line, the AI too slow, danger words) and hiding a note from its public link.
- **The stage.** Open or paused (notes already sent can still be opened and written back to while it's paused), who reads Peruzzi's words, the name on the stage, Peruzzi's humour (sweet, cheeky, spicy), *read live*, the limits, the song's volume, and the help text.
- **Site.** The artist, the song, the streaming link, the handle, and the footnotes (the concept-demo note).
- **Emails.** Edit the words, with a preview and a test send.
- **Voice.** Peruzzi's recorded lines, and the crowd's sounds.
- **People.** The email list with consent, and the notes sent (email addresses masked).

## Run it locally

You need Node 22 and Postgres.

```bash
npm install
cp apps/api/.env.example apps/api/.env      # then fill it in: DATABASE_URL, ADMIN_PASSWORD, ANTHROPIC_API_KEY
npm run prisma -w apps/api -- migrate dev    # creates the tables
npm run api                                   # http://localhost:4000
npm run web                                   # http://localhost:5173 (proxies /api, /q, /a and /t to the API)
```

- Without `ANTHROPIC_API_KEY`, Peruzzi reads with prepared lines.
- Without `RESEND_API_KEY` and a `MAIL_FROM` on a domain verified in Resend, the site hides everything that sends email (the emailed note, "Email me my tracklist"), so nothing claims to have sent. Locally, set `MAIL_DRY_RUN=1` to log emails instead; the admin's outbox (`GET /api/admin/outbox`) shows what would have gone out, and the tests need it.
- Without `ELEVENLABS_API_KEY`, there is no voice; the words are always on screen anyway.

## Peruzzi's lines (the AI)

`apps/api/src/stage/peruzzi.ts` holds Peruzzi's character and his rules. Each note is one call: the note in, his reading out.

**Character.**
- Peruzzi at the mic at his own show: the smoothest man in the building and the writer's biggest supporter, their wingman with a microphone.
- Whatever they did, sweet or annoying, he tells it back as a joke, and never the same way twice: bigger, what happened next, a short question, a dry tag, the one detail that gives it away, a turn, or official business (the police, the bank). Never a "like…" comparison, the laziest joke there is, and short: every word the joke doesn't need goes. Warm, cheeky, sly: wit, never mush (no "soulmate", no butterflies), with everyday Nigerian life where it makes the line land and at most a touch of Pidgin.
- He talks to the person the note is for: it's "you", never "he" or "she" about anyone.
- He may speak as himself at the mic, but says nothing about his own life, his relationships or his songs. The admin's humour setting comes with each note.

**The reading**, held to a schema (`output_config.format`):
- the kind: something sweet (love), something they shouldn't have (teased playfully, about what they did and never who they are), nonsense when there's nothing to read, or serious (below). It sets how the crowd takes the note (an "aww", a laugh) and the admin's insights; it isn't on the note;
- who it's to, as the note says it after "Dear" ("my crush" → "Crush"), and whether that's a thing that can never read it;
- the note's title, like a track on an album ("Last Puff-Puff"), for your notes, the tracklist and the emails;
- what they did, told back to them as a joke: starting "You", 6 to 14 words, one sentence or a sentence and a short tag, keeping the facts and the writer's side of it ("You saved me…"), so a stranger who reads only this line gets the story;
- his answer to his own question, the punchline of the note: a sly name for what it really is, in three words at most, title case, borrowed from anywhere in life (the bank, the courtroom, the hospital, the network, Lagos slang) rather than a description of what happened ("Joint Account", "Insurance Fraud", "Food Security"). Never the word "love", never a word from the note with a label stuck on ("Tupperware Love"). His last few answers go with each note, so the next one gets its own. The server holds it to three words and turns away any with "love" in it; then, or with a prepared reading, an answer that fits any note stands in ("Situationship", "Under Review", "Strong Maybe"; for a thing, "Soft Life", "Ride or Die").

The server holds the line to it (starting "You", never "I think you", a sentence and a short tag at most), whatever comes back.

**Peruzzi never:** uses full names, surnames or handles; jokes about bodies, tribe, religion, politics, sexuality, money troubles and the like; turns sexual, whatever the note says (it has to be sweet enough to read out at a family show); swears, threatens or is cruel; encourages snooping, stalking, or chasing someone who has said no; quotes lyrics or invents facts about himself.

**Serious notes.** Abuse, violence, threats, sexual assault or coercion, stalking, a child at risk, someone in danger, self-harm: Peruzzi steps out of character, there's no note and no card, and the screen shows where to get help. Exaggeration in a funny note ("you'd kill for my jollof") isn't serious. If the AI is down and the note has words that can signal real danger, it gets help rather than a prepared line.

**Speed.**
- **Read while they type.** Once both blanks are filled and the writer stops for a moment, the phone asks Peruzzi to start (`POST /api/notebooks/:id/draft`). Handing the note up picks up that reading if the words are the same (case, spacing and punctuation aside); changed words get a fresh one. Only new words get a draft, a notebook's start three seconds apart at most, twenty an hour, and none for a note the day's limits wouldn't take. A draft nobody hands up is counted on the Costs page.
- **Model.** `claude-opus-5-5` at `effort: low` by default, the one that writes the best lines (about two and a half seconds a note). Change it with `PERUZZI_MODEL`.
- **Fast mode.** `PERUZZI_SPEED=fast` runs Opus in fast mode (the Claude API only, a research preview): about twice as quick, at twice the price. If fast mode can't take a note, the standard speed does.
- **Caching.** Peruzzi's instructions are the same for every note and cached for an hour at a time: notes come in bursts, and a cold start is the slowest reading there is.
- **When the AI fails.** If it's down, too slow (9 seconds), or a reading fails the checks, a prepared one stands in (`fallback.ts`, written to fit any note), and the admin sees which notes had one. The same happens once the hour's AI readings are used up.

**Limits** (all editable in the admin):
- 10 notes per person per day.
- Per connection per day: off (0) unless set. Through the site, the API sees one of Vercel's addresses, shared by everyone near the same Vercel server, so a low number would turn real people away: it's for callers that come to the API directly.
- 600 AI readings and 1,200 drafts an hour, everyone together: what holds the AI bill. Past the readings, a prepared line stands in; past the drafts, Peruzzi starts reading when the note is handed up.
- 3 emailed notes per person per day, and a writer can email the same person once a week. Links aren't limited: the writer sends those themselves.

**Input cleaning and privacy.**
- Phone numbers, emails, links and handles are taken out before Peruzzi sees anything.
- The note as typed is kept only for the admin's moderation and wiped after 30 days. Public pages, cards and emails carry the line as Peruzzi told it (or, with a prepared reading, as written, contact details taken out).

To hear Peruzzi without the site:

```bash
npm run peruzzi:try -w apps/api     # eleven sample notes, timed (set PERUZZI_MODEL or PERUZZI_SPEED to compare)
```

**Not tried with the real AI yet.** Everything here was built and tested on the prepared lines (no API key was set): run `peruzzi:try` with a key before launch, and read what comes back.

## Sound

Everything goes through Web Audio gain nodes, because iPhones ignore an audio element's volume set from code.

- **The song** (`apps/web/public/media/audio/inferno.mp3`) loops underneath at 25% (the admin can change it), and steps down whenever the stage makes a sound or speaks. It starts the moment the site opens, on the way in or any other screen, wherever the browser allows it, and plays on from one screen to the next.
- **When it can't play by itself.** Most phones (and most browsers on a first visit) only allow sound after a tap on the page; nothing a site does gets round that. So when the song is refused, a pill asks for the tap ("Tap to play the music"), and the next tap anywhere starts it. The same pill comes back whenever the song should be playing and can't be heard: paused by something else (a call, the phone's media controls, headphones pulled out), its sound asleep, or stuck for 4 seconds on the network, when a tap loads it again from where it was. A second-a-time watch in `sound.ts` keeps an eye on it.
- **Leaving and coming back.** Leaving the page cuts all sound at once; coming back carries the song on where it was. After a tap on "Listen to Inferno", the song waits for a small pill instead, so it doesn't cut into the song playing in another app. It plays on under the share sheet.
- **The stage's sounds** are synthesised in `apps/web/src/lib/sound.ts`, so there are no files to load: a finger on the mic, the drumroll while Peruzzi reads, a swish as each light comes up, the drummer's crash, whooshes, the room's murmur, and a chime for something sweet.
- **The crowd's voices** (an "ooh", an "aww", a laugh, a cheer, a murmur). With `ELEVENLABS_API_KEY` on the server, the API makes each one with ElevenLabs' sound effects the first time a phone needs it and keeps it in the database. Admin → Voice → *The crowd's sounds* plays each one, makes it again, or takes your own recording instead. Without a key or an upload, the crowd only murmurs.
- **The mute button**, at the top of every screen, is the one sound control.

## The voice (optional)

1. Get an ElevenLabs API key (a paid plan, since this is commercial use) with access to text to speech and sound effects.
2. Add it on Railway, on the API service, as `ELEVENLABS_API_KEY`. The crowd's sounds start working too.
3. Choose in Admin → The stage → *Who reads Peruzzi's words*, and try it with "Hear the MC". It starts on **No voice**.

- **No voice.**
- **The MC.** Any voice from your ElevenLabs library: paste its voice ID in the admin (or set `ELEVENLABS_MC_VOICE_ID`).
- **Peruzzi's recorded lines.** Peruzzi records the fixed moments ("Make some noise! Who's on your mind tonight?", "Somebody here has a question for you.", "Could this be love?"), uploaded in Admin → Voice. The MC reads the rest.
- **Peruzzi's AI voice.** Uses `ELEVENLABS_VOICE_ID` and shows a visible label. **Only with Peruzzi's written consent, a contract covering its use, and the label's approval.**

The voice reads each note: their name, what they did as Peruzzi told it, and "Could this be love?". A prepared reading keeps the writer's own words, so then it reads only the name and the question: it never reads what anyone typed. Each reading is stored, so the same words in the same voice are paid for once.

## Email

Set `RESEND_API_KEY` and `MAIL_FROM`, an address on a domain verified in Resend. The email options appear on the site once both are set. Three emails, all editable in Admin → Emails, in the site's flat colours (the note on its blush paper, Peruzzi's question and the buttons in rose):

- **The code.** A writer proves their address before the site emails a note for them.
- **The note.** "Adé asked Peruzzi to ask you something": the note (what they did, Peruzzi's question and his answer, and the song), "Open the note", "Write Adé a note back", and the song. It names the writer and their masked address.
- **The tracklist.**

The links in them are built from `WEB_URL`, so set it (see *Deploy*). The site sends 300 emails an hour at most, all three together (`MAIL_PER_HOUR` changes it).

**Opt-outs and data.**
- Every email has an opt-out; "Never send me notes again" works for good, and the tracklist isn't emailed to an address that opted out.
- The recipient's address isn't kept, only a keyed hash for the weekly limit and the opt-out.
- News from Peruzzi goes only to people who ticked the box (unticked by default). The admin exports the list as CSV with the consent dates.

## Deploy

### The API on Railway

1. New project → deploy from this repo. `railway.json` and `nixpacks.toml` set it up: it builds `apps/api` and runs migrations on start. The health check is `/api/health`.
2. Add a Postgres database and set `DATABASE_URL` from it.
3. Set the variables from `apps/api/.env.example`. To try it out, this is enough: `DATABASE_URL`, `WEB_URL` (the site's address), `API_URL` (this service's address), `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`. The voice and email switch themselves on when their keys are added.

   **Before you ever change `ADMIN_PASSWORD`**, set `HASH_SECRET` to its current value (if it isn't set yet): without it, the admin password keys the opt-out list and signs the opt-out links, so a new password would stop them matching.
4. Under Settings → Networking, generate a domain named `peruzzi-inferno-api` (so it's `peruzzi-inferno-api.up.railway.app`, which `apps/web/vercel.json` already points to). If that name is taken, use another and change it in `vercel.json` too.

### The site on Vercel

1. New project from this repo, root directory `apps/web`. Framework: Vite.
2. If the API's address isn't `peruzzi-inferno-api.up.railway.app`, replace it in `apps/web/vercel.json` (4 places).
3. Point `WEB_URL` on Railway at the site's address and `API_URL` at the API's, so emails and link previews lead back to them. Shared links work without them (they're made on the address the page is on, and the previews send people on by a relative address), but the emails' links can't, and the API warns at start-up, and the admin's status line says so, while either is missing.

## Speed

Measured on a mid-range phone over slow 4G (Lighthouse's mobile setting), from tapping the link:

| Page | Usable in | JavaScript |
|---|---|---|
| The stage, ready to write | 2.6 s | 149 KB |
| Your notes | 2.2 s | 149 KB |
| A note sent to you, ready to open | 2.7 s | 149 KB |
| A shared note, its paper drawn | 4.7 s | 149 KB |
| A note on your notes, its paper drawn | 5.4 s | 149 KB |

The pages with a note on them wait for the paper's fonts and the cover pinned to it before drawing it. The stage asks the server for its settings and the notebook at once, as the page starts loading; the stage photo and the headings' fonts are preloaded; and the settings, the same for everyone, are cached for a few seconds.

To measure again, serve a production build and run `node apps/web/scripts/speed.mjs http://localhost:4173 slow4g` (or `fast4g`). The script's opening comment has the details.

## Tests

End-to-end, on phone-sized browsers, against the running API and site (`MAIL_DRY_RUN=1` on the API):

```bash
npm i -D playwright        # once, if it isn't installed
npm run e2e                # or one at a time: node apps/web/scripts/stage.e2e.mjs | send.e2e.mjs | admin.e2e.mjs
```

- **stage.** The way in (the cover under the lights, the song's card, the song starting as it opens), the stage on a note, its nameplate, the song playing on into it, the rig's lights up and moving, on the song's time (every move landing on a beat, every beat their brightest moment, dark for the break and hitting the drop), the sentence and its two blanks with nothing to tick, the suggestions (never something sweet), the count and its limit, an empty note turned back, the read-live line, the button staying at the foot of the screen, the song (leaving and coming back, back from streaming), the reading (the band, Peruzzi and the crowd, the lights coming up), the note (its headline, what they did as Peruzzi tells it, his question and his two-word answer, no stamp, nothing to tick, the song in its corner), next steps in order, the story card, posting, the square card and the link preview (sending people on by a relative address), the public page (with Peruzzi's answer, never the number typed), your notes and the back buttons, the tracklist and its email, a note to a thing, a note describing real harm getting help, and, in a browser that wants a tap first, the "Tap to play the music" pill on the way in, the tap into the stage starting the song, and opened straight on the stage, the pill there too (on opening, and again when the song is stopped).
- **send.** The link on the page's own address, sent with the note's card through the share sheet, on WhatsApp or copied, its folded preview, the note marked sent, the person asked (on a phone with a notebook of its own) arriving with the song playing, the note folded until opened, the writer seeing it seen, the note opened with Peruzzi's answer and nothing to tick, her next steps, writing back, the writer's notes catching up by themselves, and by email: the code, the note (what they did, Peruzzi's question and his answer, the song; flat colour), the weekly limit, and the opt-out.
- **admin.** Signing in, the status line, the insights (the kinds of love Peruzzi named), the costs and a projection, the stage's settings, pausing the stage (on the way in too, with notes already sent still opening), the emails, and the notes, with hiding one from its public link.

## Before launch

- **The official assets.** The cover (`apps/web/public/media/img/cover-*`), the stage photo (`stage-*`), the link previews (`og.jpg`, `og-ask.jpg`, made from `/lab/og` on the dev server), the icon and the song (`media/audio/inferno.mp3`, taken from the snippet) are stand-ins. Replace them with the official ones, keeping the names.
- **The streaming link.** Set in Admin → Site: a Spotify search until there's a real one.
- **Peruzzi's AI lines.** Run `peruzzi:try` with a key and read what he says before anyone else does.
- **Read live** stays off until Peruzzi's team agrees to read notes out.

## Credits and rights

**Type.** Marcellus for the headings and for the words on the note, and EB Garamond for the rest, because it handles Yoruba accents properly (on the note it stands in for any letter Marcellus doesn't have). Both are SIL Open Font License.

**Artwork and music.** Photographs, the cover and the song are Peruzzi's and his label's, used here for the pitch. **Peruzzi speaking in his own name here, and using his name, face, music or voice in public, needs his team's and the label's written approval.** Until then, keep the concept-demo note on (Admin → Site).
