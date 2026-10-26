"""Writes the client's pages from one template so the head and the navigation stay the same on every page.
Run from this folder: python3 build_pages.py.  The pages are plain files; GitHub Pages serves them as they are."""
import pathlib

HERE = pathlib.Path(__file__).parent

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="What I said I would do, and what happened.">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f4efe6" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15191c" media="(prefers-color-scheme: dark)">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="when fire">
  <link rel="apple-touch-icon" href="./icon-512.png">
  <link rel="icon" href="./icon-512.png" type="image/png">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="stylesheet" href="./styles.css?v=20261026b">
</head>
<body data-page="{page}">
  <header class="top">
    <a class="brand" href="./">when fire</a>
    <h1 class="title">{heading}</h1>
    <p id="status" class="status" hidden></p>
    <form id="key-form" class="form key" hidden>
      <label class="field">
        <span>This app needs its key.  Paste the full address you were given, or just the key.</span>
        <input id="key-input" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://…/when-fire-mcp?token=…">
      </label>
      <button type="submit" class="primary">Open</button>
    </form>
  </header>
  <main id="main">
{main}
  </main>
  <nav class="tabs" aria-label="Pages">
    <a href="./today.html" data-page="today"><span class="glyph">☀</span>Today</a>
    <a href="./" data-page="record"><span class="glyph">✎</span>Record</a>
    <a href="./whens.html" data-page="whens"><span class="glyph">◎</span>Whens</a>
    <a href="./thoughts.html" data-page="thoughts"><span class="glyph">☁</span>Thoughts</a>
    <a href="./questions.html" data-page="questions"><span class="glyph">?</span>Questions</a>
    <a href="./settings.html" data-page="settings"><span class="glyph">⚙</span>Settings</a>
  </nav>
  <script src="./app.js?v=20261026b"></script>
</body>
</html>
"""

PAGES = {
    "today.html": dict(page="today", title="when fire · today", heading="Today", main="""
    <p class="lead"><span id="today-date"></span>.  The routine as it stands, in clock order.  Tap done when a step is done; that is the fact, and the Watch reads met from it.</p>
    <div id="routines"></div>
    <p id="today-empty" class="empty" hidden>No routine on your side of the record yet.  A routine is a bundle of whens, asserted with your yes.</p>
    <form id="day-note" class="note-form" autocomplete="off">
      <label for="day-note-words" class="hint">A note about the day: a slip, a change you want, anything.  If it changes a step, a question comes back for your yes.</label>
      <textarea id="day-note-words" rows="2" placeholder="In your words…"></textarea>
      <div class="row"><button type="submit" class="small">Note</button></div>
    </form>
    <p id="notify-hint" class="hint small" hidden>Notifications are off on this phone.  Turn them on in Settings and each step reaches you at its minute.</p>
"""),
    "index.html": dict(page="record", title="when fire", heading="Record", main="""
    <section class="record">
      <form id="record-form" class="form">
        <label class="field">
          <span class="visually-hidden">What happened</span>
          <textarea id="said" rows="3" placeholder="What happened, in your words.  “Did a round.”  “Eight at 120.”" autocomplete="off" autocapitalize="sentences"></textarea>
        </label>
        <div class="row time">
          <label class="field grow">
            <span>Happened</span>
            <input id="happened" type="datetime-local">
          </label>
          <button id="now" type="button" class="ghost">Now</button>
        </div>
        <div class="row attach-row">
          <button id="plus" type="button" class="ghost plus" aria-haspopup="true" aria-expanded="false" aria-controls="attach-sheet">+</button>
          <div id="attach-sheet" class="sheet" hidden>
            <label class="sheet-row"><span>Camera</span><input id="pick-camera" type="file" accept="image/*" capture="environment"></label>
            <label class="sheet-row"><span>Photos</span><input id="pick-photos" type="file" accept="image/*"></label>
            <label class="sheet-row"><span>Files</span><input id="pick-files" type="file"></label>
          </div>
          <div id="attached" class="attached" hidden>
            <img id="thumb" class="thumb" alt="the picture to record" hidden>
            <span id="attached-name" class="attached-name"></span>
            <button id="clear-attachment" type="button" class="link">remove</button>
          </div>
        </div>
        <button id="record-btn" type="submit" class="primary big">Record</button>
      </form>
      <section id="pending" class="pending" hidden>
        <h3>Kept on this phone, not yet on the record</h3>
        <ul id="pending-list"></ul>
        <button id="retry" type="button" class="ghost">Send now</button>
      </section>
    </section>
    <section class="log-section" aria-labelledby="recent-h">
      <h2 id="recent-h">Recent</h2>
      <div id="log"></div>
      <p id="log-empty" class="empty" hidden>Nothing recorded yet.</p>
      <button id="log-more" type="button" class="ghost more" hidden>Earlier</button>
    </section>
