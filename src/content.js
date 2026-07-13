// All portfolio copy lives here. The game and the text fallback both render from this.

export const PROFILE = {
  name: 'YOHANES HUTABARAT',
  role: 'Software Quality · AI Native · Engineer',
  email: 'qa.yohanes@gmail.com',
  // Add social profiles here as { label, url } and buttons render automatically.
  socials: [],
};

// The six escaped bugs. Each one, when caught, reveals a portfolio chapter.
export const BUGS = [
  {
    id: 'nullpointer',
    name: 'NullPointerBug',
    chapter: 'About',
    lines: [
      { tone: 'bug', name: 'NullPointerBug', text: 'kzzt— undefined is not a person!! …or is it?' },
      { tone: 'me', name: 'Yohanes', text: "Gotcha! Hello stranger. I'm Yohanes, QA Lead and senior automation engineer: 8+ years across fintech, banking, e-commerce and platform teams." },
      { tone: 'me', name: 'Yohanes', text: 'My job, in one line: turning "I think it works" into "I know it works." Evidence over vibes, every release.' },
    ],
    fallbackTitle: 'About',
    fallbackBody: "Hello stranger. I'm Yohanes, QA Lead and senior automation engineer with 8+ years across fintech, banking, e-commerce and platform teams, building test strategy, automation frameworks and AI-native QA. My job, in one line: turning 'I think it works' into 'I know it works.' Evidence over vibes, every release.",
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-101 · NullPointerBug · P1-Critical\nProfile screen crashes for newly registered users.\nEnv: prod 4.12.0 · Android 14 / iOS 18 · repro 5/5' },
      { tone: 'ops', name: 'Evidence', text: '> FATAL TypeError: cannot read "avatarUrl" of null\n>   at ProfileHeader.render (profile.tsx:41)\n> GET /v1/users/me → 200 · body: { profile: null }' },
      { tone: 'me', name: 'Yohanes', text: "Root cause: the API contract allows profile:null for accounts that skipped onboarding, but the client never guards it. Fix: null-guard plus a skeleton state, and a contract test so the schema can't drift again." },
    ],
  },
  {
    id: 'offbyone',
    name: 'OffByOneBug',
    chapter: 'Journey',
    lines: [
      { tone: 'bug', name: 'OffByOneBug', text: 'i was SO close to the boundary… one step too far. classic me.' },
      { tone: 'me', name: 'Yohanes', text: "This little guy has been following me since 2017. Bukalapak test engineer first, then Gojek, then P2P-lending fintech, then Nanovest: senior QA, security operations, and now QA Lead driving modernization across 5 squads." },
      { tone: 'me', name: 'Yohanes', text: 'My philosophy hasn\'t changed since day one: quality is not by chance. It is engineered.' },
    ],
    fallbackTitle: 'Journey',
    fallbackBody: 'On the road since 2017: Bukalapak test engineer (2017–2020), then Gojek, then P2P-lending fintech, then Nanovest as senior QA, quality & security operations, and now QA Lead driving modernization across 5 squads (2,999 legacy cases migrated to Git-native specs). My philosophy has not changed since day one: quality is not by chance. It is engineered.',
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-102 · OffByOneBug · P2-Major\nTransaction history drops the last item of every page.\nEnv: web portal 2.9.1 · repro 5/5 · all paginated lists affected' },
      { tone: 'ops', name: 'Evidence', text: '> SELECT … LIMIT 20 OFFSET 20 → returns rows 21–40 ✓\n> UI renders indexes 0..18. loop guard reads: i < items.length - 1' },
      { tone: 'me', name: 'Yohanes', text: 'Root cause: a < that should be <=. The classic. The fix is one character; the deliverable is the boundary-value matrix I attached: first, last, empty, exactly-one-page. Every list component inherits it now.' },
    ],
  },
  {
    id: 'racecondition',
    name: 'RaceConditionBug',
    chapter: 'Skills',
    lines: [
      { tone: 'bug', name: 'RaceConditionBug', text: 'you only caught me because I arrived before myself—' },
      { tone: 'me', name: 'Yohanes', text: 'Caught in 4K. This one guards my toolbox: Playwright Test, WebdriverIO and Appium, in TypeScript, Python, Java and Kotlin, across API, web, mobile, performance and security testing, all wired into CI/CD.' },
      { tone: 'me', name: 'Yohanes', text: "And the newest shelf: AI-native QA. Claude-based agents, RAG, MCP-style tooling, AI test-case generation, always behind a human review gate. Testing is understanding the user, the business, AND the code." },
    ],
    fallbackTitle: 'Skills',
    fallbackBody: "Automation with Playwright Test, WebdriverIO, Appium, Selenium and Robot Framework, in TypeScript, Python, Java and Kotlin, across API, web, mobile, performance and security testing. Plus AI-native QA: Claude-based agents, RAG, MCP-style tooling and AI test-case generation, always behind a human review gate.",
    tags: ['Playwright', 'WebdriverIO', 'Appium', 'TypeScript', 'Python', 'Claude SDK', 'RAG', 'CI/CD', 'Datadog', 'GCP'],
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-103 · RaceConditionBug · P1-Critical\nDouble-tap on PAY creates duplicate transactions.\nEnv: mobile 4.12.0 · repro 3/10, timing-dependent' },
      { tone: 'ops', name: 'Evidence', text: '> 14:02:11.204 POST /v1/payments → 201 (txn_881)\n> 14:02:11.246 POST /v1/payments → 201 (txn_882)\n> same cart, same user, 42ms apart, no idempotency key' },
      { tone: 'me', name: 'Yohanes', text: 'Root cause: no idempotency on the payment endpoint AND no client debounce. Fix both layers, never just one. Then prove it stays fixed with a k6 burst test wired into CI.' },
    ],
  },
  {
    id: 'heisenbug',
    name: 'HeisenBug',
    chapter: 'Achievement',
    lines: [
      { tone: 'bug', name: 'HeisenBug', text: "you can't observe me without changing m— oh no." },
      { tone: 'me', name: 'Yohanes', text: 'Observed AND squashed. Bugs like this one are my trophies: Winner of the Techconnect Testathon 2023, Best Participant of its Hackathon, and runner-up at Bukalapak\'s back in 2019.' },
      { tone: 'me', name: 'Yohanes', text: 'Add ISC2\'s Certified in Cybersecurity (2025) to the shelf. Competitive bug hunting turns out to be excellent training for keeping production boring.' },
    ],
    fallbackTitle: 'Achievement',
    fallbackBody: 'Winner, Techconnect Testathon 2023 · Best Participant, Techconnect Hackathon & Testathon 2023 · Runner-up, Bukalapak Hackathon & Testathon 2019 · Certified in Cybersecurity (CC), ISC2 2025.',
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-104 · HeisenBug · P2-Major\nDashboard chart renders empty, in production builds only.\nRepro: 0/10 with devtools open · 7/10 without' },
      { tone: 'ops', name: 'Evidence', text: '> chart.init fires before dataset resolves (prod 12ms, dev 210ms)\n> unawaited promise in useChartData(); render wins the race\n> opening devtools slows the tab enough to "fix" it' },
      { tone: 'me', name: 'Yohanes', text: 'Root cause: an unawaited fetch that only loses the race on fast machines. Observing it changed it, hence the name. Fix: await the data with a loading state, plus a deterministic-wait test that fails without the fix.' },
    ],
  },
  {
    id: 'regression',
    name: 'RegressionBug',
    chapter: 'Projects',
    lines: [
      { tone: 'bug', name: 'RegressionBug', text: 'i came back!! i ALWAYS come back!! …unless there is an AI watching.' },
      { tone: 'me', name: 'Yohanes', text: 'Not on my island. I build agentic QA systems. OptimusQA is a QA operations cockpit: every activity is a reviewable run with live event logs, an approval inbox, a coverage map and a persistent knowledge base.' },
      { tone: 'me', name: 'Yohanes', text: 'Test cases climb a maturity ladder there, from manual to agentic to fully automated, replaying without a single model token. Its older sibling SupaQA drafts cases from Jira tickets, and a human reviews every one before it ships.' },
    ],
    fallbackTitle: 'Projects',
    fallbackBody: 'OptimusQA / Agentic QA Console (2026): a QA operations cockpit where every activity is a reviewable run, with live event logs, an approval inbox, a coverage map and a persistent knowledge base. Cases climb a maturity ladder from manual to agentic to fully automated (replayed without model tokens), on a TypeScript monorepo with Playwright Test, WebdriverIO mobile E2E, OpenAPI-generated clients and Git-native specs. Also SupaQA (2025): an LLM+RAG Slack assistant drafting test cases from Jira with human review, exporting to Xray, TestRail and Qase.',
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-105 · RegressionBug · P2-Major\nCurrency rounding bug returns, originally fixed 8 months ago.\nEnv: API v4.2 · repro 5/5' },
      { tone: 'ops', name: 'Evidence', text: '> git bisect → commit 9f2c1aa "refactor money utils"\n> the old fix survived the refactor; its regression test did not\n> test deleted in the same PR, review missed it' },
      { tone: 'me', name: 'Yohanes', text: 'Root cause: the fix had a test, the refactor dropped it, nobody noticed. My playbook change: regression suites are append-only, and deleting a test requires the same sign-off as deleting the code it guards.' },
    ],
  },
  {
    id: 'flakytest',
    name: 'FlakyTestBug',
    chapter: 'Status',
    lines: [
      { tone: 'bug', name: 'FlakyTestBug', text: 'i pass!! i fail!! i pass!! i— fine. i fail. you win.' },
      { tone: 'me', name: 'Yohanes', text: "Last one! Here's my current status: OPEN TO WORK. Remote, hybrid, or on-site, and willing to relocate for the right team. Always ready to learn and explore new technology." },
      { tone: 'me', name: 'Yohanes', text: 'If you want to talk quality, automation, or AI-assisted testing, beam a signal from the satellite dish.' },
    ],
    fallbackTitle: 'Status',
    fallbackBody: 'Open to work: remote, hybrid, or on-site, and willing to relocate for the right team. Always ready to learn and explore new technology. Want to talk quality, automation, or AI-assisted testing? Send a signal below.',
    report: [
      { tone: 'ops', name: 'Bug Report', text: 'BUG-106 · FlakyTestBug · P3-Minor\ncheckout.spec.ts fails ~1 in 12 CI runs, always passes locally.\nEvidence base: 2,000+ run history analyzed' },
      { tone: 'ops', name: 'Evidence', text: '> failures cluster on runner-03, the slowest pool\n> await click() races a 300ms slide-in animation\n> failure screenshot: button caught mid-transition' },
      { tone: 'me', name: 'Yohanes', text: 'Root cause: waiting on time instead of state around an animated element. Fix: wait for element-stable plus network-idle. Then policy: quarantined flaky tests get 7 days to be fixed or deleted. A flaky suite teaches people to ignore red.' },
    ],
  },
];

