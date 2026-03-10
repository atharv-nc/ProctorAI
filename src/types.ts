export type UserRole = 'STUDENT' | 'TEACHER';

export interface Student {
  uid?: string;
  name: string;
  rollNumber: string;
}

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'FILL_IN_THE_BLANKS';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: number | string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  category?: string;
  subCategory?: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  type: 'MIXED' | 'MCQ' | 'TRUE_FALSE';
  questions: Question[];
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  createdAt: number;
}

export interface ExamViolation {
  type: 'LOOKING_AWAY' | 'MULTIPLE_FACES' | 'FACE_NOT_FOUND' | 'TAB_SWITCH' | 'SIGNIFICANT_MOVEMENT' | 'POSITION_CHANGE' | 'GAZE_DEVIATION';
  timestamp: number;
  message: string;
}

export interface ExamReport {
  id?: number;
  studentUid?: string;
  student: Student;
  examId: string;
  examTitle: string;
  violations: ExamViolation[];
  totalWarnings: number;
  status: 'CLEAN' | 'SUSPICIOUS' | 'CHEATING';
  answers: (number | string)[];
  questions?: Question[];
  startTime: number;
  endTime: number;
}
