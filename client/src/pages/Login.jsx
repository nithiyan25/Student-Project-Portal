import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return alert("Please enter your email.");

    setIsLoading(true);
    try {
      const user = await login(email);
      redirectUser(user);
    } catch (err) {
      alert(err.response?.data?.error || "Login Failed. Ensure your email is registered in the system.");
    } finally {
      setIsLoading(false);
    }
  };

  const redirectUser = (user) => {
    if (user.role === 'ADMIN') navigate('/admin');
    else if (user.role === 'FACULTY') navigate('/faculty');
    else navigate('/student');
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl text-center w-full max-w-md animate-in fade-in zoom-in-95">
        <h1 className="text-3xl font-black mb-2 text-blue-900">Portal Login</h1>
        <p className="mb-8 text-sm text-gray-500 font-medium">Welcome to the Student Project Portal</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
              Registered Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-medium text-slate-700 bg-slate-50/50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : "Login to Portal"}
          </button>
        </form>

        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
          SECURE ACADEMIC ACCESS PORTAL
        </p>
      </div>
    </div>
  );
}