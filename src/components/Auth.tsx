import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { LogIn, LogOut, User as UserIcon, BookOpen, Users } from 'lucide-react';

export const Auth: React.FC<{ onUserChange: (user: UserProfile | null) => void }> = ({ onUserChange }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showRoleSelection, setShowRoleSelection] = useState<UserProfile | null>(null);

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
          onUserChange(profile);
        } else {
          // Check if user was pre-registered by email
          const userEmail = firebaseUser.email?.toLowerCase();
          const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const preRegDoc = querySnapshot.docs[0];
            const preRegData = preRegDoc.data();
            const profile: UserProfile = {
              ...preRegData as UserProfile,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || preRegData.name || 'Usuário'
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), profile);
            if (preRegDoc.id !== firebaseUser.uid) {
              await deleteDoc(preRegDoc.ref);
            }
            setUser(profile);
            onUserChange(profile);
          } else {
            // New user - show role selection
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário',
              email: firebaseUser.email || '',
              role: 'teacher', // default
              createdAt: new Date().toISOString(),
            };
            
            // If it's the specific admin email, auto-assign superadmin
            if (firebaseUser.email === 'admin@eadmatosinho.com') {
              newProfile.role = 'superadmin';
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setUser(newProfile);
              onUserChange(newProfile);
            } else {
              setShowRoleSelection(newProfile);
            }
          }
        }
      } else {
        setUser(null);
        onUserChange(null);
        setShowRoleSelection(null);
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

  const handleSwitchRole = async (role: UserRole) => {
    if (user) {
      const updatedProfile = { ...user, role };
      setUser(updatedProfile);
      onUserChange(updatedProfile);
      // We don't necessarily want to save this to DB if it's just for testing, 
      // but the user asked for the "option" to log in as teacher.
      // For now, let's just update the local state to allow them to see the view.
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

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="p-10 bg-white rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
            <BookOpen className="text-emerald-600 w-10 h-10 -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">SISGES SAMPAIO</h1>
          <p className="text-slate-500 mb-10">Sistema Integrado de Gestão Escolar</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-2xl hover:bg-slate-800 transition-all font-semibold shadow-xl shadow-slate-200"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
        </div>
      </div>
    );
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
