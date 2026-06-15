export type ScoreInput = {
  earnedPoints: number;
};

export type ScoredAnswer = {
  earnedPoints: number;
  isCorrect: boolean;
};

export type ScoringOption = {
  id: string;
  content: string;
  isCorrect: boolean;
};

export type ScoringQuestion = {
  points: number;
  options: ScoringOption[];
};

type TrueFalseChoice = {
  optionId: string;
  choice: boolean;
};

export function sumScore(answers: ScoreInput[]) {
  return answers.reduce((total, answer) => total + answer.earnedPoints, 0);
}

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function scoreMcqAnswer(question: ScoringQuestion, selectedOptionId: string | null | undefined): ScoredAnswer {
  const correctOption = question.options.find((option) => option.isCorrect);
  const isCorrect = Boolean(correctOption && selectedOptionId === correctOption.id);

  return {
    earnedPoints: isCorrect ? question.points : 0,
    isCorrect
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTrueFalseChoices(textAnswer: string | null | undefined): TrueFalseChoice[] | null {
  if (!textAnswer) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(textAnswer);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const choices: TrueFalseChoice[] = [];

    for (const item of parsed) {
      if (!isRecord(item) || typeof item.optionId !== "string" || typeof item.choice !== "boolean") {
        return null;
      }

      choices.push({
        optionId: item.optionId,
        choice: item.choice
      });
    }

    return choices;
  } catch {
    return null;
  }
}

export function scoreTrueFalseAnswer(question: ScoringQuestion, textAnswer: string | null | undefined): ScoredAnswer {
  const choices = parseTrueFalseChoices(textAnswer);

  if (!choices || choices.length !== 4 || question.options.length !== 4) {
    return { earnedPoints: 0, isCorrect: false };
  }

  const optionsById = new Map(question.options.map((option) => [option.id, option]));
  const answeredOptionIds = new Set<string>();
  let correctChoices = 0;

  for (const answer of choices) {
    const option = optionsById.get(answer.optionId);

    if (!option || answeredOptionIds.has(answer.optionId)) {
      return { earnedPoints: 0, isCorrect: false };
    }

    answeredOptionIds.add(answer.optionId);

    if (answer.choice === option.isCorrect) {
      correctChoices += 1;
    }
  }

  return {
    earnedPoints: question.points * trueFalseScoreRatio(correctChoices),
    isCorrect: correctChoices === 4
  };
}

function trueFalseScoreRatio(correctChoices: number) {
  switch (correctChoices) {
    case 1:
      return 0.1;
    case 2:
      return 0.25;
    case 3:
      return 0.5;
    case 4:
      return 1;
    default:
      return 0;
  }
}

export function scoreShortAnswer(question: ScoringQuestion, textAnswer: string | null | undefined): ScoredAnswer {
  if (!textAnswer) {
    return { earnedPoints: 0, isCorrect: false };
  }

  const normalizedStudentAnswer = normalizeText(textAnswer);
  const acceptedAnswers = new Set(
    question.options.filter((option) => option.isCorrect).map((option) => normalizeText(option.content))
  );
  const isCorrect = acceptedAnswers.has(normalizedStudentAnswer);

  return {
    earnedPoints: isCorrect ? question.points : 0,
    isCorrect
  };
}
