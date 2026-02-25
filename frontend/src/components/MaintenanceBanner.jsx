import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { AlertCircle, Clock } from "lucide-react";

export default function MaintenanceBanner({ mode = "user" }) {
    const { isMaintenanceMode, loading } = useMaintenanceMode(mode);

    if (loading || !isMaintenanceMode) return null;

    return (
        <div className="w-full bg-[#8E0E2C] text-white overflow-hidden relative sticky top-0 z-[9999] shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
                {/* Live Soon Badge */}
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">We will be live soon</span>
                </div>

                {/* Status Message */}
                <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                        Store is Closed
                    </h2>
                    <div className="h-4 w-[1px] bg-white/30 hidden sm:block"></div>
                    <p className="text-xs sm:text-sm text-white/80 font-medium">
                        Currently undergoing maintenance
                    </p>
                </div>
            </div>

            {/* Subtle background animation effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>

            <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
        </div>
    );
}
