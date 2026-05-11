export const schoolDataCache: {
  schoolId: string;
  students: any[] | null;
  classList: any[] | null;
  subjects: Record<string, any> | null;
  lastFetch: number;
} = {
  schoolId: '',
  students: null,
  classList: null,
  subjects: null,
  lastFetch: 0
};

export const clearSchoolDataCache = () => {
  schoolDataCache.schoolId = '';
  schoolDataCache.students = null;
  schoolDataCache.classList = null;
  schoolDataCache.subjects = null;
  schoolDataCache.lastFetch = 0;
};

export const studentGradesCache: Record<string, { grades: any[], absences: Record<string, any>, lastFetch: number }> = {};

export const teacherDiaryCache: Record<string, {
  students: any[];
  subjects: any[];
  occurrences: any[];
  sessions: any[];
  schedules: any[];
  attendance: any[];
  grades: any[];
  lastFetch: number;
}> = {};

export const clearTeacherDiaryCache = (classIdPrefix?: string) => {
  if (classIdPrefix) {
    Object.keys(teacherDiaryCache)
      .filter(k => k.startsWith(classIdPrefix + '_'))
      .forEach(key => delete teacherDiaryCache[key]);
  } else {
    Object.keys(teacherDiaryCache).forEach(key => delete teacherDiaryCache[key]);
  }
};
