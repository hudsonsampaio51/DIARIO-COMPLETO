import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardCheck, 
  GraduationCap,
  Settings,
  School,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'secretary', 'teacher', 'superadmin'] },
    { id: 'superadmin', label: 'Super Admin', icon: ShieldCheck, roles: ['superadmin'] },
    { id: 'secretary', label: 'Secretaria', icon: School, roles: ['admin', 'secretary'] },
    { id: 'supervisor', label: 'Supervisor', icon: Users, roles: ['admin', 'supervisor'] },
    { id: 'diary', label: 'Diário de Classe', icon: ClipboardCheck, roles: ['admin', 'teacher'] },
    { id: 'report', label: 'Boletins', icon: GraduationCap, roles: ['admin', 'secretary', 'teacher'] },
    { id: 'documents', label: 'Documentos', icon: FileText, roles: ['admin', 'secretary'] },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <BookOpen className="text-emerald-500 w-8 h-8" />
        <span className="text-xl font-bold text-white tracking-tight">SISESCOLAR</span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-all">
          <Settings size={20} />
          <span className="font-medium">Configurações</span>
        </button>
      </div>
    </div>
  );
};
