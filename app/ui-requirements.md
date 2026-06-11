# EchoMate UI Requirements

## Core Design Philosophy
- Premium AI chat experience (Claude.ai / ChatGPT / Grok quality)
- Apple Liquid Glass aesthetics: frosted glass, refraction, depth, soft glows
- Dark theme only, spacious, calm, highly readable
- Buttery smooth animations using Framer Motion, GSAP, and CSS keyframes

## Layout Architecture

### Left Sidebar (Collapsible)
- New Conversation button
- Conversation history with titles, dates, grouping (Today, Yesterday, Older)
- Quick access: Today's Tasks, Completed Recap, Memory Vault, Journal, Settings
- Glass morphism styling with subtle hover effects

### Main Chat Area (Center)
- Clean message history with smooth scroll
- User messages: right-aligned, accent-colored glass bubbles
- Assistant messages: left-aligned, frosted glass with avatar/glow
- Fade-in + typing animation for message appearance
- Real-time transcription overlay when speaking

### Central Floating Liquid Glass Orb
- Always visible, floating near the bottom
- Voice activation on click/hold
- Real-time waveform + emotion-based color/glow
- Particle effects and pulse animations

### Right Sidebar (Optional, Collapsible)
- Today's Tasks & Reminders
- Quick Recap of Completed Items
- Personal Insights / Memory Highlights
- Daily Brief panel

## Message Rendering (Critical)
- Rich markdown with beautiful typography
- Code blocks: language tag, syntax highlighting (Shiki), copy button
- Tables, lists, blockquotes, math (KaTeX)
- Thinking/reasoning in expandable glass cards
- Smooth fade-in animations per message

## Emotional & Voice Features
- Chat bubbles react to detected emotion
- Background and orb shift color based on tone
- Ambient particle systems respond to state

## Input Area
- Fixed bottom glass input bar
- Text input with auto-resize
- Voice button (Liquid Glass Orb integration)
- Attachment/Tool buttons
- Skills & Connectors quick access

## Animation Libraries
- Framer Motion: page transitions, message animations, layout shifts
- GSAP: complex timeline animations, orb effects, scroll triggers
- CSS Keyframes: breathing, pulsing, floating particles
- Inspired by: motion.dev, magicui.design, animate-ui.com, ui.aceternity.com, gsap.com/ui, uiverse.io

## Tech Stack
- Next.js 15 + React 19 + TypeScript
- Tailwind CSS 4 with custom theme
- Framer Motion 12 for animations
- GSAP 3 for advanced animation
- Shiki for syntax highlighting
- react-markdown + remark-gfm + rehype plugins
- LiveKit React for real-time voice
- Zustand for state management

## Quality Standards
- Extremely polished, buttery smooth
- Perfect responsiveness (mobile-first breakpoints)
- High accessibility (ARIA labels, keyboard navigation, focus management)
- Clean, maintainable component structure
- Performance optimized (lazy loading, memoization)
