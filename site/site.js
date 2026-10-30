// FireworX Studio — Presentation, i18n & Interactive Starfield. No MIDI acquisition on root.
document.documentElement.classList.add('js');
// Preserve explicit legacy editor deep links without mounting MIDI on the presentation page.
const initialParams = new URLSearchParams(location.search);
if (initialParams.has('editor') || initialParams.has('workspace') || initialParams.has('midi') || initialParams.has('manual')) {
  location.replace(new URL('./editor/' + location.search + location.hash, location.href));
}

// -------------------------------------------------------------
// 1. INTERNATIONALIZATION (i18n) — English & French
// -------------------------------------------------------------
const translations = {
  en: {
    doc_title: 'FireworX Studio & Librarian — MIDI Studio',
    doc_desc: 'FireworX Studio: browser editor, 8×8 signal matrix, modulation matrix, local librarian, and seeded DSP variation studio for the FireworX multi-effects processor (OS 2.00+).',
    skip_link: 'Skip to content',
    nav_brand_aria: 'FireworX Studio, home',
    nav_main_aria: 'Main navigation',
    nav_duo: 'Workspaces',
    nav_features: 'Features',
    nav_workflow: 'Routing & P0',
    nav_roadmap: 'Roadmap',
    nav_manual: 'User Manual',
    lang_switch_aria: 'Language selection',
    stars_label: 'Stars',
    nav_cta: 'Quick start',
    hero_eyebrow: 'MIDI Studio · FireworX OS 2.00+ · alpha v0.1.0-alpha.1',
    hero_subtitle: 'Studio <i>&amp;</i> Librarian',
    hero_copy: 'Your 8×8 routing matrix. Your 38 multi-effect algorithms. Your modulation links.<br>A visual browser editor, local librarian, and seeded variation studio with guarded P0 SysEx transport.',
    hero_btn_editor: 'Explore the workspaces',
    hero_btn_open: 'Open editor',
    hero_btn_manual: 'Illustrated User Manual',
    hero_img_hw_src: './site/assets/en-hardware.png',
    hero_img_hw_alt: 'FireworX Studio 1U hardware rack facade showing LCD routing matrix, input/output level meters, 12 effect family keys, Recall/Store/Effects/Mod buttons, and Parameter/Value/Alpha Mod wheels',
    hero_img_chain_src: './site/assets/en-chain.png',
    hero_img_chain_alt: 'FireworX Studio signal chain matrix showing Delay 1 Stereo, Filters 1 Resochord, and Chorus 1 Advanced Flanger wired in series',
    hero_img_settings_src: './site/assets/en-settings.png',
    hero_img_settings_alt: 'FireworX Studio block settings page showing Input on the left, Time and Feedback parameters in the middle, and Output routing on the right',
    hero_caption: 'FireworX Studio · Hardware 1U Facade, Signal Matrix & Three-Column Block Inspector ("Prism Echo" preset)',
    hero_tag_1: 'Hardware & Modern Facades · 8×8 Signal Matrix',
    hero_tag_2: 'Modulation Matrix · Alpha & Ext 1–8 MIDI Learn',
    hero_tag_3: 'Local Librarian · Seeded Randomizer & Protected P0',
    duo_eyebrow: '01 / Three complementary views',
    duo_title: 'Chain, Modulate &amp; Organize.<br><span>One unified studio.</span>',
    duo_lead: 'FireworX Studio brings together the complete architecture of the FireworX: dual hardware/modern facades with an 8×8 routing matrix, a visual source-to-parameter modulation matrix, and a progressive preset librarian with seeded variations.',
    tab_switch_aria: 'Discover the workspaces',
    tab_matrix: 'Facade & Matrix',
    tab_matrix_sub: '38 Algorithms · 8×8 Grid',
    tab_modulation: 'Modulation & Alpha',
    tab_modulation_sub: 'Matrix · Ext 1–8 · Freeform',
    tab_librarian: 'Librarian & Randomize',
    tab_librarian_sub: 'Banks · Seeded DSP',
    matrix_window_title: 'FireworX Studio — Hardware Facade, Signal Matrix & Block Settings',
    matrix_window_note: 'OS 2.00+ · P0 Verified',
    matrix_hw_src: './site/assets/en-hardware.png',
    matrix_hw_alt: 'FireworX 1U hardware rack facade with LCD matrix and rotary encoders',
    matrix_settings_src: './site/assets/en-settings.png',
    matrix_settings_alt: 'Three-column block inspector with Input, Parameters, and Output controls',
    matrix_eyebrow: 'Sculpt the signal path',
    matrix_title: '8×8 routing matrix,<br>38 decoded algorithms.',
    matrix_lead: 'Switch between the faithful 1U hardware rack facade and the flat modern console view. Add, move, swap, or mute blocks across 12 effect families and inspect every parameter on a single three-column page.',
    matrix_li_1: 'Hardware and modern facades with native Factory (1–400), User (1–200), and Card (1–800) preset recall',
    matrix_li_2: 'Compact 6-column matrix expanding automatically up to the full 8×8 routing grid with series/parallel wiring',
    matrix_li_3: '38 algorithms across 12 families (Dynamic, Filters, Formant, Distort, Vocode, Synth, Pitch, Chorus, Delay, Reverb, Pan, EQ) and 1,251 mapped fields',
    matrix_li_4: 'Copy and paste individual effects between presets while preserving destination routing, mute state, and modulation links',
    matrix_link: 'Open editor',
    matrix_manual_link: 'Read signal chain manual',
    matrix_demo_note: 'Runs in Chrome, Edge, Brave, and Opera via Web MIDI API, or 100% offline for preset preparation.',
    modulation_window_title: 'FireworX Studio — Source × Parameter Modulation Matrix',
    modulation_window_note: 'Alpha · Ext 1–8 · Freeform',
    modulation_img_src: './site/assets/en-modulation.png',
    modulation_img_alt: 'FireworX Studio modulation matrix linking Alpha Mod, Ext 1-8, ADSR, LFO, and Freeform modifiers to effect parameters',
    modulation_eyebrow: 'Dynamic movement & external control',
    modulation_title: 'Every source, every cord,<br>at a single glance.',
    modulation_lead: 'Bind internal modifiers and external controllers directly on a visual matrix: one row per modulation source, one column per modulatable block parameter, with live MIDI flash feedback.',
    modulation_li_1: 'Click any cell to create or inspect a modulation cord: Low, Mid, High, Slope, and Glide parameters',
    modulation_li_2: 'Internal modifiers (ADSR 1–2, LFO 1–2, Freeform, Function, Pitch & Envelope detectors) plus Alpha & Ext 1–8',
    modulation_li_3: 'Freeform curve editor: draw 1–32 samples by hand or record up to 10 seconds of live Alpha movement',
    modulation_li_4: 'Dedicated external MIDI controller input with MIDI Learn for Alpha and Ext 1–8 without interrupting SysEx safety',
    modulation_link: 'Explore Modulation Matrix',
    modulation_manual_link: 'Modulation & CTRL guide',
    modulation_demo_note: 'Browser MIDI Learn configures your local controller profile; match it to your hardware I/O SETUP → CTRL assignments.',
    librarian_window_title: 'FireworX Studio — Preset Librarian & Seeded DSP Randomizer',
    librarian_window_note: 'IndexedDB · Byte-Exact .syx',
    librarian_lib_src: './site/assets/en-library.png',
    librarian_lib_alt: 'FireworX Studio preset librarian showing Factory, User, Card, and Local banks with SHA-256 verification',
    librarian_rand_src: './site/assets/en-randomize.png',
    librarian_rand_alt: 'FireworX Studio Randomize tool showing seeded block and routing variations within a 98% DSP budget',
    librarian_eyebrow: 'Preserve, classify & generate',
    librarian_title: 'Progressive bank reads.<br>Reproducible variations.',
    librarian_lead: 'Acquire Factory, User, and Card banks progressively, organize local favourites and tags with byte-exact SysEx preservation, and generate deterministic seeded variations within an estimated DSP budget.',
    librarian_li_1: 'Read page, Read bank, and Resume unread locations progressively without losing already-captured presets',
    librarian_li_2: 'Byte-exact preservation of all 2,745 expanded Data20 bytes, including undecoded fields and SHA-256 digests',
    librarian_li_3: 'Guarded STORE mode: backs up the destination slot, verifies source & target, writes, and reads back',
    librarian_li_4: 'Seeded Randomizer (Parameters, Structure, or Blocks + Routing) with block locks and shared 1–108% DSP ceiling',
    librarian_link: 'Open Librarian & Randomizer',
    librarian_local_link: 'Quick start & local setup',
    librarian_demo_note: 'All presets, banks, and MIDI journals stay locally in your browser (LocalStorage / IndexedDB) until you export .json or .syx files.',
    features_eyebrow: '02 / Under the hood',
    features_title: 'Guarded precision,<br><span>down to the SysEx nibble.</span>',
    features_lead: 'Every edit respects the FireworX OS 2.00+ protocol: dual-read connection verification, short Data21 parameter writes, complete Data20 structural transactions, and full unknown-byte preservation.',
    feat_1_title: 'Hardware & Modern Facades.',
    feat_1_desc: 'Switch seamlessly between the 1U rack front panel with live SVG LCD projection and a flat modern layout, across 5 curated color palettes (Porcelain/Cobalt default, Graphite, Slate, Sand, Heritage) and 3 workspace layouts.',
    feat_1_tag: '2 Facades · 5 Themes · 3 Layouts',
    feat_2_title: '8×8 Matrix & 38 Algorithms.',
    feat_2_desc: 'Build series and parallel chains across 12 effect families and 38 algorithms. Enforces hardware instance quotas, valid routing paths, and feedback/Insert protections.',
    feat_2_tag: '38 Algorithms · 12 Families · 1,251 Fields',
    feat_3_title: 'Visual Modulation & Freeform.',
    feat_3_desc: 'Map Alpha, Ext 1–8, ADSR, LFO, detectors, and 32-point Freeform curves on an interactive grid. Live MIDI input flashes active rows, links, and target controls.',
    feat_3_tag: 'Modulation Matrix & MIDI Learn',
    feat_4_title: 'Seeded Randomizer & DSP Ceiling.',
    feat_4_desc: 'Draw reproducible variations of Parameters, Structure, or Blocks + Routing from your local corpus. Lock blocks to keep, adjust the 1–108% estimated DSP ceiling, and preview before applying.',
    feat_4_tag: 'Deterministic Seeds · DSP Estimate',
    feat_5_title: 'Guarded P0 SysEx Transport.',
    feat_5_desc: 'Requires two identical P0 reads before enabling live writes. Uses short Data21 frames for proven scalar fields and verified 2,745-byte Data20 images with an enforced ~8.9 s settle period for structural edits.',
    feat_5_tag: 'Dual-Read P0 · Data20 / Data21 Verification',
    feat_6_title: 'Local Librarian & Offline Manual.',
    feat_6_desc: 'Store banks, tags, and MIDI journals in browser IndexedDB, export .json/.syx archives, and read the built-in EN/FR illustrated manual with single-file offline HTML export.',
    feat_6_tag: 'IndexedDB · .syx / .json · EN/FR Manual',
    wf_eyebrow: '03 / Protected architecture',
    wf_title: 'Choose your workflow.',
    wf_lead: 'Synchronized Web MIDI control of the temporary P0 edit buffer, or 100% offline preset preparation, library management, and seeded randomization.',
    wf_toggle_aria: 'Choose illustrated workflow',
    wf_btn_agent: 'Live Web MIDI · Guarded P0',
    wf_btn_browser: 'Offline Prep & Variations',
    wf_route_aria: 'Routing schema',
    wf_node_left: 'FireworX Processor (OS 2.00+)',
    wf_sub_left: 'MIDI In & Out · Device ID 0–127',
    wf_sub_agent: 'Guarded Transport & Librarian',
    wf_node_dest: 'P0 Buffer · User & Card Banks',
    wf_sub_dest: 'Data21 Scalars · Data20 Structural + Readback',
    wf_exp_agent: 'FireworX Studio connects via bidirectional Web MIDI (DIN or RTP/mioXL). After two matching P0 buffer reads ("Live · verified"), parameter tweaks use short Data21 writes while structural changes use complete Data20 images with comparison read, readback, and an ~8.9 s settle window.',
    wf_note_1_title: 'Two-read P0 synchronization',
    wf_note_1_desc: 'Connecting never overwrites the unit with a stale browser draft: two identical P0 replies (F0 00 20 1F 00 40 45 00 00 F7) are required before live editing unlocks.',
    wf_note_2_title: 'Enforced structural settle',
    wf_note_2_desc: 'Complete 2,745-byte P0 structural writes enforce an ~8.9 s quiet window without competing GET, CC, or Clock messages, coalescing gestures safely.',
    wf_note_3_title: 'Zero backend, 100% local',
    wf_note_3_desc: 'All presets, libraries, and MIDI journals remain in your browser profile. No cloud account, telemetry, or external server is ever contacted.',
    rm_eyebrow: '04 / Transparency & scope',
    rm_title: 'What’s here now.<br><span>Known alpha boundaries.</span>',
    rm_lead: 'Delivered capabilities in v0.1.0-alpha.1 and documented hardware/protocol boundaries to keep in mind.',
    rm_badge_ready: 'Available in v0.1.0-alpha.1',
    rm_ready_1: 'Hardware 1U rack and Modern facades with 5 color themes and 3 workspace layouts (Studio, Console, Focus)',
    rm_ready_2: 'Compact-to-8×8 signal matrix, 38 algorithms across 12 families, and 3-column block settings inspector',
    rm_ready_3: 'Interactive modulation matrix, link editor (Low/Mid/High/Slope/Glide), Freeform curve editor & Alpha/Ext MIDI Learn',
    rm_ready_4: 'Local IndexedDB librarian with progressive bank reads (Read page, Read bank, Resume unread) and effect copy/paste',
    rm_ready_5: 'Seeded Randomizer (Parameters, Structure, Blocks + routing) with block locks and shared 1–108% DSP budget',
    rm_ready_6: 'Guarded P0 transport with dual-read connect, Data21/Data20 verification, guarded User/Card STORE & live MIDI monitor',
    rm_ready_7: 'Byte-exact preservation of undecoded SysEx bytes across .syx and .json imports/exports',
    rm_ready_8: 'Bilingual EN/FR interface and built-in illustrated manual with self-contained offline HTML export',
    rm_ready_note: 'Seven offline synthetic verification suites run automatically before every build. <a href="./editor/">Open editor</a>',
    rm_badge_planned: 'Documented alpha boundaries & pending qualification',
    rm_plan_1: 'Protocol target is FireworX OS 2.00+; not a certification of every firmware version, MIDI interface, or memory card.',
    rm_plan_2: 'Controls external hardware via MIDI/SysEx only; does not process audio or receive hardware level/gain-reduction/CPU telemetry.',
    rm_plan_3: 'User/Card STORE backs up the destination slot and verifies readback; complete hardware qualification and retention across power-off remain pending.',
    rm_plan_4: 'The DSP percentage (1–108%) is an additive software estimate, not a hardware DSP counter or overload guarantee.',
    rm_plan_5: 'Global I/O SETUP → CTRL read/write and global BPM readback are not established; packed User dumps require expanded per-preset reads for editing.',
    rm_hw_title: 'Built-in Illustrated User Manual (EN / FR)',
    rm_hw_desc: 'Read the complete illustrated guide covering bidirectional MIDI setup, P0 vs STORE workflows, modulation links, and troubleshooting directly in the editor.',
    rm_hw_btn: 'Open Illustrated Manual in Editor',
    rm_plan_note: 'Independent community alpha software. Always keep exported .syx / .json backups of your presets.',
    faq_eyebrow: 'Key questions',
    faq_title: 'Before you start.',
    faq_q1: 'Does FireworX Studio risk overwriting my hardware presets when I connect?',
    faq_a1: 'No. Connecting reads P0 twice and waits for two identical responses ("Live · verified") before enabling live edits. It never automatically transmits an old draft from browser storage upon connection, and temporary P0 editing is strictly separate from persistent User/Card STORE.',
    faq_q2: 'How do I connect my FireworX via Web MIDI?',
    faq_a2: 'Connect both MIDI directions (Computer Out → FireworX In AND FireworX Out → Computer In). Open the editor in a Chromium browser (Chrome, Edge, Brave, Opera), allow MIDI/SysEx access, and open MIDI / Buffer if you need to pick your input/output ports or SysEx Device ID explicitly.',
    faq_q3: 'Can I use FireworX Studio without a FireworX plugged in?',
    faq_a3: 'Yes. Without MIDI permission or hardware, you can build signal chains, edit all 38 algorithms and modulation links, import/export .syx and .json files, organize local banks, and generate seeded variations.',
    faq_q4: 'Why is there an ~8.9 second pause after adding, moving, or deleting a block?',
    faq_a4: 'Structural edits (changing the matrix, adding/removing blocks, or changing unverified routing fields) require sending a complete 2,745-byte Data20 P0 image. The FireworX hardware needs at least 8 seconds after wire transmission to settle before accepting new GET, CC, or Clock messages.',
    faq_q5: 'How does the Seeded Randomizer protect my signal chain?',
    faq_a5: 'You can lock any block you want to preserve, choose between Parameters, Structure, or Blocks + Routing variations, and set a deterministic seed. Variations respect instance quotas, valid routing rules, feedback/Insert protections, and your configured DSP budget ceiling before you preview or apply them.',
    faq_q6: 'Where are my presets, libraries, and MIDI logs stored?',
    faq_a6: 'Everything stays locally in your browser profile (LocalStorage and IndexedDB) scoped to the site origin. Nothing is uploaded to any server. Use the disk icon and Library export tools to keep portable .json and .syx backups on your computer.',
    closing_eyebrow: 'Ready to explore',
    closing_title: 'Shape your signal matrix.<br><span>Explore new sonic architectures.</span>',
    closing_cta: 'Open editor',
    closing_manual: 'Open Illustrated Manual',
    closing_note: 'Independent open-source community project · Built on MIDI Studio',
    footer_tagline: 'Browser Editor, Signal Matrix, Modulation Studio & Preset Librarian for the FireworX multi-effects processor.',
    footer_col_app: 'Application',
    footer_link_editor: 'Launch FireworX Editor',
    footer_link_manual: 'Illustrated User Manual',
    footer_link_quickstart: 'Quick Start Guide',
    footer_col_docs: 'Workspace & Sections',
    footer_link_workspaces: 'Facade, Matrix & Librarian',
    footer_link_features: '38 Algorithms & Modulations',
    footer_link_routing: 'Guarded P0 Transport',
    footer_link_roadmap: 'Alpha Scope & Limitations',
    footer_col_project: 'Project & Privacy',
    footer_link_github: 'GitHub Repository',
    footer_link_readme_en: 'Documentation (EN)',
    footer_link_readme_fr: 'Documentation (FR)',
    footer_legal: '&copy; 2026 MIDI Studio Project. Independent community tool built for musicians and sound designers; not affiliated with the maker of the hardware unit.',
    footer_top: '↑ Top',
    modal_title: 'Get Started with FireworX Studio',
    modal_close_aria: 'Close dialog',
    modal_intro: 'FireworX Studio works directly in your browser with zero installation, both online and offline, or from a local Vite development server.',
    modal_sec1_title: '1. Instant Browser Access (Recommended)',
    modal_sec1_desc: 'Open the editor in Chrome, Edge, Brave, or Opera. Connect both MIDI In and MIDI Out to your FireworX (OS 2.00+), allow Web MIDI / SysEx access, and wait for "Live · verified".',
    modal_sec1_btn: 'Open editor',
    modal_sec2_title: '2. Run Locally via Vite Dev Server',
    modal_sec2_desc: 'Clone the repository and run the local development server on your machine:',
    modal_sec2_note: 'Then open http://127.0.0.1:5173/editor/ in a Web MIDI compatible browser.',
    modal_sec3_title: '3. Read the Illustrated User Manual',
    modal_sec3_desc: 'Consult the bilingual EN/FR manual inside the editor (with offline single-file HTML export) for detailed P0, STORE, Modulation, and Randomize workflows:',
    modal_sec3_btn: 'Open Illustrated Manual'
  },
  fr: {
    doc_title: 'FireworX Studio & Bibliothèque — MIDI Studio',
    doc_desc: 'FireworX Studio : éditeur web, matrice de routage 8×8, matrice de modulation, bibliothèque locale et générateur de variations DSP pour le multi-effets FireworX (OS 2.00+).',
    skip_link: 'Aller au contenu',
    nav_brand_aria: 'FireworX Studio, accueil',
    nav_main_aria: 'Navigation principale',
    nav_duo: 'Espaces',
    nav_features: 'Fonctionnalités',
    nav_workflow: 'Routage & P0',
    nav_roadmap: 'Disponibilité',
    nav_manual: 'Manuel illustré',
    lang_switch_aria: 'Sélection de langue',
    stars_label: 'Étoiles',
    nav_cta: 'Démarrage rapide',
    hero_eyebrow: 'MIDI Studio · FireworX OS 2.00+ · alpha v0.1.0-alpha.1',
    hero_subtitle: 'Studio <i>&amp;</i> Bibliothèque',
    hero_copy: 'Votre matrice de routage 8×8. Vos 38 algorithmes multi-effets. Vos liens de modulation.<br>Un éditeur visuel dans le navigateur, bibliothécaire de presets et atelier de variations avec transport SysEx P0 protégé.',
    hero_btn_editor: 'Explorer les espaces',
    hero_btn_open: 'Ouvrir l’éditeur',
    hero_btn_manual: 'Manuel utilisateur illustré',
    hero_img_hw_src: './site/assets/fr-hardware.png',
    hero_img_hw_alt: 'Façade matérielle 1U de FireworX Studio montrant l’écran LCD de routage, les indicateurs de niveau, les 12 touches de familles d’effets, Recall/Store et les molettes Parameter/Value/Alpha Mod',
    hero_img_chain_src: './site/assets/fr-chain.png',
    hero_img_chain_alt: 'Matrice de chaîne du signal FireworX Studio montrant Delay 1 Stereo, Filters 1 Resochord et Chorus 1 Advanced Flanger câblés en série',
    hero_img_settings_src: './site/assets/fr-settings.png',
    hero_img_settings_alt: 'Page de réglages d’un bloc FireworX Studio avec Entrée à gauche, paramètres au centre et Sortie à droite',
    hero_caption: 'FireworX Studio · Façade matérielle 1U, Matrice du signal & Inspecteur de bloc en trois colonnes (preset « Prism Echo »)',
    hero_tag_1: 'Façades matérielle & moderne · Matrice 8×8',
    hero_tag_2: 'Matrice de modulation · MIDI Learn Alpha & Ext 1–8',
    hero_tag_3: 'Bibliothèque locale · Variations par seed & P0 protégé',
    duo_eyebrow: '01 / Trois vues complémentaires',
    duo_title: 'Chaîner, Moduler &amp; Classer.<br><span>Un même atelier de création.</span>',
    duo_lead: 'FireworX Studio réunit toute l’architecture du FireworX : double façade matérielle/moderne avec matrice de routage 8×8, matrice visuelle des modulations sources × paramètres, et bibliothèque progressive avec générateur de variations.',
    tab_switch_aria: 'Découvrir les espaces de travail',
    tab_matrix: 'Façade & Matrice',
    tab_matrix_sub: '38 algorithmes · Grille 8×8',
    tab_modulation: 'Modulations & Alpha',
    tab_modulation_sub: 'Matrice · Ext 1–8 · Freeform',
    tab_librarian: 'Bibliothèque & Randomize',
    tab_librarian_sub: 'Banques · Variations DSP',
    matrix_window_title: 'FireworX Studio — Façade matérielle, Matrice du signal & Réglages de bloc',
    matrix_window_note: 'OS 2.00+ · P0 vérifié',
    matrix_hw_src: './site/assets/fr-hardware.png',
    matrix_hw_alt: 'Façade matérielle 1U FireworX avec écran LCD de routage et encodeurs rotatifs',
    matrix_settings_src: './site/assets/fr-settings.png',
    matrix_settings_alt: 'Inspecteur de bloc en trois colonnes avec Entrée, Paramètres et Sortie',
    matrix_eyebrow: 'Sculpter le chemin du signal',
    matrix_title: 'Matrice de routage 8×8,<br>38 algorithmes décodés.',
    matrix_lead: 'Basculez entre la façade rack 1U fidèle à l’appareil et la vue console moderne. Ajoutez, déplacez, permutez ou mutez des blocs parmi 12 familles d’effets et réglez chaque paramètre sur une seule page à trois colonnes.',
    matrix_li_1: 'Façades matérielle et moderne avec rappel natif des banques Factory (1–400), User (1–200) et Carte (1–800)',
    matrix_li_2: 'Matrice compacte à 6 colonnes s’étendant automatiquement jusqu’à la grille complète 8×8 en série ou parallèle',
    matrix_li_3: '38 algorithmes répartis en 12 familles (Dynamic, Filters, Formant, Distort, Vocode, Synth, Pitch, Chorus, Delay, Reverb, Pan, EQ) et 1 251 champs cartographiés',
    matrix_li_4: 'Copie et collage d’un effet entre presets en conservant la position, le Mute et les liens de modulation de destination',
    matrix_link: 'Ouvrir l’éditeur',
    matrix_manual_link: 'Lire le manuel de la chaîne',
    matrix_demo_note: 'Fonctionne dans Chrome, Edge, Brave et Opera via Web MIDI, ou 100 % hors ligne pour préparer vos presets.',
    modulation_window_title: 'FireworX Studio — Matrice de modulation Sources × Paramètres',
    modulation_window_note: 'Alpha · Ext 1–8 · Freeform',
    modulation_img_src: './site/assets/fr-modulation.png',
    modulation_img_alt: 'Matrice de modulation FireworX Studio reliant Alpha Mod, Ext 1-8, ADSR, LFO et Freeform aux paramètres des blocs',
    modulation_eyebrow: 'Mouvement dynamique & contrôle externe',
    modulation_title: 'Chaque source, chaque lien,<br>d’un seul coup d’œil.',
    modulation_lead: 'Reliez les modificateurs internes et contrôleurs externes directement dans une grille visuelle : une ligne par source, une colonne par paramètre modulable, avec scintillement en direct à la réception MIDI.',
    modulation_li_1: 'Cliquez une case pour créer ou inspecter un lien de modulation : réglages Low, Mid, High, Slope et Glide',
    modulation_li_2: 'Modificateurs internes (ADSR 1–2, LFO 1–2, Freeform, Function, détecteurs Pitch & Envelope) ainsi qu’Alpha & Ext 1–8',
    modulation_li_3: 'Éditeur Freeform : dessinez une courbe de 1 à 32 échantillons ou enregistrez jusqu’à 10 secondes de mouvement Alpha',
    modulation_li_4: 'Entrée dédiée pour contrôleur MIDI externe avec MIDI Learn pour Alpha et Ext 1–8 sans perturber les transactions SysEx',
    modulation_link: 'Explorer la matrice de modulation',
    modulation_manual_link: 'Guide Modulations & CTRL',
    modulation_demo_note: 'Le MIDI Learn configure le profil local du navigateur ; faites-le correspondre aux affectations I/O SETUP → CTRL de la machine.',
    librarian_window_title: 'FireworX Studio — Bibliothèque de presets & Variations DSP par seed',
    librarian_window_note: 'IndexedDB · .syx à l’octet près',
    librarian_lib_src: './site/assets/fr-library.png',
    librarian_lib_alt: 'Bibliothèque de presets FireworX Studio montrant les banques Factory, User, Carte et locales avec empreinte SHA-256',
    librarian_rand_src: './site/assets/fr-randomize.png',
    librarian_rand_alt: 'Outil Randomize de FireworX Studio montrant une variation de blocs et routage dans un budget DSP de 98 %',
    librarian_eyebrow: 'Conserver, classer & générer',
    librarian_title: 'Lecture progressive des banques.<br>Variations reproductibles.',
    librarian_lead: 'Acquérez progressivement les banques Factory, User et Carte, organisez vos favoris et étiquettes avec conservation intégrale des octets SysEx, et générez des variations reproductibles par seed dans un budget DSP maîtrisé.',
    librarian_li_1: 'Lire cette page, Lire la banque et Reprendre les emplacements non lus sans perdre les copies déjà acquises',
    librarian_li_2: 'Conservation exacte des 2 745 octets Data20 étendus, y compris les octets non décodés et l’empreinte SHA-256',
    librarian_li_3: 'Mode STORE protégé : sauvegarde préalable de la destination, contrôle source/cible, écriture puis relecture',
    librarian_li_4: 'Randomize par seed (Paramètres, Structure ou Blocs + routage) avec verrouillage de blocs et plafond DSP 1–108 %',
    librarian_link: 'Ouvrir la Bibliothèque & Randomize',
    librarian_local_link: 'Démarrage rapide & mode local',
    librarian_demo_note: 'Tous les presets, banques et journaux MIDI restent dans le profil de votre navigateur (LocalStorage / IndexedDB) jusqu’à l’export .json ou .syx.',
    features_eyebrow: '02 / Sous le capot',
    features_title: 'Précision protégée,<br><span>jusqu’au demi-octet SysEx.</span>',
    features_lead: 'Chaque action respecte le protocole FireworX OS 2.00+ : synchronisation par double lecture P0, écritures courtes Data21, transactions structurelles Data20 vérifiées et préservation des octets inconnus.',
    feat_1_title: 'Façades matérielle & moderne.',
    feat_1_desc: 'Passez librement de la façade rack 1U avec projection SVG de l’écran LCD à la vue moderne plate, parmi 5 palettes (Porcelaine/Cobalt par défaut, Graphite, Ardoise, Sable, Héritage) et 3 dispositions.',
    feat_1_tag: '2 façades · 5 thèmes · 3 dispositions',
    feat_2_title: 'Matrice 8×8 & 38 algorithmes.',
    feat_2_desc: 'Construisez des chaînes en série et en parallèle parmi 12 familles d’effets et 38 algorithmes. Vérifie les quotas d’instances, la validité des connexions et les protections feedback/Insert.',
    feat_2_tag: '38 algorithmes · 12 familles · 1 251 champs',
    feat_3_title: 'Modulations visuelles & Freeform.',
    feat_3_desc: 'Reliez Alpha, Ext 1–8, ADSR, LFO, détecteurs et courbes Freeform 32 points sur une grille interactive. Les valeurs MIDI entrantes font scintiller la source, le lien et le paramètre modulé.',
    feat_3_tag: 'Matrice de modulation & MIDI Learn',
    feat_4_title: 'Randomize par seed & budget DSP.',
    feat_4_desc: 'Tirez des variations reproductibles (Paramètres, Structure ou Blocs + routage) depuis votre corpus local. Verrouillez les blocs à garder, réglez le plafond DSP estimé (1–108 %) et prévisualisez avant d’appliquer.',
    feat_4_tag: 'Seeds déterministes · Estimation DSP',
    feat_5_title: 'Transport SysEx P0 protégé.',
    feat_5_desc: 'Exige deux lectures P0 identiques avant d’autoriser l’écriture live. Utilise des trames courtes Data21 pour les paramètres scalaires éprouvés et des images complètes Data20 (2 745 octets) avec pause de ~8,9 s pour la structure.',
    feat_5_tag: 'Double lecture P0 · Vérification Data20 / Data21',
    feat_6_title: 'Bibliothèque locale & manuel hors ligne.',
    feat_6_desc: 'Classez vos banques, étiquettes et journaux MIDI dans IndexedDB, exportez vos archives .json/.syx et consultez le manuel illustré FR/EN intégré avec export HTML autonome.',
    feat_6_tag: 'IndexedDB · .syx / .json · Manuel FR/EN',
    wf_eyebrow: '03 / Architecture protégée',
    wf_title: 'Choisissez votre mode de travail.',
    wf_lead: 'Pilotage Web MIDI synchronisé du buffer temporaire P0, ou préparation 100 % hors ligne de vos chaînes, bibliothèques et variations.',
    wf_toggle_aria: 'Choisir le flux illustré',
    wf_btn_agent: 'Web MIDI en direct · P0 protégé',
    wf_btn_browser: 'Préparation hors ligne & Variations',
    wf_route_aria: 'Schéma de routage',
    wf_node_left: 'Processeur FireworX (OS 2.00+)',
    wf_sub_left: 'MIDI In & Out · Device ID 0–127',
    wf_sub_agent: 'Transport protégé & Bibliothèque',
    wf_node_dest: 'Buffer P0 · Banques User & Carte',
    wf_sub_dest: 'Scalaires Data21 · Structure Data20 + Relecture',
    wf_exp_agent: 'FireworX Studio se connecte en Web MIDI bidirectionnel (DIN ou RTP/mioXL). Après deux lectures identiques du buffer P0 (« En direct · relu »), les réglages utilisent des écritures courtes Data21 tandis que les changements de structure passent par une image complète Data20 avec lecture de comparaison, relecture et fenêtre calme de ~8,9 s.',
    wf_note_1_title: 'Synchronisation P0 à double lecture',
    wf_note_1_desc: 'La connexion n’écrase jamais l’appareil avec un ancien brouillon du navigateur : deux réponses P0 identiques (F0 00 20 1F 00 40 45 00 00 F7) sont requises avant d’activer l’édition en direct.',
    wf_note_2_title: 'Fenêtre calme structurelle garantie',
    wf_note_2_desc: 'Toute écriture structurelle complète (2 745 octets dans P0) impose une pause minimale d’environ 8,9 s sans GET, CC ni Clock concurrents, en fusionnant proprement les gestes.',
    wf_note_3_title: 'Zéro serveur, 100 % local',
    wf_note_3_desc: 'Presets, banques et journaux MIDI restent dans le profil de votre navigateur. Aucun compte cloud, télémétrie ou serveur applicatif externe n’est sollicité.',
    rm_eyebrow: '04 / Transparence & périmètre',
    rm_title: 'Ce qui est disponible.<br><span>Limites alpha documentées.</span>',
    rm_lead: 'Fonctionnalités livrées en v0.1.0-alpha.1 et limites matérielles/protocolaires documentées à connaître.',
    rm_badge_ready: 'Disponible en alpha v0.1.0-alpha.1',
    rm_ready_1: 'Façades matérielle 1U et moderne avec 5 thèmes de couleur et 3 dispositions (Studio, Console, Focus)',
    rm_ready_2: 'Matrice du signal compacte jusqu’à 8×8, 38 algorithmes en 12 familles et inspecteur de bloc en 3 colonnes',
    rm_ready_3: 'Matrice de modulation interactive, éditeur de lien (Low/Mid/High/Slope/Glide), courbe Freeform & MIDI Learn Alpha/Ext',
    rm_ready_4: 'Bibliothèque locale IndexedDB avec lecture progressive des banques (page, banque, reprise des non lus) et copier/coller d’effet',
    rm_ready_5: 'Générateur Randomize par seed (Paramètres, Structure, Blocs + routage) avec verrous de blocs et budget DSP 1–108 %',
    rm_ready_6: 'Transport P0 protégé avec double lecture initiale, vérification Data21/Data20, STORE User/Carte protégé et moniteur MIDI',
    rm_ready_7: 'Préservation exacte des octets SysEx non décodés lors des imports et exports .syx et .json',
    rm_ready_8: 'Interface bilingue FR/EN et manuel utilisateur illustré intégré avec export HTML autonome hors ligne',
    rm_ready_note: 'Sept suites de vérification synthétiques hors ligne s’exécutent avant chaque build. <a href="./editor/">Ouvrir l’éditeur</a>',
    rm_badge_planned: 'Limites alpha documentées & validations en cours',
    rm_plan_1: 'Cible protocolaire FireworX OS 2.00+ ; ne constitue pas une certification de tous les firmwares, interfaces MIDI ou cartes PCMCIA.',
    rm_plan_2: 'Pilote uniquement le matériel externe en MIDI/SysEx ; aucun traitement audio ni télémétrie matérielle des niveaux, réduction de gain ou CPU.',
    rm_plan_3: 'STORE User/Carte sauvegarde la destination et vérifie la relecture ; la qualification matérielle complète et la conservation après extinction restent à finaliser.',
    rm_plan_4: 'Le pourcentage DSP (1–108 %) est une estimation logicielle additive et non un compteur DSP matériel ni une garantie d’absence de surcharge.',
    rm_plan_5: 'La lecture/écriture globale I/O SETUP → CTRL et la relecture du BPM global ne sont pas établies ; les dumps User groupés doivent être lus en format étendu pour être édités.',
    rm_hw_title: 'Manuel utilisateur illustré intégré (FR / EN)',
    rm_hw_desc: 'Consultez le guide illustré complet couvrant le câblage MIDI bidirectionnel, la différence P0 / STORE, les modulations et le dépannage directement dans l’éditeur.',
    rm_hw_btn: 'Ouvrir le manuel illustré dans l’éditeur',
    rm_plan_note: 'Logiciel communautaire alpha indépendant. Conservez toujours des sauvegardes exportées (.syx / .json) de vos presets.',
    faq_eyebrow: 'Questions fréquentes',
    faq_title: 'Avant de commencer.',
    faq_q1: 'FireworX Studio risque-t-il d’écraser mes presets matériels à la connexion ?',
    faq_a1: 'Non. La connexion lit deux fois le buffer temporaire P0 et attend deux réponses identiques (« En direct · relu ») avant d’autoriser l’édition live. Elle n’envoie jamais automatiquement l’ancienne copie du navigateur à la connexion, et l’édition dans P0 reste strictement séparée de la sauvegarde STORE User/Carte.',
    faq_q2: 'Comment connecter mon FireworX en Web MIDI ?',
    faq_a2: 'Reliez les deux sens MIDI (Sortie ordinateur → Entrée FireworX ET Sortie FireworX → Entrée ordinateur). Ouvrez l’éditeur dans un navigateur Chromium (Chrome, Edge, Brave, Opera), autorisez l’accès MIDI/SysEx et ouvrez « MIDI / Buffer » si plusieurs ports sont présents ou pour régler le Device ID SysEx.',
    faq_q3: 'Puis-je utiliser FireworX Studio sans brancher de FireworX ?',
    faq_a3: 'Oui. Sans autorisation MIDI ni appareil connecté, vous pouvez construire des chaînes d’effets, éditer les 38 algorithmes et la matrice de modulation, importer/exporter des fichiers .syx et .json, organiser vos banques locales et générer des variations par seed.',
    faq_q4: 'Pourquoi y a-t-il une pause d’environ 8,9 secondes après l’ajout ou le déplacement d’un bloc ?',
    faq_a4: 'Les modifications de structure (matrice, ajout/retrait de bloc ou certains champs de routage) nécessitent l’envoi d’une image P0 complète Data20 de 2 745 octets. Le processeur FireworX exige ensuite au moins 8 secondes de silence MIDI après la transmission avant d’accepter de nouveaux messages GET, CC ou Clock.',
    faq_q5: 'Comment le générateur Randomize protège-t-il ma chaîne d’effets ?',
    faq_a5: 'Vous pouvez verrouiller les blocs à conserver, choisir entre une variation de Paramètres, de Structure ou de Blocs + routage, et fixer une seed reproductible. Le moteur respecte les quotas d’instances, les règles de connexion, les protections feedback/Insert et le plafond DSP avant tout aperçu ou application.',
    faq_q6: 'Où sont stockés mes presets, mes banques et mes journaux MIDI ?',
    faq_a6: 'Toutes les données restent localement dans le profil de votre navigateur (LocalStorage et IndexedDB) pour l’origine du site. Rien n’est envoyé vers un serveur externe. Utilisez l’icône disquette et les exports de la bibliothèque pour conserver vos copies .json et .syx sur votre disque.',
    closing_eyebrow: 'Prêt à explorer',
    closing_title: 'Sculptez votre matrice.<br><span>Explorez de nouvelles architectures sonores.</span>',
    closing_cta: 'Ouvrir l’éditeur',
    closing_manual: 'Ouvrir le manuel illustré',
    closing_note: 'Projet communautaire open source indépendant · Fondé sur MIDI Studio',
    footer_tagline: 'Éditeur Web, Matrice du signal, Atelier de modulation & Bibliothèque de presets pour le processeur multi-effets FireworX.',
    footer_col_app: 'Application',
    footer_link_editor: 'Ouvrir FireworX Editor',
    footer_link_manual: 'Manuel utilisateur illustré',
    footer_link_quickstart: 'Guide de démarrage rapide',
    footer_col_docs: 'Espaces & Sections',
    footer_link_workspaces: 'Façade, Matrice & Bibliothèque',
    footer_link_features: '38 Algorithmes & Modulations',
    footer_link_routing: 'Transport P0 protégé',
    footer_link_roadmap: 'Périmètre Alpha & Limites',
    footer_col_project: 'Projet & Confidentialité',
    footer_link_github: 'Dépôt GitHub',
    footer_link_readme_en: 'Documentation (EN)',
    footer_link_readme_fr: 'Documentation (FR)',
    footer_legal: '&copy; 2026 Projet MIDI Studio. Outil communautaire indépendant conçu pour les musiciens et sound designers ; sans lien avec le fabricant de l’appareil.',
    footer_top: '↑ Haut',
    modal_title: 'Démarrer avec FireworX Studio',
    modal_close_aria: 'Fermer la boîte de dialogue',
    modal_intro: 'FireworX Studio fonctionne directement dans votre navigateur sans installation, en ligne comme hors ligne, ou depuis un serveur de développement local Vite.',
    modal_sec1_title: '1. Accès direct dans le navigateur (recommandé)',
    modal_sec1_desc: 'Ouvrez l’éditeur dans Chrome, Edge, Brave ou Opera. Reliez l’entrée et la sortie MIDI de votre FireworX (OS 2.00+), acceptez l’autorisation Web MIDI / SysEx et attendez l’état « En direct · relu ».',
    modal_sec1_btn: 'Ouvrir l’éditeur',
    modal_sec2_title: '2. Lancer en local avec le serveur Vite',
    modal_sec2_desc: 'Clonez le dépôt et démarrez le serveur de développement sur votre machine :',
    modal_sec2_note: 'Puis ouvrez http://127.0.0.1:5173/editor/ dans un navigateur compatible Web MIDI.',
    modal_sec3_title: '3. Consulter le manuel utilisateur illustré',
    modal_sec3_desc: 'Lisez le manuel complet FR/EN intégré à l’éditeur (et exportable en fichier HTML autonome) pour le détail des flux P0, STORE, Modulations et Randomize :',
    modal_sec3_btn: 'Ouvrir le manuel illustré'
  }
};