export const ALL_BUGS_DONE = [
  { tone: 'me', name: 'Yohanes', text: 'All 6 bugs squashed, 100% coverage! The island is stable again. You would make a fine QA engineer, you know.' },
  { tone: 'me', name: 'Yohanes', text: 'Want to build something together? The satellite dish is warmed up and pointing your way.' },
];

// ————— Production incident easter egg —————

export const INCIDENT = {
  // Interacting with the hidden PROD rack before the incident starts
  trigger: [
    { tone: 'ops', name: 'PROD Server', text: 'A humming rack of production servers. A sticky note reads: "DO NOT touch on Fridays." It is… probably Friday somewhere.' },
    { tone: 'alert', name: 'PAGER', text: 'BEEP BEEP BEEP. ALERT: checkout-service error rate 87% and climbing. Latency through the roof. Users are NOT smiling.' },
    { tone: 'me', name: 'Yohanes', text: 'A real production incident?! Quick, find Ops Bot near the satellite dish. Nobody firefights alone.' },
  ],
  // Talking to the NPC after trigger
  briefing: [
    { tone: 'ops', name: 'Ops Bot', text: 'beep. INCIDENT DECLARED. Grafana shows the spike started at 14:02, right after deploy #4123 rolled out.' },
    { tone: 'me', name: 'Yohanes', text: 'Correlation is not causation… but it is a great place to start. What changed in #4123?' },
    { tone: 'ops', name: 'Ops Bot', text: 'unknown. the deploy log is on the LOGS TERMINAL in the city district. i would check it myself but… i have no hands. beep.' },
  ],
  // NPC lines before the incident is triggered
  npcIdle: [
    { tone: 'ops', name: 'Ops Bot', text: 'beep. all systems nominal. error rate 0.02%. a beautiful, boring day in production. i love boring.' },
  ],
  // Logs terminal, during investigation
  investigate: [
    { tone: 'ops', name: 'Logs Terminal', text: '> 14:02 error_rate checkout-service: 0.02% → 87%\n> first bad trace: NPE at PriceCalculator.applyDiscount\n> deploy #4123 landed 14:01, sixty seconds before the spike' },
    { tone: 'ops', name: 'Logs Terminal', text: '> deploy #4123 · checkout-service\n> tests: SKIPPED (flag --skip-regression)\n> author note: "small change, no need for tests :)"' },
    { tone: 'me', name: 'Yohanes', text: 'Timeline correlation, a first bad stack frame, and a skipped gate: that\'s a confident rollback call, not a guess. And "small change, no need for tests"? The five most expensive words in software.' },
    { tone: 'me', name: 'Yohanes', text: 'Back to the PROD rack. We roll back #4123, then we make the regression suite non-skippable. Quality is engineered, remember?' },
  ],
  // Terminal before briefing
  terminalIdle: [
    { tone: 'ops', name: 'Logs Terminal', text: '> tail -f production.log\n> …all quiet. nothing to see here.' },
  ],
  // Rack, after trigger but before the investigation is done
  rackWaiting: [
    { tone: 'alert', name: 'PAGER', text: 'error rate still climbing. we need a root cause before touching anything. find Ops Bot near the satellite dish!' },
  ],
  // NPC while the logs are still unread
  npcWaitInvestigate: [
    { tone: 'ops', name: 'Ops Bot', text: 'beep. the deploy log is on the LOGS TERMINAL, in the city district next to the CI desk. i will hold the fort. by which i mean: i will beep nervously.' },
  ],
  // NPC after investigation, before rollback
  npcWaitResolve: [
    { tone: 'ops', name: 'Ops Bot', text: 'beep. root cause confirmed. get back to the PROD rack and roll back deploy #4123 before the users notice!' },
  ],
  // Back at the rack to resolve
  resolve: [
    { tone: 'me', name: 'Yohanes', text: 'Rolling back deploy #4123… restoring the last green build… and pinning the regression suite as a required gate.' },
    { tone: 'ops', name: 'PROD Server', text: 'rollback complete. error rate: 0.02%. latency: nominal. users: smiling again.' },
    { tone: 'ops', name: 'Ops Bot', text: 'beep. incident resolved in record time. postmortem scheduled. blameless, obviously. you have earned a badge.' },
    { tone: 'me', name: 'Yohanes', text: 'And THAT is the security-operations side of my work. The blameless postmortem ships three action items: the regression gate becomes non-skippable, checkout gets canary deploys, and the error-rate alert moves from 5% to 1%. Same bug never ships twice.' },
  ],
  rackResolved: [
    { tone: 'ops', name: 'PROD Server', text: 'all green. deploy #4124 (with tests!) purring in production. the sticky note has been updated: "DO NOT skip the regression suite."' },
  ],
};

