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
    if (selectedAnswers[questionIndex] !== undefined) return;

    const newAnswers = { ...selectedAnswers, [questionIndex]: optionIndex };
    setSelectedAnswers(newAnswers);

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
          container: 'bg-gray-900 border-gray-800',
          title: 'text-white', // #FFFFFF
          card: 'bg-gray-800 border-gray-700',
          text: 'text-gray-50', // #F9FAFB
          optionBase: 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-indigo-300',
        };
      case Theme.CREAM:
        return {
          container: 'bg-[#FDFBF7] border-amber-100',
          title: 'text-amber-900',
          card: 'bg-white border-amber-100 shadow-sm',
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
          container: 'bg-slate-50 border-slate-100',
          title: 'text-slate-800',
          card: 'bg-white border-slate-200 shadow-sm',
          text: 'text-slate-800',
          optionBase: 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:bg-blue-50',
        };
    }
  };

  const styles = getThemeStyles();

  return (
    <div className={`rounded-3xl p-6 md:p-8 border ${styles.container} transition-colors duration-300`}>
      <div className="flex items-center gap-3 mb-8">
        <div className={`p-2.5 rounded-xl ${theme === Theme.DARK ? 'bg-indigo-600 text-white' : 'bg-primary text-white'} shadow-lg shadow-blue-200/50`}>
          {showConfetti ? <Trophy className="w-5 h-5 animate-bounce" /> : <HelpCircle className="w-5 h-5" />}
        </div>
        <div>
          <h3 className={`text-lg font-bold ${styles.title}`}>Comprehension Check</h3>
          <p className={`text-xs font-medium opacity-60 ${styles.text}`}>Test your understanding</p>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((q, qIndex) => {
          const userSelection = selectedAnswers[qIndex];
          const isAnswered = userSelection !== undefined;
          const isCorrect = userSelection === q.correctAnswerIndex;

          return (
            <div key={qIndex} className={`p-6 rounded-2xl border ${styles.card}`}>
              <p className={`font-bold mb-4 text-base ${styles.text}`}>
                <span className={`mr-2 ${theme === Theme.DARK ? 'text-indigo-400' : 'text-primary'}`}>Q{qIndex + 1}.</span>
                {q.question}
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {q.options.map((option, optIndex) => {
                  let optionClass = `w-full text-left px-4 py-3 rounded-xl border-2 transition-all relative font-medium text-sm `;
                  
                  if (isAnswered) {
                    if (optIndex === q.correctAnswerIndex) {
                      optionClass += "bg-green-500/10 border-green-500 text-green-600";
                    } else if (optIndex === userSelection) {
                      optionClass += "bg-red-500/10 border-red-500 text-red-600";
                    } else {
                      optionClass += "opacity-50 border-transparent bg-transparent";
                    }
                  } else {
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
                        <span>{option}</span>
                        {isAnswered && optIndex === q.correctAnswerIndex && (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        {isAnswered && optIndex === userSelection && optIndex !== q.correctAnswerIndex && (
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};