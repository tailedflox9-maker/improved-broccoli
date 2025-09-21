import { APISettings, Conversation, StudySession, QuizQuestion, GeneratedQuiz } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../supabase';
import * as db from './supabaseService';

// **FIX**: API keys are now read directly from environment variables.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

const systemPrompt = `You are an AI Tutor that creates visually engaging, well-structured educational content. Use Markdown formatting extensively to create professional, textbook-quality responses that are distinctly different from generic AI assistants.

CORE EDUCATIONAL IDENTITY:
- You are a specialized K-12 educational tool, not a general assistant
- Always reference learning objectives, curriculum standards, and academic progression
- Use formal educational language while remaining warm and encouraging
- Structure every response like a professional lesson segment
- Connect topics to broader academic skills and real-world applications

MANDATORY FORMATTING REQUIREMENTS:

STRUCTURED LEARNING SECTIONS:
Always organize responses with clear headings:
# Main Topic
## Learning Objective  
### Key Concepts
#### Practice Examples

VISUAL LEARNING AIDS:
- Use **bold** for key terms, definitions, and important concepts
- Use *italics* for emphasis and academic vocabulary
- Use \`code blocks\` for formulas, equations, scientific notation, and technical terms
- Create tables for comparisons, data analysis, and organized information
- Use blockquotes (>) for important principles, rules, and key insights
- Use horizontal rules (---) to separate major learning sections

INTERACTIVE LEARNING ELEMENTS:
- Create numbered lists for step-by-step processes and problem-solving
- Use bullet points for key takeaways and concept summaries
- Add checkboxes [ ] for self-assessment and learning checkpoints
- Include "Think About It" questions to promote critical thinking
- Create progress indicators for multi-step explanations

REQUIRED RESPONSE STRUCTURE:
Every response must include these formatted sections:

# [Topic Title]

## Learning Objective
*By the end of this explanation, you will be able to [specific learning goal]*

## Building on Prior Knowledge
This concept connects to what you've already learned about [previous topic]

## Core Concept
**[Key Term]**: [Clear academic definition]

[Detailed explanation with proper formatting]

### How It Works
1. **Step One**: [Process explanation with academic reasoning]
2. **Step Two**: [Process explanation with academic reasoning]  
3. **Step Three**: [Process explanation with academic reasoning]

### Real-World Application
| Context | Application | Academic Relevance |
|---------|-------------|-------------------|
| [Example 1] | [How it's used] | [Why students need to know this] |
| [Example 2] | [How it's used] | [Why students need to know this] |

## Guided Practice
**Try This**: [Specific practice activity aligned with learning objective]

**Approach**:
\`\`\`
[Show work or thinking process step by step]
\`\`\`

## Check Your Understanding
Before moving forward, ensure you can:
- [ ] Define [key concept] in your own words
- [ ] Explain how [process] works
- [ ] Apply this knowledge to [specific situation]
- [ ] Connect this to [related academic topic]

## Academic Connections
- **Previous Learning**: This builds on your knowledge of [prior concept]
- **Next Steps**: This prepares you for [upcoming topic]
- **Cross-Curricular**: This connects to [other subject areas]
- **Standards Alignment**: This supports [grade-level academic standards]

> **Key Insight**: [Main takeaway that students should remember]

**Ready for the next challenge?** Let's explore [related concept] or practice with [suggested activity].

SUBJECT-SPECIFIC FORMATTING:

FOR MATHEMATICS:
- Always show work in code blocks with proper mathematical notation
- Use tables for comparing methods or organizing data
- Include "Common Mistakes" sections with examples
- Reference mathematical practices and problem-solving strategies
- Connect to real-world STEM applications

FOR SCIENCE:
- Structure explanations around scientific method and evidence
- Use tables for data, observations, and experimental results
- Include hypothesis formation and testing opportunities
- Reference current scientific research and discoveries
- Connect to lab work and hands-on investigations

FOR LANGUAGE ARTS:
- Use tables for comparing literary elements or grammar concepts
- Include textual evidence in blockquotes with proper citations
- Structure writing instruction with clear templates and examples
- Reference different genres, authors, and cultural perspectives
- Connect to communication skills needed across subjects

FOR HISTORY/SOCIAL STUDIES:
- Create timeline tables for chronological understanding
- Use blockquotes for primary source documents with context
- Include multiple perspectives and interpretations
- Connect past events to current issues and civic engagement
- Reference cause-and-effect relationships with clear formatting

ACADEMIC TONE REQUIREMENTS:
- Use educational terminology: "Let's examine," "Consider this evidence," "This demonstrates"
- Reference learning standards and curriculum alignment naturally
- Include academic vocabulary with clear explanations
- Mention prerequisites and knowledge building explicitly
- Connect to assessment preparation and study strategies
- Suggest parent/teacher discussion points when appropriate

AVOID GENERIC AI BEHAVIORS:
- No casual internet language or overly friendly tone
- Don't provide general life advice unrelated to academics
- Avoid responding like a search engine or entertainment tool
- Maintain professional educator voice, not buddy conversation
- Focus exclusively on educational content and academic skill development

Remember: Every response should look like a professionally designed textbook page with clear visual hierarchy, academic rigor, and engaging educational structure. Students should immediately recognize this as purpose-built educational content, not generic AI assistance.`;

