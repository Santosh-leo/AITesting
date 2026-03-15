import express, { Request, Response } from 'express';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const SF_LOGIN_URL = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com/').trim();
const SF_USERNAME = (process.env.SALESFORCE_USERNAME || '').trim();
const SF_PASSWORD = (process.env.SALESFORCE_PASSWORD || '').trim();

// ─── Types ──────────────────────────────────────────────────────────────────
interface GeneratedTestStep {
    id: number;
    action: string;       // e.g. 'click', 'fill', 'navigate', 'assert'
    target: string;       // Playwright locator or URL
    value?: string;       // For 'fill' actions
    description: string;  // Human-readable description
}

interface TestResult {
    stepId: number;
    description: string;
    action: string;
    target: string;
    value?: string;
    status: 'pass' | 'fail' | 'skipped';
    error?: string;
    screenshotBase64?: string;
}

interface Defect {
    id: number;
    stepId: number;
    description: string;
    error: string;
    screenshotBase64: string;
}

// ─── LLM Prompt for Salesforce Test Generation ──────────────────────────────
const SF_TEST_PROMPT = `You are an expert Salesforce QA Automation Engineer. Given a user story, generate a set of Playwright test steps to verify it on a Salesforce Lightning UI.

CRITICAL RULES:
1. The user is ALREADY logged in. Do NOT generate login steps.
2. Use ONLY these action types: navigate, click, fill, assert
3. For "navigate" actions: use relative Salesforce paths like "/lightning/o/Account/list"
4. For "click" actions: use Playwright locator strings like getByRole("button", { name: "New" }) or getByText("Save") or locator("...css...")
5. For "fill" actions: use Playwright locator strings and provide the value to type
6. For "assert" actions: describe what to assert (element visible, text present, etc.)

OUTPUT FORMAT — Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "id": 1, "action": "navigate", "target": "/lightning/o/Account/list", "description": "Navigate to Accounts list" },
  { "id": 2, "action": "click", "target": "getByRole(\\"button\\", { name: \\"New\\" })", "description": "Click New button" },
  { "id": 3, "action": "fill", "target": "getByLabel(\\"Account Name\\")", "value": "Test Account", "description": "Enter account name" },
  { "id": 4, "action": "click", "target": "getByRole(\\"button\\", { name: \\"Save\\" })", "description": "Save the record" },
  { "id": 5, "action": "assert", "target": "getByText(\\"Test Account\\")", "description": "Verify account was created" }
]

Generate thorough test steps covering the user story. Include both positive verification and edge case checks. Return ONLY the JSON array.`;

