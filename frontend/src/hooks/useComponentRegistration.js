import { useEffect, useRef, useMemo } from 'react';
import componentService from '../services/componentService';

export const useComponentRegistration = (metadata) => {
  const hasRegistered = useRef(false);
  
  // Serialize metadata to avoid object reference issues
  const metadataKey = useMemo(() => JSON.stringify(metadata), [
    metadata?.name,
    metadata?.routePath,
    metadata?.version
  ]);

  useEffect(() => {
    if (!metadata || !metadata.name || !metadata.routePath) {
      console.warn('⚠️ Component registration skipped: Missing required metadata', metadata);
      return;
    }

    if (hasRegistered.current) return;

    const register = async () => {
      try {
        console.log(`📝 Registering component: ${metadata.name}`, metadata);

        const registrationData = {
          name: metadata.name,
          componentName: metadata.name,
          routePath: metadata.routePath,
          version: metadata.version || '1.0.0',
          description: metadata.description || '',
          metadata: {
            ...metadata,
            registeredAt: new Date().toISOString(),
            source: 'useComponentRegistration'
          }
        };

        const result = await componentService.registerComponent(registrationData);

        if (result && result.success) {
          console.log(`✅ Component ${metadata.name} registered successfully`);
          hasRegistered.current = true;
        } else {
          console.error(`❌ Failed to register component ${metadata.name}:`, result);
        }
      } catch (error) {
        console.error(`❌ Error registering component ${metadata.name}:`, error);
      }
    };

    const timer = setTimeout(register, 500);
    return () => clearTimeout(timer);

  }, [metadataKey]); // stable string dependency instead of object

  return hasRegistered.current;
};