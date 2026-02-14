import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { getCollegeSecondsBetween, isCollegeWorkingHour } from '../../utils/timerUtils';

export default function BatchTimer({ scope }) {
    const [displayTime, setDisplayTime] = useState('');
    const [isCollegeHours, setIsCollegeHours] = useState(false);

    useEffect(() => {
        // Calculate clock offset between server and client
        const serverNow = scope.serverTime ? new Date(scope.serverTime) : new Date();
        const clientNowAtReceive = new Date();
        const clockOffset = serverNow - clientNowAtReceive;

        const calculateRemaining = () => {
            const now = new Date(Date.now() + clockOffset);
            const working = isCollegeWorkingHour(now);
            setIsCollegeHours(working);

            let remainingSeconds = scope.currentRemainingSeconds || 0;

            if (scope.isTimerRunning && scope.timerLastUpdated && working) {
                // Use the precise synchronized college seconds calculation
                const lastUpdate = new Date(scope.timerLastUpdated);
                const elapsedSinceUpdate = getCollegeSecondsBetween(lastUpdate, now);
                remainingSeconds = Math.max(0, (scope.currentRemainingSeconds || 0) - elapsedSinceUpdate);
            }

            const h = Math.floor(remainingSeconds / 3600);
            const m = Math.floor((remainingSeconds % 3600) / 60);
            const s = Math.floor(remainingSeconds % 60);
            setDisplayTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 1000);
        return () => clearInterval(interval);
    }, [scope]);

    if (!scope.timerTotalHours) return null;

    return (
        <div className={`p-6 rounded-2xl border flex items-center justify-between shadow-sm transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${scope.isTimerRunning && isCollegeHours ? 'bg-blue-600 text-white border-blue-700 shadow-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${scope.isTimerRunning && isCollegeHours ? 'bg-white/20' : 'bg-gray-200 text-gray-400'}`}>
                    <Clock size={28} className={scope.isTimerRunning && isCollegeHours ? 'animate-pulse' : ''} />
                </div>
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 ${scope.isTimerRunning && isCollegeHours ? 'text-blue-100' : 'text-gray-400'}`}>
                        Remaining Time
                    </p>
                    <h2 className="text-3xl font-black font-mono tracking-tighter">
                        {displayTime}
                    </h2>
                </div>
            </div>

            <div className="text-right hidden sm:block">
                {!isCollegeHours ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-gray-200 text-gray-500 px-3 py-1 rounded-full flex items-center gap-2">
                            <AlertCircle size={12} /> Outside College Hours
                        </span>
                        <p className="text-[9px] mt-1 font-bold opacity-60">Timer paused until 08:45 AM (Mon-Sat)</p>
                    </div>
                ) : !scope.isTimerRunning ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-600 px-3 py-1 rounded-full flex items-center gap-2">
                            <AlertCircle size={12} /> Timer Paused by Admin
                        </span>
                        <p className="text-[9px] mt-1 font-bold opacity-60">Will resume once admin unpauses</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-3 py-1 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></span> Live Countdown
                        </span>
                        <p className="text-[9px] mt-1 font-bold text-blue-100">Project submission window is active</p>
                    </div>
                )}
            </div>
        </div>
    );
}
