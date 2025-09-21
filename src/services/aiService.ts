import { APISettings, Conversation, StudySession, QuizQuestion, GeneratedQuiz } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../supabase';
import * as db from './supabaseService';

// **FIX**: API keys are now read directly from environment variables.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

const systemPrompt = "IMPORTANT: You are an AI Tutor for students. Your responses MUST be strictly related to educational subjects. You must politely refuse any request that is inappropriate, non-academic, or asks for personal opinions. You are an expert AI Tutor named 'Tutor'. Your primary goal is to help users understand complex topics through clear, patient, and encouraging guidance. Break down complex subjects into smaller, digestible parts. Use simple language, analogies, and real-world examples to make concepts relatable. Maintain a positive, patient, and supportive tone at all times.";

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
    const prompt = `Based on the following conversation, create a multiple-choice quiz with 5 questions. Format the output as a single JSON object with a "questions" array. Each question must include: "question" (string), "options" (array of 4 strings), "answer" (the correct string from the options array), and "explanation" (string). Return ONLY valid JSON. Conversation: --- ${conversationText.slice(0, 8000)} ---`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
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
    
    const prompt = `You are an expert educator. Create a high-quality, multiple-choice quiz with 5 questions about the following topic: "${topic}". The questions should be challenging but fair for a high-school level student. Format the output as a single JSON object with a "questions" array. Each question object in the array must include: "question" (string), "options" (an array of exactly 4 strings), "answer" (the correct string from the options array), and a brief "explanation" (string) for the correct answer. Return ONLY the valid JSON object.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
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
