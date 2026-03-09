import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import llmRoutes from './llmRoutes';
import playwrightRoutes from './playwrightRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Local LLM Test Generator API is running' });
});

app.use('/api', llmRoutes);
app.use('/api/playwright', playwrightRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
