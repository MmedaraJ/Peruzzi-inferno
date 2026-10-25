# Peruzzi Asks

A fan experience for **Inferno**, Peruzzi's new song, whose hook asks "could this be love?". A fan writes someone a note in one sentence: "Dear ___, you ___." Something sweet they did, or something they shouldn't have. A crush, a bestie, a mum, even their bed. Peruzzi reads it at the mic in front of his crowd, tells what they did back to them, funnier, and asks: "Could this be love?" The person it's for opens the note on their phone and ticks one box: Yes, No, or a third box Peruzzi wrote just for them ("I was full."). The answer comes back to the writer, and anyone can write back or write their own.

The song's snippet plays underneath the whole time.

**For now.** The snippet, the cover and the photo on the stage are stand-ins from what was to hand, until Peruzzi's team sends the official assets (see *Before launch*). The look is the song's: a night at Peruzzi's show, lit in flame, red and magenta with gold at the edge of the light, the notes on warm white paper, and his question in the song's colours.

## What's where

```
apps/web    React + Vite + Tailwind: the stage, the shared pages, the admin
apps/api    NestJS + Prisma + Postgres: Peruzzi's lines, notebooks and notes, sending notes and their answers, emails, voice, insights
```

There's no front page: the site opens on a note, ready to write. Each screen has its own address, so the phone's back button goes where you'd expect, and one component holds them all, so the song and the notebook carry on throughout.

| Address | Screen |
|---|---|
| `/` | a note: "Dear ___, you ___.", Peruzzi's reading, and the note (`?back=<ask>` writes back to the one who sent that note) |
| `/notes` | your notes, each with where it has got to |
| `/notes/:id` | a note already asked, to save, post or send |
| `/tracklist` | the tracklist |
| `/answer/:code` | a note sent to you: open it, and tick |
| `/question/:code` | a note someone posted (public) |
| `/tracks/:code` | a tracklist someone posted (public) |

Back from a note's page is your notes, and back from your notes is a new note.

- **The stage.** Peruzzi in the light, seen from the back of the room: the rig's beams in magenta, gold and flame, the stage's front edge with an LED strip in the song's colours and its nameplate ("Peruzzi · live"), and the crowd in front: two rows of people seen from behind (afros, braids, a gele, a cap, a bun), shoulders and arms, a few phones up. The show opens with the room settling and a finger on the mic, twice ("Make some noise! Who's on your mind tonight?" when the stage has a voice). The crowd reacts out loud ("Awww.", "Ooooh.", laughter, a cheer) as the notes land.
  - **On the beat.** The crowd sways left and right with the song: a lean one way on each beat and back the other way on the next, a little dip on the beat, the back row a touch behind the front, and the lights pulse with it. The beat is the song's own: `apps/web/src/lib/beat.ts` reads where the song is (102.97 beats a minute, the first at 0.277 s, measured from `inferno.mp3`; measure again if the file changes). Before the song starts, the crowd keeps its tempo, more gently; with reduced motion, it stands still.
- **A note, in one sentence**, on the note's paper:

  > Dear \_\_\_\_\_, you \_\_\_\_\_\_\_\_\_\_.

  - Two blanks: who (a name or a role, 28 characters) and what they did (80, with a count). While they're empty, they suggest a note at a time, sweet or not (my crush, saved the last puff-puff for me on purpose; Tobi, left me on read for three days, then liked my story).
  - Under it, Peruzzi's question as the note will have it ("Peruzzi asks: Could this be love?"), and, faint, the three boxes they'll answer in: "They tick one".
  - **Peruzzi, help me ask** at the foot of the screen hands it up. Return in the first blank goes on to the second; in the second it hands the note up.
  - With *read live* on (Admin → The stage), the note says Peruzzi could read the best notes out live.
  - Someone writing back starts with who already in: the one who sent them the note.
  - While typing, the screen is fitted to what can be seen above the keyboard: the stage slides up behind the top bar, all but its front edge and nameplate, before the keyboard is up.
