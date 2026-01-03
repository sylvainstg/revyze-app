import React, { createContext, useContext, useState, ReactNode } from "react";
import { ProjectRole } from "../types";

interface AdminContextType {
  impersonatedRole: ProjectRole | null;
  setImpersonatedRole: (role: ProjectRole | null) => void;
  isAdminMode: boolean; // Whether the admin tools are visible/active
  toggleAdminMode: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [impersonatedRole, setImpersonatedRole] = useState<ProjectRole | null>(
    null,
  );
  const [isAdminMode, setIsAdminMode] = useState(false);

  const toggleAdminMode = () => setIsAdminMode((prev) => !prev);

  return (
    <AdminContext.Provider
      value={{
        impersonatedRole,
        setImpersonatedRole,
        isAdminMode,
        toggleAdminMode,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};
