import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'results.json');

// Ensure data directory exists
const ensureDataDir = () => {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8');
    }
};

interface TestRunSummary {
    id: string;
    timestamp: string;
    totalSteps: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    defectsFound: number;
}

// Get all dashboard stats
router.get('/stats', (req: Request, res: Response) => {
    try {
        ensureDataDir();
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const results: TestRunSummary[] = JSON.parse(data);

        const totalRuns = results.length;
        if (totalRuns === 0) {
            res.json({
                totalRuns: 0,
                overallPassRate: 0,
                historicalData: [],
                distribution: { passed: 0, failed: 0 }
            });
            return;
        }

        const avgPassRate = Math.round(results.reduce((acc, curr) => acc + curr.passRate, 0) / totalRuns);
        
        const totalPassed = results.reduce((acc, curr) => acc + curr.passed, 0);
        const totalFailed = results.reduce((acc, curr) => acc + curr.failed, 0);

        // Historical data for charts (last 20 runs)
        const historicalData = results.slice(-20).map(r => ({
            timestamp: new Date(r.timestamp).toLocaleDateString() + ' ' + new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            passRate: r.passRate,
            passed: r.passed,
            failed: r.failed,
            total: r.totalSteps
        }));

        res.json({
            totalRuns,
            overallPassRate: avgPassRate,
            historicalData,
            distribution: { passed: totalPassed, failed: totalFailed }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const saveTestResult = (summary: any) => {
    try {
        ensureDataDir();
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const results: TestRunSummary[] = JSON.parse(data);
            
            const newRun: TestRunSummary = {
                id: `run_${Date.now()}`,
                timestamp: new Date().toISOString(),
                ...summary
            };
            
            results.push(newRun);
            fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), 'utf-8');
            return newRun;
        }
    } catch (error) {
        console.error('Failed to save test result (likely read-only FS):', error);
    }
    return null;
};

export default router;
