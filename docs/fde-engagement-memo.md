# FDE engagement memo (sketch)

**Scenario:** Embedded with a defence-industry partner integrating NestOS Core-style fusion into an existing command/product stack.

**Horizon:** First two weeks. Goal: shorten time-to-first-trusted picture — not a big-bang rewrite.

---

## Week 1 — Orient and constrain

1. **Map the real system, not the slide deck**  
   Inventory sensors/platforms already producing data, existing buses (MQTT, DDS, REST, proprietary), identity/auth, classification boundaries, and who the operator actually is.

2. **Define the thinnest valuable operational picture**  
   With partner stakeholders: which 3–5 signals must appear on day one (e.g. unit identity, last-seen, position quality, health)? Explicitly defer autonomy features.

3. **Agree interface contracts**  
   Prefer open, versioned APIs the partner owns. Avoid proprietary lock-in for the integration surface. Document freshness / stale semantics early (operators distrust silent dashboards).

4. **Security & sovereignty constraints in writing**  
   Where data may leave the enclave, what must stay on-prem/edge, audit expectations, and human-in-the-loop policy for any decision-support UX.

---

## Week 2 — Vertical slice in their environment

1. **Ship one live path**  
   One real (or representative) feed → store → fused view → operator can answer “what is stale?” without us in the room.

2. **Instrument trust**  
   Latency, drop rates, last-seen timestamps, and a clear degraded mode when links fail (NestOS Edge mindset even if Core is the first cut).

3. **Playback / validation**  
   Ability to replay a short mission window so assumptions get tested against operational reality — NestAI’s FDE thesis.

4. **Handoff plan**  
   What the partner team owns vs what NestAI evolves; backlog of next integrations ordered by operational value, not tech novelty.

---

## What I would not do in week 1–2

- Rewrite their architecture  
- Lead with an LLM chatbot as the product  
- Promise cloud-only designs for contested environments  
- Hide uncertainty from commanders / product owners  

---

*Prepared as NestAI interview prep — illustrates FDE decomposition thinking, not a real customer engagement.*
