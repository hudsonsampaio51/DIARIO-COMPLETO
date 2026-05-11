import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Student, Grade, Class } from '../types';
import { GraduationCap, Search, Printer, Download, AlertCircle } from 'lucide-react';
import { handleFirestoreError } from '../utils/errorHandling';
import { schoolDataCache, studentGradesCache } from '../utils/dataCache';

interface ReportCardProps {
  schoolId: string;
}

export const ReportCard: React.FC<ReportCardProps> = ({ schoolId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classList, setClassList] = useState<Class[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [absences, setAbsences] = useState<Record<string, Record<string, number>>>({});
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<Record<string, { name: string, workload?: number }>>({});
  const [school, setSchool] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [allClassData, setAllClassData] = useState<{
    students: Student[],
    grades: Grade[],
    absences: Record<string, Record<string, Record<string, number>>>
  } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const unsubscribe = onSnapshot(doc(db, 'schools', schoolId), (schoolSnap) => {
      if (schoolSnap.exists()) {
        setSchool({ id: schoolSnap.id, ...schoolSnap.data() });
      }
    }, (error) => {
      handleFirestoreError(error, 'get' as any, 'schools');
    });
    return () => unsubscribe();
  }, [schoolId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!schoolId) return;

      if (schoolDataCache.schoolId === schoolId && schoolDataCache.students && schoolDataCache.classList && schoolDataCache.subjects) {
        setStudents(schoolDataCache.students);
        setClassList(schoolDataCache.classList);
        const classMap: Record<string, string> = {};
        schoolDataCache.classList.forEach(c => { classMap[c.id] = c.name; });
        setClasses(classMap);
        setSubjects(schoolDataCache.subjects);
        return;
      }

      try {
        const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
        const studentsSnap = await getDocs(qStudents);
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
        
        setStudents(fetchedStudents);
        
        const qClasses = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
        const classesSnap = await getDocs(qClasses);
        const fetchedClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Class));
        setClassList(fetchedClasses);
        
        const classMap: Record<string, string> = {};
        fetchedClasses.forEach(c => {
          classMap[c.id] = c.name;
        });
        setClasses(classMap);

        const qSubjects = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
        const subjectsSnap = await getDocs(qSubjects);
        const subjectMap: Record<string, { name: string, workload?: number }> = {};
        subjectsSnap.docs.forEach(d => {
          const data = d.data();
          subjectMap[d.id] = { name: data.name, workload: data.workload };
        });
        setSubjects(subjectMap);

        schoolDataCache.schoolId = schoolId;
        schoolDataCache.students = fetchedStudents;
        schoolDataCache.classList = fetchedClasses;
        schoolDataCache.subjects = subjectMap;
        schoolDataCache.lastFetch = Date.now();
      } catch (error) {
        handleFirestoreError(error, 'list' as any, 'students/classes');
        setError('Erro ao carregar dados. Por favor, tente novamente.');
      }
    };
    fetchData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedStudent) {
      const fetchGradesAndAttendance = async () => {
        if (studentGradesCache[selectedStudent.id]) {
          setGrades(studentGradesCache[selectedStudent.id].grades);
          setAbsences(studentGradesCache[selectedStudent.id].absences);
          return;
        }

        try {
          // Remove schoolId filter to ensure backward compatibility with older records
          const qGrades = query(
            collection(db, 'grades'), 
            where('studentId', '==', selectedStudent.id)
          );
          const snapGrades = await getDocs(qGrades);
          const fetchedGrades = snapGrades.docs.map(d => ({ id: d.id, ...d.data() as any } as Grade));
          setGrades(fetchedGrades);

          const qAttendance = query(
            collection(db, 'attendance'),
            where('studentId', '==', selectedStudent.id),
            where('status', '==', 'absent')
          );
          const snapAttendance = await getDocs(qAttendance);
          const absencesMap: Record<string, Record<string, number>> = {};
          snapAttendance.docs.forEach(d => {
            const data = d.data();
            const subjectId = data.subjectId || 'default';
            const period = data.period || 'Total'; // Fallback if no period
            if (!absencesMap[subjectId]) absencesMap[subjectId] = {};
            absencesMap[subjectId][period] = (absencesMap[subjectId][period] || 0) + 1;
          });
          setAbsences(absencesMap as any);

          studentGradesCache[selectedStudent.id] = {
            grades: fetchedGrades,
            absences: absencesMap,
            lastFetch: Date.now()
          };
        } catch (error) {
          handleFirestoreError(error, 'list' as any, 'grades/attendance');
          setError('Erro ao carregar notas e faltas do aluno.');
        }
      };
      fetchGradesAndAttendance();
    }
  }, [selectedStudent]);

  const handlePrintAll = async () => {
    if (!selectedClassId) return;
    setIsPrintingAll(true);
    try {
      const classStudents = students.filter(s => s.classId === selectedClassId);
      
      const qGrades = query(collection(db, 'grades'), where('classId', '==', selectedClassId));
      const snapGrades = await getDocs(qGrades);
      const allGrades = snapGrades.docs.map(d => ({ id: d.id, ...d.data() as any } as Grade));

      const qAttendance = query(
        collection(db, 'attendance'),
        where('classId', '==', selectedClassId),
        where('status', '==', 'absent')
      );
      const snapAttendance = await getDocs(qAttendance);
      
      const absencesByStudent: Record<string, Record<string, Record<string, number>>> = {};
      snapAttendance.docs.forEach(d => {
        const data = d.data();
        const sId = data.studentId;
        const subId = data.subjectId || 'default';
        const period = data.period || 'Total';
        
        if (!absencesByStudent[sId]) absencesByStudent[sId] = {};
        if (!absencesByStudent[sId][subId]) absencesByStudent[sId][subId] = {};
        absencesByStudent[sId][subId][period] = (absencesByStudent[sId][subId][period] || 0) + 1;
      });

      setAllClassData({
        students: classStudents,
        grades: allGrades,
        absences: absencesByStudent
      });

      setTimeout(() => {
        window.print();
        setIsPrintingAll(false);
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, 'list' as any, 'bulk_report_cards');
      setError('Erro ao gerar boletins da turma.');
      setIsPrintingAll(false);
    }
  };

  const roundAverage = (value: number): number => {
    const integerPart = Math.floor(value);
    const decimalPart = value - integerPart;
    const d = Math.round(decimalPart * 100) / 100;

    if (d < 0.30) {
      return integerPart;
    } else if (d < 0.80) {
      return integerPart + 0.5;
    } else {
      return integerPart + 1.0;
    }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    const regNumber = (s.registrationNumber || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = fullName.includes(search) || regNumber.includes(search);
    const matchesClass = selectedClassId ? s.classId === selectedClassId : true;
    return matchesSearch && matchesClass;
  });

  const renderReportCard = (student: Student, studentGrades: Grade[], studentAbsences: Record<string, Record<string, number>>, isBulk = false) => {
    return (
      <div key={student.id} className={`bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden print:overflow-visible ${isBulk ? 'print:shadow-none print:border-none mb-8 page-break-after-always' : ''}`}>
        <div className="p-8 bg-slate-900 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img 
                src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
                alt={school?.name || 'Brasão'} 
                className="h-16 w-auto brightness-0 invert object-contain"
                referrerPolicy="no-referrer"
              />
              <div>
                <h2 className="text-xl font-bold mb-0.5">{school?.name || 'NOME DA ESCOLA'}</h2>
                <div className="text-[9px] text-slate-400 uppercase font-medium leading-tight mb-2">
                  <p>{school?.address || ''}</p>
                  {school?.creationDecree && <p>DECRETO: {school.creationDecree}</p>}
                  {school?.authorization && <p>AUTORIZAÇÃO/PARECER: {school.authorization}</p>}
                  {school?.resolution && <p>RESOLUÇÃO: {school.resolution}</p>}
                </div>
                <h3 className="text-lg font-bold text-emerald-400">{student.firstName || ''} {student.lastName || ''}</h3>
                <p className="text-xs text-slate-400">Matrícula: {student.registrationNumber || '---'} | Turma: {classes[student.classId || ''] || '---'}</p>
              </div>
            </div>
            <GraduationCap size={48} className="text-emerald-500 opacity-50" />
          </div>
        </div>

        <div className="p-8">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Componente Curricular</th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">C.H.</th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">1º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">2º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">3º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">4º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Média</th>
                <th className="py-4 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Total Faltas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                // Group grades and absences by subject name
                const groupedData: Record<string, { 
                  grades: Record<string, number>, 
                  absences: Record<string, number>,
                  workload?: number 
                }> = {};

                // Process grades
                studentGrades.forEach(grade => {
                  const subjectId = grade.subjectId || 'default';
                  const subjectName = subjectId === 'default' ? 'FALTAS' : (subjects[subjectId]?.name || 'FALTAS');
                  const workload = subjects[subjectId]?.workload;
                  
                  if (!groupedData[subjectName]) {
                    groupedData[subjectName] = { grades: {}, absences: {}, workload };
                  }
                  groupedData[subjectName].grades[grade.period] = grade.value;
                  if (workload) groupedData[subjectName].workload = workload;
                });

                // Process absences
                const globalAbsences: Record<string, number> = {};
                Object.entries(studentAbsences).forEach(([subjectId, abs]) => {
                  const subjectName = subjectId === 'default' ? 'FALTAS' : (subjects[subjectId]?.name || 'FALTAS');
                  if (!groupedData[subjectName]) {
                    groupedData[subjectName] = { grades: {}, absences: {} };
                  }
                  
                  Object.entries(abs as Record<string, number>).forEach(([period, count]) => {
                    groupedData[subjectName].absences[period] = (groupedData[subjectName].absences[period] || 0) + count;
                    globalAbsences[period] = (globalAbsences[period] || 0) + count;
                  });
                });

                if (classList.find(c => c.id === student.classId)?.educationLevel !== 'Ensino Fundamental I' && Object.keys(studentAbsences).length > 0) {
                  if (!groupedData['FALTAS']) {
                    groupedData['FALTAS'] = { grades: {}, absences: {} };
                  }
                  groupedData['FALTAS'].absences = globalAbsences;
                }

                const entries = Object.entries(groupedData).sort((a, b) => {
                  if (a[0] === 'FALTAS') return 1;
                  if (b[0] === 'FALTAS') return -1;
                  return a[0].localeCompare(b[0]);
                });

                return entries.map(([subjectName, data]) => {
                  const b1 = data.grades['1º Bimestre'] || 0;
                  const b2 = data.grades['2º Bimestre'] || 0;
                  const b3 = data.grades['3º Bimestre'] || 0;
                  const b4 = data.grades['4º Bimestre'] || 0;
                  
                  const f1 = data.absences['1º Bimestre'] || 0;
                  const f2 = data.absences['2º Bimestre'] || 0;
                  const f3 = data.absences['3º Bimestre'] || 0;
                  const f4 = data.absences['4º Bimestre'] || 0;
                  
                  const count = [b1, b2, b3, b4].filter(v => v > 0).length;
                  const rawMedia = count > 0 ? (b1 + b2 + b3 + b4) / count : 0;
                  const media = rawMedia > 0 ? roundAverage(rawMedia) : 0;
                  const fTotal = (data.absences['Total'] || 0) + f1 + f2 + f3 + f4;

                  return (
                    <tr key={subjectName} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-semibold text-slate-800">{subjectName}</td>
                      <td className="py-4 text-center text-slate-500 font-medium">{data.workload ? `${data.workload}h` : '-'}</td>
                      <td className="py-4 text-center text-slate-500">
                        <span className="font-bold">{subjectName === 'FALTAS' ? '-' : (b1 > 0 ? b1.toFixed(2).replace('.', ',') : '-')}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="text-red-500 text-sm">{subjectName === 'FALTAS' ? f1 : (f1 > 0 ? f1 : '-')}</span>
                      </td>
                      <td className="py-4 text-center text-slate-500">
                        <span className="font-bold">{subjectName === 'FALTAS' ? '-' : (b2 > 0 ? b2.toFixed(2).replace('.', ',') : '-')}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="text-red-500 text-sm">{subjectName === 'FALTAS' ? f2 : (f2 > 0 ? f2 : '-')}</span>
                      </td>
                      <td className="py-4 text-center text-slate-500">
                        <span className="font-bold">{subjectName === 'FALTAS' ? '-' : (b3 > 0 ? b3.toFixed(2).replace('.', ',') : '-')}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="text-red-500 text-sm">{subjectName === 'FALTAS' ? f3 : (f3 > 0 ? f3 : '-')}</span>
                      </td>
                      <td className="py-4 text-center text-slate-500">
                        <span className="font-bold">{subjectName === 'FALTAS' ? '-' : (b4 > 0 ? b4.toFixed(2).replace('.', ',') : '-')}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="text-red-500 text-sm">{subjectName === 'FALTAS' ? f4 : (f4 > 0 ? f4 : '-')}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className={`px-3 py-1 rounded-full font-bold ${subjectName === 'FALTAS' ? 'bg-slate-100 text-slate-400' : (media >= 6 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}`}>
                          {subjectName === 'FALTAS' ? '-' : (media > 0 ? media.toFixed(2).replace('.', ',') : '-')}
                        </span>
                      </td>
                      <td className="py-4 text-center font-bold text-slate-600">
                        {fTotal}
                      </td>
                    </tr>
                  );
                });
              })()}
              {studentGrades.length === 0 && Object.keys(studentAbsences).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">Nenhum registro encontrado para este aluno.</td>
                </tr>
              )}
            </tbody>
          </table>

          {studentGrades.length > 0 && (
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-500 font-medium">Média Geral</p>
                <p className="text-3xl font-bold text-slate-900">
                  {roundAverage(studentGrades.reduce((acc, g) => acc + g.value, 0) / studentGrades.length).toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 font-medium">Status Final</p>
                <p className={`text-xl font-bold ${roundAverage(studentGrades.reduce((acc, g) => acc + g.value, 0) / studentGrades.length) >= 6 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {roundAverage(studentGrades.reduce((acc, g) => acc + g.value, 0) / studentGrades.length) >= 6 ? 'APROVADO' : 'EM RECUPERAÇÃO'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 print:p-0 print:m-0">
      <style>{`
        @media print {
          @page { margin: 1cm; size: landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .no-print { display: none !important; }
          .print-container { display: block !important; width: 100%; }
          .page-break-after-always { page-break-after: always; break-after: page; }
        }
      `}</style>

      {isPrintingAll && allClassData && (
        <div className="hidden print:block print-container">
          {allClassData.students.map(student => {
            const studentGrades = allClassData.grades.filter(g => g.studentId === student.id);
            const studentAbsences = allClassData.absences[student.id] || {};
            return renderReportCard(student, studentGrades, studentAbsences, true);
          })}
        </div>
      )}

      <div className="no-print">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              Fechar
            </button>
          </div>
        )}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Boletim Escolar</h1>
            <p className="text-slate-500">Consulta de rendimento acadêmico</p>
          </div>
          <div className="flex gap-3">
            {selectedClassId && (
              <button 
                onClick={handlePrintAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-semibold shadow-md"
              >
                <Printer size={18} />
                Imprimir Turma Completa
              </button>
            )}
            {selectedStudent && (
              <>
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all font-semibold"
                >
                  <Printer size={18} />
                  Imprimir Individual
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold shadow-md">
                  <Download size={18} />
                  PDF
                </button>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar por Turma</label>
              <select 
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm font-medium"
              >
                <option value="">Todas as Turmas</option>
                {classList.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar aluno..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedStudent?.id === student.id 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <p className="font-bold">{student.firstName} {student.lastName}</p>
                  <p className="text-xs opacity-70">Mat: {student.registrationNumber} | {classes[student.classId || '']}</p>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="text-center py-8 text-slate-400 text-sm italic">Nenhum aluno encontrado.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedStudent ? renderReportCard(selectedStudent, grades, absences) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 p-12 text-center">
                <GraduationCap size={64} className="mb-4 opacity-10" />
                <h3 className="text-xl font-bold text-slate-600 mb-2">Consulta de Boletim</h3>
                <p className="max-w-xs">Selecione um aluno na lista ao lado para visualizar o histórico de notas e rendimento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