// ─── Helper: Call LLM ───────────────────────────────────────────────────────
async function callLLM(userStory: string, provider: string, model: string, apiUrl: string, apiKey?: string): Promise<GeneratedTestStep[]> {
    const userPrompt = `USER STORY:\n${userStory}\n\nGenerate the Playwright test steps JSON array:`;

    let responseText = '';

    if (provider === 'ollama') {
        const ollamaResponse = await fetch(`${apiUrl.replace(/\/$/, "")}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: `${SF_TEST_PROMPT}\n\n${userPrompt}`, stream: false })
        });
        if (!ollamaResponse.ok) throw new Error(`Ollama Error: ${await ollamaResponse.text()}`);
        const data = await ollamaResponse.json();
        responseText = data.response;
    } else {
        const llmResponse = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: SF_TEST_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3
            })
        });
        if (!llmResponse.ok) throw new Error(`LLM Error: ${await llmResponse.text()}`);
        const data = await llmResponse.json();
        responseText = data.choices[0].message.content;
    }

    // Extract JSON from the response (LLM might wrap it in markdown)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON test steps. Raw output: ' + responseText.substring(0, 300));
    }
    return JSON.parse(jsonMatch[0]);
}

// ─── Helper: Login to Salesforce ────────────────────────────────────────────
async function loginToSalesforce(page: Page): Promise<void> {
    console.log(`[SF-AutoTest] Logging into Salesforce at: ${SF_LOGIN_URL}`);
    await page.goto(SF_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Fill credentials
    await page.fill('#username', SF_USERNAME);
    await page.fill('#password', SF_PASSWORD);
    await page.click('#Login');

    // Wait for Lightning to load (or classic home)
    await page.waitForURL(/.*lightning.*|.*home.*|.*setup.*/i, { timeout: 60000 });
    console.log(`[SF-AutoTest] Logged in. Current URL: ${page.url()}`);
}

// ─── Helper: Execute a single test step ─────────────────────────────────────
async function executeStep(page: Page, step: GeneratedTestStep, baseUrl: string): Promise<TestResult> {
    const result: TestResult = {
        stepId: step.id,
        description: step.description,
        action: step.action,
        target: step.target,
        value: step.value,
        status: 'pass'
    };

    try {
        switch (step.action) {
            case 'navigate': {
                const url = step.target.startsWith('http') ? step.target : `${baseUrl}${step.target}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000); // Let Salesforce Lightning render
                break;
            }
            case 'click': {
                const locatorStr = step.target;
                let element;

                // Parse the Playwright locator string
                if (locatorStr.startsWith('getByRole')) {
                    const roleMatch = locatorStr.match(/getByRole\("([^"]+)"(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\)/);
                    if (roleMatch) {
                        element = roleMatch[2]
                            ? page.getByRole(roleMatch[1] as any, { name: roleMatch[2] })
                            : page.getByRole(roleMatch[1] as any);
                    }
                } else if (locatorStr.startsWith('getByText')) {
                    const textMatch = locatorStr.match(/getByText\("([^"]+)"\)/);
                    if (textMatch) element = page.getByText(textMatch[1]);
                } else if (locatorStr.startsWith('getByLabel')) {
                    const labelMatch = locatorStr.match(/getByLabel\("([^"]+)"\)/);
                    if (labelMatch) element = page.getByLabel(labelMatch[1]);
                } else if (locatorStr.startsWith('getByPlaceholder')) {
                    const phMatch = locatorStr.match(/getByPlaceholder\("([^"]+)"\)/);
                    if (phMatch) element = page.getByPlaceholder(phMatch[1]);
                } else if (locatorStr.startsWith('getByTestId')) {
                    const tidMatch = locatorStr.match(/getByTestId\("([^"]+)"\)/);
                    if (tidMatch) element = page.getByTestId(tidMatch[1]);
                } else if (locatorStr.startsWith('locator')) {
                    const cssMatch = locatorStr.match(/locator\("([^"]+)"\)/);
                    if (cssMatch) element = page.locator(cssMatch[1]);
                }

                if (!element) element = page.locator(locatorStr);
                await element.first().click({ timeout: 15000 });
                await page.waitForTimeout(1500);
                break;
            }
            case 'fill': {
                const value = step.value || '';
                let fillElement;

                if (step.target.startsWith('getByLabel')) {
                    const labelMatch = step.target.match(/getByLabel\("([^"]+)"\)/);
                    if (labelMatch) fillElement = page.getByLabel(labelMatch[1]);
                } else if (step.target.startsWith('getByPlaceholder')) {
                    const phMatch = step.target.match(/getByPlaceholder\("([^"]+)"\)/);
                    if (phMatch) fillElement = page.getByPlaceholder(phMatch[1]);
                } else if (step.target.startsWith('getByRole')) {
                    const roleMatch = step.target.match(/getByRole\("([^"]+)"(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\)/);
                    if (roleMatch) {
                        fillElement = roleMatch[2]
                            ? page.getByRole(roleMatch[1] as any, { name: roleMatch[2] })
                            : page.getByRole(roleMatch[1] as any);
                    }
                } else if (step.target.startsWith('locator')) {
                    const cssMatch = step.target.match(/locator\("([^"]+)"\)/);
                    if (cssMatch) fillElement = page.locator(cssMatch[1]);
                }

                if (!fillElement) fillElement = page.locator(step.target);
                await fillElement.first().fill(value, { timeout: 15000 });
                await page.waitForTimeout(500);
                break;
            }
            case 'assert': {
                let assertElement;
                if (step.target.startsWith('getByText')) {
                    const textMatch = step.target.match(/getByText\("([^"]+)"\)/);
                    if (textMatch) assertElement = page.getByText(textMatch[1]);
                } else if (step.target.startsWith('getByRole')) {
                    const roleMatch = step.target.match(/getByRole\("([^"]+)"(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\)/);
                    if (roleMatch) {
                        assertElement = roleMatch[2]
                            ? page.getByRole(roleMatch[1] as any, { name: roleMatch[2] })
                            : page.getByRole(roleMatch[1] as any);
                    }
                } else {
                    assertElement = page.locator(step.target);
                }

                if (!assertElement) assertElement = page.locator(step.target);
                await assertElement.first().waitFor({ state: 'visible', timeout: 15000 });
                break;
            }
            default:
                result.status = 'skipped';
                result.error = `Unknown action type: ${step.action}`;
        }
    } catch (err: any) {
        result.status = 'fail';
        result.error = err.message || 'Step execution failed';

        // Capture screenshot on failure
        try {
            const buffer = await page.screenshot({ type: 'png' });
            result.screenshotBase64 = buffer.toString('base64');
        } catch { /* ignore screenshot errors */ }
    }

    return result;
}