let currentLang = 'en';
let currentRoute = 'agent';

function updateWorkflowRouteText() {
  const routeOwner = document.getElementById('route-owner');
  const routeSub = document.getElementById('route-sub');
  const routeWireLeft = document.getElementById('route-wire-left');
  const routeProtocol = document.getElementById('route-protocol');
  const routeExp = document.getElementById('route-explanation');

  const descriptions = {
    agent: {
      en: 'FireworX Studio connects via bidirectional Web MIDI (DIN or RTP/mioXL). After two matching P0 buffer reads ("Live · verified"), parameter tweaks use short Data21 writes while structural changes use complete Data20 images with comparison read, readback, and an ~8.9 s settle window.',
      fr: 'FireworX Studio se connecte en Web MIDI bidirectionnel (DIN ou RTP/mioXL). Après deux lectures identiques du buffer P0 (« En direct · relu »), les réglages utilisent des écritures courtes Data21 tandis que les changements de structure passent par une image complète Data20 avec lecture de comparaison, relecture et fenêtre calme de ~8,9 s.'
    },
    browser: {
      en: 'Work 100% offline without a FireworX connected: import existing .syx captures or .json presets, build 8×8 chains, configure modulation cords, organize local banks, and generate deterministic seeded variations ready for your next studio session.',
      fr: 'Travaillez 100 % hors ligne sans FireworX branché : importez vos captures .syx ou presets .json, assemblez vos chaînes 8×8, préparez vos liens de modulation, classez vos banques locales et générez des variations par seed prêtes pour votre prochaine session.'
    }
  };

  if (currentRoute === 'browser') {
    if (routeOwner) routeOwner.textContent = currentLang === 'fr' ? 'Atelier Hors Ligne & Fichiers' : 'Offline Studio & Files';
    if (routeSub) routeSub.textContent = currentLang === 'fr' ? 'IndexedDB · .syx · .json · Seeds' : 'IndexedDB · .syx · .json · Seeds';
    if (routeWireLeft) routeWireLeft.textContent = '.SYX / .JSON';
    if (routeProtocol) routeProtocol.textContent = currentLang === 'fr' ? 'EXPORT PORTABLE' : 'PORTABLE EXPORT';
    if (routeExp) routeExp.textContent = descriptions.browser[currentLang] || descriptions.browser.en;
  } else {
    if (routeOwner) routeOwner.textContent = 'FireworX Studio';
    if (routeSub) routeSub.textContent = currentLang === 'fr' ? 'Transport protégé & Bibliothèque' : 'Guarded Transport & Librarian';
    if (routeWireLeft) routeWireLeft.textContent = 'WEB MIDI / SYSEX';
    if (routeProtocol) routeProtocol.textContent = 'DATA21 / DATA20';
    if (routeExp) routeExp.textContent = descriptions.agent[currentLang] || descriptions.agent.en;
  }
}

