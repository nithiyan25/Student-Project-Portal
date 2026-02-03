import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();


  const handleSuccess = async (credentialResponse) => {
    try {
      const user = await login(credentialResponse.credential);
      redirectUser(user);
    } catch (err) {
      alert("Login Failed. Ensure your email is registered in the system.");
    }
  };



  const redirectUser = (user) => {
    if (user.role === 'ADMIN') navigate('/admin');
    else if (user.role === 'FACULTY') navigate('/faculty');
    else navigate('/student');
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-96 animate-in fade-in zoom-in-95">
        <h1 className="text-3xl font-black mb-2 text-blue-900">Portal Login</h1>
        <p className="mb-8 text-sm text-gray-500">Welcome to the Student Project Portal</p>

        <div className="flex flex-col items-center gap-4">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={(error) => {
              console.error('Google Login Error Details:', error);
              alert('Google Login Failed. Check browser console (F12) for details.');
            }}
            useOneTap
            theme="filled_blue"
            shape="pill"
          />
        </div>
      </div>
    </div>
  );
}