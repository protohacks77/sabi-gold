
import React, { useState } from 'react';
import { auth } from '../services/firebase';
// FIX: Use compat version of auth functions and types instead of modular imports.
import firebase from 'firebase/compat/app';
import Spinner from './common/Spinner';
import { Icons } from './common/Icons';
import Modal from './common/Modal';
import Toast from './common/Toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // FIX: Use auth.signInWithEmailAndPassword from the compat library.
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      // FIX: Use firebase.auth.AuthError for type assertion from the compat library.
      const authError = err as firebase.auth.AuthError;
      if (authError.code === 'auth/user-not-found' && email === 'admin@gmail.com') {
        try {
            // FIX: Use auth.createUserWithEmailAndPassword from the compat library.
            await auth.createUserWithEmailAndPassword(email, password);
        } catch (createErr) {
            const createAuthError = createErr as firebase.auth.AuthError;
            setError(createAuthError.message);
        }
      } else if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
          setError('Invalid credentials. Please try again.');
      }
      else {
        setError(authError.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async () => {
      if(!resetEmail) {
          setNotification({message: "Please enter your email address.", type: 'error'});
          return;
      }
      setIsLoading(true);
      try {
          await auth.sendPasswordResetEmail(resetEmail);
          setNotification({message: "Password reset email sent! Please check your inbox.", type: 'success'});
          setIsForgotModalOpen(false);
          setResetEmail('');
      } catch (error: any) {
          setNotification({message: error.message, type: 'error'});
      }
      setIsLoading(false);
  };

  return (
    <>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      <Modal isOpen={isForgotModalOpen} onClose={() => setIsForgotModalOpen(false)} title="Reset Password">
          <div className="space-y-4">
              <p className="text-gray-400">Enter your admin email address and we will send you a link to reset your password.</p>
              <input 
                  type="email"
                  placeholder="admin@example.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400"
              />
              <div className="flex justify-end space-x-4 pt-2">
                <button onClick={() => setIsForgotModalOpen(false)} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                <button onClick={handlePasswordReset} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors flex items-center min-w-[120px] justify-center" disabled={isLoading}>
                    {isLoading ? <Spinner /> : 'Send Link'}
                </button>
            </div>
          </div>
      </Modal>
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-800 p-4 font-inter">
        <div className="w-full max-w-sm">
          <div className="bg-gray-900 shadow-2xl rounded-2xl p-8 border border-gray-700">
              <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-2">
                      <Icons.LogoGold />
                      <h1 className="text-2xl font-bold text-white">Sabi Gold Mine</h1>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Admin Panel Login</h2>
                  <p className="text-gray-400 text-sm">Welcome, please enter your details to continue.</p>
              </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">Email</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icons.Email />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full p-3 pl-10 bg-gray-800 rounded-lg border border-gray-700 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition"
                    />
                </div>
              </div>
              <div>
                <label htmlFor="password"className="sr-only">Password</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icons.Lock />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full p-3 pl-10 pr-10 bg-gray-800 rounded-lg border border-gray-700 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white">
                        {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-gray-400">
                      <input type="checkbox" className="rounded bg-gray-800 border-gray-600 text-yellow-400 focus:ring-yellow-400" />
                      Remember Me
                  </label>
                  <button type="button" onClick={() => setIsForgotModalOpen(true)} className="font-medium text-yellow-400 hover:text-yellow-500">Forgot Password?</button>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 mt-2 border border-transparent rounded-lg shadow-sm text-lg font-bold text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-400 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? <Spinner /> : 'Login'}
                </button>
              </div>
            </form>
          </div>
          <div className="text-center text-xs text-gray-500 mt-6 space-y-1">
               <p>© 2024 Sabi Gold Mine. All rights reserved.</p>
               <p>For assistance, please contact IT Support at extension 555</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;