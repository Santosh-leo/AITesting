import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import llmRoutes from './llmRoutes';
import playwrightRoutes from './playwrightRoutes';
import jiraRoutes from './jiraRoutes';
import salesforceTestRoutes from './salesforceTestRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'T.A.R.S – Test Automation & Reporting Suite API is running' });
});

app.use('/api', llmRoutes);
app.use('/api/playwright', playwrightRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/sf-autotest', salesforceTestRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
