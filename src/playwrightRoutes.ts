import express, { Request, Response } from 'express';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// ─── Session State ──────────────────────────────────────────────────────────
// Holds the active Playwright browser session (singleton — one session at a time)
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let isRecording = false;

// Stores locators discovered during the session
interface DiscoveredLocator {
    tag: string;
    selectorType: string;  // 'data-testid' | 'role' | 'id' | 'name' | 'placeholder' | 'css'
    locator: string;       // The Playwright locator string
    text: string;          // Visible text content
    url: string;           // The page URL where it was found
}

// Stores recorded user actions
interface RecordedAction {
    type: 'navigate' | 'click' | 'fill' | 'page-load';
    target?: string;       // locator or URL
    value?: string;        // for fill actions
    timestamp: number;
    url: string;
}

let discoveredLocators: DiscoveredLocator[] = [];
let recordedActions: RecordedAction[] = [];
let sessionStartTime: number | null = null;

// ─── DOM Scanner Script ─────────────────────────────────────────────────────
// This script is injected into each page to discover interactive elements
const DOM_SCANNER_SCRIPT = `
(() => {
    const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="combobox"], [role="searchbox"]';
    const elements = document.querySelectorAll(interactiveSelectors);
    const results = [];

    elements.forEach(el => {
        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null) return;

        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().substring(0, 80);
        const type = el.getAttribute('type') || '';

        // Build locator using priority chain for stability
        let selectorType = 'css';
        let locator = '';

        // Priority 1: data-testid
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy');
        if (testId) {
            selectorType = 'data-testid';
            locator = 'getByTestId("' + testId + '")';
        }
        // Priority 2: ARIA role + name
        else if (el.getAttribute('role') || ['button', 'a', 'input', 'textarea', 'select'].includes(tag)) {
            const ariaLabel = el.getAttribute('aria-label');
            const placeholder = el.getAttribute('placeholder');
            const name = el.getAttribute('name');
            const roleAttr = el.getAttribute('role');

            if (tag === 'button' || roleAttr === 'button') {
                selectorType = 'role';
                locator = 'getByRole("button", { name: "' + (ariaLabel || text || 'unknown') + '" })';
            } else if (tag === 'a' || roleAttr === 'link') {
                selectorType = 'role';
                locator = 'getByRole("link", { name: "' + (ariaLabel || text || 'unknown') + '" })';
            } else if ((tag === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(type)) || tag === 'textarea' || roleAttr === 'textbox' || roleAttr === 'searchbox') {
                selectorType = 'role';
                locator = 'getByRole("textbox", { name: "' + (ariaLabel || placeholder || name || 'unknown') + '" })';
            } else if (tag === 'input' && type === 'checkbox') {
                selectorType = 'role';
                locator = 'getByRole("checkbox", { name: "' + (ariaLabel || text || 'unknown') + '" })';
            } else if (tag === 'input' && type === 'radio') {
                selectorType = 'role';
                locator = 'getByRole("radio", { name: "' + (ariaLabel || text || 'unknown') + '" })';
            } else if (tag === 'select' || roleAttr === 'combobox') {
                selectorType = 'role';
                locator = 'getByRole("combobox", { name: "' + (ariaLabel || name || 'unknown') + '" })';
            } else if (roleAttr) {
                selectorType = 'role';
                locator = 'getByRole("' + roleAttr + '", { name: "' + (ariaLabel || text || 'unknown') + '" })';
            }
        }

        // Priority 3: id attribute
        if (!locator && el.id) {
            selectorType = 'id';
            locator = 'locator("#' + el.id + '")';
        }

        // Priority 4: name attribute
        if (!locator && el.getAttribute('name')) {
            selectorType = 'name';
            locator = 'locator("[name=\\\\"' + el.getAttribute('name') + '\\\\"]")';
        }

        // Priority 5: placeholder
        if (!locator && el.getAttribute('placeholder')) {
            selectorType = 'placeholder';
            locator = 'getByPlaceholder("' + el.getAttribute('placeholder') + '")';
        }

        // Priority 6: CSS fallback
        if (!locator) {
            const classes = Array.from(el.classList).slice(0, 2).join('.');
            locator = 'locator("' + tag + (classes ? '.' + classes : '') + '")';
        }

        results.push({ tag, selectorType, locator, text, type });
    });

    return results;
})()
`;

