import { APISettings, Conversation, StudySession, QuizQuestion, GeneratedQuiz, VisualContent } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../supabase';
import * as db from './supabaseService';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

const baseSystemPrompt = `You are an enthusiastic AI tutor who makes learning engaging and accessible. Your responses should feel natural and conversational while being educationally valuable.
PERSONALITY & TONE:
- Warm, encouraging, and genuinely excited about helping students learn
- Use natural, conversational language - not overly formal or robotic
- Show enthusiasm for the subject matter
- Be patient and supportive when concepts are challenging
- Celebrate student progress and curiosity
RESPONSE STYLE:
- Start naturally based on what the student asked - no rigid templates
- Use markdown formatting to make content visually appealing and organized
- Break complex topics into digestible chunks with clear explanations
- Include relevant examples, analogies, and real-world connections
- End by encouraging further questions or exploration
FORMATTING FOR CLARITY:
Use markdown strategically to enhance understanding:
- **Bold** for key terms and important concepts
- *Italics* for emphasis
- Code blocks for formulas, equations, or structured information
- Tables when comparing things or organizing data
- Lists for steps, examples, or key points
- Blockquotes for important principles or insights
EDUCATIONAL APPROACH:
- Focus exclusively on academic subjects and learning
- Build on prior knowledge when possible
- Provide multiple ways to understand concepts (visual, verbal, examples)
- Include practice opportunities or thought-provoking questions
- Connect topics to broader learning and real-world applications
- Suggest next steps for deeper understanding
FOR DIFFERENT SUBJECTS:
- **Math**: Show step-by-step solutions, explain reasoning, highlight common mistakes
- **Science**: Use experiments, observations, and evidence-based thinking
- **History**: Provide context, multiple perspectives, cause-and-effect relationships
- **Language Arts**: Focus on comprehension, analysis, and clear communication
- **Other subjects**: Apply appropriate academic thinking and methodology
KEEP RESPONSES:
- Conversational and natural (not template-driven)
- Visually organized with markdown formatting
- Educational and academically focused
- Encouraging and supportive
- Appropriately detailed for the question asked
Remember: You're having a natural conversation about learning, not filling out a worksheet. Adapt your response style to what the student actually needs, whether that's a quick clarification, detailed explanation, or guided practice.`;

const visualSystemPrompt = `You are an enthusiastic AI tutor specializing in creating visual explanations. When a student requests a visual answer, you provide both a clear explanation AND a visual diagram to help them understand the concept better.

VISUAL RESPONSE FORMAT:
1. Start with a brief, engaging explanation of the concept
2. Generate appropriate diagram code based on the topic
3. Provide additional context or explanations as needed

DIAGRAM SELECTION CRITERIA:
- **Flowcharts** (Mermaid): For processes, decision trees, algorithms, step-by-step procedures
- **Concept Maps** (Mermaid): For showing relationships between ideas, mind maps, hierarchies
- **Hand-drawn Style** (Rough): For simple explanations, casual diagrams, brainstorming visuals

MERMAID DIAGRAM TYPES TO USE:
- \`graph TD\` or \`graph LR\` for flowcharts and process diagrams
- \`mindmap\` for concept maps and hierarchical relationships
- \`flowchart TD\` for decision processes
- \`classDiagram\` for showing relationships between concepts
- Keep diagrams simple and educational

ROUGH DIAGRAM FORMAT (JSON):
For hand-drawn style, use this JSON structure:
\`\`\`json
{
  "type": "concept-map",
  "title": "Main Topic",
  "concepts": [
    {"label": "Concept 1"},
    {"label": "Concept 2"}
  ]
}
\`\`\`

OR for flowcharts:
\`\`\`json
{
  "type": "flowchart",
  "nodes": [
    {"label": "Start"},
    {"label": "Process"},
    {"label": "End"}
  ],
  "connections": [
    {"from": 0, "to": 1},
    {"from": 1, "to": 2}
  ]
}
\`\`\`

IMPORTANT RULES:
- Always provide both text explanation AND visual content
- Choose the most appropriate visual type for the concept
- Keep diagrams educational and focused
- Use clear, simple labels
- Make sure diagram code is syntactically correct
- Explain how the visual helps understand the concept

Your goal is to make learning visual and engaging while maintaining educational value.`;

async function* streamOpenAICompatResponse(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): AsyncGenerator<string> {
  const messagesWithSystemPrompt = [{ role: 'system', content: systemPrompt }, ...messages];
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: messagesWithSystemPrompt, stream: true }),
  });
  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data.trim() === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) yield chunk;
        } catch (e) { console.error('Error parsing stream chunk:', e, 'Raw data:', data); }
      }
    }
  }
}

