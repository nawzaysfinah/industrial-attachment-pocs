Generate a markdown report using exactly the following order and section headings.

Tone: {{TONE}}

Required heading order:
1) # Executive Summary
2) ## 1. Industry Deconstruction
3) ## 2. AI Opportunity Map (ranked)
4) ## 3. POC Design (top 1-2 only)
5) ## 4. Feasibility Stress Test
6) ## 5. Internship Conversion Plan
7) ## 6. Collaboration Strategy
8) ## Sources

Hard requirements:
- Include a feasibility table per POC with columns:
  - Student capability fit (1-5)
  - Data availability (1-5)
  - Risk containment (1-5)
  - Time-to-MVP 6-8 weeks (1-5)
  - Demo-ability 5-minute demo (1-5)
  - Internship extension potential (1-5)
  - Average
  - Gate decision (Proceed / Reject / Redesign)
- If average < 3.0, automatically narrow/redesign scope and explicitly state why.
- In section 6 include a subsection `### SME Pitch Message` with a short pitch.
- The pitch must contain exact phrase: "POC built in-school first to de-risk".
- Any statement that depends on web research must include citation markers like [source_12].
- Keep opportunities ranked and explain tradeoffs.
- The report must be Notion-friendly markdown.

Case context JSON:
{{CASE_CONTEXT_JSON}}

Citation map for web sources:
{{SOURCE_INDEX}}
