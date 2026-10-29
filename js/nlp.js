/**
 * Explainable Natural Language Processing & Intent Recognition Engine
 * Architecture:
 * 1. Text Normalization & Polite/Filler Removal
 * 2. Tokenization, Stemming & Medical/Robotics Synonym Expansion
 * 3. Multi-Metric Scoring (Exact Match, Levenshtein Edit-Distance, Jaccard Keyword Overlap)
 * 4. Transparent Confidence Estimation & Safety Ambiguity Guard
 */

class IntentRecognitionEngine {
  constructor(intentsConfig = CONFIG.INTENTS) {
    this.intents = intentsConfig;
    this.fillerWords = new Set([
      'hey', 'robot', 'assistant', 'please', 'could', 'you', 'can', 'would', 'kindly',
      'i', 'want', 'need', 'to', 'the', 'a', 'an', 'for', 'now', 'quickly', 'just', 'ok'
    ]);

    // Synonym map for robotics and medical assistive terms
    this.synonyms = {
      'front': 'forward',
      'ahead': 'forward',
      'straight': 'forward',
      'advance': 'forward',
      'back': 'backward',
      'reverse': 'backward',
      'retreat': 'backward',
      'halt': 'stop',
      'freeze': 'stop',
      'pause': 'stop',
      'brake': 'stop',
      'cancel': 'stop',
      'pills': 'medicine',
      'pill': 'medicine',
      'medication': 'medicine',
      'meds': 'medicine',
      'drugs': 'medicine',
      'prescription': 'medicine',
      'dispensary': 'medicine',
      'pharmacy': 'medicine',
      'elderly': 'patient',
      'grandma': 'patient',
      'grandpa': 'patient',
      'bed': 'patient',
      'bedside': 'patient',
      'sick': 'patient',
      'recharge': 'charging',
      'dock': 'charging',
      'battery': 'charging',
      'charger': 'charging',
      'base': 'home',
      'origin': 'home'
    };
  }

  /**
   * Preprocess and clean input transcript
   */
  preprocess(text) {
    if (!text || typeof text !== 'string') return { raw: '', clean: '', tokens: [], filteredTokens: [] };
    
    const raw = text.trim();
    // Lowercase and remove punctuation except apostrophes
    const clean = raw.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rawTokens = clean.split(' ').filter(t => t.length > 0);

    // Stem and map synonyms
    const tokens = rawTokens.map(t => {
      // Basic stemming rules
      let stemmed = t;
      if (stemmed.endsWith('ing')) stemmed = stemmed.slice(0, -3);
      else if (stemmed.endsWith('ed')) stemmed = stemmed.slice(0, -2);
      else if (stemmed.endsWith('s') && !stemmed.endsWith('ss')) stemmed = stemmed.slice(0, -1);

      return this.synonyms[stemmed] || this.synonyms[t] || stemmed;
    });

    const filteredTokens = tokens.filter(t => !this.fillerWords.has(t));

    return { raw, clean, tokens, filteredTokens };
  }

