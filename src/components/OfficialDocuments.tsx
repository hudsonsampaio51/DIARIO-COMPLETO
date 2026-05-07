import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Student, Grade, Class } from '../types';
import { FileText, Printer, Search, GraduationCap, School, AlertCircle, ClipboardCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError } from '../utils/errorHandling';

interface OfficialDocumentsProps {
  schoolId: string;
}

export const OfficialDocuments: React.FC<OfficialDocumentsProps> = ({ schoolId }) => {
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
  const [docType, setDocType] = useState<'declaration' | 'transcript' | 'report' | 'stub' | 'boletim'>('declaration');
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
      } catch (error) {
        handleFirestoreError(error, 'list' as any, 'students/classes');
        setError('Erro ao carregar dados dos alunos.');
      }
    };
    fetchData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedStudent && (docType === 'transcript' || docType === 'boletim')) {
      const fetchGradesAndAttendance = async () => {
        try {
          const qGrades = query(
            collection(db, 'grades'), 
            where('studentId', '==', selectedStudent.id)
          );
          const snapGrades = await getDocs(qGrades);
          setGrades(snapGrades.docs.map(d => ({ id: d.id, ...d.data() as any } as Grade)));

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
            const period = data.period || 'Total';
            if (!absencesMap[subjectId]) absencesMap[subjectId] = {};
            absencesMap[subjectId][period] = (absencesMap[subjectId][period] || 0) + 1;
          });
          setAbsences(absencesMap as any);
        } catch (error) {
          handleFirestoreError(error, 'list' as any, 'grades/attendance');
          setError('Erro ao carregar histórico de notas e faltas.');
        }
      };
      fetchGradesAndAttendance();
    }
  }, [selectedStudent, docType]);

  const handlePrint = () => {
    window.print();
  };

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
      handleFirestoreError(error, 'list' as any, 'bulk_documents');
      setError('Erro ao gerar documentos da turma.');
      setIsPrintingAll(false);
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

  const renderDocument = (student: Student, studentGrades: Grade[], studentAbsences: Record<string, Record<string, number>>, isBulk = false) => {
    return (
      <div key={student.id} className={`bg-white p-6 shadow-xl border border-slate-100 min-h-[800px] print:shadow-none print:border-none print:p-0 ${isBulk ? 'mb-8 page-break-after-always' : ''}`}>
        {/* Document Header */}
        <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-center mb-4">
            <img 
              src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
              alt={school?.name || 'Brasão'} 
              className="h-16 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{school?.state || 'ESTADO'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{school?.municipality || 'PREFEITURA DO MUNICÍPIO'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secretaria Municipal de Educação</p>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{school?.name || 'NOME DA ESCOLA'}</h2>
          <div className="text-[10px] text-slate-600 mt-2 uppercase font-medium leading-relaxed">
            <p>{school?.address || 'ENDEREÇO'}</p>
            {school?.creationDecree && <p>DECRETO: {school.creationDecree}</p>}
            {school?.authorization && <p>AUTORIZAÇÃO/PARECER: {school.authorization}</p>}
            {school?.resolution && <p>RESOLUÇÃO: {school.resolution}</p>}
            <p>Ano Letivo {school?.schoolYear || '---'}</p>
          </div>
        </div>

        {docType === 'declaration' ? (
          <div className="space-y-4 text-slate-800 leading-relaxed">
            <h3 className="text-xl font-bold text-center uppercase underline mb-6">Declaração de Matrícula</h3>
            
            <p className="text-justify indent-12">
              Declaramos para os devidos fins que o(a) aluno(a) <strong className="uppercase">{student.firstName || ''} {student.lastName || ''}</strong>, 
              portador(a) da matrícula nº <strong>{student.registrationNumber || '---'}</strong>, CPF nº <strong>{student.cpf || '---'}</strong>, 
              nascido(a) em <strong>{student.birthDate || '---'}</strong> na cidade de <strong>{student.birthPlace || '---'}</strong>, 
              encontra-se regularmente matriculado(a) e frequentando as aulas nesta instituição de ensino no presente ano letivo.
            </p>

            <p className="text-justify indent-12">
              Informamos ainda que o referido aluno reside em <strong>{student.address?.street || '---'}, nº {student.address?.number || '---'}, {student.address?.neighborhood || '---'}, {student.address?.city || '---'} - CEP: {student.address?.cep || '---'}</strong>, 
              e possui cadastro ativo sob a responsabilidade de 
              <strong> {student.guardianFirstName || '---'} {student.guardianLastName || '---'}</strong>, CPF nº <strong>{student.guardianCpf || '---'}</strong>.
            </p>

            <div className="pt-12 text-center space-y-8">
              <p>Ji-Paraná, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              
              <div className="flex justify-center gap-24 pt-8">
                <div className="text-center">
                  <div className="w-64 border-t border-slate-900 mx-auto mb-2"></div>
                  <p className="text-xs font-bold uppercase">Secretaria Escolar</p>
                </div>
                <div className="text-center">
                  <div className="w-64 border-t border-slate-900 mx-auto mb-2"></div>
                  <p className="text-xs font-bold uppercase">Direção Geral</p>
                </div>
              </div>
            </div>
          </div>
        ) : docType === 'transcript' ? (
          <div className="space-y-4 text-slate-800">
            <h3 className="text-xl font-bold text-center uppercase underline mb-4">Histórico Escolar Parcial</h3>
            
            <div className="border border-slate-900 p-4 space-y-2 text-xs uppercase font-bold mb-4">
              <div className="flex gap-4">
                <p className="flex-1">NOME DO (A) ESTUDANTE: <span className="font-normal border-b border-slate-400 px-2">{student.firstName || ''} {student.lastName || ''}</span></p>
              </div>
              <div className="flex gap-8">
                <p>DATA DE NASC.: <span className="font-normal border-b border-slate-400 px-2">{student.birthDate || '---'}</span></p>
                <p className="flex-1">CIDADE: <span className="font-normal border-b border-slate-400 px-2">{student.address?.city || '---'}</span></p>
                <p>UF: <span className="font-normal border-b border-slate-400 px-2">{school?.state || '---'}</span></p>
              </div>
              <div>
                <p>NOME DO PAI: <span className="font-normal border-b border-slate-400 px-2">{student.fatherName || '---'}</span></p>
              </div>
              <div>
                <p>NOME DA MÃE: <span className="font-normal border-b border-slate-400 px-2">{student.motherName || '---'}</span></p>
              </div>
              <div className="flex justify-between gap-4 pt-2">
                <p>ANO LETIVO: <span className="font-normal border-b border-slate-400 px-2">{school?.schoolYear || '---'}</span></p>
                <p>ANO: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.grade || '---'}</span></p>
                <p>TURNO: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.shift || '---'}</span></p>
                <p>TURMA: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.name || '---'}</span></p>
                <p>Nº: <span className="font-normal border-b border-slate-400 px-2">{student.studentNumber || '---'}</span></p>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-2 text-left">Componente Curricular</th>
                  <th className="border border-slate-900 p-2 text-center">C.H.</th>
                  <th className="border border-slate-900 p-2 text-center">Período</th>
                  <th className="border border-slate-900 p-2 text-center">Nota Final</th>
                  <th className="border border-slate-900 p-2 text-center">Faltas</th>
                  <th className="border border-slate-900 p-2 text-center">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allSubjectIds = Array.from(new Set([...Object.keys(studentGrades.reduce((acc, grade) => {
                    const subjectId = grade.subjectId || 'default';
                    acc[subjectId] = true;
                    return acc;
                  }, {} as Record<string, boolean>)), ...Object.keys(studentAbsences)]));

                  const sortedSubjectIds = allSubjectIds.sort((a, b) => {
                    const nameA = subjects[a]?.name || 'FALTAS';
                    const nameB = subjects[b]?.name || 'FALTAS';
                    if (nameA === 'FALTAS') return 1;
                    if (nameB === 'FALTAS') return -1;
                    return 0;
                  });

                  return sortedSubjectIds.map((subjectId) => {
                    const subjectName = subjects[subjectId]?.name || 'FALTAS';
                    const subjectGradesList = studentGrades.filter(g => (g.subjectId || 'default') === subjectId);
                  const rawMedia = subjectGradesList.length > 0 ? subjectGradesList.reduce((acc, g) => acc + g.value, 0) / subjectGradesList.length : 0;
                  const media = rawMedia > 0 ? roundAverage(rawMedia) : 0;
                  
                  const abs = (studentAbsences as any)[subjectId] || {};
                  const fTotal = Object.values(abs).reduce((sum: any, val: any) => sum + val, 0) as number;

                  return (
                    <tr key={subjectId}>
                      <td className="border border-slate-900 p-2">{subjectName}</td>
                      <td className="border border-slate-900 p-2 text-center">{subjects[subjectId]?.workload ? `${subjects[subjectId].workload}h` : '-'}</td>
                      <td className="border border-slate-900 p-2 text-center">Ano Letivo</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{subjectName === 'FALTAS' ? '-' : (media > 0 ? media.toFixed(2).replace('.', ',') : '-')}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{fTotal}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">
                        {subjectName === 'FALTAS' ? '-' : (media >= 6 ? 'APROVADO' : media > 0 ? 'RECUPERAÇÃO' : '-')}
                      </td>
                    </tr>
                  );
                })})()}
                {studentGrades.length === 0 && Object.keys(studentAbsences).length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-slate-900 p-8 text-center italic text-slate-400">
                      Nenhum registro encontrado para este aluno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pt-12 text-center">
              <p className="text-xs mb-6">Documento emitido eletronicamente via Sistema EduGestão em {new Date().toLocaleString('pt-BR')}</p>
              <div className="w-64 border-t border-slate-900 mx-auto mb-2"></div>
              <p className="text-xs font-bold uppercase">Carimbo e Assinatura da Secretaria</p>
            </div>
          </div>
        ) : docType === 'boletim' ? (
          <div className="space-y-3 text-slate-800">
            <h3 className="text-xl font-bold text-center uppercase underline mb-2">Boletim Escolar</h3>
            
            <div className="border border-slate-900 p-4 space-y-2 text-xs uppercase font-bold">
              <div className="flex gap-4">
                <p className="flex-1">NOME DO (A) ESTUDANTE: <span className="font-normal border-b border-slate-400 px-2">{student.firstName || ''} {student.lastName || ''}</span></p>
              </div>
              <div className="flex gap-8">
                <p>DATA DE NASC.: <span className="font-normal border-b border-slate-400 px-2">{student.birthDate || '---'}</span></p>
                <p className="flex-1">CIDADE: <span className="font-normal border-b border-slate-400 px-2">{student.address?.city || '---'}</span></p>
                <p>UF: <span className="font-normal border-b border-slate-400 px-2">{school?.state || '---'}</span></p>
              </div>
              <div>
                <p>NOME DO PAI: <span className="font-normal border-b border-slate-400 px-2">{student.fatherName || '---'}</span></p>
              </div>
              <div>
                <p>NOME DA MÃE: <span className="font-normal border-b border-slate-400 px-2">{student.motherName || '---'}</span></p>
              </div>
              <div className="flex justify-between gap-4 pt-2">
                <p>ANO LETIVO: <span className="font-normal border-b border-slate-400 px-2">{school?.schoolYear || '---'}</span></p>
                <p>ANO: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.grade || '---'}</span></p>
                <p>TURNO: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.shift || '---'}</span></p>
                <p>TURMA: <span className="font-normal border-b border-slate-400 px-2">{classList.find(c => c.id === student.classId)?.name || '---'}</span></p>
                <p>Nº: <span className="font-normal border-b border-slate-400 px-2">{student.studentNumber || '---'}</span></p>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-2 text-left">Componente Curricular</th>
                  <th className="border border-slate-900 p-2 text-center">C.H.</th>
                  <th className="border border-slate-900 p-2 text-center">1º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                  <th className="border border-slate-900 p-2 text-center">2º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                  <th className="border border-slate-900 p-2 text-center">3º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                  <th className="border border-slate-900 p-2 text-center">4º Bim<br/><span className="text-[10px] font-normal">Nota | Faltas</span></th>
                  <th className="border border-slate-900 p-2 text-center">Média</th>
                  <th className="border border-slate-900 p-2 text-center">Total Faltas</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Group grades and absences by subject name
                  const groupedData: Record<string, { 
                    grades: Record<string, number>, 
                    absences: Record<string, number>,
                    workload?: number 
                  }> = {};

                  // Process grades
                  studentGrades.forEach(grade => {
                    const subjectName = subjects[grade.subjectId || '']?.name || 'Disciplina';
                    const workload = subjects[grade.subjectId || '']?.workload;
                    
                    if (!groupedData[subjectName]) {
                      groupedData[subjectName] = { grades: {}, absences: {}, workload };
                    }
                    // If multiple grades for same period/subject name, take the highest or average? 
                    // Usually they should be the same if they are duplicates.
                    // We'll take the latest one or just overwrite.
                    groupedData[subjectName].grades[grade.period] = grade.value;
                    if (workload) groupedData[subjectName].workload = workload;
                  });

                  // Process absences
                  Object.entries(studentAbsences).forEach(([subjectId, abs]) => {
                    const subjectName = subjects[subjectId]?.name || 'Disciplina';
                    if (!groupedData[subjectName]) {
                      groupedData[subjectName] = { grades: {}, absences: {} };
                    }
                    
                    Object.entries(abs as Record<string, number>).forEach(([period, count]) => {
                      groupedData[subjectName].absences[period] = (groupedData[subjectName].absences[period] || 0) + count;
                    });
                  });

                  const entries = Object.entries(groupedData).sort((a, b) => {
                    if (a[0] === 'FALTAS') return 1;
                    if (b[0] === 'FALTAS') return -1;
                    return 0;
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
                      <tr key={subjectName}>
                        <td className="border border-slate-900 p-2 font-bold">{subjectName}</td>
                        <td className="border border-slate-900 p-2 text-center">{data.workload ? `${data.workload}h` : '-'}</td>
                        <td className="border border-slate-900 p-2 text-center">
                          {subjectName === 'FALTAS' ? '-' : (b1 > 0 ? b1.toFixed(2).replace('.', ',') : '-')} <span className="text-slate-400">|</span> <span className="text-red-600">{f1 > 0 ? f1 : '-'}</span>
                        </td>
                        <td className="border border-slate-900 p-2 text-center">
                          {subjectName === 'FALTAS' ? '-' : (b2 > 0 ? b2.toFixed(2).replace('.', ',') : '-')} <span className="text-slate-400">|</span> <span className="text-red-600">{f2 > 0 ? f2 : '-'}</span>
                        </td>
                        <td className="border border-slate-900 p-2 text-center">
                          {subjectName === 'FALTAS' ? '-' : (b3 > 0 ? b3.toFixed(2).replace('.', ',') : '-')} <span className="text-slate-400">|</span> <span className="text-red-600">{f3 > 0 ? f3 : '-'}</span>
                        </td>
                        <td className="border border-slate-900 p-2 text-center">
                          {subjectName === 'FALTAS' ? '-' : (b4 > 0 ? b4.toFixed(2).replace('.', ',') : '-')} <span className="text-slate-400">|</span> <span className="text-red-600">{f4 > 0 ? f4 : '-'}</span>
                        </td>
                        <td className="border border-slate-900 p-2 text-center font-bold">{subjectName === 'FALTAS' ? '-' : (media > 0 ? media.toFixed(2).replace('.', ',') : '-')}</td>
                        <td className="border border-slate-900 p-2 text-center font-bold">{fTotal}</td>
                      </tr>
                    );
                  });
                })()}
                {studentGrades.length === 0 && Object.keys(studentAbsences).length === 0 && (
                  <tr>
                    <td colSpan={8} className="border border-slate-900 p-8 text-center italic text-slate-400">
                      Nenhum registro encontrado para este aluno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-8 text-slate-800">
            <div className="border-2 border-dashed border-slate-900 p-8 rounded-lg">
              <h3 className="text-lg font-bold uppercase mb-4">Canhoto de Entrega de Documentos</h3>
              <p className="text-sm mb-8">
                Recebi da Escola <strong>{school?.name || '---'}</strong> o documento solicitado referente ao aluno(a) 
                <strong> {student.firstName || ''} {student.lastName || ''}</strong>.
              </p>
              <div className="flex justify-between items-end pt-12">
                <div className="text-left">
                  <p className="text-xs">Ji-Paraná, ____/____/2024</p>
                </div>
                <div className="text-center">
                  <div className="w-64 border-t border-slate-900 mx-auto mb-2"></div>
                  <p className="text-xs font-bold uppercase">Assinatura do Responsável</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .page-break-after-always { page-break-after: always; }
          @page {
            margin: 1cm;
            size: auto;
          }
        }
      `}</style>

      {isPrintingAll && allClassData && (
        <div className="hidden print:block print-container">
          {allClassData.students.map(student => {
            const studentGrades = allClassData.grades.filter(g => g.studentId === student.id);
            const studentAbsences = allClassData.absences[student.id] || {};
            return renderDocument(student, studentGrades, studentAbsences, true);
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
            <h1 className="text-3xl font-bold text-slate-900">Documentos Oficiais</h1>
            <p className="text-slate-500">Emissão de declarações e históricos escolares</p>
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
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md"
              >
                <Printer size={20} />
                Imprimir Individual
              </button>
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
            
            <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
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
                  <p className="font-bold">{student.firstName || ''} {student.lastName || ''}</p>
                  <p className="text-xs opacity-70">Mat: {student.registrationNumber || '---'} | {classes[student.classId || '']}</p>
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Tipo de Documento</h3>
              <button
                onClick={() => setDocType('declaration')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${docType === 'declaration' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <FileText size={18} />
                Declaração de Matrícula
              </button>
              <button
                onClick={() => setDocType('transcript')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${docType === 'transcript' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <GraduationCap size={18} />
                Histórico Escolar
              </button>
              <button
                onClick={() => setDocType('boletim')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${docType === 'boletim' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <ClipboardCheck size={18} />
                Boletim Escolar
              </button>
              <button
                onClick={() => setDocType('stub')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${docType === 'stub' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <Printer size={18} />
                Canhoto de Entrega
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedStudent ? renderDocument(selectedStudent, grades, absences) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 p-12 text-center">
                <FileText size={64} className="mb-4 opacity-10" />
                <h3 className="text-xl font-bold text-slate-600 mb-2">Emissão de Documentos</h3>
                <p className="max-w-xs">Selecione um aluno e o tipo de documento desejado para gerar a visualização oficial.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
