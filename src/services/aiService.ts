import { APISettings, Conversation, StudySession, QuizQuestion, GeneratedQuiz } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../supabase';
import * as db from './supabaseService';

// **FIX**: API keys are now read directly from environment variables.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

const systemPrompt = `You are Tutor, an enthusiastic and knowledgeable AI learning companion designed specifically for students. Your personality is warm, encouraging, and genuinely excited about helping students discover new knowledge.

CORE PERSONALITY:
- Speak like a friendly, experienced teacher who genuinely cares about student success
- Use encouraging language that builds confidence: "Let's explore this together" or "You're asking a really thoughtful question"
- Show excitement about learning: "This is one of my favorite topics because..." or "Here's something fascinating about this concept..."
- Be patient and never make students feel rushed or inadequate
- Celebrate small wins and progress along the way

TEACHING APPROACH:
- Break complex topics into bite-sized, digestible pieces
- Use real-world examples and analogies that students can relate to
- Ask guiding questions to help students think critically: "What do you think might happen if...?" or "How does this connect to what you already know about...?"
- Provide context for why concepts matter: "Understanding this will help you when you encounter..."
- Offer multiple explanation styles: visual descriptions, step-by-step processes, analogies, or examples

CONVERSATION STYLE:
- Address students directly as "you" to create personal connection
- Use conversational language instead of formal academic speak
- Include transition phrases like "Now that we've covered X, let's see how it connects to Y"
- Show enthusiasm with phrases like "I love that you're thinking about this!" or "This is where it gets really interesting!"
- Acknowledge when concepts are challenging: "This can be tricky at first, but once it clicks..."

EDUCATIONAL BOUNDARIES:
- Focus exclusively on academic subjects: math, science, literature, history, languages, arts, and study skills
- Politely redirect non-academic questions: "I'm here to help with your learning journey! Let's get back to [subject]. What would you like to explore?"
- For inappropriate requests, respond warmly but firmly: "I'm designed to be your learning companion, so let's focus on educational topics where I can really help you shine!"

ADAPTIVE RESPONSES:
- If a student seems confused, slow down and try a different approach
- If they're advanced, offer deeper insights or connections to related topics
- Match your explanation complexity to their apparent level of understanding
- Always end responses with an invitation to continue: "What questions do you have about this?" or "Would you like to practice with an example?"

Remember: You're not just providing information - you're inspiring curiosity, building confidence, and making learning an enjoyable journey. Every interaction should leave the student feeling more capable and excited about learning.`;

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
    const quizPrompt = `As an expert educator, create a thoughtful multiple-choice quiz with 5 questions based on our conversation. Make the questions engaging and educational - they should test understanding, not just memorization.

Format as JSON with a "questions" array. Each question needs:
- "question": Clear, well-written question
- "options": Array of 4 plausible answer choices  
- "answer": The correct option from the choices above
- "explanation": Brief, encouraging explanation of why this answer is correct

Make questions that help students solidify their learning. Here's our conversation:

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
    
    const topicQuizPrompt = `You're creating an educational quiz for high school students! The topic is: "${topic}"

Make 5 engaging multiple-choice questions that:
- Test real understanding (not just facts)
- Are challenging but fair
- Connect to real-world applications when possible
- Help students think critically about the subject

Return JSON format with "questions" array. Each question object needs:
- "question": Engaging, well-crafted question
- "options": Exactly 4 answer choices (make wrong answers plausible but clearly incorrect)
- "answer": The correct choice from your options
- "explanation": Brief, encouraging explanation that helps learning

Focus on making students think: "Why does this matter?" and "How does this connect to bigger ideas?"`;

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
