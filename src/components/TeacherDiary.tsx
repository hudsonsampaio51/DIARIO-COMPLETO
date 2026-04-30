import React, { useState, useEffect, useRef, Fragment } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, deleteDoc, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Student, Class, Attendance, Grade, UserRole, ClassSession, Staff, Subject, Occurrence } from '../types';
import { Check, X, Save, Calendar, ClipboardCheck, Plus, Trash2, ShieldCheck, AlertCircle, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface TeacherDiaryProps {
  teacherId: string;
  role: UserRole;
  schoolId: string;
}

export const TeacherDiary: React.FC<TeacherDiaryProps> = ({ teacherId, role, schoolId }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [teacherProfile, setTeacherProfile] = useState<Staff | null>(null);
  const effectiveSchoolId = schoolId || teacherProfile?.schoolId || '';
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<Attendance[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [attendanceObs, setAttendanceObs] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, Partial<Grade>>>({});
  const [consolidatedGrades, setConsolidatedGrades] = useState<Record<string, Record<string, Partial<Grade>>>>({});
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [mode, setMode] = useState<'attendance' | 'grades' | 'occurrences'>('attendance');
  const [period, setPeriod] = useState('1º Bimestre');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionHours, setNewSessionHours] = useState(1);
  const [newSessionContent, setNewSessionContent] = useState('');
  const [newSessionSpecialType, setNewSessionSpecialType] = useState<string>('');
  const [newSessionSubjectId, setNewSessionSubjectId] = useState<string>('');
  const [editingContent, setEditingContent] = useState<string>('');
  const [selectedReportMonth, setSelectedReportMonth] = useState(new Date().getMonth() + 1);
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ show: boolean, id: string } | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [filterTeacherId, setFilterTeacherId] = useState<string>(role === 'admin' || role === 'supervisor' ? '' : teacherId);
  const [loadingData, setLoadingData] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const printGradesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      const targetId = (role === 'admin' || role === 'supervisor') && filterTeacherId ? filterTeacherId : teacherId;
      if (!targetId) {
        setTeacherProfile(null);
        return;
      }
      try {
        // 1. Try direct lookup by ID (if Auth UID matches Staff ID)
        const docRef = doc(db, 'staff', targetId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && (!schoolId || docSnap.data()?.schoolId === schoolId)) {
          setTeacherProfile({ id: docSnap.id, ...docSnap.data() } as Staff);
          return;
        }

        // 2. Try lookup by email from users collection
        const userDoc = await getDoc(doc(db, 'users', targetId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userEmail = userData.email?.toLowerCase();
          
          // Try to find staff by email
          let qStaff = schoolId 
            ? query(collection(db, 'staff'), where('email', '==', userEmail), where('schoolId', '==', schoolId))
            : query(collection(db, 'staff'), where('email', '==', userEmail));
          
          let snapStaff = await getDocs(qStaff);
          
          if (!snapStaff.empty) {
            const staffDoc = snapStaff.docs[0];
            const staffData = staffDoc.data();
            setTeacherProfile({ id: staffDoc.id, ...staffData } as Staff);
            
            // If schoolId was missing in users, update it
            if (!userData.schoolId && staffData.schoolId) {
              await updateDoc(doc(db, 'users', targetId), { schoolId: staffData.schoolId });
            }
            return;
          }

          // 3. Fallback: Try to find by name if email lookup fails
          const qStaffAll = schoolId
            ? query(collection(db, 'staff'), where('schoolId', '==', schoolId), where('role', '==', 'Professor'))
            : query(collection(db, 'staff'), where('role', '==', 'Professor'));
          
          const snapStaffAll = await getDocs(qStaffAll);
          const matchingStaff = snapStaffAll.docs.find(d => {
            const data = d.data();
            const fullName = `${data.firstName} ${data.lastName}`.trim().toLowerCase();
            const userName = userData.name.trim().toLowerCase();
            return fullName === userName;
          });

          if (matchingStaff) {
            const staffData = matchingStaff.data();
            setTeacherProfile({ id: matchingStaff.id, ...staffData } as Staff);
            
            // If schoolId was missing in users, update it
            if (!userData.schoolId && staffData.schoolId) {
              await updateDoc(doc(db, 'users', targetId), { schoolId: staffData.schoolId });
            }
          } else {
            // Last resort: Create a temporary profile
            setTeacherProfile({ 
              id: targetId, 
              firstName: userData.name.split(' ')[0], 
              lastName: userData.name.split(' ').slice(1).join(' '),
              email: userData.email,
              role: 'Professor',
              schoolId: schoolId || userData.schoolId || ''
            } as any);
          }
        }
      } catch (error) {
        console.error("Error fetching teacher profile:", error);
      }
    };
    fetchTeacherProfile();
  }, [teacherId, schoolId, filterTeacherId, role]);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!effectiveSchoolId) return;
      try {
        setLoadingData(true);
        const effectiveTeacherId = teacherProfile?.id || teacherId;
        const currentTeacherId = (role === 'admin' || role === 'supervisor') ? filterTeacherId : effectiveTeacherId;

        if ((role === 'admin' || role === 'supervisor') && !filterTeacherId) {
          const q = query(collection(db, 'classes'), where('schoolId', '==', effectiveSchoolId));
          const snap = await getDocs(q);
          setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Class)));
        } else {
          const qMain = query(collection(db, 'classes'), where('teacherId', '==', currentTeacherId), where('schoolId', '==', effectiveSchoolId));
          const snapMain = await getDocs(qMain);
          const mainClasses = snapMain.docs.map(d => ({ id: d.id, ...d.data() as any } as Class));

          const qSubjects = query(collection(db, 'subjects'), where('teacherId', '==', currentTeacherId), where('schoolId', '==', effectiveSchoolId));
          const snapSubjects = await getDocs(qSubjects);
          const subjectClassIds = [...new Set(snapSubjects.docs.map(d => d.data().classId))];
          
          const otherClasses: Class[] = [];
          for (const classId of subjectClassIds as string[]) {
            if (!mainClasses.find(c => c.id === classId)) {
              const classDoc = await getDoc(doc(db, 'classes', classId));
              if (classDoc.exists() && classDoc.data()?.schoolId === effectiveSchoolId) {
                otherClasses.push({ id: classDoc.id, ...classDoc.data() } as Class);
              }
            }
          }
          setClasses([...mainClasses, ...otherClasses]);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'classes');
      } finally {
        setLoadingData(false);
      }
    };
    
    if (teacherProfile || role === 'admin' || role === 'supervisor') {
      fetchClasses();
    }
  }, [teacherId, role, filterTeacherId, teacherProfile, effectiveSchoolId]);

  useEffect(() => {
    const fetchAllStaff = async () => {
      if (!effectiveSchoolId) return;
      try {
        const q = query(collection(db, 'staff'), where('schoolId', '==', effectiveSchoolId));
        const snap = await getDocs(q);
        setAllStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
      } catch (error) {
        console.error("Error fetching all staff:", error);
      }
    };
    fetchAllStaff();
  }, [effectiveSchoolId]);

  useEffect(() => {
    if (!effectiveSchoolId) return;
    const docRef = doc(db, 'schools', effectiveSchoolId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchool({ id: docSnap.id, ...docSnap.data() });
      }
    }, (error) => {
      console.error("Error fetching school:", error);
    });
    return () => unsubscribe();
  }, [effectiveSchoolId]);

  useEffect(() => {
    console.log('Students updated:', students.length);
  }, [students]);

  useEffect(() => {
    if (selectedClass) {
      const fetchData = async () => {
        if (!effectiveSchoolId) return;
        try {
          setLoadingData(true);
          const effectiveTeacherId = teacherProfile?.id || teacherId;
          const currentTeacherId = (role === 'admin' || role === 'supervisor') ? filterTeacherId : effectiveTeacherId;
          
          const [studentsSnap, subjectsSnap, occurrencesSnap] = await Promise.all([
            getDocs(query(collection(db, 'students'), where('classId', '==', selectedClass.id), where('schoolId', '==', effectiveSchoolId))),
            getDocs((role === 'admin' || role === 'supervisor' || selectedClass.educationLevel === 'Ensino Fundamental I') && !filterTeacherId 
              ? query(collection(db, 'subjects'), where('classId', '==', selectedClass.id), where('schoolId', '==', effectiveSchoolId))
              : query(collection(db, 'subjects'), where('classId', '==', selectedClass.id), where('teacherId', '==', currentTeacherId), where('schoolId', '==', effectiveSchoolId))
            ),
            getDocs(query(collection(db, 'occurrences'), where('classId', '==', selectedClass.id), where('schoolId', '==', effectiveSchoolId)))
          ]);

          const fetchedStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Student));
          
          fetchedStudents.sort((a, b) => {
            const numA = a.studentNumber ? parseInt(a.studentNumber, 10) : NaN;
            const numB = b.studentNumber ? parseInt(b.studentNumber, 10) : NaN;
            
            if (!isNaN(numA) && !isNaN(numB)) {
              if (numA !== numB) return numA - numB;
            } else if (!isNaN(numA)) {
              return -1;
            } else if (!isNaN(numB)) {
              return 1;
            }
            
            const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
          });

          const fetchedSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Subject));
          const fetchedOccurrences = occurrencesSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Occurrence));

          setStudents(fetchedStudents);
          setSubjects(fetchedSubjects);
          setOccurrences(fetchedOccurrences);

          if (selectedClass.educationLevel === 'Ensino Fundamental I' && mode !== 'grades') {
            setSelectedSubjectId('TODAS');
          } else if (fetchedSubjects.length > 0) {
            setSelectedSubjectId(fetchedSubjects[0].id);
          } else {
            setSelectedSubjectId('');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'class-data');
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [selectedClass, filterTeacherId, teacherId, role, teacherProfile, schoolId]);

  const fetchSessionsData = async (classId: string, subjectId: string) => {
    try {
      let q;
      if (subjectId === 'TODAS') {
        q = query(
          collection(db, 'classSessions'), 
          where('classId', '==', classId)
        );
      } else {
        q = query(
          collection(db, 'classSessions'), 
          where('classId', '==', classId),
          where('subjectId', '==', subjectId)
        );
      }
      const snap = await getDocs(q);
      const fetchedSessions = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as ClassSession));
      
      const sorted = fetchedSessions.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.lessonNumber || 0) - (b.lessonNumber || 0);
      });
      
      setSessions(sorted);
      return sorted;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'classSessions');
      return [];
    }
  };

  const fetchOccurrences = async (classId: string) => {
    try {
      const q = query(
        collection(db, 'occurrences'),
        where('classId', '==', classId),
        where('schoolId', '==', effectiveSchoolId)
      );
      const snap = await getDocs(q);
      setOccurrences(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Occurrence)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'occurrences');
    }
  };

  useEffect(() => {
    if (selectedClass && selectedSubjectId) {
      const fetchSessions = async () => {
        const sorted = await fetchSessionsData(selectedClass.id, selectedSubjectId);
        const filtered = sorted.filter(s => (s as any).period === period);
        if (filtered.length > 0) {
          setSelectedSessionId(filtered[0].id);
        } else {
          setSelectedSessionId('');
        }
      };
      const fetchMonthlyAttendance = async () => {
        try {
          let q;
          if (selectedSubjectId === 'TODAS') {
            q = query(
              collection(db, 'attendance'), 
              where('classId', '==', selectedClass.id)
            );
          } else {
            q = query(
              collection(db, 'attendance'), 
              where('classId', '==', selectedClass.id),
              where('subjectId', '==', selectedSubjectId)
            );
          }
          const snap = await getDocs(q);
          setMonthlyAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Attendance)));
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'attendance');
        }
      };
      fetchSessions();
      fetchMonthlyAttendance();
      fetchOccurrences(selectedClass.id);
    }
  }, [selectedClass, selectedSubjectId, period]);

  useEffect(() => {
    if (selectedSessionId && monthlyAttendance.length > 0) {
      const sessionAttendance = monthlyAttendance.filter(a => a.sessionId === selectedSessionId);
      const newAttendance: Record<string, 'present' | 'absent'> = {};
      const newAttendanceObs: Record<string, string> = {};
      
      sessionAttendance.forEach(a => {
        newAttendance[a.studentId] = a.status;
        newAttendanceObs[a.studentId] = a.observations || '';
      });
      
      setAttendance(newAttendance);
      setAttendanceObs(newAttendanceObs);
    } else {
      setAttendance({});
      setAttendanceObs({});
    }
  }, [selectedSessionId, monthlyAttendance]);

  useEffect(() => {
    if (selectedClass?.educationLevel === 'Ensino Fundamental I') {
      if (mode !== 'grades') {
        setSelectedSubjectId('TODAS');
      } else if (selectedSubjectId === 'TODAS') {
        if (subjects.length > 0) {
          setSelectedSubjectId(subjects[0].id);
        } else {
          setSelectedSubjectId('');
        }
      }
    }
  }, [mode, selectedClass, subjects]);

  useEffect(() => {
    if (selectedSessionId && sessions.length > 0) {
      const session = sessions.find(s => s.id === selectedSessionId);
      if (session) {
        setEditingContent(session.description || '');
      }
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (selectedClass && mode === 'grades') {
      const fetchGrades = async () => {
        try {
          let q;
          if (selectedClass.educationLevel === 'Ensino Fundamental I') {
            q = query(
              collection(db, 'grades'),
              where('classId', '==', selectedClass.id),
              where('period', '==', period)
            );
          } else if (selectedSubjectId) {
            q = query(
              collection(db, 'grades'),
              where('classId', '==', selectedClass.id),
              where('subjectId', '==', selectedSubjectId),
              where('period', '==', period)
            );
          } else {
            return;
          }

          const snap = await getDocs(q);
          
          if (selectedClass.educationLevel === 'Ensino Fundamental I') {
            const fetched: Record<string, Record<string, Partial<Grade>>> = {};
            snap.docs.forEach(d => {
              const data = d.data() as Grade;
              if (!fetched[data.studentId]) fetched[data.studentId] = {};
              if (data.subjectId) {
                fetched[data.studentId][data.subjectId] = { ...data, id: d.id };
              }
            });
            setConsolidatedGrades(fetched);
          } else {
            const fetched: Record<string, Partial<Grade>> = {};
            snap.docs.forEach(d => {
              const data = d.data() as Grade;
              fetched[data.studentId] = { ...data, id: d.id };
            });
            setGrades(fetched);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'grades');
        }
      };
      fetchGrades();
    }
  }, [selectedClass, selectedSubjectId, period, mode]);

  const initializeEF1Subjects = async () => {
    if (!selectedClass || selectedClass.educationLevel !== 'Ensino Fundamental I' || !effectiveSchoolId) return;
    
    const standardSubjects = [
      'Língua Portuguesa',
      'Matemática',
      'Ciências',
      'História',
      'Geografia',
      'Arte',
      'Educação Física',
      'Ensino Religioso'
    ];
    
    try {
      setLoadingData(true);
      
      // Fetch ALL subjects for this class to check for existing ones, 
      // regardless of the current teacher filter in the state
      const allSubjectsSnap = await getDocs(query(
        collection(db, 'subjects'), 
        where('classId', '==', selectedClass.id),
        where('schoolId', '==', effectiveSchoolId)
      ));
      
      const existingSubjectNames = allSubjectsSnap.docs.map(d => (d.data() as any).name);
      const subjectsToAdd = standardSubjects.filter(name => !existingSubjectNames.includes(name));
      
      if (subjectsToAdd.length === 0) {
        setFeedback({ message: 'Todas as disciplinas já estão cadastradas para esta turma.', type: 'success' });
        return;
      }

      const effectiveTeacherId = teacherProfile?.id || teacherId;
      
      for (const name of subjectsToAdd) {
        await addDoc(collection(db, 'subjects'), {
          name,
          classId: selectedClass.id,
          schoolId: effectiveSchoolId,
          teacherId: effectiveTeacherId
        });
      }
      
      // Refresh subjects for the current view
      const currentTeacherId = (role === 'admin' || role === 'supervisor') ? filterTeacherId : effectiveTeacherId;
      const subjectsQuery = (role === 'admin' || role === 'supervisor' || selectedClass.educationLevel === 'Ensino Fundamental I') && !filterTeacherId 
        ? query(collection(db, 'subjects'), where('classId', '==', selectedClass.id), where('schoolId', '==', effectiveSchoolId))
        : query(collection(db, 'subjects'), where('classId', '==', selectedClass.id), where('teacherId', '==', currentTeacherId), where('schoolId', '==', effectiveSchoolId));
      
      const subjectsSnap = await getDocs(subjectsQuery);
      const fetchedSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Subject));
      setSubjects(fetchedSubjects);
      if (fetchedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(fetchedSubjects[0].id);
      }
      
      setFeedback({ message: 'Disciplinas inicializadas com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subjects');
    } finally {
      setLoadingData(false);
    }
  };

  const updateGrade = (studentId: string, field: keyof Grade, value: string, subjectId?: string) => {
    const numValue = parseFloat(value) || 0;
    const targetSubjectId = subjectId || selectedSubjectId;
    
    if (selectedClass?.educationLevel === 'Ensino Fundamental I') {
      const targetSubject = subjects.find(s => s.id === targetSubjectId);
      const isPortuguesa = targetSubject?.name?.toLowerCase().includes('portuguesa');
      const isSharedGrade = ['writtenActivity2', 'projectGrade', 'oralActivityGrade', 'notebookGrade'].includes(field);

      setConsolidatedGrades(prev => {
        const studentGrades = prev[studentId] || {};
        let newStudentGrades = { ...studentGrades };
        
        if (isPortuguesa && isSharedGrade) {
          subjects.forEach(sub => {
            const currentSubGrade = studentGrades[sub.id] || {};
            const updatedSubGrade = { ...currentSubGrade, [field]: numValue };
            
            const total = (updatedSubGrade.writtenActivity1 || 0) + 
                          (updatedSubGrade.writtenActivity2 || 0) + 
                          (updatedSubGrade.projectGrade || 0) +
                          (updatedSubGrade.oralActivityGrade || 0) +
                          (updatedSubGrade.notebookGrade || 0);
                          
            newStudentGrades[sub.id] = { ...updatedSubGrade, value: total };
          });
        } else {
          const currentGrade = studentGrades[targetSubjectId] || {};
          const updatedGrade = { ...currentGrade, [field]: numValue };
          
          const total = (updatedGrade.writtenActivity1 || 0) + 
                        (updatedGrade.writtenActivity2 || 0) + 
                        (updatedGrade.projectGrade || 0) +
                        (updatedGrade.oralActivityGrade || 0) +
                        (updatedGrade.notebookGrade || 0);
          
          newStudentGrades[targetSubjectId] = { ...updatedGrade, value: total };
        }
        
        return {
          ...prev,
          [studentId]: newStudentGrades
        };
      });
    } else {
      setGrades(prev => {
        const currentGrade = prev[studentId] || {};
        const updatedGrade = { ...currentGrade, [field]: numValue };
        
        // Calculate total automatically
        const total = (updatedGrade.writtenActivity1 || 0) + 
                      (updatedGrade.writtenActivity2 || 0) + 
                      (updatedGrade.projectGrade || 0) +
                      (updatedGrade.oralActivityGrade || 0) +
                      (updatedGrade.notebookGrade || 0);
        
        return {
          ...prev,
          [studentId]: { ...updatedGrade, value: total }
        };
      });
    }
  };

  const handleAddSession = async () => {
    if (!selectedClass || !newSessionDate || !selectedSubjectId) return;
    try {
      const effectiveTeacherId = teacherProfile?.id || teacherId;
      const isEF1 = selectedClass.educationLevel === 'Ensino Fundamental I';
      const targetSubjectId = (selectedSubjectId === 'TODAS' ? newSessionSubjectId : selectedSubjectId) || (subjects.length > 0 ? subjects[0].id : '');
      
      if (!targetSubjectId) {
        setFeedback({ message: 'Selecione uma disciplina para a aula!', type: 'error' });
        return;
      }

      await addDoc(collection(db, 'classSessions'), {
        classId: selectedClass.id,
        subjectId: targetSubjectId,
        teacherId: effectiveTeacherId,
        date: newSessionDate,
        lessonNumber: isEF1 ? 1 : newSessionHours,
        description: newSessionContent,
        specialType: isEF1 ? null : (newSessionSpecialType || null),
        period: period,
        schoolId: effectiveSchoolId,
        createdAt: new Date().toISOString()
      });
      setNewSessionDate('');
      setNewSessionHours(1);
      setNewSessionContent('');
      setNewSessionSpecialType('');
      setNewSessionSubjectId('');
      setFeedback({ message: 'Aula registrada com sucesso!', type: 'success' });
      
      await fetchSessionsData(selectedClass.id, selectedSubjectId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classSessions');
    }
  };

  const handleUpdateSessionContent = async () => {
    if (!selectedSessionId || !selectedClass || !selectedSubjectId) return;
    try {
      await updateDoc(doc(db, 'classSessions', selectedSessionId), {
        description: editingContent
      });
      setSessions(sessions.map(s => s.id === selectedSessionId ? { ...s, description: editingContent } : s));
      setFeedback({ message: 'Conteúdo atualizado!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'classSessions');
    }
  };

  const handlePrintMonthly = () => {
    console.log('Students length:', students.length);
    if (!selectedClass || !selectedSubjectId) {
      setFeedback({ message: 'Selecione uma turma e uma disciplina antes de gerar o PDF.', type: 'error' });
      return;
    }

    const element = printRef.current;
    if (!element) return;
    console.log('Print element HTML:', element.innerHTML);

    // Open a new window for printing - this is the most reliable way to bypass iframe print blocks
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      setFeedback({ 
        message: 'O bloqueador de pop-ups impediu a abertura. Por favor, clique no ícone de "Abrir em nova aba" no topo da tela.', 
        type: 'error' 
      });
      return;
    }

    setFeedback({ message: 'Abrindo janela de impressão...', type: 'success' });

    // Get all styles from the current document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Diário Mensal - ${selectedClass.name}</title>
          ${styles}
          <style>
            @media print {
              @page { size: landscape; margin: 0.5cm; }
              body, body * { visibility: visible !important; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: sans-serif; 
              padding: 0; 
              margin: 0;
              background: white !important; 
              color: black !important;
            }
            .print-container { 
              width: 100%;
              background: white !important;
            }
            /* Force table borders to show in print */
            table { border-collapse: collapse !important; }
            th, td { border: 1px solid black !important; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${element.innerHTML}
          </div>
          <script>
            // Wait for all resources (like fonts/styles) to be fully ready
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Optional: close window after printing
                // window.onafterprint = function() { window.close(); };
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintGrades = () => {
    if (!selectedClass || !selectedSubjectId) {
      setFeedback({ message: 'Selecione uma turma e uma disciplina antes de gerar o PDF.', type: 'error' });
      return;
    }

    const element = printGradesRef.current;
    if (!element) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setFeedback({ 
        message: 'O bloqueador de pop-ups impediu a abertura. Por favor, clique no ícone de "Abrir em nova aba" no topo da tela.', 
        type: 'error' 
      });
      return;
    }

    setFeedback({ message: 'Abrindo janela de impressão...', type: 'success' });

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ficha de Notas - ${selectedClass.name}</title>
          ${styles}
          <style>
            @media print {
              @page { size: portrait; margin: 1cm; }
              body, body * { visibility: visible !important; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: sans-serif; 
              padding: 0; 
              margin: 0;
              background: white !important; 
              color: black !important;
            }
            .print-container { 
              width: 100%;
              background: white !important;
            }
            table { border-collapse: collapse !important; width: 100%; }
            th, td { border: 1px solid black !important; padding: 4px; text-align: center; font-size: 10px; }
            .text-left { text-align: left !important; }
            .header-info p { margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${element.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteDoc(doc(db, 'classSessions', sessionId));
      setSessions(sessions.filter(s => s.id !== sessionId));
      setShowConfirmModal(null);
      setFeedback({ message: 'Data de aula excluída!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'classSessions');
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass || !selectedSessionId || !selectedSubjectId) {
      setFeedback({ message: 'Selecione uma data de aula primeiro!', type: 'error' });
      return;
    }
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return;
    
    try {
      const promises = Object.entries(attendance).map(async ([studentId, status]) => {
        const q = query(
          collection(db, 'attendance'),
          where('sessionId', '==', session.id),
          where('studentId', '==', studentId)
        );
        const snap = await getDocs(q);
        const data = {
          classId: selectedClass.id,
          subjectId: session.subjectId || selectedSubjectId,
          studentId,
          date: session.date,
          sessionId: session.id,
          period: (session as any).period || period,
          status,
          teacherId,
          schoolId: effectiveSchoolId,
          observations: attendanceObs[studentId] || ''
        };

        if (!snap.empty) {
          return updateDoc(doc(db, 'attendance', snap.docs[0].id), data);
        } else {
          return addDoc(collection(db, 'attendance'), data);
        }
      });
      await Promise.all(promises);
      setFeedback({ message: 'Frequência salva com sucesso!', type: 'success' });
      
      // Refresh monthly attendance
      let q;
      if (selectedSubjectId === 'TODAS') {
        q = query(
          collection(db, 'attendance'), 
          where('classId', '==', selectedClass.id)
        );
      } else {
        q = query(
          collection(db, 'attendance'), 
          where('classId', '==', selectedClass.id),
          where('subjectId', '==', selectedSubjectId)
        );
      }
      const snap = await getDocs(q);
      setMonthlyAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Attendance)));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    }
  };

  const handleSaveGrades = async () => {
    if (!selectedClass) return;
    try {
      setLoadingData(true);
      const effectiveTeacherId = teacherProfile?.id || teacherId;

      if (selectedClass.educationLevel === 'Ensino Fundamental I') {
        const promises: any[] = [];
        Object.entries(consolidatedGrades).forEach(([studentId, subjectGrades]) => {
          Object.entries(subjectGrades).forEach(([subjectId, gradeData]) => {
            if (!gradeData || Object.keys(gradeData).length === 0) return;
            const data = {
              classId: selectedClass.id,
              subjectId,
              studentId,
              period,
              teacherId: effectiveTeacherId,
              value: gradeData.value || 0,
              writtenActivity1: gradeData.writtenActivity1 || 0,
              writtenActivity2: gradeData.writtenActivity2 || 0,
              projectGrade: gradeData.projectGrade || 0,
              oralActivityGrade: gradeData.oralActivityGrade || 0,
              notebookGrade: gradeData.notebookGrade || 0,
              schoolId: effectiveSchoolId
            };

            if (gradeData.id) {
              promises.push(updateDoc(doc(db, 'grades', gradeData.id), data));
            } else {
              promises.push(addDoc(collection(db, 'grades'), data));
            }
          });
        });
        await Promise.all(promises);
      } else {
        const promises = (Object.entries(grades) as [string, Partial<Grade>][]).map(async ([studentId, gradeData]) => {
          const q = query(
            collection(db, 'grades'),
            where('classId', '==', selectedClass.id),
            where('subjectId', '==', selectedSubjectId),
            where('studentId', '==', studentId),
            where('period', '==', period)
          );
          const snap = await getDocs(q);
          
          const data = {
            classId: selectedClass.id,
            subjectId: selectedSubjectId,
            studentId,
            period,
            teacherId: effectiveTeacherId,
            value: gradeData.value || 0,
            writtenActivity1: gradeData.writtenActivity1 || 0,
            writtenActivity2: gradeData.writtenActivity2 || 0,
            projectGrade: gradeData.projectGrade || 0,
            oralActivityGrade: gradeData.oralActivityGrade || 0,
            notebookGrade: gradeData.notebookGrade || 0,
            schoolId: effectiveSchoolId
          };

          if (!snap.empty) {
            return updateDoc(doc(db, 'grades', snap.docs[0].id), data);
          } else {
            return addDoc(collection(db, 'grades'), data);
          }
        });
        await Promise.all(promises);
      }
      setFeedback({ message: 'Notas salvas com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'grades');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveOccurrence = async (occurrenceData: Partial<Occurrence>) => {
    if (!selectedClass) return;
    try {
      const data = {
        ...occurrenceData,
        classId: selectedClass.id,
        schoolId: effectiveSchoolId,
        teacherId,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'occurrences'), data);
      setFeedback({ message: 'Ocorrência registrada!', type: 'success' });
      fetchOccurrences(selectedClass.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'occurrences');
    }
  };

  const handleDeleteOccurrence = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'occurrences', id));
      setOccurrences(occurrences.filter(o => o.id !== id));
      setFeedback({ message: 'Ocorrência excluída!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'occurrences');
    }
  };

  const getPeriodText = () => {
    const periods = Array.from(new Set(sessions.map(s => (s as any).period).filter(Boolean)));
    if (periods.length === 0) return period.toUpperCase();
    if (periods.length === 1) return String(periods[0]).toUpperCase();
    
    const numbers = periods.sort().map(p => String(p).split(' ')[0]);
    return `${numbers.join('/')} BIMESTRE`.toUpperCase();
  };

  const currentTeacherName = (() => {
    const currentSubject = subjects.find(s => s.id === selectedSubjectId);
    if (currentSubject?.teacherId) {
      const prof = allStaff.find(s => s.id === currentSubject.teacherId);
      if (prof) return `${prof.firstName} ${prof.lastName || ''}`.trim();
    }
    if (selectedClass?.teacherId) {
      const prof = allStaff.find(s => s.id === selectedClass.teacherId);
      if (prof) return `${prof.firstName} ${prof.lastName || ''}`.trim();
    }
    return teacherProfile ? `${teacherProfile.firstName} ${teacherProfile.lastName || ''}`.trim() : '---';
  })();

  return (
    <div className="p-8 relative">
      {loadingData && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-2xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-emerald-700 animate-pulse uppercase tracking-wider">Carregando dados...</p>
          </div>
        </div>
      )}

      {showSessionManager && selectedClass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Gerenciar Datas</h2>
              <button onClick={() => setShowSessionManager(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Nova Aula</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
                    <input 
                      type="date" 
                      value={newSessionDate}
                      onChange={e => setNewSessionDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {selectedSubjectId === 'TODAS' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Disciplina</label>
                      <select 
                        value={newSessionSubjectId}
                        onChange={e => setNewSessionSubjectId(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecione...</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedClass?.educationLevel !== 'Ensino Fundamental I' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Aula do Dia</label>
                        <select 
                          value={newSessionHours}
                          onChange={e => setNewSessionHours(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Aula</label>
                        <select 
                          value={newSessionSpecialType}
                          onChange={e => setNewSessionSpecialType(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Normal</option>
                          <option value="C">Contra Turno (C)</option>
                          <option value="E">Estadia (E)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <textarea
                  placeholder="Conteúdo da aula..."
                  value={newSessionContent}
                  onChange={e => setNewSessionContent(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none text-sm"
                />
                <button 
                  onClick={handleAddSession}
                  className="w-full bg-emerald-600 text-white py-2 rounded-xl hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Registrar Aula
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Aulas Registradas</p>
                {sessions.map(s => (
                  <div key={s.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-700">
                        {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {selectedClass?.educationLevel !== 'Ensino Fundamental I' && (
                          <span className="ml-2 text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                            {s.lessonNumber}
                          </span>
                        )}
                        {s.specialType && (
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded font-bold ${
                            s.specialType === 'C' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {s.specialType === 'C' ? 'Contra Turno' : 'Estadia'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{s.description || 'Sem conteúdo'}</p>
                    </div>
                    <button 
                      onClick={() => setShowConfirmModal({ show: true, id: s.id })}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowSessionManager(false)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Concluir
            </button>
          </motion.div>
        </div>
      )}

      <header className="mb-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-600"></div>
        <div className="flex justify-center mb-6">
          <img 
            src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
            alt={school?.name || 'Brasão'} 
            className="h-20 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Governo do Estado de Rondônia</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Prefeitura Municipal de Ji-Paraná</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secretaria Municipal de Educação</p>
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1">Diário Escolar</h1>
        <p className="text-emerald-600 font-bold text-sm mb-6">ANO LETIVO {school?.schoolYear || '---'}</p>

        {selectedClass && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-left border-t border-slate-100 pt-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Etapa</p>
              <p className="font-bold text-slate-700">{selectedClass.educationLevel ? selectedClass.educationLevel.toUpperCase() : 'ENSINO FUNDAMENTAL'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Escola</p>
              <p className="font-bold text-slate-700">{school?.name || '---'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Série/Ano</p>
              <p className="font-bold text-slate-700">{selectedClass.grade}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Turma</p>
              <p className="font-bold text-slate-700">{selectedClass.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Turno</p>
              <p className="font-bold text-slate-700">{selectedClass.shift}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Professor (a)</p>
              <p className="font-bold text-slate-700">
                {currentTeacherName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Componente Curricular</p>
              <select 
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="font-bold text-slate-700 bg-transparent border-none p-0 outline-none cursor-pointer hover:text-emerald-600 transition-colors"
              >
                {selectedClass?.educationLevel === 'Ensino Fundamental I' && mode !== 'grades' ? (
                  <option value="TODAS">TODAS</option>
                ) : (
                  <>
                    <option value="">Selecione...</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
        <div className="lg:col-span-1 space-y-4">
          {(role === 'admin' || role === 'supervisor') && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Filtrar por Professor</h2>
              <select 
                value={filterTeacherId}
                onChange={e => { setFilterTeacherId(e.target.value); setSelectedClass(null); }}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm font-medium"
              >
                <option value="">Todos os Professores</option>
                {allStaff.filter(s => s.role === 'Professor').map(prof => (
                  <option key={prof.id} value={prof.id}>{prof.firstName} {prof.lastName}</option>
                ))}
              </select>
            </div>
          )}
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            {filterTeacherId ? 'Turmas do Professor' : 'Suas Turmas'}
          </h2>
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedClass?.id === cls.id 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                  : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
              }`}
            >
              <p className="font-bold">{cls.name}</p>
              <p className="text-xs opacity-70">{cls.grade}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {selectedClass ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex gap-4 items-center">
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setMode('attendance')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${mode === 'attendance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Frequência
                    </button>
                    <button
                      onClick={() => setMode('grades')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${mode === 'grades' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Notas
                    </button>
                    <button
                      onClick={() => setMode('occurrences')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${mode === 'occurrences' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Ocorrências
                    </button>
                  </div>

                  {mode === 'grades' && selectedClass?.educationLevel === 'Ensino Fundamental I' && (
                    <button
                      onClick={initializeEF1Subjects}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                      title="Inicializar Disciplinas do Ensino Fundamental I"
                    >
                      <Plus size={16} />
                      Inicializar Disciplinas
                    </button>
                  )}

                  {mode !== 'occurrences' && (
                    <select 
                      value={period}
                      onChange={e => setPeriod(e.target.value)}
                      className="px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500"
                    >
                      <option>1º Bimestre</option>
                      <option>2º Bimestre</option>
                      <option>3º Bimestre</option>
                      <option>4º Bimestre</option>
                    </select>
                  )}
                </div>

                {mode === 'grades' && (
                  <button
                    onClick={handlePrintGrades}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Printer size={18} />
                    <span className="text-sm">Imprimir Ficha de Notas</span>
                  </button>
                )}
                
                {mode === 'attendance' && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-slate-400" />
                        <select 
                          value={selectedSessionId}
                          onChange={e => setSelectedSessionId(e.target.value)}
                          className="px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium bg-white"
                        >
                          <option value="">Selecione a Aula...</option>
                          {sessions.filter(s => (s as any).period === period).map(s => (
                            <option key={s.id} value={s.id}>
                              {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                              {selectedClass?.educationLevel !== 'Ensino Fundamental I' && ` - ${s.lessonNumber}`}
                              {s.specialType ? ` (${s.specialType === 'C' ? 'Contra Turno' : 'Estadia'})` : ''}
                            </option>
                          ))}
                        </select>
                        <button 
                          onClick={() => setShowSessionManager(true)}
                          className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Gerenciar Datas"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                        <select 
                          value={selectedReportMonth}
                          onChange={e => setSelectedReportMonth(parseInt(e.target.value))}
                          className="px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium bg-white"
                        >
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                          ))}
                        </select>
                        <div className="flex flex-col items-end">
                          <button
                            onClick={handlePrintMonthly}
                            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50"
                          >
                            <Printer size={18} />
                            <span className="text-sm font-medium">Gerar PDF Mensal</span>
                          </button>
                          {window.self !== window.top && (
                            <span className="text-[10px] text-slate-400 italic">Dica: Abra em nova aba para imprimir</span>
                          )}
                        </div>
                      </div>
                    </div>
                )}

                {/* Removed duplicate period selector */}
              </div>

              <div className="p-0">
                {mode === 'attendance' && selectedSessionId && (
                  <div className="p-6 bg-emerald-50/50 border-b border-emerald-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-emerald-700 uppercase">
                        {(selectedClass?.educationLevel === 'Educação Infantil' || selectedClass?.educationLevel === 'Creche')
                          ? 'Objeto de Aprendizagem e Desenvolvimento'
                          : 'Conteúdo da Aula'}
                      </p>
                      <button 
                        onClick={handleUpdateSessionContent}
                        className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 transition-colors font-bold"
                      >
                        Salvar {(selectedClass?.educationLevel === 'Educação Infantil' || selectedClass?.educationLevel === 'Creche')
                          ? 'Registro'
                          : 'Conteúdo'}
                      </button>
                    </div>
                    <textarea
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      placeholder={(selectedClass?.educationLevel === 'Educação Infantil' || selectedClass?.educationLevel === 'Creche')
                        ? "Descreva os objetos de aprendizagem e desenvolvimento..."
                        : "Descreva o conteúdo ministrado nesta aula..."}
                      className="w-full p-3 rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm h-20 resize-none bg-white"
                    />
                  </div>
                )}

                {mode === 'occurrences' && (
                  <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-4">Registrar Nova Ocorrência</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <select id="occ-student" className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">Selecione o Aluno...</option>
                        {students.filter(s => s.status !== 'transferred').map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                      </select>
                      <select id="occ-type" className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Indisciplina</option>
                        <option>Elogio</option>
                        <option>Outro</option>
                      </select>
                      <input id="occ-date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="mt-4 flex gap-4">
                      <textarea id="occ-desc" placeholder="Descreva a ocorrência..." className="flex-1 p-3 rounded-xl border border-slate-200 text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-emerald-500" />
                      <button 
                        onClick={() => {
                          const studentId = (document.getElementById('occ-student') as HTMLSelectElement).value;
                          const type = (document.getElementById('occ-type') as HTMLSelectElement).value as any;
                          const date = (document.getElementById('occ-date') as HTMLInputElement).value;
                          const description = (document.getElementById('occ-desc') as HTMLTextAreaElement).value;
                          if (studentId && description) {
                            handleSaveOccurrence({ studentId, type, date, description });
                            (document.getElementById('occ-desc') as HTMLTextAreaElement).value = '';
                          }
                        }}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 transition-colors self-end"
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-max border-collapse">
                    {subjects.length === 0 && mode === 'grades' && selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                    <tbody>
                      <tr>
                        <td colSpan={3} className="p-12 text-center">
                          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                          <p className="text-slate-500 font-medium">Nenhuma disciplina cadastrada para esta turma.</p>
                          <button
                            onClick={initializeEF1Subjects}
                            className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                          >
                            Inicializar Disciplinas EF1
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    <>
                      <thead key={`thead-${mode}`} className="bg-slate-50/50 border-b border-slate-100">
                        {mode === 'grades' && selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                          <>
                            <tr>
                              <th rowSpan={2} className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border border-slate-200 bg-slate-50">Nº</th>
                              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border border-slate-200 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Estudante</th>
                              {subjects.map(subject => (
                                <th key={`subject-header-${subject.id}`} colSpan={6} className="px-2 py-2 text-center text-[10px] font-black text-white uppercase tracking-tighter border border-slate-300 bg-emerald-600">
                                  {subject.name}
                                </th>
                              ))}
                            </tr>
                            <tr>
                              {subjects.map(subject => (
                                <Fragment key={`sub-header-${subject.id}`}>
                                  {selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                                    <>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Atividade Escrita">AE</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Leitura/Produção">LP</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Participação Consciente">PC</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Tarefa de Casa">TC</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Atividades Integradoras">AI</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-emerald-700 uppercase border border-slate-200 bg-emerald-50 min-w-[40px]">MB</th>
                                    </>
                                  ) : (
                                    <>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Atividade Escrita">AE</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Prova Escrita">PE</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Projeto">PR</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Atividade Oral">AO</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50 min-w-[40px]" title="Caderno">CA</th>
                                      <th className="px-1 py-2 text-center text-[9px] font-bold text-emerald-700 uppercase border border-slate-200 bg-emerald-50 min-w-[40px]">MB</th>
                                    </>
                                  )}
                                </Fragment>
                              ))}
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                              <div className="flex items-center gap-2">
                                <span>Aluno</span>
                                {(() => {
                                  const session = sessions.find(s => s.id === selectedSessionId);
                                  if (session?.specialType) {
                                    return (
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                        session.specialType === 'C' 
                                          ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                          : 'bg-blue-100 text-blue-700 border-blue-200'
                                      }`}>
                                        {session.specialType === 'C' ? 'CONTRA TURNO' : 'ESTADIA'}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </th>
                            <th className={`px-6 py-4 text-sm font-semibold text-slate-600 text-center ${mode === 'grades' ? 'w-[400px]' : mode === 'attendance' ? 'w-64' : 'w-32'}`}>
                              {mode === 'attendance' ? <span>Presença</span> : mode === 'grades' ? (
                                selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                                  <div className="grid grid-cols-6 gap-2 text-[10px] uppercase font-bold text-center">
                                    <span title="Atividade Escrita">AE</span>
                                    <span title="Leitura/Produção">LP</span>
                                    <span title="Participação Consciente">PC</span>
                                    <span title="Tarefa de Casa">TC</span>
                                    <span title="Atividades Integradoras">AI</span>
                                    <span title="Média Bimestral">MB</span>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-6 gap-2 text-[10px] uppercase font-bold">
                                    <span title="Atividade Escrita">AE</span>
                                    <span title="Prova Escrita">PE</span>
                                    <span title="Projeto">PR</span>
                                    <span title="Atividade Oral">AO</span>
                                    <span title="Caderno">CA</span>
                                    <span title="Média Bimestral">MB</span>
                                  </div>
                                )
                              ) : <span>Tipo</span>}
                            </th>
                            {mode === 'attendance' && <th className="px-6 py-4 text-sm font-semibold text-slate-600"><span>Observações</span></th>}
                            {mode === 'occurrences' && <th className="px-6 py-4 text-sm font-semibold text-slate-600"><span>Descrição</span></th>}
                            {mode === 'occurrences' && <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-20"><span>Ações</span></th>}
                          </tr>
                        )}
                      </thead>
                  <tbody key={`tbody-${mode}-${selectedClass?.id}`} className="divide-y divide-slate-100">
                    {mode === 'occurrences' ? (
                      occurrences.sort((a, b) => b.date.localeCompare(a.date)).map(occ => {
                        const student = students.find(s => s.id === occ.studentId);
                        const studentName = student ? (student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim()) : 'Aluno não encontrado';
                        return (
                          <tr key={occ.id}>
                            <td className="px-6 py-4 font-medium text-slate-900">
                              <span>{studentName}</span>
                              <p className="text-[10px] text-slate-400">{new Date(occ.date).toLocaleDateString('pt-BR')}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                occ.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700' : 
                                occ.type === 'Indisciplina' ? 'bg-red-100 text-red-700' : 
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {occ.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{occ.description}</td>
                            <td className="px-6 py-4">
                              <button onClick={() => handleDeleteOccurrence(occ.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : students.map((student, idx) => {
                      const studentName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Sem Nome';
                      const session = sessions.find(s => s.id === selectedSessionId);
                      const isTransferred = student.status === 'transferred' && (!student.transferDate || (session && session.date >= student.transferDate));
                      
                      if (mode === 'grades' && selectedClass?.educationLevel === 'Ensino Fundamental I') {
                        return (
                          <tr key={`student-row-${student.id}`} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 text-center">{idx + 1}</td>
                            <td className="px-4 py-2 text-xs font-medium text-slate-900 border border-slate-200 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                              {studentName}
                            </td>
                            {subjects.map(subject => {
                              const grade = consolidatedGrades[student.id]?.[subject.id] || {};
                              return (
                                <Fragment key={`${student.id}-${subject.id}`}>
                                  <td className="p-0 border border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      className="w-full h-10 px-1 text-center text-xs outline-none focus:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"
                                      value={grade.writtenActivity1 || ''}
                                      disabled={isTransferred}
                                      onChange={e => updateGrade(student.id, 'writtenActivity1', e.target.value, subject.id)}
                                    />
                                  </td>
                                  <td className="p-0 border border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      className="w-full h-10 px-1 text-center text-xs outline-none focus:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"
                                      value={grade.writtenActivity2 || ''}
                                      disabled={isTransferred}
                                      onChange={e => updateGrade(student.id, 'writtenActivity2', e.target.value, subject.id)}
                                    />
                                  </td>
                                  <td className="p-0 border border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      className="w-full h-10 px-1 text-center text-xs outline-none focus:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"
                                      value={grade.projectGrade || ''}
                                      disabled={isTransferred}
                                      onChange={e => updateGrade(student.id, 'projectGrade', e.target.value, subject.id)}
                                    />
                                  </td>
                                  <td className="p-0 border border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      className="w-full h-10 px-1 text-center text-xs outline-none focus:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"
                                      value={grade.oralActivityGrade || ''}
                                      disabled={isTransferred}
                                      onChange={e => updateGrade(student.id, 'oralActivityGrade', e.target.value, subject.id)}
                                    />
                                  </td>
                                  <td className="p-0 border border-slate-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      className="w-full h-10 px-1 text-center text-xs outline-none focus:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"
                                      value={grade.notebookGrade || ''}
                                      disabled={isTransferred}
                                      onChange={e => updateGrade(student.id, 'notebookGrade', e.target.value, subject.id)}
                                    />
                                  </td>
                                  <td className="px-1 py-2 text-center text-xs font-bold bg-slate-100 border border-slate-200">
                                    {grade.value !== undefined ? grade.value.toFixed(2).replace('.', ',') : '0,00'}
                                  </td>
                                </Fragment>
                              );
                            })}
                          </tr>
                        );
                      }

                      return (
                        <tr key={`student-row-${student.id}`}>
                          <td className="px-6 py-4 font-medium text-slate-900"><span>{studentName}</span></td>
                          <td className="px-6 py-4">
                          {mode === 'attendance' ? (
                            isTransferred ? (
                              <div className="flex justify-center">
                                <span className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200" title="Transferido">
                                  T
                                </span>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-4">
                                <button
                                  onClick={() => setAttendance({ ...attendance, [student.id]: 'present' })}
                                  className={`p-2 rounded-full transition-all ${attendance[student.id] === 'present' ? 'bg-emerald-100 text-emerald-600' : 'text-slate-300 hover:bg-slate-50'}`}
                                >
                                  <Check size={20} />
                                </button>
                                <button
                                  onClick={() => setAttendance({ ...attendance, [student.id]: 'absent' })}
                                  className={`p-2 rounded-full transition-all ${attendance[student.id] === 'absent' ? 'bg-red-100 text-red-600' : 'text-slate-300 hover:bg-slate-50'}`}
                                >
                                  <X size={20} />
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex justify-center">
                              {selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                                <div className="grid grid-cols-6 gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="AE"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.writtenActivity1 || ''}
                                    onChange={e => updateGrade(student.id, 'writtenActivity1', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="LP"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.writtenActivity2 || ''}
                                    onChange={e => updateGrade(student.id, 'writtenActivity2', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="PC"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.projectGrade || ''}
                                    onChange={e => updateGrade(student.id, 'projectGrade', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="TC"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.oralActivityGrade || ''}
                                    onChange={e => updateGrade(student.id, 'oralActivityGrade', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="AI"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.notebookGrade || ''}
                                    onChange={e => updateGrade(student.id, 'notebookGrade', e.target.value)}
                                  />
                                  <div className="w-14 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center text-xs font-bold flex items-center justify-center text-slate-800">
                                    {grades[student.id]?.value !== undefined ? grades[student.id]?.value.toFixed(2).replace('.', ',') : '0,00'}
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-6 gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="AE"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.writtenActivity1 || ''}
                                    onChange={e => updateGrade(student.id, 'writtenActivity1', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="PE"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.writtenActivity2 || ''}
                                    onChange={e => updateGrade(student.id, 'writtenActivity2', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="PR"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.projectGrade || ''}
                                    onChange={e => updateGrade(student.id, 'projectGrade', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="AO"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.oralActivityGrade || ''}
                                    onChange={e => updateGrade(student.id, 'oralActivityGrade', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="CA"
                                    disabled={isTransferred}
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                                    value={grades[student.id]?.notebookGrade || ''}
                                    onChange={e => updateGrade(student.id, 'notebookGrade', e.target.value)}
                                  />
                                  <div className="w-14 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center text-xs font-bold flex items-center justify-center text-slate-800">
                                    {grades[student.id]?.value !== undefined ? grades[student.id]?.value.toFixed(2).replace('.', ',') : '0,00'}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {mode === 'attendance' && (
                          <td className="px-6 py-4">
                            <input 
                              type="text"
                              value={isTransferred ? 'TRANSFERIDO' : (attendanceObs[student.id] || '')}
                              onChange={e => setAttendanceObs({ ...attendanceObs, [student.id]: e.target.value })}
                              placeholder="Observação..."
                              disabled={isTransferred}
                              className={`w-full px-3 py-1 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-emerald-500 ${isTransferred ? 'bg-slate-50 text-slate-400 italic' : ''}`}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                </>
                )}
                </table>
              </div>
            </div>

            {mode !== 'occurrences' && (
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                  {mode === 'grades' && (
                    <button
                      onClick={handlePrintGrades}
                      className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-6 py-3 rounded-xl font-bold transition-all shadow-sm"
                    >
                      <Printer size={20} />
                      Imprimir Ficha de Notas
                    </button>
                  )}
                  <button
                    onClick={mode === 'attendance' ? handleSaveAttendance : handleSaveGrades}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md"
                  >
                    <Save size={20} />
                    Salvar {mode === 'attendance' ? 'Frequência' : 'Notas'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              <ClipboardCheck size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Selecione uma turma para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Print View: Monthly Diary */}
      {selectedClass && (() => {
        const filteredSessions = sessions.filter(s => {
          const date = new Date(s.date + 'T12:00:00');
          return date.getMonth() + 1 === selectedReportMonth;
        });

        const monthName = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'][selectedReportMonth - 1];

        const totalWorkload = subjects.reduce((acc, s) => acc + (s.workload || 0), 0);
        const currentSubject = subjects.find(s => s.id === selectedSubjectId);

        return (
          <>
            <div ref={printRef} className="hidden print:block bg-white p-0 text-slate-900 w-full">
            {/* Page 1: Frequency */}
            <div className="page-break-after-always p-2">
            <div className="border-2 border-slate-900 p-1">
              <div className="border-b border-slate-900 pb-1 mb-1">
                <div className="grid grid-cols-4 gap-2 text-[8px] font-bold">
                  <div className="col-span-1">
                    <div className="flex items-center gap-2 mb-1">
                      <img 
                        src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
                        alt={school?.name || 'Brasão'} 
                        className="h-12 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p>{selectedClass?.educationLevel ? selectedClass.educationLevel.toUpperCase() : 'ENSINO FUNDAMENTAL'}</p>
                        <p className="text-[10px] font-black">ESCOLA: {school?.name || '---'}</p>
                        <div className="text-[7px] font-normal leading-tight">
                          <p>{school?.address || ''}</p>
                          {school?.creationDecree && <p>DECRETO: {school.creationDecree}</p>}
                          {school?.authorization && <p>AUTORIZAÇÃO/PARECER: {school.authorization}</p>}
                          {school?.resolution && <p>RESOLUÇÃO: {school.resolution}</p>}
                        </div>
                      </div>
                    </div>
                    <p>PROFESSOR/A: {currentTeacherName}</p>
                    <p>DISCIPLINA: {selectedSubjectId === 'TODAS' ? 'TODAS AS DISCIPLINAS' : (currentSubject?.name || '---')}</p>
                  </div>
                  {selectedClass?.educationLevel === 'Ensino Fundamental II' ? (
                    <>
                      <div className="col-span-1">
                        <p>AULAS NORMAIS: {filteredSessions.filter(s => !s.specialType).length}</p>
                        <p>ESTADIA LETIVA: {filteredSessions.filter(s => s.specialType === 'E').length}</p>
                      </div>
                      <div className="col-span-1">
                        <p>CONTRATURNO: {filteredSessions.filter(s => s.specialType === 'C').length}</p>
                        <p>DIAS LETIVOS: {filteredSessions.length}</p>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2">
                      <p>DIAS LETIVOS: {filteredSessions.length}</p>
                    </div>
                  )}
                  <div className="col-span-1">
                    <p>ETAPA: {selectedClass?.educationLevel ? selectedClass.educationLevel.toUpperCase() : '---'}</p>
                    <p>TURMA: {selectedClass?.name || '---'}</p>
                    <p>TURNO: {selectedClass?.shift || '---'}</p>
                    <p>FREQUÊNCIA DE: {monthName} {new Date().getFullYear()}</p>
                  </div>
                </div>
                <div className="text-center text-[10px] font-bold uppercase mt-2">
                  {getPeriodText()}
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-900 text-[10px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-900 p-1 w-6" rowSpan={2}>Nº</th>
                    <th className="border border-slate-900 p-1 text-left" rowSpan={2}>NOME DO ALUNO</th>
                    {Array.from({ length: 31 }, (_, i) => filteredSessions[i] || null).map((s, i) => {
                      if (s) {
                        return (
                          <th key={s.id} className={`border border-slate-900 p-0 text-center w-5 h-6 text-[10px] font-black ${
                            s.specialType === 'C' ? 'bg-orange-100' : s.specialType === 'E' ? 'bg-blue-100' : ''
                          }`}>
                            {s.specialType || ''}
                          </th>
                        );
                      }
                      return (
                        <th key={`empty-th1-${i}`} className="border border-slate-900 p-0 text-center w-5 h-6 text-[10px] font-black"></th>
                      );
                    })}
                    <th className="border border-slate-900 p-1 w-8" rowSpan={2}>FALTAS</th>
                  </tr>
                  <tr className="bg-slate-50">
                    {Array.from({ length: 31 }, (_, i) => filteredSessions[i] || null).map((s, i) => {
                      if (s) {
                        return (
                          <th key={s.id} className="border border-slate-900 p-0 text-center w-5 h-16 relative">
                            <div className="absolute inset-0 flex items-center justify-center -rotate-90 whitespace-nowrap">
                              {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </div>
                          </th>
                        );
                      }
                      return (
                        <th key={`empty-th2-${i}`} className="border border-slate-900 p-0 text-center w-5 h-16 relative"></th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const studentAbsences = monthlyAttendance.filter(a => 
                      a.studentId === student.id && 
                      a.status === 'absent' &&
                      (!a.subjectId || a.subjectId === selectedSubjectId) &&
                      filteredSessions.some(s => s.id === a.sessionId)
                    ).length;
                    
                    const isCurrentlyTransferred = student.status === 'transferred';

                    return (
                      <tr key={student.id}>
                        <td className="border border-slate-900 p-0.5 text-center">{idx + 1}</td>
                        <td className={`border border-slate-900 p-0.5 uppercase font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] ${isCurrentlyTransferred ? 'text-slate-400 line-through' : ''}`}>
                          {((student as any).name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Sem Nome').substring(0, 30)}
                        </td>
                        {Array.from({ length: 31 }, (_, i) => filteredSessions[i] || null).map((s, i) => {
                          if (s) {
                            const isTransferredAtSession = student.status === 'transferred' && (!student.transferDate || s.date >= student.transferDate);
                            
                            const record = monthlyAttendance.find(a => 
                              a.studentId === student.id && 
                              a.sessionId === s.id
                            );
                            return (
                              <td key={s.id} className={`border border-slate-900 p-0.5 text-center font-bold ${isTransferredAtSession ? 'text-red-600 bg-red-50' : ''}`}>
                                {isTransferredAtSession ? 'T' : (record ? (record.status === 'present' ? '.' : 'F') : '.')}
                              </td>
                            );
                          }
                          return (
                            <td key={`empty-td-${i}`} className="border border-slate-900 p-0.5 text-center font-bold"></td>
                          );
                        })}
                        <td className="border border-slate-900 p-0.5 text-center font-bold">{studentAbsences || '-'}</td>
                      </tr>
                    );
                  })}
                  {/* Empty rows to fill space if needed - reduced to compress */}
                  {Array.from({ length: Math.max(0, Math.min(5, 20 - students.length)) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-slate-900 p-0.5 h-4"></td>
                      <td className="border border-slate-900 p-0.5"></td>
                      {Array.from({ length: 31 }).map((_, i) => <td key={`empty-row-td-${i}`} className="border border-slate-900 p-0.5"></td>)}
                      <td className="border border-slate-900 p-0.5"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 text-center text-[8px] mb-8">
                <p>
                  Ji-Paraná, {filteredSessions.length > 0 
                    ? new Date(filteredSessions[filteredSessions.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                  }
                </p>
              </div>
              <div className="flex justify-between items-end text-[8px] px-4">
                <div className="text-center">
                  <div className="w-48 border-t border-slate-900 mb-1"></div>
                  <p>{currentTeacherName}</p>
                  <p className="font-bold">PROFESSOR (A)</p>
                </div>
                <div className="text-center">
                  <div className="w-48 border-t border-slate-900 mb-1"></div>
                  <p className="font-bold">VISTO DA SUPERVISÃO</p>
                </div>
                <div className="text-center">
                  <div className="w-48 border-t border-slate-900 mb-1"></div>
                  <p className="font-bold">VISTO DA DIREÇÃO</p>
                </div>
              </div>
            </div>
          </div>



          {/* Page 2: Content */}
          <div className="min-h-screen p-4 mt-8">
            <div className="border-2 border-slate-900 p-2">
              <div className="text-center mb-4 border-b border-slate-900 pb-2">
                <h2 className="text-sm font-black uppercase">Registro de Conteúdos Ministrados</h2>
                <p className="text-[10px] uppercase">Ano Letivo {school?.schoolYear || '---'} - {selectedClass?.name} - {selectedSubjectId === 'TODAS' ? 'TODAS AS DISCIPLINAS' : subjects.find(s => s.id === selectedSubjectId)?.name}</p>
                <p className="text-[10px] font-bold uppercase mt-1">{getPeriodText()}</p>
              </div>

              <table className="w-full border-collapse border border-slate-900 text-[10px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-900 p-2 text-left w-24" rowSpan={selectedClass?.educationLevel === 'Ensino Fundamental II' ? 2 : 1}>DATA</th>
                    {selectedClass?.educationLevel === 'Ensino Fundamental II' && (
                      <th className="border border-slate-900 p-1 text-center" colSpan={1}>DETALHES</th>
                    )}
                    <th className="border border-slate-900 p-2 text-center" rowSpan={selectedClass?.educationLevel === 'Ensino Fundamental II' ? 2 : 1}>
                      {(selectedClass?.educationLevel === 'Educação Infantil' || selectedClass?.educationLevel === 'Creche') 
                        ? 'OBJETO DE APRENDIZAGEM E DESENVOLVIMENTO' 
                        : 'OBJETO DO CONHECIMENTO / CONTEÚDO'}
                    </th>
                  </tr>
                  {selectedClass?.educationLevel === 'Ensino Fundamental II' && (
                    <tr className="bg-slate-50">
                      <th className="border border-slate-900 p-1 text-center w-16 text-[8px]">TIPO</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filteredSessions.map(s => {
                    return (
                      <tr key={s.id}>
                        <td className="border border-slate-900 p-2 font-bold">{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        {selectedClass?.educationLevel === 'Ensino Fundamental II' && (
                          <>
                            <td className={`border border-slate-900 p-2 text-center font-black text-[10px] ${
                              s.specialType === 'C' ? 'bg-orange-50' : s.specialType === 'E' ? 'bg-blue-50' : ''
                            }`}>
                              {s.specialType || '-'}
                            </td>
                          </>
                        )}
                        <td className="border border-slate-900 p-2 italic">{s.description || '---'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-8 text-center text-[9px] mb-12">
                <p>
                  Ji-Paraná, {filteredSessions.length > 0 
                    ? new Date(filteredSessions[filteredSessions.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                  }
                </p>
              </div>
              <div className="flex justify-between px-4 text-[9px]">
                <div className="text-center">
                  <div className="w-56 border-t border-slate-900 mb-1"></div>
                  <p>{currentTeacherName}</p>
                  <p>Assinatura do Professor</p>
                </div>
                <div className="text-center">
                  <div className="w-56 border-t border-slate-900 mb-1"></div>
                  <p>Visto da Supervisão</p>
                </div>
                <div className="text-center">
                  <div className="w-56 border-t border-slate-900 mb-1"></div>
                  <p>Visto da Direção</p>
                </div>
              </div>
            </div>
          </div>
          </div>
          
          <div ref={printGradesRef} className="hidden print:block bg-white p-0 text-slate-900 w-full">
            {(selectedClass?.educationLevel === 'Ensino Fundamental I' ? subjects : [subjects.find(s => s.id === selectedSubjectId)].filter(Boolean)).map((printSubject: any, subjectIndex: number, array: any[]) => (
              <div key={printSubject.id || 'single'} style={subjectIndex < array.length - 1 ? { pageBreakAfter: 'always' } : {}}>
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-6 border-b-2 border-slate-900 pb-4">
                    <img 
                      src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
                      alt={school?.name || 'Brasão'} 
                      className="h-16 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="header-info">
                      <h1 className="text-xl font-black uppercase">{school?.name || '---'}</h1>
                      <p className="text-sm font-bold uppercase">{selectedClass?.educationLevel || 'ENSINO FUNDAMENTAL'}</p>
                      <div className="text-[10px] mt-1">
                        <p>TURMA: {selectedClass?.name} ({selectedClass?.grade}) - TURNO: {selectedClass?.shift}</p>
                        <p>DISCIPLINA: {printSubject.name}</p>
                        <p>PROFESSOR(A): {printSubject.teacherId ? (allStaff.find((st: any) => st.id === printSubject.teacherId)?.firstName + ' ' + (allStaff.find((st: any) => st.id === printSubject.teacherId)?.lastName || '')) : currentTeacherName}</p>
                        <p className="font-bold mt-1">{period.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-center text-lg font-black uppercase mb-4">Ficha de Notas</h2>

                  <table className="w-full border-collapse border border-slate-900 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-900 p-2 text-left w-10">Nº</th>
                        <th className="border border-slate-900 p-2 text-left">ALUNO</th>
                        {selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                          <>
                            <th className="border border-slate-900 p-2 w-16">AE</th>
                            <th className="border border-slate-900 p-2 w-16">LP</th>
                            <th className="border border-slate-900 p-2 w-16">PC</th>
                            <th className="border border-slate-900 p-2 w-16">TC</th>
                            <th className="border border-slate-900 p-2 w-16">AI</th>
                          </>
                        ) : (
                          <>
                            <th className="border border-slate-900 p-2 w-16">AE</th>
                            <th className="border border-slate-900 p-2 w-16">PE</th>
                            <th className="border border-slate-900 p-2 w-16">PR</th>
                            <th className="border border-slate-900 p-2 w-16">AO</th>
                            <th className="border border-slate-900 p-2 w-16">CA</th>
                          </>
                        )}
                        <th className="border border-slate-900 p-2 w-16">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const grade = selectedClass?.educationLevel === 'Ensino Fundamental I' 
                          ? (consolidatedGrades[student.id]?.[printSubject.id] || {})
                          : (grades[student.id] || {});
                        
                        return (
                          <tr key={student.id}>
                            <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                            <td className="border border-slate-900 p-2 text-left uppercase font-medium">
                              {(student as any).name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Sem Nome'}
                            </td>
                            {selectedClass?.educationLevel === 'Ensino Fundamental I' ? (
                              <>
                                <td className="border border-slate-900 p-2">{grade.writtenActivity1 !== undefined ? grade.writtenActivity1.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.writtenActivity2 !== undefined ? grade.writtenActivity2.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.projectGrade !== undefined ? grade.projectGrade.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.oralActivityGrade !== undefined ? grade.oralActivityGrade.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.notebookGrade !== undefined ? grade.notebookGrade.toFixed(2).replace('.', ',') : '-'}</td>
                              </>
                            ) : (
                              <>
                                <td className="border border-slate-900 p-2">{grade.writtenActivity1 !== undefined ? grade.writtenActivity1.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.writtenActivity2 !== undefined ? grade.writtenActivity2.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.projectGrade !== undefined ? grade.projectGrade.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.oralActivityGrade !== undefined ? grade.oralActivityGrade.toFixed(2).replace('.', ',') : '-'}</td>
                                <td className="border border-slate-900 p-2">{grade.notebookGrade !== undefined ? grade.notebookGrade.toFixed(2).replace('.', ',') : '-'}</td>
                              </>
                            )}
                            <td className="border border-slate-900 p-2 font-bold">{grade.value !== undefined ? grade.value.toFixed(2).replace('.', ',') : '0,00'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="mt-8 text-center text-sm mb-12">
                    <p>Ji-Paraná, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="flex justify-between items-end px-4">
                    <div className="text-center">
                      <div className="w-56 border-t border-slate-900 mb-1"></div>
                      <p className="text-sm">{printSubject.teacherId ? (allStaff.find((st: any) => st.id === printSubject.teacherId)?.firstName + ' ' + (allStaff.find((st: any) => st.id === printSubject.teacherId)?.lastName || '')) : currentTeacherName}</p>
                      <p className="text-[10px] font-bold uppercase">Professor (a)</p>
                    </div>
                    <div className="text-center">
                      <div className="w-56 border-t border-slate-900 mb-1"></div>
                      <p className="text-[10px] font-bold uppercase">Visto da Supervisão</p>
                    </div>
                    <div className="text-center">
                      <div className="w-56 border-t border-slate-900 mb-1"></div>
                      <p className="text-[10px] font-bold uppercase">Visto da Direção</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        );
      })()}

      {/* Modals and Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 px-6 py-3 rounded-xl shadow-lg z-[100] flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {feedback.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
            <span className="font-semibold">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Data de Aula?</h3>
              <p className="text-slate-500 mb-6">Esta ação não pode ser desfeita e removerá todos os registros vinculados a esta data.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-400 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteSession(showConfirmModal.id)}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5cm;
          }
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .page-break-after-always {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};
