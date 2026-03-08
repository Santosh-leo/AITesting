import express, { Request, Response } from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer(); // Memory storage for processing images directly

export interface TestGenerationRequest {
    jiraRequirement: string;
    provider: string;
    model: string;
    apiUrl: string;
    apiKey?: string;
}

const SYSTEM_PROMPT = `You are an expert QA Engineer. The user will provide you with a Jira user story/requirement and optionally a screenshot.
Your task is to generate comprehensive test cases based on this requirement and visual context.
You must generate BOTH Functional and Non-Functional test cases.

CRITICAL: Output the test cases strictly in the following format so it can be parsed into a spreadsheet template:
- N: (e.g. 1, 2, 3...)
- Req ID: (e.g. REQ-001)
- Test Objective: 
- Test Steps:
- Expected Result:
- Actual Result: (You can leave this blank or say 'Pending Execution')
- Pass/Fail: (Leave blank or say 'Pending')
- Related Defects: (Leave blank)

Do not include any other conversational text. Just output the test cases in a readable bullet point list using exactly those keys.`;

router.post('/generate', upload.single('image'), async (req: Request, res: Response) => {
    try {
        const payload: TestGenerationRequest = req.body;
        const file = req.file; // This is the uploaded screenshot if provided

        if (!payload.jiraRequirement && !file) {
            res.status(400).json({ error: 'Jira requirement or screenshot is required' });
            return;
        }

        let generatedTests = '';

        let imagePartBase64 = null;
        let mimeType = null;

        if (file) {
            imagePartBase64 = file.buffer.toString('base64');
            mimeType = file.mimetype;
            console.log(`Received image: ${file.originalname} (${file.size} bytes)`);
        }

        // Common functionality to structure prompt block
        const buildPrompt = () => {
            return `${SYSTEM_PROMPT}\n\nJIRA REQUIREMENT:\n${payload.jiraRequirement || 'Please review the attached screenshot as requirement'}`;
        }

        switch (payload.provider) {
            case 'ollama':
                const ollamaPayload: any = {
                    model: payload.model,
                    prompt: buildPrompt(),
                    stream: false
                };

                // If using an Ollama vision model (e.g. llava)
                if (imagePartBase64) {
                    ollamaPayload.images = [imagePartBase64];
                }

                // Clean the API URL (remove trailing slash if exists)
                const baseUrl = payload.apiUrl.replace(/\/$/, "");
                console.log(`Sending to Ollama at: ${baseUrl}/api/generate`);
                console.log(`Ollama Payload (without images):`, { ...ollamaPayload, images: ollamaPayload.images ? '[IMAGE_DATA]' : undefined });

                const ollamaResponse = await fetch(`${baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ollamaPayload)
                });

                if (!ollamaResponse.ok) {
                    let errorText = await ollamaResponse.text().catch(() => ollamaResponse.statusText);
                    throw new Error(`Ollama Error HTTP ${ollamaResponse.status}: ${errorText}`);
                }

                const ollamaData = await ollamaResponse.json();
                generatedTests = ollamaData.response;
                break;

            case 'lmstudio':
            case 'openai': // Usually LMStudio is compatible with OpenAI APIs
                const messages: any[] = [
                    { role: 'system', content: SYSTEM_PROMPT },
                ];

                const userContent: any[] = [];

                if (payload.jiraRequirement) {
                    userContent.push({ type: "text", text: payload.jiraRequirement });
                } else if (file) {
                    userContent.push({ type: "text", text: "Please generate tests based on this screenshot." });
                }

                if (imagePartBase64) {
                    userContent.push({
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${imagePartBase64}`
                        }
                    });
                }

                messages.push({ role: 'user', content: userContent });

                const llmResponse = await fetch(`${payload.apiUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(payload.apiKey ? { 'Authorization': `Bearer ${payload.apiKey}` } : {})
                    },
                    body: JSON.stringify({
                        model: payload.model,
                        messages: messages,
                        temperature: 0.7
                    })
                });

                if (!llmResponse.ok) {
                    const errBody = await llmResponse.text();
                    throw new Error(`LLM API Error ${llmResponse.status}: ${errBody}`);
                }

                const llmData = await llmResponse.json();
                generatedTests = llmData.choices[0].message.content;
                break;

            default:
                generatedTests = `Simulation of tests from ${payload.provider} model ${payload.model}. \n[Image Received: ${imagePartBase64 ? 'YES' : 'NO'}]\n* TC-001: Functional - Verify Login - Expected: User logged in.\n* TC-002: Non-Functional - Verify Performance - Expected: Page loads in < 2s.`;
                break;
        }

        res.json({ tests: generatedTests });
    } catch (error: any) {
        console.error("LLM Generation Error:", error);
        res.status(500).json({ error: error.message || 'Error communicating with LLM provider' });
    }
});

export default router;
