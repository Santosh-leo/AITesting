import { useState, useRef, useEffect, useCallback } from 'react'
import { Settings, Send, Bot, FileJson, CheckCircle, Loader2, ArrowLeft, Cpu, Globe, Key, Database, LayoutDashboard, Sparkles, Image as ImageIcon, X, Download, Play, Square, Code, RefreshCw, Crosshair, Upload, Search, ExternalLink, AlertCircle, Table, FileText, Bug, Activity, CheckSquare, Camera, Briefcase, PlayCircle, ClipboardList, Menu, Home, ChevronRight } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'


type View = 'home' | 'testBuilder' | 'settings' | 'recorder' | 'automatedTesting' | 'analytics';

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
  const [activeView, setActiveView] = useState<View>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Analytics State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fetchDashboardStats = async () => {
    setIsDataLoading(true);
    setDashboardError(null);
    try {
      const response = await axios.get('/api/dashboard/stats');
      setDashboardData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats', err);
      setDashboardError(err.response?.data?.error || err.message || 'Failed to connect to dashboard service.');
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'analytics') {
      fetchDashboardStats();
    }
    // Auto-close sidebar on view change (mobile)
    setIsSidebarOpen(false);
  }, [activeView]);


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
      const response = await axios.post('/api/sf-autotest/run', {
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
      const response = await axios.post('/api/jira/create-defect', {
        projectKey: defectJiraProject,
        summary: `[AutoTest] ${defectToReport.description}`,
        description: `Defect found during Automated Test Execution.\n\n**Step:** ${defectToReport.stepId}\n**Error:** ${defectToReport.error}`,
        linkedStoryKey: defectParentStory,
        screenshotBase64: defectToReport.screenshotBase64
      });
      alert(`Success! Bug ${response.data.issueKey} created in project ${defectJiraProject}.`);
      // Clear reporting state
      setDefectToReport(null);
      setDefectJiraProject('');
      setDefectParentStory('');
    } catch (err: any) {
      console.error('Failed to report defect', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      alert('Failed to report defect to Jira: ' + errorMessage);
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
      const res = await axios.post('/api/playwright/generate-scenarios', {
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
      const projRes = await axios.get('/api/jira/projects');
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
      const res = await axios.get(`/api/jira/stories?${params.toString()}`);
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
      const res = await axios.post('/api/jira/upload', {
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
      const res = await axios.get('/api/playwright/locators');
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
      const res = await axios.post('/api/playwright/launch', { url: targetUrl });
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
      const res = await axios.post('/api/playwright/stop');
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
      const res = await axios.post('/api/playwright/generate-test', { testName });
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

    try {
      const formData = new FormData();
      formData.append('jiraRequirement', jiraRequirement);
      formData.append('provider', provider);
      formData.append('model', model);
      formData.append('apiUrl', apiUrl);
      if (apiKey) formData.append('apiKey', apiKey);
      if (imageFile) formData.append('image', imageFile);

      const response = await axios.post('/api/generate', formData, {
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
    <div className="min-h-screen flex flex-col bg-white font-sans selection:bg-cyan-500/30 selection:text-cyan-900 overflow-x-hidden tars-gradient-bg">
      
      {/* Background Decor */}
      <div className="tars-blob -top-20 -left-20"></div>
      <div className="tars-blob top-1/2 -right-20"></div>

      {/* Top Navigation Bar */}
      <nav className="h-20 bg-[#1a1a45] text-white flex items-center justify-between px-6 lg:px-12 sticky top-0 z-[100] shadow-xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            <div className="bg-white/10 p-2 rounded-xl">
              <Bot size={28} className="text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">T.A.R.S</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            {[
              { id: 'home', label: 'Home' },
              { id: 'analytics', label: 'Dashboard' },
              { id: 'testBuilder', label: 'Test Builder' },
              { id: 'recorder', label: 'Recorder' },
              { id: 'automatedTesting', label: 'Auto Test' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                className={`transition-colors hover:text-white relative py-2 ${activeView === item.id ? 'text-white' : ''}`}
              >
                {item.label}
                {activeView === item.id && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full animate-in fade-in slide-in-from-left-2"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveView('settings')}
            className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${activeView === 'settings' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Settings size={20} />
          </button>
          <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block"></div>
          <button className="hidden sm:block text-sm font-semibold hover:text-cyan-400 transition-colors">
            Sign in
          </button>
          <button 
            onClick={() => {
              if (activeView === 'home') setActiveView('testBuilder');
              else setActiveView('home');
            }}
            className="bg-cyan-500 hover:bg-cyan-600 text-[#1a1a45] px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95"
          >
            {activeView === 'home' ? 'Get Started' : 'Home'}
          </button>
          <button 
            className="lg:hidden p-2 text-slate-300"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[110] md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute right-0 top-0 h-full w-64 bg-[#1a1a45] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <span className="text-white font-bold text-lg">Menu</span>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <div className="flex flex-col py-4">
              {[
                { id: 'home', label: 'Home' },
                { id: 'analytics', label: 'Dashboard' },
                { id: 'testBuilder', label: 'Test Builder' },
                { id: 'recorder', label: 'Recorder' },
                { id: 'automatedTesting', label: 'Auto Test' },
                { id: 'settings', label: 'Settings' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id as View); setIsSidebarOpen(false); }}
                  className={`px-6 py-3.5 text-left text-sm font-medium transition-colors ${
                    activeView === item.id
                      ? 'text-cyan-400 bg-white/5 border-r-2 border-cyan-400'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col">
        {activeView === 'home' ? (
          /* Landing Page View */
          <div className="flex flex-col animate-in fade-in duration-700">
            {/* Hero Section */}
            <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-[#1a1a45] mb-6 leading-tight">
                  Test Automation and <br/>
                  <span className="text-cyan-600">Reporting System</span>
                </h2>
                <p className="text-base sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                  T.A.R.S is an intelligent reporting and automation suite designed to streamline your QA workflow with AI-powered test generation and live recording.
                </p>
              </div>

              {/* Feature Grid */}
              <div className="space-y-32 mt-20">
                {/* Dashboard Section */}
                <div className="flex flex-col lg:flex-row items-center gap-16">
                  <div className="flex-1">
                    <span className="text-cyan-600 font-bold tracking-widest uppercase text-sm mb-4 block underline decoration-cyan-400 underline-offset-8">Quality Insights</span>
                    <h3 className="text-4xl font-bold text-[#23315a] mb-6">Actionable Dashboards</h3>
                    <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                      Get a high-level overview of your testing activities, pass rates, and defect trends. Analyze your application quality with real-time analytics and beautiful visualizations.
                    </p>
                    <button 
                      onClick={() => setActiveView('analytics')}
                      className="flex items-center gap-2 text-cyan-600 font-bold hover:gap-4 transition-all"
                    >
                      See T.A.R.S in Action <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-4 bg-yellow-400/10 rounded-3xl blur-2xl group-hover:bg-yellow-400/20 transition-all"></div>
                    <div className="relative bg-slate-100 rounded-3xl p-4 border border-slate-200 shadow-2xl overflow-hidden">
                      <div className="aspect-video bg-indigo-950 rounded-xl overflow-hidden relative">
                        <video
                          src="/videos/dashboard-preview.mp4"
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden'); }}
                        />
                        <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <LayoutDashboard size={64} className="text-cyan-400 opacity-50" />
                          <span className="text-cyan-400/60 text-xs font-bold uppercase tracking-widest">Video Coming Soon</span>
                        </div>
                        <span className="absolute bottom-4 right-4 bg-cyan-500 text-white text-[10px] px-2 py-1 rounded font-bold">LIVE DEMO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Builder Section */}
                <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
                  <div className="flex-1">
                    <span className="text-purple-600 font-bold tracking-widest uppercase text-sm mb-4 block underline decoration-purple-400 underline-offset-8">AI Generation</span>
                    <h3 className="text-4xl font-bold text-[#23315a] mb-6">Test Case Builder</h3>
                    <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                      Transform Jira user stories and wireframe screenshots into comprehensive test cases using cutting-edge LLMs. Generate steps, expectations, and Playwright code instantly.
                    </p>
                    <button 
                      onClick={() => setActiveView('testBuilder')}
                      className="flex items-center gap-2 text-purple-600 font-bold hover:gap-4 transition-all"
                    >
                      See T.A.R.S in Action <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-4 bg-purple-400/10 rounded-3xl blur-2xl group-hover:bg-purple-400/20 transition-all"></div>
                    <div className="relative bg-slate-100 rounded-3xl p-4 border border-slate-200 shadow-2xl overflow-hidden">
                      <div className="aspect-video bg-indigo-950 rounded-xl overflow-hidden relative">
                        <video
                          src="/videos/testbuilder-preview.mp4"
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden'); }}
                        />
                        <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <Sparkles size={64} className="text-purple-400 opacity-50" />
                          <span className="text-purple-400/60 text-xs font-bold uppercase tracking-widest">Video Coming Soon</span>
                        </div>
                        <span className="absolute bottom-4 right-4 bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-bold">LIVE DEMO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recorder Section */}
                <div className="flex flex-col lg:flex-row items-center gap-16">
                  <div className="flex-1">
                    <span className="text-emerald-600 font-bold tracking-widest uppercase text-sm mb-4 block underline decoration-emerald-400 underline-offset-8">Live Capture</span>
                    <h3 className="text-4xl font-bold text-[#23315a] mb-6">Interactive Recorder</h3>
                    <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                      Record user actions live in a browsed session and automatically discover robust locators. Convert manual exploration into repeatable automated test scripts without writing code.
                    </p>
                    <button 
                      onClick={() => setActiveView('recorder')}
                      className="flex items-center gap-2 text-emerald-600 font-bold hover:gap-4 transition-all"
                    >
                      See T.A.R.S in Action <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-4 bg-emerald-400/10 rounded-3xl blur-2xl group-hover:bg-emerald-400/20 transition-all"></div>
                    <div className="relative bg-slate-100 rounded-3xl p-4 border border-slate-200 shadow-2xl overflow-hidden">
                      <div className="aspect-video bg-indigo-950 rounded-xl overflow-hidden relative">
                        <video
                          src="/videos/recorder-preview.mp4"
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden'); }}
                        />
                        <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <Play size={64} className="text-emerald-400 opacity-50" />
                          <span className="text-emerald-400/60 text-xs font-bold uppercase tracking-widest">Video Coming Soon</span>
                        </div>
                        <span className="absolute bottom-4 right-4 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded font-bold">LIVE DEMO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auto Test Section */}
                <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
                  <div className="flex-1">
                    <span className="text-amber-600 font-bold tracking-widest uppercase text-sm mb-4 block underline decoration-amber-400 underline-offset-8">Auto Execution</span>
                    <h3 className="text-4xl font-bold text-[#23315a] mb-6">Automated Suite</h3>
                    <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                      Run your generated tests automatically and report defects directly to Jira. Monitor every step with live status updates and failure analysis.
                    </p>
                    <button 
                      onClick={() => setActiveView('automatedTesting')}
                      className="flex items-center gap-2 text-amber-600 font-bold hover:gap-4 transition-all"
                    >
                      See T.A.R.S in Action <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-4 bg-amber-400/10 rounded-3xl blur-2xl group-hover:bg-amber-400/20 transition-all"></div>
                    <div className="relative bg-slate-100 rounded-3xl p-4 border border-slate-200 shadow-2xl overflow-hidden">
                      <div className="aspect-video bg-indigo-950 rounded-xl overflow-hidden relative">
                        <video
                          src="/videos/autotest-preview.mp4"
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden'); }}
                        />
                        <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <Activity size={64} className="text-amber-400 opacity-50" />
                          <span className="text-amber-400/60 text-xs font-bold uppercase tracking-widest">Video Coming Soon</span>
                        </div>
                        <span className="absolute bottom-4 right-4 bg-amber-500 text-white text-[10px] px-2 py-1 rounded font-bold">LIVE DEMO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#1a1a45] text-white py-12 px-6 lg:px-12 mt-32">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-3">
                  <Bot size={28} className="text-cyan-400" />
                  <span className="text-xl font-bold">T.A.R.S</span>
                </div>
                <div className="flex gap-8 text-sm text-slate-400">
                  <a href="#" className="hover:text-white transition-colors">Documentation</a>
                  <a href="#" className="hover:text-white transition-colors">Privacy</a>
                  <a href="#" className="hover:text-white transition-colors">Support</a>
                </div>
                <p className="text-slate-500 text-xs">© 2026 T.A.R.S Automation. All rights reserved.</p>
              </div>
            </footer>
          </div>
        ) : (
          /* Feature Views (Functional App) */
          <div className="flex-1 backdrop-blur-3xl overflow-y-auto flex flex-col">
            {activeView === 'analytics' ? (
          <div className="h-full flex flex-col p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar">
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900">
                Quality Insights Dashboard
              </h2>
              <p className="text-slate-400 mt-2">Historical performance and automated test execution analytics.</p>
            </header>

            {isDataLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={48} className="text-indigo-500 animate-spin" />
              </div>
            ) : dashboardError ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 p-8 rounded-2xl max-w-lg w-full text-center shadow-xl">
                  <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-red-200 mx-auto">
                    <Database size={32} className="text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-red-900">Dashboard Unavailable</h3>
                  <p className="text-red-700 mb-6">{dashboardError}</p>
                  <button
                    onClick={fetchDashboardStats}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : !dashboardData || dashboardData?.totalRuns === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
                <div className="bg-slate-100 p-8 rounded-full border border-slate-200 shadow-inner">
                  <Activity size={48} className="text-slate-400" />
                </div>
                <p className="text-xl font-bold text-slate-900">No test data available.</p>
                <p className="text-sm text-slate-500">Run some automated tests to see analytics here.</p>
              </div>
            ) : (
              <div className="space-y-8 pb-10">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl hover:border-slate-300 transition-all">
                    <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Total Runs</p>
                    <p className="text-4xl font-bold text-slate-900 mt-2">{dashboardData?.totalRuns || 0}</p>
                  </div>
                  <div className="bg-emerald-50/50 backdrop-blur-xl border border-emerald-200 p-6 rounded-2xl shadow-xl">
                    <p className="text-emerald-700 text-sm font-semibold uppercase tracking-wider">Avg Pass Rate</p>
                    <p className="text-4xl font-bold text-emerald-600 mt-2">{dashboardData?.overallPassRate || 0}%</p>
                  </div>
                  <div className="bg-indigo-50/50 backdrop-blur-xl border border-indigo-200 p-6 rounded-2xl shadow-xl">
                    <p className="text-indigo-700 text-sm font-semibold uppercase tracking-wider">Total Passed</p>
                    <p className="text-4xl font-bold text-indigo-600 mt-2">{dashboardData?.distribution?.passed || 0}</p>
                  </div>
                  <div className="bg-red-50/50 backdrop-blur-xl border border-red-200 p-6 rounded-2xl shadow-xl">
                    <p className="text-red-700 text-sm font-semibold uppercase tracking-wider">Total Failed</p>
                    <p className="text-4xl font-bold text-red-600 mt-2">{dashboardData?.distribution?.failed || 0}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Line Chart: Success Rate Over Time */}
                  <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Execution Pass Rate Trend</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardData?.historicalData || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} tickFormatter={(val) => val.split(' ')[0]} />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#6366f1' }}
                          />
                          <Line type="monotone" dataKey="passRate" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bar Chart: Test Outcomes */}
                  <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Step Outcomes per Run</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData?.historicalData || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} tickFormatter={(val) => val.split(' ')[0]} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="top" height={36}/>
                          <Bar dataKey="passed" fill="#10b981" radius={[4, 4, 0, 0]} name="Passed Steps" />
                          <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed Steps" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart: Overall Distribution */}
                  <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Overall Pass/Fail Distribution</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Passed', value: dashboardData?.distribution?.passed || 0 },
                              { name: 'Failed', value: dashboardData?.distribution?.failed || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                   {/* Recent Runs List */}
                   <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl h-[400px] flex flex-col overflow-hidden">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Test Runs</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {dashboardData.historicalData.slice().reverse().map((run: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{run.timestamp}</span>
                            <span className="text-xs text-slate-500">{run.total} steps executed</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-sm font-bold ${run.passRate >= 80 ? 'text-emerald-600' : run.passRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {run.passRate}% Pass
                            </span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${run.passRate >= 80 ? 'bg-emerald-500' : run.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${run.passRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'testBuilder' ? (

          <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Manual Test Case Generator
                </h2>
                <p className="text-slate-400 mt-2">Generate comprehensive tests from your Jira specs or screenshots.</p>
              </div>
            </header>

            {/* Split-Screen Layout */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
              {/* Left Panel – Input */}
              <div className="w-full lg:w-[45%] flex flex-col bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <div className="p-4 px-6 border-b border-slate-200 bg-slate-50/50 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Send size={18} className="text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 tracking-wide">Input Specifications</h3>
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">

                  <div className="flex gap-4 mb-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div className="bg-slate-100/80 border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-md">
                      <p className="text-slate-800 leading-relaxed text-sm mb-2 font-medium">
                        Paste your Jira user story or acceptance criteria below. You can also upload a reference screenshot.
                      </p>
                      <p className="text-indigo-600 text-xs italic font-semibold">
                        Select a Vision model in settings if uploading images.
                      </p>
                    </div>
                  </div>

                  {/* Image Preview Area */}
                  {imagePreview && (
                    <div className="ml-14 mb-6 relative w-max rounded-xl overflow-hidden border border-indigo-500/30 shadow-lg shadow-indigo-500/10 group">
                      <img src={imagePreview} alt="Uploaded Spec" className="max-h-48 object-contain bg-slate-50" />
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

                <div className="p-4 bg-slate-50/80 border-t border-slate-200 backdrop-blur-md">
                  <div className="flex gap-3">
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
                        className="p-3 bg-white border border-slate-200 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all duration-300 shadow-sm hover:border-indigo-300 group"
                        title="Upload Screenshot"
                      >
                        <ImageIcon size={20} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                    {/* Text Input & Submit */}
                    <div className="relative group w-full">
                      <textarea
                        value={jiraRequirement}
                        onChange={(e) => setJiraRequirement(e.target.value)}
                        className="w-full bg-white border border-slate-200 group-focus-within:border-indigo-500 rounded-xl py-3 px-4 pr-14 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-300 text-sm"
                        placeholder="e.g. As a user, I want to securely log into the portal..."
                        rows={3}
                      />
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!jiraRequirement.trim() && !imageFile)}
                        className="absolute right-3 bottom-3 p-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-300 shadow-lg shadow-indigo-500/20 disabled:shadow-none flex items-center justify-center transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel – Output */}
              <div className="w-full lg:w-[55%] flex flex-col bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative min-h-[400px]">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent"></div>

                <div className="p-4 px-6 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50/50 backdrop-blur-md z-10 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <FileJson size={18} className="text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 tracking-wide">Generated Tests</h3>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      disabled={!generatedTests}
                      onClick={() => navigator.clipboard.writeText(generatedTests)}
                      className="text-sm bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 text-slate-700 font-bold shadow-sm"
                      title="Copy Markdown"
                    >
                      <CheckCircle size={14} className={generatedTests ? "text-emerald-500" : "text-slate-400"} />
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={exportToExcel}
                      className="text-sm bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 text-indigo-700 font-bold shadow-sm"
                    >
                      <Download size={14} /> Excel
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={exportToWord}
                      className="text-sm bg-purple-50 hover:bg-purple-100 border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 text-purple-700 font-bold shadow-sm"
                    >
                      <Download size={14} /> Word
                    </button>
                    <button
                      disabled={!generatedTests}
                      onClick={handleOpenJiraModal}
                      className="text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 text-blue-700 font-bold shadow-sm"
                    >
                      <Upload size={14} /> Jira
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                  {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 gap-6 bg-white/80 backdrop-blur-sm">
                      <div className="relative">
                        <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                        <Loader2 size={48} className="animate-spin relative z-10" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-bold text-xl tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                          Synthesizing Tests...
                        </p>
                        <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">via {provider} — {model}</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="h-full flex items-center justify-center animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl max-w-lg w-full backdrop-blur-md shadow-2xl">
                        <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-red-200">
                          <AlertCircle size={24} className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-red-900">Generation Failed</h3>
                        <p className="text-red-700 leading-relaxed font-medium">{error}</p>
                        <button
                          onClick={() => setError('')}
                          className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-500/20"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : generatedTests ? (
                    <div className="animate-in fade-in duration-500">
                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-2 mb-6">
                        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex gap-1 shadow-inner">
                          <button
                            onClick={() => setOutputViewMode('table')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${outputViewMode === 'table' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <Table size={14} /> Table
                          </button>
                          <button
                            onClick={() => setOutputViewMode('markdown')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${outputViewMode === 'markdown' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <FileText size={14} /> Markdown
                          </button>
                        </div>
                        {outputViewMode === 'table' && parsedTestCases.length > 0 && (
                          <span className="text-xs text-slate-400 font-medium ml-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Click any cell to edit • {parsedTestCases.length} test cases</span>
                        )}
                      </div>

                      {outputViewMode === 'table' && parsedTestCases.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xl bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-slate-200">
                              <tr>
                                <th className="py-4 px-4 text-left border-r border-slate-100 w-12">#</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 w-32">Req ID</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 min-w-[200px]">Test Objective</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 min-w-[250px]">Test Steps</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 min-w-[200px]">Expected Result</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 min-w-[140px]">Actual Result</th>
                                <th className="py-4 px-4 text-left border-r border-slate-100 w-24">Pass/Fail</th>
                                <th className="py-4 px-4 text-left w-28">Related Defects</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {parsedTestCases.map((tc, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                  <td className="py-3 px-4 border-r border-slate-100 text-slate-400 font-mono text-xs">
                                    <input
                                      value={tc.n}
                                      onChange={(e) => handleCellEdit(i, 'n', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-slate-400 font-mono text-xs p-0"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <input
                                      value={tc.reqId}
                                      onChange={(e) => handleCellEdit(i, 'reqId', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-indigo-600 font-bold font-mono text-xs p-0 focus:bg-white focus:ring-1 focus:ring-indigo-100 focus:rounded transition-all"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <textarea
                                      value={tc.testObjective}
                                      onChange={(e) => handleCellEdit(i, 'testObjective', e.target.value)}
                                      rows={2}
                                      className="w-full bg-transparent border-0 outline-none text-slate-900 text-xs resize-none p-0 focus:bg-white focus:ring-1 focus:ring-slate-100 focus:rounded transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <textarea
                                      value={tc.testSteps}
                                      onChange={(e) => handleCellEdit(i, 'testSteps', e.target.value)}
                                      rows={3}
                                      className="w-full bg-transparent border-0 outline-none text-slate-700 text-xs resize-none p-0 focus:bg-white focus:ring-1 focus:ring-slate-100 focus:rounded transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <textarea
                                      value={tc.expectedResult}
                                      onChange={(e) => handleCellEdit(i, 'expectedResult', e.target.value)}
                                      rows={2}
                                      className="w-full bg-transparent border-0 outline-none text-emerald-600 text-xs resize-none p-0 focus:bg-white focus:ring-1 focus:ring-emerald-50 focus:rounded transition-all leading-relaxed"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <textarea
                                      value={tc.actualResult}
                                      onChange={(e) => handleCellEdit(i, 'actualResult', e.target.value)}
                                      rows={1}
                                      className="w-full bg-transparent border-0 outline-none text-amber-600 text-xs resize-none p-0 focus:bg-white focus:ring-1 focus:ring-amber-50 focus:rounded transition-all"
                                    />
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <select
                                      value={tc.passFail || 'Pending'}
                                      onChange={(e) => handleCellEdit(i, 'passFail', e.target.value)}
                                      className={`w-full bg-transparent border-0 outline-none text-xs cursor-pointer p-0 appearance-none font-bold ${tc.passFail === 'Pass' ? 'text-emerald-600' :
                                          tc.passFail === 'Fail' ? 'text-red-600' :
                                            'text-slate-400'
                                        }`}
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="Pass">Pass</option>
                                      <option value="Fail">Fail</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-4">
                                    <input
                                      value={tc.relatedDefects}
                                      onChange={(e) => handleCellEdit(i, 'relatedDefects', e.target.value)}
                                      className="w-full bg-transparent border-0 outline-none text-slate-400 text-xs p-0 focus:bg-white focus:ring-1 focus:ring-slate-100 focus:rounded transition-all"
                                      placeholder="—"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none
                            prose-headings:text-slate-900 prose-headings:font-bold 
                            prose-a:text-indigo-600 hover:prose-a:text-indigo-500
                            prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:shadow-sm
                            prose-strong:text-indigo-900 prose-th:text-slate-600 prose-th:bg-slate-100 prose-td:border-slate-100">
                          <ReactMarkdown>{generatedTests}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <div className="bg-slate-100 p-8 rounded-full border border-slate-200 shadow-inner">
                        <FileJson size={48} className="text-slate-400" />
                      </div>
                      <p className="text-xl font-bold text-slate-900">Awaiting input specifications.</p>
                      <p className="text-sm text-slate-500">Paste some requirements and click Generate.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'settings' ? (
          /* Settings View */
          <div className="h-full flex flex-col p-4 md:p-6 lg:p-10 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <button
                onClick={() => setActiveView('analytics')}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors mb-6 group w-max font-bold"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </button>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                Global Configuration
              </h2>
              <p className="text-slate-500 mt-2 font-medium">Manage your connection to Local or Cloud LLMs.</p>
            </header>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-8 rounded-2xl shadow-xl">

                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
                  <Cpu size={20} className="text-indigo-600" /> Provider Settings
                </h3>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Provider Selection */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Platform
                      </label>
                      <div className="relative group">
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl py-3 px-4 text-slate-800 appearance-none outline-none transition-all cursor-pointer shadow-sm font-medium"
                        >
                          <option value="ollama">Ollama (Local)</option>
                          <option value="lmstudio">LM Studio (Local)</option>
                          <option value="openai">OpenAI (Cloud)</option>
                          <option value="claude">Anthropic Claude (Cloud)</option>
                          <option value="gemini">Google Gemini (Cloud)</option>
                          <option value="grok">xAI Grok (Cloud)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500">
                          <Globe size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Model Version
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded-xl py-3 px-4 text-slate-800 outline-none transition-all shadow-sm placeholder-slate-400 font-medium"
                        placeholder="e.g. gemma3:1b, gpt-4o, llava"
                      />
                    </div>
                  </div>

                  {/* API Base URL */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Network Endpoint URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded-xl py-3 px-4 pl-12 text-slate-800 outline-none transition-all shadow-sm placeholder-slate-400 font-mono text-sm font-medium"
                        placeholder="e.g. http://localhost:11434"
                      />
                      <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Authentication Token
                      </label>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 uppercase tracking-wider">Required for Cloud</span>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded-xl py-3 px-4 pl-12 text-slate-800 outline-none transition-all shadow-sm placeholder-slate-400 font-mono text-sm tracking-widest"
                        placeholder="sk-..........................."
                      />
                      <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setActiveView('testBuilder')}
                    className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-500/20 text-white font-bold rounded-2xl transition-all transform active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle size={20} />
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'recorder' ? (
          /* Recorder View */
          <div className="h-full flex flex-col p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar">
            <header className="mb-8">
              <button
                onClick={() => setActiveView('analytics')}
                className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors mb-6 group w-max"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </button>
              <h2 className="text-3xl font-bold text-slate-900">
                Playwright Recorder
              </h2>
              <p className="text-slate-400 mt-2">Launch a browser, discover locators, and generate Playwright test scripts.</p>
            </header>

            {/* Launch Panel */}
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl mb-6">
              <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-200">
                <Crosshair size={20} className="text-emerald-600" /> Launch Testing Application
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isSessionActive}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 px-4 pl-12 text-slate-900 outline-none transition-all shadow-inner placeholder-slate-400 font-mono text-sm disabled:opacity-50"
                    placeholder="https://your-app-url.com"
                  />
                  <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
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

            {/* Embedded Browser View */}
            {isSessionActive && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl mb-6 overflow-hidden">
                <div className="p-3 px-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
                    <span className="text-sm font-bold text-slate-800">Live Browser Preview</span>
                    <span className="text-xs text-slate-400 font-mono truncate max-w-xs">{targetUrl}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-200">Recording</span>
                  </div>
                </div>
                <div className="relative" style={{ height: '500px' }}>
                  <iframe
                    src={targetUrl}
                    className="w-full h-full border-0"
                    title="Browser Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/20 to-transparent h-8 pointer-events-none"></div>
                </div>
              </div>
            )}

            {/* Locators Table */}
            {locators.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl mb-6 overflow-hidden">
                <div className="p-4 px-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Crosshair size={16} className="text-emerald-600" />
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
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl mb-6 overflow-hidden">
                <div className="p-4 px-6 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Code size={16} className="text-teal-600" />
                    Recorded Actions ({actions.length})
                  </h3>
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-100">
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
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl mb-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Code size={20} className="text-indigo-600" /> Generate Playwright Test
                </h3>
                <div className="flex gap-4 mb-4">
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 rounded-xl py-3 px-4 text-slate-800 outline-none transition-all shadow-sm placeholder-slate-400 text-sm font-medium"
                    placeholder="Test name..."
                  />
                  <button
                    onClick={handleGenerateTest}
                    disabled={isGeneratingTest}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 text-white font-bold rounded-xl transition-all transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingTest ? <Loader2 size={18} className="animate-spin" /> : <Code size={18} />}
                    Generate Test
                  </button>
                </div>

                {generatedTestCode && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Generated Script</span>
                      <button
                        onClick={downloadTestFile}
                        className="text-sm bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-emerald-700 font-bold"
                      >
                        <Download size={16} /> Download .spec.ts
                      </button>
                    </div>
                    <pre className="bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-x-auto text-sm font-mono text-emerald-400 max-h-96 overflow-y-auto custom-scrollbar leading-relaxed">
                      <code>{generatedTestCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Test Cases Scenarios UI */}
            {(!isSessionActive && (locators.length > 0 || actions.length > 0)) && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles size={20} className="text-indigo-600" /> AI-Generated Test Scenarios
                  </h3>
                  <button
                    onClick={handleGenerateScenarios}
                    disabled={isGeneratingScenarios}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    {isGeneratingScenarios ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {generatedScenarios.length > 0 ? 'Regenerate Scenarios' : 'Analyze Session'}
                  </button>
                </div>

                {generatedScenarios.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner bg-white animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-slate-100">
                          <tr>
                            <th className="py-4 px-4 text-left border-r border-slate-50 w-24">Req ID</th>
                            <th className="py-4 px-4 text-left border-r border-slate-50 min-w-[150px]">Objective</th>
                            <th className="py-4 px-4 text-left border-r border-slate-50 min-w-[200px]">Validation Steps</th>
                            <th className="py-4 px-4 text-left">Expected Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {generatedScenarios.map((sc, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-4 font-mono text-indigo-600 font-bold border-r border-slate-50">{sc.reqId}</td>
                              <td className="py-4 px-4 text-slate-900 border-r border-slate-50 font-bold">{sc.objective}</td>
                              <td className="py-4 px-4 text-slate-600 border-r border-slate-50 whitespace-pre-wrap leading-relaxed text-xs">{sc.steps}</td>
                              <td className="py-4 px-4 text-emerald-600 leading-relaxed font-bold text-xs">{sc.expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="p-4 bg-white rounded-full mb-4 shadow-sm border border-slate-100">
                      <Sparkles size={32} className="text-indigo-400" />
                    </div>
                    <p className="text-slate-500 text-center max-w-sm font-medium">
                      {isGeneratingScenarios ? 'Synthesizing session data...' : 'Let the AI analyze your recorded session to generate positive and negative test cases.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeView === 'automatedTesting' ? (
          /* Automated Testing View */
          <div className="flex-1 overflow-hidden relative flex flex-col p-4 md:p-6 lg:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <Activity size={32} className="text-amber-500" /> Automated Salesforce Testing
                </h2>
                <p className="text-slate-400 mt-2">Generate Playwright tests from user stories and run them live in Salesforce.</p>
              </div>
            </header>

            {/* Split-Screen Layout */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
              {/* Left Panel – Input (always visible) */}
              <div className="w-full lg:w-[40%] flex flex-col">
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl p-6 flex flex-col h-full">
                  <div className="p-4 px-0 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2 rounded-lg">
                        <Briefcase size={18} className="text-amber-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 tracking-wide">Test Configuration</h3>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    What do you want to test?
                  </h4>
                  <textarea
                    value={sfUserStory}
                    onChange={(e) => setSfUserStory(e.target.value)}
                    placeholder={"Enter a Salesforce User Story or functional requirement.\nFor example: 'As a Sales Rep, I want to navigate to the Accounts tab, click New, fill in the Account Name as Target Corp, and click Save.'"}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-4 px-5 text-slate-900 outline-none transition-all shadow-inner placeholder-slate-400 min-h-[160px] resize-y mb-4 flex-1 text-sm"
                  />

                  {autoRunError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Execution Failed</p>
                        <p className="text-xs text-red-600 mt-1">{autoRunError}</p>
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
                      {isAutoRunning ? 'Running...' : 'Generate & Run Tests'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel – Results */}
              <div className="w-full lg:w-[60%] flex flex-col min-h-[400px]">
                {autoTestPhase === 'input' && !autoTestSummary ? (
                  <div className="flex-1 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col items-center justify-center text-slate-500 gap-4 p-8">
                    <div className="bg-slate-100 p-8 rounded-full border border-slate-200 shadow-inner">
                      <Activity size={48} className="text-slate-400" />
                    </div>
                    <p className="text-xl font-bold text-slate-900">No test results yet.</p>
                    <p className="text-sm text-slate-500 text-center max-w-sm">Enter a user story on the left and click "Generate & Run Tests" to start automated testing.</p>
                  </div>
                ) : autoTestPhase === 'running' ? (
                  <div className="flex-1 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col items-center justify-center text-slate-300">
                    <div className="relative mb-8">
                      <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>
                      <Loader2 size={64} className="text-amber-400 animate-spin relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500 mb-3">
                      Executing Automated Tests
                    </h3>
                    <p className="text-slate-400 text-center max-w-md">
                      The LLM is generating test steps and running them live in a background Chromium instance...
                    </p>
                    <div className="mt-12 w-full max-w-sm flex flex-col gap-4 px-8">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 w-1/2 animate-pulse rounded-full"></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 font-mono">
                        <span>Working...</span>
                        <span>~30-60s</span>
                      </div>
                    </div>
                  </div>
                ) : autoTestPhase === 'results' && autoTestSummary ? (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 animate-in fade-in slide-in-from-bottom-4">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium">Total Steps</span>
                        <span className="text-3xl font-bold text-slate-900 mt-2">{autoTestSummary?.totalSteps || 0}</span>
                      </div>
                      <div className="bg-emerald-50/50 backdrop-blur-xl border border-emerald-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                        <span className="text-emerald-700 text-sm font-medium">Passed</span>
                        <span className="text-3xl font-bold text-emerald-600 mt-2">{autoTestSummary?.passed || 0}</span>
                      </div>
                      <div className="bg-red-50/50 backdrop-blur-xl border border-red-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                        <span className="text-red-700 text-sm font-medium">Failed / Defects</span>
                        <span className="text-3xl font-bold text-red-600 mt-2">{autoTestSummary?.failed || 0}</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium">Pass Rate</span>
                        <span className="text-3xl font-bold text-amber-600 mt-2">{autoTestSummary?.passRate || 0}%</span>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[500px]">
                      {/* Results Table */}
                      <div className="flex-1 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <ClipboardList size={18} className="text-amber-600" />
                            Execution Log
                          </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100/80 text-slate-500 uppercase text-xs tracking-wider sticky top-0 z-10">
                              <tr>
                                <th className="py-3 px-4 text-left border-r border-slate-200 w-12">#</th>
                                <th className="py-3 px-4 text-left border-r border-slate-200">Step Description</th>
                                <th className="py-3 px-4 text-left border-r border-slate-200 w-24">Action</th>
                                <th className="py-3 px-4 text-left border-r border-slate-200 w-24">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {autoTestResults.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 border-r border-slate-100 text-slate-500 font-mono text-xs">{r.stepId}</td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <span className="text-slate-800 font-medium block mb-1">{r.description}</span>
                                    <span className="text-slate-500 font-mono text-xs block">{r.target}</span>
                                    {r.error && <span className="text-red-500 text-xs mt-1 block">{r.error}</span>}
                                  </td>
                                  <td className="py-3 px-4 border-r border-slate-100 text-xs font-mono text-slate-400">{r.action.toUpperCase()}</td>
                                  <td className="py-3 px-4 border-r border-slate-100">
                                    <span className={`px-2.5 py-1 rounded text-xs font-medium ${r.status === 'pass' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                        r.status === 'fail' ? 'bg-red-100 text-red-700 border border-red-200' :
                                          'bg-slate-100 text-slate-500'
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
                      <div className="w-full lg:w-1/3 min-w-0 lg:min-w-[320px] bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden h-[400px] lg:h-auto">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <Bug size={18} className="text-red-500" />
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
                              <div key={defect.id} className="bg-red-50/50 border border-red-200 rounded-xl overflow-hidden shadow-lg group">
                                <div className="p-3 bg-red-100/50 border-b border-red-200 flex justify-between items-center">
                                  <span className="text-xs font-semibold text-red-700 tracking-wider">DEFECT #{defect.id}</span>
                                  <span className="text-xs text-red-600/70 font-mono">Step {defect.stepId}</span>
                                </div>
                                <div className="p-4">
                                  <p className="text-sm text-slate-800 font-medium mb-2">{defect.description}</p>
                                  <p className="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded mb-3 truncate" title={defect.error}>
                                    {defect.error}
                                  </p>

                                  {defect.screenshotBase64 && (
                                    <div className="mb-4 relative rounded-lg overflow-hidden border border-slate-200 group-hover:border-slate-300 transition-colors">
                                      <div className="absolute top-2 left-2 bg-white/80 px-2 py-1 flex items-center gap-1 rounded text-[10px] text-slate-900 backdrop-blur-md shadow-sm">
                                        <Camera size={12} /> Failure Screenshot
                                      </div>
                                      <img
                                        src={`data:image/png;base64,${defect.screenshotBase64}`}
                                        alt="Failure state"
                                        className="w-full h-auto cursor-pointer hover:scale-105 transition-transform duration-500"
                                        onClick={() => setExpandedImage(`data:image/png;base64,${defect.screenshotBase64}`)}
                                      />
                                    </div>
                                  )}

                                  <button
                                    onClick={() => setDefectToReport(defect)}
                                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
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
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      )}
    </main>


      {/* Jira Bug Reporting Modal for Automated Tests */}
      {defectToReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDefectToReport(null)}></div>
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-xl">
                  <Bug size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Report Defect</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Automated Failure Capture</p>
                </div>
              </div>
              <button
                onClick={() => setDefectToReport(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Jira Project Key *</label>
                  <input
                    type="text"
                    value={defectJiraProject}
                    onChange={(e) => setDefectJiraProject(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 rounded-xl py-3.5 px-4 text-slate-900 outline-none uppercase font-mono text-sm transition-all shadow-inner"
                    placeholder="e.g. CORE"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Linked Story Key</label>
                  <input
                    type="text"
                    value={defectParentStory}
                    onChange={(e) => setDefectParentStory(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl py-3.5 px-4 text-slate-900 outline-none uppercase font-mono text-sm transition-all shadow-inner"
                    placeholder="e.g. CORE-124"
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">"{defectToReport.description}"</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Screenshot will be attached</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setDefectToReport(null)}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleReportDefectToJira}
                  disabled={isReportingDefect || !defectJiraProject}
                  className="flex-[2] py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-bold rounded-2xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-red-500/20 disabled:shadow-none transform active:scale-95"
                >
                  {isReportingDefect ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {isReportingDefect ? 'Creating...' : 'Create Jira Bug'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300 p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpandedImage(null); }}
          >
            <X size={24} />
          </button>
          <div className="max-w-6xl max-h-[90vh] w-full flex items-center justify-center animate-in zoom-in duration-300">
            <img 
              src={expandedImage} 
              alt="Expanded Preview" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-xs text-slate-300 flex items-center gap-2">
            Click anywhere to close
          </div>
        </div>
      )}

      {/* Jira Modal */}
      {isJiraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsJiraModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-xl">
                  <Upload size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Upload to Jira</h3>
                  <p className="text-xs text-slate-500 font-medium">Link your generated tests to a Jira issue</p>
                </div>
              </div>
              <button
                onClick={() => setIsJiraModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={jiraSearchQuery}
                      onChange={(e) => setJiraSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-3 px-4 pl-10 text-slate-900 outline-none transition-all text-sm placeholder-slate-400 shadow-sm"
                      placeholder="Search stories..."
                    />
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <select
                    value={selectedProject}
                    onChange={(e) => { setSelectedProject(e.target.value); fetchJiraStories(e.target.value); }}
                    className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl py-3 px-4 text-slate-700 outline-none transition-all text-sm cursor-pointer appearance-none min-w-[160px] shadow-sm"
                  >
                    <option value="">All Projects</option>
                    {jiraProjects.map(p => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Stories List */}
                <div className="space-y-2 border border-slate-100 rounded-2xl overflow-hidden p-1 bg-slate-50">
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 p-1">
                    {isLoadingStories ? (
                      <div className="flex items-center justify-center py-12 gap-3 text-indigo-600">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-sm font-bold">Connecting to Jira...</span>
                      </div>
                    ) : filteredJiraStories.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-sm italic">
                        No matches found.
                      </div>
                    ) : (
                      filteredJiraStories.map(story => (
                        <button
                          key={story.key}
                          onClick={() => { setSelectedStoryKey(story.key); setManualIssueKey(''); }}
                          className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedStoryKey === story.key
                              ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-500/5 ring-2 ring-indigo-500/20'
                              : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-bold text-indigo-600">{story.key}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${story.issueType === 'Story' ? 'bg-emerald-100 text-emerald-700' :
                                    story.issueType === 'Bug' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-200 text-slate-700'
                                  }`}>{story.issueType}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-800 truncate">{story.summary}</p>
                              <p className="text-xs text-slate-500 mt-1 font-medium">{story.project} • {story.assignee}</p>
                            </div>
                            {selectedStoryKey === story.key && (
                              <CheckCircle size={20} className="text-emerald-500 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                    <span className="bg-white px-3 text-slate-400">Or Manual Entry</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issue Key</label>
                  <input
                    type="text"
                    value={manualIssueKey}
                    onChange={(e) => { setManualIssueKey(e.target.value); setSelectedStoryKey(''); }}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl py-3 px-4 text-slate-900 font-mono text-sm outline-none transition-all shadow-inner"
                    placeholder="e.g. PROJ-123"
                  />
                </div>
              </div>

              {/* Upload Status */}
              {jiraUploadStatus && (
                <div className={`p-4 rounded-2xl border flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 ${jiraUploadStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-red-50 border-red-100'
                  }`}>
                  <div className={`p-2 rounded-xl flex-shrink-0 ${jiraUploadStatus.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {jiraUploadStatus.type === 'success'
                      ? <CheckCircle size={20} className="text-emerald-600" />
                      : <AlertCircle size={20} className="text-red-600" />
                    }
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${jiraUploadStatus.type === 'success' ? 'text-emerald-900' : 'text-red-900'
                      }`}>
                      {jiraUploadStatus.type === 'success' ? 'Perfectly Linked!' : 'Linking Error'}
                    </p>
                    <p className={`text-xs mt-0.5 font-medium ${jiraUploadStatus.type === 'success' ? 'text-emerald-700/80' : 'text-red-700/80'
                      }`}>
                      {jiraUploadStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Linking to</p>
                <p className="text-sm font-bold text-indigo-600 font-mono">{manualIssueKey.trim() || selectedStoryKey || '—'}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsJiraModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJiraUpload}
                  disabled={isUploadingToJira || (!manualIssueKey.trim() && !selectedStoryKey)}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-xl transition-all font-bold shadow-lg shadow-indigo-500/20 disabled:shadow-none flex items-center gap-2 transform active:scale-95"
                >
                  {isUploadingToJira ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={18} />}
                  {isUploadingToJira ? 'Linking...' : 'Confirm Link'}
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
