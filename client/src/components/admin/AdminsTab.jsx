import React from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

export default function AdminsTab({
    filteredAdmins,
    newAdmin,
    setNewAdmin,
    addAdmin,
    deleteUser,
    userSearch,
    setUserSearch
}) {
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-800">
                    <UserPlus size={20} /> Add Admin
                </h2>
                <form onSubmit={addAdmin} className="space-y-4">
                    <input
                        required
                        className="w-full border p-2 rounded"
                        placeholder="Full Name"
                        value={newAdmin.name}
                        onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    />
                    <input
                        required
                        type="email"
                        className="w-full border p-2 rounded"
                        placeholder="Email"
                        value={newAdmin.email}
                        onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    />
                    <button className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700">
                        Add Admin
                    </button>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Admins ({filteredAdmins.length})</h2>
                    <SearchInput
                        value={userSearch}
                        onChange={setUserSearch}
                        placeholder="Search..."
                        className="w-64"
                    />
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Role</th>
                            <th className="p-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredAdmins.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 text-sm">
                                <td className="p-3 font-medium">{u.name}</td>
                                <td className="p-3 text-gray-500">{u.email}</td>
                                <td className="p-3">
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs border border-red-200 font-bold">ADMIN</span>
                                </td>
                                <td className="p-3 text-center">
                                    <button
                                        onClick={() => deleteUser(u.id, u.name, u.role)}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
                                        title="Delete admin"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredAdmins.length === 0 && (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">No admins found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
