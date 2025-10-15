import { APISettings, Conversation, StudySession, QuizQuestion, GeneratedQuiz } from '../types';
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

// Token estimation functions
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is approximate; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

async function* streamOpenAICompatResponse(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): AsyncGenerator<{ chunk: string; tokenData?: { input: number; output: number } }> {
  const messagesWithSystemPrompt = [{ role: 'system', content: systemPrompt }, ...messages];
  
  // Estimate input tokens
  const inputTokens = estimateTokens(
    systemPrompt + messages.map(m => m.content).join('')
  );
  
  let outputText = '';
  
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
        if (data.trim() === '[DONE]') {
          // Calculate output tokens
          const outputTokens = estimateTokens(outputText);
          yield { 
            chunk: '', 
            tokenData: { input: inputTokens, output: outputTokens } 
          };
          return;
        }
        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) {
            outputText += chunk;
            yield { chunk };
          }
        } catch (e) { 
          console.error('Error parsing stream chunk:', e, 'Raw data:', data); 
        }
      }
    }
  }
  
  // Final token calculation
  const outputTokens = estimateTokens(outputText);
  yield { 
    chunk: '', 
    tokenData: { input: inputTokens, output: outputTokens } 
  };
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
    userId: string,
    messageId: string
  ): AsyncGenerator<{ chunk: string; tokenData?: { input: number; output: number; total: number } }> {
    const userMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const systemPrompt = await this.generatePersonalizedSystemPrompt(userId);
    
    let finalTokenData: { input: number; output: number; total: number } | undefined;
    
    const recordAndFinalize = async (data: { input: number; output: number; total: number }) => {
      finalTokenData = data;
      try {
        await db.recordTokenUsage({
          user_id: userId,
          message_id: messageId,
          model: this.settings.selectedModel,
          input_tokens: data.input,
          output_tokens: data.output,
          total_tokens: data.total
        });
        console.log('Token usage recorded successfully for message:', messageId);
      } catch (error) {
        console.error('Failed to record token usage:', error);
      }
    };
    
    switch (this.settings.selectedModel) {
      case 'google': {
        if (!GOOGLE_API_KEY) throw new Error('Google API key is not configured on the server.');
        // *** UPDATED MODEL NAME AS PER YOUR REQUEST ***
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`;
        
        const inputTokens = estimateTokens(systemPrompt + userMessages.map(m => m.content).join(''));
        let outputText = '';
        
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
                
                const usageMetadata = json.usageMetadata;
                if (usageMetadata) {
                   await recordAndFinalize({
                    input: usageMetadata.promptTokenCount || inputTokens,
                    output: usageMetadata.candidatesTokenCount || estimateTokens(outputText),
                    total: usageMetadata.totalTokenCount || (inputTokens + estimateTokens(outputText))
                  });
                }
                
                if (chunk) {
                  outputText += chunk;
                  yield { chunk };
                }
              } catch (e) { 
                console.error('Error parsing Google stream:', e); 
              }
            }
          }
        }
        
        if (!finalTokenData) {
          const outputTokens = estimateTokens(outputText);
           await recordAndFinalize({
            input: inputTokens,
            output: outputTokens,
            total: inputTokens + outputTokens
          });
        }
        break;
      }
      
      case 'zhipu': {
        if (!ZHIPU_API_KEY) throw new Error('ZhipuAI API key is not configured on the server.');
        const stream = streamOpenAICompatResponse(
          'https://open.bigmodel.cn/api/paas/v4/chat/completions', 
          ZHIPU_API_KEY, 
          'glm-4-flash', 
          userMessages, 
          systemPrompt
        );
        for await (const result of stream) {
          if (result.tokenData) {
            await recordAndFinalize({
              input: result.tokenData.input,
              output: result.tokenData.output,
              total: result.tokenData.input + result.tokenData.output
            });
          } else {
            yield { chunk: result.chunk };
          }
        }
        break;
      }
      
      case 'mistral-small': {
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        const stream = streamOpenAICompatResponse(
          'https://api.mistral.ai/v1/chat/completions', 
          MISTRAL_API_KEY, 
          'mistral-small-latest', 
          userMessages, 
          systemPrompt
        );
        for await (const result of stream) {
          if (result.tokenData) {
            await recordAndFinalize({
              input: result.tokenData.input,
              output: result.tokenData.output,
              total: result.tokenData.input + result.tokenData.output
            });
          } else {
            yield { chunk: result.chunk };
          }
        }
        break;
      }
      
      case 'mistral-codestral': {
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key is not configured on the server.');
        const stream = streamOpenAICompatResponse(
          'https://api.mistral.ai/v1/chat/completions', 
          MISTRAL_API_KEY, 
          'codestral-latest', 
          userMessages, 
          systemPrompt
        );
        for await (const result of stream) {
          if (result.tokenData) {
            await recordAndFinalize({
              input: result.tokenData.input,
              output: result.tokenData.output,
              total: result.tokenData.input + result.tokenData.output
            });
          } else {
            yield { chunk: result.chunk };
          }
        }
        break;
      }
      
      default:
        throw new Error('Invalid model selected.');
    }

    if (finalTokenData) {
      yield { chunk: '', tokenData: finalTokenData };
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
    // *** UPDATED MODEL NAME AS PER YOUR REQUEST ***
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
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
    // *** UPDATED MODEL NAME AS PER YOUR REQUEST ***
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
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
