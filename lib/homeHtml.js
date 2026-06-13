export const homeHtml = `
<header class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">NYX-1 &middot; Restorative Sleep Engine</div>
      <h1 class="serif">Buy back your <em>nights.</em></h1>
      <p class="sub">You can earn back money. You cannot earn back time. NYX-1 makes sleep radically more efficient, so you recover in less of it and wake fully restored. No stimulants. No crash. No debt to tomorrow.</p>
      <div class="hero-cta">
        <a href="#reserve"><button class="btn btn-primary">Reserve for $500</button></a>
        <div class="price-inline"><b>$4,900</b> &middot; ships Q1 &middot; 100-night trial</div>
      </div>
    </div>
    <div class="scene" aria-label="An exhausted banker in a suit walking toward a glowing restorative pod">
      <svg viewBox="0 0 400 440" role="img">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080a1c"/><stop offset="0.55" stop-color="#0c1130"/><stop offset="1" stop-color="#141a3e"/></linearGradient>
          <radialGradient id="dawn" cx="0.82" cy="0.46" r="0.6"><stop offset="0" stop-color="#f6c878" stop-opacity="0.95"/><stop offset="0.32" stop-color="#c98ce0" stop-opacity="0.42"/><stop offset="0.7" stop-color="#6fe0ec" stop-opacity="0.12"/><stop offset="1" stop-color="#6fe0ec" stop-opacity="0"/></radialGradient>
          <linearGradient id="podlight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe2b4"/><stop offset="0.5" stop-color="#f6c878"/><stop offset="1" stop-color="#b98ce6"/></linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1130"/><stop offset="1" stop-color="#05060f"/></linearGradient>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0c1a"/><stop offset="1" stop-color="#f6c878"/></linearGradient>
        </defs>
        <rect x="0" y="0" width="400" height="330" fill="url(#sky)"/>
        <rect x="0" y="0" width="400" height="440" fill="url(#dawn)" class="podglow"/>
        <g fill="#cdd4ff" opacity="0.5"><circle cx="40" cy="46" r="1.1"/><circle cx="96" cy="30" r="0.8"/><circle cx="150" cy="58" r="1"/><circle cx="74" cy="92" r="0.7"/><circle cx="30" cy="140" r="0.9"/><circle cx="120" cy="110" r="0.7"/><circle cx="180" cy="28" r="0.8"/><circle cx="20" cy="200" r="0.7"/></g>
        <g fill="#070a1a" opacity="0.92"><rect x="0" y="210" width="34" height="120"/><rect x="34" y="180" width="26" height="150"/><rect x="60" y="232" width="30" height="98"/><rect x="90" y="160" width="22" height="170"/><rect x="112" y="244" width="34" height="86"/><rect x="146" y="206" width="24" height="124"/></g>
        <rect x="0" y="330" width="400" height="110" fill="url(#floor)"/>
        <ellipse cx="300" cy="360" rx="150" ry="34" fill="#f6c878" opacity="0.16" class="podglow"/>
        <g class="podglow"><rect x="286" y="120" width="86" height="232" rx="43" fill="url(#podlight)" opacity="0.28"/><rect x="298" y="132" width="62" height="208" rx="31" fill="url(#podlight)"/><rect x="298" y="132" width="62" height="208" rx="31" fill="#fff" opacity="0.18"/></g>
        <rect x="286" y="120" width="86" height="232" rx="43" fill="none" stroke="#f6c878" stroke-opacity="0.55" stroke-width="1.5"/>
        <g fill="#f6c878"><circle class="mote" cx="250" cy="300" r="1.6" opacity="0"/><circle class="mote" cx="268" cy="320" r="1.2" opacity="0"/><circle class="mote" cx="240" cy="330" r="1.4" opacity="0"/><circle class="mote" cx="276" cy="290" r="1" opacity="0"/></g>
        <ellipse cx="150" cy="360" rx="78" ry="13" fill="#000" opacity="0.45"/>
        <g>
          <path d="M150 300 L142 356 L150 356 L160 304 Z" fill="#0a0c1a"/>
          <path d="M160 300 L176 352 L184 350 L170 298 Z" fill="#0b0e1d"/>
          <path d="M138 354 q-6 2 -8 6 l22 0 0 -6 Z" fill="#05060f"/>
          <path d="M173 348 q4 4 11 4 l4 4 -20 0 -2 -8 Z" fill="#05060f"/>
          <path d="M138 214 q22 -10 40 -2 q6 30 0 64 q-4 26 -10 26 l-22 0 q-8 -2 -10 -28 q-4 -32 2 -60 Z" fill="#0a0c1a"/>
          <path d="M178 212 q6 30 0 64 q-3 22 -8 26 q5 -28 6 -54 q1 -20 -4 -34 q3 -1 6 -2 Z" fill="url(#rim)" opacity="0.7"/>
          <path d="M156 222 l5 0 -1 30 -3 0 Z" fill="#3a2046"/>
          <path d="M153 216 l6 8 6 -8 Z" fill="#1a2140"/>
          <path d="M140 224 q-8 24 -6 46 l8 0 q0 -24 4 -44 Z" fill="#090b18"/>
          <rect x="126" y="266" width="22" height="17" rx="2.5" fill="#070a16"/>
          <rect x="134" y="262" width="6" height="6" rx="2" fill="#070a16"/>
          <path d="M176 224 q9 22 7 44 l-7 0 q-2 -22 -5 -42 Z" fill="#0c1020"/>
          <circle cx="160" cy="200" r="15" fill="#0a0c1a"/>
          <path d="M160 186 a15 15 0 0 1 13 8 q-6 9 -14 9 q3 -13 1 -17 Z" fill="url(#rim)" opacity="0.55"/>
          <rect x="155" y="210" width="10" height="9" fill="#090b18"/>
        </g>
        <g opacity="0.85"><rect x="180" y="262" width="8" height="9" rx="1.5" fill="#0c1020"/><path d="M184 256 q3 -4 0 -8 q-3 -3 0 -7" fill="none" stroke="#9aa0c4" stroke-width="1" stroke-opacity="0.4"/></g>
      </svg>
    </div>
  </div>
</header>

<section class="band">
  <div class="wrap">
    <div class="reveal">
      <div class="kicker">The tax on ambition</div>
      <h2 class="serif">Caffeine borrows. Amphetamines <em>steal.</em></h2>
      <p class="lede">Every stimulant works the same way: it blocks the signal that tells you you are tired. You feel sharp while your body falls further behind, then you pay interest the next day with a crash, and compounding interest over the years with your health. None of it delivers a single minute of real recovery.</p>
    </div>
    <div class="compare-tax">
      <div class="tax bad reveal"><div class="label">What stimulants do</div><h3>Mask the meter</h3><p>Caffeine and amphetamines hide fatigue and dump stress hormones. The repair work never happens. You are running a tab against tomorrow, and the bill always comes due.</p></div>
      <div class="tax good reveal"><div class="label">What NYX-1 does</div><h3>Restore the asset</h3><p>NYX-1 works on the real thing: it deepens and concentrates your actual sleep, so the recovery genuinely happens, faster. You wake restored, not borrowed against.</p></div>
    </div>
  </div>
</section>

<section class="band" id="device">
  <div class="wrap">
    <div class="reveal">
      <div class="kicker">The hardware</div>
      <h2 class="serif">Quiet on the nightstand. <em>Relentless</em> at 3am.</h2>
      <p class="lede">One bedside engine and one feather-light in-ear sensor. It sets up in minutes, disappears into your room, then works all night so you never have to think about any of it.</p>
    </div>
    <div class="product-wrap reveal">
      <div class="product-stage">
        <!-- SWAP IN A REAL/AI PHOTO: drop your file at public/product.png and replace this whole <svg>...</svg> with:
             <img src="/product.png" alt="NYX-1 restorative sleep engine" class="product-photo"> -->
        <svg viewBox="0 0 400 360" role="img" aria-label="NYX-1 bedside engine and in-ear sensor">
          <defs>
            <radialGradient id="halo" cx="0.42" cy="0.4" r="0.6"><stop offset="0" stop-color="#a98cff" stop-opacity="0.5"/><stop offset="0.5" stop-color="#6fe0ec" stop-opacity="0.16"/><stop offset="1" stop-color="#6fe0ec" stop-opacity="0"/></radialGradient>
            <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#11152e"/><stop offset="0.18" stop-color="#1c2348"/><stop offset="0.5" stop-color="#232c57"/><stop offset="0.82" stop-color="#161c3a"/><stop offset="1" stop-color="#0c1024"/></linearGradient>
            <linearGradient id="metaltop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3667"/><stop offset="1" stop-color="#141a38"/></linearGradient>
            <linearGradient id="seam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe2b4"/><stop offset="0.45" stop-color="#f6c878"/><stop offset="0.75" stop-color="#a98cff"/><stop offset="1" stop-color="#6fe0ec"/></linearGradient>
            <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2348" stop-opacity="0.5"/><stop offset="1" stop-color="#1c2348" stop-opacity="0"/></linearGradient>
          </defs>
          <ellipse cx="168" cy="150" rx="180" ry="150" fill="url(#halo)" class="podglow"/>
          <!-- floor -->
          <rect x="0" y="286" width="400" height="74" fill="#070a18"/>
          <ellipse cx="168" cy="288" rx="120" ry="16" fill="#000" opacity="0.5"/>
          <!-- reflection of device -->
          <g opacity="0.5"><rect x="122" y="288" width="92" height="120" rx="28" fill="url(#reflect)" transform="scale(1,-1) translate(0,-576)"/></g>
          <!-- device body -->
          <rect x="122" y="74" width="92" height="214" rx="30" fill="url(#metal)"/>
          <rect x="122" y="74" width="92" height="20" rx="10" fill="url(#metaltop)"/>
          <!-- side hairline highlight -->
          <rect x="126" y="86" width="2" height="192" rx="1" fill="#48538f" opacity="0.6"/>
          <!-- speaker grille suggestion (fine dots) -->
          <g fill="#0b0f22" opacity="0.7"><circle cx="150" cy="120" r="1.1"/><circle cx="160" cy="120" r="1.1"/><circle cx="170" cy="120" r="1.1"/><circle cx="180" cy="120" r="1.1"/><circle cx="155" cy="128" r="1.1"/><circle cx="165" cy="128" r="1.1"/><circle cx="175" cy="128" r="1.1"/></g>
          <!-- glowing light seam -->
          <rect x="163" y="150" width="10" height="104" rx="5" fill="url(#seam)" class="podglow"/>
          <rect x="163" y="150" width="10" height="104" rx="5" fill="#fff" opacity="0.12"/>
          <!-- status dot -->
          <circle cx="168" cy="270" r="3" fill="#6fe0ec"/><circle cx="168" cy="270" r="6" fill="#6fe0ec" opacity="0.3" class="podglow"/>
          <!-- in-ear sensor on a small dock -->
          <ellipse cx="300" cy="280" rx="34" ry="9" fill="#0b0f22"/>
          <ellipse cx="300" cy="276" rx="26" ry="6" fill="#161c3a"/>
          <g transform="translate(300,250)">
            <path d="M-13 14 q-9 -14 2 -24 q12 -10 22 2 q7 9 0 18 q-6 8 -14 6 q3 -10 -2 -16 q-5 -4 -10 0 q-4 5 0 14 Z" fill="url(#metal)"/>
            <path d="M-13 14 q-9 -14 2 -24 q12 -10 22 2 q3 4 3 8 q-4 -6 -11 -7 q-10 -1 -16 8 q-4 7 0 13 Z" fill="#2a3360" opacity="0.7"/>
            <circle cx="6" cy="-2" r="3.4" fill="#6fe0ec"/><circle cx="6" cy="-2" r="6" fill="#6fe0ec" opacity="0.35" class="podglow"/>
          </g>
        </svg>
      </div>
      <div class="product-side">
        <div class="spec-stack">
          <div class="spec"><div class="l">In the box</div><div class="v">NYX-1 engine + in-ear sensor</div></div>
          <div class="spec"><div class="l">Setup</div><div class="v">Under 4 minutes, nothing wired to you</div></div>
          <div class="spec"><div class="l">All night</div><div class="v">Senses, adapts, and conducts your sleep</div></div>
          <div class="spec"><div class="l">Footprint</div><div class="v">Fits any nightstand, runs near-silent</div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="band" id="how">
  <div class="wrap">
    <div class="reveal">
      <div class="kicker">Not a stimulant &middot; a closed loop</div>
      <h2 class="serif">It reads your sleep and <em>conducts</em> it.</h2>
      <p class="lede">NYX-1 senses your brain state in real time and steers it. Every night it learns what deepens your sleep specifically, then does more of it. The result is more recovery packed into every hour you lie down.</p>
    </div>
    <div class="feat">
      <div class="card c-cyan reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h4l3-8 4 16 3-8h6"/></svg></div><h3>Live brain-state sensing</h3><p>In-ear EEG, heart rate, breath and temperature fuse into a millisecond read of where you are in the night, and predict the next brainwave before it arrives.</p></div>
      <div class="card c-violet reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14c4 0 4-8 8-8s4 8 8 8"/><path d="M4 19c4 0 4-4 8-4s4 4 8 4"/></svg></div><h3>Deep-wave entrainment</h3><p>Precisely timed sound pulses ride the rising edge of each slow wave to amplify it, deepening the most restorative phase of sleep and sharpening memory consolidation.</p></div>
      <div class="card c-amber reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l-1.5-1.5M19.5 19.5L18 18"/><circle cx="12" cy="12" r="4"/></svg></div><h3>Thermal depth control</h3><p>A temperature curve pulls heat from your core to trigger and hold deep sleep, the same mechanism your body uses on its best nights, now driven on purpose.</p></div>
      <div class="card c-cyan reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div><h3>Circadian alignment</h3><p>Timed light and onset priming align your clock so you fall asleep fast and lose nothing to lying awake. No wasted minutes on either end of the night.</p></div>
      <div class="card c-violet reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 13l3 3 5-7"/></svg></div><h3>Personalized optimizer</h3><p>Every night is an experiment. The model varies its settings, measures your response, and compounds what works for you, getting better the longer you sleep on it.</p></div>
      <div class="card c-amber reveal"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z"/></svg></div><h3>Clean, by design</h3><p>Nothing ingested. No molecule blocking a signal, no dependency, no tolerance curve, no comedown. Just your own sleep, run at its best.</p></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="reveal">
      <div class="kicker">The math on your time</div>
      <h2 class="serif">What is an hour of your life <em>worth?</em></h2>
      <p class="lede">More efficient recovery means you reclaim time you used to lose to long nights and slow mornings. Move the inputs to see what that returns over a career.</p>
    </div>
    <div class="calc-wrap" id="calc">
      <div class="calc-controls reveal">
        <div class="field"><label>Hours reclaimed per night: <b><span id="hrOut">1.0</span> hr</b></label><input type="range" id="hrRange" min="0.5" max="2" step="0.1" value="1"></div>
        <div class="field"><label>Your time is worth, per hour</label><div class="rate-in"><span>$</span><input type="number" id="rate" value="150" min="1" max="100000"></div></div>
        <div class="field"><label>Career horizon: <b><span id="yrOut">30</span> years</b></label><input type="range" id="yrRange" min="5" max="45" step="1" value="30"></div>
      </div>
      <div class="calc-out reveal">
        <div class="big mono" id="lifeOut">1.9</div>
        <div class="biglabel">years of waking life reclaimed</div>
        <div class="calc-split"><div><div class="n mono" id="hrYear">365</div><div class="l">hours / year</div></div><div><div class="n mono" id="dollar">$54,750</div><div class="l">value / year</div></div></div>
        <div class="calc-foot">Illustrative projection from your inputs, not a medical claim. Reclaimed time reflects faster onset, deeper sleep, and clearer mornings versus a typical night. Individual results vary.</div>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="reveal"><div class="kicker">Versus the usual fixes</div><h2 class="serif">Cleaner than the <em>chemistry.</em></h2></div>
    <div class="tbl reveal">
      <div class="tbl-row tbl-head"><div>&nbsp;</div><div class="nyx">NYX-1</div><div>Caffeine</div><div>Amphetamines</div></div>
      <div class="tbl-row"><div class="feat-name">Delivers real recovery</div><div class="nyx yes">Yes</div><div class="no">No</div><div class="no">No</div></div>
      <div class="tbl-row"><div class="feat-name">Next-day crash</div><div class="nyx yes">None</div><div class="no">Yes</div><div class="no">Severe</div></div>
      <div class="tbl-row"><div class="feat-name">Tolerance &amp; dependency</div><div class="nyx yes">None</div><div class="no">Builds</div><div class="no">High risk</div></div>
      <div class="tbl-row"><div class="feat-name">Long-term health cost</div><div class="nyx yes">Supports health</div><div>Mixed</div><div class="no">Serious</div></div>
      <div class="tbl-row"><div class="feat-name">Ingested substance</div><div class="nyx yes">None</div><div class="no">Yes</div><div class="no">Yes</div></div>
    </div>
  </div>
</section>

<section class="band" id="reserve">
  <div class="wrap buy">
    <div class="buy-copy reveal">
      <div class="kicker">Reserve</div>
      <h2 class="serif">The last thing you will buy with your time.</h2>
      <p class="lede">A fully refundable $500 deposit holds your place in the first production run and your 100-night trial. If NYX-1 does not return more than it costs, send it back.</p>
      <div class="specs">
        <div class="spec"><div class="l">Form factor</div><div class="v">Bedside engine + in-ear sensor</div></div>
        <div class="spec"><div class="l">Setup</div><div class="v">Under 4 minutes, no wires to you</div></div>
        <div class="spec"><div class="l">Power</div><div class="v">Standard wall outlet</div></div>
        <div class="spec"><div class="l">App</div><div class="v">iOS &amp; Android dashboard</div></div>
      </div>
    </div>
    <div class="buy-card reveal">
      <div class="tier">NYX-1 &middot; Founders run</div>
      <div class="num mono">$4,900<small>one-time</small></div>
      <div class="fin">or $204/mo for 24 months &middot; 0% intro financing</div>
      <ul>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> NYX-1 engine and in-ear sensor</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> Adaptive optimizer, free for life</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> 100-night trial, full refund</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> 3-year hardware warranty</li>
      </ul>
      <a href="#reserve"><button class="btn btn-primary">Reserve for $500</button></a>
      <div class="reserve-note">Fully refundable &middot; applied to your purchase &middot; ships Q1</div>
    </div>
  </div>
</section>

<div class="honest">
  <div class="wrap">
    <div class="honest-box reveal">
      <h4>What NYX-1 does and does not do</h4>
      <p>NYX-1 makes real sleep more efficient and recovery faster. It does not eliminate the need to sleep, and it is not a medical device or a treatment for any condition. Some recovery, including tissue repair and hormone cycles, runs on biological time that no device can speed up. NYX-1 gets you into deep, well-timed sleep and out of it cleanly, so less of your night is wasted. Time and value figures shown above are projections from your own inputs, not guarantees.</p>
    </div>
  </div>
</div>
`;
