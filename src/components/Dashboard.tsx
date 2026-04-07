import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, limit, where, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { GraduationCap, Users, School, ClipboardCheck, AlertCircle, Plus, Trash2, Calendar, Bell } from 'lucide-react';
import { handleFirestoreError } from '../utils/errorHandling';
import { motion } from 'motion/react';

interface DashboardProps {
  schoolId?: string;
}

interface Notice {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  createdAt: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ schoolId }) => {
  const [stats, setStats] = useState({
    students: 0,
    staff: 0,
    classes: 0,
    attendance: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', description: '' });
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '' });

  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (e) {
          console.error("Error fetching user role", e);
        }
      }
    };
    fetchUserRole();
  }, []);

  const canEdit = userRole === 'superadmin' || userRole === 'admin' || userRole === 'secretary';

  useEffect(() => {
    const fetchStatsAndData = async () => {
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

        if (schoolId) {
          try {
            const qNotices = query(collection(db, 'notices'), where('schoolId', '==', schoolId));
            const qEvents = query(collection(db, 'events'), where('schoolId', '==', schoolId));
            
            const [noticesSnap, eventsSnap] = await Promise.all([getDocs(qNotices), getDocs(qEvents)]);
            
            const fetchedNotices = noticesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
            fetchedNotices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setNotices(fetchedNotices.slice(0, 5));

            const fetchedEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event));
            fetchedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const upcomingEvents = fetchedEvents.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)));
            setEvents(upcomingEvents.slice(0, 5));
          } catch (e) {
            console.error("Error fetching notices/events", e);
          }
        }
      } catch (error) {
        handleFirestoreError(error, 'list' as any, 'dashboard/stats');
        setError('Erro ao carregar estatísticas do dashboard.');
      }
    };
    fetchStatsAndData();
  }, [schoolId]);

  const handleAddNotice = async () => {
    if (!newNotice.title || !newNotice.description || !schoolId) return;
    try {
      const docRef = await addDoc(collection(db, 'notices'), {
        schoolId,
        title: newNotice.title,
        description: newNotice.description,
        createdAt: new Date().toISOString()
      });
      setNotices([{ id: docRef.id, title: newNotice.title, description: newNotice.description, createdAt: new Date().toISOString() }, ...notices].slice(0, 5));
      setNewNotice({ title: '', description: '' });
      setShowAddNotice(false);
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'notices');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
      setNotices(notices.filter(n => n.id !== id));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `notices/${id}`);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.description || !newEvent.date || !schoolId) return;
    try {
      const docRef = await addDoc(collection(db, 'events'), {
        schoolId,
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date,
        createdAt: new Date().toISOString()
      });
      const updatedEvents = [...events, { id: docRef.id, title: newEvent.title, description: newEvent.description, date: newEvent.date, createdAt: new Date().toISOString() }];
      updatedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(updatedEvents.slice(0, 5));
      setNewEvent({ title: '', description: '', date: '' });
      setShowAddEvent(false);
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      setEvents(events.filter(e => e.id !== id));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `events/${id}`);
    }
  };

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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bell size={20} className="text-blue-500" />
              Avisos Recentes
            </h2>
            {canEdit && (
              <button 
                onClick={() => setShowAddNotice(!showAddNotice)}
                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={16} /> Adicionar
              </button>
            )}
          </div>

          {showAddNotice && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input 
                type="text" 
                placeholder="Título do aviso" 
                className="w-full mb-2 p-2 border border-slate-300 rounded-lg text-sm"
                value={newNotice.title}
                onChange={e => setNewNotice({...newNotice, title: e.target.value})}
              />
              <textarea 
                placeholder="Descrição" 
                className="w-full mb-3 p-2 border border-slate-300 rounded-lg text-sm"
                rows={2}
                value={newNotice.description}
                onChange={e => setNewNotice({...newNotice, description: e.target.value})}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddNotice(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Cancelar</button>
                <button onClick={handleAddNotice} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {notices.length === 0 ? (
              <p className="text-slate-500 text-sm italic">Nenhum aviso no momento.</p>
            ) : (
              notices.map(notice => (
                <div key={notice.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between group">
                  <div>
                    <p className="font-semibold text-slate-800">{notice.title}</p>
                    <p className="text-sm text-slate-500">{notice.description}</p>
                  </div>
                  {canEdit && (
                    <button 
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-emerald-500" />
              Próximos Eventos
            </h2>
            {canEdit && (
              <button 
                onClick={() => setShowAddEvent(!showAddEvent)}
                className="text-sm flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Plus size={16} /> Adicionar
              </button>
            )}
          </div>

          {showAddEvent && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input 
                type="text" 
                placeholder="Nome do evento" 
                className="w-full mb-2 p-2 border border-slate-300 rounded-lg text-sm"
                value={newEvent.title}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              />
              <input 
                type="date" 
                className="w-full mb-2 p-2 border border-slate-300 rounded-lg text-sm"
                value={newEvent.date}
                onChange={e => setNewEvent({...newEvent, date: e.target.value})}
              />
              <textarea 
                placeholder="Descrição (ex: Turmas do 9º ano)" 
                className="w-full mb-3 p-2 border border-slate-300 rounded-lg text-sm"
                rows={2}
                value={newEvent.description}
                onChange={e => setNewEvent({...newEvent, description: e.target.value})}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddEvent(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Cancelar</button>
                <button onClick={handleAddEvent} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Salvar</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-slate-500 text-sm italic">Nenhum evento programado.</p>
            ) : (
              events.map(event => {
                const eventDate = new Date(event.date + 'T12:00:00');
                const month = eventDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                const day = eventDate.getDate();
                
                return (
                  <div key={event.id} className="flex gap-4 items-center justify-between group p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex flex-col items-center justify-center font-bold shrink-0">
                        <span className="text-[10px] uppercase">{month}</span>
                        <span className="text-lg leading-none">{day}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{event.title}</p>
                        <p className="text-sm text-slate-500">{event.description}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <button 
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
