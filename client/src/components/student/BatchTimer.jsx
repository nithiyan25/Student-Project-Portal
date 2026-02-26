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

    const isActive = scope.isTimerRunning && isCollegeHours;

    return (
        <div className={`p-6 rounded-lg border flex items-center justify-between gap-8 md:min-w-[480px] shadow-sm transition-all duration-500 animate-in fade-in ${isActive ? 'bg-gray-900 text-white border-gray-800' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            <div className="flex items-center gap-5">
                <div className={`p-3 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/10' : 'bg-white border border-gray-200 text-gray-400'}`}>
                    <Clock size={24} className={isActive ? 'text-blue-400' : ''} />
                </div>
                <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>
                        Remaining Time
                    </p>
                    <h2 className="text-4xl font-bold font-mono tracking-tight leading-none">
                        {displayTime}
                    </h2>
                </div>
            </div>

            <div className="text-right hidden sm:block">
                {!isCollegeHours ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200/50 text-gray-600 px-3 py-1 rounded-lg flex items-center gap-2">
                            Outside College Hours
                        </span>
                        <p className="text-[10px] mt-2 font-medium opacity-60">Resumes at 08:45 AM (Mon-Sat)</p>
                    </div>
                ) : !scope.isTimerRunning ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 px-3 py-1 rounded-lg flex items-center gap-2 border border-amber-100">
                            Timer Paused by Admin
                        </span>
                        <p className="text-[10px] mt-2 font-medium text-amber-600/70">Awaiting admin action</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                                Session Active
                            </span>
                        </div>
                        <p className="text-[10px] font-medium text-gray-400">Project submission window is open</p>
                    </div>
                )}
            </div>
        </div>
    );
}

