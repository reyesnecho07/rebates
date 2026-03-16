import React, { createContext, useState, useContext, useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState({
    userName: '',
    userCode: '',
    initials: '',
    collapsed: false
  });

  // Load user data from localStorage or API
  useEffect(() => {
    const loadUserData = async () => {
      // Example: Fetch from API or localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUserData(prev => ({
          ...prev,
          userName: parsedUser.name || '',
          userCode: parsedUser.code || '',
          initials: parsedUser.initials || ''
        }));
      }
    };
    
    loadUserData();
  }, []);

  const updateUserData = (data) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const toggleCollapsed = () => {
    setUserData(prev => ({ ...prev, collapsed: !prev.collapsed }));
  };

  return (
    <UserContext.Provider value={{ ...userData, updateUserData, toggleCollapsed }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);