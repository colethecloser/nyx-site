export const aboutHtml = `
<section class="wrap founder-hero">
  <div class="portrait">
    <!-- SWAP IN A REAL/AI PORTRAIT: drop your file at public/founder.jpg and replace this <svg>...</svg> with:
         <img src="/founder.jpg" alt="Cole Gadell, founder of NYX"> -->
    <svg viewBox="0 0 320 400" role="img" aria-label="Founder portrait placeholder">
      <defs>
        <radialGradient id="pglow" cx="0.5" cy="0.32" r="0.7"><stop offset="0" stop-color="#a98cff" stop-opacity="0.55"/><stop offset="0.55" stop-color="#6fe0ec" stop-opacity="0.14"/><stop offset="1" stop-color="#6fe0ec" stop-opacity="0"/></radialGradient>
        <linearGradient id="fig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#222a52"/><stop offset="1" stop-color="#0d1230"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="400" fill="#0a0e22"/>
      <ellipse cx="160" cy="140" rx="170" ry="160" fill="url(#pglow)"/>
      <circle cx="160" cy="150" r="56" fill="url(#fig)"/>
      <path d="M64 400 q0 -96 96 -96 q96 0 96 96 Z" fill="url(#fig)"/>
      <circle cx="160" cy="150" r="56" fill="none" stroke="#6fe0ec" stroke-opacity="0.25" stroke-width="1.5"/>
    </svg>
  </div>
  <div>
    <div class="role">Founder &amp; CEO</div>
    <h1 class="serif">Cole Gadell</h1>
    <p class="tag">I spent my early career watching the most ambitious people I knew trade their health for one more alert hour. NYX is the fix I wanted to exist: recovery itself, made better, instead of one more thing that hides the cost.</p>
  </div>
</section>

<section class="letter">
  <div class="wrap body-copy">
    <p>The first time I saw the real price of the grind, it was not on a P&amp;L. It was a room full of brilliant people running on espresso and prescriptions, sharp at noon and hollow by midnight, convinced that sleep was the one cost they could cut. They were not lazy. They were doing the math wrong, because the asset they were spending was the only one that does not come back.</p>
    <p>Stimulants felt like a deal because the bill arrives later. Caffeine and amphetamines do not buy you energy, they borrow it against a tomorrow that quietly gets worse. I wanted the opposite trade: not a way to feel less tired, but a way to actually be more recovered, in less time, with nothing to pay back.</p>
    <p class="muted">So I went to the science of what sleep actually repairs, and to the question of how much of it a machine could deliver on purpose. NYX-1 is the answer we can build today. It does not abolish sleep. It makes the sleep you get deeper, faster, and cleaner, and it hands the difference back to you as time. That is the whole company in one sentence: give people back the hours they were spending to survive.</p>
    <p>If you have ever looked at the clock at 3am doing the arithmetic on how little rest you can get away with, this was built for you. Welcome.</p>
    <div class="sig">Cole Gadell<small>Founder &amp; CEO, NYX Labs</small></div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="reveal"><div class="kicker">What we will not compromise on</div><h2 class="serif">Three rules the company runs on.</h2></div>
    <div class="principles">
      <div class="principle reveal"><div class="no">01</div><h3>Restore, never mask</h3><p>If a feature only makes you feel rested without making you more recovered, it does not ship. We are in the repair business, not the illusion business.</p></div>
      <div class="principle reveal"><div class="no">02</div><h3>Honest about the ceiling</h3><p>Some of recovery runs on biological time we cannot rush, and we say so. We would rather under-promise and be trusted than oversell and be returned.</p></div>
      <div class="principle reveal"><div class="no">03</div><h3>Your time is the product</h3><p>Every decision gets measured against one question: does this give the person back more of their life than it costs them. If not, we cut it.</p></div>
    </div>
  </div>
</section>

<div class="honest">
  <div class="wrap">
    <div class="honest-box reveal">
      <h4>A note on claims</h4>
      <p>NYX Labs builds consumer technology to improve sleep quality and efficiency. NYX-1 is not a medical device and is not intended to diagnose, treat, or cure any condition. If you have a sleep disorder or a health concern, talk to a clinician. Our goal is straightforward: help healthy people get more out of the sleep they already need.</p>
    </div>
  </div>
</div>

<div class="wrap" style="padding:54px 0 70px;text-align:center">
  <a href="/#reserve"><button class="btn btn-primary">Reserve NYX-1 for $500</button></a>
</div>
`;