// ————— The city district: real-life QA collaboration —————

export const CITY = {
  pmIntro: [
    { tone: 'ops', name: 'The PM', text: "You must be the QA engineer! Perfect timing: the release candidate shipped and SIX bugs escaped the test suite. The sprint board is a mess." },
    { tone: 'me', name: 'Yohanes', text: "On it. I'll hunt them down across the island and file a proper report for each: evidence, root cause, and the prevention step. Not just \"it's broken\"." },
    { tone: 'ops', name: 'The PM', text: 'Music to my ears. Remember the rule: if it is not on the board, it did not happen.' },
  ],
  pmWaiting: [
    { tone: 'ops', name: 'The PM', text: 'How is the hunt going? Squash them, then FILE them. I want your usual standard: evidence attached, root cause called, prevention proposed. The kanban is right behind me.' },
  ],
  pmAllFiled: [
    { tone: 'ops', name: 'The PM', text: 'Six reports, each with log evidence, a root-cause call, and a prevention item. Engineering triaged the lot in one standup, zero back-and-forth. You are welcome at my planning table any day.' },
    { tone: 'me', name: 'Yohanes', text: "That's the real job: QA isn't a gate at the end. It starts at sprint planning, in the acceptance criteria, before the first line of code." },
  ],
  kanbanEmpty: [
    { tone: 'ops', name: 'Kanban Board', text: 'TODO: 6 escaped bugs · DOING: you · DONE: nothing yet. Catch bugs out in the world first, then come back to file the reports.' },
  ],
  kanbanAllDone: [
    { tone: 'ops', name: 'Kanban Board', text: 'DONE: 6/6 bug reports. Repro steps ✓ severity ✓ screenshots ✓. This board has never looked so healthy.' },
  ],
  engineerIntro: [
    { tone: 'ops', name: 'The Engineer', text: 'Hey QA! Quick confession: I run the whole regression suite BY HAND before every merge. 45 minutes. Every. Single. Time.' },
    { tone: 'me', name: 'Yohanes', text: 'Say no more. Point me at the CI terminal. By tonight that suite runs itself on every commit.' },
  ],
  engineerWaiting: [
    { tone: 'ops', name: 'The Engineer', text: 'The CI terminal is right here by my desk. I will watch. Quietly. With enormous hope in my eyes.' },
  ],
  engineerDone: [
    { tone: 'ops', name: 'The Engineer', text: 'The pipeline just ran on my push: six minutes, all green, zero clicks. I might frame this.' },
    { tone: 'me', name: 'Yohanes', text: 'Shift-left in action: tests live next to the code, run in CI on every commit, and block the merge when they fail. Jenkins does the nagging so I never have to.' },
  ],
  ciRun: [
    { tone: 'ops', name: 'CI Terminal', text: '> scaffolding e2e specs (Playwright)…\n> wiring pipeline stage "regression"…\n> parallelizing 84 tests across 4 workers…' },
    { tone: 'ops', name: 'CI Terminal', text: '> run #1 · 84 passed · 0 failed · 6m 12s across 4 shards\n> flaky quarantine: 0 · gate: blocks merge on red\n> report → Slack + trend dashboard · trigger: every commit' },
    { tone: 'me', name: 'Yohanes', text: 'Automated. No human sacrifice required. The suite guards every merge from now on.' },
  ],
  ciAfter: [
    { tone: 'ops', name: 'CI Terminal', text: '> pipeline status: GREEN · last run 6m 12s · flaky tests: 0. A thing of beauty.' },
  ],
  designer: [
    { tone: 'ops', name: 'The Designer', text: 'QA! Perfect. Can you look at the new dialog on mobile? Something about the text contrast feels… off. And I swear a button jumps on hover.' },
    { tone: 'me', name: 'Yohanes', text: 'Already logging it: contrast below 4.5:1, layout shift on hover, and the focus ring is missing. Pixel-perfect is a team sport; design and QA see the same details.' },
  ],
  coffeeToast: 'Coffee acquired. Bug-spotting accuracy +12%',
};

