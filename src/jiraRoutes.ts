import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';

// Helper to build Atlassian auth header
function getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
}

// Derive the REST API base from the JIRA_BASE_URL
// e.g. https://santoshbalasubramani.atlassian.net/jira -> https://santoshbalasubramani.atlassian.net
function getApiBase(): string {
    try {
        const url = new URL(JIRA_BASE_URL);
        return `${url.protocol}//${url.host}`;
    } catch {
        return JIRA_BASE_URL.replace(/\/jira\/?$/, '');
    }
}

// GET /api/jira/stories - Fetch recent stories/tasks from Jira
router.get('/stories', async (req: Request, res: Response) => {
    try {
        if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
            res.status(400).json({ error: 'Jira credentials not configured in .env file.' });
            return;
        }

        const projectKey = req.query.project as string || '';
        const maxResults = req.query.maxResults || 30;

        // JQL to fetch recent stories/tasks assigned to user or all recent
        let jql = `issuetype in (Story, Task, Bug) ORDER BY updated DESC`;
        if (projectKey) {
            jql = `project = "${projectKey}" AND ${jql}`;
        }

        const apiBase = getApiBase();
        const searchUrl = `${apiBase}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,issuetype,project,assignee`;

        console.log(`[Jira] Fetching stories from: ${searchUrl}`);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': getAuthHeader(),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            console.error(`[Jira] Error fetching stories: ${response.status} ${errorText}`);
            throw new Error(`Jira API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const stories = data.issues.map((issue: any) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name || 'Unknown',
            issueType: issue.fields.issuetype?.name || 'Unknown',
            project: issue.fields.project?.name || 'Unknown',
            projectKey: issue.fields.project?.key || '',
            assignee: issue.fields.assignee?.displayName || 'Unassigned'
        }));

        res.json({ stories, total: data.total });
    } catch (error: any) {
        console.error('[Jira] Stories fetch error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch Jira stories' });
    }
});

// GET /api/jira/projects - Fetch projects from Jira
router.get('/projects', async (req: Request, res: Response) => {
    try {
        if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
            res.status(400).json({ error: 'Jira credentials not configured in .env file.' });
            return;
        }

        const apiBase = getApiBase();
        const projectsUrl = `${apiBase}/rest/api/3/project/search?maxResults=50&orderBy=name`;

        const response = await fetch(projectsUrl, {
            method: 'GET',
            headers: {
                'Authorization': getAuthHeader(),
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Jira API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const projects = data.values.map((p: any) => ({
            key: p.key,
            name: p.name
        }));

        res.json({ projects });
    } catch (error: any) {
        console.error('[Jira] Projects fetch error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch Jira projects' });
    }
});

// POST /api/jira/upload - Upload test cases as a comment to a Jira issue
router.post('/upload', async (req: Request, res: Response) => {
    try {
        if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
            res.status(400).json({ error: 'Jira credentials not configured in .env file.' });
            return;
        }

        const { issueKey, testCasesContent } = req.body;

        if (!issueKey || !testCasesContent) {
            res.status(400).json({ error: 'issueKey and testCasesContent are required.' });
            return;
        }

        const apiBase = getApiBase();
        const commentUrl = `${apiBase}/rest/api/3/issue/${issueKey}/comment`;

        console.log(`[Jira] Uploading test cases to issue: ${issueKey}`);

        // Atlassian Document Format (ADF) for the comment
        // We convert the markdown content to a simple code block in ADF
        const commentBody = {
            body: {
                version: 1,
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 3 },
                        content: [
                            {
                                type: 'text',
                                text: '🧪 Generated Test Cases'
                            }
                        ]
                    },
                    {
                        type: 'codeBlock',
                        attrs: { language: 'markdown' },
                        content: [
                            {
                                type: 'text',
                                text: testCasesContent
                            }
                        ]
                    }
                ]
            }
        };

        const response = await fetch(commentUrl, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentBody)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            console.error(`[Jira] Error uploading: ${response.status} ${errorText}`);
            throw new Error(`Jira API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`[Jira] Successfully uploaded test cases to ${issueKey}`);

        res.json({
            success: true,
            message: `Test cases uploaded to ${issueKey} as a comment.`,
            commentId: result.id,
            issueKey
        });
    } catch (error: any) {
        console.error('[Jira] Upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload test cases to Jira' });
    }
});

