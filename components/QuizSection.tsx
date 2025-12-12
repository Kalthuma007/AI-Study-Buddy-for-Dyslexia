import React, { useState } from 'react';
import { QuizQuestion, Theme } from '../types';
import { CheckCircle2, XCircle, HelpCircle, Trophy } from 'lucide-react';

interface QuizSectionProps {
  questions: QuizQuestion[];
  theme: Theme;
}

export const QuizSection: React.FC<QuizSectionProps> = ({ questions, theme }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showConfetti, setShowConfetti] = useState(false);

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    // Prevent changing answer once selected
    if (selectedAnswers[questionIndex] !== undefined) return;

    const newAnswers = { ...selectedAnswers, [questionIndex]: optionIndex };
    setSelectedAnswers(newAnswers);

    // Check if all correct
    const allAnswered = questions.length === Object.keys(newAnswers).length;
    if (allAnswered) {
      const allCorrect = questions.every((q, idx) => newAnswers[idx] === q.correctAnswerIndex);
      if (allCorrect) setShowConfetti(true);
    }
  };

  const getThemeStyles = () => {
    switch (theme) {
      case Theme.DARK:
        return {
          container: 'bg-slate-800 border-slate-700',
          title: 'text-slate-100',
          card: 'bg-slate-900 border-slate-700',
          text: 'text-slate-200',
          optionBase: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700',
        };
      case Theme.CREAM:
        return {
          container: 'bg-[#FDFBF7] border-amber-100',
          title: 'text-amber-900',
          card: 'bg-white border-amber-100/50 shadow-sm',
          text: 'text-slate-800',
          optionBase: 'bg-[#FDFBF7] border-amber-200 text-slate-700 hover:border-amber-400',
        };
      case Theme.SOFT_BLUE:
        return {
          container: 'bg-[#EDF2F7] border-blue-100',
          title: 'text-slate-800',
          card: 'bg-white border-blue-100 shadow-sm',
          text: 'text-slate-800',
          optionBase: 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300',
        };
      default:
        return {
          container: 'bg-slate-50 border-slate-200',
          title: 'text-slate-800',
          card: 'bg-white border-slate-200 shadow-sm',
          text: 'text-slate-800',
          optionBase: 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-slate-50',
        };
    }
  };

  const styles = getThemeStyles();

  return (
    <div className={`rounded-3xl p-6 md:p-8 border ${styles.container} transition-colors duration-300`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-xl ${theme === Theme.DARK ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
          {showConfetti ? <Trophy className="w-6 h-6 animate-bounce" /> : <HelpCircle className="w-6 h-6" />}
        </div>
        <div>
          <h3 className={`text-xl font-bold ${styles.title}`}>Comprehension Check</h3>
          <p className={`text-sm opacity-70 ${styles.text}`}>Test your understanding of the text.</p>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((q, qIndex) => {
          const userSelection = selectedAnswers[qIndex];
          const isAnswered = userSelection !== undefined;
          const isCorrect = userSelection === q.correctAnswerIndex;

          return (
            <div key={qIndex} className={`p-5 rounded-2xl border ${styles.card}`}>
              <p className={`font-semibold mb-4 text-lg ${styles.text}`}>
                <span className="opacity-50 mr-2">{qIndex + 1}.</span>
                {q.question}
              </p>

              <div className="grid grid-cols-1 gap-3">
                {q.options.map((option, optIndex) => {
                  let optionClass = `w-full text-left p-4 rounded-xl border-2 transition-all relative `;
                  
                  if (isAnswered) {
                    if (optIndex === q.correctAnswerIndex) {
                      // Correct Answer Style
                      optionClass += "bg-green-50 border-green-500 text-green-800";
                    } else if (optIndex === userSelection) {
                      // Wrong Selection Style
                      optionClass += "bg-red-50 border-red-400 text-red-800";
                    } else {
                      // Other unselected options
                      optionClass += "opacity-50 border-transparent bg-transparent";
                    }
                  } else {
                    // Default State
                    optionClass += styles.optionBase;
                  }

                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleSelect(qIndex, optIndex)}
                      disabled={isAnswered}
                      className={optionClass}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{option}</span>
                        {isAnswered && optIndex === q.correctAnswerIndex && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        {isAnswered && optIndex === userSelection && optIndex !== q.correctAnswerIndex && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {isAnswered && (
                <div className={`mt-3 text-sm font-bold flex items-center gap-2 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                  {isCorrect ? 'Correct!' : 'Incorrect. The correct answer is highlighted.'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};