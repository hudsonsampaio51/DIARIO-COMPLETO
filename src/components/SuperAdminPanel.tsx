import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { School, UserProfile, Student, Staff, Class } from '../types';
import { Plus, Trash2, Edit2, Save, X, Upload, FileSpreadsheet, Building2, ShieldCheck, AlertCircle, Search, Download, UserPlus, Users as UsersIcon, Database, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export const SuperAdminPanel: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [importType, setImportType] = useState<'students' | 'staff' | 'censo' | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  const [formData, setFormData] = useState<Partial<School>>({
    name: '',
    state: '',
    municipality: '',
    address: '',
    creationDecree: '',
    authorization: '',
    resolution: '',
    phone: '',
    email: '',
    site: '',
    blog: '',
    schoolCode: '',
    logoUrl: ''
  });

  const [activeSubTab, setActiveSubTab] = useState<'schools' | 'users' | 'backup'>('schools');
  const [userFormData, setUserFormData] = useState({ email: '', role: 'admin' as UserProfile['role'], name: '', schoolId: '' });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchSchools();
    fetchUsers();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'schools'));
      setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() } as School)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'schools');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (!userFormData.email || !userFormData.schoolId) {
        setFeedback({ message: 'E-mail e Escola são obrigatórios!', type: 'error' });
        return;
      }

      const email = userFormData.email.toLowerCase();
      // Check if user already exists
      const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          const existingData = existingDoc.data();
          let updatedSchoolIds = existingData.schoolIds || [];
          if (existingData.schoolId && !updatedSchoolIds.includes(existingData.schoolId)) {
              updatedSchoolIds.push(existingData.schoolId);
          }
          if (!updatedSchoolIds.includes(userFormData.schoolId)) {
              updatedSchoolIds.push(userFormData.schoolId);
              await updateDoc(doc(db, 'users', existingDoc.id), {
                  schoolIds: updatedSchoolIds
              });
              setFeedback({ message: `Usuário ${email} já existia e foi vinculado à nova escola!`, type: 'success' });
          } else {
              setFeedback({ message: `O e-mail ${email} já está vinculado à escola selecionada.`, type: 'error' });
              return;
          }
      } else {
          // Pre-register user by email
          const userRef = doc(collection(db, 'users'));
          await setDoc(userRef, {
            email: email,
            role: userFormData.role,
            schoolId: userFormData.schoolId,
            schoolIds: [userFormData.schoolId],
            name: userFormData.name || 'Usuário Pendente',
            createdAt: new Date().toISOString()
          });
          setFeedback({ message: 'Usuário cadastrado com sucesso!', type: 'success' });
      }

      setUserFormData({ email: '', role: 'admin', name: '', schoolId: '' });
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Remover acesso deste usuário?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setFeedback({ message: 'Acesso removido!', type: 'success' });
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const handleSaveSchool = async () => {
    try {
      if (!formData.name || !formData.state || !formData.municipality || !formData.schoolCode) {
        setFeedback({ message: 'Preencha os campos obrigatórios!', type: 'error' });
        return;
      }

      const data = {
        ...formData,
        createdAt: new Date().toISOString()
      };

      if (editingSchool) {
        await updateDoc(doc(db, 'schools', editingSchool.id), data);
        setFeedback({ message: 'Escola atualizada com sucesso!', type: 'success' });
      } else {
        await addDoc(collection(db, 'schools'), data);
        setFeedback({ message: 'Escola cadastrada com sucesso!', type: 'success' });
      }

      setShowForm(false);
      setEditingSchool(null);
      setFormData({
        name: '', state: '', municipality: '', address: '', creationDecree: '',
        authorization: '', resolution: '', phone: '', email: '', site: '',
        blog: '', schoolCode: '', logoUrl: ''
      });
      fetchSchools();
    } catch (error) {
      handleFirestoreError(error, editingSchool ? OperationType.UPDATE : OperationType.CREATE, 'schools');
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta escola? Todos os dados vinculados serão mantidos, mas a escola não será mais acessível.')) return;
    try {
      await deleteDoc(doc(db, 'schools', id));
      setFeedback({ message: 'Escola removida!', type: 'success' });
      fetchSchools();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'schools');
    }
  };

  const handleImportCenso = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      try {
        setFeedback({ message: 'Processando arquivo do Censo...', type: 'success' });

        const schoolMap = new Map<string, string>(); // inep -> docId
        const classMap = new Map<string, string>(); // classInep -> docId
        const personMap = new Map<string, string>(); // personInep -> docId
        
        let batch = writeBatch(db);
        let count = 0;

        const commitBatch = async () => {
          if (count > 0) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        };

        // Phase 1: Schools (00) and Classes (20)
        for (const line of lines) {
          const parts = line.split('|');
          const type = parts[0];

          if (type === '00') {
            const inep = parts[1];
            const name = parts[5];
            const email = parts[16];
            
            const q = query(collection(db, 'schools'), where('schoolCode', '==', inep));
            const snap = await getDocs(q);
            let schoolId;
            
            if (!snap.empty) {
              schoolId = snap.docs[0].id;
            } else {
              const newSchoolRef = doc(collection(db, 'schools'));
              schoolId = newSchoolRef.id;
              batch.set(newSchoolRef, {
                name,
                schoolCode: inep,
                email: email || '',
                createdAt: new Date().toISOString(),
                municipality: parts[8] || '',
                state: 'RO'
              });
              count++;
              if (count >= 500) await commitBatch();
            }
            schoolMap.set(inep, schoolId);
          }

          if (type === '20') {
            const schoolInep = parts[1];
            const classInep = parts[3];
            const className = parts[4];
            const schoolId = schoolMap.get(schoolInep);

            if (schoolId) {
              const newClassRef = doc(collection(db, 'classes'));
              batch.set(newClassRef, {
                name: className,
                inepCode: classInep,
                schoolId,
                educationLevel: className.includes('Fundamental') ? 'Ensino Fundamental II' : 'Ensino Fundamental I',
                shift: parts[6] === '01' ? 'Matutino' : 'Vespertino',
                createdAt: new Date().toISOString()
              });
              count++;
              if (count >= 500) await commitBatch();
              classMap.set(classInep, newClassRef.id);
            }
          }
        }

        // Phase 2: Persons (30)
        for (const line of lines) {
          const parts = line.split('|');
          if (parts[0] === '30') {
            const schoolInep = parts[1];
            const personInep = parts[3];
            const cpf = parts[4];
            const name = parts[5];
            const birthDate = parts[6];
            const schoolId = schoolMap.get(schoolInep);

            if (schoolId) {
              const newStudentRef = doc(collection(db, 'students'));
              
              // Split name into firstName and lastName for the UI
              const nameParts = name.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              batch.set(newStudentRef, {
                firstName,
                lastName,
                name, // Keep full name for reference
                inepCode: personInep,
                cpf,
                birthDate,
                schoolId,
                status: 'active',
                createdAt: new Date().toISOString()
              });
              count++;
              if (count >= 500) await commitBatch();
              personMap.set(personInep, newStudentRef.id);
            }
          }
        }

        // Phase 3: Enrollments (60)
        for (const line of lines) {
          const parts = line.split('|');
          if (parts[0] === '60') {
            const studentInep = parts[3];
            const classInep = parts[5];
            const studentId = personMap.get(studentInep);
            const classId = classMap.get(classInep);

            if (studentId && classId) {
              batch.update(doc(db, 'students', studentId), { classId });
              count++;
              if (count >= 500) await commitBatch();
            }
          }
        }

        await commitBatch();
        setFeedback({ message: 'Importação do Censo concluída com sucesso!', type: 'success' });
        fetchSchools();
        setImportType(null);
      } catch (error) {
        console.error(error);
        setFeedback({ message: 'Erro ao processar arquivo do Censo.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importType) return;

    if (importType === 'censo') {
      handleImportCenso(file);
      return;
    }

    if (!selectedSchoolId) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const collectionName = importType === 'students' ? 'students' : importType === 'staff' ? 'staff' : 'censo_data';
          
          results.data.forEach((row: any) => {
            const newDocRef = doc(collection(db, collectionName));
            batch.set(newDocRef, {
              ...row,
              schoolId: selectedSchoolId,
              createdAt: new Date().toISOString()
            });
          });

          await batch.commit();
          setFeedback({ message: `Importação de ${results.data.length} registros concluída!`, type: 'success' });
          setImportType(null);
        } catch (error) {
          setFeedback({ message: 'Erro na importação. Verifique o formato do arquivo.', type: 'error' });
        }
      }
    });
  };

  const handleExportGlobalBackup = async () => {
    try {
      setFeedback({ message: 'Preparando backup global...', type: 'success' });
      const collectionsToBackup = [
        'schools', 'students', 'staff', 'classes', 'subjects', 'grades', 
        'attendance', 'occurrences', 'classSessions', 'classSchedules', 'users'
      ];
      
      const backupData: any = {
        exportDate: new Date().toISOString(),
        type: 'global',
        collections: {}
      };

      for (const colName of collectionsToBackup) {
        const snap = await getDocs(collection(db, colName));
        backupData.collections[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_global_sistema_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFeedback({ message: 'Backup global concluído!', type: 'success' });
    } catch (error) {
      console.error("Global backup error:", error);
      setFeedback({ message: 'Erro ao gerar backup global.', type: 'error' });
    }
  };

  const handleImportGlobalBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('ATENÇÃO: A restauração global irá sobrescrever dados em todo o sistema. Deseja continuar?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        
        if (!backupData.collections || typeof backupData.collections !== 'object' || backupData.type !== 'global') {
          throw new Error('Formato de backup global inválido.');
        }

        setLoading(true);
        setFeedback({ message: 'Restaurando sistema...', type: 'success' });

        let batch = writeBatch(db);
        let operationCount = 0;

        for (const [colName, docs] of Object.entries(backupData.collections)) {
          const documents = docs as any[];
          for (const docData of documents) {
            const { id, ...data } = docData;
            const docRef = doc(db, colName as string, id);
            batch.set(docRef, data, { merge: true });
            operationCount++;

            if (operationCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              operationCount = 0;
            }
          }
        }

        if (operationCount > 0) {
          await batch.commit();
        }

        setFeedback({ message: 'Restauração global concluída!', type: 'success' });
        fetchSchools();
        fetchUsers();
      } catch (error) {
        console.error("Global restore error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Verifique o arquivo.';
        setFeedback({ message: `Erro na restauração global: ${errorMessage}`, type: 'error' });
      } finally {
        setLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Painel SuperAdmin</h1>
          <div className="flex gap-4 mt-4">
            <button 
              onClick={() => setActiveSubTab('schools')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'schools' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >
              Escolas
            </button>
            <button 
              onClick={() => setActiveSubTab('users')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >
              Usuários e Acessos
            </button>
            <button 
              onClick={() => setActiveSubTab('backup')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'backup' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >
              Backup Global
            </button>
          </div>
        </div>
        {activeSubTab === 'schools' ? (
          <button
            onClick={() => { setShowForm(true); setEditingSchool(null); }}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={20} />
            Nova Escola
          </button>
        ) : (
          <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <input 
              type="email" 
              placeholder="E-mail do Administrador"
              value={userFormData.email}
              onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
              className="px-4 py-2 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <select 
              value={userFormData.schoolId}
              onChange={e => setUserFormData({ ...userFormData, schoolId: e.target.value })}
              className="px-4 py-2 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="">Selecionar Escola...</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={handleSaveUser}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all"
            >
              <UserPlus size={18} />
              Vincular
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeSubTab === 'schools' ? (
            <>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="text-emerald-600" />
                Escolas Cadastradas
              </h2>
              
              {loading ? (
                <div className="h-64 flex items-center justify-center bg-white rounded-3xl border border-slate-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schools.map(school => (
                    <motion.div
                      key={school.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100">
                          {school.logoUrl ? (
                            <img src={school.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingSchool(school); setFormData(school); setShowForm(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSchool(school.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mb-1">{school.name}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">{school.municipality} - {school.state}</p>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Código:</span>
                          <span className="font-mono font-bold">{school.schoolCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-medium">{school.email}</span>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                        <button 
                          onClick={() => { setSelectedSchoolId(school.id); setImportType('students'); }}
                          className="flex-1 text-[10px] font-bold uppercase tracking-wider py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                        >
                          Importar Alunos
                        </button>
                        <button 
                          onClick={() => { setSelectedSchoolId(school.id); setImportType('staff'); }}
                          className="flex-1 text-[10px] font-bold uppercase tracking-wider py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-all"
                        >
                          Importar RH
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          ) : activeSubTab === 'backup' ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-100">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Database className="text-emerald-600 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Backup Global do Sistema</h2>
                <p className="text-slate-500 mb-8">
                  Esta ferramenta permite exportar e restaurar TODOS os dados de TODAS as escolas cadastradas no sistema. Use com extrema cautela.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Download size={18} className="text-emerald-600" />
                      Exportar Tudo
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Gera um arquivo JSON completo com escolas, alunos, professores, notas e usuários de todo o sistema.
                    </p>
                    <button
                      onClick={handleExportGlobalBackup}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md"
                    >
                      Baixar Backup Global
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Upload size={18} className="text-blue-600" />
                      Restaurar Sistema
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Restaura o sistema completo a partir de um arquivo de backup global.
                    </p>
                    <label className="block w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportGlobalBackup}
                        className="hidden"
                      />
                      Selecionar Arquivo Global
                    </label>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 text-left">
                  <AlertCircle className="text-red-600 shrink-0" size={24} />
                  <div className="text-sm text-red-800">
                    <p className="font-bold mb-1 uppercase tracking-wider">Aviso Crítico:</p>
                    <p>A restauração global é uma operação destrutiva que pode sobrescrever dados importantes em todas as escolas. Certifique-se de que o arquivo de backup é confiável e recente.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UsersIcon className="text-emerald-600" />
                Usuários e Permissões
              </h2>
              <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                {loadingUsers ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Usuário</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Papel</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Escola</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => (
                        <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {schools.find(s => s.id === u.schoolId)?.name || 'Nenhuma'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {u.role !== 'superadmin' && (
                              <button onClick={() => handleDeleteUser(u.uid)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick Stats / Actions */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" />
              Status Global
            </h2>
            <div className="space-y-6">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total de Escolas</p>
                <p className="text-4xl font-black">{schools.length}</p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Ações Rápidas</p>
                <button 
                  onClick={() => setImportType('censo')}
                  className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-sm font-bold"
                >
                  <FileSpreadsheet className="text-emerald-400" />
                  Importar Censo Escolar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle className="text-blue-500" size={20} />
              Dicas de Importação
            </h2>
            <ul className="space-y-3 text-sm text-slate-500 list-disc pl-4">
              <li>Use arquivos CSV com cabeçalho.</li>
              <li>Certifique-se que o CPF está formatado.</li>
              <li>A importação do Censo requer layout específico.</li>
              <li>Dados do Excel devem ser salvos como .csv</li>
            </ul>
          </div>
        </div>
      </div>

      {/* School Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {editingSchool ? 'Editar Escola' : 'Cadastrar Nova Escola'}
                  </h2>
                  <p className="text-slate-400 text-sm font-medium">Preencha os dados institucionais da unidade</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Escola</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="Ex: E.M.E.F. Ulisses Matosinho"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Código da Escola (INEP)</label>
                  <input
                    type="text"
                    value={formData.schoolCode}
                    onChange={e => setFormData({ ...formData, schoolCode: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="00000000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="Rondônia"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Prefeitura do Município</label>
                  <input
                    type="text"
                    value={formData.municipality}
                    onChange={e => setFormData({ ...formData, municipality: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="Ji-Paraná"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Decreto de Criação</label>
                  <input
                    type="text"
                    value={formData.creationDecree}
                    onChange={e => setFormData({ ...formData, creationDecree: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Autorização</label>
                  <input
                    type="text"
                    value={formData.authorization}
                    onChange={e => setFormData({ ...formData, authorization: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Resolução</label>
                  <input
                    type="text"
                    value={formData.resolution}
                    onChange={e => setFormData({ ...formData, resolution: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Site / Blog</label>
                  <input
                    type="text"
                    value={formData.site}
                    onChange={e => setFormData({ ...formData, site: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL do Logo</label>
                  <input
                    type="text"
                    value={formData.logoUrl}
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>

              <div className="mt-12 flex gap-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-8 py-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSchool}
                  className="flex-1 px-8 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingSchool ? 'Salvar Alterações' : 'Cadastrar Escola'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {importType && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Upload className="text-emerald-600 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                Importar {importType === 'students' ? 'Alunos' : importType === 'staff' ? 'RH' : 'Censo'}
              </h2>
              <p className="text-slate-500 mb-8 font-medium">
                Selecione um arquivo CSV para importar dados para a escola selecionada.
              </p>

              <div className="space-y-4">
                <label className="block w-full px-8 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all group">
                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="text-slate-300 group-hover:text-emerald-500 transition-colors" size={32} />
                    <span className="text-sm font-bold text-slate-400 group-hover:text-emerald-700 transition-colors">Selecionar Arquivo CSV</span>
                  </div>
                </label>
                
                <button
                  onClick={() => setImportType(null)}
                  className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
};