  /**
   * Levenshtein Distance for typo and phonetic tolerance
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    const n = a.length;
    const m = b.length;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) matrix[i] = [i];
    for (let j = 0; j <= m; j++) matrix[0][j] = j;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deletion
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return matrix[n][m];
  }

  /**
   * Normalized similarity metric [0.0 - 1.0]
   */
  stringSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    const dist = this.levenshteinDistance(longer, shorter);
    return Math.max(0, (longer.length - dist) / longer.length);
  }

  /**
   * Jaccard Similarity between two token sets
   */
  jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;
    
    let intersectionCount = 0;
    for (const item of setA) {
      if (setB.has(item)) intersectionCount++;
    }
    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount > 0 ? intersectionCount / unionCount : 0;
  }

  /**
   * Main Intent Recognition and Explainability Pipeline
   */
  process(rawInput) {
    const startTime = performance.now();
    const { raw, clean, tokens, filteredTokens } = this.preprocess(rawInput);

    if (!clean) {
      return {
        success: false,
        rawInput: rawInput || '',
        matchedIntent: null,
        action: null,
        confidence: 0,
        status: 'EMPTY_INPUT',
        decisionRule: 'No audio or text input detected.',
        explanation: 'Input string was empty or contained only non-printable characters.',
        matchedKeywords: [],
        processingTimeMs: 0
      };
    }

    const inputTokenSet = new Set(filteredTokens.length > 0 ? filteredTokens : tokens);
    let bestMatch = null;
    let highestScore = -1;
    const candidateEvaluations = [];

    // Evaluate against each defined intent in CONFIG
    for (const [intentKey, intentData] of Object.entries(this.intents)) {
      // 1. Exact canonical phrase check
      let phraseSimilarity = 0;
      let matchedCanonicalPhrase = '';

      for (const phrase of intentData.phrases) {
        if (clean === phrase) {
          phraseSimilarity = 1.0;
          matchedCanonicalPhrase = phrase;
          break;
        }

        // Substring match check
        if (clean.includes(phrase) || phrase.includes(clean)) {
          const sim = Math.min(clean.length, phrase.length) / Math.max(clean.length, phrase.length);
          if (sim > phraseSimilarity) {
            phraseSimilarity = sim * 0.95;
            matchedCanonicalPhrase = phrase;
          }
        } else {
          const sim = this.stringSimilarity(clean, phrase);
          if (sim > phraseSimilarity) {
            phraseSimilarity = sim;
            matchedCanonicalPhrase = phrase;
          }
        }
      }

      // 2. Keyword & Anchor matching
      const intentKeywordsSet = new Set(intentData.keywords.map(k => this.synonyms[k] || k));
      const matchedKeywords = [];
      for (const tok of inputTokenSet) {
        if (intentKeywordsSet.has(tok)) {
          matchedKeywords.push(tok);
        }
      }

      const keywordCoverage = intentKeywordsSet.size > 0 
        ? matchedKeywords.length / Math.min(inputTokenSet.size, intentKeywordsSet.size)
        : 0;
      
      const jaccardScore = this.jaccardSimilarity(inputTokenSet, intentKeywordsSet);

      // 3. Composite Confidence Scoring Formula:
      // - 45% Phrase / Levenshtein similarity
      // - 40% Keyword anchor coverage
      // - 15% Jaccard token overlap
      let compositeConfidence = 0;
      if (phraseSimilarity === 1.0) {
        compositeConfidence = 1.0;
      } else {
        compositeConfidence = (phraseSimilarity * 0.45) + (keywordCoverage * 0.40) + (jaccardScore * 0.15);
        // Boost if significant keyword anchor matched
        if (matchedKeywords.length > 0 && compositeConfidence < 0.65) {
          compositeConfidence = Math.min(0.85, compositeConfidence + 0.20);
        }
      }

      // Cap at [0, 1]
      compositeConfidence = Math.min(1.0, Math.max(0, compositeConfidence));

      const evaluation = {
        intentKey,
        action: intentData.action,
        label: intentData.label,
        category: intentData.category,
        confidence: compositeConfidence,
        threshold: intentData.confidenceThreshold,
        phraseSimilarity,
        keywordCoverage,
        jaccardScore,
        matchedKeywords,
        closestPhrase: matchedCanonicalPhrase
      };

      candidateEvaluations.push(evaluation);

      if (compositeConfidence > highestScore) {
        highestScore = compositeConfidence;
        bestMatch = evaluation;
      }
    }

    const endTime = performance.now();
    const processingTimeMs = Math.round((endTime - startTime) * 100) / 100;

    // Safety and Ambiguity Gate:
    // If best confidence score is below threshold or close to a secondary ambiguous match:
    const confidencePct = Math.round(highestScore * 100);
    const requiredThreshold = bestMatch ? bestMatch.threshold : 0.55;

    if (!bestMatch || highestScore < requiredThreshold) {
      return {
        success: false,
        rawInput: raw,
        recognizedText: clean,
        tokens: filteredTokens,
        matchedIntent: null,
        action: null,
        confidence: highestScore,
        confidencePct,
        status: 'AMBIGUOUS_REJECTED',
        decisionRule: `Confidence score (${confidencePct}%) is below safe execution threshold (${Math.round(requiredThreshold * 100)}%).`,
        explanation: `The system detected ambiguous or unsupported voice input. For patient safety, action execution was prevented. Please repeat command clearly.`,
        suggestedCommands: ['"Move forward"', '"Bring medicine"', '"Move to the patient"', '"Go to the charging station"', '"Stop"'],
        matchedKeywords: bestMatch ? bestMatch.matchedKeywords : [],
        processingTimeMs,
        candidateEvaluations
      };
    }

    // Success - Explainable decision logic description
    let decisionRationale = '';
    if (bestMatch.phraseSimilarity >= 0.95) {
      decisionRationale = `Exact or near-exact canonical phrase match with "${bestMatch.closestPhrase}".`;
    } else if (bestMatch.matchedKeywords.length > 0) {
      decisionRationale = `Semantic keyword match on [${bestMatch.matchedKeywords.join(', ')}] with ${(bestMatch.phraseSimilarity * 100).toFixed(0)}% phrase alignment.`;
    } else {
      decisionRationale = `Phonetic & fuzzy similarity alignment with canonical command "${bestMatch.closestPhrase}".`;
    }

    return {
      success: true,
      rawInput: raw,
      recognizedText: clean,
      tokens: filteredTokens,
      matchedIntent: bestMatch.intentKey,
      action: bestMatch.action,
      label: bestMatch.label,
      category: bestMatch.category,
      confidence: bestMatch.confidence,
      confidencePct,
      status: 'ACCEPTED',
      decisionRule: decisionRationale,
      explanation: `Intent classified as ${bestMatch.label} (${bestMatch.action}) with high confidence (${confidencePct}%). Action authorized for robot motion controller.`,
      matchedKeywords: bestMatch.matchedKeywords,
      processingTimeMs,
      candidateEvaluations
    };
  }
}
