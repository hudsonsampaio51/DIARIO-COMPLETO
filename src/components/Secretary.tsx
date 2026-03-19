import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, updateDoc, writeBatch, setDoc, query, where, limit } from 'firebase/firestore';
import { Student, Staff, Class, StaffRole, ClassShift, UserProfile, UserRole, Subject } from '../types';
import { Plus, Trash2, Edit2, Search, UserPlus, BookPlus, GraduationCap, FileUp, Download, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

const staffRoles: StaffRole[] = [
  'Professor', 
  'Diretor', 
  'Supervisor', 
  'Merendeira', 
  'Guarda', 
  'Secretaria', 
  'Auxiliar Administrativo', 
  'Serviços Gerais',
  'Administrador'
];

const classShifts: ClassShift[] = ['Matutino', 'Vespertino', 'Noturno', 'Integral'];

interface SecretaryProps {
  schoolId: string;
}

export const Secretary: React.FC<SecretaryProps> = ({ schoolId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'teachers' | 'staff' | 'classes' | 'users' | 'school'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [school, setSchool] = useState<any>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{ show: boolean, id: string, type: string } | null>(null);
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ address: {} });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fetchData = async () => {
    if (!schoolId) return;
    try {
      const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
      const studentsSnap = await getDocs(qStudents);
      setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Student)));
      
      const qStaff = query(collection(db, 'staff'), where('schoolId', '==', schoolId));
      const staffSnap = await getDocs(qStaff);
      setStaff(staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Staff)));
      
      const qClasses = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
      const classesSnap = await getDocs(qClasses);
      setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Class)));

      const qSubjects = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
      const subjectsSnap = await getDocs(qSubjects);
      setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Subject)));

      const qUsers = query(collection(db, 'users'), where('schoolId', '==', schoolId));
      const usersSnap = await getDocs(qUsers);
      setUsers(usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));

      const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
      if (schoolSnap.exists()) {
        setSchool({ id: schoolSnap.id, ...schoolSnap.data() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'multiple collections');
    }
  };

  useEffect(() => {
    fetchData();
  }, [schoolId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const collectionName = (activeSubTab === 'staff' || activeSubTab === 'teachers') ? 'staff' : activeSubTab;
    try {
      const data = { ...formData, schoolId };
      
      if (data.email) {
        data.email = data.email.trim().toLowerCase();
      }
      
      if (activeSubTab === 'teachers' && !editingId) {
        data.role = 'Professor';
      }

      if (activeSubTab === 'users') {
        const email = data.email?.trim().toLowerCase();
        if (!email) {
          setFeedback({ message: 'O e-mail é obrigatório!', type: 'error' });
          return;
        }

        if (!data.role) {
          setFeedback({ message: 'O papel do usuário é obrigatório!', type: 'error' });
          return;
        }

        if (editingId) {
          await updateDoc(doc(db, 'users', editingId), { 
            role: data.role, 
            name: data.name,
            schoolId: schoolId 
          });
          setFeedback({ message: 'Papel do usuário atualizado com sucesso!', type: 'success' });
        } else {
          // Check if user already exists by email in this school
          const q = query(collection(db, 'users'), where('email', '==', email), where('schoolId', '==', schoolId), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const existingUser = querySnapshot.docs[0].data();
            setFeedback({ 
              message: `O e-mail ${email} já está cadastrado para o usuário "${existingUser.name || 'Sem Nome'}".`, 
              type: 'error' 
            });
            return;
          }

          // Create a new user profile. 
          await addDoc(collection(db, 'users'), {
            name: data.name,
            email: email,
            role: data.role,
            schoolId: schoolId,
            createdAt: new Date().toISOString()
          });
          setFeedback({ message: 'Usuário cadastrado com sucesso!', type: 'success' });
        }
        setShowModal(false);
        fetchData();
        return;
      }

      if (activeSubTab === 'classes') {
        data.year = parseInt(data.year);
      }
      
      if (activeSubTab === 'students' && !editingId) {
        data.status = 'active';
      }

      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), data);
      } else {
        await addDoc(collection(db, collectionName), data);
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ address: {} });
      fetchData();
      setFeedback({ message: 'Registro salvo com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, collectionName);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id || item.uid);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ address: {} });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const collectionName = activeSubTab === 'staff' ? 'staff' : activeSubTab;
    try {
      if (activeSubTab === 'users') {
        await deleteDoc(doc(db, 'users', id));
      } else {
        await deleteDoc(doc(db, collectionName, id));
      }
      setShowConfirmModal(null);
      fetchData();
      setFeedback({ message: 'Registro excluído com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, activeSubTab === 'users' ? 'users' : collectionName);
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          results.data.forEach((row: any) => {
            if (row.firstName && row.registrationNumber) {
              const newDocRef = doc(collection(db, 'students'));
              batch.set(newDocRef, {
                firstName: row.firstName,
                lastName: row.lastName || '',
                cpf: row.cpf || '',
                rg: row.rg || '',
                birthDate: row.birthDate || '',
                birthPlace: row.birthPlace || '',
                contact: row.contact || '',
                registrationNumber: row.registrationNumber,
                status: 'active',
                schoolId,
                address: {
                  street: row.street || '',
                  number: row.number || '',
                  neighborhood: row.neighborhood || '',
                  city: row.city || '',
                  cep: row.cep || ''
                },
                guardianFirstName: row.guardianFirstName || '',
                guardianLastName: row.guardianLastName || '',
                guardianCpf: row.guardianCpf || '',
                guardianRg: row.guardianRg || '',
                guardianContact: row.guardianContact || ''
              });
            }
          });
          await batch.commit();
          setFeedback({ message: `${results.data.length} alunos importados com sucesso!`, type: 'success' });
          fetchData();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'students batch import');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "firstName", "lastName", "cpf", "rg", "birthDate", "birthPlace", "contact", 
      "registrationNumber", "street", "number", "neighborhood", "city", "cep",
      "guardianFirstName", "guardianLastName", "guardianCpf", "guardianRg", "guardianContact"
    ];
    const csvContent = headers.join(",") + "\nJoão,Silva,123.456.789-00,12.345.678-9,2010-05-15,São Paulo,(11) 99999-9999,2024001,Rua das Flores,123,Centro,São Paulo,01001-000,Maria,Silva,987.654.321-00,98.765.432-1,(11) 88888-8888";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_alunos_detalhado.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateAddress = (field: string, value: string) => {
    setFormData({
      ...formData,
      address: {
        ...formData.address,
        [field]: value
      }
    });
  };

  const handleAssignStudent = async (studentId: string, classId: string | null) => {
    try {
      await updateDoc(doc(db, 'students', studentId), { classId });
      fetchData();
    } catch (error) {
      console.error("Error assigning student", error);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !formData.subjectName) return;
    try {
      await addDoc(collection(db, 'subjects'), {
        name: formData.subjectName,
        classId: selectedClass.id,
        teacherId: formData.subjectTeacherId || null,
        schoolId
      });
      setFormData({ ...formData, subjectName: '', subjectTeacherId: '' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'subjects');
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subjects', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'subjects');
    }
  };

  const handleUpdateSubjectTeacher = async (subjectId: string, teacherId: string) => {
    try {
      await updateDoc(doc(db, 'subjects', subjectId), { teacherId });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'subjects');
    }
  };

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Secretaria</h1>
          <p className="text-slate-500">Gestão administrativa da escola</p>
        </div>
        <div className="flex gap-3">
          {activeSubTab === 'students' && (
            <>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-xl font-semibold transition-all shadow-sm"
                title="Baixar Modelo CSV"
              >
                <Download size={20} />
                Modelo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-xl font-semibold transition-all shadow-sm"
              >
                <FileUp size={20} />
                {importing ? 'Importando...' : 'Importar CSV'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCSVImport}
                accept=".csv"
                className="hidden"
              />
            </>
          )}
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md"
          >
            <Plus size={20} />
            Novo Registro
          </button>
        </div>
      </header>

      <div className="flex gap-4 mb-8 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('students')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'students' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Alunos
        </button>
        <button
          onClick={() => setActiveSubTab('teachers')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'teachers' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Professores
        </button>
        <button
          onClick={() => setActiveSubTab('staff')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'staff' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Funcionários
        </button>
        <button
          onClick={() => setActiveSubTab('classes')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'classes' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Turmas
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'users' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveSubTab('school')}
          className={`pb-4 px-4 font-semibold transition-all ${activeSubTab === 'school' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Escola
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {activeSubTab === 'school' ? (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Dados da Escola</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await updateDoc(doc(db, 'schools', school.id), school);
                setFeedback({ message: 'Dados da escola atualizados!', type: 'success' });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, 'schools');
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome da Escola</label>
                  <input type="text" value={school?.name || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Código da Escola</label>
                  <input type="text" value={school?.schoolCode || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, schoolCode: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Estado</label>
                  <input type="text" value={school?.state || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, state: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Prefeitura do Município</label>
                  <input type="text" value={school?.municipality || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, municipality: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Endereço</label>
                  <input type="text" value={school?.address || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, address: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Decreto de Criação</label>
                  <input type="text" value={school?.creationDecree || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, creationDecree: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Autorização</label>
                  <input type="text" value={school?.authorization || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, authorization: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Resolução</label>
                  <input type="text" value={school?.resolution || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, resolution: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Telefone</label>
                  <input type="text" value={school?.phone || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                  <input type="email" value={school?.email || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Site</label>
                  <input type="text" value={school?.site || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, site: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Blog</label>
                  <input type="text" value={school?.blog || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, blog: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Ano Letivo</label>
                  <input type="text" value={school?.schoolYear || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, schoolYear: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Logo URL</label>
                  <input type="text" value={school?.logoUrl || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setSchool({ ...school, logoUrl: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="mt-4 bg-emerald-600 text-white px-6 py-2 rounded-xl font-semibold">Salvar</button>
            </form>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nome</th>
                {activeSubTab === 'classes' ? (
                  <>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Turno</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Alunos</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                      {activeSubTab === 'students' ? 'Matrícula' : 'Cargo'}
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">CPF</th>
                  </>
                )}
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSubTab === 'students' && students.map(student => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {student.firstName || student.lastName 
                      ? `${student.firstName} ${student.lastName}`
                      : (student as any).name || 'Sem Nome'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{student.registrationNumber}</td>
                  <td className="px-6 py-4 text-slate-500">{student.cpf}</td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => handleEdit(student)} className="text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setShowConfirmModal({ show: true, id: student.id, type: 'aluno' })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {activeSubTab === 'teachers' && staff.filter(s => s.role === 'Professor').map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {member.firstName || member.lastName 
                      ? `${member.firstName} ${member.lastName}`
                      : (member as any).name || 'Sem Nome'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{member.role}</td>
                  <td className="px-6 py-4 text-slate-500">{member.cpf}</td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => handleEdit(member)} className="text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setShowConfirmModal({ show: true, id: member.id, type: 'professor' })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {activeSubTab === 'staff' && staff.filter(s => s.role !== 'Professor').map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {member.firstName || member.lastName 
                      ? `${member.firstName} ${member.lastName}`
                      : (member as any).name || 'Sem Nome'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{member.role}</td>
                  <td className="px-6 py-4 text-slate-500">{member.cpf}</td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => handleEdit(member)} className="text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setShowConfirmModal({ show: true, id: member.id, type: 'funcionário' })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {activeSubTab === 'classes' && classes.map(cls => (
                <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div>{cls.name}</div>
                    {cls.educationLevel && <div className="text-[10px] font-bold text-emerald-600 uppercase">{cls.educationLevel}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{cls.shift}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {students.filter(s => s.classId === cls.id).length} Alunos
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    <button 
                      onClick={() => { setSelectedClass(cls); setShowSubjectModal(true); }} 
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 transition-colors bg-emerald-50 px-2 py-1 rounded-lg"
                      title="Gerenciar Disciplinas"
                    >
                      <BookPlus size={16} />
                      <span className="text-xs font-bold uppercase">Disciplinas</span>
                    </button>
                    <button 
                      onClick={() => { setSelectedClass(cls); setShowStudentModal(true); }} 
                      className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors bg-blue-50 px-2 py-1 rounded-lg"
                      title="Adicionar Alunos"
                    >
                      <UserPlus size={16} />
                      <span className="text-xs font-bold uppercase">Alunos</span>
                    </button>
                    <button onClick={() => handleEdit(cls)} className="text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setShowConfirmModal({ show: true, id: cls.id, type: 'turma' })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {activeSubTab === 'users' && users.map(u => (
                <tr key={u.uid || u.email} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4 text-slate-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' :
                      u.role === 'secretary' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role === 'teacher' ? 'PROFESSOR' : u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => handleEdit(u)} className="text-slate-400 hover:text-emerald-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setShowConfirmModal({ show: true, id: u.uid || u.email, type: 'usuário' })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirmar Exclusão</h2>
            <p className="text-slate-500 mb-8">
              Tem certeza que deseja excluir este {showConfirmModal.type}? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showConfirmModal.id)}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-md"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl my-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingId ? 'Editar' : 'Novo'} {activeSubTab === 'students' ? 'Aluno' : activeSubTab === 'teachers' ? 'Professor' : activeSubTab === 'staff' ? 'Funcionário' : activeSubTab === 'users' ? 'Usuário' : 'Turma'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Personal Info Section */}
              {(activeSubTab === 'students' || activeSubTab === 'staff' || activeSubTab === 'teachers') && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome</label>
                      <input type="text" value={formData.firstName || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Sobrenome</label>
                      <input type="text" value={formData.lastName || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">CPF</label>
                      <input type="text" value={formData.cpf || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, cpf: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">RG</label>
                      <input type="text" value={formData.rg || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, rg: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data de Nascimento</label>
                      <input type="date" value={formData.birthDate || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Local de Nascimento</label>
                      <input type="text" value={formData.birthPlace || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, birthPlace: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Contato</label>
                      <input type="text" value={formData.contact || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, contact: e.target.value })} />
                    </div>
                    {activeSubTab === 'students' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Matrícula</label>
                          <input type="text" value={formData.registrationNumber || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Turma</label>
                          <select 
                            value={formData.classId || ''} 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
                            onChange={e => setFormData({ ...formData, classId: e.target.value })}
                          >
                            <option value="">Sem Turma</option>
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.id}>{cls.name} ({cls.grade})</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    {(activeSubTab === 'staff' || activeSubTab === 'teachers') && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Cargo</label>
                          <select value={formData.role || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, role: e.target.value })}>
                            <option value="">Selecione...</option>
                            {staffRoles.map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                          <input type="email" value={formData.email || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Address Section */}
              {(activeSubTab === 'students' || activeSubTab === 'staff' || activeSubTab === 'teachers') && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Rua</label>
                      <input type="text" value={formData.address?.street || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => updateAddress('street', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Número</label>
                      <input type="text" value={formData.address?.number || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => updateAddress('number', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Bairro</label>
                      <input type="text" value={formData.address?.neighborhood || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => updateAddress('neighborhood', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Cidade</label>
                      <input type="text" value={formData.address?.city || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => updateAddress('city', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">CEP</label>
                      <input type="text" value={formData.address?.cep || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => updateAddress('cep', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Guardian Section */}
              {activeSubTab === 'students' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Dados do Responsável</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome do Responsável</label>
                      <input type="text" value={formData.guardianFirstName || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, guardianFirstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Sobrenome do Responsável</label>
                      <input type="text" value={formData.guardianLastName || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, guardianLastName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">CPF do Responsável</label>
                      <input type="text" value={formData.guardianCpf || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, guardianCpf: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">RG do Responsável</label>
                      <input type="text" value={formData.guardianRg || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, guardianRg: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Contato do Responsável</label>
                      <input type="text" value={formData.guardianContact || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, guardianContact: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* User Role Section */}
              {activeSubTab === 'users' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">
                    {editingId ? 'Alterar Papel do Usuário' : 'Cadastrar Novo Usuário'}
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {!editingId && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome Completo</label>
                          <input type="text" value={formData.name || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">E-mail</label>
                          <input type="email" value={formData.email || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                      </>
                    )}
                    {editingId && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Usuário: <span className="text-slate-900">{formData.name}</span></p>
                        <p className="text-sm text-slate-500 mb-4">E-mail: {formData.email}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Papel no Sistema</label>
                      <select value={formData.role || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, role: e.target.value })}>
                        <option value="">Selecione...</option>
                        <option value="admin">ADMIN</option>
                        <option value="secretary">SECRETARIA</option>
                        <option value="supervisor">SUPERVISOR</option>
                        <option value="teacher">PROFESSOR</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Class Section */}
              {activeSubTab === 'classes' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Dados da Turma</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome da Turma</label>
                      <input type="text" value={formData.name || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Série</label>
                      <input type="text" value={formData.grade || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, grade: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Ano</label>
                      <input type="number" value={formData.year || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, year: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Turno</label>
                      <select value={formData.shift || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, shift: e.target.value })}>
                        <option value="">Selecione...</option>
                        {classShifts.map(shift => <option key={shift} value={shift}>{shift}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nível de Ensino</label>
                      <select value={formData.educationLevel || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, educationLevel: e.target.value })}>
                        <option value="">Selecione...</option>
                        <option value="Creche">Creche</option>
                        <option value="Educação Infantil">Educação Infantil</option>
                        <option value="Ensino Fundamental I">Ensino Fundamental I</option>
                        <option value="Ensino Fundamental II">Ensino Fundamental II</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Professor</label>
                      <select value={formData.teacherId || ''} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({ ...formData, teacherId: e.target.value })}>
                        <option value="">Selecione...</option>
                        {staff.filter(s => s.role === 'Professor').map(prof => (
                          <option key={prof.id} value={prof.id}>{prof.firstName} {prof.lastName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-md"
                >
                  {editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Student Assignment Modal */}
      {showStudentModal && selectedClass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Adicionar Alunos</h2>
                <p className="text-slate-500">Turma: {selectedClass.name} ({selectedClass.grade})</p>
              </div>
              <button onClick={() => setShowStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-700">Alunos Disponíveis</h3>
                <div className="grid grid-cols-1 gap-2">
                  {students.filter(s => !s.classId || s.classId === selectedClass.id).map(student => (
                    <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${student.classId === selectedClass.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                          {student.firstName ? student.firstName[0] : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-slate-500">Matrícula: {student.registrationNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignStudent(student.id, student.classId === selectedClass.id ? null : selectedClass.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          student.classId === selectedClass.id
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {student.classId === selectedClass.id ? 'Remover' : 'Adicionar'}
                      </button>
                    </div>
                  ))}
                  {students.filter(s => !s.classId || s.classId === selectedClass.id).length === 0 && (
                    <p className="text-center text-slate-400 py-8">Nenhum aluno disponível para esta turma.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 shadow-md"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Subject Management Modal */}
      {showSubjectModal && selectedClass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gerenciar Disciplinas</h2>
                <p className="text-slate-500">Turma: {selectedClass.name} ({selectedClass.grade})</p>
              </div>
              <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Add Subject Form */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Nova Disciplina</h3>
                  <form onSubmit={handleAddSubject} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nome da Disciplina</label>
                      <input 
                        type="text" 
                        required
                        value={formData.subjectName || ''} 
                        onChange={e => setFormData({ ...formData, subjectName: e.target.value })}
                        placeholder="Ex: Matemática"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Professor Titular</label>
                      <select 
                        value={formData.subjectTeacherId || ''} 
                        onChange={e => setFormData({ ...formData, subjectTeacherId: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecione um Professor...</option>
                        {staff.filter(s => s.role === 'Professor').map(prof => (
                          <option key={prof.id} value={prof.id}>{prof.firstName} {prof.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      Adicionar
                    </button>
                  </form>
                </div>

                {/* Subjects List */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Disciplinas da Turma</h3>
                  <div className="space-y-2">
                    {subjects.filter(s => s.classId === selectedClass.id).map(subject => (
                      <div key={subject.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-slate-900">{subject.name}</p>
                          <button 
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Professor</label>
                          <select 
                            value={subject.teacherId || ''} 
                            onChange={e => handleUpdateSubjectTeacher(subject.id, e.target.value)}
                            className="w-full px-3 py-1 text-sm rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                          >
                            <option value="">Sem Professor</option>
                            {staff.filter(s => s.role === 'Professor').map(prof => (
                              <option key={prof.id} value={prof.id}>{prof.firstName} {prof.lastName}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    {subjects.filter(s => s.classId === selectedClass.id).length === 0 && (
                      <p className="text-center text-slate-400 py-8 text-sm italic">Nenhuma disciplina cadastrada.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowSubjectModal(false)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 shadow-md"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