function applyLanguage(lang) {
  if (!translations[lang]) lang = 'en';
  currentLang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('fireworx_site_lang', lang);
    localStorage.setItem('bcr32-studio.language.v1', lang);
  } catch { /* storage optional */ }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const dict = translations[lang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    if (dict[key] !== undefined) el.setAttribute('aria-label', dict[key]);
  });

  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.dataset.i18nAlt;
    if (dict[key] !== undefined) el.setAttribute('alt', dict[key]);
  });

  document.querySelectorAll('[data-i18n-src]').forEach(el => {
    const key = el.dataset.i18nSrc;
    if (dict[key] !== undefined) el.setAttribute('src', dict[key]);
  });

  document.querySelectorAll('[data-i18n-content]').forEach(el => {
    const key = el.dataset.i18nContent;
    if (dict[key] !== undefined) el.setAttribute('content', dict[key]);
  });

  updateWorkflowRouteText();
}

function initI18n() {
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  let storedLang = null;
  try {
    storedLang = localStorage.getItem('fireworx_site_lang') || localStorage.getItem('bcr32-studio.language.v1');
  } catch { /* storage optional */ }
  const userLang = langParam || storedLang || (navigator.language && navigator.language.startsWith('fr') ? 'fr' : 'en');
  applyLanguage(userLang === 'fr' ? 'fr' : 'en');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });
}

