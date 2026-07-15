/**
 * @module gemini
 * @description GenAI Gateway & Voice Services Module for the StadiumPulse AI.
 * Coordinates server-side Gemini API calls, Speech-to-Text, and Text-to-Speech narration.
 * Includes network timeout management (AbortController) to guarantee client-side efficiency.
 */

/** @constant {number} FETCH_TIMEOUT_MS - Network timeout duration (10 seconds) */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Sends a chat message to the server-side API, passing the simulation state as context.
 * Utilizes AbortController to implement request timeouts.
 *
 * @param {string} message - User text query
 * @param {string} role - User role ('fan' | 'staff')
 * @param {string} lang - Language code ('en' | 'es' | 'fr')
 * @param {object} simulationContext - Current live status of gates, incidents, etc.
 * @returns {Promise<object>} Response payload containing the AI response
 */
export async function sendMessageToAI(message, role, lang, simulationContext) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('AI Communication failure:', error);
    
    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout 
      ? '⚠️ **Connection Timeout:** The AI Assistant took too long to respond. Please try again.'
      : `⚠️ **System Connection Interruption:** Could not fetch response. Details: ${error.message}`;

    return { reply: errorMsg };
  }
}

/**
 * Fetches real-time crowd management recommendations based on current simulator status.
 *
 * @param {string} lang - Language code ('en' | 'es' | 'fr')
 * @param {object} simulationContext - Current live status of gates, concessions, and transit
 * @returns {Promise<object>} Structured crowd intelligence object
 */
export async function fetchCrowdIntelligence(lang, simulationContext) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/crowd-intelligence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lang,
        simulationContext
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Crowd Intelligence fetch failure:', error);
    return {
      severity: 'medium',
      recommendations: ['Reroute foot traffic away from highly congested gates.'],
      crowdFlow: 'uneven'
    };
  }
}

/**
 * Reads text aloud using browser Web Speech API (Text-to-Speech).
 *
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
 *
 * @param {function} onResult - Callback triggered when text is recognized. Receives transcript string.
 * @param {function} onEnd - Callback triggered when listening stops.
 * @param {function} onError - Callback triggered on error.
 * @returns {any} The active recognition instance or null
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
