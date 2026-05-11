export type UserRole = 'superadmin' | 'admin' | 'secretary' | 'teacher' | 'supervisor';

export interface Address {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  cep: string;
}

export interface AcademicPeriod {
  name: string;
  startDate: string;
  endDate: string;
}

export interface School {
  id: string;
  name: string;
  state: string;
  municipality: string;
  address: string;
  creationDecree: string;
  authorization: string;
  resolution: string;
  phone: string;
  email: string;
  site?: string;
  blog?: string;
  schoolCode: string;
  schoolYear: string;
  logoUrl?: string;
  academicPeriods?: AcademicPeriod[];
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  schoolIds?: string[];
  createdAt: string;
}

export interface Student {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  birthPlace: string;
  contact: string;
  address: Address;
  registrationNumber: string;
  studentNumber?: string;
  status: 'active' | 'inactive' | 'transferred';
  transferDate?: string;
  classId?: string;
  // Guardian Info
  guardianFirstName: string;
  guardianLastName: string;
  guardianCpf: string;
  guardianRg: string;
  guardianContact: string;
  fatherName?: string;
  motherName?: string;
}

export type StaffRole = 
  | 'Professor' 
  | 'Diretor' 
  | 'Supervisor' 
  | 'Merendeira' 
  | 'Guarda' 
  | 'Secretaria' 
  | 'Auxiliar Administrativo' 
  | 'Serviços Gerais'
  | 'Administrador';

export interface Staff {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  birthPlace: string;
  contact: string;
  address: Address;
  email: string;
  role: StaffRole;
  subjects?: string[]; // For teachers
}

export type ClassShift = 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';
export type EducationLevel = 'Creche' | 'Educação Infantil' | 'Ensino Fundamental I' | 'Ensino Fundamental II';

export interface Class {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
  year: number;
  shift: ClassShift;
  teacherId: string; // Refers to a Staff member with role 'Professor'
  educationLevel?: EducationLevel;
}

export interface ClassSession {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string; // Specific subject for this session
  teacherId: string; // Teacher who gave this session
  date: string;
  classHours: number; // Number of class hours (horas aulas)
  lessonNumber?: number; // 1 to 8
  description?: string;
  observations?: string;
  period?: string;
  createdAt: string;
  specialType?: 'C' | 'E'; // 'C' for Contra Turno, 'E' for Estadia
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  classId: string;
  teacherId?: string; // Specific teacher for this subject (Fundamental II)
  workload?: number; // Annual workload in hours
}

export interface ClassSchedule {
  id: string;
  schoolId: string;
  classId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  specialType?: 'C' | 'E';
}

export interface Attendance {
  id: string;
  schoolId: string;
  classId: string;
  subjectId?: string;
  sessionId?: string; // Link to specific session
  studentId: string;
  date: string;
  status: 'present' | 'absent';
  teacherId: string;
  observations?: string;
}

export interface Grade {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  subjectId?: string;
  period: string;
  value: number;
  writtenActivity1?: number;
  writtenActivity2?: number;
  projectGrade?: number;
  oralActivityGrade?: number;
  notebookGrade?: number;
  homeworkGrade?: number;
  teacherId: string;
}

export interface Occurrence {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  date: string;
  type: 'Indisciplina' | 'Elogio' | 'Outro';
  description: string;
  teacherId: string;
  createdAt: string;
}
