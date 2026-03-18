const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

// Configuration
const ARTIFACT_DIR = 'C:/Users/SANTOSH/.gemini/antigravity/brain/dcf4d161-3b2b-4266-bcd4-3fca77a8d2bc';
const DESIGN_DIR = 'c:/Users/SANTOSH/AITesterLearning/Project_01_LocalLLMTestGenerator/Design';
const OUTPUT_FILE = path.join(DESIGN_DIR, 'TARS_Walkthrough.pptx');

const pres = new pptxgen();

// Set default layout
pres.layout = 'LAYOUT_WIDE';

// Title Slide
let slide = pres.addSlide();
slide.background = { color: '0F172A' }; // Dark slate
slide.addText('T.A.R.S', {
    x: 1, y: 1.5, w: '80%', h: 1,
    fontSize: 60, bold: true, color: 'F1F5F9', fontFace: 'Arial',
    align: pres.AlignH.center
});
slide.addText('Test Automation & Reporting Suite', {
    x: 1, y: 2.5, w: '80%', h: 0.5,
    fontSize: 24, color: '94A3B8', fontFace: 'Arial',
    align: pres.AlignH.center
});
slide.addText('AI-Powered QA for Modern Enterprises', {
    x: 1, y: 4.5, w: '80%', h: 0.5,
    fontSize: 18, color: 'FACC15', fontFace: 'Arial', // Amber
    align: pres.AlignH.center
});

// The Plan / Vision Slide
slide = pres.addSlide();
slide.addText('The Vision & Strategic Plan', { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: '1E293B' });
slide.addText([
    { text: 'Empowering software teams to bridge the gap between manual testing and robust automation with AI-driven insights.', options: { bullet: true, indent: 10 } },
    { text: 'Phase 1: Foundation (Core Engine, React Frontend, Node.js Backend)', options: { bullet: true } },
    { text: 'Phase 2: Recording (Low-code Playwright session recording)', options: { bullet: true } },
    { text: 'Phase 3: Intelligence (LLM-based test generation from user stories)', options: { bullet: true } },
    { text: 'Phase 4: Analytics (Historical performance and defect tracking)', options: { bullet: true } },
    { text: 'Phase 5: Salesforce Live (Executing automation directly in CRM environments)', options: { bullet: true } }
], { x: 0.5, y: 1.2, w: '90%', h: 4, fontSize: 18, color: '334155' });

// Function to add a feature slide
const addFeatureSlide = (title, description, imagePath) => {
    const s = pres.addSlide();
    s.addText(title, { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: '1E293B' });
    s.addText(description, { x: 0.5, y: 0.8, w: '90%', fontSize: 14, color: '64748B' });
    
    if (fs.existsSync(imagePath)) {
        s.addImage({ path: imagePath, x: 0.5, y: 1.5, w: 9, h: 5.1 });
    } else {
        s.addText('[Screenshot Missing: ' + path.basename(imagePath) + ']', { x: 4, y: 3, color: 'FF0000' });
    }
};

// Feature Slides
addFeatureSlide(
    '1. Quality Insights Dashboard',
    'A central hub for measuring test effectiveness. Real-time charts track pass rates, step outcomes, and defect distribution over time.',
    path.join(ARTIFACT_DIR, 'dashboard_view_1773688134289.png')
);

addFeatureSlide(
    '2. Intelligent Test Builder',
    'Convert natural language requirements into comprehensive test cases using cutting-edge LLMs. Support for multiple providers including Ollama, OpenAI, and Gemini.',
    path.join(ARTIFACT_DIR, 'test_builder_view_1773688158000.png')
);

addFeatureSlide(
    '3. Action Recorder',
    'The low-code way to build tests. Record browser interactions directly and export them into structured Playwright test scripts.',
    path.join(ARTIFACT_DIR, 'recorder_view_1773688196794.png')
);

addFeatureSlide(
    '4. Live Salesforce Automation',
    'Execute tests directly in Salesforce environments. Seamlessly handle logins, navigation, and data verification with detailed execution logs and failure screenshots.',
    path.join(ARTIFACT_DIR, 'auto_test_view_1773688220584.png')
);

addFeatureSlide(
    '5. Enterprise Configuration',
    'Customizable engine settings. Manage API keys, models, and provider endpoints to tailor the AI experience to your organization\'s infrastructure.',
    path.join(ARTIFACT_DIR, 'settings_view_1773688260906.png')
);

// Tech Stack Slide
slide = pres.addSlide();
slide.addText('Technology Stack', { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: '1E293B' });
slide.addText('Built on a modern, scalable architecture designed for speed and reliability.', { x: 0.5, y: 1.0, fontSize: 16, color: '64748B' });

const techOptions = { x: 0.5, y: 1.8, w: 4, h: 3, fontSize: 16 };
slide.addText([
    { text: 'Frontend:', options: { bold: true, color: '2563EB' } },
    { text: '\n- React 18, Vite, Tailwind CSS\n- Lucide Icons, Recharts for BI' }
], techOptions);

slide.addText([
    { text: 'Backend:', options: { bold: true, color: '2563EB' } },
    { text: '\n- Node.js, Express\n- Axios for API communication' }
], { ...techOptions, x: 5 });

slide.addText([
    { text: 'Automation & AI:', options: { bold: true, color: '2563EB' } },
    { text: '\n- Playwright for Browser Ops\n- Ollama / Gemma 2-3 for Reasoning' }
], { ...techOptions, y: 3.5 });

// Future Roadmap
slide = pres.addSlide();
slide.addText('Roadmap & Future Scope', { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: '1E293B' });
slide.addText([
    { text: 'Multi-platform support (ServiceNow, Oracle Cloud, SAP)', options: { bullet: true } },
    { text: 'AI-driven self-healing selectors for flaky tests', options: { bullet: true } },
    { text: 'Integration with CI/CD pipelines (GitHub Actions, Jenkins)', options: { bullet: true } },
    { text: 'Advanced Defect Clustering and Root Cause Analysis', options: { bullet: true } }
], { x: 0.5, y: 1.5, fontSize: 20 });

// Final Slide
slide = pres.addSlide();
slide.background = { color: '0F172A' };
slide.addText('T.A.R.S', { x: 0, y: 2.5, w: '100%', fontSize: 44, bold: true, color: 'F8FAFC', align: pres.AlignH.center });
slide.addText('The Future of Quality Assurance', { x: 0, y: 3.5, w: '100%', fontSize: 20, color: '94A3B8', align: pres.AlignH.center });

// Save the Presentation
pres.writeFile({ fileName: OUTPUT_FILE })
    .then(fileName => console.log('Presentation saved at: ' + fileName))
    .catch(err => {
        console.error('Error saving presentation:', err);
        process.exit(1);
    });
