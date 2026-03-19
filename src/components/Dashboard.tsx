import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { GraduationCap, Users, School, ClipboardCheck, AlertCircle } from 'lucide-react';
import { handleFirestoreError } from '../utils/errorHandling';
import { motion } from 'motion/react';

interface DashboardProps {
  schoolId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ schoolId }) => {
  const [stats, setStats] = useState({
    students: 0,
    staff: 0,
    classes: 0,
    attendance: 0
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let studentsSnap, staffSnap, classesSnap, attendanceSnap;

        if (schoolId) {
          const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
          const qStaff = query(collection(db, 'staff'), where('schoolId', '==', schoolId));
          const qClasses = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
          const qAttendance = query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

          [studentsSnap, staffSnap, classesSnap, attendanceSnap] = await Promise.all([
            getDocs(qStudents),
            getDocs(qStaff),
            getDocs(qClasses),
            getDocs(qAttendance)
          ]);
        } else {
          // If no schoolId, we can't fetch stats unless we are superadmin
          // For now, let's just return zeros to avoid permission errors
          setStats({ students: 0, staff: 0, classes: 0, attendance: 0 });
          return;
        }

        setStats({
          students: studentsSnap.size,
          staff: staffSnap.size,
          classes: classesSnap.size,
          attendance: attendanceSnap.size
        });
      } catch (error) {
        handleFirestoreError(error, 'list' as any, 'dashboard/stats');
        setError('Erro ao carregar estatísticas do dashboard.');
      }
    };
    fetchStats();
  }, [schoolId]);

  const cards = [
    { label: 'Total de Alunos', value: stats.students, icon: GraduationCap, color: 'bg-blue-500' },
    { label: 'Funcionários', value: stats.staff, icon: Users, color: 'bg-emerald-500' },
    { label: 'Turmas Ativas', value: stats.classes, icon: School, color: 'bg-purple-500' },
    { label: 'Registros de Presença', value: stats.attendance, icon: ClipboardCheck, color: 'bg-orange-500' },
  ];

  return (
    <div className="p-8">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            Fechar
          </button>
        </div>
      )}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">DASHBOARD TESTE</h1>
        <p className="text-slate-500">Visão geral do sistema educacional</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className={`${card.color} p-4 rounded-xl text-white`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Avisos Recentes</h2>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-semibold text-slate-800">Reunião de Professores</p>
                <p className="text-sm text-slate-500">Agendada para próxima sexta-feira às 14:00.</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Próximos Eventos</h2>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex flex-col items-center justify-center font-bold">
                  <span className="text-xs">MAR</span>
                  <span>{15 + i}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Conselho de Classe</p>
                  <p className="text-sm text-slate-500">Turmas do 9º ano</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
