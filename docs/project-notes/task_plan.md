# Task Plan

## Goals
- Build a React + Node.js (TypeScript) application named **Local LLM Test Generator**.
- Take Jira requirements as input (via chat or copy-paste).
- Support screenshot/image uploads for Vision-capable LLMs.
- Generate API and Web Application test cases (both functional and non-functional) using various LLM providers (Ollama, LM Studio, Grok, OpenAI, Claude, Gemini).
- Output test cases formatted explicitly for Jira.

## Phases
- [x] Phase 1: Discovery and Initialization
- [x] Phase 2: Blueprint Approval
- [x] Phase 3: Project Setup (Frontend & Backend Initialization)
- [x] Phase 4: Core Implementation (LLM Integrations, Chat Interface, Test Generator Logic)
- [ ] Phase 5: Polish and Testing (Current)

## Checklists

### Discovery (Phase 1)
- [x] Complete Discovery Questions
- [x] Update Findings

### Blueprint (Phase 2)
- [x] Review Blueprint (`task_plan.md` and `findings.md`)
- [x] Approve Blueprint

### Implementation (Phase 3 & 4)
- [x] Initialize Node.js/TypeScript Backend
- [x] Initialize React Frontend component structure
- [x] Implement Settings Window for LLM Configurations
- [x] Implement Jira Requirement Input Interface
- [x] Implement Vision/Image Upload Interface
- [x] Implement LLM Provider Integration Services
- [x] Prompt Engineering for Jira-formatted Test Case Generation

### Polish & UI (Phase 5)
- [x] Fix Tailwind CSS compilation
- [x] Apply premium UI design (glassmorphism, vibrant colors, animations)
- [x] Move Settings to a dedicated page view
- [x] Add Excel (.xlsx) and Word (.docx) Export buttons for generated tests
