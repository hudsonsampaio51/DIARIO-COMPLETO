import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Class, Subject, ClassSchedule, ClassSession, School, AcademicPeriod } from '../types';
import { Calendar, Clock, BookOpen, Plus, Trash2, ChevronRight, ShieldCheck, AlertCircle, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../utils/errorHandling';

interface SupervisorPanelProps {
  schoolId: string;
}

export const SupervisorPanel: React.FC<SupervisorPanelProps> = ({ schoolId }) => {
  console.log('SupervisorPanel rendered');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ show: boolean, id: string, collection: string, setter: any, list: any[] } | null>(null);
  
  const [newSubject, setNewSubject] = useState('');
  const [newSubjectWorkload, setNewSubjectWorkload] = useState<string>('');
  const [selectedStandardSubject, setSelectedStandardSubject] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [selectedSubjectForSession, setSelectedSubjectForSession] = useState('');
  const [newSessionSpecialType, setNewSessionSpecialType] = useState<string>('');
  const [selectedLessonNumber, setSelectedLessonNumber] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState('1º Bimestre');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [newSchedule, setNewSchedule] = useState({
    dayOfWeek: 'Segunda-feira',
    startTime: '',
    endTime: '',
    subjectId: ''
  });

  const [school, setSchool] = useState<School | null>(null);
  const [showPeriodConfig, setShowPeriodConfig] = useState(false);
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>([
    { name: '1º Bimestre', startDate: '', endDate: '' },
    { name: '2º Bimestre', startDate: '', endDate: '' },
    { name: '3º Bimestre', startDate: '', endDate: '' },
    { name: '4º Bimestre', startDate: '', endDate: '' },
  ]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
  };

  const daysOfWeek = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const standardSubjects = [
    'Português', 'Matemática', 'História', 'Geografia', 'Ciências', 
    'Artes', 'Educação Física', 'Inglês', 'Ensino Religioso', 'Literatura',
    'Redação', 'Biologia', 'Física', 'Química', 'Filosofia', 'Sociologia'
  ];

  useEffect(() => {
    const fetchClassesAndSchool = async () => {
      if (!schoolId) return;

      try {
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) {
          const schoolData = { id: schoolDoc.id, ...schoolDoc.data() } as School;
          setSchool(schoolData);
          if (schoolData.academicPeriods && schoolData.academicPeriods.length > 0) {
            setAcademicPeriods(schoolData.academicPeriods);
          }
        }

        const q = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
        const snap = await getDocs(q);
        setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Class)));
      } catch (error) {
        console.error("Error fetching initial data", error);
      }
    };
    fetchClassesAndSchool();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClass) {
      const fetchData = async () => {
        const subSnap = await getDocs(query(collection(db, 'subjects'), where('classId', '==', selectedClass.id), where('schoolId', '==', schoolId)));
        setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Subject)));

        const schedSnap = await getDocs(query(collection(db, 'schedules'), where('classId', '==', selectedClass.id), where('schoolId', '==', schoolId)));
        setSchedules(schedSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as ClassSchedule)));

        const sessSnap = await getDocs(query(collection(db, 'classSessions'), where('classId', '==', selectedClass.id), where('schoolId', '==', schoolId)));
        setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as ClassSession)).sort((a, b) => a.date.localeCompare(b.date)));
      };
      fetchData();
    }
  }, [selectedClass]);

  const handleAddSubject = async () => {
    if (!selectedClass) return;
    const subjectName = selectedStandardSubject === 'Outra' ? newSubject : selectedStandardSubject;
    if (!subjectName) return;

    try {
      const workload = parseInt(newSubjectWorkload) || 0;
      const docRef = await addDoc(collection(db, 'subjects'), {
        name: subjectName,
        classId: selectedClass.id,
        schoolId,
        workload
      });
      setSubjects([...subjects, { id: docRef.id, name: subjectName, classId: selectedClass.id, schoolId, workload }]);
      setNewSubject('');
      setNewSubjectWorkload('');
      setSelectedStandardSubject('');
      showFeedback('Disciplina adicionada com sucesso');
    } catch (error) {
      handleFirestoreError(error, 'create' as any, 'subjects');
    }
  };

  const handleUpdateWorkload = async (subjectId: string, workload: number) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'subjects', subjectId), { workload });
      setSubjects(subjects.map(s => s.id === subjectId ? { ...s, workload } : s));
      showFeedback('Carga horária atualizada');
    } catch (error) {
      handleFirestoreError(error, 'update' as any, `subjects/${subjectId}`);
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedClass || !newSchedule.startTime || !newSchedule.endTime || !newSchedule.subjectId) return;
    const data = { ...newSchedule, classId: selectedClass.id, schoolId };
    try {
      const docRef = await addDoc(collection(db, 'schedules'), data);
      setSchedules([...schedules, { id: docRef.id, ...data }]);
      showFeedback('Horário salvo com sucesso');
    } catch (error) {
      handleFirestoreError(error, 'create' as any, 'schedules');
    }
  };

  const handleAddSession = async () => {
    if (!selectedClass || !newSessionDate || !selectedSubjectForSession) {
      showFeedback('Selecione uma data, disciplina e aula', 'error');
      return;
    }

    // Check if this lesson slot is already taken for this date/class
    const isTaken = sessions.some(s => s.date === newSessionDate && s.lessonNumber === selectedLessonNumber);
    if (isTaken) {
      showFeedback('Este horário já está ocupado nesta data', 'error');
      return;
    }

    const data = {
      classId: selectedClass.id,
      subjectId: selectedSubjectForSession,
      date: newSessionDate,
      lessonNumber: selectedLessonNumber,
      classHours: 1, // Default to 1 hour per lesson slot
      specialType: newSessionSpecialType || null,
      period: selectedPeriod,
      schoolId,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await addDoc(collection(db, 'classSessions'), data);
      setSessions([...sessions, { id: docRef.id, ...data }].sort((a, b) => a.date.localeCompare(b.date)));
      setNewSessionSpecialType('');
      showFeedback('Aula agendada com sucesso');
    } catch (error) {
      handleFirestoreError(error, 'create' as any, 'classSessions');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentCalendarMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentCalendarMonth(newDate);
  };

  const handleDelete = async (coll: string, id: string, setter: any, list: any[]) => {
    try {
      await deleteDoc(doc(db, coll, id));
      setter(list.filter(item => item.id !== id));
      setShowConfirmModal(null);
      showFeedback('Registro excluído com sucesso');
    } catch (error) {
      handleFirestoreError(error, 'delete' as any, `${coll}/${id}`);
    }
  };

  const handleSavePeriods = async () => {
    try {
      await updateDoc(doc(db, 'schools', schoolId), {
        academicPeriods
      });
      setSchool(prev => prev ? { ...prev, academicPeriods } : null);
      setShowPeriodConfig(false);
      showFeedback('Períodos letivos atualizados com sucesso');
    } catch (error) {
      console.error("Error updating periods", error);
      showFeedback('Erro ao atualizar períodos letivos', 'error');
    }
  };

  return (
    <div className="p-8">
      {/* Configure Periods Modal */}
      {showPeriodConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => setShowPeriodConfig(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="text-indigo-600" />
              Configurar Períodos Letivos (Bimestres)
            </h2>
            <div className="space-y-6 mb-8">
              {academicPeriods.map((period, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                    <input
                      type="text"
                      value={period.name}
                      onChange={(e) => {
                        const newPeriods = [...academicPeriods];
                        newPeriods[idx].name = e.target.value;
                        setAcademicPeriods(newPeriods);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 mt-1"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
                    <input
                      type="date"
                      value={period.startDate}
                      onChange={(e) => {
                        const newPeriods = [...academicPeriods];
                        newPeriods[idx].startDate = e.target.value;
                        setAcademicPeriods(newPeriods);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 mt-1"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fim</label>
                    <input
                      type="date"
                      value={period.endDate}
                      onChange={(e) => {
                        const newPeriods = [...academicPeriods];
                        newPeriods[idx].endDate = e.target.value;
                        setAcademicPeriods(newPeriods);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPeriodConfig(false)}
                className="px-6 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePeriods}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-md"
              >
                Salvar Alterações
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Feedback Message */}
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

      {/* Confirm Delete Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Excluir Registro</h2>
            <p className="text-slate-500 mb-8">
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showConfirmModal.collection, showConfirmModal.id, showConfirmModal.setter, showConfirmModal.list)}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-md"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel do Supervisor</h1>
          <p className="text-slate-500">Gestão de disciplinas, horários e calendário letivo</p>
        </div>
        <button
          onClick={() => setShowPeriodConfig(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Settings size={20} className="text-indigo-600" />
          Configurar Períodos Letivos
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Selecionar Turma</h2>
          <div className="space-y-2">
            {classes.map(cls => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                  selectedClass?.id === cls.id 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                }`}
              >
                <div>
                  <p className="font-bold">{cls.name}</p>
                  <p className="text-xs opacity-70">{cls.grade} - {cls.shift}</p>
                  {cls.educationLevel && (
                    <p className="text-[10px] font-bold uppercase text-indigo-400 mt-1">{cls.educationLevel}</p>
                  )}
                </div>
                <ChevronRight size={16} className={selectedClass?.id === cls.id ? 'opacity-100' : 'opacity-0'} />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-8">
          {selectedClass ? (
            <>
              {/* Disciplinas */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                  <BookOpen size={24} />
                  <h2 className="text-xl font-bold">Disciplinas da Turma</h2>
                </div>
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-50 p-4 rounded-xl">
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Selecionar Disciplina</label>
                    <select 
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedStandardSubject}
                      onChange={e => setSelectedStandardSubject(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {standardSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      <option value="Outra">Outra (Digitar)...</option>
                    </select>
                  </div>

                  {selectedStandardSubject === 'Outra' && (
                    <div className="flex-1 space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Nome da Disciplina</label>
                      <input 
                        type="text" 
                        placeholder="Digite o nome da disciplina" 
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="w-32 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">C.H. Anual</label>
                    <input 
                      type="number" 
                      placeholder="Horas" 
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newSubjectWorkload}
                      onChange={e => setNewSubjectWorkload(e.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <button onClick={handleAddSubject} className="h-[42px] bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                      <Plus size={18} /> Adicionar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                      <div className="flex-1">
                        <span className="font-bold text-slate-700 block">{sub.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">C.H. Anual:</span>
                          <input 
                            type="number"
                            className="w-16 bg-transparent border-b border-slate-200 text-xs font-bold text-indigo-600 focus:border-indigo-500 outline-none"
                            defaultValue={sub.workload || 0}
                            onBlur={(e) => handleUpdateWorkload(sub.id, parseInt(e.target.value) || 0)}
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">h</span>
                        </div>
                      </div>
                      <button onClick={() => setShowConfirmModal({ show: true, id: sub.id, collection: 'subjects', setter: setSubjects, list: subjects })} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Horários */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                  <Clock size={24} />
                  <h2 className="text-xl font-bold">Horários de Aula</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-xl">
                  <select 
                    className="px-3 py-2 rounded-lg border border-slate-200 outline-none"
                    value={newSchedule.dayOfWeek}
                    onChange={e => setNewSchedule({...newSchedule, dayOfWeek: e.target.value})}
                  >
                    {daysOfWeek.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <input 
                    type="time" 
                    className="px-3 py-2 rounded-lg border border-slate-200 outline-none"
                    value={newSchedule.startTime}
                    onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})}
                  />
                  <input 
                    type="time" 
                    className="px-3 py-2 rounded-lg border border-slate-200 outline-none"
                    value={newSchedule.endTime}
                    onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})}
                  />
                  <select 
                    className="px-3 py-2 rounded-lg border border-slate-200 outline-none"
                    value={newSchedule.subjectId}
                    onChange={e => setNewSchedule({...newSchedule, subjectId: e.target.value})}
                  >
                    <option value="">Disciplina...</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                  <select 
                    className="px-3 py-2 rounded-lg border border-slate-200 outline-none"
                    value={(newSchedule as any).specialType || ''}
                    onChange={e => setNewSchedule({...newSchedule, specialType: e.target.value} as any)}
                  >
                    <option value="">Tipo: Normal</option>
                    <option value="C">Contra Turno (C)</option>
                    <option value="E">Estadia (E)</option>
                  </select>
                  <button onClick={handleAddSchedule} className="md:col-span-5 bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                    Salvar Horário
                  </button>
                </div>
                <div className="space-y-2">
                  {schedules.map(sched => (
                    <div key={sched.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/30">
                      <div className="flex gap-4 text-sm items-center">
                        <span className="font-bold text-indigo-600 w-24">{sched.dayOfWeek}</span>
                        <span className="text-slate-500">{sched.startTime} - {sched.endTime}</span>
                        <span className="font-semibold text-slate-700">{subjects.find(s => s.id === sched.subjectId)?.name}</span>
                        {(sched as any).specialType && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            (sched as any).specialType === 'C' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {(sched as any).specialType === 'C' ? 'C' : 'E'}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setShowConfirmModal({ show: true, id: sched.id, collection: 'schedules', setter: setSchedules, list: schedules })} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Calendário Letivo */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Calendar size={24} />
                    <h2 className="text-xl font-bold">Calendário de Aulas</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Período</label>
                      <select 
                        className="px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-medium"
                        value={selectedPeriod}
                        onChange={e => setSelectedPeriod(e.target.value)}
                      >
                        <option value="1º Bimestre">1º Bimestre</option>
                        <option value="2º Bimestre">2º Bimestre</option>
                        <option value="3º Bimestre">3º Bimestre</option>
                        <option value="4º Bimestre">4º Bimestre</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Disciplina</label>
                      <select 
                        className="px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-medium"
                        value={selectedSubjectForSession}
                        onChange={e => setSelectedSubjectForSession(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Aula</label>
                      <select 
                        className="px-4 py-2 rounded-xl border-2 border-indigo-200 outline-none text-sm font-bold bg-indigo-50"
                        value={newSessionSpecialType}
                        onChange={e => setNewSessionSpecialType(e.target.value)}
                      >
                        <option value="">Normal</option>
                        <option value="C">Contra Turno (C)</option>
                        <option value="E">Estadia (E)</option>
                      </select>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-bold text-orange-600 bg-orange-50 px-1 rounded">C = Contra Turno</span>
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 rounded">E = Estadia</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Aula do Dia</label>
                      <select 
                        className="px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-medium"
                        value={selectedLessonNumber}
                        onChange={e => setSelectedLessonNumber(parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>{n}ª Aula</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Monthly Calendar View */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronRight size={20} className="rotate-180" />
                      </button>
                      <span className="font-bold text-slate-700 capitalize">{formatMonthYear(currentCalendarMonth)}</span>
                      <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="text-[10px] font-bold text-slate-400 uppercase py-2">{day}</div>
                      ))}
                      {getDaysInMonth(currentCalendarMonth).map((date, i) => {
                        if (!date) return <div key={`empty-${i}`} className="aspect-square" />;
                        
                        const dateStr = date.toISOString().split('T')[0];
                        const isSelected = newSessionDate === dateStr;
                        const hasSessions = sessions.filter(s => s.date === dateStr);
                        
                        return (
                          <button
                            key={dateStr}
                            onClick={() => setNewSessionDate(dateStr)}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all border ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105 z-10' 
                                : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
                            }`}
                          >
                            <span className="text-sm font-bold">{date.getDate()}</span>
                            {hasSessions.length > 0 && !isSelected && (
                              <div className="flex gap-0.5 mt-1">
                                {hasSessions.slice(0, 3).map(s => (
                                  <div key={s.id} className="w-1 h-1 rounded-full bg-indigo-400" />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button 
                      onClick={handleAddSession}
                      disabled={!newSessionDate || !selectedSubjectForSession}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100"
                    >
                      <Plus size={20} /> Agendar {selectedLessonNumber}ª Aula
                    </button>
                  </div>

                  {/* List of Sessions for Selected Date or All */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {newSessionDate 
                          ? `Aulas em ${new Date(newSessionDate + 'T12:00:00').toLocaleDateString('pt-BR')}` 
                          : 'Aulas Registradas'}
                      </h3>
                      {!newSessionDate && (
                        <select 
                          className="px-2 py-1 rounded-lg border border-slate-200 outline-none text-xs font-medium text-slate-500"
                          value={selectedPeriod}
                          onChange={e => setSelectedPeriod(e.target.value)}
                        >
                          <option value="1º Bimestre">1º Bimestre</option>
                          <option value="2º Bimestre">2º Bimestre</option>
                          <option value="3º Bimestre">3º Bimestre</option>
                          <option value="4º Bimestre">4º Bimestre</option>
                        </select>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {(newSessionDate 
                        ? sessions.filter(s => s.date === newSessionDate)
                        : sessions.filter(s => (s as any).period === selectedPeriod || !(s as any).period).slice(-20).reverse()
                      ).map(sess => (
                        <div key={sess.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 relative group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                              <span className="text-[10px] font-bold text-indigo-600">{sess.lessonNumber}ª</span>
                              <span className="text-[9px] text-slate-400 uppercase">Aula</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-700">{subjects.find(s => s.id === sess.subjectId)?.name || '---'}</p>
                                {sess.specialType && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                    sess.specialType === 'C' 
                                      ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                      : 'bg-blue-100 text-blue-700 border-blue-200'
                                  }`}>
                                    {sess.specialType === 'C' ? 'CONTRA TURNO' : 'ESTADIA'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{new Date(sess.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowConfirmModal({ show: true, id: sess.id, collection: 'classSessions', setter: setSessions, list: sessions })} 
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                      {sessions.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                          <p>Nenhuma aula agendada</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              <Calendar size={64} className="mb-4 opacity-10" />
              <p className="font-medium">Selecione uma turma para gerenciar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
