import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const { login } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      const user = await login(credentialResponse.credential);
      redirectUser(user);
    } catch (err) {
      addToast("Login Failed. Ensure your email is registered in the system.", 'error');
    }
  };

  const redirectUser = (user) => {
    if (user.role === 'ADMIN') navigate('/admin');
    else if (user.role === 'FACULTY') navigate('/faculty');
    else navigate('/student');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500">

        {/* Main Card */}
        <div className="bg-white py-12 px-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-2xl border border-slate-100 flex flex-col items-center">

          <h2 className="text-center text-xl sm:text-2xl font-semibold tracking-tight text-slate-800 mb-8">
            Welcome Back!
          </h2>

          <div className="flex flex-col items-center justify-center space-y-4 mb-3">
            <div className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100 ring-1 ring-slate-900/5 transition-transform hover:scale-105 duration-300">
              <img
                src={`${import.meta.env.BASE_URL}new_logoimg.png`}
                alt="Institution Logo"
                className="h-24 w-auto object-contain drop-shadow-sm"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                }}
              />
            </div>
          </div>

          <h3 className="text-center text-lg sm:text-xl font-medium text-slate-600 mt-6 mb-5">
            Student Project Portal
          </h3>

          <div className="w-16 h-[2px] bg-indigo-100 mb-8 rounded-full"></div>

          <div className="w-full relative rounded-lg overflow-hidden bg-white hover:opacity-95 transition-opacity ring-1 ring-slate-900/5">
            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => addToast('Google Login Failed.', 'error')}
                useOneTap
                theme="outline"
                shape="rectangular"
                width="340"
                size="large"
                text="signin_with"
              />
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Sign in with your <span className="font-bold text-indigo-600">BITSATHY</span> account
          </p>

        </div>
      </div>
    </div>
  );
}
