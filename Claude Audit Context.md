Read docs/ARCHITECTURE.md thoroughly. This is the architectural baseline for this project. Once you've read it, audit the existing codebase against it — what's aligned, what's missing, what contradicts the architecture, what needs to change. Do not suggest removing any planned features. Propose fixes that move the system toward v3.1. Mini-audit checkpoint after streaming implementation.

Please review:
- provider stream abstraction
- telemetry compatibility
- route streaming implementation
- frontend streaming architecture
- future compatibility with:
  - Anthropic streaming
  - sentence chunking
  - TTS
  - tool-call streaming
  - SSE/event multiplexing
- whether current stream architecture creates future technical debt
- whether the current ReadableStream/text/plain approach is sufficient for this phase
- whether any immediate corrections should happen BEFORE Anthropic provider integration