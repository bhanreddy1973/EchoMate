# EchoMate — UI Requirements (Premium Spatial Dashboard)

## Vision
A visionOS-inspired, deeply immersive voice companion interface. The UI should feel alive — breathing, reacting, and caring. Every pixel should communicate warmth and intelligence.

## Design Principles
1. **Liquid Glass First** — every panel floats on depth layers with refraction, blur, and translucency
2. **Voice is Primary** — the central orb IS the interface; text is secondary
3. **Emotionally Reactive** — colors, animations, and energy shift with detected mood
4. **Ambient Calm** — nothing shouts; everything whispers with purpose
5. **Zero Cognitive Load** — at a glance, users know their day, their tasks, their wins

## Acceptance Criteria

### Orb (Central Heart)
- [ ] 280px liquid glass sphere with layered radial gradients
- [ ] Real-time waveform ring (SVG path, redraws at 60fps)
- [ ] Breathing animation: 4s inhale/exhale cycle when idle
- [ ] State colors: idle=indigo, listening=cyan, thinking=amber, speaking=emerald
- [ ] Two outer pulse rings on active states
- [ ] Specular highlight overlay (top-left refraction)
- [ ] Emotion-driven color morphing (smooth CSS transition)

### Background
- [ ] Deep void base (#04040a)
- [ ] 3 animated ambient gradient blobs (slow drift, 20-30s cycles)
- [ ] SVG noise texture overlay for depth
- [ ] Particle field (40-60 points, parallax on mouse move)
- [ ] Background reacts to emotion state (hue rotation)

### Panel System (Liquid Glass)
- [ ] `backdrop-filter: blur(40px) saturate(200%) brightness(1.1)`
- [ ] Multi-layer box shadow (ambient + key + fill)
- [ ] Border: 1px rgba(255,255,255,0.12) with gradient on hover
- [ ] Entrance: fade-up + scale from 0.96 with stagger
- [ ] Exit: fade-out + scale to 0.96
- [ ] Hover: subtle lift (translateY -2px) + border brightens
- [ ] Expand/collapse with smooth height animation

### Top-Left: Tasks Panel
- [ ] Active tasks list with priority badges (High/Med/Low)
- [ ] Due time with smart relative display ("in 2h", "Tomorrow")
- [ ] Tap to complete with checkmark animation + strikethrough
- [ ] "Add Task" voice command chip
- [ ] Progress arc showing completion %
- [ ] Empty state with encouraging message

### Top-Right: Recap Panel
- [ ] Today's completed items with timestamp
- [ ] Animated streak counter (days in a row)
- [ ] Weekly progress bar
- [ ] Achievement badges (animated pop-in)
- [ ] "Tell me more" voice expansion

### Bottom-Left: Insights Panel
- [ ] Memory highlights from recent conversations
- [ ] Mood trend sparkline (7-day)
- [ ] "You mentioned..." contextual cards
- [ ] Emotion frequency visualization
- [ ] Long-press to pin a memory

### Bottom-Right: Daily Brief Panel
- [ ] Time-appropriate greeting (Morning/Afternoon/Evening)
- [ ] Quick action tiles: Weather, Calendar, Journal, Habits, Search
- [ ] Next suggested action based on context
- [ ] Integration status dots (connected services)

### Conversation Layer
- [ ] Floating speech bubbles emerge from orb during conversation
- [ ] Real-time transcription with word-by-word animation
- [ ] Emotion color applied to text (calm=white, excited=yellow, concerned=blue)
- [ ] Bubbles drift and fade out after 8s

### Status Bar
- [ ] Model name + version (bottom center)
- [ ] Latency indicator (ms)
- [ ] Current emotion detection + confidence %
- [ ] Connection quality indicator

### Emotional States
| State | Orb Color | Accent | Background Shift |
|-------|-----------|--------|-----------------|
| Idle | Indigo-Purple | #6366f1 | None |
| Listening | Cyan-Blue | #06b6d4 | +5% brightness |
| Thinking | Amber-Orange | #f59e0b | Warm tint |
| Speaking | Emerald-Green | #10b981 | Cool tint |
| Happy | Yellow-Gold | #eab308 | +brightness |
| Concerned | Soft Blue | #60a5fa | -brightness |
| Excited | Vivid Violet | #8b5cf6 | +saturation |
| Calm | Teal | #14b8a6 | Neutral |

## Performance Requirements
- 60fps animations (no dropped frames on panel interactions)
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- All animations use `transform` and `opacity` only (no layout thrashing)
- GSAP for heavy animation sequences, Framer Motion for component transitions

## Accessibility
- All interactive elements have aria-labels
- Focus indicators visible
- Reduced-motion variant: disable parallax and non-essential animations
- Color contrast AA minimum on all text