// ————— The pond: what bites at the dock —————
export const FISH = [
  'a Mock Trout',
  'a Flaky Flounder',
  'a Null Perch',
  'a Regression Salmon',
  'a Heisenbass',
  'an Off-By-One Eel',
  'a Boundary Bass',
];
export const FISH_RARE = 'the GOLDEN EDGE CASE';

// the rare catch pays out an actual war story, not decoration-only loot
export const GOLDEN_FISH_DIALOG = [
  { tone: 'ops', name: 'Golden Edge Case', text: 'You caught the rarest fish in the pond: the input nobody thought a user would ever enter.' },
  { tone: 'me', name: 'Yohanes', text: 'Edge cases are where I earn my keep. The Techconnect Testathon I won in 2023 was decided in exactly these waters: empty carts, double-clicks, timezone boundaries, a name one character too long.' },
  { tone: 'me', name: 'Yohanes', text: 'Rule of thumb: if the happy path is the demo, the edge case is the incident. Fish for them before your users do.' },
];

export const HARVEST_DONE_DIALOG = [
  { tone: 'ops', name: 'The Farm', text: 'Basket full! Every ripe test case picked. …give them a minute and they will grow right back.' },
  { tone: 'me', name: 'Yohanes', text: 'That is regression testing in one picture: the same cases, harvested again on every release. It only stays this easy because the suite runs itself. Plant once, automate forever.' },
];