// ─── Helper: Scan Current Page for Locators ─────────────────────────────────
async function scanPageForLocators(targetPage: Page): Promise<void> {
    try {
        const currentUrl = targetPage.url();
        const elements = await targetPage.evaluate(DOM_SCANNER_SCRIPT);

        if (Array.isArray(elements)) {
            // Only add locators we haven't already discovered
            const existingKeys = new Set(discoveredLocators.map(l => l.locator));
            for (const el of elements) {
                if (!existingKeys.has(el.locator)) {
                    discoveredLocators.push({
                        tag: el.tag,
                        selectorType: el.selectorType,
                        locator: el.locator,
                        text: el.text,
                        url: currentUrl
                    });
                    existingKeys.add(el.locator);
                }
            }
        }
    } catch (err) {
        console.warn('Locator scan failed (page may have navigated):', (err as Error).message);
    }
}

// ─── Route: Launch Browser ──────────────────────────────────────────────────
router.post('/launch', async (req: Request, res: Response) => {
    try {
        const { url } = req.body;

        if (!url) {
            res.status(400).json({ error: 'Target URL is required' });
            return;
        }

        // Close any existing session
        if (browser) {
            await browser.close().catch(() => { });
            browser = null;
            context = null;
            page = null;
        }

        // Reset state
        discoveredLocators = [];
        recordedActions = [];
        sessionStartTime = Date.now();
        isRecording = true;

        console.log(`[Playwright] Launching Chromium and navigating to: ${url}`);

        // Launch the user's installed Chrome browser in headed mode
        browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            args: ['--start-maximized']
        });

        context = await browser.newContext({ viewport: null });
        page = await context.newPage();

        // Record the initial navigation
        recordedActions.push({
            type: 'navigate',
            target: url,
            timestamp: Date.now(),
            url: url
        });

        // Listen for navigations to scan new pages
        page.on('load', async () => {
            if (!isRecording || !page) return;
            const currentUrl = page.url();
            console.log(`[Playwright] Page loaded: ${currentUrl}`);

            recordedActions.push({
                type: 'page-load',
                target: currentUrl,
                timestamp: Date.now(),
                url: currentUrl
            });

            // Auto-scan for locators after page loads
            await scanPageForLocators(page);
        });

        // Listen for page close
        page.on('close', () => {
            console.log('[Playwright] Page was closed by user');
            isRecording = false;
        });

        // Navigate to the target URL
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Initial locator scan
        await scanPageForLocators(page);

        res.json({
            status: 'launched',
            url: url,
            locatorsFound: discoveredLocators.length,
            sessionStartTime
        });

    } catch (error: any) {
        console.error('[Playwright] Launch error:', error);
        res.status(500).json({ error: error.message || 'Failed to launch browser' });
    }
});

// ─── Route: Get Session Status ──────────────────────────────────────────────
router.get('/status', async (_req: Request, res: Response) => {
    // If the page is active, re-scan for any new locators
    if (page && isRecording) {
        try {
            await scanPageForLocators(page);
        } catch (e) {
            // Page might be navigating — that's OK
        }
    }

    res.json({
        active: isRecording && browser !== null,
        locatorsCount: discoveredLocators.length,
        actionsCount: recordedActions.length,
        sessionStartTime,
        currentUrl: page ? page.url() : null
    });
});

// ─── Route: Get Discovered Locators ─────────────────────────────────────────
router.get('/locators', async (_req: Request, res: Response) => {
    // Re-scan latest state if active
    if (page && isRecording) {
        try {
            await scanPageForLocators(page);
        } catch (e) { /* ignore */ }
    }

    res.json({
        locators: discoveredLocators,
        actions: recordedActions
    });
});

// ─── Route: Stop Recording ──────────────────────────────────────────────────
router.post('/stop', async (_req: Request, res: Response) => {
    try {
        isRecording = false;

        // Do one final scan before closing
        if (page) {
            try {
                await scanPageForLocators(page);
            } catch (e) { /* ignore */ }
        }

        // Close browser
        if (browser) {
            await browser.close().catch(() => { });
            browser = null;
            context = null;
            page = null;
        }

        console.log(`[Playwright] Session stopped. Discovered ${discoveredLocators.length} locators, ${recordedActions.length} actions.`);

        res.json({
            status: 'stopped',
            locators: discoveredLocators,
            actions: recordedActions,
            totalLocators: discoveredLocators.length,
            totalActions: recordedActions.length
        });

    } catch (error: any) {
        console.error('[Playwright] Stop error:', error);
        res.status(500).json({ error: error.message || 'Failed to stop session' });
    }
});

