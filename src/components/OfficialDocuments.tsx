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
        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Student)));
        
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
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.registrationNumber.includes(searchTerm);
    const matchesClass = selectedClassId ? s.classId === selectedClassId : true;
    return matchesSearch && matchesClass;
  });

  const renderDocument = (student: Student, studentGrades: Grade[], studentAbsences: Record<string, Record<string, number>>, isBulk = false) => {
    return (
      <div key={student.id} className={`bg-white p-12 shadow-xl border border-slate-100 min-h-[800px] print:shadow-none print:border-none print:p-0 ${isBulk ? 'mb-8 page-break-after-always' : ''}`}>
        {/* Document Header */}
        <div className="text-center mb-12 border-b-2 border-slate-900 pb-8">
          <div className="flex justify-center mb-6">
            <img 
              src={school?.logoUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bras%C3%A3o_de_Ji-Paran%C3%A1.png/200px-Bras%C3%A3o_de_Ji-Paran%C3%A1.png'} 
              alt={school?.name || 'Brasão'} 
              className="h-24 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{school?.state || 'ESTADO'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{school?.municipality || 'PREFEITURA DO MUNICÍPIO'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secretaria Municipal de Educação</p>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{school?.name || 'NOME DA ESCOLA'}</h2>
          <p className="text-xs text-slate-500 mt-2">{school?.address || 'ENDEREÇO'} - Ano Letivo {school?.schoolYear || '---'}</p>
        </div>

        {docType === 'declaration' ? (
          <div className="space-y-8 text-slate-800 leading-relaxed">
            <h3 className="text-xl font-bold text-center uppercase underline mb-12">Declaração de Matrícula</h3>
            
            <p className="text-justify indent-12">
              Declaramos para os devidos fins que o(a) aluno(a) <strong className="uppercase">{student.firstName} {student.lastName}</strong>, 
              portador(a) da matrícula nº <strong>{student.registrationNumber}</strong>, CPF nº <strong>{student.cpf}</strong>, 
              nascido(a) em <strong>{student.birthDate}</strong> na cidade de <strong>{student.birthPlace}</strong>, 
              encontra-se regularmente matriculado(a) e frequentando as aulas nesta instituição de ensino no presente ano letivo.
            </p>

            <p className="text-justify indent-12">
              Informamos ainda que o referido aluno reside em <strong>{student.address?.street || '---'}, nº {student.address?.number || '---'}, {student.address?.neighborhood || '---'}, {student.address?.city || '---'} - CEP: {student.address?.cep || '---'}</strong>, 
              e possui cadastro ativo sob a responsabilidade de 
              <strong> {student.guardianFirstName || '---'} {student.guardianLastName || '---'}</strong>, CPF nº <strong>{student.guardianCpf || '---'}</strong>.
            </p>

            <div className="pt-24 text-center space-y-12">
              <p>Ji-Paraná, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              
              <div className="flex justify-center gap-24 pt-12">
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
          <div className="space-y-8 text-slate-800">
            <h3 className="text-xl font-bold text-center uppercase underline mb-8">Histórico Escolar Parcial</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-8">
              <p><strong>ALUNO:</strong> {student.firstName} {student.lastName}</p>
              <p><strong>MATRÍCULA:</strong> {student.registrationNumber}</p>
              <p><strong>CPF:</strong> {student.cpf}</p>
              <p><strong>DATA DE NASCIMENTO:</strong> {student.birthDate || '---'}</p>
              <p><strong>LOCAL DE NASCIMENTO:</strong> {student.birthPlace || '---'}</p>
              <p><strong>SITUAÇÃO:</strong> {student.status === 'active' ? 'CURSANDO' : 'INATIVO'}</p>
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
                {Array.from(new Set([...Object.keys(studentGrades.reduce((acc, grade) => {
                    const subjectId = grade.subjectId || 'default';
                    acc[subjectId] = true;
                    return acc;
                  }, {} as Record<string, boolean>)), ...Object.keys(studentAbsences)])).map((subjectId) => {
                  const subjectGradesList = studentGrades.filter(g => (g.subjectId || 'default') === subjectId);
                  const media = subjectGradesList.length > 0 ? subjectGradesList.reduce((acc, g) => acc + g.value, 0) / subjectGradesList.length : 0;
                  
                  const abs = (studentAbsences as any)[subjectId] || {};
                  const fTotal = Object.values(abs).reduce((sum: any, val: any) => sum + val, 0) as number;

                  return (
                    <tr key={subjectId}>
                      <td className="border border-slate-900 p-2">{subjects[subjectId]?.name || 'Disciplina'}</td>
                      <td className="border border-slate-900 p-2 text-center">{subjects[subjectId]?.workload || '0'}h</td>
                      <td className="border border-slate-900 p-2 text-center">Ano Letivo</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{media > 0 ? media.toFixed(1) : '-'}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{fTotal}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">
                        {media >= 6 ? 'APROVADO' : media > 0 ? 'RECUPERAÇÃO' : '-'}
                      </td>
                    </tr>
                  );
                })}
                {studentGrades.length === 0 && Object.keys(studentAbsences).length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-slate-900 p-8 text-center italic text-slate-400">
                      Nenhum registro encontrado para este aluno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pt-24 text-center">
              <p className="text-xs mb-12">Documento emitido eletronicamente via Sistema EduGestão em {new Date().toLocaleString('pt-BR')}</p>
              <div className="w-64 border-t border-slate-900 mx-auto mb-2"></div>
              <p className="text-xs font-bold uppercase">Carimbo e Assinatura da Secretaria</p>
            </div>
          </div>
        ) : docType === 'boletim' ? (
          <div className="space-y-8 text-slate-800">
            <h3 className="text-xl font-bold text-center uppercase underline mb-8">Boletim Escolar</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-8">
              <p><strong>ALUNO:</strong> {student.firstName} {student.lastName}</p>
              <p><strong>TURMA:</strong> {classes[student.classId || ''] || '---'}</p>
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
                {Array.from(new Set([...Object.keys(studentGrades.reduce((acc, grade) => {
                    const subjectId = grade.subjectId || 'default';
                    if (!acc[subjectId]) acc[subjectId] = {};
                    acc[subjectId][grade.period] = grade.value;
                    return acc;
                  }, {} as Record<string, Record<string, number>>)), ...Object.keys(studentAbsences)])).map((subjectId) => {
                  const periods = studentGrades.filter(g => (g.subjectId || 'default') === subjectId).reduce((acc, grade) => {
                    acc[grade.period] = grade.value;
                    return acc;
                  }, {} as Record<string, number>);
                  
                  const b1 = periods['1º Bimestre'] || 0;
                  const b2 = periods['2º Bimestre'] || 0;
                  const b3 = periods['3º Bimestre'] || 0;
                  const b4 = periods['4º Bimestre'] || 0;
                  const count = [b1, b2, b3, b4].filter(v => v > 0).length;
                  const media = count > 0 ? (b1 + b2 + b3 + b4) / count : 0;

                  const abs = (studentAbsences as any)[subjectId] || {};
                  const f1 = abs['1º Bimestre'] || 0;
                  const f2 = abs['2º Bimestre'] || 0;
                  const f3 = abs['3º Bimestre'] || 0;
                  const f4 = abs['4º Bimestre'] || 0;
                  const fTotal = (abs['Total'] || 0) + f1 + f2 + f3 + f4;

                  return (
                    <tr key={subjectId}>
                      <td className="border border-slate-900 p-2 font-bold">{subjects[subjectId]?.name || 'Disciplina'}</td>
                      <td className="border border-slate-900 p-2 text-center">{subjects[subjectId]?.workload || '0'}h</td>
                      <td className="border border-slate-900 p-2 text-center">
                        {b1 > 0 ? b1.toFixed(1) : '-'} <span className="text-slate-400">|</span> <span className="text-red-600">{f1 > 0 ? f1 : '-'}</span>
                      </td>
                      <td className="border border-slate-900 p-2 text-center">
                        {b2 > 0 ? b2.toFixed(1) : '-'} <span className="text-slate-400">|</span> <span className="text-red-600">{f2 > 0 ? f2 : '-'}</span>
                      </td>
                      <td className="border border-slate-900 p-2 text-center">
                        {b3 > 0 ? b3.toFixed(1) : '-'} <span className="text-slate-400">|</span> <span className="text-red-600">{f3 > 0 ? f3 : '-'}</span>
                      </td>
                      <td className="border border-slate-900 p-2 text-center">
                        {b4 > 0 ? b4.toFixed(1) : '-'} <span className="text-slate-400">|</span> <span className="text-red-600">{f4 > 0 ? f4 : '-'}</span>
                      </td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{media > 0 ? media.toFixed(1) : '-'}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{fTotal}</td>
                    </tr>
                  );
                })}
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
                <strong> {student.firstName} {student.lastName}</strong>.
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
                Imprimir Todos da Turma
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
                  <p className="font-bold">{student.firstName} {student.lastName}</p>
                  <p className="text-xs opacity-70">Mat: {student.registrationNumber} | {classes[student.classId || '']}</p>
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