// POST /api/jira/create-defect - Create a Bug issue in Jira with screenshot
router.post('/create-defect', async (req: Request, res: Response) => {
    try {
        if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
            res.status(400).json({ error: 'Jira credentials not configured in .env file.' });
            return;
        }

        const { projectKey, summary, description, linkedStoryKey, screenshotBase64 } = req.body;

        if (!projectKey || !summary) {
            res.status(400).json({ error: 'projectKey and summary are required.' });
            return;
        }

        const apiBase = getApiBase();

        // Step 1: Create the Bug issue
        console.log(`[Jira] Creating Bug in project ${projectKey}: ${summary}`);

        const createBody: any = {
            fields: {
                project: { key: projectKey },
                summary: summary,
                description: {
                    version: 1,
                    type: 'doc',
                    content: [
                        {
                            type: 'heading',
                            attrs: { level: 3 },
                            content: [{ type: 'text', text: '🐛 Automated Test Defect' }]
                        },
                        {
                            type: 'codeBlock',
                            attrs: { language: 'text' },
                            content: [{ type: 'text', text: description || 'Defect found during automated Salesforce testing.' }]
                        }
                    ]
                },
                issuetype: { name: 'Bug' }
            }
        };

        const createResponse = await fetch(`${apiBase}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createBody)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text().catch(() => createResponse.statusText);
            console.error(`[Jira] Error creating defect: ${createResponse.status} ${errorText}`);
            throw new Error(`Jira API Error ${createResponse.status}: ${errorText}`);
        }

        const createdIssue = await createResponse.json();
        const createdKey = createdIssue.key;
        console.log(`[Jira] Bug created: ${createdKey}`);

        // Step 2: Link to parent story if provided
        if (linkedStoryKey) {
            try {
                await fetch(`${apiBase}/rest/api/3/issueLink`, {
                    method: 'POST',
                    headers: {
                        'Authorization': getAuthHeader(),
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: { name: 'Blocks' },
                        inwardIssue: { key: createdKey },
                        outwardIssue: { key: linkedStoryKey },
                        comment: {
                            body: {
                                version: 1,
                                type: 'doc',
                                content: [{
                                    type: 'paragraph',
                                    content: [{ type: 'text', text: `Defect found during automated testing of ${linkedStoryKey}` }]
                                }]
                            }
                        }
                    })
                });
                console.log(`[Jira] Linked ${createdKey} to ${linkedStoryKey}`);
            } catch (linkErr: any) {
                console.warn(`[Jira] Could not link issues: ${linkErr.message}`);
            }
        }

        // Step 3: Attach screenshot if provided
        if (screenshotBase64) {
            try {
                const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');
                const boundary = '----FormBoundary' + Date.now();
                const filename = `defect_${createdKey}_screenshot.png`;

                // Build multipart form data manually
                const bodyParts = [
                    `--${boundary}\r\n`,
                    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
                    `Content-Type: image/png\r\n\r\n`,
                ];
                const headerBuffer = Buffer.from(bodyParts.join(''));
                const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
                const multipartBody = Buffer.concat([headerBuffer, screenshotBuffer, footerBuffer]);

                await fetch(`${apiBase}/rest/api/3/issue/${createdKey}/attachments`, {
                    method: 'POST',
                    headers: {
                        'Authorization': getAuthHeader(),
                        'X-Atlassian-Token': 'no-check',
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body: multipartBody
                });
                console.log(`[Jira] Screenshot attached to ${createdKey}`);
            } catch (attachErr: any) {
                console.warn(`[Jira] Could not attach screenshot: ${attachErr.message}`);
            }
        }

        res.json({
            success: true,
            message: `Bug ${createdKey} created in project ${projectKey}.`,
            issueKey: createdKey,
            linkedTo: linkedStoryKey || null
        });
    } catch (error: any) {
        console.error('[Jira] Create defect error:', error);
        res.status(500).json({ error: error.message || 'Failed to create defect in Jira' });
    }
});

export default router;

