import { generateChatResponse } from "./openai";

export interface MemoryDecision {
  action: "auto_save" | "prompt_user" | "skip";
  reason: string;
  confidence: number;
}

export async function evaluateMemoryValue(
  userQuery: string,
  aiResponse: string,
  context: string
): Promise<MemoryDecision> {
  try {
    const evaluationPrompt = `
You are an intelligent memory system evaluator. Analyze the following conversation and decide whether to save it to long-term memory.

User Query: "${userQuery}"
AI Response: "${aiResponse}"
External Context Used: "${context}"

Evaluation Criteria:
1. AUTO_SAVE if response contains:
   - New factual information or learning
   - Successful problem-solving patterns
   - Important user corrections/feedback
   - Valuable insights or discoveries

2. PROMPT_USER if response contains:
   - Personal/sensitive information
   - Ambiguous but potentially valuable content
   - Complex reasoning that might be useful later

3. SKIP if response contains:
   - Basic greetings or casual conversation
   - Repeated/redundant information
   - Failed attempts or errors
   - Simple confirmations

Return JSON format: {"action": "auto_save|prompt_user|skip", "reason": "brief explanation", "confidence": 0.0-1.0}
    `;

    const evaluation = await generateChatResponse(evaluationPrompt);
    
    try {
      const result = JSON.parse(evaluation.content);
      
      // Validate the response format
      if (!["auto_save", "prompt_user", "skip"].includes(result.action)) {
        throw new Error("Invalid action");
      }
      
      return {
        action: result.action,
        reason: result.reason || "No reason provided",
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
      };
    } catch (parseError) {
      console.error("Failed to parse memory evaluation:", parseError);
      
      // Fallback logic based on content analysis
      return fallbackEvaluation(userQuery, aiResponse, context);
    }
  } catch (error) {
    console.error("Memory evaluation failed:", error);
    return fallbackEvaluation(userQuery, aiResponse, context);
  }
}

function fallbackEvaluation(
  userQuery: string,
  aiResponse: string,
  context: string
): MemoryDecision {
  const queryLower = userQuery.toLowerCase();
  const responseLower = aiResponse.toLowerCase();
  
  // Auto-save indicators
  const autoSavePatterns = [
    /how to|tutorial|steps|guide|instructions/,
    /solve|solution|fix|resolve/,
    /learn|understand|explain/,
    /important|crucial|critical|key/,
    /remember|note|tip|advice/
  ];
  
  // Skip indicators
  const skipPatterns = [
    /hello|hi|hey|thanks|thank you|bye|goodbye/,
    /yes|no|ok|okay|sure|fine/,
    /^.{1,20}$/ // Very short responses
  ];
  
  // Prompt user indicators
  const promptPatterns = [
    /personal|private|sensitive|confidential/,
    /password|secret|key|token/,
    /my|mine|yourself|your/
  ];
  
  // Check for auto-save patterns
  if (autoSavePatterns.some(pattern => pattern.test(queryLower + " " + responseLower))) {
    return {
      action: "auto_save",
      reason: "Contains valuable learning or problem-solving content",
      confidence: 0.8
    };
  }
  
  // Check for skip patterns
  if (skipPatterns.some(pattern => pattern.test(queryLower + " " + responseLower))) {
    return {
      action: "skip",
      reason: "Basic conversation or very short response",
      confidence: 0.9
    };
  }
  
  // Check for prompt user patterns
  if (promptPatterns.some(pattern => pattern.test(queryLower + " " + responseLower))) {
    return {
      action: "prompt_user",
      reason: "May contain personal or sensitive information",
      confidence: 0.7
    };
  }
  
  // Default to prompt user for medium-length, potentially valuable content
  if (aiResponse.length > 100 && context.length > 0) {
    return {
      action: "prompt_user",
      reason: "Substantial response with external context - user should decide",
      confidence: 0.6
    };
  }
  
  return {
    action: "skip",
    reason: "No clear value indicators found",
    confidence: 0.5
  };
}