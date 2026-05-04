import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole, SchoolAccess } from '../types';
import { LogIn, LogOut, User as UserIcon, BookOpen, Users, AlertCircle } from 'lucide-react';

export const Auth: React.FC<{ onUserChange: (user: UserProfile | null) => void }> = ({ onUserChange }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showRoleSelection, setShowRoleSelection] = useState<UserProfile | null>(null);
  const [showSchoolSelection, setShowSchoolSelection] = useState<{ schoolAccess: SchoolAccess[]; firebaseUser: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          let profile = userDoc.data() as UserProfile;
          
          // Force superadmin role for the specific admin email
          if (firebaseUser.email === 'admin@eadmatosinho.com' && profile.role !== 'superadmin') {
            profile = { ...profile, role: 'superadmin' };
            await setDoc(doc(db, 'users', firebaseUser.uid), profile);
          }
          
          setUser(profile);
          setError(null);
          onUserChange(profile);
        } else {
          // Check schoolAccess collection for email-based access
          const userEmail = firebaseUser.email?.toLowerCase();
          if (!userEmail) {
            setError('Email não encontrado');
            setLoading(false);
            return;
          }

          const schoolAccessQuery = query(collection(db, 'schoolAccess'), where('email', '==', userEmail));
          const schoolAccessSnapshot = await getDocs(schoolAccessQuery);

          if (!schoolAccessSnapshot.empty) {
            // Email é reconhecido - pode logar
            const schoolAccesses = schoolAccessSnapshot.docs.map(doc => doc.data() as SchoolAccess);

            if (schoolAccesses.length === 1) {
              // Apenas 1 escola - logar direto
              const schoolAccess = schoolAccesses[0];
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Usuário',
                email: userEmail,
                role: schoolAccess.role,
                schoolId: schoolAccess.schoolId,
                activeSchoolId: schoolAccess.schoolId,
                schoolIds: [schoolAccess.schoolId],
                createdAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setUser(newProfile);
              setError(null);
              onUserChange(newProfile);
            } else {
              // Múltiplas escolas - mostrar seletor
              setShowSchoolSelection({ schoolAccess: schoolAccesses, firebaseUser });
              setError(null);
            }
          } else {
            // Email não registrado em nenhuma escola
            setError(`Email ${userEmail} não está registrado na plataforma. Entre em contato com o administrador da sua escola.`);
            await signOut(auth);
          }
        }
      } else {
        setUser(null);
        onUserChange(null);
        setShowRoleSelection(null);
        setShowSchoolSelection(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onUserChange]);

  const handleRoleSelect = async (role: UserRole) => {
    if (showRoleSelection) {
      const profile = { ...showRoleSelection, role };
      await setDoc(doc(db, 'users', profile.uid), profile);
      setUser(profile);
      onUserChange(profile);
      setShowRoleSelection(null);
    }
  };

  const handleSchoolSelect = async (schoolAccess: SchoolAccess, firebaseUser: any) => {
    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Usuário',
      email: firebaseUser.email || '',
      role: schoolAccess.role,
      schoolId: schoolAccess.schoolId,
      activeSchoolId: schoolAccess.schoolId,
      schoolIds: showSchoolSelection?.schoolAccess.map(sa => sa.schoolId) || [schoolAccess.schoolId],
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
    setUser(newProfile);
    setShowSchoolSelection(null);
    setError(null);
    onUserChange(newProfile);
  };

  const handleSwitchSchool = async (schoolId: string) => {
    if (user) {
      const updatedProfile = { ...user, schoolId, activeSchoolId: schoolId };
      setUser(updatedProfile);
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      onUserChange(updatedProfile);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSwitchUser = async () => {
    await signOut(auth);
    handleLogin();
  };

  if (loading) return null;

  if (showRoleSelection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Selecione seu Papel</h2>
          <p className="text-slate-500 mb-8">Como você deseja acessar o sistema?</p>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => handleRoleSelect('teacher')}
              className="w-full py-3 px-6 rounded-xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all font-semibold text-slate-700"
            >
              Professor
            </button>
            <button
              onClick={() => handleRoleSelect('secretary')}
              className="w-full py-3 px-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all font-semibold text-slate-700"
            >
              Secretaria
            </button>
            <button
              onClick={() => handleRoleSelect('supervisor')}
              className="w-full py-3 px-6 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-semibold text-slate-700"
            >
              Supervisor
            </button>
          </div>
          <button 
            onClick={handleSwitchUser}
            className="mt-6 text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Entrar com outra conta
          </button>
        </div>
      </div>
    );
  }

  if (showSchoolSelection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Selecione sua Escola</h2>
          <p className="text-slate-500 mb-8">Você está registrado em múltiplas escolas</p>
          <div className="grid grid-cols-1 gap-3">
            {showSchoolSelection.schoolAccess.map((schoolAccess) => (
              <button
                key={schoolAccess.schoolId}
                onClick={() => handleSchoolSelect(schoolAccess, showSchoolSelection.firebaseUser)}
                className="w-full py-3 px-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all font-semibold text-slate-700 text-left"
              >
                <div className="flex items-center justify-between">
                  <span>{schoolAccess.schoolId}</span>
                  <span className="text-xs bg-slate-200 px-2 py-1 rounded capitalize">
                    {schoolAccess.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={handleSwitchUser}
            className="mt-6 text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Entrar com outra conta
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full text-center border-2 border-red-200">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Não Permitido</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-slate-200">
      <div className="flex-1 flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
          <UserIcon className="text-slate-600 w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            {user.role === 'superadmin' && (
              <select 
                value={user.role} 
                onChange={(e) => handleSwitchRole(e.target.value as UserRole)}
                className="text-[10px] bg-slate-100 border-none rounded px-1 py-0 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <option value="superadmin">SuperAdmin</option>
                <option value="admin">Admin</option>
                <option value="teacher">Professor</option>
                <option value="secretary">Secretaria</option>
                <option value="supervisor">Supervisor</option>
              </select>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {user.schoolIds && user.schoolIds.length > 1 && (
          <>
            <select 
              value={user.activeSchoolId || user.schoolId || ''}
              onChange={(e) => handleSwitchSchool(e.target.value)}
              className="text-sm bg-slate-100 border-none rounded px-2 py-1 cursor-pointer hover:bg-slate-200 transition-colors"
              title="Trocar de Escola"
            >
              {user.schoolIds.map(schoolId => (
                <option key={schoolId} value={schoolId}>{schoolId}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-200"></div>
          </>
        )}
        <button
          onClick={handleSwitchUser}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors px-3 py-1 rounded-lg hover:bg-blue-50"
          title="Trocar de Conta Google"
        >
          <Users size={18} />
          <span className="text-sm font-medium">Trocar Usuário</span>
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1"></div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};
