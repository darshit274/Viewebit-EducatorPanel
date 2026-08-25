import React from 'react';

export interface QuestionFieldsValue {
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  marks: string;
}

interface QuestionFieldsFormProps {
  value: QuestionFieldsValue;
  onChange: (value: QuestionFieldsValue) => void;
  idPrefix: string;
}

export const QuestionFieldsForm: React.FC<QuestionFieldsFormProps> = ({ value, onChange, idPrefix }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
        <textarea
          value={value.questionText}
          onChange={(e) => onChange({ ...value, questionText: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      {(['A', 'B', 'C', 'D'] as const).map((key) => (
        <div key={key} className="flex items-center gap-3">
          <input
            type="radio"
            name={`${idPrefix}_correct_answer`}
            checked={value.correctAnswer === key}
            onChange={() => onChange({ ...value, correctAnswer: key })}
            className="h-4 w-4 text-primary-600"
          />
          <input
            type="text"
            value={value.options[key]}
            onChange={(e) => onChange({ ...value, options: { ...value.options, [key]: e.target.value } })}
            placeholder={`Option ${key}`}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>
      ))}
      <p className="text-xs text-gray-500">Select the radio button next to the correct option.</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (optional)</label>
        <textarea
          value={value.explanation}
          onChange={(e) => onChange({ ...value, explanation: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Marks</label>
        <input
          type="number"
          value={value.marks}
          onChange={(e) => onChange({ ...value, marks: e.target.value })}
          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
};

export const emptyQuestionFields = (): QuestionFieldsValue => ({
  questionText: '', options: { A: '', B: '', C: '', D: '' }, correctAnswer: 'A', explanation: '', marks: '1'
});
