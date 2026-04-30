const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});

// Zod schema — used only for final validation
const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job description"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question that can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, including key points and approach")
    })).describe("Technical questions that can be asked in the interview along with their intention and answers"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question that can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, including key points and approach")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and answers"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan"),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day")
    })).describe("A day-wise preparation plan for the candidate to follow"),
    title: z.string().describe("The title of the interview report"),
});

// Native Gemini schema — used for responseSchema in the API call
const geminiResponseSchema = {
    type: "object",
    properties: {
        matchScore: { type: "number" },
        technicalQuestions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    intention: { type: "string" },
                    answer: { type: "string" }
                },
                required: ["question", "intention", "answer"]
            }
        },
        behavioralQuestions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    intention: { type: "string" },
                    answer: { type: "string" }
                },
                required: ["question", "intention", "answer"]
            }
        },
        skillGaps: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    skill: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high"] }
                },
                required: ["skill", "severity"]
            }
        },
        preparationPlan: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    day: { type: "number" },
                    focus: { type: "string" },
                    tasks: { type: "array", items: { type: "string" } }
                },
                required: ["day", "focus", "tasks"]
            }
        },
        title: { type: "string" }
    },
    required: ["matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan", "title"]
};

/**
 * Recursively parse any string that looks like JSON inside an object or array.
 * Fixes the "stringified JSON" issue.
 */
function deepParseJSON(obj) {
    if (typeof obj === 'string') {
        try {
            const parsed = JSON.parse(obj);
            return deepParseJSON(parsed);
        } catch {
            return obj;
        }
    } else if (Array.isArray(obj)) {
        return obj.map(item => deepParseJSON(item));
    } else if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = deepParseJSON(value);
        }
        return newObj;
    }
    return obj;
}

/**
 * Fix arrays that have been flattened into alternating keys and values.
 */

function fixFlattenedKeyValueArrays(obj) {
    if (Array.isArray(obj)) {
        const hasObject = obj.some(item => typeof item === 'object' && item !== null);
        const isEven = obj.length % 2 === 0;
        const firstElementIsKey = obj.length > 0 && typeof obj[0] === 'string' &&
            ['question', 'intention', 'answer', 'skill', 'severity', 'day', 'focus', 'tasks'].includes(obj[0]);

        if (!hasObject && isEven && firstElementIsKey) {
            const reconstructed = [];
            for (let i = 0; i < obj.length; i += 2) {
                const key = obj[i];
                const value = obj[i + 1];
                if (['question', 'skill', 'day'].includes(key)) {
                    const newObj = { [key]: value };
                    let j = i + 2;
                    while (j < obj.length && typeof obj[j] === 'string' && !['question', 'skill', 'day'].includes(obj[j])) {
                        newObj[obj[j]] = obj[j + 1];
                        j += 2;
                    }
                    reconstructed.push(newObj);
                    i = j - 2;
                } else {
                    reconstructed.push({ [key]: value });
                }
            }
            return reconstructed;
        }
        return obj.map(item => fixFlattenedKeyValueArrays(item));
    } else if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = fixFlattenedKeyValueArrays(value);
        }
        return newObj;
    }
    return obj;
}

/**
 * Combined fix for all known Gemini malformations.
 */
