import { useEffect } from "react";

export default function MaintenanceModeScreen() {
  useEffect(() => {
    // Prevent any scrolling or interaction
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-red-600 flex items-center justify-center z-[9999]">
      <div className="text-center px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Bakalaa
        </h1>
        <p className="text-xl md:text-3xl text-white font-semibold">
          Under Maintenance
        </p>
        <p className="text-sm md:text-base text-red-100 mt-4 max-w-md mx-auto">
          We are currently performing scheduled maintenance. Please check back soon.
        </p>
      </div>
    </div>
  );
}
