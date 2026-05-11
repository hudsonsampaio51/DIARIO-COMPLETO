import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, School } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';

interface SchoolContextType {
  activeSchoolId: string | null;
  setActiveSchoolId: (id: string) => void;
  userSchools: School[];
}

const SchoolContext = createContext<SchoolContextType>({
  activeSchoolId: null,
  setActiveSchoolId: () => {},
  userSchools: []
});

export const useActiveSchool = () => useContext(SchoolContext);

export const ActiveSchoolProvider: React.FC<{ user: UserProfile, children: React.ReactNode }> = ({ user, children }) => {
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [userSchools, setUserSchools] = useState<School[]>([]);

  // Automatically select the first school if user has exactly 1 school
  useEffect(() => {
    if (!activeSchoolId && userSchools.length === 1) {
      setActiveSchoolId(userSchools[0].id);
    }
  }, [userSchools, activeSchoolId]);

  useEffect(() => {
    const fetchSchools = async () => {
      const idsToFetch = user.schoolIds || [];
      if (user.schoolId && !idsToFetch.includes(user.schoolId)) idsToFetch.push(user.schoolId);
      
      if (idsToFetch.length > 0) {
        try {
          // split into chunks of 10 if there are many schools, but mostly the user works in 2 or 3
          // chunking logic for 'in' query constraint
          const chunks = [];
          for (let i = 0; i < idsToFetch.length; i += 10) {
              chunks.push(idsToFetch.slice(i, i + 10));
          }
          let allSchools: School[] = [];
          for (const chunk of chunks) {
              const q = query(collection(db, 'schools'), where(documentId(), 'in', chunk));
              const snap = await getDocs(q);
              allSchools = allSchools.concat(snap.docs.map(d => ({ id: d.id, ...d.data() } as School)));
          }
          setUserSchools(allSchools);
        } catch (e) {
          console.error("Error fetching schools for context", e);
        }
      }
    };
    fetchSchools();
  }, [user.schoolId, user.schoolIds]);

  return (
    <SchoolContext.Provider value={{ activeSchoolId, setActiveSchoolId, userSchools }}>
      {children}
    </SchoolContext.Provider>
  );
};