- **Peruzzi reads it.** "peruzzi is reading it", over three slips: the band (a guitar strumming), Peruzzi in the middle (the mic swaying), the crowd (clapping). Above them, typed out a line at a time, what the room is up to ("The crowd wants to know who your crush is…", "Checking it's love and not just December…"), for as long as the reading takes. Then the lights come up on each of them, Peruzzi's last ("Peruzzi has it."), the drummer's crash, and the note. Peruzzi starts reading once the writer stops typing for a moment, so by the time they hand it up it's there or nearly.
- **The note on paper**, warm white with the song's colours along its top edge, under "Note 0007 · Two Hours at the ATM", the cover pinned to its corner:
  - **"Dear Kemi,"** as its headline, her name in the song's colours.
  - **What she did**, as Peruzzi tells it, to her: "You stood in an ATM queue with me for two hours like it was our first date."
  - **Peruzzi asks: Could this be love?** in a box of its own, in the song's colours. That's all it says.
  - **The three boxes**: Yes, No, and the third box.
  - **"Inferno by Peruzzi"** in its bottom right corner.

  No stamp, and no question at the foot: Peruzzi's box asks it. It's the story card's own paper: the page draws it with the card's code at the phone's width, so what's on screen is exactly what gets posted. Only the tick is drawn apart, to land on it. What it says is also there as text for screen readers.
- **The cards.** The story card (1080×1920, to post) and the square (for link previews): the night at the show behind it, lit in magenta and flame with two beams coming down, "PERUZZI ASKS" over the paper, and under it the way in, "Who's on your mind?" and the address, underlined in the song's colours. Once the note is answered, the cards carry the tick.
- **Next steps.** The note is in your notes the moment it lands. Right under the paper, "Save image". Then three numbered steps:
  1. **Let Peruzzi ask:** "Send it to Kemi". Only she can tick it.
  2. **Post it:** "Put it on your story". The phone's share sheet with the story card (without one, it copies the note's link).
  3. **The song:** "Listen to Inferno by Peruzzi".

  A note to something that can't read it (a bed, jollof, Arsenal) has nobody to send to, so it starts at posting: "Bed can't read it, but everyone else can."
- **Sending it.** From and To (their name from the note), then:
  - **Send on WhatsApp**: "Kemi, Peruzzi asked you something. It's from Adé, and only you can answer it:" and the link. The link is the key: whoever opens it can tick the answer, once.
  - **Share the link**, the same message anywhere else.
  - **Have it emailed** (once email is set up): the writer confirms their own address with a six-digit code first, so nobody can send notes in someone else's name.
