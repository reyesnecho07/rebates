import React, { useState, useEffect } from "react";
import {
  Home,
  FileText,
  BarChart2,
  Users,
  Package,
  Settings,
  User,
  Search,
  IdCardLanyard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

function AccountSetup() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("/accountsetup");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const rowsPerPage = 10;

  // User data state
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form states
  const [newUser, setNewUser] = useState({
    username: "",
    userid: "",
    role: "user",
    department: "",
    status: "active"
  });
  
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: ""
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ Get current user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const username = storedUser.username || "Unknown User";
  const role = storedUser.role || "Unknown Role";

  // ✅ Generate initials
  const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
    return (
      parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    );
  };
  const initials = getInitials(username);

  // Sample user data
  useEffect(() => {
    const sampleUsers = [
      {
        id: 1,
        username: "john.doe",
        userId: "User1",
        role: "admin",
        department: "IT",
        status: "active",
        createdDate: "2024-01-15",
        lastLogin: "2025-01-20"
      },
      {
        id: 2,
        username: "maria.garcia",
        userId: "User2",
        role: "manager",
        department: "Sales",
        status: "active",
        createdDate: "2024-02-10",
        lastLogin: "2025-01-19"
      },
      {
        id: 3,
        username: "david.smith",
        userId: "User3",
        role: "user",
        department: "Marketing",
        status: "inactive",
        createdDate: "2024-03-05",
        lastLogin: "2024-12-15"
      },
      {
        id: 4,
        username: "lisa.wang",
        userId: "User4",
        role: "user",
        department: "Finance",
        status: "active",
        createdDate: "2024-04-20",
        lastLogin: "2025-01-18"
      },
      {
        id: 5,
        username: "robert.brown",
        userId: "User5",
        role: "manager",
        department: "Operations",
        status: "active",
        createdDate: "2024-05-12",
        lastLogin: "2025-01-17"
      }
    ];
    setUsers(sampleUsers);
  }, []);

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.userid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getPaginationRange = () => {
    const maxPages = 5;
    let start = Math.max(2, currentPage - Math.floor(maxPages / 2));
    let end = start + maxPages - 1;

    if (end >= totalPages) {
      end = totalPages - 1;
      start = Math.max(2, end - maxPages + 1);
    }

    const range = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  // User management functions
  const handleAddUser = () => {
    if (passwordData.password !== passwordData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const newUserObj = {
      id: users.length + 1,
      ...newUser,
      createdDate: new Date().toISOString().split('T')[0],
      lastLogin: "Never"
    };

    setUsers([...users, newUserObj]);
    setShowAddUserModal(false);
    resetForm();
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUser({
      username: user.username,
      userid: user.id,
      role: user.role,
      department: user.department,
      status: user.status
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = () => {
    setUsers(users.map(user => 
      user.id === editingUser.id 
        ? { ...user, ...newUser }
        : user
    ));
    setShowEditUserModal(false);
    resetForm();
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  const resetForm = () => {
    setNewUser({
      username: "",
      userid: "",
      role: "user",
      department: "",
      status: "active"
    });
    setPasswordData({
      password: "",
      confirmPassword: ""
    });
    setEditingUser(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-700";
      case "inactive": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin": return "bg-purple-100 text-purple-700";
      case "manager": return "bg-blue-100 text-blue-700";
      case "user": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-poppins text-black">
      {/* Sidebar - Fixed */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-300 flex flex-col transition-all duration-300 z-50 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header with Toggle */}
        <div className="flex items-center justify-between p-4 border-gray-200 relative">
          {!collapsed && (
            <h2 className=" font-bold text-gray-800 whitespace-nowrap">
              Rebate Management
            </h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ${
              collapsed ? "absolute top-4 left-5" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link 
                to="/dashboard" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/dashboard"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/dashboard")}
              >
                <Home className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Dashboard
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/rebatesetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/rebatesetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/rebatesetup")}
              >
                <FileText className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Rebate Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/reports" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/reports"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/reports")}
              >
                <BarChart2 className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Reports
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/customer" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/customer"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/customer")}
              >
                <Users className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Customer
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/items" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/items"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/items")}
              >
                <Package className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Items
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/salesemployee" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/salesemployee"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/salesemployee")}
              >
                <IdCardLanyard className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Sales Employee
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="mt-auto p-3">
          <ul className="space-y-1">
            <li>
              <Link 
                to="/settings" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/settings"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/settings")}
              >
                <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Settings
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/accountsetup" 
                className={`flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all ${
                  activeNav === "/accountsetup"
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "hover:bg-gray-50 hover:text-blue-500"
                }`}
                onClick={() => setActiveNav("/accountsetup")}
              >
                <User className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Account Setup
                </span>
              </Link>
            </li>

            <li>
              <Link 
                to="/login" 
                className="flex items-center text-gray-700 px-3 py-3 rounded-lg transition-all hover:bg-gray-50 hover:text-blue-500"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                <span className={`ml-3 font-medium text-sm whitespace-nowrap transition-opacity ${
                  collapsed ? "opacity-0 w-0" : "opacity-100"
                }`}>
                  Logout
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header - Fixed */}
        <header className="fixed top-0 right-0 h-16 flex items-center px-6 bg-white border-b border-gray-300 z-40 transition-all duration-300"
          style={{ 
            left: collapsed ? '80px' : '256px',
            width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
          }}
        >
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo size={80} />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-4 ml-auto mr-8">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-semibold text-sm flex items-center justify-center uppercase shadow-sm">
              {initials}
            </div>
            <div className="flex flex-col text-right">
              <p className="text-base font-semibold text-gray-800 whitespace-nowrap max-w-[150px] overflow-hidden">
                {username}
              </p>
              <p className="text-xs text-gray-600 text-left">
                {role}
              </p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="pt-16 flex-1 p-6 overflow-auto">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 w-full max-w-[1500px] mx-auto transition-all hover:shadow-md mt-6">
            {/* Header with Search and Add Button */}
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  User Accounts
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage system users and their access permissions
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 hover:border-blue-500 transition-colors font-poppins w-64"
                  />
                </div>

                {/* Add User Button */}
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
                >
                  <Plus size={16} />
                  Add User
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="w-full rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm text-gray-700">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        User ID
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Last Login
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length > 0 ? (
                      paginatedUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="even:bg-gray-50 hover:bg-blue-50 transition-colors"
                        >
                          <td className="px-4 py-3 border-b border-gray-100 font-medium text-xs">
                            {user.username}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-xs">
                            {user.id}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-xs">
                            {user.department}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-xs">
                            {user.lastLogin}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                title="Edit User"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete User"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-4 py-6 text-center text-gray-500 italic bg-gray-50 text-sm"
                        >
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6 flex-wrap gap-3">
              <div className="text-xs text-gray-600">
                Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 transition-colors font-medium"
                >
                  Previous
                </button>

                {totalPages > 0 && (
                  <>
                    <button
                      className={`px-2.5 py-1.5 text-xs border rounded-lg min-w-[32px] ${
                        currentPage === 1
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500"
                      } transition-colors font-medium`}
                      onClick={() => setCurrentPage(1)}
                    >
                      1
                    </button>
                  </>
                )}

                {getPaginationRange()[0] > 2 && (
                  <span className="px-1 text-gray-500 text-xs">...</span>
                )}

                {getPaginationRange().map((page) => (
                  <button
                    key={page}
                    className={`px-2.5 py-1.5 text-xs border rounded-lg min-w-[32px] ${
                      currentPage === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500"
                    } transition-colors font-medium`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                {getPaginationRange()[getPaginationRange().length - 1] < totalPages - 1 && (
                  <span className="px-1 text-gray-500 text-xs">...</span>
                )}

                {totalPages > 1 && (
                  <button
                    className={`px-2.5 py-1.5 text-xs border rounded-lg min-w-[32px] ${
                      currentPage === totalPages
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500"
                    } transition-colors font-medium`}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                )}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Add New User</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Id</label>
                <input
                  type="userid"
                  value={newUser.userid}
                  onChange={(e) => setNewUser({...newUser, userid: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter userid"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter department"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({...passwordData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleAddUser}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                <Save size={16} />
                Create User
              </button>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Id</label>
                <input
                  type="userid"
                  value={newUser.userid}
                  onChange={(e) => setNewUser({...newUser, userid: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newUser.status}
                  onChange={(e) => setNewUser({...newUser, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleUpdateUser}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                <Save size={16} />
                Update User
              </button>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSetup;