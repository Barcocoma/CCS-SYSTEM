import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { apiRequest } from '../../lib/api';

export const Login = ({ onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Unable to connect to server. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 to-orange-200 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-w-5xl w-full min-h-[600px]"
      >
        <div className="flex-1 p-12 flex flex-col justify-center">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/university-of-cabuyao.png"
              alt="University Logo"
              className="h-20 mb-4"
            />
            <h1 className="text-2xl font-bold text-emerald-800 text-center">CCS Comprehensive Profiling System</h1>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Demo account: <span className="font-semibold">admin@example.com</span> / <span className="font-semibold">admin123</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <input
                type="text"
                placeholder="Email or account ID"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                required
                disabled={loading}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Need another account for the demo?</p>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                Register Now
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 bg-zinc-900 relative overflow-hidden hidden md:flex items-center justify-center p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(234,88,12,0.35),_transparent_45%),linear-gradient(135deg,#111827,#0f172a)]" />
          <div className="relative z-10 text-center">
            <div className="w-64 h-64 bg-white rounded-full flex items-center justify-center p-6 border-8 border-orange-600 shadow-2xl mb-8 mx-auto">
              <img
                src="/ccs-logo.png"
                alt="CCS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-white text-3xl font-bold tracking-wider">COLLEGE OF COMPUTING STUDIES</h2>
            <p className="text-orange-400 mt-2 font-medium">University of Cabuyao</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