export const MAILBOX_DIALOG = [
  { tone: 'ops', name: 'Mailbox', text: 'The little red flag is up! One (1) blank letter inside, addressed to: whoever wants to build something great.' },
  { tone: 'me', name: 'Yohanes', text: 'That would be you. Want to write back?' },
];

export const DISH_DIALOG = [
  { tone: 'ops', name: 'Satellite Dish', text: 'TRANSMITTER READY. Connection established. Status: OPEN TO WORK. remote · hybrid · relocation-ready.' },
  { tone: 'me', name: 'Yohanes', text: 'Every great project starts with a simple conversation. Send me a signal!' },
];

// Fallback-only extras
export const FALLBACK_INCIDENT = {
  title: 'War story: the production incident',
  body: 'Hidden in the server graveyard at the island\'s dark north edge is a production incident: a deploy that skipped the regression suite takes checkout down. You triage it with Ops Bot: read the dashboard spike, find the root cause in the deploy log, roll back, and pin the test gate so it can never be skipped again. That is the security-operations side of my work: WAF and monitoring dashboards, root-cause analysis, safe rollbacks, blameless postmortems.',
};

export const FALLBACK_REPORT = {
  title: 'How I file a bug',
  body: 'Every bug caught in the world is filed on the kanban as a real report; here is one. BUG-103 · RaceConditionBug · P1-Critical: double-tap on PAY creates duplicate transactions (repro 3/10, timing-dependent). Evidence: two POST /v1/payments 42ms apart, both 201, same cart, no idempotency key. Root cause: no server-side idempotency AND no client debounce. Fix both layers, never just one, then prove it stays fixed with a k6 burst test in CI. Severity and repro steps are table stakes; evidence, root cause and prevention are what make a report actionable.',
};

export const FALLBACK_CITY = {
  title: 'How I work with the team',
  body: 'The island has a little city district where the job actually happens: a PM with a kanban board (every bug you catch gets filed with evidence, root cause and prevention), an engineer whose 45-minute manual regression suite gets automated into a green CI pipeline, and a designer who knows QA will catch the contrast and layout-shift details. Quality is a team sport; QA sits at the table from sprint planning to postmortem. There is also a piano by a pond, and a farm with chickens, because playfulness is part of craft.',
};
