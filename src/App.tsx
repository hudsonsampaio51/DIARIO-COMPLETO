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
import UserManagement from './components/UserManagement';
import LandingPage from './components/LandingPage';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    if (!user) return null;

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard schoolId={user.schoolId} />;
      case 'users':
        return <UserManagement currentUser={user} />;
      case 'secretary':
        return <Secretary schoolId={user.schoolId || ''} />;
      case 'supervisor':
        return <SupervisorPanel schoolId={user.schoolId || ''} />;
      case 'diary':
        return <TeacherDiary teacherId={user.uid} role={user.role} schoolId={user.schoolId || ''} />;
      case 'report':
        return <ReportCard schoolId={user.schoolId || ''} />;
      case 'documents':
        return <OfficialDocuments schoolId={user.schoolId || ''} />;
      case 'superadmin':
        return <SuperAdminPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Auth onUserChange={setUser} />
      
      {user ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            role={user.role} 
          />
          
          <main className="flex-1 overflow-y-auto bg-slate-50">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      ) : (
        <LandingPage />
      )}
    </div>
  );
}