- **The answer.** The person asked arrives on the stage: "A note from Adé", "Kemi, peruzzi asked you something", the note still folded. **Open it** (the tap that starts the song): the spotlight swings off the stage and lands on them, Peruzzi says "Somebody here has a question for you.", and the note comes down. They tick one box, in red biro. The room answers with them (a cheer, an "aww", a laugh), and Peruzzi says his piece: "I knew it.", "Respect.", or "Hmm. I don't believe you." Then: Save image, and next steps of their own (tell the writer, on WhatsApp, with the note's link; post it; the song), **Write Adé back**, and **Write your own note**.
  - One answer per note: the first tick counts, even if two phones tick at once, and it stays. Coming back to the note shows the answer.
  - Writing back opens a notebook of its own that knows what it answers, so Peruzzi can play off it. "Write your own note" carries on in the notebook already on that phone.
- **Your notes.** Every note so far, newest first, each with where it has got to: "Sent. Kemi hasn't opened it yet.", "Seen 9:26am. No tick yet.", "Kemi ticked Yes." While your notes are on screen they keep up by themselves (every 15 seconds, and whenever the page comes back into view). A note that described real harm isn't among them.
- **The tracklist.** Every note is a track: the tracklist is there from the first note and grows with every one after, under a name and a city. Its card carries the latest notes with their titles and answers. Save it, share it, or email it. The phone keeps its notebook for 30 days after the last note, so the tracklist carries on from one visit to the next.
- **When a note is serious.** A note describing abuse, violence, threats, stalking, self-harm or someone in danger: Peruzzi puts the mic down, says so plainly, and shows where to get help (the text and links are set in Admin → The stage).

**Shared links:**
- `/q/:code` is a note someone posted. Its preview names who it's for ("Someone asked Peruzzi to ask Tolu: could this be love?"), and once it's answered, the answer ("Tolu answered Peruzzi: Yes").
- `/a/:code` is a note sent to the person it's for. Its preview keeps the note folded: who it's for, who it's from, and the question. What it says is for them to open.
- `/t/:code` is a tracklist.

WhatsApp and similar apps read the link preview from the API, which then sends the person on into the site.

**Admin (`/admin`):** one shared password, `ADMIN_PASSWORD`, traded at sign-in for a session that lasts 12 hours (the tab never keeps the password). Ten wrong passwords through one connection in a quarter of an hour and it gets no more tries until the quarter has passed.
- **Insights.** Totals only: notes, sent, seen, answered and how many ticked Yes, written back, the way from the stage to sharing, the answers, what the notes were about (something sweet, something they shouldn't have, nonsense), who the notes are for, notes per day, the busiest hours, cities, and the AI's cost.
- **Costs.** What the site has cost to run, what's been paid towards it, and what's still to pay: month by month, bill by bill, the AI as measured from every reading, the voice's credits, and projections (a month at 1,000, 10,000, 50,000 and 250,000 notes, and a calculator, with the voice reading every note or nothing). Bills and payments are set here.
- **Notes.** Every note as written, what Peruzzi made of it, where it was sent and how it was answered, with flags (contact details taken out, a prepared line, the AI too slow, danger words) and hiding a note from its public link.
- **The stage.** Open or paused (notes already sent can still be opened and answered while it's paused), who reads Peruzzi's words, the name on the stage, Peruzzi's humour (sweet, cheeky, spicy), *read live*, the limits, the song's volume, and the help text.
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
- Whatever they did, sweet or annoying, he tells it back bigger and funnier: an ATM queue becomes a first date, a saved puff-puff a state secret, three days on read a national holiday. The laugh is in how it's told: one exaggerated detail, comparison or twist. Warm, cheeky, playful: wit, never mush (no "soulmate", no butterflies), with everyday Nigerian life where it makes the line land and at most a touch of Pidgin.
- He talks to the person the note is for: it's "you", never "he" or "she" about anyone.
- He may speak as himself at the mic, but says nothing about his own life, his relationships or his songs. The admin's humour setting comes with each note.

**The reading**, held to a schema (`output_config.format`):
- the kind: something sweet (love), something they shouldn't have (teased playfully, about what they did and never who they are), nonsense when there's nothing to read, or serious (below). It sets how the crowd takes the note (an "aww", a laugh) and the admin's insights; it isn't on the note;
- who it's to, as the note says it after "Dear" ("my crush" → "Crush"), and whether that's a thing that can never read it;
- the note's title, like a track on an album ("Last Puff-Puff"), for your notes, the tracklist and the emails;
- what they did, told back to them, funnier: one short sentence starting "You", 6 to 16 words, keeping the facts and the writer's side of it ("You saved me…"), so a stranger who reads only this line gets the story;
- the third box: the excuse the person asked would give for exactly this, in their own voice ("I was also withdrawing."). For a thing, what the thing would say ("I'm just a bed.").

The server holds the line to it (one sentence, starting "You", never "I think you"), whatever comes back.

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

- **The song** (`apps/web/public/media/audio/inferno.mp3`) loops underneath at 25% (the admin can change it), and steps down whenever the stage makes a sound or speaks. A phone starts sound only from a tap: the first tap on the stage starts it, and on a note sent to you, "Open it" does.
- **Leaving and coming back.** Leaving the page cuts all sound at once; coming back carries the song on where it was. After a tap on "Listen to Inferno", the song waits for a small pill instead, so it doesn't cut into the song playing in another app. It plays on under the share sheet.
- **The stage's sounds** are synthesised in `apps/web/src/lib/sound.ts`, so there are no files to load: a finger on the mic, the drumroll while Peruzzi reads, a swish as each light comes up, the drummer's crash, the tick, whooshes, the room's murmur, and a chime for something sweet.
- **The crowd's voices** (an "ooh", an "aww", a laugh, a cheer, a murmur). With `ELEVENLABS_API_KEY` on the server, the API makes each one with ElevenLabs' sound effects the first time a phone needs it and keeps it in the database. Admin → Voice → *The crowd's sounds* plays each one, makes it again, or takes your own recording instead. Without a key or an upload, the crowd only murmurs.
- **The mute button**, at the top of every screen, is the one sound control.

## The voice (optional)

1. Get an ElevenLabs API key (a paid plan, since this is commercial use) with access to text to speech and sound effects.
2. Add it on Railway, on the API service, as `ELEVENLABS_API_KEY`. The crowd's sounds start working too.
3. Choose in Admin → The stage → *Who reads Peruzzi's words*, and try it with "Hear the MC". It starts on **No voice**.

- **No voice.**
- **The MC.** Any voice from your ElevenLabs library: paste its voice ID in the admin (or set `ELEVENLABS_MC_VOICE_ID`).
- **Peruzzi's recorded lines.** Peruzzi records the fixed moments ("Make some noise! Who's on your mind tonight?", "Somebody here has a question for you.", "I knew it.", "Respect.", "Hmm. I don't believe you."), uploaded in Admin → Voice. The MC reads the rest.
- **Peruzzi's AI voice.** Uses `ELEVENLABS_VOICE_ID` and shows a visible label. **Only with Peruzzi's written consent, a contract covering its use, and the label's approval.**

The voice reads each note: their name, what they did as Peruzzi told it, and "Could this be love?". A prepared reading keeps the writer's own words, so then it reads only the name and the question: it never reads what anyone typed. Each reading is stored, so the same words in the same voice are paid for once.

## Email

Set `RESEND_API_KEY` and `MAIL_FROM`, an address on a domain verified in Resend. The email options appear on the site once both are set. Four emails, all editable in Admin → Emails:

- **The code.** A writer proves their address before the site emails a note for them.
- **The note.** "Adé asked Peruzzi to ask you something": the note (what they did, Peruzzi's question, the three empty boxes and the song), "Open the note and answer", "Write Adé a note back", and the song. It names the writer and their masked address.
- **The answer.** When an emailed note is answered, its writer gets the note back with the box ticked.
- **The tracklist.**

The site sends 300 emails an hour at most, all four together (`MAIL_PER_HOUR` changes it).

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
3. Point `WEB_URL` on Railway at the site's address, so emails and shared links lead back to it.

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

- **stage.** The site opening straight on a note, the stage and its nameplate, the sentence and its two blanks, the count and its limit, an empty note turned back, the read-live line, the button staying at the foot of the screen, the song (the first tap, leaving and coming back, back from streaming), the reading (the band, Peruzzi and the crowd, the lights coming up), the note (its headline, what they did as Peruzzi tells it, his question, no stamp, the three boxes, the song in its corner), next steps in order, the story card, posting, the square card and the link preview, the public page (never the number typed), your notes and the back buttons, the tracklist and its email, a note to a thing, and a note describing real harm getting help.
- **send.** The WhatsApp link and its folded preview, the note marked sent, the person asked (on a phone with a notebook of its own) arriving, the note folded until opened, the writer seeing it seen, the three boxes, the tick and Peruzzi's reply, their next steps, the writer's notes catching up by themselves, only the first tick counting, the cards and previews showing the answer, writing back, and by email: the code, the note (what they did, Peruzzi's question, the boxes, the song), the weekly limit, the answer emailed back to the writer, and the opt-out.
- **admin.** Signing in, the insights, the costs and a projection, the stage's settings, pausing the stage (with notes already sent still answerable), and the notes, with hiding one from its public link.

## Before launch

- **The official assets.** The cover (`apps/web/public/media/img/cover-*`), the stage photo (`stage-*`), the link previews (`og.jpg`, `og-ask.jpg`, made from `/lab/og` on the dev server), the icon and the song (`media/audio/inferno.mp3`, taken from the snippet) are stand-ins. Replace them with the official ones, keeping the names.
- **The streaming link.** Set in Admin → Site: a Spotify search until there's a real one.
- **Peruzzi's AI lines.** Run `peruzzi:try` with a key and read what he says before anyone else does.
- **Read live** stays off until Peruzzi's team agrees to read notes out.

## Credits and rights

**Type.** Marcellus for the headings and for the words on the note, and EB Garamond for the rest, because it handles Yoruba accents properly (on the note it stands in for any letter Marcellus doesn't have). Both are SIL Open Font License.

**Artwork and music.** Photographs, the cover and the song are Peruzzi's and his label's, used here for the pitch. **Peruzzi speaking in his own name here, and using his name, face, music or voice in public, needs his team's and the label's written approval.** Until then, keep the concept-demo note on (Admin → Site).