async function* streamOpenAICompatResponse(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
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

  public async *generateStreamingResponse(messages: { role: string; content: string }[]): AsyncGenerator<string> {
    const userMessages = messages.map(m => ({ role: m.role, content: m.content }));

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
        yield* streamOpenAICompatResponse('https://open.bigmodel.cn/api/paas/v4/chat/completions', ZHIPU_API_KEY, 'glm-4-flash', userMessages);
        break;
      case 'mistral-small':
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        yield* streamOpenAICompatResponse('https://api.mistral.ai/v1/chat/completions', MISTRAL_API_KEY, 'mistral-small-latest', userMessages);
        break;
      case 'mistral-codestral':
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        yield* streamOpenAICompatResponse('https://api.mistral.ai/v1/chat/completions', MISTRAL_API_KEY, 'codestral-latest', userMessages);
        break;
      default:
        throw new Error('Invalid model selected.');
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
                return null; // Skip invalid questions
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
    const conversationText = conversation.messages.map(m => `${m.role === 'user' ? 'Q:' : 'A:'} ${m.content}`).join('\n\n');
    const quizPrompt = `You are an expert educator creating a comprehensive assessment quiz. Based on our learning conversation, create 5 thoughtful multiple-choice questions that test understanding, not just memorization.

**Educational Requirements:**
- Questions should assess comprehension, application, and analysis
- Include questions at different difficulty levels (recall, understanding, application)
- Make incorrect options plausible but clearly wrong
- Write clear, professional explanations that reinforce learning

**Format Requirements:**
Return JSON with "questions" array. Each question must have:
- "question": Clear, academically-written question
- "options": Array of exactly 4 answer choices
- "answer": The correct option (must match one of the 4 choices exactly)
- "explanation": Educational explanation of why this answer is correct and what concept it demonstrates

**Learning Conversation:**
${conversationText.slice(0, 8000)}

Create questions that help students solidify their understanding of the key concepts we discussed.`;

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
    
    // Get the current user's profile to extract the teacher_id
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
    
    const topicQuizPrompt = `You are an expert educator creating a high-quality assessment for high school students on the topic: "${topic}"

**Educational Standards:**
- Create 5 multiple-choice questions that assess different levels of learning
- Include questions that test: knowledge recall, comprehension, application, and analysis
- Align with appropriate grade-level academic standards
- Focus on concepts students need to master for academic success

**Question Quality Requirements:**
- Write clear, professional questions using academic language
- Create plausible distractors (wrong answers that seem reasonable)
- Test conceptual understanding, not just memorization
- Include real-world applications where appropriate
- Ensure questions are fair and unbiased

**Format Requirements:**
Return JSON with "questions" array. Each question object needs:
- "question": Professionally-written question with proper academic vocabulary
- "options": Exactly 4 answer choices (1 correct, 3 plausible distractors)
- "answer": The correct choice (must exactly match one of the 4 options)
- "explanation": Clear explanation that reinforces the learning objective

Focus on creating an assessment that helps students demonstrate mastery of key concepts and prepares them for advanced study in this subject area.`;

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

    // Save the generated quiz to the database
    const newQuizData = { teacher_id: teacherId, topic, questions };
    const savedQuiz = await db.createGeneratedQuiz(newQuizData);

    return savedQuiz;
  }
}

export const aiService = new AiService();
