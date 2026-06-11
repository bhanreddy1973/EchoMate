# EchoMate UI Design Specification

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                         Header Bar (fixed)                        │
├────────────┬─────────────────────────────────────┬───────────────┤
│            │                                     │               │
│   Left     │         Main Chat Area              │    Right      │
│  Sidebar   │                                     │   Sidebar     │
│  (280px)   │     Messages (scrollable)           │   (320px)     │
│            │                                     │               │
│ - History  │     ┌─────────────────────────┐     │ - Tasks       │
│ - Nav      │     │  Assistant message      │     │ - Recap       │
│ - Actions  │     │  (glass card, avatar)   │     │ - Insights    │
│            │     └─────────────────────────┘     │ - Brief       │
│            │              ...                    │               │
│            │     ┌─────────────────────────┐     │               │
│            │     │     User message        │     │               │
│            │     │     (accent bubble)     │     │               │
│            │     └─────────────────────────┘     │               │
│            │                                     │               │
│            ├─────────────────────────────────────┤               │
│            │         Input Bar (fixed)           │               │
│            │  [Attach] [Skills] [Input...] [Send]│               │
└────────────┴─────────────────────────────────────┴───────────────┘
```

## Component Hierarchy

```
App
├── ChatLayout
│   ├── LeftSidebar
│   │   ├── BrandLogo
│   │   ├── NewChatButton
│   │   ├── ConversationList
│   │   │   ├── ConversationGroup (Today/Yesterday/Older)
│   │   │   └── ConversationItem
│   │   └── QuickNavigation
│   ├── MainChatArea
│   │   ├── ChatHeader (current conversation info)
│   │   ├── MessageList
│   │   │   ├── AssistantMessage
│   │   │   │   ├── Avatar + Glow
│   │   │   │   ├── MarkdownRenderer
│   │   │   │   │   ├── CodeBlock (Shiki + copy)
│   │   │   │   │   ├── ThinkingBlock (expandable)
│   │   │   │   │   └── Standard elements
│   │   │   │   └── MessageActions (copy, regenerate)
│   │   │   └── UserMessage
│   │   │       └── MessageBubble (accent glass)
│   │   ├── TypingIndicator
│   │   └── InputArea
│   │       ├── ToolBar (attach, skills, connectors)
│   │       ├── TextInput (auto-resize)
│   │       ├── VoiceButton (Orb mini)
│   │       └── SendButton
│   └── RightSidebar
│       ├── TasksWidget
│       ├── RecapWidget
│       ├── InsightsWidget
│       └── DailyBriefWidget
└── FloatingOrb (voice activation overlay)
```

## Message Rendering Specs

### Assistant Messages
- Left-aligned with 8px avatar gap
- Avatar: 28px circle with emotion glow
- Background: glass-1 with 40px blur
- Border: 1px border-glass
- Border-radius: 20px (top-left: 6px)
- Max-width: 80% of container
- Padding: 16px 20px
- Font: 14px/1.7 Inter
- Animation: fade-up + scale-in (200ms spring)

### User Messages
- Right-aligned
- Background: accent gradient (current emotion color)
- Border-radius: 20px (top-right: 6px)
- Max-width: 70% of container
- Padding: 12px 18px
- Font: 14px/1.6 Inter, white
- Animation: slide-in-right (180ms)

### Code Blocks
- Background: surface-1
- Border: 1px border-glass
- Border-radius: 12px
- Header: language tag (left) + copy button (right)
- Syntax: Shiki with dark theme
- Font: 13px JetBrains Mono
- Padding: 16px
- Hover: border brightens

### Thinking Blocks
- Expandable accordion
- Background: glass-inner
- Border-left: 2px accent gradient
- Label: "Thinking..." with animated dots
- Collapsed: single line preview
- Expanded: full reasoning with fade-in

## Animation Specifications

### Page Transitions
- Duration: 300ms
- Easing: spring(1, 80, 10)
- Stagger children: 50ms

### Message Entrance
- Assistant: { opacity: 0, y: 16 } → { opacity: 1, y: 0 }, 300ms spring
- User: { opacity: 0, x: 20 } → { opacity: 1, x: 0 }, 250ms spring

### Typing Indicator
- 3 dots with staggered pulse
- Scale: 0.6 → 1.0, 1.4s infinite
- Color: current accent

### Sidebar Transitions
- Width: 0 → 280px, 400ms spring
- Content: staggered fade-in, 50ms delay per item

### Hover Effects
- Glass panels: translateY(-2px), border brighten, shadow expand
- Buttons: scale(0.97) on press, glow increase on hover
- Messages: subtle border glow on hover

## Color System (Dark Theme)

| Token | Value | Usage |
|-------|-------|-------|
| void | #04040a | Page background |
| surface-0 | #070710 | Deepest panels |
| surface-1 | #0d0d1a | Code blocks, cards |
| surface-2 | #131326 | Elevated surfaces |
| glass-1 | rgba(255,255,255,0.04) | Base glass |
| glass-2 | rgba(255,255,255,0.07) | Hover glass |
| glass-3 | rgba(255,255,255,0.10) | Active glass |
| text-primary | rgba(255,255,255,0.95) | Main text |
| text-secondary | rgba(255,255,255,0.65) | Secondary |
| text-muted | rgba(255,255,255,0.35) | Hints |
| border-glass | rgba(255,255,255,0.09) | Borders |

## Responsive Breakpoints
- Mobile (<768px): Single column, sidebars as drawers
- Tablet (768-1024px): Left sidebar collapsible, no right sidebar
- Desktop (>1024px): Full three-column layout
- Wide (>1440px): Expanded content area
