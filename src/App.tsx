import React, { useState } from 'react';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Secretary } from './components/Secretary';
import { SupervisorPanel } from './components/SupervisorPanel';
import { TeacherDiary } from './components/TeacherDiary';
import { ReportCard } from './components/ReportCard';
import { OfficialDocuments } from './components/OfficialDocuments';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, ArrowRight } from 'lucide-react';
import { ActiveSchoolProvider, useActiveSchool } from './components/ActiveSchoolContext';

const MainAppContent: React.FC<{ user: UserProfile, activeTab: string, setActiveTab: (tab: string) => void }> = ({ user, activeTab, setActiveTab }) => {
  const { activeSchoolId, userSchools, setActiveSchoolId } = useActiveSchool();

  if (!activeSchoolId && userSchools.length > 1) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 print:hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Building2 size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Bem-vindo, {user.name.split(' ')[0]}!</h1>
            <p className="text-slate-500 text-lg">Você está vinculado(a) a múltiplas escolas. Selecione a escola que deseja acessar agora.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {userSchools.map((school, index) => (
              <motion.button
                key={school.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setActiveSchoolId(school.id)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{school.name}</h3>
                  <p className="text-sm text-slate-500">{school.municipality} - {school.state}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard schoolId={activeSchoolId || ''} />;
      case 'secretary':
        return <Secretary schoolId={activeSchoolId || ''} />;
      case 'supervisor':
        return <SupervisorPanel schoolId={activeSchoolId || ''} />;
      case 'diary':
        return <TeacherDiary teacherId={user.uid} role={user.role} schoolId={activeSchoolId || ''} />;
      case 'report':
        return <ReportCard schoolId={activeSchoolId || ''} />;
      case 'documents':
        return <OfficialDocuments schoolId={activeSchoolId || ''} />;
      case 'superadmin':
        return <SuperAdminPanel />;
      default:
        return <Dashboard schoolId={activeSchoolId || ''} />;
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto print:block">
      <div className="print:hidden h-full flex-shrink-0">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={user.role} 
        />
      </div>
      
      <main className="flex-1 overflow-y-auto bg-slate-50 relative print:overflow-visible print:h-auto print:block print:bg-white print:p-0 print:m-0 print:w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full print:h-auto print:block"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white print:min-h-0 print:h-auto print:block">
      <Auth onUserChange={setUser} />
      
      {user && (
        <ActiveSchoolProvider user={user}>
          <MainAppContent user={user} activeTab={activeTab} setActiveTab={setActiveTab} />
        </ActiveSchoolProvider>
      )}
    </div>
  );
}