class AiService {
  private settings: APISettings = { selectedModel: 'google' };
  public updateSettings(newSettings: APISettings) {
    this.settings = newSettings;
  }

  private async generatePersonalizedSystemPrompt(userId?: string): Promise<string> {
    if (!userId) {
      return baseSystemPrompt;
    }
    try {
      const studentProfile = await db.getActiveStudentProfileForChat(userId);
      if (studentProfile) {
        return db.generatePersonalizedPrompt(studentProfile, baseSystemPrompt);
      }
    } catch (error) {
      console.warn('Could not load student profile for personalization:', error);
    }
    return baseSystemPrompt;
  }

  public async *generateStreamingResponse(
    messages: { role: string; content: string }[],
    userId?: string
  ): AsyncGenerator<string> {
    const userMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const systemPrompt = await this.generatePersonalizedSystemPrompt(userId);
    switch (this.settings.selectedModel) {
      case 'google': {
        if (!GOOGLE_API_KEY) throw new Error('Google API key is not configured on the server.');
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`;
        const googlePayload = {
          contents: userMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          systemInstruction: { parts: [{ text: systemPrompt }] }
        };
        const response = await fetch(googleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googlePayload),
        });
        if (!response.ok || !response.body) throw new Error(`API Error: ${response.status} ${response.statusText}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.substring(6));
                const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (chunk) yield chunk;
              } catch (e) { console.error('Error parsing Google stream:', e); }
            }
          }
        }
        break;
      }
      case 'zhipu':
        if (!ZHIPU_API_KEY) throw new Error('ZhipuAI API key is not configured on the server.');
        yield* streamOpenAICompatResponse('https://open.bigmodel.cn/api/paas/v4/chat/completions', ZHIPU_API_KEY, 'glm-4-flash', userMessages, systemPrompt);
        break;
      case 'mistral-small':
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        yield* streamOpenAICompatResponse('https://api.mistral.ai/v1/chat/completions', MISTRAL_API_KEY, 'mistral-small-latest', userMessages, systemPrompt);
        break;
      case 'mistral-codestral':
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        yield* streamOpenAICompatResponse('https://api.mistral.ai/v1/chat/completions', MISTRAL_API_KEY, 'codestral-latest', userMessages, systemPrompt);
        break;
      default:
        throw new Error('Invalid model selected.');
    }
  }

  public async generateVisualResponse(
    messages: { role: string; content: string }[],
    userId?: string
  ): Promise<{ content: string; visualContent?: VisualContent }> {
    if (!GOOGLE_API_KEY) throw new Error('Google API key is not configured on the server.');
    
    const userMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    
    // Create enhanced prompt for visual response
    const visualPrompt = `The student asked: "${lastUserMessage}"

Please provide a visual explanation with both text and a diagram. Based on the question, determine if this should be:
- A flowchart (for processes, steps, algorithms)
- A concept map (for relationships, hierarchies, mind maps)
- A simple hand-drawn style diagram (for basic explanations)

Provide your response in this exact format:

EXPLANATION:
[Your clear, engaging explanation here]

VISUAL_TYPE: [mermaid_flowchart|mermaid_concept|rough_diagram]

VISUAL_CODE:
[Your diagram code here - either Mermaid syntax or JSON for rough diagrams]

VISUAL_TITLE: [Short title for the diagram]

Make sure the visual directly supports your explanation and helps the student understand the concept better.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: visualPrompt }] }],
        systemInstruction: { parts: [{ text: visualSystemPrompt }] }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error('Invalid response from API when generating visual content.');
    }

    // Parse the structured response
    const result = this.parseVisualResponse(textResponse);
    return result;
  }

  private parseVisualResponse(response: string): { content: string; visualContent?: VisualContent } {
    try {
      const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)(?=VISUAL_TYPE:|$)/);
      const typeMatch = response.match(/VISUAL_TYPE:\s*([\s\S]*?)(?=VISUAL_CODE:|$)/);
      const codeMatch = response.match(/VISUAL_CODE:\s*([\s\S]*?)(?=VISUAL_TITLE:|$)/);
      const titleMatch = response.match(/VISUAL_TITLE:\s*([\s\S]*?)(?=\n|$)/);

      const explanation = explanationMatch?.[1]?.trim() || response;
      const visualType = typeMatch?.[1]?.trim() || '';
      const visualCode = codeMatch?.[1]?.trim()?.replace(/```(mermaid|json)?/g, '') || '';
      const visualTitle = titleMatch?.[1]?.trim() || '';

      let visualContent: VisualContent | undefined = undefined;

      if (visualType && visualCode) {
        let mappedType: 'mermaid' | 'rough' | 'none' = 'none';
        if (visualType.startsWith('mermaid')) {
          mappedType = 'mermaid';
        } else if (visualType.startsWith('rough')) {
          mappedType = 'rough';
        }

        if (mappedType !== 'none') {
          visualContent = {
            type: mappedType,
            code: visualCode,
            title: visualTitle,
          };
        }
      }

      return { content: explanation, visualContent };
    } catch(e) {
      console.error("Error parsing visual response:", e);
      // Fallback to returning the whole response as text content
      return { content: response };
    }
  }

  private async parseQuizResponse(textResponse: string): Promise<QuizQuestion[]> {
      try {
        const parsed = JSON.parse(textResponse);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
            throw new Error("Invalid quiz format: 'questions' array not found.");
        }
        const questions: QuizQuestion[] = parsed.questions.map((q: any) => {
            if (!q.options || !Array.isArray(q.options) || !q.answer) {
                return null;
            }
            const correctAnswerIndex = q.options.indexOf(q.answer);
            return {
                id: generateId(),
                question: q.question,
                options: q.options,
                correctAnswer: correctAnswerIndex,
                explanation: q.explanation
            };
        }).filter((q: any): q is QuizQuestion => q !== null && q.correctAnswer !== -1);

        if (questions.length === 0) {
            throw new Error("No valid questions could be generated from the API response.");
        }
        return questions;
      } catch (error) {
          console.error("Failed to parse quiz JSON:", error, "Raw response:", textResponse);
          throw new Error("Could not generate a valid quiz from the provided topic.");
      }
  }

  public async generateQuiz(conversation: Conversation): Promise<StudySession> {
    if (!GOOGLE_API_KEY) throw new Error('Google API key must be configured to generate quizzes.');
    const conversationText = conversation.messages.map(m => `${m.role === 'user' ? 'Student:' : 'Tutor:'} ${m.content}`).join('\n\n');
    const quizPrompt = `Create a quiz based on our tutoring conversation. Make 5 multiple-choice questions that test understanding of the key concepts we discussed.
Make the questions:
- Clear and well-written
- Test real understanding, not just memorization
- Include one obviously wrong answer, two plausible but incorrect answers, and one clearly correct answer
- Have helpful explanations that reinforce the learning
Format as JSON with "questions" array. Each question needs:
- "question": the question text
- "options": array of exactly 4 answer choices
- "answer": the correct choice (must exactly match one of the 4 options)
- "explanation": brief explanation of why this answer is correct
Our conversation:
${conversationText.slice(0, 8000)}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: quizPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error('Invalid response from API when generating quiz.');
    const questions = await this.parseQuizResponse(textResponse);
    return { id: generateId(), conversationId: conversation.id, questions, currentQuestionIndex: 0, score: 0, totalQuestions: questions.length, isCompleted: false, createdAt: new Date() };
  }

  public async generateQuizFromTopic(topic: string): Promise<GeneratedQuiz> {
    if (!GOOGLE_API_KEY) throw new Error('Google API key must be configured to generate quizzes.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Could not retrieve user profile');
    }

    if (profile.role !== 'teacher') {
      throw new Error('Only teachers can generate quizzes');
    }

    const teacherId = profile.id;

    const topicQuizPrompt = `Create a high-quality quiz for high school students on: "${topic}"
Create 5 multiple-choice questions that:
- Test understanding of key concepts (not just facts)
- Are challenging but fair for the grade level
- Have clear, well-written questions
- Include plausible wrong answers that test common misconceptions
Format as JSON with "questions" array. Each question needs:
- "question": clear, properly written question
- "options": exactly 4 answer choices
- "answer": the correct option (must match exactly)
- "explanation": brief explanation that helps students learn
Focus on the most important concepts students need to master about this topic.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: topicQuizPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error generating quiz: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error('Invalid API response when generating quiz from topic.');

    const questions = await this.parseQuizResponse(textResponse);
    const newQuizData = { teacher_id: teacherId, topic, questions };
    const savedQuiz = await db.createGeneratedQuiz(newQuizData);
    return savedQuiz;
  }
}

export const aiService = new AiService();
