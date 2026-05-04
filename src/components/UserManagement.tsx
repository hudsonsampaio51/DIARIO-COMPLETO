import React, { useState } from 'react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { Plus, Trash2, Mail, User, Building2 } from 'lucide-react';

interface UserManagementProps {
  currentUser: UserProfile;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);

  // Se for Admin da Escola, usa a schoolId dele
  const workingSchoolId = currentUser.role === 'admin' ? currentUser.schoolId : schoolId;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !workingSchoolId || !role) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    setLoading(true);
    try {
      // Adicionar em schoolAccess
      await addDoc(collection(db, 'schoolAccess'), {
        email: email.toLowerCase(),
        schoolId: workingSchoolId,
        role: role,
        createdAt: new Date().toISOString(),
      });

      setMessage({
        type: 'success',
        text: `${email} adicionado como ${role} na escola ${workingSchoolId}`,
      });

      // Limpar formulário
      setEmail('');
      setRole('teacher');
      if (currentUser.role === 'superadmin') {
        setSchoolId('');
      }

      // Recarregar lista
      loadRegisteredUsers();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Erro: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRegisteredUsers = async () => {
    try {
      const q = query(
        collection(db, 'schoolAccess'),
        where('schoolId', '==', workingSchoolId)
      );
      const snapshot = await getDocs(q);
      setRegisteredUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleDeleteUser = async (docId: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        await deleteDoc(doc(db, 'schoolAccess', docId));
        setMessage({ type: 'success', text: 'Usuário removido' });
        loadRegisteredUsers();
      } catch (error: any) {
        setMessage({ type: 'error', text: `Erro: ${error.message}` });
      }
    }
  };

  // Carregar usuários ao montar
  React.useEffect(() => {
    if (workingSchoolId) {
      loadRegisteredUsers();
    }
  }, [workingSchoolId]);

  // Validar permissões
  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600 font-semibold">
          Permissão negada. Apenas SuperAdmin e Admin podem gerenciar usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <User className="w-6 h-6 text-blue-600" />
          {currentUser.role === 'superadmin'
            ? 'Gerenciar Admins de Escolas'
            : 'Gerenciar Usuários da Escola'}
        </h2>
        <p className="text-slate-600">
          {currentUser.role === 'superadmin'
            ? 'Adicione administradores para suas escolas'
            : 'Adicione professores, secretários e supervisores'}
        </p>
      </div>

      {/* Formulário */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleAddUser}
        className="bg-slate-50 p-6 rounded-lg mb-6 border border-slate-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email
            </label>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 focus-within:border-blue-500">
              <Mail className="w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="flex-1 outline-none bg-transparent text-sm"
              />
            </div>
          </div>

          {/* Papel/Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Papel
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-blue-500"
            >
              {currentUser.role === 'superadmin' ? (
                <option value="admin">Admin da Escola</option>
              ) : (
                <>
                  <option value="teacher">Professor</option>
                  <option value="secretary">Secretária</option>
                  <option value="supervisor">Supervisor</option>
                </>
              )}
            </select>
          </div>

          {/* School ID (só SuperAdmin) */}
          {currentUser.role === 'superadmin' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ID da Escola
              </label>
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 focus-within:border-blue-500">
                <Building2 className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  placeholder="ex: school_001"
                  className="flex-1 outline-none bg-transparent text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Mensagem */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-3 rounded-lg text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all font-semibold disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Adicionando...' : 'Adicionar Usuário'}
        </button>
      </motion.form>

      {/* Lista de Usuários */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          Usuários Registrados ({registeredUsers.length})
        </h3>
        {registeredUsers.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nenhum usuário registrado ainda</p>
        ) : (
          <div className="space-y-2">
            {registeredUsers.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{user.email}</p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                      {user.role}
                    </span>
                    <span>Escola: {user.schoolId}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Remover usuário"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
