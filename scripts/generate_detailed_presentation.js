const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

// Configuration
const ARTIFACT_DIR = 'C:/Users/SANTOSH/.gemini/antigravity/brain/dcf4d161-3b2b-4266-bcd4-3fca77a8d2bc';
const DESIGN_DIR = 'c:/Users/SANTOSH/AITesterLearning/Project_01_LocalLLMTestGenerator/Design';
const OUTPUT_FILE = path.join(DESIGN_DIR, 'TARS_Detailed_Walkthrough.pptx');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';

// --- THEME COLORS ---
const COLORS = {
    BG: '0F172A',         // Slate 900
    HEADER: 'F1F5F9',     // Slate 100
    TEXT: '94A3B8',       // Slate 400
    ACCENT: 'FACC15',     // Amber 400
    PRIMARY: '3B82F6',    // Blue 500
    SUCCESS: '10B981',    // Emerald 500
    DANGER: 'EF4444'      // Red 500
};

// --- HELPER: NEW SLIDE ---
const newSlide = (title) => {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.BG };
    if (title) {
        slide.addText(title, { 
            x: 0.5, y: 0.3, w: '90%', fontSize: 32, bold: true, color: COLORS.ACCENT, fontFace: 'Arial' 
        });
    }
    return slide;
};

// --- SLIDE 1: TITLE ---
let slide = newSlide();
slide.addText('T.A.R.S', {
    x: 1, y: 1.8, w: '80%', fontSize: 72, bold: true, color: COLORS.HEADER, align: pres.AlignH.center
});
slide.addText('Test Automation & Reporting Suite', {
    x: 1, y: 2.8, w: '80%', fontSize: 28, color: COLORS.TEXT, align: pres.AlignH.center
});
slide.addShape(pres.ShapeType.line, { x: 3, y: 3.5, w: 4, h: 0, line: { color: COLORS.ACCENT, width: 2 } });
slide.addText('Comprehensive Walkthrough & Strategic Implementation Plan', {
    x: 1, y: 4.2, w: '80%', fontSize: 18, color: COLORS.ACCENT, italic: true, align: pres.AlignH.center
});

// --- SLIDE 2: EXECUTIVE SUMMARY ---
slide = newSlide('Executive Summary');
slide.addText('Bridging the Gap Between Requirement and Execution', { x: 0.5, y: 0.9, fontSize: 18, color: COLORS.PRIMARY });
slide.addText([
    { text: 'Problem Statement:', options: { bold: true, color: COLORS.HEADER } },
    { text: '\nTraditional manual testing is slow, error-prone, and consumes up to 40% of development cycles. Automation often requires deep coding expertise, creating a bottleneck for QA teams.', options: { fontSize: 16 } },
    { text: '\n\nThe Solution (T.A.R.S):', options: { bold: true, color: COLORS.HEADER } },
    { text: '\nAn AI-orchestrated suite that empowers non-technical users to record, generate, and execute enterprise-grade automated tests in seconds. T.A.R.S leverages Large Language Models (LLMs) to understand business logic and translate it into robust Playwright scripts.', options: { fontSize: 16 } }
], { x: 0.5, y: 1.5, w: '90%', color: COLORS.TEXT });

// --- SLIDE 3: STRATEGIC PLAN & PHASES ---
slide = newSlide('The Strategic Plan');
slide.addText('A phased approach to Enterprise QA excellence.', { x: 0.5, y: 0.9, fontSize: 14, color: COLORS.TEXT });

const phases = [
    { t: 'Phase 1: Foundation', d: 'Establishing the core Node.js/Express backend and a premium React-based glassmorphic UI.' },
    { t: 'Phase 2: Recording', d: 'Enabling zero-code test building via live browser session recording and selector discovery.' },
    { t: 'Phase 3: Intelligence', d: 'Orchestrating LLMs (Ollama/Gemini) to generate test logic from natural language user stories.' },
    { t: 'Phase 4: Analytics', d: 'Implementing high-fidelity data visualization for pass/fail trends and defect management.' },
    { t: 'Phase 5: CRM Live', d: 'Direct execution in secure Salesforce environments with visual failure diagnostics.' }
];

phases.forEach((p, i) => {
    slide.addText(p.t, { x: 0.5, y: 1.5 + (i * 1), fontSize: 18, bold: true, color: COLORS.ACCENT });
    slide.addText(p.d, { x: 0.5, y: 1.8 + (i * 1), fontSize: 14, color: COLORS.TEXT });
});

