import { createRoot } from "react-dom/client";
import { FirebaseConfigMissing, getMissingFirebaseEnvKeys } from "@shared/components/FirebaseConfigMissing";
import "@shared/styles/index.css";
import "leaflet/dist/leaflet.css";
import "@shared/lib/leaflet/setup";

const missingFirebaseKeys = getMissingFirebaseEnvKeys();

if (missingFirebaseKeys.length > 0) {
  createRoot(document.getElementById("root")!).render(
    <FirebaseConfigMissing missing={missingFirebaseKeys} />
  );
} else {
  const bootstrap = async () => {
    const { default: App } = await import("./App.tsx");
    createRoot(document.getElementById("root")!).render(<App />);
  };

  bootstrap().catch((error) => {
    console.error("Failed to start Delivery Dashboard:", error);
    createRoot(document.getElementById("root")!).render(
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Unable to load Delivery Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Check the browser console, verify your internet connection, and restart{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  });
}