// -------------------------------------------------------------
// 2. WORKSPACE MODE SWITCHER (MATRIX / MODULATION / LIBRARIAN)
// -------------------------------------------------------------
function initProductSwitch() {
  const tabs = Array.from(document.querySelectorAll('.product-switch [role="tab"]'));
  if (!tabs.length) return;

  function activateTab(selectedTab) {
    tabs.forEach(tab => {
      const isSelected = tab === selectedTab;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.tabIndex = isSelected ? 0 : -1;
      const panelId = tab.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) panel.hidden = !isSelected;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', e => {
      let nextIndex = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex >= 0) {
        e.preventDefault();
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex]);
      }
    });
  });

  document.querySelectorAll('[data-product]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.product;
      const match = document.getElementById('tab-' + target);
      if (match) activateTab(match);
    });
  });
}

// -------------------------------------------------------------
// 3. WORKFLOW ROUTING TOGGLE
// -------------------------------------------------------------
function initWorkflowRoute() {
  const toggleButtons = document.querySelectorAll('.route-toggle button');
  if (!toggleButtons.length) return;

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      currentRoute = btn.dataset.route === 'browser' ? 'browser' : 'agent';
      updateWorkflowRouteText();
    });
  });
}

// -------------------------------------------------------------
// 4. ACCESSIBILITY MODAL DIALOG
// -------------------------------------------------------------
function initModal() {
  const modal = document.getElementById('access-modal');
  if (!modal) return;
  const openers = document.querySelectorAll('[data-access]');
  const closers = modal.querySelectorAll('[data-close]');
  let lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  openers.forEach(btn => btn.addEventListener('click', openModal));
  closers.forEach(el => el.addEventListener('click', closeModal));

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

// -------------------------------------------------------------
// 5. INTERACTIVE COSMIC STARFIELD CANVAS
// -------------------------------------------------------------
function initStarfield() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const modes = ['particles', 'cosmic', 'minimal'];
  let modeIndex = 0;
  const toggleBtn = document.getElementById('stars-toggle');

  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStars = [];
  let mouse = { x: -1000, y: -1000, radius: 145 };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createStars();
  }

  function createStars() {
    stars = [];
    const count = Math.floor((width * height) / (modes[modeIndex] === 'minimal' ? 22000 : 11500));
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.85 + 0.4,
        alpha: Math.random() * 0.7 + 0.3,
        baseAlpha: Math.random() * 0.7 + 0.3,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: (Math.random() - 0.5) * 0.25,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        tint: roll < 0.22 ? 'amber' : roll < 0.36 ? 'lime' : 'ice'
      });
    }
  }

  function maybeSpawnShootingStar() {
    if (modes[modeIndex] === 'minimal') return;
    if (Math.random() < 0.016 && shootingStars.length < 3) {
      shootingStars.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.42,
        len: Math.random() * 85 + 50,
        speed: Math.random() * 7 + 8,
        angle: (Math.PI / 4) + (Math.random() - 0.5) * 0.22,
        life: 1.0,
        decay: Math.random() * 0.024 + 0.014,
        isLime: Math.random() < 0.35
      });
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  }, { passive: true });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % modes.length;
      createStars();
      toggleBtn.classList.toggle('active', modeIndex !== 2);
    });
  }

  resize();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    maybeSpawnShootingStar();

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.life -= s.decay;

      if (s.life <= 0) {
        shootingStars.splice(i, 1);
        continue;
      }

      const tailX = s.x - Math.cos(s.angle) * s.len;
      const tailY = s.y - Math.sin(s.angle) * s.len;

      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      if (s.isLime) {
        grad.addColorStop(0, 'rgba(180, 203, 96, 0)');
        grad.addColorStop(0.7, `rgba(180, 203, 96, ${s.life * 0.45})`);
      } else {
        grad.addColorStop(0, 'rgba(240, 163, 58, 0)');
        grad.addColorStop(0.7, `rgba(240, 163, 58, ${s.life * 0.45})`);
      }
      grad.addColorStop(1, `rgba(255, 255, 255, ${s.life * 0.92})`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];

      star.x += star.speedX;
      star.y += star.speedY;

      if (star.x < 0) star.x = width;
      if (star.x > width) star.x = 0;
      if (star.y < 0) star.y = height;
      if (star.y > height) star.y = 0;

      star.alpha = star.baseAlpha + Math.sin(Date.now() * star.twinkleSpeed) * 0.25;
      star.alpha = Math.max(0.1, Math.min(1, star.alpha));

      const dx = mouse.x - star.x;
      const dy = mouse.y - star.y;
      const dist = Math.hypot(dx, dy);
      let renderAlpha = star.alpha;

      if (dist < mouse.radius) {
        const force = (1 - dist / mouse.radius);
        renderAlpha = Math.min(1, star.alpha + force * 0.6);
        if (star.tint === 'amber') ctx.fillStyle = `rgba(240, 163, 58, ${renderAlpha})`;
        else if (star.tint === 'lime') ctx.fillStyle = `rgba(180, 203, 96, ${renderAlpha})`;
        else ctx.fillStyle = `rgba(255, 235, 195, ${renderAlpha})`;
      } else {
        if (star.tint === 'amber') ctx.fillStyle = `rgba(240, 163, 58, ${renderAlpha * 0.82})`;
        else if (star.tint === 'lime') ctx.fillStyle = `rgba(180, 203, 96, ${renderAlpha * 0.78})`;
        else ctx.fillStyle = `rgba(200, 215, 230, ${renderAlpha * 0.6})`;
      }

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      if (modes[modeIndex] === 'cosmic') {
        for (let j = i + 1; j < stars.length; j++) {
          const other = stars[j];
          const distBetween = Math.hypot(star.x - other.x, star.y - other.y);
          if (distBetween < 88) {
            const lineAlpha = (1 - distBetween / 88) * 0.13 * star.alpha;
            ctx.strokeStyle = star.tint === 'lime'
              ? `rgba(180, 203, 96, ${lineAlpha})`
              : `rgba(240, 163, 58, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(star.x, star.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// -------------------------------------------------------------
// 6. SCROLL REVEAL ANIMATIONS
// -------------------------------------------------------------
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view', 'visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => observer.observe(el));
}

// -------------------------------------------------------------
// DOM READY INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initProductSwitch();
  initWorkflowRoute();
  initModal();
  initStarfield();
  initScrollReveal();
});
