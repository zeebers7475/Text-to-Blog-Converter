import { GoogleGenAI } from "@google/genai";
import type { TrainingExample } from '../types';

// IMPORTANT: Do NOT expose your API key in client-side code.
// This is a placeholder and should be handled via a backend proxy for production applications.
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

const BASE_PROMPT = `You are an expert HTML cleaner and formatter. Your task is to take the user's input HTML snippet and convert it into clean, semantic HTML suitable for a blog post.
The input you receive will be raw HTML from a rich text editor or a document conversion. It may contain complex styles, classes, and unsupported tags.
Strictly adhere to the following rules:
1.  Only use these HTML tags: <h3>, <p>, <strong>, <em>, <sup>, <sub>, <ul>, <ol>, <li>, <a>, <blockquote>, <img>.
2.  Remove all other HTML tags and all attributes (like class, style, id, etc.), except for the 'href' attribute on <a> tags and the 'src' attribute on <img> tags. The 'src' for images will be a base64 data URI, which you should preserve.
3.  Do NOT include <html>, <head>, or <body> tags. The output must be a valid HTML snippet.
4.  Analyze the provided examples to understand the desired formatting style, including how to handle specific patterns, line breaks, and emphasis.
5.  Ensure paragraphs are wrapped in <p> tags and headings are converted appropriately.
6.  Maintain the user's intended structure and meaning.
7.  Replace all non-breaking space entities (&nbsp;) with a standard space. Do not output any &nbsp; entities.`;

export const convertToHtml = async (inputText: string, examples: TrainingExample[]): Promise<string> => {
    let fullPrompt = BASE_PROMPT;

    if (examples.length > 0) {
        const examplePrompts = examples.map(ex =>
            `---
EXAMPLE INPUT:
${ex.input}
---
EXAMPLE OUTPUT:
${ex.output}`
        ).join('\n\n');

        fullPrompt += `\n\nHere are some examples of the desired conversion:\n\n${examplePrompts}`;
    }

    fullPrompt += `\n\nNow, convert the following HTML based on these rules and examples.\n\n---
HTML TO CONVERT:
${inputText}
---
CONVERTED HTML:`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                temperature: 0.2,
                topP: 0.95,
                topK: 40,
            }
        });

        let htmlOutput = response.text.trim();
        if (htmlOutput.startsWith('```html')) {
            htmlOutput = htmlOutput.substring(7);
        }
        if (htmlOutput.startsWith('```')) {
            htmlOutput = htmlOutput.substring(3);
        }
        if (htmlOutput.endsWith('```')) {
            htmlOutput = htmlOutput.slice(0, -3);
        }

        // Clean up non-breaking spaces
        htmlOutput = htmlOutput.replace(/&nbsp;/g, ' ');

        return htmlOutput.trim();

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred while communicating with the API: ${error.message}`);
        }
        throw new Error("An unknown error occurred while converting the text.");
    }
};