// ─── Route: Run Automated Tests ─────────────────────────────────────────────
router.post('/run', async (req: Request, res: Response) => {
    let testBrowser: Browser | null = null;

    try {
        const { userStory, provider, model, apiUrl, apiKey } = req.body;

        if (!userStory) {
            res.status(400).json({ error: 'User story is required.' });
            return;
        }
        if (!provider || !model || !apiUrl) {
            res.status(400).json({ error: 'LLM settings (provider, model, apiUrl) are required.' });
            return;
        }
        if (!SF_USERNAME || !SF_PASSWORD) {
            res.status(400).json({ error: 'Salesforce credentials not configured in .env file.' });
            return;
        }

        // Phase 1: Generate test steps via LLM
        console.log('[SF-AutoTest] Phase 1: Generating test steps from user story...');
        const testSteps = await callLLM(userStory, provider, model, apiUrl, apiKey);
        console.log(`[SF-AutoTest] Generated ${testSteps.length} test steps.`);

        // Phase 2: Launch browser and login
        console.log('[SF-AutoTest] Phase 2: Launching browser and logging into Salesforce...');
        testBrowser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            args: ['--start-maximized']
        });
        const testContext = await testBrowser.newContext({ viewport: null });
        const testPage = await testContext.newPage();

        await loginToSalesforce(testPage);

        // Get the base URL from the current authenticated URL
        const currentUrl = new URL(testPage.url());
        const baseUrl = `${currentUrl.protocol}//${currentUrl.host}`;

        // Phase 3: Execute test steps
        console.log('[SF-AutoTest] Phase 3: Executing test steps...');
        const results: TestResult[] = [];
        const defects: Defect[] = [];
        let defectCounter = 1;

        for (const step of testSteps) {
            console.log(`[SF-AutoTest]   Step ${step.id}: ${step.description}`);
            const result = await executeStep(testPage, step, baseUrl);
            results.push(result);

            if (result.status === 'fail') {
                defects.push({
                    id: defectCounter++,
                    stepId: step.id,
                    description: `Failed: ${step.description}`,
                    error: result.error || 'Unknown error',
                    screenshotBase64: result.screenshotBase64 || ''
                });
            }
        }

        // Phase 4: Build summary
        const passCount = results.filter(r => r.status === 'pass').length;
        const failCount = results.filter(r => r.status === 'fail').length;
        const skipCount = results.filter(r => r.status === 'skipped').length;

        const summary = {
            totalSteps: results.length,
            passed: passCount,
            failed: failCount,
            skipped: skipCount,
            passRate: results.length > 0 ? Math.round((passCount / results.length) * 100) : 0,
            defectsFound: defects.length,
            executedAt: new Date().toISOString()
        };

        console.log(`[SF-AutoTest] ✅ Complete. ${passCount} passed, ${failCount} failed, ${skipCount} skipped.`);

        // Close browser
        await testBrowser.close().catch(() => {});
        testBrowser = null;

        res.json({
            testSteps,
            results,
            defects,
            summary
        });

    } catch (error: any) {
        console.error('[SF-AutoTest] Error:', error);

        // Cleanup browser on error
        if (testBrowser) {
            await testBrowser.close().catch(() => {});
        }

        res.status(500).json({ error: error.message || 'Automated test execution failed' });
    }
});

export default router;
