/**
 * GenAI Gateway & Voice Services Module
 * Coordinates server-side Gemini API calls, Speech-to-Text, and Text-to-Speech narration.
 */

/**
 * Sends a chat message to the server-side API, passing the simulation state as context.
 * @param {string} message - User text query
 * @param {string} role - 'fan' | 'staff'
 * @param {string} lang - 'en' | 'es' | 'fr'
 * @param {object} simulationContext - Current live status of gates, incidents, etc.
 * @returns {Promise<object>} - Response payload containing the AI response
 */
export async function sendMessageToAI(message, role, lang, simulationContext) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        role,
        lang,
        simulationContext
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error('AI Communication failure:', error);
    return {
      reply: `⚠️ **System Connection Interruption:**\nCould not fetch response from the operations AI server. Please check your network and configuration. Details: ${error.message}`
    };
  }
}

/**
 * Reads text aloud using browser Web Speech API (Text-to-Speech).
 * @param {string} text - Plaintext to speak
 * @param {string} lang - Language code ('en', 'es', 'fr')
 */
export function speakResponse(text, lang) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any active speech first
  window.speechSynthesis.cancel();

  // Strip Markdown tags from text before speaking
  const cleanText = text
    .replace(/\*+/g, '')       // Remove bold stars
    .replace(/#+/g, '')        // Remove hash headers
    .replace(/[-•]+/g, '')     // Remove bullet dashes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links to raw text
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Map standard language codes to speech locales
  if (lang === 'es') {
    utterance.lang = 'es-ES';
  } else if (lang === 'fr') {
    utterance.lang = 'fr-FR';
  } else {
    utterance.lang = 'en-US';
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Initiates speech recognition (Speech-to-Text).
 * @param {function} onResult - Callback triggered when text is recognized. Receives transcript string.
 * @param {function} onEnd - Callback triggered when listening stops.
 * @param {function} onError - Callback triggered on error.
 * @returns {any} - The active recognition instance or null
 */
export function startVoiceRecognition(onResult, onEnd, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported in this browser.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US'; // default

  recognition.onresult = (event) => {
    if (event.results && event.results[0]) {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech Recognition error:', event.error);
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
  return recognition;
}