"""),
    "whens.html": dict(page="whens", title="when fire · whens", heading="Whens", main="""
    <p class="lead">What you said you would do, as it stands.  Beside each, the Watch's latest reading: met, silence, or open.</p>
    <label class="toggle"><input id="show-ended" type="checkbox"> show ended and earlier wordings</label>
    <div id="whens"></div>
    <p id="whens-empty" class="empty" hidden>No whens on your side of the record.</p>
"""),
    "thoughts.html": dict(page="thoughts", title="when fire · thoughts", heading="Thoughts", main="""
    <p class="lead">What stands now, written by the Reconciler when an episode or a day closes.  The asserted beside the recorded; no grades.</p>
    <label class="toggle"><input id="show-notes" type="checkbox"> also the Thinker's notes</label>
    <div id="thoughts"></div>
    <p id="thoughts-empty" class="empty" hidden>Nothing written yet.</p>
    <button id="thoughts-more" type="button" class="ghost more" hidden>Earlier</button>
"""),
    "questions.html": dict(page="questions", title="when fire · questions", heading="Questions", main="""
    <section>
      <h2>Asked of you</h2>
      <p class="lead">The Thinker asks the shelf, the record and the world first.  What reaches you is what only you can answer.</p>
      <div id="asked"></div>
      <p id="asked-empty" class="empty" hidden>Nothing waits on you.</p>
    </section>
    <section>
      <h2>Still looking</h2>
      <div id="looking"></div>
      <p id="looking-empty" class="empty" hidden>No open questions.</p>
    </section>
    <section>
      <h2>Outbox</h2>
      <p class="lead">What the Doer wrote for the morning and for the session.  Mark a page done when you have read it.</p>
      <div id="tasks"></div>
      <p id="tasks-empty" class="empty" hidden>The outbox is empty.</p>
    </section>
"""),
    "settings.html": dict(page="settings", title="when fire · settings", heading="Settings", main="""
    <section>
      <h2>Health</h2>
      <dl id="health" class="health"></dl>
    </section>
    <section>
      <h2>Watch closely</h2>
      <form id="turbo-form" class="form inline">
        <label class="field"><span>for how many hours</span><input id="turbo-hours" type="number" min="0" max="48" step="1" value="4"></label>
        <button type="submit" class="primary">Turbo</button>
      </form>
      <p class="hint">The Watch's poll runs every thirty minutes until then, then falls back to every three hours.  Zero turns it off.</p>
    </section>
    <section>
      <h2>Notifications</h2>
      <p id="notify-state" class="hint">Checking…</p>
      <div class="row">
        <button id="notify-on" type="button" class="primary small" hidden>Turn on</button>
        <button id="notify-off" type="button" class="ghost small" hidden>Turn off</button>
      </div>
      <p class="hint">Each step of the routine reaches this phone at its minute, from the record, not from a timer in the app.  On an iPhone the app must be on the home screen first.</p>
    </section>
    <section>
      <h2>The door</h2>
      <form id="door-form" class="form">
        <label class="field"><span>function</span><input id="door" type="text" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>schema (blank for the live record)</span><input id="schema" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder=""></label>
        <button type="submit" class="ghost">Save</button>
      </form>
      <p class="hint">Address: <code id="address"></code><br>Key: <code id="key-masked"></code> · <button id="forget-key" type="button" class="link">forget the key on this phone</button></p>
    </section>
    <section id="install-hint" hidden>
      <h2>On the home screen</h2>
      <p class="hint">In Safari, tap Share, then “Add to Home Screen”.  The key stays with the app.</p>
    </section>
    <p class="hint small">when fire · the client is one of several doors; everything it writes goes through the connector, the same verbs any AI uses.</p>
"""),
}

for name, p in PAGES.items():
    (HERE / name).write_text(HEAD.format(**p))
    print("wrote", name)