function sanitizeGeminiResponse(rawParsed) {
    let fixed = deepParseJSON(rawParsed);
    fixed = fixFlattenedKeyValueArrays(fixed);
    return fixed;
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `
You are an expert career coach and technical interviewer.
Analyze the candidate information against the job description and output ONLY valid JSON.

CRITICAL FORMAT RULES:
- Output must be directly parseable JSON. No markdown, no extra text, no code blocks.
- Use the exact structure shown in the example below.
- Each element inside "technicalQuestions", "behavioralQuestions", "skillGaps", and "preparationPlan" MUST be a JSON object.
  - DO NOT wrap objects in quotes or escape them.
  - DO NOT flatten objects into alternating key-value arrays.
  - Correct: { "question": "...", "intention": "...", "answer": "..." }
  - Incorrect: "{\\"question\\":\\"...\\"}"
  - Incorrect: ["question", "...", "intention", "...", "answer", "..."]
- "severity" must be exactly "low", "medium", or "high".
- "tasks" must be an array of strings.
- "day" numbers must start at 1 and be consecutive.

EXAMPLE OUTPUT (follow exactly):
{
  "matchScore": 78,
  "technicalQuestions": [
    {
      "question": "Explain the difference between REST and GraphQL.",
      "intention": "Assess understanding of API design paradigms.",
      "answer": "REST uses multiple endpoints and HTTP methods; GraphQL uses a single endpoint with queries. Discuss trade-offs: over-fetching, versioning, caching."
    }
  ],
  "behavioralQuestions": [
    {
      "question": "Tell me about a time you resolved a conflict in a team.",
      "intention": "Evaluate communication and conflict resolution skills.",
      "answer": "Use the STAR method: Situation, Task, Action, Result. Focus on listening, empathy, and collaborative solution."
    }
  ],
  "skillGaps": [
    {
      "skill": "Docker",
      "severity": "medium"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "System Design Fundamentals",
      "tasks": ["Read about load balancing", "Practice designing a URL shortener"]
    }
  ]
}

Now, generate the report for the following inputs:

Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`;

    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: geminiResponseSchema,  // ✅ native schema instead of zodToJsonSchema
                    temperature: 0
                }
            });

            const rawText = response.text;

            // Parse outer JSON
            let parsed = JSON.parse(rawText);

            // Apply all sanitization fixes
            parsed = sanitizeGeminiResponse(parsed);

            // Validate final structure with Zod
            const validated = interviewReportSchema.parse(parsed);

            console.log('Successfully generated and validated report');
            return validated;

        } catch (error) {
            // Don't retry on quota errors — it won't help
            if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
                throw new Error("Gemini API quota exceeded. Please try again later or upgrade your plan.");
            }

            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                console.error('All retries exhausted.');
                throw new Error(`Failed to generate valid report after ${maxRetries} attempts: ${lastError.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function generatePdfFromHtml(htmlContent) {
    // Inject CSS to enforce single-page A4 constraints
    const singlePageCss = `
        <style>
            @page { size: A4; margin: 0; }
            html, body {
                margin: 0;
                padding: 10px 16px;
                width: 210mm;
                max-height: 297mm;
                overflow: hidden;
                font-size: 10pt;
                line-height: 1.3;
                box-sizing: border-box;
            }
            * { box-sizing: border-box; }
            h1 { font-size: 16pt; margin: 0 0 4px 0; }
            h2 { font-size: 12pt; margin: 8px 0 3px 0; }
            h3 { font-size: 11pt; margin: 6px 0 2px 0; }
            p, li { margin: 2px 0; }
            ul, ol { padding-left: 16px; margin: 2px 0; }
            section { margin-bottom: 6px; }
        </style>
    `;

    // Inject the CSS right after <head> or at the start of the HTML
    let styledHtml;
    if (htmlContent.includes('<head>')) {
        styledHtml = htmlContent.replace('<head>', '<head>' + singlePageCss);
    } else if (htmlContent.includes('<html>')) {
        styledHtml = htmlContent.replace('<html>', '<html><head>' + singlePageCss + '</head>');
    } else {
        styledHtml = singlePageCss + htmlContent;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        timeout: 60000,
    });
    const page = await browser.newPage();

    await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
        width: '210mm',
        height: '297mm',
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        printBackground: true,
        pageRanges: '1',  // Force only page 1
    });

    await browser.close();
    return pdfBuffer;
}



async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchemw = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to the PDF file using the puppeteer library")
    })

    const prompt = `Generate a professional single-page resume in HTML format for a candidate with the following details:
    Resume: ${resume}
    Self Description: ${selfDescription}
    Job Description: ${jobDescription}

    CRITICAL SINGLE-PAGE RULES — THE RESUME MUST FIT IN EXACTLY ONE A4 PAGE:
    1. The HTML page dimensions are 210mm x 297mm (A4). Content MUST NOT exceed this.
    2. Use these MANDATORY inline styles on the body tag: font-size: 10pt; line-height: 1.3; margin: 0; padding: 10px 16px;
    3. Use compact spacing: section margins of 6px, heading margins of 4px, paragraph/list-item margins of 2px.
    4. Use font-size: 16pt for name, 12pt for section headings, 10pt for body text. Do NOT use larger fonts.
    5. CONTENT LIMITS — be very strict:
       - Maximum 4 work experience entries (2-3 bullet points each, each bullet under 15 words)
       - Maximum 8-10 skills (displayed inline/comma-separated, NOT as a long list)
       - Maximum 2-3 education entries (1 line each)
       - Maximum 2-3 project entries if relevant (1-2 lines each)
       - Contact info on a single line
    6. Use a clean, two-column or single-column layout that maximizes vertical space.
    7. Do NOT use excessive padding, large margins, or decorative elements that waste space.
    8. Use only inline CSS styles. No external stylesheets.
    9. Use subtle colors for section headings or borders only. Keep it professional and ATS-friendly.
    10. The content must sound natural and human-written. No AI-generated phrases.
    11. Include relevant keywords from the job description naturally.
    12. The response must be a JSON object with a single field "html" containing the complete HTML string.

    REMEMBER: If the content is too long for one page, CUT IT DOWN. Brevity is more important than completeness. A concise, impactful single-page resume is always better than a sprawling two-page one.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchemw),
        }

    });


    const jsonContent = JSON.parse(response.text).html;

    const pdfBuffer = await generatePdfFromHtml(jsonContent);
    return pdfBuffer;
}


module.exports = { generateInterviewReport, generateResumePdf };