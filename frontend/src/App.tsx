import { useState, useRef, useEffect, useCallback } from 'react'
import { Settings, Send, Bot, FileJson, CheckCircle, Loader2, ArrowLeft, Cpu, Globe, Key, Database, LayoutDashboard, Sparkles, Image as ImageIcon, X, Download, Play, Square, Code, RefreshCw, Crosshair } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

type View = 'dashboard' | 'settings' | 'recorder';
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      setGeneratedTests(response.data.tests);
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
            <h1 className="hidden lg:block ml-4 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-indigo-200 tracking-wide">
              TestGen AI
            </h1>
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
              <span className="hidden lg:block font-medium">Dashboard</span>
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
            <button
              onClick={() => { setActiveView('recorder'); if (!isSessionActive && !isLaunching && targetUrl.trim()) handleLaunchBrowser(); }}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 rounded-xl transition-all duration-200 ${activeView === 'recorder'
                ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-emerald-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <Play size={20} />
              <span className="hidden lg:block font-medium">Recorder</span>
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
                  Test Case Generator
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
                    <div className="max-w-4xl mx-auto prose prose-invert prose-indigo max-w-none
                        prose-headings:text-slate-100 prose-headings:font-semibold 
                        prose-a:text-indigo-400 hover:prose-a:text-indigo-300
                        prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:shadow-xl
                        prose-strong:text-indigo-200 prose-th:text-slate-300 prose-th:bg-white/5 prose-td:border-white/5
                        animate-in fade-in duration-500">
                      <ReactMarkdown>{generatedTests}</ReactMarkdown>
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
        ) : (
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
          </div>
        )}
      </main>

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
