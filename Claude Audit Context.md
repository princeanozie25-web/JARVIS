Read docs/ARCHITECTURE.md thoroughly. This is the architectural baseline for this project. Once you've read it, audit the existing codebase against it — what's aligned, what's missing, what contradicts the architecture, what needs to change. Do not suggest removing any planned features. Propose fixes that move the system toward v3.1. We now have a working Next.js JARVIS app with:
- .env.local API key handling
- src/lib/config.ts
- src/lib/types.ts
- src/lib/openai.ts
- app/api/chat/route.ts
- app/page.tsx chat UI
- successful OpenAI response through localhost

Please audit the codebase for:
1. security issues
2. architecture weaknesses
3. TypeScript/Next.js mistakes
4. scalability problems
5. whether the provider abstraction is good enough before adding Anthropic
6. what should be fixed before Phase 1.5
7. whether the roadmap order still makes sense