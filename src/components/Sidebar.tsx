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
  ShieldCheck,
  Building
} from 'lucide-react';
import { UserRole } from '../types';
import { useActiveSchool } from './ActiveSchoolContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
  const { activeSchoolId, setActiveSchoolId, userSchools } = useActiveSchool();
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'secretary', 'teacher', 'superadmin'] },
    { id: 'superadmin', label: 'Super Admin', icon: ShieldCheck, roles: ['superadmin'] },
    { id: 'secretary', label: 'Secretaria', icon: School, roles: ['admin', 'secretary'] },
    { id: 'supervisor', label: 'Supervisor', icon: Users, roles: ['admin', 'supervisor'] },
    { id: 'diary', label: 'Diário de Classe', icon: ClipboardCheck, roles: ['admin', 'teacher', 'supervisor'] },
    { id: 'report', label: 'Boletins', icon: GraduationCap, roles: ['admin', 'secretary', 'teacher', 'supervisor'] },
    { id: 'documents', label: 'Documentos', icon: FileText, roles: ['admin', 'secretary'] },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full flex-shrink-0 print:hidden">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <BookOpen className="text-emerald-500 w-8 h-8 flex-shrink-0" />
        <span className="text-xl font-bold text-white tracking-tight">EduManager</span>
      </div>
      
      {userSchools.length > 1 && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Escola Ativa</label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            <select
              value={activeSchoolId || ''}
              onChange={(e) => setActiveSchoolId(e.target.value)}
              className="w-full bg-slate-800 text-sm text-slate-200 border-none rounded-lg py-2.5 pl-10 pr-4 appearance-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
            >
              <option value="" disabled>Selecione uma escola</option>
              {userSchools.map(school => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${
              activeTab === item.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} className="flex-shrink-0" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 mt-auto flex-shrink-0">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-all">
          <Settings size={20} className="flex-shrink-0" />
          <span className="font-medium">Configurações</span>
        </button>
      </div>
    </div>
  );
};
