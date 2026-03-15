import { useState, useRef, useEffect, useCallback } from 'react'
import { Settings, Send, Bot, FileJson, CheckCircle, Loader2, ArrowLeft, Cpu, Globe, Key, Database, LayoutDashboard, Sparkles, Image as ImageIcon, X, Download, Play, Square, Code, RefreshCw, Crosshair, Upload, Search, ExternalLink, AlertCircle, Table, FileText, Bug, Activity, CheckSquare, Camera, Briefcase, PlayCircle, ClipboardList } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

type View = 'dashboard' | 'settings' | 'recorder' | 'automatedTesting';
type Tab = 'input' | 'output';

// Types for Playwright integration
interface DiscoveredLocator {
  tag: string;
  selectorType: string;
  locator: string;
  text: string;
  url: string;
}

interface RecordedAction {
  type: string;
  target?: string;
  value?: string;
  timestamp: number;
  url: string;
}

interface JiraStory {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  project: string;
  projectKey: string;
  assignee: string;
}

interface ParsedTestCase {
  n: string;
  reqId: string;
  testObjective: string;
  testSteps: string;
  expectedResult: string;
  actualResult: string;
  passFail: string;
  relatedDefects: string;
}

type AutoTestPhase = 'input' | 'running' | 'results';

interface AutoTestStep {
  id: number;
  action: string;
  target: string;
  value?: string;
  description: string;
}

interface AutoTestResult {
  stepId: number;
  description: string;
  action: string;
  target: string;
  value?: string;
  status: 'pass' | 'fail' | 'skipped';
  error?: string;
  screenshotBase64?: string;
}

interface AutoDefect {
  id: number;
  stepId: number;
  description: string;
  error: string;
  screenshotBase64: string;
}

