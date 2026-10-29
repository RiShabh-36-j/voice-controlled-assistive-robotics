/**
 * Web Speech API Voice Recognition & Speech Synthesis (TTS) Controller
 * Features:
 * - Robust Speech-to-Text via SpeechRecognition / webkitSpeechRecognition
 * - Graceful fallback to text-input command pipeline
 * - Permission error diagnostics & browser compatibility detection
 * - Assistive Voice Feedback (Text-to-Speech) with Mute toggle
 * - Simulated & Real Microphone Audio Visualizer
 */

class SpeechController {
  constructor(options = {}) {
    this.onTranscript = options.onTranscript || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});

    // State
    this.isListening = false;
    this.isSupported = false;
    this.isMuted = false;
    this.recognition = null;
    this.synthesis = window.speechSynthesis || null;

    // Audio Visualizer tracking
    this.visualizerCanvas = null;
    this.visualizerCtx = null;
    this.visualizerAnimId = null;
    this.audioWavePhase = 0;

    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not natively supported by this browser. Text-command input fallback is enabled.');
      this.isSupported = false;
      this.onStatusChange({
        supported: false,
        state: 'UNSUPPORTED',
        message: 'Web Speech API unavailable in this browser. Use Text Command input below.'
      });
      return;
    }

    this.isSupported = true;
    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false; // Single command per push-to-talk (more reliable for robotics)
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.startVisualizer();
        this.onStatusChange({
          supported: true,
          state: 'LISTENING',
          message: 'Listening for voice command... (e.g. "Move forward", "Bring medicine")'
        });
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const transcript = finalTranscript || interimTranscript;
        const isFinal = Boolean(finalTranscript);

        this.onTranscript({
          transcript: transcript.trim(),
          isFinal: isFinal,
          confidence: event.results[0] ? event.results[0][0].confidence : 0.9
        });
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        this.stopVisualizer();

        let friendlyError = 'Speech recognition error occurred.';
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            friendlyError = 'Microphone permission was denied. Please allow microphone access in your browser address bar.';
            break;
          case 'no-speech':
            friendlyError = 'No speech detected. Please speak closer to your microphone or try text input.';
            break;
          case 'audio-capture':
            friendlyError = 'No microphone device was found or audio capture failed.';
            break;
          case 'network':
            friendlyError = 'Network error during speech recognition. Ensure an active internet connection for Web Speech API, or use Text Input.';
            break;
          default:
            friendlyError = `Speech recognition error: ${event.error}`;
        }

        this.onStatusChange({
          supported: true,
          state: 'ERROR',
          message: friendlyError
        });
        this.onError(friendlyError, event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.stopVisualizer();
        this.onStatusChange({
          supported: true,
          state: 'STANDBY',
          message: 'Microphone Standby. Press microphone button or enter text command.'
        });
      };

    } catch (err) {
      console.error('Failed to initialize SpeechRecognition:', err);
      this.isSupported = false;
    }
  }

  /**
   * Start microphone listening
   */
  startListening() {
    if (!this.isSupported || !this.recognition) {
      this.onStatusChange({
        supported: false,
        state: 'UNSUPPORTED',
        message: 'Speech recognition is not supported in this browser. Please use text commands.'
      });
      return false;
    }

    if (this.isListening) {
      this.stopListening();
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.warn('SpeechRecognition start failed (might be already active):', err);
      return false;
    }
  }

  /**
   * Stop microphone listening
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('SpeechRecognition stop error:', err);
      }
    }
    this.isListening = false;
    this.stopVisualizer();
  }

  /**
   * Voice synthesis (Robot TTS verbal confirmation)
   */
  speak(text) {
    if (this.isMuted || !this.synthesis || !text) return;

    try {
      // Cancel previous utterances to avoid speech backlog
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;

      // Select an English voice if available
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Zira')));
      if (preferredVoice) utterance.voice = preferredVoice;

      this.synthesis.speak(utterance);
    } catch (err) {
      console.warn('Text-to-speech error:', err);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.synthesis) {
      this.synthesis.cancel();
    }
    return this.isMuted;
  }

  /**
   * Bind audio wave visualizer canvas
   */
  attachVisualizer(canvasElement) {
    this.visualizerCanvas = canvasElement;
    if (this.visualizerCanvas) {
      this.visualizerCtx = this.visualizerCanvas.getContext('2d');
      this.drawIdleVisualizer();
    }
  }

  startVisualizer() {
    if (!this.visualizerCanvas || !this.visualizerCtx) return;
    cancelAnimationFrame(this.visualizerAnimId);

    const renderWave = () => {
      this.audioWavePhase += 0.15;
      const ctx = this.visualizerCtx;
      const w = this.visualizerCanvas.width;
      const h = this.visualizerCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // Draw multi-bar animated audio visualizer
      const bars = 18;
      const barWidth = 4;
      const spacing = (w - (bars * barWidth)) / (bars - 1);

      for (let i = 0; i < bars; i++) {
        const heightMultiplier = Math.sin(this.audioWavePhase + i * 0.4) * 0.5 + 0.5;
        const barHeight = Math.max(4, heightMultiplier * (h - 6));
        const x = i * (barWidth + spacing);
        const y = (h - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#3b82f6');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (this.isListening) {
        this.visualizerAnimId = requestAnimationFrame(renderWave);
      } else {
        this.drawIdleVisualizer();
      }
    };

    renderWave();
  }

  stopVisualizer() {
    cancelAnimationFrame(this.visualizerAnimId);
    this.drawIdleVisualizer();
  }

  drawIdleVisualizer() {
    if (!this.visualizerCanvas || !this.visualizerCtx) return;
    const ctx = this.visualizerCtx;
    const w = this.visualizerCanvas.width;
    const h = this.visualizerCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const bars = 18;
    const barWidth = 4;
    const spacing = (w - (bars * barWidth)) / (bars - 1);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    for (let i = 0; i < bars; i++) {
      const x = i * (barWidth + spacing);
      const y = (h - 4) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, 4, 2);
      ctx.fill();
    }
  }
}
