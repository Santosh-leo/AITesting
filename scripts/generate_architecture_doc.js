const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType } = require('docx');

// Configuration
const SOURCE_MD = "C:\\Users\\SANTOSH\\.gemini\\antigravity\\brain\\160fa437-93fb-4e78-a3b7-2a7088eeed7f\\architecture_overview.md";
const OUTPUT_DOCX = "c:\\Users\\SANTOSH\\AITesterLearning\\Project_01_LocalLLMTestGenerator\\TARS_Architecture_Overview.docx";

async function generateDoc() {
    console.log("Reading Markdown source...");
    const content = fs.readFileSync(SOURCE_MD, 'utf-8');
    const lines = content.split('\n');

    const sections = [];
    let inCodeBlock = false;
    let codeBlockContent = [];

    lines.forEach(line => {
        // Handle Code Blocks (Mermaid/etc)
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                sections.push(new Paragraph({
                    text: codeBlockContent.join('\n'),
                    style: "Code",
                    spacing: { before: 200, after: 200 }
                }));
                codeBlockContent = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
            }
            return;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            return;
        }

        // Handle Headers
        if (line.startsWith('# ')) {
            sections.push(new Paragraph({
                text: line.replace('# ', ''),
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
        } else if (line.startsWith('## ')) {
            sections.push(new Paragraph({
                text: line.replace('## ', ''),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            }));
        } else if (line.startsWith('### ')) {
            sections.push(new Paragraph({
                text: line.replace('### ', ''),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 }
            }));
        } 
        // Handle Lists
        else if (line.trim().startsWith('- ')) {
            sections.push(new Paragraph({
                text: line.trim().replace('- ', ''),
                bullet: {
                    level: 0
                }
            }));
        }
        // Handle Paragraphs
        else if (line.trim().length > 0 && !line.startsWith('---')) {
            // Very basic Markdown parsing for bold/links
            let text = line.trim()
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\[(.*?)\]\(.*?\)/g, '$1');

            sections.push(new Paragraph({
                children: [new TextRun(text)],
                spacing: { after: 120 }
            }));
        }
        // Handle Horizontal Rule
        else if (line.startsWith('---')) {
            sections.push(new Paragraph({
                border: {
                    bottom: {
                        color: "auto",
                        space: 1,
                        style: "single",
                        size: 6,
                    },
                },
            }));
        }
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: "TARS Architecture Documentation",
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                ...sections
            ]
        }]
    });

    console.log("Generating .docx file...");
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(OUTPUT_DOCX, buffer);
    console.log(`Success! File saved to: ${OUTPUT_DOCX}`);
}

generateDoc().catch(err => {
    console.error("Error generating document:", err);
    process.exit(1);
});