// --- HELPER: FEATURE SLIDE WITH LARGE IMAGE & ELABORATED TEXT ---
const addElaboratedFeatureSlide = (title, summary, details, imagePath) => {
    const s = newSlide(title);
    s.addText(summary, { x: 0.5, y: 0.85, w: 5, fontSize: 18, bold: true, color: COLORS.HEADER });
    s.addText(details, { x: 0.5, y: 1.4, w: 5, h: 4, fontSize: 14, color: COLORS.TEXT, lineSpacing: 22 });
    
    if (fs.existsSync(imagePath)) {
        s.addImage({ path: imagePath, x: 5.8, y: 1.2, w: 6.8, h: 4.8, shadow: { type: 'outer', blur: 10, offset: 5, color: '000000', opacity: 0.5 } });
    } else {
        s.addText('[Feature Visual Unavailable]', { x: 8, y: 3, color: COLORS.DANGER });
    }
};

// --- FEATURE SLIDES ---
addElaboratedFeatureSlide(
    'Dashboard: The Source of Truth',
    'Data-Driven Decision Making',
    'The Dashboard serves as the central hub for Quality Assurance visibility. It provides:\n' +
    '• Real-Time Metrics: Aggregate pass rates and defect counts from recent runs.\n' +
    '• Trend Analysis: Line charts illustrate performance stability over time, identifying regressions early.\n' +
    '• Defect Clustering: Distribution charts highlight failure patterns, allowing teams to prioritize critical fixes.\n' +
    '• Automated History: Every test run is persisted to a secure local store, ensuring a complete audit trail of testing activities.',
    path.join(ARTIFACT_DIR, 'dashboard_view_1773688134289.png')
);

addElaboratedFeatureSlide(
    'Test Builder: Requirement to Reality',
    'LLM-Powered Logic Generation',
    'The Test Builder eliminates the complexity of script writing. Users simply provide a natural language functional requirement, and T.A.R.S does the rest:\n' +
    '• Context Understanding: The engine analyzes user stories to identify key actions and expected outcomes.\n' +
    '• Modular Steps: Generates human-readable test steps that can be reviewed and edited before execution.\n' +
    '• Provider Agnostic: Integrates with Ollama (local), Google Gemini, and OpenAI to provide flexible reasoning power.\n' +
    '• Seamless Export: Converts requirements directly into structured test playbooks.',
    path.join(ARTIFACT_DIR, 'test_builder_view_1773688158000.png')
);

addElaboratedFeatureSlide(
    'Recorder: Zero-Code Empowerment',
    'Low-Code Test Engineering',
    'For complex UI interactions, the Live Recorder provides a visual way to build automation:\n' +
    '• Precision Capture: Monitors every click, scroll, and keystroke in real-time.\n' +
    '• Intelligent Selectors: Automatically identifies the most stable locators (CSS, XPath, Text) to prevent "flaky" tests.\n' +
    '• Immediate Verification: See the generated Playwright code in real-time as you interact with the browser.\n' +
    '• One-Click Export: Professional test scripts are ready for integration into enterprise repositories immediately.',
    path.join(ARTIFACT_DIR, 'recorder_view_1773688196794.png')
);

addElaboratedFeatureSlide(
    'Auto Test: Live execution',
    'Live CRM Workflow Validation',
    'The "Auto Test" module is the execution engine of T.A.R.S, specifically optimized for complex platforms like Salesforce:\n' +
    '• Secure Orchestration: Handles multi-factor authentication and login flows safely.\n' +
    '• Visual Verification: Captures high-resolution screenshots at every failure point for rapid debugging.\n' +
    '• Step-by-Step Reporting: Provides a live execution log, showing exactly which action succeeded or failed.\n' +
    '• Jira Integration: One-click defect reporting directly from the failed test step, including logs and evidence.',
    path.join(ARTIFACT_DIR, 'auto_test_view_1773688220584.png')
);

addElaboratedFeatureSlide(
    'Settings: Enterprise Configuration',
    'Control and Security',
    'Infrastructure is managed through a streamlined Settings interface, ensuring enterprise compliance:\n' +
    '• Local AI: Support for Ollama allows organizations to run test generation behind a firewall, protecting sensitive intellectual property.\n' +
    '• Endpoint Management: Quick toggles for different environment APIs and model versions.\n' +
    '• Persistent Config: Settings are saved locally, ensuring a consistent user experience across sessions.\n' +
    '• Expandable Provider Support: Modular architecture allows for easy addition of new LLM backends.',
    path.join(ARTIFACT_DIR, 'settings_view_1773688260906.png')
);

