# Findings

## Research
- **Testing Context:** The tool will generate API and web application test cases, covering both functional and non-functional tests.
- **Input Mechanism:** Users will provide Jira requirements either by copy-pasting or via chat interface.
- **Local LLM Infrastructure:** The tool needs to support multiple LLM providers: Ollama API, LM Studio API, Grok API, OpenAI, Claude API, and Gemini API. These will be configured in a settings window. *(Note: A "design folder" was mentioned for configurations, but that directory doesn't currently exist in the project).*
- **Generator Tech Stack:** Backend: Node.js with TypeScript. Frontend: React.

## Discoveries
- The user requires the output to strictly follow a "Jira format" for the generated test cases.

## Constraints
- Output strictly in Jira format.
- Support for Functional and Non-functional test cases.
- Use TypeScript for the Node.js backend.
- Use React for the frontend.