// ─── Route: Generate Playwright Test ────────────────────────────────────────
router.post('/generate-test', async (req: Request, res: Response) => {
    try {
        const { testName } = req.body;
        const name = testName || 'Recorded Navigation Test';

        if (recordedActions.length === 0 && discoveredLocators.length === 0) {
            res.status(400).json({ error: 'No recorded actions or locators. Launch and navigate a site first.' });
            return;
        }

        // Build the test file content
        let testCode = `import { test, expect } from '@playwright/test';\n\n`;
        testCode += `test('${name}', async ({ page }) => {\n`;

        // Group actions by URL for clean structure
        const navigations = recordedActions.filter(a => a.type === 'navigate' || a.type === 'page-load');
        const uniqueUrls = [...new Set(navigations.map(n => n.target))];

        // Generate navigation steps
        if (uniqueUrls.length > 0) {
            testCode += `  // ── Navigation ──\n`;
            testCode += `  await page.goto('${uniqueUrls[0]}');\n\n`;
        }

        // Group locators by page URL for structured assertions
        const locatorsByUrl: Record<string, DiscoveredLocator[]> = {};
        for (const loc of discoveredLocators) {
            if (!locatorsByUrl[loc.url]) locatorsByUrl[loc.url] = [];
            locatorsByUrl[loc.url].push(loc);
        }

        // Generate locator assertions — pick the most important elements
        for (const [url, locators] of Object.entries(locatorsByUrl)) {
            testCode += `  // ── Assertions for: ${url} ──\n`;

            // Prioritize role-based and testid locators, limit to 15 per page
            const prioritized = locators
                .sort((a, b) => {
                    const priority: Record<string, number> = { 'data-testid': 0, 'role': 1, 'id': 2, 'placeholder': 3, 'name': 4, 'css': 5 };
                    return (priority[a.selectorType] ?? 5) - (priority[b.selectorType] ?? 5);
                })
                .slice(0, 15);

            for (const loc of prioritized) {
                const comment = loc.text ? ` // "${loc.text.substring(0, 40)}"` : '';
                testCode += `  await expect(page.${loc.locator}).toBeVisible();${comment}\n`;
            }
            testCode += '\n';
        }

        testCode += `});\n`;

        // Save the generated test to disk
        const outputDir = path.resolve(__dirname, '..', 'generated-tests');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.spec.ts`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, testCode, 'utf-8');

        console.log(`[Playwright] Generated test file: ${filePath}`);

        res.json({
            testCode,
            fileName,
            filePath,
            locatorsUsed: discoveredLocators.length,
            actionsRecorded: recordedActions.length
        });

    } catch (error: any) {
        console.error('[Playwright] Test generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate test' });
    }
});

// ─── Route: Generate High-Level Test Scenarios (Positive/Negative) ──────
router.post('/generate-scenarios', async (req: Request, res: Response) => {
    try {
        const { provider, model, apiUrl, apiKey } = req.body;

        if (!provider || !model || !apiUrl) {
            res.status(400).json({ error: 'LLM settings (provider, model, apiUrl) are required' });
            return;
        }

        if (recordedActions.length === 0 && discoveredLocators.length === 0) {
            res.status(400).json({ error: 'No recorded actions or locators. Launch and navigate a site first.' });
            return;
        }

        // Build a detailed prompt for the LLM
        const locatorsList = discoveredLocators.map(l => `- Tag: ${l.tag}, Locator: ${l.locator}, Text: "${l.text}"`).join('\n');
        const actionsList = recordedActions.map(a => `- ${a.type} ${a.target || ''} ${a.value ? '(value: ' + a.value + ')' : ''}`).join('\n');

        const prompt = `You are an expert Automation Architect. Based on the following recorded session and discovered locators, generate at least 3 Positive and 3 Negative test cases.
Each test case must include:
1. N (Number)
2. Req ID (e.g., REQ-001)
3. Test Objective
4. Test Steps (Mention the specifically discovered locators like getByRole... or getByTestId...)
5. Expected Result

RECORDED SESSION:
${actionsList}

DISCOVERED LOCATORS:
${locatorsList}

CRITICAL: Output the test cases strictly in the following format:
- N: 
- Req ID: 
- Test Objective: 
- Test Steps:
- Expected Result:

Separate Positive and Negative sections clearly. Do not include any other text.`;

        let generatedScenarios = '';

        // Call LLM (Duplicate logic from llmRoutes for standalone functionality)
        if (provider === 'ollama') {
            const ollamaResponse = await fetch(`${apiUrl.replace(/\/$/, "")}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt, stream: false })
            });
            if (!ollamaResponse.ok) throw new Error(`Ollama Error: ${ollamaResponse.statusText}`);
            const data = await ollamaResponse.json();
            generatedScenarios = data.response;
        } else {
            const llmResponse = await fetch(`${apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'system', content: 'You are a QA automation expert.' }, { role: 'user', content: prompt }],
                    temperature: 0.7
                })
            });
            if (!llmResponse.ok) throw new Error(`LLM Error: ${llmResponse.statusText}`);
            const data = await llmResponse.json();
            generatedScenarios = data.choices[0].message.content;
        }

        res.json({ scenarios: generatedScenarios });

    } catch (error: any) {
        console.error('[Playwright] Scenario generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate test scenarios' });
    }
});

export default router;