// --- SLIDE 9: TECH STACK & SCALABILITY ---
slide = newSlide('The Technical Core');
slide.addText('Scalable, Robust, and Modern', { x: 0.5, y: 0.9, fontSize: 16, color: COLORS.TEXT });

const stack = [
    { label: 'Frontend', d: 'React 18 with Vite for lightning-fast UI responsiveness. Tailwind CSS for premium aesthetics.' },
    { label: 'Backend', d: 'Node.js & Express for a high-performance, non-blocking asynchronous architecture.' },
    { label: 'Automation', d: 'Playwright for industry-leading browser automation and cross-platform reliability.' },
    { label: 'Reasoning', d: 'Orchestrated LLM layers handling everything from logic generation to self-healing analysis.' }
];

stack.forEach((item, i) => {
    slide.addText(item.label + ':', { x: 0.5, y: 1.8 + (i * 1.1), fontSize: 18, bold: true, color: COLORS.PRIMARY });
    slide.addText(item.d, { x: 0.5, y: 2.1 + (i * 1.1), fontSize: 14, color: COLORS.TEXT });
});

// --- SLIDE 10: BUSINESS VALUE & ROI ---
slide = newSlide('Business Value & ROI');
slide.addText('Real-world impact for your organization.', { x: 0.5, y: 0.9, fontSize: 14, color: COLORS.TEXT });

slide.addText([
    { text: '• 70% Reduction in Test Authoring Time:', options: { bold: true, color: COLORS.HEADER } },
    { text: ' Replace hours of manual coding with AI generation.', options: { fontSize: 14 } },
    { text: '\n\n• Accelerated Release Cycles:', options: { bold: true, color: COLORS.HEADER } },
    { text: ' Faster feedback loops enable multiple deployments per week.', options: { fontSize: 14 } },
    { text: '\n\n• Lower Technical Barrier:', options: { bold: true, color: COLORS.HEADER } },
    { text: ' Empower functional experts to own the automation process.', options: { fontSize: 14 } },
    { text: '\n\n• Zero Maintenance Overload:', options: { bold: true, color: COLORS.HEADER } },
    { text: ' AI-generated scripts are consistent and easier to maintain than legacy code.', options: { fontSize: 14 } }
], { x: 0.5, y: 1.6, w: '90%', color: COLORS.TEXT });

// --- SLIDE 11: FUTURE ROADMAP ---
slide = newSlide('Roadmap: The Next Frontier');
slide.addText('Ongoing innovation to redefine Quality Assurance.', { x: 0.5, y: 0.9, fontSize: 14, color: COLORS.TEXT });

slide.addText([
    { text: 'Phase 6: Multi-CRM Support (ServiceNow, Oracle Cloud, SAP)', options: { bullet: true, color: COLORS.HEADER } },
    { text: 'Phase 7: AI Self-Healing (Automatic script updates when UI changes)', options: { bullet: true } },
    { text: 'Phase 8: CI/CD "No-Pulse" Integration (Automated drift detection)', options: { bullet: true } },
    { text: 'Phase 9: Distributed Cloud Execution (Running 1000s of tests in parallel)', options: { bullet: true } }
], { x: 1, y: 1.8, fontSize: 22, color: COLORS.TEXT });

// --- SLIDE 12: CONCLUSION ---
slide = newSlide();
slide.addText('T.A.R.S', { x: 0, y: 2.2, w: '100%', fontSize: 54, bold: true, color: COLORS.HEADER, align: pres.AlignH.center });
slide.addText('The Intelligence Layer for Modern QA', { x: 0, y: 3.2, w: '100%', fontSize: 24, color: COLORS.ACCENT, align: pres.AlignH.center });
slide.addText('Transforming Software Reliability with AI.', { x: 0, y: 3.8, w: '100%', fontSize: 16, color: COLORS.TEXT, align: pres.AlignH.center });

// Save the Presentation
pres.writeFile({ fileName: OUTPUT_FILE })
    .then(fileName => console.log('Elaborated presentation saved at: ' + fileName))
    .catch(err => {
        console.error('Error saving presentation:', err);
        process.exit(1);
    });