interface AutoTestSummary {
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  defectsFound: number;
  executedAt: string;
}

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [activeTab, setActiveTab] = useState<Tab>('input');

  // Settings State
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('gemma3:1b');
  const [apiUrl, setApiUrl] = useState('http://localhost:11434');
  const [apiKey, setApiKey] = useState('');

  // Generation State
  const [jiraRequirement, setJiraRequirement] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [generatedTests, setGeneratedTests] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [parsedTestCases, setParsedTestCases] = useState<ParsedTestCase[]>([]);
  const [outputViewMode, setOutputViewMode] = useState<'table' | 'markdown'>('table');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playwright Recorder State
  const [targetUrl, setTargetUrl] = useState('https://demo.playwright.dev/todomvc/');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [locators, setLocators] = useState<DiscoveredLocator[]>([]);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [recorderError, setRecorderError] = useState('');
  const [testName, setTestName] = useState('Recorded Navigation Test');
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [generatedScenarios, setGeneratedScenarios] = useState<{ n: string; reqId: string; objective: string; steps: string; expected: string }[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Jira Integration State
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraStories, setJiraStories] = useState<JiraStory[]>([]);
  const [jiraProjects, setJiraProjects] = useState<{ key: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStoryKey, setSelectedStoryKey] = useState('');
  const [manualIssueKey, setManualIssueKey] = useState('');
  const [jiraSearchQuery, setJiraSearchQuery] = useState('');
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [isUploadingToJira, setIsUploadingToJira] = useState(false);
  const [jiraUploadStatus, setJiraUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Automated Testing State
  const [sfUserStory, setSfUserStory] = useState('');
  const [autoTestPhase, setAutoTestPhase] = useState<AutoTestPhase>('input');
  const [autoTestSteps, setAutoTestSteps] = useState<AutoTestStep[]>([]);
  const [autoTestResults, setAutoTestResults] = useState<AutoTestResult[]>([]);
  const [autoTestDefects, setAutoTestDefects] = useState<AutoDefect[]>([]);
  const [autoTestSummary, setAutoTestSummary] = useState<AutoTestSummary | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoRunError, setAutoRunError] = useState('');
  const [defectToReport, setDefectToReport] = useState<AutoDefect | null>(null);
  const [defectJiraProject, setDefectJiraProject] = useState('');
  const [defectParentStory, setDefectParentStory] = useState('');
  const [isReportingDefect, setIsReportingDefect] = useState(false);

  const handleRunAutomatedTests = async () => {
    if (!sfUserStory.trim()) return;
    setIsAutoRunning(true);
    setAutoRunError('');
    setAutoTestPhase('running');
    setAutoTestSteps([]);
    setAutoTestResults([]);
    setAutoTestDefects([]);
    setAutoTestSummary(null);

    try {
      const response = await axios.post('http://localhost:3000/api/sf-autotest/run', {
        userStory: sfUserStory,
        provider,
        model,
        apiUrl,
        apiKey
      });

      setAutoTestSteps(response.data.testSteps || []);
      setAutoTestResults(response.data.results || []);
      setAutoTestDefects(response.data.defects || []);
      setAutoTestSummary(response.data.summary || null);
      setAutoTestPhase('results');
    } catch (err: any) {
      console.error(err);
      setAutoRunError(err.response?.data?.error || err.message || 'An error occurred during test execution.');
      setAutoTestPhase('input');
    } finally {
      setIsAutoRunning(false);
    }
  };

  const handleReportDefectToJira = async () => {
    if (!defectToReport || !defectJiraProject) return;
    setIsReportingDefect(true);
    try {
      await axios.post('http://localhost:3000/api/jira/create-defect', {
        projectKey: defectJiraProject,
        summary: `[AutoTest] ${defectToReport.description}`,
        description: `Defect found during Automated Test Execution.\\n\\n**Step:** ${defectToReport.stepId}\\n**Error:** ${defectToReport.error}`,
        linkedStoryKey: defectParentStory,
        screenshotBase64: defectToReport.screenshotBase64
      });
      // Clear reporting state
      setDefectToReport(null);
      setDefectJiraProject('');
      setDefectParentStory('');
    } catch (err: any) {
      console.error('Failed to report defect', err);
      alert('Failed to report defect to Jira: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsReportingDefect(false);
    }
  };

  const parseScenarios = (content: string) => {
    const scenarios: any[] = [];
    const items = content.split(/N:\s*(?=\d+)/g);

    items.forEach(item => {
      if (!item.trim()) return;
      const nMatch = item.match(/^(\d+)/);
      const reqIdMatch = item.match(/Req ID:\s*([^\n]*)/);
      const objMatch = item.match(/Test Objective:\s*([^\n]*)/);
      const stepsMatch = item.match(/Test Steps:\s*([\s\S]*?)(?=Expected Result:|$)/);
      const expectedMatch = item.match(/Expected Result:\s*([\s\S]*?)(?=$)/);

      if (nMatch || reqIdMatch || objMatch) {
        scenarios.push({
          n: (nMatch ? nMatch[1] : '').trim(),
          reqId: (reqIdMatch ? reqIdMatch[1] : '').trim(),
          objective: (objMatch ? objMatch[1] : '').trim(),
          steps: (stepsMatch ? stepsMatch[1] : '').trim(),
          expected: (expectedMatch ? expectedMatch[1] : '').trim(),
        });
      }
    });
    return scenarios;
  };

  const handleGenerateScenarios = async () => {
    if (locators.length === 0 && actions.length === 0) return;
    setIsGeneratingScenarios(true);
    setRecorderError('');
    try {
      const res = await axios.post('http://localhost:3000/api/playwright/generate-scenarios', {
        provider,
        model,
        apiUrl,
        apiKey
      });
      const parsed = parseScenarios(res.data.scenarios);
      setGeneratedScenarios(parsed);
    } catch (err: any) {
      setRecorderError(err.response?.data?.error || err.message);
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  // ---- Jira Integration Handlers ----
  const handleOpenJiraModal = async () => {
    setIsJiraModalOpen(true);
    setJiraUploadStatus(null);
    setSelectedStoryKey('');
    setManualIssueKey('');
    setJiraSearchQuery('');
    // Fetch projects
    try {
      const projRes = await axios.get('http://localhost:3000/api/jira/projects');
      setJiraProjects(projRes.data.projects);
    } catch { /* ignore */ }
    // Fetch stories
    await fetchJiraStories();
  };

  const fetchJiraStories = async (project?: string) => {
    setIsLoadingStories(true);
    try {
      const params = new URLSearchParams();
      if (project) params.set('project', project);
      const res = await axios.get(`http://localhost:3000/api/jira/stories?${params.toString()}`);
      setJiraStories(res.data.stories);
    } catch (err: any) {
      setJiraUploadStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setIsLoadingStories(false);
    }
  };

  const handleJiraUpload = async () => {
    const issueKey = manualIssueKey.trim() || selectedStoryKey;
    if (!issueKey) {
      setJiraUploadStatus({ type: 'error', message: 'Please select a story or enter an Issue Key.' });
      return;
    }
    setIsUploadingToJira(true);
    setJiraUploadStatus(null);
    try {
      const res = await axios.post('http://localhost:3000/api/jira/upload', {
        issueKey,
        testCasesContent: generatedTests
      });
      setJiraUploadStatus({ type: 'success', message: res.data.message });
    } catch (err: any) {
      setJiraUploadStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setIsUploadingToJira(false);
    }
  };

  const filteredJiraStories = jiraStories.filter(s =>
    !jiraSearchQuery || s.key.toLowerCase().includes(jiraSearchQuery.toLowerCase()) || s.summary.toLowerCase().includes(jiraSearchQuery.toLowerCase())
  );


  // Poll for locators while recording
  const pollLocators = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/playwright/locators');
      setLocators(res.data.locators);
      setActions(res.data.actions);
    } catch { /* session may have ended */ }
  }, []);

  useEffect(() => {
    if (isSessionActive) {
      pollIntervalRef.current = setInterval(pollLocators, 3000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isSessionActive, pollLocators]);

  const handleLaunchBrowser = async () => {
    if (!targetUrl.trim()) return;
    setIsLaunching(true);
    setRecorderError('');
    setGeneratedTestCode('');
    setGeneratedScenarios([]);
    setLocators([]);
    setActions([]);
    try {
      const res = await axios.post('http://localhost:3000/api/playwright/launch', { url: targetUrl });
      setIsSessionActive(true);
      setLocators([]);
      console.log('Browser launched:', res.data);
    } catch (err: any) {
      setRecorderError(err.response?.data?.error || err.message || 'Failed to launch browser');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStopRecording = async () => {
    setIsStopping(true);
    try {
      const res = await axios.post('http://localhost:3000/api/playwright/stop');
      setLocators(res.data.locators);
      setActions(res.data.actions);
      setIsSessionActive(false);
    } catch (err: any) {
      setRecorderError(err.response?.data?.error || err.message);
    } finally {
      setIsStopping(false);
    }
  };

  const handleGenerateTest = async () => {
    setIsGeneratingTest(true);
    setRecorderError('');
    try {
      const res = await axios.post('http://localhost:3000/api/playwright/generate-test', { testName });
      setGeneratedTestCode(res.data.testCode);
    } catch (err: any) {
      setRecorderError(err.response?.data?.error || err.message);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const downloadTestFile = () => {
    if (!generatedTestCode) return;
    const blob = new Blob([generatedTestCode], { type: 'text/typescript' });
    const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.spec.ts`;
    saveAs(blob, filename);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse raw LLM text into structured test case rows
  const parseTestsToTable = (raw: string): ParsedTestCase[] => {
    const cases: ParsedTestCase[] = [];
    const lines = raw.split('\n');
    let current: Partial<ParsedTestCase> = {};
    let lastKey = '';

    lines.forEach(line => {
      const clean = line.replace(/^[*\-#]\s+/, '').trim();
      if (clean.startsWith('N:')) {
        if (current.n !== undefined && (current.reqId || current.testObjective)) cases.push(current as ParsedTestCase);
        current = { n: clean.replace('N:', '').trim(), reqId: '', testObjective: '', testSteps: '', expectedResult: '', actualResult: '', passFail: '', relatedDefects: '' };
        lastKey = 'n';
      } else if (clean.startsWith('Req ID:')) { current.reqId = clean.replace('Req ID:', '').trim(); lastKey = 'reqId'; }
      else if (clean.startsWith('Test Objective:')) { current.testObjective = clean.replace('Test Objective:', '').trim(); lastKey = 'testObjective'; }
      else if (clean.startsWith('Test Steps:')) { current.testSteps = clean.replace('Test Steps:', '').trim(); lastKey = 'testSteps'; }
      else if (clean.startsWith('Expected Result:')) { current.expectedResult = clean.replace('Expected Result:', '').trim(); lastKey = 'expectedResult'; }
      else if (clean.startsWith('Actual Result:')) { current.actualResult = clean.replace('Actual Result:', '').trim(); lastKey = 'actualResult'; }
      else if (clean.startsWith('Pass/Fail:')) { current.passFail = clean.replace('Pass/Fail:', '').trim(); lastKey = 'passFail'; }
      else if (clean.startsWith('Related Defects:')) { current.relatedDefects = clean.replace('Related Defects:', '').trim(); lastKey = 'relatedDefects'; }
      else if (clean && lastKey && current[lastKey as keyof ParsedTestCase] !== undefined) {
        (current as any)[lastKey] += '\n' + clean;
      }
    });
    if (current.n !== undefined && (current.reqId || current.testObjective)) cases.push(current as ParsedTestCase);
    return cases;
  };

  // Rebuild generatedTests string from parsed table data
  const rebuildGeneratedTests = (cases: ParsedTestCase[]): string => {
    return cases.map(tc => {
      return [
        `- N: ${tc.n}`,
        `- Req ID: ${tc.reqId}`,
        `- Test Objective: ${tc.testObjective}`,
        `- Test Steps: ${tc.testSteps}`,
        `- Expected Result: ${tc.expectedResult}`,
        `- Actual Result: ${tc.actualResult}`,
        `- Pass/Fail: ${tc.passFail}`,
        `- Related Defects: ${tc.relatedDefects}`,
      ].join('\n');
    }).join('\n\n');
  };

  // Update a single cell in the table
  const handleCellEdit = (rowIndex: number, field: keyof ParsedTestCase, value: string) => {
    const updated = [...parsedTestCases];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setParsedTestCases(updated);
    setGeneratedTests(rebuildGeneratedTests(updated));
  };

  const handleGenerate = async () => {
    if (!jiraRequirement.trim() && !imageFile) return;

    setIsGenerating(true);
    setError('');
    setActiveTab('output');

    try {
      const formData = new FormData();
      formData.append('jiraRequirement', jiraRequirement);
      formData.append('provider', provider);
      formData.append('model', model);
      formData.append('apiUrl', apiUrl);
      if (apiKey) formData.append('apiKey', apiKey);
      if (imageFile) formData.append('image', imageFile);

      const response = await axios.post('http://localhost:3000/api/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      const tests = response.data.tests;
      setGeneratedTests(tests);
      setParsedTestCases(parseTestsToTable(tests));
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'An error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToExcel = () => {
    if (!generatedTests) return;

    // Very basic parsing for Excel tabular export based on standard test case format
    const lines = generatedTests.split('\n');
    const tests: any[] = [];
    let currentTest: any = {};

    lines.forEach(line => {
      const cleanLine = line.replace(/^[*\-]\s+/, '').trim();
      if (cleanLine.startsWith('N:')) {
        if (Object.keys(currentTest).length > 0) tests.push(currentTest);
        currentTest = { 'N': cleanLine.replace('N:', '').trim() };
      } else if (cleanLine.startsWith('Req ID:')) {
        currentTest['Req ID'] = cleanLine.replace('Req ID:', '').trim();
      } else if (cleanLine.startsWith('Test Objective:')) {
        currentTest['Test Objective'] = cleanLine.replace('Test Objective:', '').trim();
      } else if (cleanLine.startsWith('Test Steps:')) {
        currentTest['Test Steps'] = cleanLine.replace('Test Steps:', '').trim();
      } else if (cleanLine.startsWith('Expected Result:')) {
        currentTest['Expected Result'] = cleanLine.replace('Expected Result:', '').trim();
      } else if (cleanLine.startsWith('Actual Result:')) {
        currentTest['Actual Result'] = cleanLine.replace('Actual Result:', '').trim();
      } else if (cleanLine.startsWith('Pass/Fail:')) {
        currentTest['Pass/Fail'] = cleanLine.replace('Pass/Fail:', '').trim();
      } else if (cleanLine.startsWith('Related Defects:')) {
        currentTest['Related Defects'] = cleanLine.replace('Related Defects:', '').trim();
      } else if (cleanLine && Object.keys(currentTest).length > 0) {
        // Append continued lines to the last known key if complex
        const lastKey = Object.keys(currentTest).pop();
        if (lastKey) currentTest[lastKey] += '\n' + cleanLine;
      }
    });
    if (Object.keys(currentTest).length > 0) tests.push(currentTest);

    // If parsing fails for unstructured data, just export the raw text as one cell
    const exportData = tests.length > 0 ? tests : [{ 'Generated Content': generatedTests }];

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");
    XLSX.writeFile(workbook, "Generated_Test_Cases.xlsx");
  };

  const exportToWord = async () => {
    if (!generatedTests) return;

    const paragraphs = generatedTests.split('\n').map(line => {
      if (line.startsWith('# ')) {
        return new Paragraph({ text: line.replace('# ', ''), heading: HeadingLevel.HEADING_1 });
      } else if (line.startsWith('## ')) {
        return new Paragraph({ text: line.replace('## ', ''), heading: HeadingLevel.HEADING_2 });
      } else if (line.startsWith('### ')) {
        return new Paragraph({ text: line.replace('### ', ''), heading: HeadingLevel.HEADING_3 });
      } else {
        return new Paragraph({
          children: [new TextRun(line)]
        });
      }
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "Generated_Test_Cases.docx");
  };

  return (
    <div className="min-h-screen flex text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200"
      style={{ background: 'radial-gradient(circle at 10% 20%, rgb(30, 20, 50) 0%, rgb(10, 15, 30) 90%)' }}>

      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col justify-between transition-all duration-300">
        <div>
          <div className="h-20 flex items-center justify-center lg:justify-start lg:pl-6 border-b border-white/10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2 lg:p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
              <Bot size={24} className="text-white" />
            </div>
            <div className="hidden lg:block ml-4">
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-indigo-200 tracking-wide leading-tight">
                T.A.R.S
              </h1>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter mt-1.5 leading-tight">
                Test Automation & Reporting Suite
              </p>
            </div>
          </div>

          <nav className="p-4 space-y-2 mt-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 ${activeView === 'dashboard'
                ? 'bg-indigo-500/15 text-indigo-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <LayoutDashboard size={20} />
              <span className="hidden lg:block font-medium">Test Builder</span>
            </button>
            <button
              onClick={() => { setActiveView('recorder'); }}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 ${activeView === 'recorder'
                ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-emerald-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <Play size={20} />
              <span className="hidden lg:block font-medium">Recorder</span>
            </button>
            <button
              onClick={() => setActiveView('automatedTesting')}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 ${activeView === 'automatedTesting'
                ? 'bg-amber-500/15 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-amber-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <Activity size={20} />
              <span className="hidden lg:block font-medium">Auto Test</span>
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 ${activeView === 'settings'
                ? 'bg-purple-500/15 text-purple-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-purple-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <Settings size={20} />
              <span className="hidden lg:block font-medium">Settings</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 hidden lg:block">
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-300">Active Provider</p>
            </div>
            <p className="text-sm font-medium text-slate-200 capitalize">{provider}</p>
            <p className="text-xs text-slate-400 mt-1 truncate">{model}</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeView === 'dashboard' ? (
          <div className="h-full flex flex-col p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  Manual Test case Generator
                </h2>
                <p className="text-slate-400 mt-2">Generate comprehensive tests from your Jira specs or screenshots.</p>
              </div>
            </header>

            <div className="flex items-center gap-2 mb-6 bg-black/20 p-1.5 rounded-xl w-max border border-white/5 backdrop-blur-md">
              <button
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'input' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('input')}
              >
                1. Input Specifications
              </button>
              <button
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'output' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('output')}
              >
                2. Generated Tests
              </button>
            </div>

            {/* Input Tab */}
            {activeTab === 'input' && (
              <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <div className="flex-1 p-8 overflow-y-auto w-full max-w-4xl mx-auto">

                  <div className="flex gap-4 mb-8">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-md">
                      <p className="text-slate-300 leading-relaxed text-sm lg:text-base mb-3">
                        Ready for input. Paste your Jira user story or acceptance criteria below. You can also upload a reference screenshot (App Design or ER Diagram).
                      </p>
                      <p className="text-indigo-300/80 text-xs italic">
                        Ensure you select a Vision model in settings (e.g., llava, gpt-4o, claude-3) if uploading images.
                      </p>
                    </div>
                  </div>

                  {/* Image Preview Area */}
                  {imagePreview && (
                    <div className="ml-14 mb-6 relative w-max rounded-xl overflow-hidden border border-indigo-500/30 shadow-lg shadow-indigo-500/10 group">
                      <img src={imagePreview} alt="Uploaded Spec" className="max-h-48 object-contain bg-black/40" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          onClick={removeImage}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transform hover:scale-110 active:scale-95 transition-all"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                <div className="p-6 bg-black/40 border-t border-white/5 backdrop-blur-md">
                  <div className="max-w-4xl mx-auto flex gap-4">
                    {/* File Upload Button */}
                    <div className="flex items-center justify-center self-end mb-1 relative shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 rounded-xl transition-all duration-300 border border-white/10 hover:border-indigo-500/50 group"
                        title="Upload Screenshot"
                      >
                        <ImageIcon size={24} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                    {/* Text Input & Submit */}
                    <div className="relative group w-full">
                      <textarea
                        value={jiraRequirement}
                        onChange={(e) => setJiraRequirement(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/10 group-focus-within:border-indigo-500/50 rounded-xl py-4 px-5 pr-16 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none text-slate-200 placeholder-slate-600 shadow-inner transition-all duration-300"
                        placeholder="e.g. As a user, I want to securely log into the portal so I can access my dashboard..."
                        rows={3}
                      />
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!jiraRequirement.trim() && !imageFile)}
                        className="absolute right-4 bottom-4 p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:shadow-none flex items-center justify-center transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Output Tab */}
            {activeTab === 'output' && (
              <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent"></div>

                <div className="p-4 px-6 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-500/20 p-2 rounded-lg">
                      <FileJson size={18} className="text-indigo-400" />
                    </div>
                    <h2 className="font-semibold text-slate-200 tracking-wide">Test Results</h2>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!generatedTests}
                      onClick={() => navigator.clipboard.writeText(generatedTests)}
                      className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-slate-200 font-medium"
                      title="Copy Markdown"
                    >
                      <CheckCircle size={16} className={generatedTests ? "text-green-400" : "text-slate-500"} />
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={exportToExcel}
                      className="text-sm bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-indigo-300 font-medium"
                    >
                      <Download size={16} /> Excel
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={exportToWord}
                      className="text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-purple-300 font-medium"
                    >
                      <Download size={16} /> Word
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={handleOpenJiraModal}
                      className="text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 text-blue-300 font-medium"
                    >
                      <Upload size={16} /> Upload to Jira
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                  {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-400 gap-6 bg-slate-900/50 backdrop-blur-sm">
                      <div className="relative">
                        <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                        <Loader2 size={48} className="animate-spin relative z-10" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-medium text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                          Synthesizing Tests...
                        </p>
                        <p className="text-sm text-indigo-400/60 uppercase tracking-widest">via {provider} — {model}</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="h-full flex items-center justify-center animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-red-950/40 border border-red-500/20 p-8 rounded-2xl max-w-lg w-full backdrop-blur-md shadow-2xl shadow-red-900/20">
                        <div className="bg-red-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                          <Database size={24} className="text-red-400" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-red-200">Generation Failed</h3>
                        <p className="text-red-400/80 leading-relaxed">{error}</p>
                        <button
                          onClick={() => setActiveTab('input')}
                          className="mt-6 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-300 text-sm font-medium transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : generatedTests ? (
                    <div className="animate-in fade-in duration-500">
                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="bg-black/20 p-1 rounded-xl border border-white/5 flex gap-1">
                          <button
                            onClick={() => setOutputViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${outputViewMode === 'table' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            <Table size={14} /> Table
                          </button>
                          <button
                            onClick={() => setOutputViewMode('markdown')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${outputViewMode === 'markdown' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            <FileText size={14} /> Markdown
                          </button>
                        </div>
                        {outputViewMode === 'table' && parsedTestCases.length > 0 && (
                          <span className="text-xs text-slate-500 ml-2">Click any cell to edit • {parsedTestCases.length} test case{parsedTestCases.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>

                      {outputViewMode === 'table' && parsedTestCases.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl">
                          <table className="w-full text-sm">
                            <thead className="bg-black/40 text-slate-400 uppercase text-xs tracking-wider sticky top-0 z-10">
                              <tr>
                                <th className="py-3 px-3 text-left border-r border-white/5 w-12">#</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 w-24">Req ID</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 min-w-[200px]">Test Objective</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 min-w-[250px]">Test Steps</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 min-w-[200px]">Expected Result</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 min-w-[140px]">Actual Result</th>
                                <th className="py-3 px-3 text-left border-r border-white/5 w-24">Pass/Fail</th>
                                <th className="py-3 px-3 text-left w-28">Related Defects</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {parsedTestCases.map((tc, i) => (
                                <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                  <td className="py-2 px-3 border-r border-white/5 text-slate-500 font-mono text-xs">
                                    <input
                                      value={tc.n}
                                      onChange={(e) => handleCellEdit(i, 'n', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-slate-400 font-mono text-xs p-0"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <input
                                      value={tc.reqId}
                                      onChange={(e) => handleCellEdit(i, 'reqId', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-indigo-300 font-mono text-xs p-0 focus:bg-white/5 focus:rounded focus:px-1 transition-all"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <textarea
                                      value={tc.testObjective}
                                      onChange={(e) => handleCellEdit(i, 'testObjective', e.target.value)}
                                      rows={2}
                                      className="w-full bg-transparent border-0 outline-none text-slate-200 text-xs resize-none p-0 focus:bg-white/5 focus:rounded focus:p-1 transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <textarea
                                      value={tc.testSteps}
                                      onChange={(e) => handleCellEdit(i, 'testSteps', e.target.value)}
                                      rows={3}
                                      className="w-full bg-transparent border-0 outline-none text-slate-300 text-xs resize-none p-0 focus:bg-white/5 focus:rounded focus:p-1 transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <textarea
                                      value={tc.expectedResult}
                                      onChange={(e) => handleCellEdit(i, 'expectedResult', e.target.value)}
                                      rows={2}
                                      className="w-full bg-transparent border-0 outline-none text-emerald-300/90 text-xs resize-none p-0 focus:bg-white/5 focus:rounded focus:p-1 transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <textarea
                                      value={tc.actualResult}
                                      onChange={(e) => handleCellEdit(i, 'actualResult', e.target.value)}
                                      rows={1}
                                      className="w-full bg-transparent border-0 outline-none text-amber-300/80 text-xs resize-none p-0 focus:bg-white/5 focus:rounded focus:p-1 transition-all"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border-r border-white/5">
                                    <select
                                      value={tc.passFail || 'Pending'}
                                      onChange={(e) => handleCellEdit(i, 'passFail', e.target.value)}
                                      className={`w-full bg-transparent border-0 outline-none text-xs cursor-pointer p-0 appearance-none ${
                                        tc.passFail === 'Pass' ? 'text-emerald-400' :
                                        tc.passFail === 'Fail' ? 'text-red-400' :
                                        'text-slate-500'
                                      }`}
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="Pass">Pass</option>
                                      <option value="Fail">Fail</option>
                                    </select>
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      value={tc.relatedDefects}
                                      onChange={(e) => handleCellEdit(i, 'relatedDefects', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-slate-400 text-xs p-0 focus:bg-white/5 focus:rounded focus:px-1 transition-all"
                                      placeholder="—"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="max-w-4xl mx-auto prose prose-invert prose-indigo max-w-none
                            prose-headings:text-slate-100 prose-headings:font-semibold 
                            prose-a:text-indigo-400 hover:prose-a:text-indigo-300
                            prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:shadow-xl
                            prose-strong:text-indigo-200 prose-th:text-slate-300 prose-th:bg-white/5 prose-td:border-white/5">
                          <ReactMarkdown>{generatedTests}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-60">
                      <div className="bg-white/5 p-6 rounded-full border border-white/10 shadow-inner">
                        <FileJson size={48} className="text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-400">Awaiting input specifications.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'settings' ? (
          /* Settings View */
          <div className="h-full flex flex-col p-6 lg:p-10 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <button
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors mb-6 group w-max"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </button>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-indigo-400">
                Global Configuration
              </h2>
              <p className="text-slate-400 mt-2">Manage your connection to Local or Cloud LLMs.</p>
            </header>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-xl">

                <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2 pb-4 border-b border-white/5">
                  <Cpu size={20} className="text-purple-400" /> Provider Settings
                </h3>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Provider Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Platform
                      </label>
                      <div className="relative group">
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-purple-500 rounded-xl py-3 px-4 text-slate-200 appearance-none outline-none transition-all cursor-pointer shadow-inner"
                        >
                          <option value="ollama">Ollama (Local)</option>
                          <option value="lmstudio">LM Studio (Local)</option>
                          <option value="openai">OpenAI (Cloud)</option>
                          <option value="claude">Anthropic Claude (Cloud)</option>
                          <option value="gemini">Google Gemini (Cloud)</option>
                          <option value="grok">xAI Grok (Cloud)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300">
                          <Globe size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Model Version
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl py-3 px-4 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600"
                        placeholder="e.g. gemma3:1b, gpt-4o, llava"
                      />
                    </div>
                  </div>

                  {/* API Base URL */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Network Endpoint URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl py-3 px-4 pl-12 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 font-mono text-sm"
                        placeholder="e.g. http://localhost:11434"
                      />
                      <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Authentication Token
                      </label>
                      <span className="text-xs text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Required for Cloud</span>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 px-4 pl-12 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 font-mono text-sm tracking-widest"
                        placeholder="sk-..........................."
                      />
                      <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 text-white font-medium rounded-xl transition-all transform active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'recorder' ? (
          /* Recorder View */
          <div className="h-full flex flex-col p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar">
            <header className="mb-8">
              <button
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors mb-6 group w-max"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </button>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-teal-400">
                Playwright Recorder
              </h2>
              <p className="text-slate-400 mt-2">Launch a browser, discover locators, and generate Playwright test scripts.</p>
            </header>

            {/* Launch Panel */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl mb-6">
              <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2 pb-3 border-b border-white/5">
                <Crosshair size={20} className="text-emerald-400" /> Launch Testing Application
              </h3>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isSessionActive}
                    className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 px-4 pl-12 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 font-mono text-sm disabled:opacity-50"
                    placeholder="https://your-app-url.com"
                  />
                  <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
                {!isSessionActive ? (
                  <button
                    onClick={handleLaunchBrowser}
                    disabled={isLaunching || !targetUrl.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 shadow-lg shadow-emerald-500/25 disabled:shadow-none text-white font-medium rounded-xl transition-all transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isLaunching ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                    Launch Browser
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    disabled={isStopping}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/25 text-white font-medium rounded-xl transition-all transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isStopping ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
                    Stop Recording
                  </button>
                )}
              </div>

              {/* Live Status */}
              {isSessionActive && (
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
                    <span className="text-emerald-300 font-medium">Recording Active</span>
                  </div>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400"><span className="text-emerald-300 font-semibold">{locators.length}</span> locators found</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400"><span className="text-emerald-300 font-semibold">{actions.length}</span> actions recorded</span>
                  <button onClick={pollLocators} className="ml-auto text-slate-400 hover:text-emerald-300 transition-colors" title="Refresh">
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}

              {recorderError && (
                <div className="mt-4 bg-red-950/40 border border-red-500/20 p-4 rounded-xl">
                  <p className="text-red-400 text-sm">{recorderError}</p>
                </div>
              )}
            </div>

            {/* Locators Table */}
            {locators.length > 0 && (
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl mb-6 overflow-hidden">
                <div className="p-4 px-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Crosshair size={16} className="text-emerald-400" />
                    Discovered Locators ({locators.length})
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30 text-slate-400 uppercase tracking-wider text-xs sticky top-0">
                      <tr>
                        <th className="py-3 px-4 text-left">#</th>
                        <th className="py-3 px-4 text-left">Tag</th>
                        <th className="py-3 px-4 text-left">Strategy</th>
                        <th className="py-3 px-4 text-left">Locator</th>
                        <th className="py-3 px-4 text-left">Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locators.map((loc, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-4 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-2.5 px-4">
                            <span className="bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">{loc.tag}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${loc.selectorType === 'data-testid' ? 'bg-emerald-500/15 text-emerald-300' :
                              loc.selectorType === 'role' ? 'bg-purple-500/15 text-purple-300' :
                                loc.selectorType === 'id' ? 'bg-amber-500/15 text-amber-300' :
                                  'bg-slate-500/15 text-slate-300'
                              }`}>{loc.selectorType}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-200 text-xs max-w-md truncate">{loc.locator}</td>
                          <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">{loc.text || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions Log */}
            {actions.length > 0 && (
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl mb-6 overflow-hidden">
                <div className="p-4 px-6 border-b border-white/5 bg-black/20">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Code size={16} className="text-teal-400" />
                    Recorded Actions ({actions.length})
                  </h3>
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-black/20 px-4 py-2.5 rounded-lg">
                      <span className="text-xs text-slate-500 font-mono w-16">{new Date(action.timestamp).toLocaleTimeString()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${action.type === 'navigate' ? 'bg-blue-500/15 text-blue-300' :
                        action.type === 'page-load' ? 'bg-emerald-500/15 text-emerald-300' :
                          'bg-purple-500/15 text-purple-300'
                        }`}>{action.type}</span>
                      <span className="text-slate-300 font-mono text-xs truncate">{action.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Test Panel */}
            {!isSessionActive && locators.length > 0 && (
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl mb-6">
                <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2 pb-3 border-b border-white/5">
                  <Code size={20} className="text-teal-400" /> Generate Playwright Test
                </h3>
                <div className="flex gap-4 mb-4">
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="flex-1 bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl py-3 px-4 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 text-sm"
                    placeholder="Test name..."
                  />
                  <button
                    onClick={handleGenerateTest}
                    disabled={isGeneratingTest}
                    className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-lg shadow-teal-500/25 text-white font-medium rounded-xl transition-all transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingTest ? <Loader2 size={18} className="animate-spin" /> : <Code size={18} />}
                    Generate Test
                  </button>
                </div>

                {generatedTestCode && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Generated .spec.ts</span>
                      <button
                        onClick={downloadTestFile}
                        className="text-sm bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-emerald-300 font-medium"
                      >
                        <Download size={16} /> Download
                      </button>
                    </div>
                    <pre className="bg-black/40 border border-white/10 rounded-xl p-5 overflow-x-auto text-sm font-mono text-emerald-200 max-h-96 overflow-y-auto custom-scrollbar leading-relaxed">
                      <code>{generatedTestCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Test Cases Scenarios UI */}
            {(!isSessionActive && (locators.length > 0 || actions.length > 0)) && (
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                  <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                    <Sparkles size={20} className="text-indigo-400" /> Test Cases (Positive & Negative)
                  </h3>
                  <button
                    onClick={handleGenerateScenarios}
                    disabled={isGeneratingScenarios}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    {isGeneratingScenarios ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {generatedScenarios.length > 0 ? 'Regenerate Scenarios' : 'Generate Test Cases'}
                  </button>
                </div>

                {generatedScenarios.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-sm">
                      <thead className="bg-black/40 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                          <th className="py-3 px-4 text-left border-r border-white/5">Req ID</th>
                          <th className="py-3 px-4 text-left border-r border-white/5">Objective</th>
                          <th className="py-3 px-4 text-left border-r border-white/5">Test Steps (with Locators)</th>
                          <th className="py-3 px-4 text-left">Expected Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {generatedScenarios.map((sc, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 font-mono text-indigo-300 border-r border-white/5">{sc.reqId}</td>
                            <td className="py-4 px-4 text-slate-200 border-r border-white/5 font-medium">{sc.objective}</td>
                            <td className="py-4 px-4 text-slate-400 border-r border-white/5 whitespace-pre-wrap leading-relaxed">{sc.steps}</td>
                            <td className="py-4 px-4 text-emerald-400/90 leading-relaxed font-medium">{sc.expected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-black/10">
                    <div className="p-4 bg-indigo-500/10 rounded-full mb-4">
                      <FileJson size={32} className="text-indigo-400 opacity-50" />
                    </div>
                    <p className="text-slate-500 text-center max-w-sm">
                      {isGeneratingScenarios ? 'Analyzing recorded session...' : 'Click "Generate Test Cases" to have the LLM analyze your session and create positive & negative test scenarios.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeView === 'automatedTesting' ? (
          /* Automated Testing View */
          <div className="flex-1 overflow-hidden relative flex flex-col p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
                  <Activity size={32} className="text-amber-500" /> Automated Salesforce Testing
                </h2>
                <p className="text-slate-400 mt-2">Generate Playwright tests from user stories and run them live in Salesforce.</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              
              {autoTestPhase === 'input' && (
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
                  <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <Briefcase size={20} className="text-amber-500" /> What do you want to test?
                  </h3>
                  <textarea
                    value={sfUserStory}
                    onChange={(e) => setSfUserStory(e.target.value)}
                    placeholder="Enter a Salesforce User Story or functional requirement.&#10;For example: 'As a Sales Rep, I want to navigate to the Accounts tab, click New, fill in the Account Name as Target Corp, and click Save.'"
                    className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-4 px-5 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 min-h-[160px] resize-y mb-6"
                  />
                  
                  {autoRunError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-200">Execution Failed</p>
                        <p className="text-xs text-red-400/80 mt-1">{autoRunError}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleRunAutomatedTests}
                      disabled={isAutoRunning || !sfUserStory.trim()}
                      className="px-8 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25 text-white font-medium rounded-xl transition-all transform active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlayCircle size={20} />
                      Generate & Run Tests
                    </button>
                  </div>
                </div>
              )}

              {autoTestPhase === 'running' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 min-h-[400px]">
                  <div className="relative mb-8">
                    <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>
                    <Loader2 size={64} className="text-amber-400 animate-spin relative z-10" />
                  </div>
                  <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-orange-300 mb-3">
                    Executing Automated Tests
                  </h3>
                  <p className="text-slate-400 text-center max-w-md">
                    Please hold on. The LLM is generating test steps, logging into Salesforce, and running playbooks live in a background Chromium instance...
                  </p>
                  
                  <div className="mt-12 w-full max-w-sm flex flex-col gap-4">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 w-1/2 animate-pulse rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                      <span>Working...</span>
                      <span>~30-60s</span>
                    </div>
                  </div>
                </div>
              )}

              {autoTestPhase === 'results' && autoTestSummary && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                      <span className="text-slate-400 text-sm font-medium">Total Steps</span>
                      <span className="text-3xl font-bold text-slate-200 mt-2">{autoTestSummary.totalSteps}</span>
                    </div>
                    <div className="bg-emerald-900/20 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                      <span className="text-emerald-400 text-sm font-medium">Passed</span>
                      <span className="text-3xl font-bold text-emerald-300 mt-2">{autoTestSummary.passed}</span>
                    </div>
                    <div className="bg-red-900/20 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                      <span className="text-red-400 text-sm font-medium">Failed / Defects</span>
                      <span className="text-3xl font-bold text-red-300 mt-2">{autoTestSummary.failed}</span>
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                      <span className="text-slate-400 text-sm font-medium">Pass Rate</span>
                      <span className="text-3xl font-bold text-amber-300 mt-2">{autoTestSummary.passRate}%</span>
                    </div>
                  </div>

                  <div className="flex gap-6 h-[500px]">
                    {/* Results Table */}
                    <div className="flex-1 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                          <ClipboardList size={18} className="text-amber-400" />
                          Execution Log
                        </h3>
                        <button 
                          onClick={() => setAutoTestPhase('input')}
                          className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors text-slate-300"
                        >
                          New Run
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm">
                          <thead className="bg-black/40 text-slate-400 uppercase text-xs tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="py-3 px-4 text-left border-r border-white/5 w-12">#</th>
                              <th className="py-3 px-4 text-left border-r border-white/5">Step Description</th>
                              <th className="py-3 px-4 text-left border-r border-white/5 w-24">Action</th>
                              <th className="py-3 px-4 text-left border-r border-white/5 w-24">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {autoTestResults.map((r, i) => (
                              <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4 border-r border-white/5 text-slate-500 font-mono text-xs">{r.stepId}</td>
                                <td className="py-3 px-4 border-r border-white/5">
                                  <span className="text-slate-200 font-medium block mb-1">{r.description}</span>
                                  <span className="text-slate-500 font-mono text-xs block">{r.target}</span>
                                  {r.error && <span className="text-red-400/90 text-xs mt-1 block">{r.error}</span>}
                                </td>
                                <td className="py-3 px-4 border-r border-white/5 text-xs font-mono text-slate-400">{r.action.toUpperCase()}</td>
                                <td className="py-3 px-4 border-r border-white/5">
                                  <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                                    r.status === 'pass' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 
                                    r.status === 'fail' ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 
                                    'bg-slate-500/15 text-slate-300'
                                  }`}>
                                    {r.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Defects Panel */}
                    <div className="w-1/3 min-w-[320px] bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-white/5 bg-black/20">
                        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                          <Bug size={18} className="text-red-400" />
                          Defects ({autoTestDefects.length})
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {autoTestDefects.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-emerald-500/70 p-6 text-center">
                            <CheckSquare size={48} className="mb-4 text-emerald-500/50" />
                            <p className="text-sm font-medium">All tests passed successfully.</p>
                            <p className="text-xs mt-1">No defects were found during execution.</p>
                          </div>
                        ) : (
                          autoTestDefects.map((defect) => (
                            <div key={defect.id} className="bg-red-950/20 border border-red-500/20 rounded-xl overflow-hidden shadow-lg group">
                              <div className="p-3 bg-red-500/10 border-b border-red-500/20 flex justify-between items-center">
                                <span className="text-xs font-semibold text-red-300 tracking-wider">DEFECT #{defect.id}</span>
                                <span className="text-xs text-red-400/70 font-mono">Step {defect.stepId}</span>
                              </div>
                              <div className="p-4">
                                <p className="text-sm text-slate-200 font-medium mb-2">{defect.description}</p>
                                <p className="text-xs text-slate-400 font-mono bg-black/40 p-2 rounded mb-3 truncate" title={defect.error}>
                                  {defect.error}
                                </p>
                                
                                {defect.screenshotBase64 && (
                                  <div className="mb-4 relative rounded-lg overflow-hidden border border-white/10 group-hover:border-white/20 transition-colors">
                                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 flex items-center gap-1 rounded text-[10px] text-white backdrop-blur-md">
                                      <Camera size={12} /> Failure Screenshot
                                    </div>
                                    <img 
                                      src={`data:image/png;base64,${defect.screenshotBase64}`} 
                                      alt="Failure state" 
                                      className="w-full h-auto cursor-pointer hover:scale-105 transition-transform duration-500"
                                      onClick={() => window.open(`data:image/png;base64,${defect.screenshotBase64}`, '_blank')}
                                    />
                                  </div>
                                )}

                                <button
                                  onClick={() => setDefectToReport(defect)}
                                  className="w-full py-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                  <Upload size={14} /> Report to Jira
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>


      {/* Jira Bug Reporting Modal for Automated Tests */}
      {defectToReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Bug size={18} className="text-blue-400" /> Report Defect
              </h3>
              <button
                onClick={() => setDefectToReport(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Jira Project Key *</label>
                <input
                  type="text"
                  value={defectJiraProject}
                  onChange={(e) => setDefectJiraProject(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950/50 border border-white/10 focus:border-blue-500 rounded-lg py-2.5 px-3 text-slate-200 outline-none uppercase font-mono text-sm"
                  placeholder="e.g. CORE"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Link to Parent Story Key (Optional)</label>
                <input
                  type="text"
                  value={defectParentStory}
                  onChange={(e) => setDefectParentStory(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950/50 border border-white/10 focus:border-blue-500 rounded-lg py-2.5 px-3 text-slate-200 outline-none uppercase font-mono text-sm"
                  placeholder="e.g. CORE-124"
                />
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-sm text-slate-300 font-medium">{defectToReport.description}</p>
                <p className="text-xs text-slate-500 mt-1">Screenshot will be attached automatically.</p>
              </div>
              <button
                onClick={handleReportDefectToJira}
                disabled={isReportingDefect || !defectJiraProject}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg flex justify-center items-center gap-2 transition-all"
              >
                {isReportingDefect ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isReportingDefect ? 'Creating Bug...' : 'Create Bug Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jira Upload Modal */}
      {isJiraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 p-2.5 rounded-xl">
                  <Upload size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Upload Test Cases to Jira</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Select a story or enter an issue key to link your test cases</p>
                </div>
              </div>
              <button
                onClick={() => setIsJiraModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {/* Manual Issue Key */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Enter Issue Key (Optional)</label>
                <input
                  type="text"
                  value={manualIssueKey}
                  onChange={(e) => { setManualIssueKey(e.target.value); setSelectedStoryKey(''); }}
                  className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 px-4 text-slate-200 outline-none transition-all shadow-inner placeholder-slate-600 font-mono text-sm"
                  placeholder="e.g. PROJ-123"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="text-xs text-slate-500 uppercase tracking-widest">or select from list</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>

              {/* Filter Bar */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={jiraSearchQuery}
                    onChange={(e) => setJiraSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-blue-500 rounded-xl py-2.5 px-4 pl-10 text-slate-200 outline-none transition-all text-sm placeholder-slate-600"
                    placeholder="Search stories..."
                  />
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
                <select
                  value={selectedProject}
                  onChange={(e) => { setSelectedProject(e.target.value); fetchJiraStories(e.target.value); }}
                  className="bg-slate-950/50 border border-white/10 hover:border-white/20 rounded-xl py-2.5 px-4 text-slate-200 outline-none transition-all text-sm cursor-pointer appearance-none min-w-[160px]"
                >
                  <option value="">All Projects</option>
                  {jiraProjects.map(p => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Stories List */}
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {isLoadingStories ? (
                  <div className="flex items-center justify-center py-12 gap-3 text-blue-400">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-sm">Fetching stories from Jira...</span>
                  </div>
                ) : filteredJiraStories.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    No stories found. Try a different project or enter a key manually.
                  </div>
                ) : (
                  filteredJiraStories.map(story => (
                    <button
                      key={story.key}
                      onClick={() => { setSelectedStoryKey(story.key); setManualIssueKey(''); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        selectedStoryKey === story.key
                          ? 'bg-blue-500/15 border-blue-500/40 shadow-lg shadow-blue-500/10'
                          : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-blue-300">{story.key}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              story.issueType === 'Story' ? 'bg-emerald-500/15 text-emerald-300' :
                              story.issueType === 'Bug' ? 'bg-red-500/15 text-red-300' :
                              'bg-slate-500/15 text-slate-300'
                            }`}>{story.issueType}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-medium">{story.status}</span>
                          </div>
                          <p className="text-sm text-slate-300 truncate">{story.summary}</p>
                          <p className="text-xs text-slate-500 mt-1">{story.project} • {story.assignee}</p>
                        </div>
                        {selectedStoryKey === story.key && (
                          <CheckCircle size={20} className="text-blue-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Upload Status */}
              {jiraUploadStatus && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                  jiraUploadStatus.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/20'
                    : 'bg-red-950/40 border-red-500/20'
                }`}>
                  {jiraUploadStatus.type === 'success'
                    ? <CheckCircle size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    : <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`text-sm font-medium ${
                      jiraUploadStatus.type === 'success' ? 'text-emerald-200' : 'text-red-200'
                    }`}>
                      {jiraUploadStatus.type === 'success' ? 'Upload Successful!' : 'Upload Failed'}
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      jiraUploadStatus.type === 'success' ? 'text-emerald-400/80' : 'text-red-400/80'
                    }`}>
                      {jiraUploadStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Uploading to: <span className="text-blue-300 font-mono font-bold">{manualIssueKey.trim() || selectedStoryKey || '—'}</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsJiraModalOpen(false)}
                  className="px-5 py-2.5 text-sm border border-white/10 hover:bg-white/5 text-slate-300 rounded-xl transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJiraUpload}
                  disabled={isUploadingToJira || (!manualIssueKey.trim() && !selectedStoryKey)}
                  className="px-6 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-blue-500/25 disabled:shadow-none flex items-center gap-2 transform active:scale-95"
                >
                  {isUploadingToJira ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  {isUploadingToJira ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS overrides for custom scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}

export default App
