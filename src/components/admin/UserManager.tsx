import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Bike,
  Store,
  UserCheck,
  UserX,
  Plus,
  Edit2,
  RefreshCw,
  Phone,
  Mail,
  CheckCircle2,
  Lock,
  KeyRound
} from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, UserRole, UserStatus } from '../../types';
import { getRolePermissions } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

export const UserManager: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('customer');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, uid: d.id, ...d.data() } as UserProfile);
        });
        setUsersList(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Users listener notice:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid?.toLowerCase().includes(searchQuery.toLowerCase());

    const activeRole = u.active_role || u.role || 'customer';
    const matchesRole = roleFilter === 'all' || activeRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleToggleSuspend = async (user: UserProfile) => {
    triggerHaptic(50);
    const currentStatus = user.status || 'active';
    const nextStatus: UserStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: nextStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(
        nextStatus === 'suspended'
          ? `🔒 User ${user.name} has been SUSPENDED.`
          : `✓ User ${user.name} has been REACTIVATED.`
      );
    } catch (err) {
      toast.error('Failed to update account status');
    }
  };

  const handleGrantRole = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    triggerHaptic(50);

    try {
      const existingRoles = selectedUser.roles || [selectedUser.role || 'customer'];
      const updatedRoles = Array.from(new Set([...existingRoles, newRole]));
      const perms = getRolePermissions(newRole);

      await updateDoc(doc(db, 'users', selectedUser.uid), {
        roles: updatedRoles,
        active_role: newRole,
        role: newRole,
        permissions: perms,
        updated_at: new Date().toISOString()
      });

      // Also create specific sub-profile if needed
      if (newRole === 'rider') {
        await setDoc(
          doc(db, 'rider_profiles', selectedUser.uid),
          {
            user_id: selectedUser.uid,
            vehicle_type: 'motorcycle',
            is_online: true,
            is_verified: true,
            rating: 5.0,
            total_deliveries: 0,
            university_id: selectedUser.university_id || 'uni_mtu',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { merge: true }
        );
      } else if (newRole === 'kitchen') {
        await setDoc(
          doc(db, 'kitchen_staff_profiles', selectedUser.uid),
          {
            user_id: selectedUser.uid,
            vendor_id: 'rest_ronalds',
            vendor_name: "Ronald's Food House",
            role: 'kitchen_manager',
            permissions: perms,
            shift_status: 'on_duty',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { merge: true }
        );
      }

      toast.success(`✓ Successfully granted role '${newRole.toUpperCase()}' to ${selectedUser.name}!`);
      setSelectedUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user role');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Admin</span>;
      case 'kitchen':
      case 'kitchen_manager':
        return <span className="bg-orange-100 text-orange-900 border border-orange-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Kitchen</span>;
      case 'rider':
        return <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Rider</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Customer</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Users</span>
          <p className="text-3xl font-black text-slate-900 mt-2">{usersList.length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Customers</span>
          <p className="text-3xl font-black text-slate-900 mt-2">{usersList.filter(u => (u.active_role || u.role) === 'customer').length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Riders</span>
          <p className="text-3xl font-black text-slate-900 mt-2">{usersList.filter(u => (u.active_role || u.role) === 'rider').length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Kitchen Staff</span>
          <p className="text-3xl font-black text-slate-900 mt-2">{usersList.filter(u => ['kitchen', 'kitchen_manager', 'kitchen_staff'].includes(u.active_role || u.role)).length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search users by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Accounts' },
            { id: 'customer', label: 'Customers' },
            { id: 'rider', label: 'Riders' },
            { id: 'kitchen', label: 'Kitchens' },
            { id: 'admin', label: 'Admins' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setRoleFilter(pill.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                roleFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D6001C]" />
            <h2 className="font-extrabold text-slate-900 text-base">User Identities & RBAC Profiles ({filteredUsers.length})</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D6001C]" />
            Loading user identities...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-xs">
            No registered users match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Role & Permissions</th>
                  <th className="px-5 py-3">Campus Affiliation</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const role = u.active_role || u.role || 'customer';
                  const isSuspended = u.status === 'suspended';

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                            <img
                              src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email || u.uid)}`}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div>{u.name || 'BUKKIT User'}</div>
                            <div className="text-[10px] font-mono text-slate-400">{u.uid.slice(0, 10)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-800 font-medium">{u.email}</div>
                        <div className="text-[10px] text-slate-400">{u.phone || 'No phone'}</div>
                      </td>
                      <td className="px-5 py-3">
                        {getRoleBadge(role)}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(u.permissions || []).length > 0 ? `${(u.permissions || []).length} permissions` : 'Standard access'}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {u.university_id === 'uni_mtu' ? 'Mountain Top Univ' : u.university_id || 'MTU Campus'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isSuspended ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setNewRole((u.active_role || u.role || 'customer') as UserRole);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => handleToggleSuspend(u)}
                          className={`text-[11px] font-black px-2.5 py-1 rounded-xl transition-colors cursor-pointer ${
                            isSuspended
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                          }`}
                        >
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Management Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-900">Assign Platform Role</h3>
                  <p className="text-xs text-slate-500">{selectedUser.name} ({selectedUser.email})</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Select Authority Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]"
                >
                  <option value="customer">Customer (Storefront Ordering)</option>
                  <option value="rider">Rider (Campus Dispatch & Delivery)</option>
                  <option value="kitchen">Kitchen Manager (Menu & Order Prep)</option>
                  <option value="admin">Administrator (Full Oversight & Management)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-2">
                  Assigning this role will generate the appropriate sub-profile and grant authorized RBAC permissions.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGrantRole}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-[#D6001C] hover:bg-red-700 text-white font-black rounded-2xl text-xs transition-colors cursor-pointer shadow-md shadow-red-500/20"
                >
                  {isSaving ? 'Saving...' : 'Confirm Role'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
